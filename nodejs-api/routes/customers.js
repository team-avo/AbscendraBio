const express = require("express");
const { body, param, query } = require("express-validator");
const prisma = require("../prisma/client");
const validateRequest = require("../middleware/validateRequest");
const { asyncHandler } = require("../middleware/errorHandler");
const { requireRole, requirePermission } = require("../middleware/auth");

const router = express.Router();
const bcrypt = require("bcryptjs");
const { sendWelcomeEmail } = require("../utils/emailService");
const nodemailer = require("nodemailer");
const path = require("path");
const { Resend } = require("resend");
const resend = require('../config/resend');
const { queueReport } = require("../services/reportQueue");

// const resend = new Resend(process.env.RESEND_API_KEY); (now handled via config/resend.js)

// Allow CUSTOMER role to access only their own customer record; otherwise require module permission
const permitCustomerSelfOr = (action) => {
  return (req, res, next) => {
    const user = req.user;
    const targetId = req.params.id || req.params.customerId;
    if (user && user.role === "CUSTOMER") {
      if (targetId && user.customerId === targetId) {
        return next();
      }
      return res
        .status(403)
        .json({ success: false, error: "Access denied. Not your account." });
    }
    // Fallback to staff permission requirement
    return requirePermission("CUSTOMERS", action)(req, res, next);
  };
};

// -------------------------------
// Admin: Purge ALL customer data
// -------------------------------
// Highly destructive: deletes all customers and related records.
// Must be ADMIN and provide explicit confirmation.
router.delete(
  "/purge-all",
  requireRole(["ADMIN"]),
  asyncHandler(async (req, res) => {
    const { confirm } = req.query;
    if (String(confirm).toLowerCase() !== "yes") {
      return res.status(400).json({
        success: false,
        error: "Confirmation missing. Append ?confirm=yes to proceed.",
      });
    }

    // Collect all customer and linked user/order/cart ids up front
    const [customers, users, orders, carts] = await Promise.all([
      prisma.customer.findMany({ select: { id: true } }),
      prisma.user.findMany({
        where: { customerId: { not: null } },
        select: { id: true, customerId: true },
      }),
      prisma.order.findMany({ select: { id: true, customerId: true } }),
      prisma.cart.findMany({ select: { id: true, customerId: true } }),
    ]);

    const customerIds = customers.map((c) => c.id);
    const userIds = users.map((u) => u.id);
    const orderIds = orders.map((o) => o.id);
    const cartIds = carts.map((c) => c.id);

    await prisma.$transaction(async (tx) => {
      // Refunds must be removed before payments (restrict by default)
      if (orderIds.length > 0) {
        await tx.refund.deleteMany({
          where: { payment: { orderId: { in: orderIds } } },
        });
      }

      // Promotion usage references both order and customer (restrict by default)
      if (orderIds.length > 0 || customerIds.length > 0) {
        await tx.promotionUsage.deleteMany({
          where: {
            OR: [
              orderIds.length ? { orderId: { in: orderIds } } : undefined,
              customerIds.length
                ? { customerId: { in: customerIds } }
                : undefined,
            ].filter(Boolean),
          },
        });
      }

      // Transactions linked to orders
      if (orderIds.length > 0) {
        await tx.transaction.deleteMany({
          where: { orderId: { in: orderIds } },
        });
      }

      // Payments (refunds already removed)
      if (orderIds.length > 0) {
        await tx.payment.deleteMany({ where: { orderId: { in: orderIds } } });
      }

      // Shipments
      if (orderIds.length > 0) {
        await tx.shipment.deleteMany({ where: { orderId: { in: orderIds } } });
      }

      // Order notes and audit logs on orders
      if (orderIds.length > 0) {
        await tx.orderNote.deleteMany({ where: { orderId: { in: orderIds } } });
        await tx.auditLog.deleteMany({ where: { orderId: { in: orderIds } } });
      }

      // Order items
      if (orderIds.length > 0) {
        await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      }

      // Product reviews by customers
      if (customerIds.length > 0) {
        await tx.productReview.deleteMany({
          where: { customerId: { in: customerIds } },
        });
      }

      // Favorites
      if (customerIds.length > 0) {
        await tx.favorite.deleteMany({
          where: { customerId: { in: customerIds } },
        });
      }

      // Sales rep assignments
      if (customerIds.length > 0) {
        await tx.salesRepCustomerAssignment.deleteMany({
          where: { customerId: { in: customerIds } },
        });
      }

      // Cart items then carts
      if (cartIds.length > 0) {
        await tx.cartItem.deleteMany({ where: { cartId: { in: cartIds } } });
        await tx.cart.deleteMany({ where: { id: { in: cartIds } } });
      }

      // Addresses
      if (customerIds.length > 0) {
        await tx.address.deleteMany({
          where: { customerId: { in: customerIds } },
        });
      }

      // Campaign events: detach customer reference (nullable)
      if (customerIds.length > 0) {
        await tx.campaignEvent.updateMany({
          where: { customerId: { in: customerIds } },
          data: { customerId: null },
        });
      }

      // Delete orders after dependents are cleared
      if (orderIds.length > 0) {
        await tx.order.deleteMany({ where: { id: { in: orderIds } } });
      }

      // Audit logs linked to users need removal before deleting users
      if (userIds.length > 0) {
        await tx.auditLog.deleteMany({ where: { userId: { in: userIds } } });
      }

      // Delete users tied to customers
      if (userIds.length > 0) {
        await tx.user.deleteMany({ where: { id: { in: userIds } } });
      }

      // Finally, delete customers (will cascade CustomerTag, etc.)
      if (customerIds.length > 0) {
        await tx.customer.deleteMany({ where: { id: { in: customerIds } } });
      }
    });

    res.json({
      success: true,
      message: "All customer data purged successfully",
      deletedCustomers: customerIds.length,
    });
  })
);

// Get all customers with pagination and filters
router.get(
  "/",
  requirePermission("CUSTOMERS", "READ"),
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 10000 })
      .withMessage("Limit must be between 1 and 10000"),
    query("customerType")
      .optional()
      .isIn(["B2C", "B2B", "ENTERPRISE_1", "ENTERPRISE_2", "ENTERPRISE"])
      .withMessage("Invalid customer type"),
    query("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be boolean"),
    query("isApproved")
      .optional()
      .isBoolean()
      .withMessage("isApproved must be boolean"),
    query("search")
      .optional()
      .isString()
      .withMessage("Search must be a string"),
    query("approvalStatus")
      .optional()
      .isIn(["PENDING", "APPROVED", "DEACTIVATED"])
      .withMessage("Invalid approval status"),
    query("salesRepId")
      .optional()
      .isString()
      .withMessage("salesRepId must be a string"),
    query("salesManagerId")
      .optional()
      .isString()
      .withMessage("salesManagerId must be a string"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      customerType,
      isActive,
      isApproved,
      approvalStatus,
      search,
      salesRepId,
      salesManagerId,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const where = {};
    if (customerType) where.customerType = customerType;
    if (isActive !== undefined) where.isActive = isActive === "true";
    if (isApproved !== undefined) where.isApproved = isApproved === "true";
    if (approvalStatus) where.approvalStatus = approvalStatus;

    if (salesRepId === "unassigned") {
      where.salesAssignments = { none: {} };
    } else if (salesRepId) {
      where.salesAssignments = { some: { salesRepId } };
    }

    if (salesManagerId === "unassigned") {
      where.salesManagerAssignments = { none: {} };
    } else if (salesManagerId) {
      where.salesManagerAssignments = { some: { salesManagerId } };
    }
    if (search) {
      const searchTerms = search.split(/\s+/).filter(Boolean);
      if (searchTerms.length > 0) {
        const searchConditions = searchTerms.map(term => ({
          OR: [
            { firstName: { contains: term, mode: "insensitive" } },
            { lastName: { contains: term, mode: "insensitive" } },
            { email: { contains: term, mode: "insensitive" } },
            { mobile: { contains: term, mode: "insensitive" } },
          ]
        }));
        where.AND = [
          ...(where.AND || []),
          ...searchConditions
        ];
      }
    }

    // SALES_REP: restrict to assigned customers only
    if (req.user && req.user.role === "SALES_REP") {
      where.salesAssignments = { some: { salesRep: { userId: req.user.id } } };
    }

    // SALES_MANAGER: restrict to assigned customers only
    if (req.user && req.user.role === "SALES_MANAGER") {
      where.salesManagerAssignments = { some: { salesManager: { userId: req.user.id } } };
    }

    // Get customers and total count
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { [sortBy]: sortOrder },
        include: {
          addresses: {
            select: {
              id: true,
              type: true,
              city: true,
              state: true,
              country: true,
              isDefault: true,
            },
          },
          customerTags: {
            select: {
              id: true,
              tag: true,
            },
          },
          salesAssignments: {
            include: {
              salesRep: {
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
          salesManagerAssignments: {
            include: {
              salesManager: {
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
          _count: {
            select: {
              orders: true,
              addresses: true,
              reviews: true,
            },
          },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    // Compute full counts under same filters (search, sales rep scope) but across statuses/types and approval states
    const baseWhere = { ...where };
    if (baseWhere.isActive !== undefined) delete baseWhere.isActive;
    if (baseWhere.customerType) delete baseWhere.customerType;
    if (baseWhere.isApproved !== undefined) delete baseWhere.isApproved;
    if (baseWhere.approvalStatus) delete baseWhere.approvalStatus; // Remove approvalStatus from baseWhere for these specific counts

    const [
      pendingCount,
      approvedCount,
      rejectedCount,
      activeCount,
      inactiveCount,
      b2cCount,
      b2bCount,
      e1Count,
      e2Count,
    ] = await Promise.all([
      prisma.customer.count({
        where: { ...baseWhere, approvalStatus: "PENDING" }
      }),
      prisma.customer.count({
        where: { ...baseWhere, approvalStatus: "APPROVED" }
      }),
      prisma.customer.count({
        where: { ...baseWhere, approvalStatus: "DEACTIVATED" }
      }),
      prisma.customer.count({
        where: { ...baseWhere, isActive: true, approvalStatus: "APPROVED" },
      }),
      prisma.customer.count({
        where: { ...baseWhere, isActive: false, approvalStatus: "APPROVED" },
      }),
      prisma.customer.count({
        where: { ...baseWhere, customerType: "B2C", approvalStatus: "APPROVED" },
      }),
      prisma.customer.count({
        where: { ...baseWhere, customerType: "B2B", approvalStatus: "APPROVED" },
      }),
      prisma.customer.count({
        where: { ...baseWhere, customerType: "ENTERPRISE_1", approvalStatus: "APPROVED" },
      }),
      prisma.customer.count({
        where: { ...baseWhere, customerType: "ENTERPRISE_2", approvalStatus: "APPROVED" },
      }),
    ]);

    res.json({
      success: true,
      data: {
        customers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
        stats: {
          pending: pendingCount,
          approved: approvedCount,
          rejected: rejectedCount,
          active: activeCount,
          inactive: inactiveCount,
          pendingApproval: pendingCount, // Legacy support
          b2c: b2cCount,
          b2b: b2bCount,
          e1: e1Count,
          e2: e2Count,
        },
      },
    });
  })
);

// Get customer by ID
router.get(
  "/:id",
  permitCustomerSelfOr("READ"),
  [
    param("id").isString().withMessage("Customer ID is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        addresses: {
          orderBy: { createdAt: "desc" },
        },
        customerTags: {
          select: {
            id: true,
            tag: true,
          },
        },
        salesAssignments: {
          include: {
            salesRep: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        salesManagerAssignments: {
          include: {
            salesManager: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        orders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        reviews: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: {
                  select: {
                    url: true,
                    altText: true,
                  },
                  take: 1,
                  orderBy: { sortOrder: "asc" },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        _count: {
          select: {
            orders: true,
            addresses: true,
            reviews: true,
          },
        },
      },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: "Customer not found",
      });
    }

    res.json({
      success: true,
      data: customer,
    });
  })
);

// Create new customer
router.post(
  "/",
  requirePermission("CUSTOMERS", "CREATE"),
  [
    body("firstName").notEmpty().trim().withMessage("First name is required"),
    body("lastName").notEmpty().trim().withMessage("Last name is required"),
    body("middleName").optional().trim(),
    body("companyName").optional().trim(),
    body("licenseNumber")
      .optional()
      .notEmpty()
      .trim()
      .withMessage("NPI / License number cannot be empty if provided"),
    body("email")
      .isEmail()
      .normalizeEmail({
        gmail_remove_dots: false,
        gmail_remove_subaddress: false,
        gmail_convert_googlemaildotcom: false,
      })
      .withMessage("Valid email is required"),
    body("mobile").optional().trim(),
    // Relaxed password policy: minimum 4 chars, no spaces
    body("password")
      .optional()
      .isLength({ min: 4 })
      .withMessage("Password must be at least 4 characters long")
      .custom((val) => (typeof val === "string" ? !/\s/.test(val) : true))
      .withMessage("Password cannot contain spaces"),
    body("customerType")
      .optional()
      .isIn(["B2C", "B2B", "ENTERPRISE_1", "ENTERPRISE_2", "ENTERPRISE"])
      .withMessage("Invalid customer type"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be boolean"),
    body("tags").optional().isArray().withMessage("Tags must be an array"),
    body("addresses")
      .optional()
      .isArray()
      .withMessage("Addresses must be an array"),
    body("addresses.*.type")
      .optional()
      .isIn(["BILLING", "SHIPPING"])
      .withMessage("Invalid address type"),
    body("addresses.*.firstName")
      .optional()
      .notEmpty()
      .withMessage("Address first name is required"),
    body("addresses.*.lastName")
      .optional()
      .notEmpty()
      .withMessage("Address last name is required"),
    body("addresses.*.address1")
      .optional()
      .notEmpty()
      .withMessage("Address line 1 is required"),
    body("addresses.*.city")
      .optional()
      .notEmpty()
      .withMessage("City is required"),
    body("addresses.*.state")
      .optional()
      .notEmpty()
      .withMessage("State is required"),
    body("addresses.*.postalCode")
      .optional()
      .notEmpty()
      .withMessage("Postal code is required"),
    body("addresses.*.country")
      .optional()
      .notEmpty()
      .withMessage("Country is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const {
      firstName,
      lastName,
      middleName,
      companyName,
      licenseNumber,
      city,
      zip,
      email,
      mobile,
      password,
      customerType = "B2C",
      isActive = false,
      tags = [],
      addresses = [],
    } = req.body;

    const cleanedCompanyName =
      typeof companyName === "string" ? companyName.trim() : undefined;
    const cleanedLicenseNumber =
      typeof licenseNumber === "string" ? licenseNumber.trim() : undefined;
    const cleanedCity = typeof city === "string" ? city.trim() : undefined;
    const cleanedZip = typeof zip === "string" ? zip.trim() : undefined;

    // Check if customer already exists
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        OR: [
          { email },
          mobile ? { mobile } : null
        ].filter(Boolean),
      },
    });

    if (existingCustomer) {
      return res.status(409).json({
        success: false,
        error: "Customer already exists with this email or mobile number",
      });
    }

    // Create customer with optional linked user, addresses and tags in transaction
    const customer = await prisma.$transaction(async (tx) => {
      const createdBySalesRep = !!(req.user && req.user.role === "SALES_REP");
      const createdBySalesManager = !!(req.user && req.user.role === "SALES_MANAGER");
      const createdByAdmin = !!(req.user && req.user.role === "ADMIN");
      const autoApprove = createdBySalesRep || createdBySalesManager || createdByAdmin;
      // Create customer
      const newCustomer = await tx.customer.create({
        data: {
          firstName,
          lastName,
          middleName,
          companyName: cleanedCompanyName || null,
          licenseNumber: cleanedLicenseNumber || null,
          city: cleanedCity || null,
          zip: cleanedZip || null,
          email,
          mobile,
          customerType:
            customerType === "ENTERPRISE" ? "ENTERPRISE_1" : customerType,
          // When created by admin, sales rep, or sales manager, always auto-approve and activate
          // This ensures customers don't go into pending/rejected status
          isActive: autoApprove ? true : isActive ?? false,
          isApproved: autoApprove,
          emailVerified: autoApprove,
          mobileVerified: autoApprove,
          approvalStatus: autoApprove ? "APPROVED" : "PENDING",
        },
      });

      // If password provided, create linked user account (inactive until approval + email verification)
      if (password) {
        const hashed = await bcrypt.hash(password, 12);
        await tx.user.create({
          data: {
            email,
            password: hashed,
            firstName,
            lastName,
            role: "CUSTOMER",
            isActive: autoApprove ? true : false,
            customerId: newCustomer.id,
          },
        });
      }

      // Auto-assign customer to sales rep if current user is a sales representative
      if (req.user && req.user.role === "SALES_REP") {
        // Find or create sales representative record
        let salesRep = await tx.salesRepresentative.findUnique({
          where: { userId: req.user.id },
        });

        if (!salesRep) {
          salesRep = await tx.salesRepresentative.create({
            data: { userId: req.user.id },
          });
        }

        // Create assignment
        await tx.salesRepCustomerAssignment.create({
          data: {
            salesRepId: salesRep.id,
            customerId: newCustomer.id,
          },
        });
      }

      // Auto-assign customer to sales manager if current user is a sales manager
      if (req.user && req.user.role === "SALES_MANAGER") {
        // Find or create sales manager record
        let salesManager = await tx.salesManager.findUnique({
          where: { userId: req.user.id },
        });

        if (!salesManager) {
          salesManager = await tx.salesManager.create({
            data: { userId: req.user.id },
          });
        }

        // Create assignment
        await tx.salesManagerCustomerAssignment.create({
          data: {
            salesManagerId: salesManager.id,
            customerId: newCustomer.id,
          },
        });
      }

      // Create tags
      if (tags.length > 0) {
        await tx.customerTag.createMany({
          data: tags.map((tag) => ({
            customerId: newCustomer.id,
            tag,
          })),
        });
      }

      // Create addresses
      if (addresses.length > 0) {
        await tx.address.createMany({
          data: addresses.map((addr, index) => ({
            customerId: newCustomer.id,
            type: addr.type || "BILLING",
            firstName: addr.firstName || firstName,
            lastName: addr.lastName || lastName,
            company: addr.company,
            address1: addr.address1,
            address2: addr.address2,
            city: addr.city,
            state: addr.state,
            postalCode: addr.postalCode,
            country: addr.country || "US",
            phone: addr.phone,
            isDefault: index === 0, // First address is default
          })),
        });
      }

      return newCustomer;
    });

    // Fetch complete customer with relations
    const completeCustomer = await prisma.customer.findUnique({
      where: { id: customer.id },
      include: {
        addresses: true,
        customerTags: {
          select: {
            id: true,
            tag: true,
          },
        },
        salesAssignments: {
          include: {
            salesRep: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Attempt to send credentials email automatically if password provided
    if (password && typeof password === "string") {
      try {
        const loginUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"
          }/login`;
        const logoUrl = "https://centrelabs.org/logo.png";

        const subject = "Your Centre Labs account credentials";
        const html = `
        <body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f6f7fb;">
          <table align="center" cellpadding="0" cellspacing="0" width="600" style="background:#ffffff;margin:24px auto;border:1px solid #eee;border-radius:8px;overflow:hidden">
            <tr><td style="padding:24px 24px 0 24px;text-align:center;background:#ffffff;border-bottom:1px solid #f0f0f0;">
              <img src="https://centrelabs.org/logo.png" alt="Centre Labs" style="display:inline-block;width:120px;height:auto;margin:0 auto 8px auto;" />
              <h1 style="margin:16px 0 8px 0;color:#111827;font-size:22px;">Welcome to Centre Labs</h1>
              <p style="margin:0 0 16px 0;color:#6b7280;font-size:14px;">Hello ${firstName || ""
          }, your account has been created.</p>
            </td></tr>
            <tr><td style="padding:24px;">
              <h3 style="margin:0 0 8px 0;color:#111827;font-size:16px;">Login credentials</h3>
              <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px 0">
                <tr><td style="padding:8px 0;color:#374151;font-size:14px;width:120px;">Email</td><td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;">${email}</td></tr>
                <tr><td style="padding:8px 0;color:#374151;font-size:14px;width:120px;">Password</td><td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;">${password}</td></tr>
              </table>
              <div style="text-align:center;margin-top:16px;">
                <a href="${loginUrl}" style="display:inline-block;padding:12px 20px;background:#111827;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600">Login to your account</a>
              </div>
            </td></tr>
          </table>
        </body>
      `;

        console.log('[Resend] Sending customer credentials email...');
        await resend.emails.send({
          from: 'Notifications | Centre Research <notifications@centreresearch.org>',
          to: email,
          subject,
          html,
        });
        console.log('[Resend] Credentials email sent successfully');
      } catch (e) {
        console.error("[Resend] Failed to send credentials email:", e);
      }
    }

    res.status(201).json({
      success: true,
      message: "Customer created successfully",
      data: completeCustomer,
    });
  })
);

// Notify customer with credentials email (hardcoded template)
router.post(
  "/:id/notify-credentials",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { password } = req.body || {};

    // Only staff with CUSTOMERS:UPDATE or sales reps can notify
    const user = req.user;
    const isSalesRep = user && user.role === "SALES_REP";
    if (!isSalesRep) {
      try {
        await requirePermission("CUSTOMERS", "UPDATE")(req, res, () => { });
      } catch {
        return; // requirePermission already responded
      }
    }

    if (!password || typeof password !== "string") {
      return res
        .status(400)
        .json({
          success: false,
          error: "Password is required to notify customer",
        });
    }

    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      return res
        .status(404)
        .json({ success: false, error: "Customer not found" });
    }

    const loginUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"
      }/login`;

    // Use hosted logo for Resend
    const logoUrl = "https://centrelabs.org/logo.png";

    const subject = "Your Centre Labs account credentials";
    const html = `
  <body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f6f7fb;">
    <table align="center" cellpadding="0" cellspacing="0" width="600" style="background:#ffffff;margin:24px auto;border:1px solid #eee;border-radius:8px;overflow:hidden">
      <tr>
        <td style="padding:24px 24px 0 24px;text-align:center;background:#ffffff;border-bottom:1px solid #f0f0f0;">
          <img src="${logoUrl}" alt="Centre Labs" style="display:inline-block;width:120px;height:auto;margin:0 auto 8px auto;" />
          <h1 style="margin:16px 0 8px 0;color:#111827;font-size:22px;">Welcome to Centre Labs</h1>
          <p style="margin:0 0 16px 0;color:#6b7280;font-size:14px;">Hello ${customer.firstName || ""
      }, your account has been created.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <h3 style="margin:0 0 8px 0;color:#111827;font-size:16px;">Login credentials</h3>
          <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px 0">
            <tr>
              <td style="padding:8px 0;color:#374151;font-size:14px;width:120px;">Email</td>
              <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;">${customer.email
      }</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#374151;font-size:14px;width:120px;">Password</td>
              <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;">${password}</td>
            </tr>
          </table>
          <div style="text-align:center;margin-top:16px;">
            <a href="${loginUrl}" style="display:inline-block;padding:12px 20px;background:#111827;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600">Login to your account</a>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px 24px 24px;color:#9ca3af;font-size:12px;text-align:center;border-top:1px solid #f0f0f0;">
          © ${new Date().getFullYear()} Centre Labs. All rights reserved.
        </td>
      </tr>
    </table>
  </body>`;

    try {
      console.log('[Resend] Sending notified credentials email...');
      await resend.emails.send({
        from: 'Notifications | Centre Research <notifications@centreresearch.org>',
        to: customer.email,
        subject,
        html,
      });
      console.log('[Resend] Notified credentials email sent successfully');
      return res.json({ success: true, message: "Credentials email sent" });
    } catch (e) {
      console.error("[Resend] Failed to send email:", e);
      return res
        .status(500)
        .json({
          success: false,
          error: "Failed to send email",
          details: String(e?.message || e),
        });
    }
  })
);

// Reset customer password manually
router.post(
  "/:id/reset-password",
  requirePermission("CUSTOMERS", "UPDATE"),
  [
    param("id").isString().withMessage("Customer ID is required"),
    body("newPassword")
      .isLength({ min: 4 })
      .withMessage("New password must be at least 4 characters long")
      .custom((val) => !/\s/.test(val))
      .withMessage("New password cannot contain spaces"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { newPassword } = req.body;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: "Customer not found",
      });
    }

    if (!customer.user) {
      return res.status(400).json({
        success: false,
        error: "Customer does not have a linked user account",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: customer.user.id },
      data: { password: hashedPassword },
    });

    res.json({
      success: true,
      message: "Customer password updated successfully",
    });
  })
);

// Update customer
router.put(
  "/:id",
  permitCustomerSelfOr("UPDATE"),
  [
    param("id").isString().withMessage("Customer ID is required"),
    body("firstName")
      .optional()
      .notEmpty()
      .trim()
      .withMessage("First name cannot be empty"),
    body("lastName")
      .optional()
      .notEmpty()
      .trim()
      .withMessage("Last name cannot be empty"),
    body("middleName").optional().trim(),
    body("companyName").optional().trim(),
    body("licenseNumber")
      .optional()
      .notEmpty()
      .trim()
      .withMessage("NPI / License number cannot be empty"),
    body("city").optional().trim(),
    body("zip").optional().trim(),
    body("email")
      .optional()
      .isEmail()
      .normalizeEmail({
        gmail_remove_dots: false,
        gmail_remove_subaddress: false,
        gmail_convert_googlemaildotcom: false,
      })
      .withMessage("Valid email is required"),
    body("mobile").optional().trim(),
    body("customerType")
      .optional()
      .isIn(["B2C", "B2B", "ENTERPRISE_1", "ENTERPRISE_2", "ENTERPRISE"])
      .withMessage("Invalid customer type"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be boolean"),
    body("isApproved")
      .optional()
      .isBoolean()
      .withMessage("isApproved must be boolean"),
    body("tags").optional().isArray().withMessage("Tags must be an array"),
    body("smsTransactionalConsent").optional().isBoolean(),
    body("smsMarketingConsent").optional().isBoolean(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      firstName,
      lastName,
      middleName,
      email,
      mobile,
      customerType,
      isActive,
      isApproved,
      tags,
      smsTransactionalConsent,
      smsMarketingConsent,
    } = req.body;
    const { companyName, licenseNumber, city, zip } = req.body;
    const cleanedCompanyName =
      typeof companyName === "string" ? companyName.trim() : undefined;
    const cleanedLicenseNumber =
      typeof licenseNumber === "string" ? licenseNumber.trim() : undefined;
    const cleanedCity = typeof city === "string" ? city.trim() : undefined;
    const cleanedZip = typeof zip === "string" ? zip.trim() : undefined;

    // Check if customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!existingCustomer) {
      return res.status(404).json({
        success: false,
        error: "Customer not found",
      });
    }

    // Check if email or mobile is already taken by another customer
    if (email || mobile) {
      const conflicts = await prisma.customer.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [email ? { email } : {}, mobile ? { mobile } : {}].filter(
                (condition) => Object.keys(condition).length > 0
              ),
            },
          ],
        },
      });

      if (conflicts) {
        return res.status(409).json({
          success: false,
          error: "Email or mobile number is already taken by another customer",
        });
      }
    }

    // Track previous approval state for email trigger
    const wasApproved = !!existingCustomer.isApproved;
    const prevStatus = existingCustomer.approvalStatus;

    // Update customer in transaction
    const customer = await prisma.$transaction(async (tx) => {
      // Update customer basic info
      const updateData = {};
      if (firstName) updateData.firstName = firstName;
      if (lastName) updateData.lastName = lastName;
      if (middleName !== undefined) updateData.middleName = middleName;
      if (companyName !== undefined)
        updateData.companyName = cleanedCompanyName || null;
      if (licenseNumber !== undefined)
        updateData.licenseNumber = cleanedLicenseNumber || null;
      if (city !== undefined) updateData.city = cleanedCity || null;
      if (zip !== undefined) updateData.zip = cleanedZip || null;
      if (email) updateData.email = email;
      if (mobile) updateData.mobile = mobile;
      if (customerType)
        updateData.customerType =
          customerType === "ENTERPRISE" ? "ENTERPRISE_1" : customerType;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (isApproved !== undefined) {
        updateData.isApproved = isApproved;
        updateData.approvalStatus = isApproved ? "APPROVED" : "DEACTIVATED";
        updateData.isActive = isApproved; // active when approved, inactive when deactivated
      }
      // SMS consent: stamp the time/source whenever either consent changes.
      if (smsTransactionalConsent !== undefined)
        updateData.smsTransactionalConsent = smsTransactionalConsent === true;
      if (smsMarketingConsent !== undefined)
        updateData.smsMarketingConsent = smsMarketingConsent === true;
      if (
        smsTransactionalConsent !== undefined ||
        smsMarketingConsent !== undefined
      ) {
        updateData.smsConsentAt = new Date();
        updateData.smsConsentSource = "profile";
      }

      await tx.customer.update({
        where: { id },
        data: updateData,
      });

      // Keep linked user active state and email in sync
      if (isApproved !== undefined || email) {
        const userUpdateData = {};
        if (isApproved !== undefined) userUpdateData.isActive = isApproved;
        if (email) userUpdateData.email = email;

        await tx.user.updateMany({
          where: { customerId: id },
          data: userUpdateData,
        });
      }

      // Update tags
      if (tags) {
        await tx.customerTag.deleteMany({
          where: { customerId: id },
        });

        if (tags.length > 0) {
          await tx.customerTag.createMany({
            data: tags.map((tag) => ({
              customerId: id,
              tag,
            })),
          });
        }
      }

      return tx.customer.findUnique({
        where: { id },
        include: {
          addresses: true,
          customerTags: {
            select: {
              id: true,
              tag: true,
            },
          },
        },
      });
    });

    // If approval toggled from false -> true, send welcome email (best-effort)
    if (
      isApproved !== undefined &&
      !wasApproved &&
      customer?.isApproved &&
      customer.email
    ) {
      try {
        await sendWelcomeEmail(customer);
        // eslint-disable-next-line no-console
        console.log("[CUSTOMERS] Welcome email sent to", customer.email);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(
          "[CUSTOMERS] Failed to send welcome email via template, attempting raw send:",
          e?.message || e
        );
        try {
          const subject = `Welcome to Centre Labs, ${customer.firstName || ""}`.trim();
          const html = `
          <h1>Welcome to Centre Labs</h1>
          <p>Hi ${customer.firstName || "there"},</p>
          <p>Your customer account has been approved. You can now log in and start exploring our products.</p>
          <p><a href="${process.env.FRONTEND_URL || "http://localhost:3000"
            }/login" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:6px">Sign in</a></p>
          <p>Thank you,<br/>Centre Labs Team</p>
        `;
          console.log("[CUSTOMERS] Sending raw welcome email via Resend...");
          await resend.emails.send({
            from: 'Notifications | Centre Research <notifications@centreresearch.org>',
            to: customer.email,
            subject,
            html,
          });
          console.log("[CUSTOMERS] Raw welcome email sent to", customer.email);
        } catch (rawErr) {
          console.error(
            "[CUSTOMERS] Raw welcome email send failed:",
            rawErr?.message || rawErr
          );
        }
      }
    }

    res.json({
      success: true,
      message: "Customer updated successfully",
      data: customer,
    });
  })
);

// Delete customer (soft delete)
router.delete(
  "/:id",
  requirePermission("CUSTOMERS", "DELETE"),
  [
    param("id").isString().withMessage("Customer ID is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check if customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!existingCustomer) {
      return res.status(404).json({
        success: false,
        error: "Customer not found",
      });
    }

    // Soft delete by setting isActive to false
    await prisma.customer.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({
      success: true,
      message: "Customer deactivated successfully",
    });
  })
);

// Hard delete customer (permanently remove from database)
router.delete(
  "/:id/hard",
  requirePermission("CUSTOMERS", "DELETE"),
  [
    param("id").isString().withMessage("Customer ID is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check if customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id },
      include: {
        orders: { select: { id: true } },
        addresses: { select: { id: true } },
        reviews: { select: { id: true } },
        customerTags: { select: { id: true } },
        promotionUsage: { select: { id: true } },
        user: { select: { id: true } },
        carts: { select: { id: true } },
        favorites: { select: { id: true } },
        campaignEvents: { select: { id: true } },
        salesAssignments: { select: { id: true } },
      },
    });

    if (!existingCustomer) {
      return res.status(404).json({
        success: false,
        error: "Customer not found",
      });
    }

    // Check if customer has orders - prevent deletion if they do
    if (existingCustomer.orders.length > 0) {
      return res.status(400).json({
        success: false,
        error:
          "Cannot delete customer with existing orders. Please deactivate instead.",
      });
    }

    // Hard delete customer and all related data in transaction
    await prisma.$transaction(async (tx) => {
      // Delete related records in correct order (respecting foreign key constraints)

      // Delete promotion usage
      if (existingCustomer.promotionUsage.length > 0) {
        await tx.promotionUsage.deleteMany({
          where: { customerId: id },
        });
      }

      // Delete campaign events (set customerId to null)
      if (existingCustomer.campaignEvents.length > 0) {
        await tx.campaignEvent.updateMany({
          where: { customerId: id },
          data: { customerId: null },
        });
      }

      // Delete sales rep assignments
      if (existingCustomer.salesAssignments.length > 0) {
        await tx.salesRepCustomerAssignment.deleteMany({
          where: { customerId: id },
        });
      }

      // Delete favorites
      if (existingCustomer.favorites.length > 0) {
        await tx.favorite.deleteMany({
          where: { customerId: id },
        });
      }

      // Delete cart items and carts
      if (existingCustomer.carts.length > 0) {
        const cartIds = existingCustomer.carts.map((cart) => cart.id);
        await tx.cartItem.deleteMany({
          where: { cartId: { in: cartIds } },
        });
        await tx.cart.deleteMany({
          where: { customerId: id },
        });
      }

      // Delete reviews
      if (existingCustomer.reviews.length > 0) {
        await tx.productReview.deleteMany({
          where: { customerId: id },
        });
      }

      // Delete customer tags
      if (existingCustomer.customerTags.length > 0) {
        await tx.customerTag.deleteMany({
          where: { customerId: id },
        });
      }

      // Delete addresses
      if (existingCustomer.addresses.length > 0) {
        await tx.address.deleteMany({
          where: { customerId: id },
        });
      }

      // Delete linked user if exists
      if (existingCustomer.user) {
        // Delete user permissions first
        await tx.userPermission.deleteMany({
          where: { userId: existingCustomer.user.id },
        });

        // Delete audit logs
        await tx.auditLog.deleteMany({
          where: { userId: existingCustomer.user.id },
        });

        // Delete user
        await tx.user.delete({
          where: { id: existingCustomer.user.id },
        });
      }

      // Finally delete the customer
      await tx.customer.delete({
        where: { id },
      });
    });

    res.json({
      success: true,
      message: "Customer permanently deleted successfully",
    });
  })
);

// OLD BULK DELETE ENDPOINT REMOVED - NOW USING THE PROPER ONE AT LINE ~1562
// This old endpoint was only deactivating customers, not deleting them

// Bulk import customers
router.post(
  "/bulk-import",
  requirePermission("CUSTOMERS", "CREATE"),
  [
    body("customers")
      .isArray({ min: 1 })
      .withMessage("customers must be a non-empty array"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { customers } = req.body;
    let created = 0;
    await prisma.$transaction(async (tx) => {
      for (const c of customers) {
        if (!c.firstName || !c.lastName || !c.email) continue;
        await tx.customer.create({
          data: {
            firstName: c.firstName,
            lastName: c.lastName,
            email: c.email,
            phone: c.phone || "",
            type: c.type || "B2C",
            isActive: true,
          },
        });
        created++;
      }
    });
    res.json({ success: true, created });
  })
);

// Get customer addresses
router.get(
  "/:id/addresses",
  permitCustomerSelfOr("READ"),
  [
    param("id").isString().withMessage("Customer ID is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check if customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!existingCustomer) {
      return res.status(404).json({
        success: false,
        error: "Customer not found",
      });
    }

    // Get addresses
    const addresses = await prisma.address.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      data: addresses,
    });
  })
);

// Create address for customer
router.post(
  "/:id/addresses",
  permitCustomerSelfOr("CREATE"),
  [
    param("id").isString().withMessage("Customer ID is required"),
    body("type")
      .isIn(["BILLING", "SHIPPING"])
      .withMessage("Invalid address type"),
    body("firstName").notEmpty().trim().withMessage("First name is required"),
    body("lastName").notEmpty().trim().withMessage("Last name is required"),
    body("address1")
      .notEmpty()
      .trim()
      .withMessage("Address line 1 is required"),
    body("city").notEmpty().trim().withMessage("City is required"),
    body("state").notEmpty().trim().withMessage("State is required"),
    body("postalCode").notEmpty().trim().withMessage("Postal code is required"),
    body("country").notEmpty().trim().withMessage("Country is required"),
    body("isDefault")
      .optional()
      .isBoolean()
      .withMessage("isDefault must be boolean"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      type,
      firstName,
      lastName,
      company,
      address1,
      address2,
      city,
      state,
      postalCode,
      country,
      phone,
      isDefault = false,
    } = req.body;

    // Check if customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!existingCustomer) {
      return res.status(404).json({
        success: false,
        error: "Customer not found",
      });
    }

    // Create address in transaction
    const address = await prisma.$transaction(async (tx) => {
      // If this is set as default, unset other defaults
      if (isDefault) {
        await tx.address.updateMany({
          where: { customerId: id },
          data: { isDefault: false },
        });
      }

      return tx.address.create({
        data: {
          customerId: id,
          type,
          firstName,
          lastName,
          company,
          address1,
          address2,
          city,
          state,
          postalCode,
          country,
          phone,
          isDefault,
        },
      });
    });

    res.status(201).json({
      success: true,
      message: "Address created successfully",
      data: address,
    });
  })
);

// Update address
router.put(
  "/:customerId/addresses/:addressId",
  permitCustomerSelfOr("UPDATE"),
  [
    param("customerId").isString().withMessage("Customer ID is required"),
    param("addressId").isString().withMessage("Address ID is required"),
    body("type")
      .optional()
      .isIn(["BILLING", "SHIPPING"])
      .withMessage("Invalid address type"),
    body("firstName")
      .optional()
      .notEmpty()
      .trim()
      .withMessage("First name cannot be empty"),
    body("lastName")
      .optional()
      .notEmpty()
      .trim()
      .withMessage("Last name cannot be empty"),
    body("address1")
      .optional()
      .notEmpty()
      .trim()
      .withMessage("Address line 1 cannot be empty"),
    body("city")
      .optional()
      .notEmpty()
      .trim()
      .withMessage("City cannot be empty"),
    body("state")
      .optional()
      .notEmpty()
      .trim()
      .withMessage("State cannot be empty"),
    body("postalCode")
      .optional()
      .notEmpty()
      .trim()
      .withMessage("Postal code cannot be empty"),
    body("country")
      .optional()
      .notEmpty()
      .trim()
      .withMessage("Country cannot be empty"),
    body("isDefault")
      .optional()
      .isBoolean()
      .withMessage("isDefault must be boolean"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { customerId, addressId } = req.params;
    const {
      type,
      firstName,
      lastName,
      company,
      address1,
      address2,
      city,
      state,
      postalCode,
      country,
      phone,
      isDefault,
    } = req.body;

    // Check if address exists and belongs to customer
    const existingAddress = await prisma.address.findUnique({
      where: { id: addressId, customerId },
    });

    if (!existingAddress) {
      return res.status(404).json({
        success: false,
        error: "Address not found",
      });
    }

    // Update address in transaction
    const address = await prisma.$transaction(async (tx) => {
      // If this is set as default, unset other defaults
      if (isDefault) {
        await tx.address.updateMany({
          where: { customerId },
          data: { isDefault: false },
        });
      }

      // Update address
      const updateData = {};
      if (type) updateData.type = type;
      if (firstName) updateData.firstName = firstName;
      if (lastName) updateData.lastName = lastName;
      if (company !== undefined) updateData.company = company;
      if (address1) updateData.address1 = address1;
      if (address2 !== undefined) updateData.address2 = address2;
      if (city) updateData.city = city;
      if (state) updateData.state = state;
      if (postalCode) updateData.postalCode = postalCode;
      if (country) updateData.country = country;
      if (phone !== undefined) updateData.phone = phone;
      if (isDefault !== undefined) updateData.isDefault = isDefault;

      return tx.address.update({
        where: { id: addressId },
        data: updateData,
      });
    });

    res.json({
      success: true,
      message: "Address updated successfully",
      data: address,
    });
  })
);

// Delete address
router.delete(
  "/:customerId/addresses/:addressId",
  permitCustomerSelfOr("DELETE"),
  [
    param("customerId").isString().withMessage("Customer ID is required"),
    param("addressId").isString().withMessage("Address ID is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { customerId, addressId } = req.params;

    // Check if address exists and belongs to customer
    const existingAddress = await prisma.address.findUnique({
      where: { id: addressId, customerId },
    });

    if (!existingAddress) {
      return res.status(404).json({
        success: false,
        error: "Address not found",
      });
    }

    // Delete address
    await prisma.address.delete({
      where: { id: addressId },
    });

    res.json({
      success: true,
      message: "Address deleted successfully",
    });
  })
);

// =============================
// Favorites (Customer self only)
// =============================

// List favorites for a customer
router.get(
  "/:id/favorites",
  permitCustomerSelfOr("READ"),
  [
    param("id").isString().withMessage("Customer ID is required"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Ensure customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id },
    });
    if (!existingCustomer) {
      return res
        .status(404)
        .json({ success: false, error: "Customer not found" });
    }

    const [favorites, total] = await Promise.all([
      prisma.favorite.findMany({
        where: { customerId: id },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
        include: {
          product: {
            include: {
              images: {
                select: { url: true, altText: true, sortOrder: true },
                take: 1,
                orderBy: { sortOrder: "asc" },
              },
              variants: {
                select: {
                  id: true,
                  name: true,
                  regularPrice: true,
                  salePrice: true,
                },
              },
            },
          },
        },
      }),
      prisma.favorite.count({ where: { customerId: id } }),
    ]);

    res.json({
      success: true,
      data: {
        favorites,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  })
);

// Add a favorite (product-level)
router.post(
  "/:id/favorites",
  permitCustomerSelfOr("CREATE"),
  [
    param("id").isString().withMessage("Customer ID is required"),
    body("productId").isString().withMessage("productId is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { productId } = req.body;

    // Ensure customer and product exist
    const [customer, product] = await Promise.all([
      prisma.customer.findUnique({ where: { id } }),
      prisma.product.findUnique({ where: { id: productId } }),
    ]);
    if (!customer)
      return res
        .status(404)
        .json({ success: false, error: "Customer not found" });
    if (!product)
      return res
        .status(404)
        .json({ success: false, error: "Product not found" });

    // Create favorite (unique compound will prevent duplicates)
    try {
      const favorite = await prisma.favorite.create({
        data: { customerId: id, productId },
        include: {
          product: {
            include: {
              images: {
                select: { url: true, altText: true, sortOrder: true },
                take: 1,
                orderBy: { sortOrder: "asc" },
              },
              variants: {
                select: {
                  id: true,
                  name: true,
                  regularPrice: true,
                  salePrice: true,
                },
              },
            },
          },
        },
      });

      return res
        .status(201)
        .json({ success: true, message: "Added to favorites", data: favorite });
    } catch (e) {
      // Handle duplicate
      return res
        .status(409)
        .json({ success: false, error: "Already in favorites" });
    }
  })
);

// Remove a favorite by favoriteId
router.delete(
  "/:customerId/favorites/:favoriteId",
  permitCustomerSelfOr("DELETE"),
  [
    param("customerId").isString().withMessage("Customer ID is required"),
    param("favoriteId").isString().withMessage("Favorite ID is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { customerId, favoriteId } = req.params;

    const favorite = await prisma.favorite.findUnique({
      where: { id: favoriteId },
    });
    if (!favorite || favorite.customerId !== customerId) {
      return res
        .status(404)
        .json({ success: false, error: "Favorite not found" });
    }

    await prisma.favorite.delete({ where: { id: favoriteId } });
    res.json({ success: true, message: "Removed from favorites" });
  })
);

// Optional: remove by productId (convenience)
router.delete(
  "/:customerId/favorites",
  permitCustomerSelfOr("DELETE"),
  [
    param("customerId").isString().withMessage("Customer ID is required"),
    query("productId").isString().withMessage("productId is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { customerId } = req.params;
    const { productId } = req.query;
    const result = await prisma.favorite.deleteMany({
      where: { customerId, productId: String(productId) },
    });
    if (result.count === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Favorite not found" });
    }
    res.json({ success: true, message: "Removed from favorites" });
  })
);

// Get customer orders statistics
router.get(
  "/:id/orders-stats",
  permitCustomerSelfOr("READ"),
  [param("id").isString().withMessage("Customer ID is required"), validateRequest],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const [all, active, delivered, cancelled] = await Promise.all([
      prisma.order.count({ where: { customerId: id } }),
      prisma.order.count({
        where: {
          customerId: id,
          status: { in: ["PENDING", "PROCESSING", "SHIPPED"] }
        }
      }),
      prisma.order.count({ where: { customerId: id, status: "DELIVERED" } }),
      prisma.order.count({ where: { customerId: id, status: "CANCELLED" } }),
    ]);

    res.json({
      success: true,
      data: { ALL: all, ACTIVE: active, DELIVERED: delivered, CANCELLED: cancelled },
    });
  })
);

// Get customer orders
router.get(
  "/:id/orders",
  permitCustomerSelfOr("READ"),
  [
    param("id").isString().withMessage("Customer ID is required"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { page = 1, limit = 10, search, status, from, to } = req.query;

    // Check if customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!existingCustomer) {
      return res.status(404).json({
        success: false,
        error: "Customer not found",
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const where = { customerId: id };

    if (search) {
      where.orderNumber = { contains: search, mode: "insensitive" };
    }

    if (status && status !== "ALL") {
      if (status === "ACTIVE") {
        where.status = { in: ["PENDING", "PROCESSING", "SHIPPED"] };
      } else {
        where.status = status;
      }
    }

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to + "T23:59:59.999Z");
    }

    // Get orders and total count
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { items: true }
          },
          items: {
            include: {
              variant: {
                include: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                      images: {
                        select: {
                          url: true,
                          altText: true,
                        },
                        take: 1,
                        orderBy: { sortOrder: "asc" },
                      },
                    },
                  },
                },
              },
            },
          },
          payments: {
            select: {
              id: true,
              amount: true,
              status: true,
              paymentMethod: true,
              paidAt: true,
            }
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  })
);

// Bulk delete customers
router.post(
  "/bulk-delete",
  requireRole(["ADMIN", "MANAGER"]),
  [
    body("ids").isArray().withMessage("Customer IDs must be an array"),
    body("ids.*").isString().withMessage("Each customer ID must be a string"),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { ids } = req.body;
    console.log("Bulk delete request received for IDs:", ids);

    if (!ids || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No customers selected for deletion",
      });
    }

    try {
      // Check if any of the customers have orders
      const customersWithOrders = await prisma.customer.findMany({
        where: {
          id: { in: ids },
          orders: {
            some: {},
          },
        },
        select: {
          email: true,
        },
      });

      if (customersWithOrders.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Cannot delete customers with orders: ${customersWithOrders
            .map((c) => c.email)
            .join(", ")}`,
        });
      }

      // Use transaction to ensure data consistency
      await prisma.$transaction(async (tx) => {
        // 1. Delete PromotionUsage (no cascade)
        await tx.promotionUsage.deleteMany({
          where: { customerId: { in: ids } },
        });

        // 2. Detach CampaignEvents (no cascade)
        await tx.campaignEvent.updateMany({
          where: { customerId: { in: ids } },
          data: { customerId: null },
        });

        // 3. Handle linked Users
        const linkedUsers = await tx.user.findMany({
          where: { customerId: { in: ids } },
          select: { id: true },
        });

        const linkedUserIds = linkedUsers.map((u) => u.id);

        if (linkedUserIds.length > 0) {
          // 3a. Delete AuditLogs for these users (no cascade)
          await tx.auditLog.deleteMany({
            where: { userId: { in: linkedUserIds } },
          });

          // 3b. Delete Users (cascades to EmailVerificationToken, UserPermission, SalesRep/Manager profiles)
          // Note: This might fail if User authored PageContent or uploaded MediaFile.
          // In that case, we can't easily delete the user without reassigning content.
          await tx.user.deleteMany({
            where: { id: { in: linkedUserIds } },
          });
        }

        // 4. Delete Customers
        // Cascades to: Address, Cart, Favorite, ProductReview, CustomerTag, Notification,
        // BulkQuote, MobileVerificationCode, SalesRepCustomerAssignment
        await tx.customer.deleteMany({
          where: { id: { in: ids } },
        });
      });

      res.json({
        success: true,
        message: `Successfully deleted ${ids.length} customer(s)`,
        deletedCount: ids.length,
      });
    } catch (error) {
      console.error("Bulk delete customers error:", error);
      // Check for foreign key constraint errors
      if (error.code === "P2003") {
        return res.status(400).json({
          success: false,
          error:
            "Cannot delete customer(s) because they are referenced by other records (e.g., content authorship).",
        });
      }
      res.status(500).json({
        success: false,
        error: "Failed to delete customers",
        details: error.message,
      });
    }
  })
);

// Assign/Reassign Sales Rep to a customer
router.put('/:id/sales-rep',
  requireRole(['ADMIN', 'SALES_MANAGER']),
  [
    param('id').isString(),
    body('salesRepId').isString().withMessage('Sales Rep ID is required'),
    validateRequest
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { salesRepId } = req.body;

    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });

    const salesRep = await prisma.salesRepresentative.findUnique({ where: { id: salesRepId } });
    if (!salesRep) return res.status(404).json({ success: false, error: 'Sales Rep not found' });

    // Security check for SALES_MANAGER
    if (req.user.role === 'SALES_MANAGER') {
      const manager = await prisma.salesManager.findUnique({
        where: { userId: req.user.id }
      });

      if (!manager) {
        return res.status(404).json({ success: false, error: 'Sales manager profile not found' });
      }

      // Check if the sales rep belongs to this manager
      if (salesRep.salesManagerId !== manager.id) {
        return res.status(403).json({ success: false, error: 'You can only assign your own sales representatives' });
      }

      // Check if the customer is assigned to this manager
      const managerAssignment = await prisma.salesManagerCustomerAssignment.findUnique({
        where: {
          salesManagerId_customerId: {
            salesManagerId: manager.id,
            customerId: id
          }
        }
      });

      if (!managerAssignment) {
        return res.status(403).json({ success: false, error: 'You can only assign reps to customers in your portfolio' });
      }
    }

    // Transaction to remove old and add new
    await prisma.$transaction(async (tx) => {
      await tx.salesRepCustomerAssignment.deleteMany({ where: { customerId: id } });
      await tx.salesRepCustomerAssignment.create({
        data: {
          salesRepId,
          customerId: id
        }
      });
    });

    res.json({ success: true, message: 'Sales representative assigned successfully' });
  })
);

// Assign/Reassign Sales Manager to a customer
router.put('/:id/sales-manager',
  requireRole(['ADMIN']),
  [
    param('id').isString(),
    body('salesManagerId').isString().withMessage('Sales Manager ID is required'),
    validateRequest
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { salesManagerId } = req.body;

    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });

    const salesManager = await prisma.salesManager.findUnique({ where: { id: salesManagerId } });
    if (!salesManager) return res.status(404).json({ success: false, error: 'Sales Manager not found' });

    // Transaction to remove old assignment (if any) and add new
    await prisma.$transaction(async (tx) => {
      await tx.salesManagerCustomerAssignment.deleteMany({ where: { customerId: id } });
      await tx.salesManagerCustomerAssignment.create({
        data: {
          salesManagerId,
          customerId: id
        }
      });
    });

    res.json({ success: true, message: 'Sales manager assigned successfully' });
  })
);

module.exports = router;

// -------------------------------
// Admin: Purge ALL customer data
// -------------------------------
// Highly destructive: deletes all customers and related records.
// Must be ADMIN and provide explicit confirmation.
router.delete(
  "/purge-all",
  requireRole(["ADMIN"]),
  asyncHandler(async (req, res) => {
    const { confirm } = req.query;
    if (String(confirm).toLowerCase() !== "yes") {
      return res.status(400).json({
        success: false,
        error: "Confirmation missing. Append ?confirm=yes to proceed.",
      });
    }

    // Collect all customer and linked user/order ids up front
    const [customers, users, orders] = await Promise.all([
      prisma.customer.findMany({ select: { id: true } }),
      prisma.user.findMany({
        where: { customerId: { not: null } },
        select: { id: true, customerId: true },
      }),
      prisma.order.findMany({ select: { id: true, customerId: true } }),
    ]);

    const customerIds = customers.map((c) => c.id);
    const userIds = users.map((u) => u.id);
    const orderIds = orders.map((o) => o.id);

    await prisma.$transaction(async (tx) => {
      // Refunds must be removed before payments (restrict by default)
      if (orderIds.length > 0) {
        await tx.refund.deleteMany({
          where: { payment: { orderId: { in: orderIds } } },
        });
      }

      // Promotion usage references both order and customer (restrict by default)
      if (orderIds.length > 0 || customerIds.length > 0) {
        await tx.promotionUsage.deleteMany({
          where: {
            OR: [
              orderIds.length ? { orderId: { in: orderIds } } : undefined,
              customerIds.length
                ? { customerId: { in: customerIds } }
                : undefined,
            ].filter(Boolean),
          },
        });
      }

      // Transactions linked to orders (cascade on order, but delete explicitly for clarity)
      if (orderIds.length > 0) {
        await tx.transaction.deleteMany({
          where: { orderId: { in: orderIds } },
        });
      }

      // Payments (cascade on order, but refunds already removed)
      if (orderIds.length > 0) {
        await tx.payment.deleteMany({ where: { orderId: { in: orderIds } } });
      }

      // Shipments (cascade on order, but safe to clear)
      if (orderIds.length > 0) {
        await tx.shipment.deleteMany({ where: { orderId: { in: orderIds } } });
      }

      // Order notes and audit logs on orders (notes cascade, audit logs linked to user)
      if (orderIds.length > 0) {
        await tx.orderNote.deleteMany({ where: { orderId: { in: orderIds } } });
        await tx.auditLog.deleteMany({ where: { orderId: { in: orderIds } } });
      }

      // Order items (cascade on order, but safe to clear)
      if (orderIds.length > 0) {
        await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      }

      // Product reviews by customers (restrict by default)
      if (customerIds.length > 0) {
        await tx.productReview.deleteMany({
          where: { customerId: { in: customerIds } },
        });
      }

      // Favorites (cascade on customer, but safe to clear)
      if (customerIds.length > 0) {
        await tx.favorite.deleteMany({
          where: { customerId: { in: customerIds } },
        });
      }

      // Sales rep assignments (cascade on customer, but safe to clear)
      if (customerIds.length > 0) {
        await tx.salesRepCustomerAssignment.deleteMany({
          where: { customerId: { in: customerIds } },
        });
      }

      // Carts and items (cascade on customer)
      if (customerIds.length > 0) {
        await tx.cart.deleteMany({
          where: { customerId: { in: customerIds } },
        });
      }

      // Addresses (cascade on customer) – explicit for clarity
      if (customerIds.length > 0) {
        await tx.address.deleteMany({
          where: { customerId: { in: customerIds } },
        });
      }

      // Campaign events: detach customer reference (nullable)
      if (customerIds.length > 0) {
        await tx.campaignEvent.updateMany({
          where: { customerId: { in: customerIds } },
          data: { customerId: null },
        });
      }

      // Delete orders after dependents are cleared
      if (orderIds.length > 0) {
        await tx.order.deleteMany({ where: { id: { in: orderIds } } });
      }

      // Audit logs linked to users need removal before deleting users (restrict by default)
      if (userIds.length > 0) {
        await tx.auditLog.deleteMany({ where: { userId: { in: userIds } } });
      }

      // Delete users tied to customers
      if (userIds.length > 0) {
        await tx.user.deleteMany({ where: { id: { in: userIds } } });
      }

      // Finally, delete customers
      if (customerIds.length > 0) {
        await tx.customer.deleteMany({ where: { id: { in: customerIds } } });
      }
    });

    res.json({
      success: true,
      message: "All customer data purged successfully",
      deletedCustomers: customerIds.length,
    });
  })
);

/**
 * POST /api/customers/email-report
 * Queue a background job to generate and email a customers report
 */
router.post(
  "/email-report",
  requirePermission("CUSTOMERS", "READ"),
  [
    body("email").isEmail().withMessage("Valid email required"),
    body("customerType").optional().isString(),
    body("isActive").optional().isBoolean(),
    body("isApproved").optional().isBoolean(),
    body("approvalStatus").optional().isString(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { email, customerType, isActive, isApproved, approvalStatus } = req.body;

    const result = await queueReport({
      type: "CUSTOMERS",
      email,
      filters: {
        customerType,
        isActive,
        isApproved,
        approvalStatus
      },
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
      }
    });

    res.json(result);
  })
);

module.exports = router;
