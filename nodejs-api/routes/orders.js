const express = require("express");
const logger = require("../utils/logger");
const { body, param, query } = require("express-validator");
const prisma = require("../prisma/client");
const { v4: uuidv4 } = require("uuid");
const { Country, State } = require("country-state-city");
const validateRequest = require("../middleware/validateRequest");
const { asyncHandler } = require("../middleware/errorHandler");
const { requireRole, requirePermission } = require("../middleware/auth");
const { authMiddleware } = require("../middleware/auth");
const { calculatePromotionDiscount } = require("../utils/promotionCalculator");
const { getPricingCustomerType } = require("../utils/pricingMapper");
const {
  sendOrderConfirmation,
  sendOrderCancellation,
  sendNewOrderToShippingManager,
  sendNewOrderToSalesRep,
} = require("../utils/emailService");
const {
  findOptimalWarehouse,
  reserveInventoryFromWarehouse,
  calculateShippingFromWarehouse,
} = require("../services/warehouseService");
const { createShipmentForOrder } = require("../services/shipmentService");
const { calculatePriceWithBulk } = require("./bulkPrices");
const { queueProductSync } = require("../integrations/skydell_odoo");
const { getPSTFinancialRange } = require("../utils/timezoneUtils");
const { generateOrdersExcel } = require("../services/reportService");
const { processRawEmailResend } = require("../utils/emailService");
const { notifySalesChannelWebhooks } = require("../utils/webhookService");

const router = express.Router();

// Convert country and state names to ISO codes for tax rate lookup
const getCountryStateIsoCodes = (countryName, stateName) => {
  // Find country by name
  const country = Country.getAllCountries().find(
    (c) => c.name.toLowerCase() === countryName.toLowerCase(),
  );

  if (!country) {
    return { countryCode: null, stateCode: null };
  }

  let stateCode = null;
  if (stateName) {
    // Find state by name within the country
    const state = State.getStatesOfCountry(country.isoCode).find(
      (s) => s.name.toLowerCase() === stateName.toLowerCase(),
    );
    stateCode = state?.isoCode || null;
  }

  return { countryCode: country.isoCode, stateCode };
};

// Generate unique order number
const generateOrderNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomStr = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `ORD-${timestamp}-${randomStr}`;
};

/**
 * Build denormalized address snapshot fields for an order.
 * @param {object} address - Address object (from DB or inline)
 * @param {'billing'|'shipping'} prefix - Column prefix
 * @returns {object} Flat object with prefixed keys, e.g. { billingFirstName, … }
 */
const buildAddressSnapshot = (address, prefix) => {
  if (!address) return {};
  return {
    [`${prefix}FirstName`]: address.firstName || null,
    [`${prefix}LastName`]: address.lastName || null,
    [`${prefix}Company`]: address.company || null,
    [`${prefix}Address1`]: address.address1 || null,
    [`${prefix}Address2`]: address.address2 || null,
    [`${prefix}City`]: address.city || null,
    [`${prefix}State`]: address.state || null,
    [`${prefix}PostalCode`]: address.postalCode || null,
    [`${prefix}Country`]: address.country || null,
    [`${prefix}Phone`]: address.phone || null,
  };
};

/**
 * Reconstruct an Address-shaped object from denormalized order fields.
 * Falls back to the related address FK if denormalized fields are missing.
 */
const reconstructAddress = (order, prefix, relationField) => {
  // Prefer denormalized snapshot
  if (order[`${prefix}FirstName`]) {
    return {
      id: order[`${prefix}AddressId`] || null,
      firstName: order[`${prefix}FirstName`],
      lastName: order[`${prefix}LastName`] || "",
      company: order[`${prefix}Company`] || null,
      address1: order[`${prefix}Address1`] || "",
      address2: order[`${prefix}Address2`] || null,
      city: order[`${prefix}City`] || "",
      state: order[`${prefix}State`] || "",
      postalCode: order[`${prefix}PostalCode`] || "",
      country: order[`${prefix}Country`] || "US",
      phone: order[`${prefix}Phone`] || null,
    };
  }
  // Fallback: use the joined relation (for orders not yet backfilled)
  return order[relationField] || null;
};

// Calculate order totals
const calculateOrderTotals = (items) => {
  const subtotal = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  return {
    subtotal,
    // These can be calculated based on business logic
    discountAmount: 0,
    shippingAmount: 0,
    taxAmount: subtotal * 0.08, // 8% tax example
    totalAmount: subtotal + subtotal * 0.08,
  };
};

// Get all orders with pagination and filters
router.get(
  "/",
  requirePermission("ORDERS", "READ"),
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage("Limit must be between 1 and 1000"),
    query("status")
      .optional()
      .isIn([
        "PENDING",
        "PROCESSING",
        "LABEL_CREATED",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
        "REFUNDED",
        "ON_HOLD",
      ])
      .withMessage("Invalid status"),
    query("customerId")
      .optional()
      .isString()
      .withMessage("Customer ID must be a string"),
    query("salesRepId")
      .optional()
      .isString()
      .withMessage("Sales Rep ID must be a string"),
    query("search")
      .optional()
      .isString()
      .withMessage("Search must be a string"),
    query("dateFrom")
      .optional()
      .isISO8601()
      .withMessage("Date from must be valid ISO8601 date"),
    query("dateTo")
      .optional()
      .isISO8601()
      .withMessage("Date to must be valid ISO8601 date"),
    query("customerType")
      .optional()
      .isIn([
        "B2C",
        "B2B",
        "ENTERPRISE",
        "ENTERPRISE_1",
        "ENTERPRISE_2",
        "wholesale",
        "enterprise",
      ])
      .withMessage(
        "Customer type must be B2C, B2B, ENTERPRISE_1, ENTERPRISE_2, ENTERPRISE, wholesale, or enterprise",
      ),
    query("paymentMethod")
      .optional()
      .isIn(["ZELLE", "BANK_WIRE", "AUTHORIZE_NET"])
      .withMessage("Payment method must be ZELLE, BANK_WIRE, or AUTHORIZE_NET"),
    query("failedPayments")
      .optional()
      .isString()
      .withMessage("failedPayments must be a string"),
    query("excludeFailedPayments")
      .optional()
      .isString()
      .withMessage("excludeFailedPayments must be a string"),
    query("salesChannelId")
      .optional()
      .isString()
      .withMessage("Sales Channel ID must be a string"),
    query("usePSTFilter")
      .optional()
      .isString()
      .withMessage("usePSTFilter must be a string"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    let {
      page = 1,
      limit = 10,
      status,
      customerId,
      salesRepId,
      customerType,
      search,
      dateFrom,
      dateTo,
      usePSTFilter,
      paymentMethod,
      failedPayments,
      excludeFailedPayments,
      salesChannelId,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Map consolidated customer types to actual database values
    if (customerType === "wholesale") {
      customerType = ["B2C", "B2B"];
    } else if (customerType === "enterprise") {
      customerType = ["ENTERPRISE_1", "ENTERPRISE_2"];
    }

    // Build where clause
    const where = {};
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (customerType) {
      if (Array.isArray(customerType)) {
        where.customer = {
          customerType: { in: customerType },
        };
      } else {
        where.customer = {
          customerType: customerType,
        };
      }
    }
    if (paymentMethod) {
      // Filter by selectedPaymentType OR by payment records
      // This handles cases where orders might only have payment records
      if (paymentMethod === "AUTHORIZE_NET") {
        where.OR = [
          ...(where.OR || []),
          { selectedPaymentType: paymentMethod },
          {
            payments: {
              some: {
                OR: [
                  { provider: { contains: "authorize", mode: "insensitive" } },
                  { paymentMethod: "CREDIT_CARD" },
                ],
              },
            },
          },
        ];
      } else if (paymentMethod === "ZELLE") {
        where.OR = [
          ...(where.OR || []),
          { selectedPaymentType: paymentMethod },
          {
            payments: {
              some: {
                provider: { contains: "zelle", mode: "insensitive" },
              },
            },
          },
        ];
      } else if (paymentMethod === "BANK_WIRE") {
        where.OR = [
          ...(where.OR || []),
          { selectedPaymentType: paymentMethod },
          {
            AND: [
              // For legacy or manually recorded payments, ensure we don't return ZELLE orders in BANK_WIRE filter
              { selectedPaymentType: { not: "ZELLE" } },
              {
                payments: {
                  some: {
                    OR: [
                      { provider: { contains: "bank", mode: "insensitive" } },
                      { provider: { contains: "wire", mode: "insensitive" } },
                      { paymentMethod: "BANK_TRANSFER" },
                    ],
                  },
                },
              },
            ],
          },
        ];
      } else {
        // Fallback for simple equality check
        where.selectedPaymentType = paymentMethod;
      }
    }
    if (search) {
      const searchTerms = search.split(/\s+/).filter(Boolean);
      if (searchTerms.length > 0) {
        const searchConditions = searchTerms.map((term) => ({
          OR: [
            { orderNumber: { contains: term, mode: "insensitive" } },
            { customer: { email: { contains: term, mode: "insensitive" } } },
            {
              customer: { firstName: { contains: term, mode: "insensitive" } },
            },
            { customer: { lastName: { contains: term, mode: "insensitive" } } },
          ],
        }));

        if (where.OR) {
          // If OR already exists from payment filter, combine with AND
          const existingOr = where.OR;
          delete where.OR;
          where.AND = [
            ...(where.AND || []),
            { OR: existingOr },
            ...searchConditions,
          ];
        } else {
          where.AND = [...(where.AND || []), ...searchConditions];
        }
      }
    }
    if (dateFrom || dateTo) {
      const { start, end } = getPSTFinancialRange(dateFrom, dateTo);
      where.createdAt = {
        gte: start,
        lte: end,
      };
    }
    if (salesChannelId) {
      if (salesChannelId === "research") {
        where.salesChannelId = null;
      } else if (salesChannelId === "channels") {
        where.salesChannelId = { not: null };
      } else if (salesChannelId !== "all") {
        where.salesChannelId = salesChannelId;
      }
    }

    const failedPaymentsOnly =
      String(failedPayments || "").toLowerCase() === "true";
    const excludeFailed =
      String(excludeFailedPayments || "").toLowerCase() === "true";
    const failedPaymentsCond = {
      payments: {
        some: {
          status: "FAILED",
        },
      },
    };

    if (failedPaymentsOnly) {
      where.AND = [...(where.AND || []), failedPaymentsCond];
    }

    if (excludeFailed) {
      where.AND = [...(where.AND || []), { NOT: failedPaymentsCond }];
    }

    // SALES_REP: restrict to assigned customers only
    if (req.user && req.user.role === "SALES_REP") {
      where.customer = {
        AND: [
          where.customer || {},
          { salesAssignments: { some: { salesRep: { userId: req.user.id } } } },
        ],
      };
    }

    // SALES_MANAGER: restrict to assigned customers only (direct + team reps' customers)
    if (req.user && req.user.role === "SALES_MANAGER") {
      where.customer = {
        AND: [
          where.customer || {},
          {
            OR: [
              {
                salesManagerAssignments: {
                  some: { salesManager: { userId: req.user.id } },
                },
              },
              {
                salesAssignments: {
                  some: {
                    salesRep: {
                      salesManager: { userId: req.user.id },
                    },
                  },
                },
              },
            ],
          },
        ],
      };
    }

    // Admin/Manager filter: restrict to customers assigned to a specific sales rep
    if (salesRepId) {
      where.customer = {
        AND: [
          where.customer || {},
          { salesAssignments: { some: { salesRepId: String(salesRepId) } } },
        ],
      };
    }

    // Get orders and total count
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { [sortBy]: sortOrder },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              customerType: true,
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
                orderBy: { assignedAt: "desc" },
                take: 1,
              },
            },
          },
          billingAddressRef: true,
          shippingAddressRef: true,
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
              paymentMethod: true,
              provider: true,
              status: true,
              amount: true,
              paidAt: true,
            },
          },
          salesChannel: {
            select: {
              id: true,
              companyName: true,
              type: true,
              contactPerson: true,
              contactNumber: true,
              contactEmail: true,
              addressLine1: true,
              addressLine2: true,
              city: true,
              state: true,
              postalCode: true,
              country: true,
            },
          },
          shipments: {
            select: {
              id: true,
              carrier: true,
              trackingNumber: true,
              status: true,
              shippedAt: true,
            },
          },
          _count: {
            select: {
              items: true,
              notes: true,
            },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    // Reconstruct denormalized address snapshots for backward-compatible response
    for (const o of orders) {
      o.billingAddress = reconstructAddress(o, "billing", "billingAddressRef");
      o.shippingAddress = reconstructAddress(
        o,
        "shipping",
        "shippingAddressRef",
      );
      delete o.billingAddressRef;
      delete o.shippingAddressRef;
    }

    // Compute unpaginated status counts under same filters (search/date/customer filters), ignoring status filter itself
    const baseWhere = { ...where };
    if (baseWhere.status) delete baseWhere.status;

    const [
      pendingCount,
      processingCount,
      labelCreatedCount,
      shippedCount,
      deliveredCount,
      cancelledCount,
      refundedCount,
      onHoldCount,
    ] = await Promise.all([
      prisma.order.count({ where: { ...baseWhere, status: "PENDING" } }),
      prisma.order.count({ where: { ...baseWhere, status: "PROCESSING" } }),
      prisma.order.count({ where: { ...baseWhere, status: "LABEL_CREATED" } }),
      prisma.order.count({ where: { ...baseWhere, status: "SHIPPED" } }),
      prisma.order.count({ where: { ...baseWhere, status: "DELIVERED" } }),
      prisma.order.count({ where: { ...baseWhere, status: "CANCELLED" } }),
      prisma.order.count({ where: { ...baseWhere, status: "REFUNDED" } }),
      prisma.order.count({ where: { ...baseWhere, status: "ON_HOLD" } }),
    ]);

    // Compute revenue respecting status filter; when no explicit status, exclude CANCELLED/REFUNDED.
    // Always exclude failed-payment orders from revenue.
    const revenueWhereBase = where.status
      ? { ...where }
      : { ...baseWhere, status: { notIn: ["CANCELLED", "REFUNDED"] } };
    const revenueWhere = {
      ...revenueWhereBase,
      AND: [...(revenueWhereBase.AND || []), { NOT: failedPaymentsCond }],
    };
    const revenueAgg = await prisma.order.aggregate({
      where: revenueWhere,
      _sum: { totalAmount: true },
    });
    const revenueTotal = Number(revenueAgg._sum.totalAmount || 0);

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
        stats: {
          pending: pendingCount,
          processing: processingCount,
          labelCreated: labelCreatedCount,
          shipped: shippedCount,
          delivered: deliveredCount,
          cancelled: cancelledCount,
          refunded: refundedCount,
          onHold: onHoldCount,
          revenue: revenueTotal,
        },
      },
    });
  }),
);

// Get order by ID
router.get(
  "/:id",
  requirePermission("ORDERS", "READ"),
  [param("id").isString().withMessage("Order ID is required"), validateRequest],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            mobile: true,
            customerType: true,
          },
        },
        billingAddressRef: true,
        shippingAddressRef: true,
        items: {
          include: {
            variant: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    description: true,
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
          include: {
            refunds: true,
          },
        },
        salesChannel: true,
        transactions: true,
        shipments: true,
        notes: {
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
          orderBy: { createdAt: "desc" },
        },
        shippingStatuses: {
          orderBy: { updatedAt: "desc" },
        },
        auditLogs: {
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
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    // Reconstruct address objects from denormalized snapshot
    order.billingAddress = reconstructAddress(
      order,
      "billing",
      "billingAddressRef",
    );
    order.shippingAddress = reconstructAddress(
      order,
      "shipping",
      "shippingAddressRef",
    );
    delete order.billingAddressRef;
    delete order.shippingAddressRef;

    res.json({
      success: true,
      data: order,
    });
  }),
);

router.get(
  "/:id/invoice",
  authMiddleware,
  [param("id").isString().withMessage("Order ID is required"), validateRequest],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        billingAddressRef: true,
        shippingAddressRef: true,
        items: {
          include: {
            variant: {
              include: {
                product: true,
              },
            },
          },
        },
        payments: true,
        shipments: true,
      },
    });
    if (!order) {
      return res.status(404).send("Order not found");
    }

    // Check permissions: ADMIN/STAFF/SALES_REP (with permission) OR the customer themselves
    const user = req.user;
    const isStaffOrAdmin = ["ADMIN", "STAFF", "SALES_REP", "SALES_MANAGER"].includes(user.role);
    const isOrderOwner = user.role === "CUSTOMER" && order.customerId === user.customerId;

    if (!isStaffOrAdmin && !isOrderOwner) {
      return res.status(403).send("Access denied. You do not have permission to view this invoice.");
    }

    // Reconstruct address objects from denormalized fields
    order.billingAddress = reconstructAddress(
      order,
      "billing",
      "billingAddressRef",
    );
    order.shippingAddress = reconstructAddress(
      order,
      "shipping",
      "shippingAddressRef",
    );
    delete order.billingAddressRef;
    delete order.shippingAddressRef;

    const salesRepAssignment = order.customer
      ? await prisma.salesRepCustomerAssignment.findFirst({
        where: { customerId: order.customer.id },
        include: {
          salesRep: {
            include: {
              user: true,
            },
          },
        },
        orderBy: { assignedAt: "desc" },
      })
      : null;

    const salesRepUser = salesRepAssignment?.salesRep?.user;
    const salesRepDetails =
      salesRepUser && salesRepUser.email
        ? {
          name:
            [salesRepUser.firstName, salesRepUser.lastName]
              .filter(Boolean)
              .join(" ")
              .trim() || "Assigned Sales Rep",
          email: salesRepUser.email,
        }
        : null;

    const subtotal = Number(order.subtotal || 0);
    const discountAmount = Number(order.discountAmount || 0);
    const shippingAmount = Number(order.shippingAmount || 0);
    const taxAmount = Number(order.taxAmount || 0);
    const totalAmount = Number(order.totalAmount || 0);
    const baseAmount = subtotal - discountAmount + shippingAmount + taxAmount;
    const hasAuthorizePayment = Array.isArray(order.payments)
      ? order.payments.some(
        (payment) =>
          (typeof payment.provider === "string" &&
            payment.provider.toLowerCase() === "authorize.net") ||
          payment.paymentGatewayName === "AUTHORIZE_NET",
      )
      : false;
    const rawCardFee = totalAmount - baseAmount;
    const cardFee = hasAuthorizePayment && rawCardFee > 0.01 ? rawCardFee : 0;

    // Fetch store information
    const storeInfo = await prisma.storeInformation.findFirst();

    // Render HTML invoice
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset='utf-8'>
        <title>Invoice - ${order.orderNumber}</title>
        <style>
          @page {
            size: 4in 6in;
            margin: 0;
          }
          * { box-sizing: border-box; }
          html { width: 100%; margin: 0; padding: 0; }
          body { 
            font-family: Arial, sans-serif; 
            width: 100%;
            margin: 0; 
            padding: 1mm;
            color: #000000;
            line-height: 1.2;
            background: #ffffff;
            font-size: 8pt;
            font-weight: 500;
          }
          .header { 
            margin-bottom: 8px; 
            border-bottom: 1px solid #2c3e50;
            padding-bottom: 6px;
            page-break-inside: avoid;
          }
          .header-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .store-info h1 {
            font-size: 14pt;
            margin: 0 0 2px 0;
            color: #000000;
          }
          .store-details {
            font-size: 7pt;
            color: #555;
            line-height: 1.3;
          }
          .invoice-box {
            text-align: right;
          }
          .invoice-box h2 {
            font-size: 12pt;
            margin: 0;
            color: #000000;
          }
          .invoice-box .order-num {
            font-size: 8pt;
            margin-top: 2px;
          }
          .addresses { 
            display: flex; 
            gap: 10px; 
            margin: 8px 0;
            page-break-inside: avoid;
          }
          .address { 
            flex: 1;
            font-size: 7pt;
            line-height: 1.5;
            padding-bottom: 4px;
          }
          .address h3 {
            margin: 0 0 5px 0;
            font-size: 8pt;
            font-weight: bold;
            border-bottom: 1px solid #ddd;
            padding-bottom: 4px;
          }
          .sales-rep-info {
            margin-top: 4px;
            padding: 3px 5px;
            background: #f5f5f5;
            border-left: 2px solid #2c3e50;
            font-size: 6pt;
          }
          .customer-info {
            font-size: 7pt;
            margin-bottom: 8px;
            padding: 5px 0;
            border-bottom: 1px dashed #ccc;
            line-height: 1.5;
          }
          .items-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 6px;
            font-size: 7pt;
            table-layout: fixed;
          }
          .items-table tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .items-table th, .items-table td { 
            border: 1px solid #2c3e50; 
            padding: 5px 4px; 
            text-align: left;
            word-wrap: break-word;
            overflow-wrap: break-word;
            word-break: break-word;
            vertical-align: top;
            line-height: 1.4;
          }
          .items-table th { 
            background: #2c3e50; 
            color: #fff;
            font-size: 6pt;
            text-transform: uppercase;
            padding: 6px 4px;
          }
          /* Fixed column widths for 4-inch display */
          .items-table th:nth-child(1), .items-table td:nth-child(1) { width: 40%; } /* Product */
          .items-table th:nth-child(2), .items-table td:nth-child(2) { display: none; } /* Variant */
          .items-table th:nth-child(3), .items-table td:nth-child(3) { width: 30%; } /* SKU */
          .items-table th:nth-child(4), .items-table td:nth-child(4) { width: 10%; text-align: center; } /* Qty */
          .items-table th:nth-child(5), .items-table td:nth-child(5) { display: none; } /* Unit Price */
          .items-table th:nth-child(6), .items-table td:nth-child(6) { width: 20%; text-align: right; } /* Total */
          .items-table th:nth-child(7), .items-table td:nth-child(7) { display: none; } /* Tax Rate */
          .items-table th:nth-child(8), .items-table td:nth-child(8) { display: none; } /* Tax Amount */
          .totals-section { 
            page-break-inside: avoid;
            break-inside: avoid;
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid #000;
          }
          .totals-table {
            width: 100%;
            font-size: 7pt;
            border-collapse: collapse;
          }
          .totals-table td {
            padding: 4px 0;
            border: none;
            line-height: 1.4;
          }
          .totals-table td:first-child {
            text-align: left;
          }
          .totals-table td:last-child {
            text-align: right;
            font-weight: 500;
          }
          .totals-table .grand-total td {
            font-weight: bold;
            font-size: 9pt;
            border-top: 1px solid #2c3e50;
            padding-top: 6px;
            margin-top: 4px;
          }
          .footer { 
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #ddd;
            font-size: 7pt;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .footer h4 {
            margin: 0 0 3px 0;
            font-size: 8pt;
          }
          .footer-content {
            display: flex;
            justify-content: space-between;
          }
          .warehouse-info {
            font-size: 6pt;
            line-height: 1.3;
          }
          .thank-you {
            text-align: right;
            font-style: italic;
            font-size: 7pt;
          }
        </style>
      </head>
      <body>
        <div class='header'>
          <div class='header-row'>
            <div class='store-info'>
              <h1>${storeInfo?.name || "Centre Labs"}</h1>
              <div class='store-details'>
                ${storeInfo?.email || "info@centreresearch.org"}<br>
              </div>
            </div>
            <div class='invoice-box'>
              <h2>INVOICE</h2>
              <div class='order-num'>
                <strong>#${order.orderNumber}</strong><br>
                ${new Date(order.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
        
        <div class='addresses'>
          <div class='address'>
            <h3>Billing Address</h3>
            ${order.billingAddress?.firstName || ""} ${order.billingAddress?.lastName || ""}<br>
            ${order.billingAddress?.company ? order.billingAddress.company + "<br>" : ""}
            ${order.billingAddress?.address1 || ""}<br>
            ${order.billingAddress?.address2 ? order.billingAddress.address2 + "<br>" : ""}
            ${order.billingAddress?.city || ""}, ${order.billingAddress?.state || ""} ${order.billingAddress?.postalCode || ""}<br>
            ${order.billingAddress?.country || ""}
            ${salesRepDetails
        ? `
              <div class='sales-rep-info'>
                <strong>Sales Representative</strong>
                ${salesRepDetails.name}<br>
                <a href="mailto:${salesRepDetails.email}">${salesRepDetails.email}</a>
              </div>
            `
        : ""
      }
          </div>
          <div class='address'>
            <h3>Shipping Address</h3>
            ${order.shippingAddress?.firstName || ""} ${order.shippingAddress?.lastName || ""}<br>
            ${order.shippingAddress?.company ? order.shippingAddress.company + "<br>" : ""}
            ${order.shippingAddress?.address1 || ""}<br>
            ${order.shippingAddress?.address2 ? order.shippingAddress.address2 + "<br>" : ""}
            ${order.shippingAddress?.city || ""}, ${order.shippingAddress?.state || ""} ${order.shippingAddress?.postalCode || ""}<br>
            ${order.shippingAddress?.country || ""}
          </div>
        </div>
        
        <div class='customer-info'>
          <strong>Customer:</strong> ${order.customer?.firstName || ""} ${order.customer?.lastName || ""} (${order.customer?.email || ""})
        </div>
        
        <table class='items-table'>
          <thead>
            <tr>
              <th>Product</th>
              <th>Variant</th>
              <th>SKU</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Total</th>
              <th>Tax Rate</th>
              <th>Tax Amount</th>
            </tr>
          </thead>
          <tbody>
            ${order.items
        .map((item) => {
          // Use the order's tax rate for each item
          const taxRate =
            order.taxAmount && order.subtotal
              ? (order.taxAmount / order.subtotal) * 100
              : 0;

          // Check if bulk pricing was applied
          const hasBulkPrice = !!item.bulkUnitPrice;
          const displayUnitPrice = hasBulkPrice
            ? Number(item.bulkUnitPrice)
            : Number(item.unitPrice);
          const displayTotalPrice = hasBulkPrice
            ? Number(item.bulkTotalPrice)
            : Number(item.totalPrice);

          const itemTotal = displayTotalPrice;
          const itemTaxAmount = itemTotal * (taxRate / 100);

          return `
              <tr>
                <td>
                  <div class="product-name">${item.variant?.product?.name || ""
            }</div>
                </td>
                <td>${item.variant?.name || ""}</td>
                <td>
                  <div class="sku">${item.variant?.sku || ""}</div>
                </td>
                <td>${item.quantity}</td>
                <td>$${displayUnitPrice.toFixed(2)}${hasBulkPrice
              ? ' <span style="font-size: 10px; color: #16a34a;">(Bulk)</span>'
              : ""
            }</td>
                <td>$${displayTotalPrice.toFixed(2)}</td>
                <td>${taxRate.toFixed(2)}%</td>
                <td>$${itemTaxAmount.toFixed(2)}</td>
              </tr>
              `;
        })
        .join("")}
          </tbody>
        </table>
        
        <div class='totals-section'>
          <table class='totals-table'>
          <tbody>
            <tr><td>Subtotal:</td><td>$${Number(order.subtotal).toFixed(2)}</td></tr>
            <tr><td>Discount:</td><td>-$${Number(order.discountAmount).toFixed(2)}</td></tr>
            <tr><td>Shipping:</td><td>$${Number(order.shippingAmount).toFixed(2)}</td></tr>
            <tr><td>Tax:</td><td>$${Number(order.taxAmount).toFixed(2)}</td></tr>
            ${cardFee > 0
        ? `<tr><td>CC Fee (3%):</td><td>$${cardFee.toFixed(2)}</td></tr>`
        : ""
      }
              <tr class='grand-total'><td>Grand Total:</td><td>$${Number(order.totalAmount).toFixed(2)}</td></tr>
          </tbody>
        </table>
        </div>
        
        <div class='footer'>
          ${storeInfo?.name
        ? `
            <div class='warehouse-info'>
              <h4>Dispatch Location</h4>
              <div><strong>${storeInfo.name}</strong></div>
              ${storeInfo.addressLine1
          ? `<div>${storeInfo.addressLine1}</div>`
          : ""
        }
              ${storeInfo.addressLine2
          ? `<div>${storeInfo.addressLine2}</div>`
          : ""
        }
              ${storeInfo.city && storeInfo.state
          ? `<div>${storeInfo.city}, ${storeInfo.state} ${storeInfo.postalCode || ""
          }</div>`
          : ""
        }
              ${storeInfo.country ? `<div>${storeInfo.country}</div>` : ""}
            </div>
          `
        : ""
      }
          <div class='thank-you'>
          <strong>Thank you for your business!</strong>
          </div>
        </div>
      </body>
      </html>
    `;
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  }),
);

// Packing Slip - same layout as invoice but without pricing/tax/totals
router.get(
  "/:id/packing-slip",
  requirePermission("ORDERS", "READ"),
  [param("id").isString().withMessage("Order ID is required"), validateRequest],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        billingAddressRef: true,
        shippingAddressRef: true,
        items: {
          include: {
            variant: {
              include: {
                product: true,
              },
            },
          },
        },
        shipments: true,
      },
    });
    if (!order) {
      return res.status(404).send("Order not found");
    }

    // Reconstruct address objects from denormalized fields
    order.billingAddress = reconstructAddress(
      order,
      "billing",
      "billingAddressRef",
    );
    order.shippingAddress = reconstructAddress(
      order,
      "shipping",
      "shippingAddressRef",
    );
    delete order.billingAddressRef;
    delete order.shippingAddressRef;

    // Fetch store information
    const storeInfo = await prisma.storeInformation.findFirst();

    // Render HTML packing slip (no pricing) - Pure black professional design
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset='utf-8'>
        <title>Packing Slip - ${order.orderNumber}</title>
        <style>
          @page {
            size: 4in 6in;
            margin: 0;
          }
          * { box-sizing: border-box; }
          html { width: 100%; margin: 0; padding: 0; }
          body { 
            font-family: Arial, sans-serif; 
            width: 100%;
            margin: 0; 
            padding: 1mm;
            color: #000000;
            line-height: 1.2;
            background: #ffffff;
            font-size: 8pt;
            font-weight: 500;
          }
          .header { 
            margin-bottom: 10px; 
            border-bottom: 2px solid #000000;
            padding-bottom: 8px;
            page-break-inside: avoid;
          }
          .header-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .store-info h1 {
            font-size: 14pt;
            margin: 0 0 2px 0;
            color: #000000;
            font-weight: bold;
          }
          .store-details {
            font-size: 7pt;
            color: #000000;
            line-height: 1.3;
          }
          .slip-box {
            text-align: right;
          }
          .slip-box h2 {
            font-size: 12pt;
            margin: 0;
            color: #000000;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .slip-box .order-num {
            font-size: 8pt;
            margin-top: 4px;
            color: #000000;
          }
          .addresses { 
            display: flex; 
            gap: 10px; 
            margin: 10px 0;
            page-break-inside: avoid;
          }
          .address { 
            flex: 1;
            font-size: 7pt;
            line-height: 1.5;
            padding-bottom: 4px;
            color: #000000;
          }
          .address h3 {
            margin: 0 0 5px 0;
            font-size: 8pt;
            font-weight: bold;
            border-bottom: 1px solid #000000;
            padding-bottom: 4px;
            text-transform: uppercase;
            color: #000000;
          }
          .customer-info {
            font-size: 7pt;
            margin-bottom: 10px;
            padding: 5px 0;
            border-bottom: 1px solid #000000;
            line-height: 1.5;
            color: #000000;
          }
          .items-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 10px;
            font-size: 7pt;
            table-layout: fixed;
          }
          .items-table tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .items-table th, .items-table td { 
            border: 1px solid #000000; 
            padding: 6px 5px; 
            text-align: left;
            word-wrap: break-word;
            overflow-wrap: break-word;
            word-break: break-word;
            vertical-align: top;
            line-height: 1.4;
            color: #000000;
          }
          .items-table th { 
            background: #000000; 
            color: #ffffff;
            font-size: 7pt;
            text-transform: uppercase;
            padding: 8px 5px;
            font-weight: bold;
            letter-spacing: 0.5px;
          }
          /* Column widths for packing slip */
          .items-table th:nth-child(1), .items-table td:nth-child(1) { width: 50%; } /* Product */
          .items-table th:nth-child(2), .items-table td:nth-child(2) { width: 35%; } /* SKU */
          .items-table th:nth-child(3), .items-table td:nth-child(3) { width: 15%; text-align: center; } /* Qty */
          .footer { 
            margin-top: 20px;
            padding-top: 10px;
            border-top: 2px solid #000000;
            font-size: 7pt;
            page-break-inside: avoid;
            break-inside: avoid;
            color: #000000;
          }
          .footer h4 {
            margin: 0 0 3px 0;
            font-size: 8pt;
            font-weight: bold;
            text-transform: uppercase;
          }
          .warehouse-info {
            font-size: 6pt;
            line-height: 1.4;
            color: #000000;
          }
          .product-name {
            font-weight: 500;
          }
          .variant-name {
            font-size: 6pt;
            color: #000000;
            margin-top: 2px;
          }
        </style>
      </head>
      <body>
        <div class='header'>
          <div class='header-row'>
            <div class='store-info'>
              <h1>${storeInfo?.name || "Centre Labs"}</h1>
              <div class='store-details'>
                ${storeInfo?.email || "info@centreresearch.org"}<br>
                ${storeInfo?.phone || ""}<br>
                ${storeInfo?.addressLine1 || "5825 W Sunset Blvd"}${storeInfo?.addressLine2 ? ", " + storeInfo.addressLine2 : ", Suite 401"}, ${storeInfo?.city || "Los Angeles"}, ${storeInfo?.state || "CA"} ${storeInfo?.postalCode || "90028"}
              </div>
            </div>
            <div class='slip-box'>
              <h2>Packing Slip</h2>
              <div class='order-num'>
                <strong>#${order.orderNumber}</strong><br>
                ${new Date(order.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
        
        <div class='addresses'>
          <div class='address'>
            <h3>Ship To</h3>
            ${order.shippingAddress?.firstName || ""} ${order.shippingAddress?.lastName || ""}<br>
            ${order.shippingAddress?.company ? order.shippingAddress.company + "<br>" : ""}
            ${order.shippingAddress?.address1 || ""}<br>
            ${order.shippingAddress?.address2 ? order.shippingAddress.address2 + "<br>" : ""}
            ${order.shippingAddress?.city || ""}, ${order.shippingAddress?.state || ""} ${order.shippingAddress?.postalCode || ""}<br>
            ${order.shippingAddress?.country || ""}
          </div>
          <div class='address'>
            <h3>Bill To</h3>
            ${order.billingAddress?.firstName || ""} ${order.billingAddress?.lastName || ""}<br>
            ${order.billingAddress?.company ? order.billingAddress.company + "<br>" : ""}
            ${order.billingAddress?.address1 || ""}<br>
            ${order.billingAddress?.address2 ? order.billingAddress.address2 + "<br>" : ""}
            ${order.billingAddress?.city || ""}, ${order.billingAddress?.state || ""} ${order.billingAddress?.postalCode || ""}<br>
            ${order.billingAddress?.country || ""}
          </div>
        </div>
        
        <div class='customer-info'>
          <strong>Customer:</strong> ${order.customer?.firstName || ""} ${order.customer?.lastName || ""} (${order.customer?.email || ""})
        </div>
        
        <table class='items-table'>
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Qty</th>
            </tr>
          </thead>
          <tbody>
            ${order.items
        .map(
          (item) => `
              <tr>
                <td>
                  <div class="product-name">${item.variant?.product?.name || ""}</div>
                  ${item.variant?.name ? `<div class="variant-name">${item.variant.name}</div>` : ""}
                </td>
                <td>${item.variant?.sku || ""}</td>
                <td style="text-align: center; font-weight: bold;">${item.quantity}</td>
              </tr>
              `,
        )
        .join("")}
          </tbody>
        </table>
        
        <div class='footer'>
          ${storeInfo?.name
        ? `
            <div class='warehouse-info'>
              <h4>Dispatch Location</h4>
              <div><strong>${storeInfo.name}</strong></div>
              ${storeInfo.addressLine1 ? `<div>${storeInfo.addressLine1}</div>` : ""}
              ${storeInfo.addressLine2 ? `<div>${storeInfo.addressLine2}</div>` : ""}
              ${storeInfo.city && storeInfo.state ? `<div>${storeInfo.city}, ${storeInfo.state} ${storeInfo.postalCode || ""}</div>` : ""}
              ${storeInfo.country ? `<div>${storeInfo.country}</div>` : ""}
            </div>
          `
        : ""
      }
        </div>
      </body>
      </html>
    `;
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  }),
);

const getApplicableTaxRate = async (country, state) => {
  // Prefer state-specific, then country-wide, then fallback to 0
  let taxRate = null;
  if (state) {
    taxRate = await prisma.taxRate.findFirst({
      where: { country, state, isActive: true },
      orderBy: { updatedAt: "desc" },
    });
  }
  if (!taxRate) {
    taxRate = await prisma.taxRate.findFirst({
      where: { country, state: null, isActive: true },
      orderBy: { updatedAt: "desc" },
    });
  }
  return taxRate;
};

// Get applicable shipping rate based on shipping address and order details
const getApplicableShippingRate = async (
  countryCode,
  subtotal,
  orderWeight = 0,
) => {
  // Find shipping zone that includes this country
  const shippingZone = await prisma.shippingZone.findFirst({
    where: {
      countries: {
        has: countryCode, // PostgreSQL array contains operator
      },
    },
    include: {
      rates: {
        where: { isActive: true },
        orderBy: { rate: "asc" }, // Get cheapest rate first
      },
    },
  });

  if (!shippingZone || !shippingZone.rates.length) {
    return null;
  }

  // Find the best applicable rate based on order criteria
  for (const rate of shippingZone.rates) {
    let isApplicable = true;

    // Check weight constraints
    if (rate.minWeight && orderWeight < parseFloat(rate.minWeight)) {
      isApplicable = false;
    }
    if (rate.maxWeight && orderWeight > parseFloat(rate.maxWeight)) {
      isApplicable = false;
    }

    // Check price constraints
    if (rate.minPrice && subtotal < parseFloat(rate.minPrice)) {
      isApplicable = false;
    }
    if (rate.maxPrice && subtotal > parseFloat(rate.maxPrice)) {
      isApplicable = false;
    }

    if (isApplicable) {
      // 2. Dynamic Tiers: Resolve from shipping_tiers table
      const matchedTier = await prisma.shippingTier.findFirst({
        where: {
          isActive: true,
          minSubtotal: { lte: subtotal },
          OR: [{ maxSubtotal: null }, { maxSubtotal: { gt: subtotal } }],
        },
        orderBy: { minSubtotal: "desc" },
      });

      if (matchedTier) {
        return {
          ...matchedTier,
          rate: matchedTier.shippingRate,
          finalRate: parseFloat(matchedTier.shippingRate),
          reason: `Dynamic Tier: ${matchedTier.name}`,
        };
      }

      // 3. Existing Zone-Based logic (legacy/fallback)
      if (
        rate.freeShippingThreshold &&
        subtotal >= parseFloat(rate.freeShippingThreshold)
      ) {
        return {
          ...rate,
          finalRate: 0,
          reason: `Free shipping (order over $${rate.freeShippingThreshold})`,
        };
      }

      return {
        ...rate,
        finalRate: parseFloat(rate.rate),
        reason: rate.name,
      };
    }
  }

  return null;
};

// Helper: allow CUSTOMER to create order for self, else require permission
const allowCustomerCreateOr = (module, action) => (req, res, next) => {
  if (
    req.user &&
    req.user.role === "CUSTOMER" &&
    req.user.customerId &&
    req.body &&
    req.body.customerId === req.user.customerId
  ) {
    return next();
  }
  return requirePermission(module, action)(req, res, next);
};

// Create new order
router.post(
  "/",
  allowCustomerCreateOr("ORDERS", "CREATE"),
  [
    body("customerId").isString().withMessage("Customer ID is required"),
    body("billingAddressId")
      .optional()
      .isString()
      .withMessage("Billing address ID must be a string"),
    body("shippingAddressId")
      .optional()
      .isString()
      .withMessage("Shipping address ID must be a string"),
    body("billingAddress")
      .optional()
      .isObject()
      .withMessage("Billing address must be an object"),
    body("shippingAddress")
      .optional()
      .isObject()
      .withMessage("Shipping address must be an object"),
    body("items")
      .isArray({ min: 1 })
      .withMessage("At least one item is required"),
    body("items.*.variantId")
      .isString()
      .withMessage("Variant ID is required for each item"),
    body("items.*.quantity")
      .isInt({ min: 1 })
      .withMessage("Quantity must be at least 1"),
    body("items.*.unitPrice")
      .isDecimal({ decimal_digits: "0,2" })
      .withMessage("Unit price must be a valid decimal"),
    body("discountAmount")
      .optional()
      .isDecimal({ decimal_digits: "0,2" })
      .withMessage("Discount amount must be a valid decimal")
      .custom((val) => {
        if (val !== undefined && parseFloat(val) < 0)
          throw new Error("Discount amount cannot be negative");
        return true;
      }),
    body("shippingAmount")
      .optional()
      .isDecimal({ decimal_digits: "0,2" })
      .withMessage("Shipping amount must be a valid decimal"),
    body("taxAmount")
      .optional()
      .isDecimal({ decimal_digits: "0,2" })
      .withMessage("Tax amount must be a valid decimal"),
    body("couponCode")
      .optional()
      .isString()
      .withMessage("Coupon code must be a string"),
    body("selectedPaymentType")
      .optional()
      .isIn(["ZELLE", "BANK_WIRE", "AUTHORIZE_NET"])
      .withMessage(
        "Selected payment type must be ZELLE, BANK_WIRE, or AUTHORIZE_NET",
      ),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const {
      customerId,
      billingAddressId,
      shippingAddressId,
      billingAddress: inlineBillingAddress,
      shippingAddress: inlineShippingAddress,
      items,
      discountAmount = 0,
      shippingAmount = 0,
      taxAmount = 0,
      couponCode,
      selectedPaymentType = null,
      salesChannelId = null,
      partnerOrderId = null,
    } = req.body;

    // Must provide at least an addressId or inline address data for each
    if (!billingAddressId && !inlineBillingAddress) {
      return res.status(400).json({
        success: false,
        error: "Billing address ID or inline billing address is required",
      });
    }
    if (!shippingAddressId && !inlineShippingAddress) {
      return res.status(400).json({
        success: false,
        error: "Shipping address ID or inline shipping address is required",
      });
    }

    // Idempotency check for sales channel orders
    if (salesChannelId && partnerOrderId) {
      const existingOrder = await prisma.order.findFirst({
        where: {
          salesChannelId,
          partnerOrderId: String(partnerOrderId),
        },
      });

      if (existingOrder) {
        return res.status(400).json({
          success: false,
          error:
            "An order with this Partner Order ID already exists for this channel.",
        });
      }
    }

    // Verify customer exists and get their type
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        customerType: true,
      },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: "Customer not found",
      });
    }

    // Resolve billing & shipping addresses — prefer inline data, fall back to DB lookup
    let billingAddress = null;
    let shippingAddress = null;
    let resolvedBillingAddressId = billingAddressId || null;
    let resolvedShippingAddressId = shippingAddressId || null;

    if (billingAddressId) {
      billingAddress = await prisma.address.findFirst({
        where: { id: billingAddressId, customerId },
      });
      if (!billingAddress) {
        return res.status(404).json({
          success: false,
          error: `Billing address not found or doesn't belong to customer`,
        });
      }
    }

    if (shippingAddressId) {
      shippingAddress = await prisma.address.findFirst({
        where: { id: shippingAddressId, customerId },
      });
      if (!shippingAddress) {
        return res.status(404).json({
          success: false,
          error: `Shipping address not found or doesn't belong to customer`,
        });
      }
    }

    // Inline address data overrides what we got from the DB lookup (snapshot the edited version)
    const finalBillingAddress = inlineBillingAddress
      ? { ...(billingAddress || {}), ...inlineBillingAddress }
      : billingAddress;
    const finalShippingAddress = inlineShippingAddress
      ? { ...(shippingAddress || {}), ...inlineShippingAddress }
      : shippingAddress;

    if (!finalBillingAddress || !finalBillingAddress.firstName) {
      return res.status(400).json({
        success: false,
        error:
          "Billing address data is required (firstName, address1, city, state, postalCode, country)",
      });
    }
    if (!finalShippingAddress || !finalShippingAddress.firstName) {
      return res.status(400).json({
        success: false,
        error:
          "Shipping address data is required (firstName, address1, city, state, postalCode, country)",
      });
    }

    // Fetch applicable tax rate and shipping rate based on shipping address
    let taxRateValue = 0;
    let taxRateType = null;
    let autoShippingAmount = 0;
    let shippingRateInfo = null;

    if (finalShippingAddress) {
      // Convert country/state names to ISO codes (same logic as frontend)
      const { countryCode, stateCode } = getCountryStateIsoCodes(
        finalShippingAddress.country,
        finalShippingAddress.state,
      );

      if (countryCode) {
        // Get tax rate
        const taxRate = await getApplicableTaxRate(countryCode, stateCode);
        if (taxRate) {
          taxRateValue = parseFloat(taxRate.rate);
          taxRateType = taxRate.type;
        }
        // Shipping rate will be calculated after subtotal is available
      }
    }

    // Map customer type to pricing tier (B2B->B2C, ENTERPRISE_2->ENTERPRISE_1)
    const pricingCustomerType = getPricingCustomerType(customer.customerType);

    // Verify all variants exist and calculate totals
    const variants = await prisma.productVariant.findMany({
      where: {
        id: {
          in: items.map((item) => item.variantId),
        },
      },
      include: {
        product: true,
        inventory: {
          select: {
            id: true,
            locationId: true,
            quantity: true,
            reservedQty: true,
            sellWhenOutOfStock: true,
          },
        },
        segmentPrices: {
          where: {
            customerType: pricingCustomerType, // Use mapped customer type for pricing
          },
        },
      },
    });

    // Validations: Check for inactive products or variants
    const inactiveVariants = variants.filter(
      (v) => !v.isActive || v.product.status !== "ACTIVE",
    );
    if (inactiveVariants.length > 0) {
      const names = inactiveVariants.map((v) => v.product.name).join(", ");
      return res.status(400).json({
        success: false,
        error: `The following items are no longer available: ${names}`,
      });
    }

    if (variants.length !== items.length) {
      const foundVariantIds = variants.map((v) => v.id);
      const missingVariantIds = items
        .map((item) => item.variantId)
        .filter((id) => !foundVariantIds.includes(id));

      return res.status(404).json({
        success: false,
        error: `Product variants not found: ${missingVariantIds.join(", ")}`,
      });
    }

    // Verify user exists (for userId foreign key)
    if (req.user?.id) {
      const userExists = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true },
      });

      if (!userExists) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }
    }

    // Check inventory availability and get correct prices (including bulk pricing)
    // CRITICAL: Backend ALWAYS uses current database prices, NEVER trusts frontend unitPrice
    // This ensures price changes by admin are reflected immediately in new orders
    const itemsWithPrices = await Promise.all(
      items.map(async (item) => {
        const variant = variants.find((v) => v.id === item.variantId);
        let canSellOutOfStock = false;
        const totalInventory = variant.inventory.reduce((sum, inv) => {
          if (inv.sellWhenOutOfStock) canSellOutOfStock = true;
          return (
            sum + Math.max(0, (inv.quantity || 0) - (inv.reservedQty || 0))
          );
        }, 0);

        // Get segment-specific price if available, otherwise use default price
        // NOTE: Frontend unitPrice (item.unitPrice) is IGNORED - we calculate from current DB state
        const segmentPrice = variant.segmentPrices[0];
        const regularUnitPrice = segmentPrice
          ? segmentPrice.salePrice > 0
            ? segmentPrice.salePrice
            : segmentPrice.regularPrice
          : variant.salePrice > 0
            ? variant.salePrice
            : variant.regularPrice;

        // Check for bulk pricing based on quantity
        const bulkPricing = await calculatePriceWithBulk(
          item.variantId,
          item.quantity,
          regularUnitPrice,
        );

        // IMPORTANT: Keep unitPrice as regular/segment price for comparison
        // Only populate bulkUnitPrice and bulkTotalPrice when bulk pricing applies
        const unitPrice = regularUnitPrice; // Always use regular/segment price from DB
        const bulkUnitPrice = bulkPricing.isBulkPrice
          ? bulkPricing.unitPrice
          : null;
        const bulkTotalPrice = bulkPricing.isBulkPrice
          ? bulkPricing.totalPrice
          : null;

        return {
          ...item,
          unitPrice: parseFloat(unitPrice), // CURRENT price from database
          regularUnitPrice: parseFloat(regularUnitPrice), // Store for reference
          bulkUnitPrice: bulkUnitPrice ? parseFloat(bulkUnitPrice) : null,
          bulkTotalPrice: bulkTotalPrice ? parseFloat(bulkTotalPrice) : null,
          totalInventory,
          canSellOutOfStock, // Flag indicating if backorders are allowed
          sufficient: totalInventory >= item.quantity || canSellOutOfStock,
        };
      }),
    );

    const insufficientItems = itemsWithPrices.filter(
      (item) => !item.sufficient,
    );
    if (insufficientItems.length > 0) {
      // Get variant details for better error messages
      const itemDetails = insufficientItems.map((item) => {
        const variant = variants.find((v) => v.id === item.variantId);
        return {
          variantId: item.variantId,
          productName: variant?.product?.name || "Unknown Product",
          variantName: variant?.name || "Unknown Variant",
          sku: variant?.sku || "N/A",
          requestedQuantity: item.quantity,
          availableQuantity: item.totalInventory,
          canBackorder: item.canSellOutOfStock,
        };
      });

      return res.status(400).json({
        success: false,
        error: "Insufficient inventory for one or more items",
        details: itemDetails,
        message: itemDetails
          .map(
            (d) =>
              `${d.productName} (${d.variantName}): Requested ${d.requestedQuantity}, Available ${d.availableQuantity}${d.canBackorder ? " (backorders disabled)" : ""}`,
          )
          .join("; "),
      });
    }

    // Calculate totals using bulk prices when available, otherwise segment-specific prices
    const subtotal = itemsWithPrices.reduce((sum, item) => {
      // Use bulk price if available, otherwise use regular unit price
      const effectivePrice = item.bulkUnitPrice || item.unitPrice;
      return sum + effectivePrice * item.quantity;
    }, 0);

    // Now calculate shipping rate using the subtotal
    if (finalShippingAddress) {
      const { countryCode } = getCountryStateIsoCodes(
        finalShippingAddress.country,
        finalShippingAddress.state,
      );
      if (countryCode) {
        // Get shipping rate (calculate order weight if needed)
        const orderWeight = 0; // TODO: Calculate actual weight from products
        const applicableShippingRate = await getApplicableShippingRate(
          countryCode,
          subtotal,
          orderWeight,
        );

        if (applicableShippingRate) {
          autoShippingAmount = applicableShippingRate.finalRate;
          shippingRateInfo = {
            name: applicableShippingRate.name,
            reason: applicableShippingRate.reason,
            zoneId: applicableShippingRate.zoneId,
          };
        }
      }
    }

    // Initialize discount amount
    let finalDiscountAmount = 0;
    let appliedCoupon = null;

    // Debug logging
    logger.debug("Order Creation Debug", {
      customerId,
      subtotal,
      discountAmount,
      customerType: customer.customerType,
      couponCode,
    });

    if (couponCode) {
      // Validate coupon
      const now = new Date();
      const promo = await prisma.promotion.findFirst({
        where: {
          code: couponCode.toUpperCase(),
          isActive: true,
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
          AND: [
            {
              OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
            },
          ],
        },
        include: {
          productRules: {
            include: {
              product: true,
              variant: true,
            },
          },
          categoryRules: {
            include: {
              category: true,
            },
          },
          volumeTiers: {
            orderBy: { minQuantity: "asc" },
          },
          specificCustomers: {
            select: { customerId: true },
          },
        },
      });

      // Additional check for usage limit
      if (promo && promo.usageLimit && promo.usageCount >= promo.usageLimit) {
        return res
          .status(400)
          .json({ success: false, error: "Coupon usage limit exceeded" });
      }

      if (!promo) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid or expired coupon code" });
      }

      // Get customer details for eligibility check
      const customerDetails = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { id: true, customerType: true },
      });

      // Prepare order items with variant details for calculation
      const orderItemsWithVariants = await Promise.all(
        items.map(async (item) => {
          const variant = await prisma.productVariant.findUnique({
            where: { id: item.variantId },
            include: { product: true },
          });
          return {
            ...item,
            variant,
            unitPrice: item.unitPrice,
          };
        }),
      );

      // Calculate discount using advanced promotion calculator
      const discountResult = await calculatePromotionDiscount(
        promo,
        orderItemsWithVariants,
        customerDetails,
        subtotal,
        parseFloat(shippingAmount),
      );

      if (discountResult.error) {
        return res
          .status(400)
          .json({ success: false, error: discountResult.error });
      }

      // Use the calculated coupon discount (replaces any manual discount)
      finalDiscountAmount = Math.round(discountResult.discount * 100) / 100;
      appliedCoupon = promo;
    } else {
      // Use the discount amount provided by frontend (when no coupon)
      const requestedManualDiscount =
        Math.round((parseFloat(discountAmount) || 0) * 100) / 100;
      // Cap discount at 100% of subtotal to prevent negative totals
      const maxDiscount = subtotal;
      finalDiscountAmount = Math.min(requestedManualDiscount, maxDiscount);
    }

    // Use auto-calculated shipping if no manual shipping amount provided
    const finalShippingAmount =
      shippingAmount !== undefined && shippingAmount !== null
        ? parseFloat(shippingAmount)
        : autoShippingAmount;
    const taxableAmount = subtotal - finalDiscountAmount + finalShippingAmount;
    const finalTaxAmount =
      Math.round(taxableAmount * (taxRateValue / 100) * 100) / 100;
    const totalAmount =
      Math.round(
        (subtotal -
          finalDiscountAmount +
          finalShippingAmount +
          finalTaxAmount) *
        100,
      ) / 100;

    // Optional flag to skip warehouse selection/reservation (used for manual payments like Zelle/Wire)
    const skipWarehouse = !!req.body?.skipWarehouse;

    // Create order in transaction
    let warehouseSelectionInfo = null; // hoisted so it's available after transaction
    const order = await prisma.$transaction(async (tx) => {
      // Generate order number
      const orderNumber = generateOrderNumber();

      // Create order
      let newOrder;
      try {
        newOrder = await tx.order.create({
          data: {
            orderNumber,
            customerId,
            userId: req.user?.id || null,
            status: "PENDING",
            subtotal,
            discountAmount: finalDiscountAmount,
            shippingAmount: finalShippingAmount,
            taxAmount: finalTaxAmount,
            totalAmount,
            billingAddressId: resolvedBillingAddressId,
            shippingAddressId: resolvedShippingAddressId,
            // Denormalized address snapshots
            ...buildAddressSnapshot(finalBillingAddress, "billing"),
            ...buildAddressSnapshot(finalShippingAddress, "shipping"),
            selectedPaymentType: selectedPaymentType || null,
            salesChannelId: salesChannelId || null,
            partnerOrderId: partnerOrderId ? String(partnerOrderId) : null,
          },
        });
      } catch (error) {
        logger.error("Error creating order", error);
        if (error.code === "P2003") {
          throw new Error(
            `Foreign key constraint failed: ${error.meta?.field_name || "unknown field"}`,
          );
        }
        throw error;
      }

      // Increment coupon usage count inside transaction (atomic with order creation)
      if (couponCode) {
        await tx.promotion.update({
          where: { code: couponCode.toUpperCase() },
          data: { usageCount: { increment: 1 } },
        });
      }

      // Create order items with segment-specific prices and bulk pricing
      const orderItems = itemsWithPrices.map((item) => ({
        orderId: newOrder.id,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.unitPrice * item.quantity,
        bulkUnitPrice: item.bulkUnitPrice,
        bulkTotalPrice: item.bulkTotalPrice,
      }));

      await tx.orderItem.createMany({
        data: orderItems,
      });

      // Find optimal warehouse for automatic dispatch (skip if requested)
      if (!skipWarehouse && resolvedShippingAddressId) {
        let optimalWarehouse = null;
        try {
          const warehouseResult = await findOptimalWarehouse(
            resolvedShippingAddressId,
            itemsWithPrices,
          );
          optimalWarehouse = warehouseResult.warehouse;
          warehouseSelectionInfo = {
            warehouseId: optimalWarehouse.id,
            warehouseName: optimalWarehouse.name,
            distance: warehouseResult.distance,
            stockAvailable: warehouseResult.stockAvailable,
            coordinates: warehouseResult.coordinates,
          };

          // Reserve inventory from the optimal warehouse
          if (warehouseResult.stockAvailable) {
            logger.info(
              `[Order] Reserving from optimal warehouse: ${optimalWarehouse.id}`,
            );
            await reserveInventoryFromWarehouse(
              optimalWarehouse.id,
              itemsWithPrices,
              tx,
            );
          } else {
            // If no warehouse has sufficient stock, fall back to original logic
            console.warn(
              "[Order] No warehouse has sufficient stock, using fallback inventory reservation",
            );
            for (const item of itemsWithPrices) {
              const variant = variants.find((v) => v.id === item.variantId);
              const inventoryRecords = variant.inventory;
              let remainingQty = item.quantity;

              // Pass 1: Consume available stock
              for (const inventory of inventoryRecords) {
                if (remainingQty <= 0) break;
                const availableQty = Math.max(
                  0,
                  (inventory.quantity || 0) - (inventory.reservedQty || 0),
                );
                const reserveQty = Math.min(remainingQty, availableQty);
                if (reserveQty > 0) {
                  await tx.inventory.update({
                    where: {
                      variantId_locationId: {
                        variantId: variant.id,
                        locationId: inventory.locationId,
                      },
                    },
                    data: { reservedQty: { increment: reserveQty } },
                  });
                  remainingQty -= reserveQty;
                }
              }

              // Pass 2: Consume via backorder (sellWhenOutOfStock)
              if (remainingQty > 0) {
                for (const inventory of inventoryRecords) {
                  if (remainingQty <= 0) break;
                  if (inventory.sellWhenOutOfStock) {
                    const reserveQty = remainingQty;
                    await tx.inventory.update({
                      where: {
                        variantId_locationId: {
                          variantId: variant.id,
                          locationId: inventory.locationId,
                        },
                      },
                      data: { reservedQty: { increment: reserveQty } },
                    });
                    remainingQty -= reserveQty;
                  }
                }
              }
            }
          }
        } catch (warehouseError) {
          logger.error("Error in warehouse selection", warehouseError);
          // Fall back to original inventory reservation logic
          for (const item of itemsWithPrices) {
            const variant = variants.find((v) => v.id === item.variantId);
            const inventoryRecords = variant.inventory;
            let remainingQty = item.quantity;

            // Pass 1: Consume available stock
            for (const inventory of inventoryRecords) {
              if (remainingQty <= 0) break;
              const availableQty = Math.max(
                0,
                (inventory.quantity || 0) - (inventory.reservedQty || 0),
              );
              const reserveQty = Math.min(remainingQty, availableQty);
              if (reserveQty > 0) {
                await tx.inventory.update({
                  where: {
                    variantId_locationId: {
                      variantId: variant.id,
                      locationId: inventory.locationId,
                    },
                  },
                  data: { reservedQty: { increment: reserveQty } },
                });
                remainingQty -= reserveQty;
              }
            }

            // Pass 2: Consume via backorder (sellWhenOutOfStock)
            if (remainingQty > 0) {
              for (const inventory of inventoryRecords) {
                if (remainingQty <= 0) break;
                if (inventory.sellWhenOutOfStock) {
                  const reserveQty = remainingQty;
                  await tx.inventory.update({
                    where: {
                      variantId_locationId: {
                        variantId: variant.id,
                        locationId: inventory.locationId,
                      },
                    },
                    data: { reservedQty: { increment: reserveQty } },
                  });
                  remainingQty -= reserveQty;
                }
              }
            }
          }
        }
      }

      return newOrder;
    });

    // Create audit log after transaction is complete
    try {
      await logOrderAudit({
        orderId: order.id,
        userId: req.user?.id,
        action: "ORDER_CREATED",
        details: {
          orderNumber: order.orderNumber,
          totalAmount,
          itemCount: items.length,
          customerType: customer.customerType,
          warehouseSelection: warehouseSelectionInfo,
        },
        req,
      });
    } catch (auditError) {
      logger.error("Failed to create audit log", auditError);
      // Don't fail the order creation if audit log fails
    }

    // Fetch complete order with relations
    const completeOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            customerType: true,
          },
        },
        billingAddressRef: true,
        shippingAddressRef: true,
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
                segmentPrices: {
                  where: {
                    customerType: customer.customerType,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Reconstruct address objects from denormalized snapshot for backward-compatible response
    completeOrder.billingAddress = reconstructAddress(
      completeOrder,
      "billing",
      "billingAddressRef",
    );
    completeOrder.shippingAddress = reconstructAddress(
      completeOrder,
      "shipping",
      "shippingAddressRef",
    );
    delete completeOrder.billingAddressRef;
    delete completeOrder.shippingAddressRef;

    // Optionally suppress order confirmation email (used for manual checkout flow)
    if (!req.body?.suppressEmail) {
      try {
        logger.debug("=== ORDER CREATION EMAIL DEBUG ===");
        logger.info("Order created successfully, attempting to send email...");
        logger.debug("Complete order data", {
          id: completeOrder.id,
          orderNumber: completeOrder.orderNumber,
          customerEmail: completeOrder.customer?.email,
          customerName: completeOrder.customer
            ? `${completeOrder.customer.firstName} ${completeOrder.customer.lastName}`
            : "N/A",
          itemsCount: completeOrder.items?.length || 0,
          total: completeOrder.total,
        });

        if (!completeOrder.customer?.email) {
          logger.error("No customer email found, cannot send email");
          throw new Error("Customer email is required for order confirmation");
        }

        await sendOrderConfirmation(completeOrder, completeOrder.customer);
        logger.info(
          `✅ Order confirmation email sent successfully to ${completeOrder.customer.email}`,
        );
      } catch (emailError) {
        logger.error("❌ Failed to send order confirmation email", emailError);
        logger.debug("Email error details", {
          message: emailError.message,
          stack: emailError.stack,
        });
        // Don't fail the order creation if email sending fails
      }
    }

    // Always notify shipping manager and assigned sales rep(s), non-blocking
    (async () => {
      try {
        await sendNewOrderToShippingManager(
          completeOrder,
          completeOrder.customer,
        );
      } catch (err) {
        logger.error("Failed to notify shipping manager of new order", {
          error: err?.message || err,
        });
      }

      try {
        // Find assigned sales reps (similar to analytics/notifications pattern)
        const assignments = await prisma.salesRepCustomerAssignment.findMany({
          where: { customerId: completeOrder.customerId },
          include: { salesRep: { include: { user: true } } },
        });
        for (const a of assignments) {
          if (a?.salesRep?.user && a.salesRep.user.isActive) {
            try {
              await sendNewOrderToSalesRep(
                completeOrder,
                completeOrder.customer,
                a.salesRep.user,
              );
            } catch (innerErr) {
              logger.error("Failed to notify a sales rep of new order", {
                error: innerErr?.message || innerErr,
              });
            }
          } else if (a?.salesRep?.user && !a.salesRep.user.isActive) {
            logger.info(`Skipped sending new order notification to inactive sales rep: ${a.salesRep.user.email}`);
          }
        }
      } catch (repErr) {
        logger.error("Failed to fetch or notify sales reps for new order", {
          error: repErr?.message || repErr,
        });
      }
    })();

    // Trigger Odoo sync for affected products (non-blocking)
    // This updates Odoo with the new available quantity after reserved qty increased
    (async () => {
      try {
        // Get unique product IDs from order items
        const productIds = [
          ...new Set(
            completeOrder.items
              .map((item) => item.variant?.product?.id)
              .filter(Boolean),
          ),
        ];

        for (const productId of productIds) {
          await queueProductSync(
            productId,
            "ORDER_CREATED",
            `Order #${completeOrder.orderNumber} created`,
            { orderId: completeOrder.id, initiatedBy: "system" },
          );
        }
        logger.info(
          `[Orders] Queued Odoo sync for ${productIds.length} products from order ${completeOrder.orderNumber}`,
        );
      } catch (odooErr) {
        logger.error("[Orders] Failed to queue Odoo sync for new order", {
          error: odooErr?.message || odooErr,
        });
        // Don't fail the order creation if Odoo sync queue fails
      }
    })();

    // Notify sales channel webhooks about inventory change from new order
    const newOrderVariantIds = (completeOrder.items || [])
      .map((item) => item.variantId || item.variant?.id)
      .filter(Boolean);
    if (newOrderVariantIds.length > 0) {
      notifySalesChannelWebhooks(newOrderVariantIds).catch((err) =>
        logger.error("[ORDER CREATE] Webhook notification failed", err),
      );
    }

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: {
        ...completeOrder,
        appliedCoupon,
        warehouseSelection: warehouseSelectionInfo,
      },
    });
  }),
);

// Calculate shipping rates for checkout with automatic warehouse selection
router.post(
  "/checkout/shipping-rates",
  [
    body("customerAddressId")
      .isString()
      .withMessage("Customer address ID is required"),
    body("items").isArray().withMessage("Items array is required"),
    body("items.*.variantId").isString().withMessage("Variant ID is required"),
    body("items.*.quantity")
      .isInt({ min: 1 })
      .withMessage("Quantity must be a positive integer"),
    body("weightOz")
      .optional()
      .isNumeric()
      .withMessage("Weight must be a number"),
    body("dimensions")
      .optional()
      .isObject()
      .withMessage("Dimensions must be an object"),
    body("carrierCode")
      .optional()
      .isString()
      .withMessage("Carrier code must be a string"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { customerAddressId, items, weightOz, dimensions, carrierCode } =
      req.body;

    try {
      // Find optimal warehouse
      const warehouseResult = await findOptimalWarehouse(
        customerAddressId,
        items,
      );

      if (!warehouseResult) {
        return res.status(400).json({
          success: false,
          error: "No suitable warehouse found",
        });
      }

      // Calculate shipping rates from the optimal warehouse using ShipStation
      const shippingRate = await calculateShippingFromWarehouse(
        warehouseResult.warehouse.id,
        customerAddressId,
        weightOz || 0,
        dimensions || null,
        carrierCode || null,
      );

      res.json({
        success: true,
        data: {
          warehouse: {
            id: warehouseResult.warehouse.id,
            name: warehouseResult.warehouse.name,
            address: warehouseResult.warehouse.address,
            city: warehouseResult.warehouse.city,
            state: warehouseResult.warehouse.state,
            country: warehouseResult.warehouse.country,
            postalCode: warehouseResult.warehouse.postalCode,
          },
          distance: warehouseResult.distance,
          stockAvailable: warehouseResult.stockAvailable,
          shippingRate: shippingRate,
          stockDetails: warehouseResult.stockDetails,
          shipFrom: {
            country_code: warehouseResult.warehouse.country || "US",
            postal_code: warehouseResult.warehouse.postalCode || "10001",
            city_locality: warehouseResult.warehouse.city || "New York",
            state_province: warehouseResult.warehouse.state || "NY",
            address_line1: warehouseResult.warehouse.address || "123 Main St",
          },
        },
      });
    } catch (error) {
      console.error("Error calculating checkout shipping rates:", error);
      res.status(500).json({
        success: false,
        error: "Failed to calculate shipping rates",
      });
    }
  }),
);

// Calculate shipping rate from optimal warehouse
router.post(
  "/calculate-shipping",
  [
    body("customerAddressId")
      .isString()
      .withMessage("Customer address ID is required"),
    body("items").isArray().withMessage("Items array is required"),
    body("items.*.variantId").isString().withMessage("Variant ID is required"),
    body("items.*.quantity")
      .isInt({ min: 1 })
      .withMessage("Quantity must be a positive integer"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { customerAddressId, items } = req.body;

    try {
      // Find optimal warehouse
      const warehouseResult = await findOptimalWarehouse(
        customerAddressId,
        items,
      );

      if (!warehouseResult) {
        return res.status(400).json({
          success: false,
          error: "No suitable warehouse found",
        });
      }

      // Calculate shipping rate from the optimal warehouse
      const shippingRate = await calculateShippingFromWarehouse(
        warehouseResult.warehouse.id,
        customerAddressId,
        0, // orderWeight - could be calculated from items
        null, // dimensions - could be calculated from items
        null, // carrierCode - optional filter
      );

      res.json({
        success: true,
        data: {
          warehouse: {
            id: warehouseResult.warehouse.id,
            name: warehouseResult.warehouse.name,
            address: warehouseResult.warehouse.address,
            city: warehouseResult.warehouse.city,
            state: warehouseResult.warehouse.state,
            country: warehouseResult.warehouse.country,
          },
          distance: warehouseResult.distance,
          stockAvailable: warehouseResult.stockAvailable,
          shippingRate: shippingRate,
          stockDetails: warehouseResult.stockDetails,
        },
      });
    } catch (error) {
      console.error("Error calculating shipping:", error);
      res.status(500).json({
        success: false,
        error: "Failed to calculate shipping rate",
      });
    }
  }),
);

// Update order
router.put(
  "/:id",
  requirePermission("ORDERS", "UPDATE"),
  [
    param("id").isString().withMessage("Order ID is required"),
    body("status")
      .optional()
      .isIn([
        "PENDING",
        "PROCESSING",
        "LABEL_CREATED",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
        "REFUNDED",
        "ON_HOLD",
      ])
      .withMessage("Invalid status"),
    body("billingAddressId")
      .optional()
      .isString()
      .withMessage("Billing address ID must be a string"),
    body("shippingAddressId")
      .optional()
      .isString()
      .withMessage("Shipping address ID must be a string"),
    body("discountAmount")
      .optional()
      .isDecimal({ decimal_digits: "0,2" })
      .withMessage("Discount amount must be a valid decimal"),
    body("shippingAmount")
      .optional()
      .isDecimal({ decimal_digits: "0,2" })
      .withMessage("Shipping amount must be a valid decimal"),
    body("taxAmount")
      .optional()
      .isDecimal({ decimal_digits: "0,2" })
      .withMessage("Tax amount must be a valid decimal"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      status,
      billingAddressId,
      shippingAddressId,
      discountAmount,
      shippingAmount,
      taxAmount,
    } = req.body;

    // Check if order exists
    const existingOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    // Prepare update data
    const updateData = {};
    if (status) updateData.status = status;
    if (billingAddressId) updateData.billingAddressId = billingAddressId;
    if (shippingAddressId) updateData.shippingAddressId = shippingAddressId;
    if (discountAmount !== undefined)
      updateData.discountAmount = parseFloat(discountAmount);
    if (shippingAmount !== undefined)
      updateData.shippingAmount = parseFloat(shippingAmount);
    if (taxAmount !== undefined) updateData.taxAmount = parseFloat(taxAmount);

    // Recalculate total if amounts changed
    if (
      discountAmount !== undefined ||
      shippingAmount !== undefined ||
      taxAmount !== undefined
    ) {
      const subtotal = existingOrder.subtotal;
      const finalDiscountAmount =
        discountAmount !== undefined
          ? parseFloat(discountAmount)
          : existingOrder.discountAmount;
      const finalShippingAmount =
        shippingAmount !== undefined
          ? parseFloat(shippingAmount)
          : existingOrder.shippingAmount;
      const finalTaxAmount =
        taxAmount !== undefined
          ? parseFloat(taxAmount)
          : existingOrder.taxAmount;

      // Identify any existing fee (e.g. 3% credit card fee) added during checkout
      // We calculate the delta between the stored total and the sum of its visible components
      const currentBaseTotal =
        subtotal -
        existingOrder.discountAmount +
        existingOrder.shippingAmount +
        existingOrder.taxAmount;
      const feeDelta = Math.max(
        0,
        existingOrder.totalAmount - currentBaseTotal,
      );

      // Recalculate total preserving the fee delta
      const newTotal =
        subtotal -
        finalDiscountAmount +
        finalShippingAmount +
        finalTaxAmount +
        feeDelta;

      updateData.totalAmount = Math.round(newTotal * 100) / 100;
    }

    // Update order in transaction
    const order = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id },
        data: updateData,
      });

      // Create audit log
      await logOrderAudit({
        orderId: id,
        userId: req.user.id,
        action: "ORDER_UPDATED",
        details: {
          changes: updateData,
          previousStatus: existingOrder.status,
          newStatus: status || existingOrder.status,
        },
        req,
      });

      return updatedOrder;
    });

    // Fetch complete order with relations
    const completeOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            customerType: true,
          },
        },
        billingAddressRef: true,
        shippingAddressRef: true,
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
      },
    });

    // Reconstruct address objects from denormalized fields
    completeOrder.billingAddress = reconstructAddress(
      completeOrder,
      "billing",
      "billingAddressRef",
    );
    completeOrder.shippingAddress = reconstructAddress(
      completeOrder,
      "shipping",
      "shippingAddressRef",
    );
    delete completeOrder.billingAddressRef;
    delete completeOrder.shippingAddressRef;

    // Automatically create shipment when status changes to SHIPPED
    if (status === "SHIPPED" && existingOrder.status !== "SHIPPED") {
      logger.info(
        "[ORDER UPDATE] Status changed to SHIPPED, creating shipment automatically",
      );
      try {
        // Only create shipment if one doesn't already exist
        if (!existingOrder.shipmentTrackingNumber) {
          const shipmentResult = await createShipmentForOrder(id);

          // Update order with shipment details
          await prisma.order.update({
            where: { id },
            data: {
              shipmentTrackingNumber:
                shipmentResult.trackingNumber || undefined,
              shipmentRequestStatus: shipmentResult.trackingNumber
                ? "ACCEPTED_BY_SHIPPER"
                : "CREATED",
            },
          });

          logger.info("[ORDER UPDATE] Shipment created successfully", {
            shipmentId: shipmentResult.shipmentId,
            trackingNumber: shipmentResult.trackingNumber,
            status: shipmentResult.shipmentStatus,
          });

          // Refresh completeOrder with updated tracking info
          const updatedOrder = await prisma.order.findUnique({
            where: { id },
            include: {
              customer: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  customerType: true,
                },
              },
              billingAddressRef: true,
              shippingAddressRef: true,
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
            },
          });
          if (updatedOrder) {
            Object.assign(completeOrder, updatedOrder);
            // Re-reconstruct addresses after refresh
            completeOrder.billingAddress = reconstructAddress(
              completeOrder,
              "billing",
              "billingAddressRef",
            );
            completeOrder.shippingAddress = reconstructAddress(
              completeOrder,
              "shipping",
              "shippingAddressRef",
            );
            delete completeOrder.billingAddressRef;
            delete completeOrder.shippingAddressRef;
          }
        } else {
          logger.info(
            "[ORDER UPDATE] Order already has tracking number, skipping shipment creation",
          );
        }
      } catch (shipmentError) {
        console.error(
          "[ORDER UPDATE] Failed to create shipment automatically:",
          shipmentError,
        );
        // Don't fail the status update if shipment creation fails
        // But update the shipment status to indicate failure
        try {
          await prisma.order.update({
            where: { id },
            data: {
              shipmentRequestStatus: "CREATED", // Indicate shipment was attempted but may have issues
            },
          });
        } catch (updateError) {
          logger.error(
            "[ORDER UPDATE] Failed to update shipment status",
            updateError,
          );
        }
      }
    }

    // If status changed to SHIPPED, send shipping notification only if shipment wasn't just created
    // (shipment creation already sends the email)
    if (
      status === "SHIPPED" &&
      existingOrder.status !== "SHIPPED" &&
      completeOrder.customer?.email &&
      !shipmentCreatedInThisRequest
    ) {
      try {
        const existingShipment = await prisma.shipment.findFirst({
          where: { orderId: completeOrder.id },
        });

        // Only send email if no shipment exists (manual status update)
        if (!existingShipment) {
          logger.info(
            "[ORDER UPDATE] Attempting to send shipping notification email to",
            { email: completeOrder.customer.email },
          );
          const { sendShippingNotification } = require("../utils/emailService");
          await sendShippingNotification(
            completeOrder,
            completeOrder.customer,
            null,
          ); // shipment is null here
          console.log(
            "[ORDER UPDATE] Shipping notification email sent to",
            completeOrder.customer.email,
          );
        } else {
          console.log(
            "[ORDER UPDATE] Shipment exists, skipping email (already sent during shipment creation)",
          );
        }
      } catch (emailError) {
        console.error(
          "[ORDER UPDATE] Failed to send shipping notification email:",
          emailError,
        );
      }
    }

    // If status changed to CANCELLED, send order cancellation email
    if (
      status === "CANCELLED" &&
      existingOrder.status !== "CANCELLED" &&
      completeOrder.customer?.email
    ) {
      logger.info(
        "[ORDER UPDATE] Attempting to send order cancellation email to",
        { email: completeOrder.customer.email },
      );
      try {
        await sendOrderCancellation(completeOrder, completeOrder.customer);
        logger.info("[ORDER UPDATE] Order cancellation email sent to", {
          email: completeOrder.customer.email,
        });
      } catch (emailError) {
        logger.error(
          "[ORDER UPDATE] Failed to send order cancellation email",
          emailError,
        );
      }
    }

    // Notify sales channel webhooks about inventory changes on status transitions
    if (status && existingOrder.status !== status) {
      const affectedVariantIds = (completeOrder.items || [])
        .map((item) => item.variantId || item.variant?.id)
        .filter(Boolean);
      if (affectedVariantIds.length > 0) {
        notifySalesChannelWebhooks(affectedVariantIds).catch((err) =>
          logger.error("[ORDER UPDATE] Webhook notification failed", err),
        );
      }
    }

    res.json({
      success: true,
      message: "Order updated successfully",
      data: completeOrder,
    });
  }),
);

// Update order status
router.patch(
  "/:id/status",
  requirePermission("ORDERS", "UPDATE"),
  [
    param("id").isString().withMessage("Order ID is required"),
    body("status")
      .isIn([
        "PENDING",
        "PROCESSING",
        "LABEL_CREATED",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
        "REFUNDED",
        "ON_HOLD",
      ])
      .withMessage("Invalid status"),
    body("note").optional().isString().withMessage("Note must be a string"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, note } = req.body;

    // Check if order exists
    const existingOrder = await prisma.order.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    // Update order status in transaction
    const order = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id },
        data: { status },
      });

      // Add note if provided
      if (note) {
        await tx.orderNote.create({
          data: {
            orderId: id,
            userId: req.user.id,
            note,
            isInternal: true,
          },
        });
      }

      // Create audit log
      await logOrderAudit({
        orderId: id,
        userId: req.user.id,
        action: "STATUS_UPDATED",
        details: {
          previousStatus: existingOrder.status,
          newStatus: status,
          note: note || null,
        },
        req,
      });

      // Inventory adjustments based on status transition
      try {
        const items = await tx.orderItem.findMany({ where: { orderId: id } });
        const variantIds = items.map((i) => i.variantId);
        const variants = await tx.productVariant.findMany({
          where: { id: { in: variantIds } },
          include: { inventory: true },
        });

        const isCommitTransition =
          ["SHIPPED", "DELIVERED"].includes(status) &&
          ["PENDING", "ON_HOLD", "PROCESSING", "LABEL_CREATED"].includes(
            existingOrder.status,
          );
        const isReleaseTransition =
          ["CANCELLED", "REFUNDED"].includes(status) &&
          ["PENDING", "ON_HOLD", "PROCESSING", "LABEL_CREATED"].includes(
            existingOrder.status,
          );

        if (isCommitTransition) {
          // For DELIVERED status: remove quantity from total and clear reserved
          // For other statuses: deduct reserved and quantity
          if (status === "DELIVERED") {
            for (const item of items) {
              const variant = variants.find((v) => v.id === item.variantId);
              if (!variant) continue;
              let remaining = item.quantity;
              for (const inv of variant.inventory) {
                if (remaining <= 0) break;
                const toDeduct = Math.min(remaining, inv.quantity || 0);
                if (toDeduct > 0) {
                  await tx.inventory.update({
                    where: {
                      variantId_locationId: {
                        variantId: variant.id,
                        locationId: inv.locationId,
                      },
                    },
                    data: {
                      quantity: { decrement: toDeduct },
                      reservedQty: 0, // Clear reserved quantity for delivered orders
                    },
                  });
                  remaining -= toDeduct;
                }
              }
            }
          } else {
            // For PROCESSING/SHIPPED: deduct reserved and quantity
            for (const item of items) {
              const variant = variants.find((v) => v.id === item.variantId);
              if (!variant) continue;
              let remaining = item.quantity;
              for (const inv of variant.inventory) {
                if (remaining <= 0) break;
                const reservedAvailable = Math.max(0, inv.reservedQty || 0);
                const toDeduct = Math.min(
                  remaining,
                  reservedAvailable > 0 ? reservedAvailable : remaining,
                );
                if (toDeduct > 0) {
                  await tx.inventory.update({
                    where: {
                      variantId_locationId: {
                        variantId: variant.id,
                        locationId: inv.locationId,
                      },
                    },
                    data: {
                      reservedQty: {
                        decrement: Math.min(toDeduct, reservedAvailable),
                      },
                      quantity: { decrement: toDeduct },
                    },
                  });
                  remaining -= toDeduct;
                }
              }
              // If still remaining (no reserved on some locations), deduct from any quantity
              if (remaining > 0) {
                for (const inv of variant.inventory) {
                  if (remaining <= 0) break;
                  const available = Math.max(0, inv.quantity || 0);
                  const toDeduct = Math.min(remaining, available);
                  if (toDeduct > 0) {
                    await tx.inventory.update({
                      where: {
                        variantId_locationId: {
                          variantId: variant.id,
                          locationId: inv.locationId,
                        },
                      },
                      data: { quantity: { decrement: toDeduct } },
                    });
                    remaining -= toDeduct;
                  }
                }
              }
            }
          }
        } else if (isReleaseTransition) {
          // Release reserved back (do not change quantity)
          for (const item of items) {
            const variant = variants.find((v) => v.id === item.variantId);
            if (!variant) continue;
            let remaining = item.quantity;
            for (const inv of variant.inventory) {
              if (remaining <= 0) break;
              const reservedAvailable = Math.max(0, inv.reservedQty || 0);
              const toRelease = Math.min(remaining, reservedAvailable);
              if (toRelease > 0) {
                await tx.inventory.update({
                  where: {
                    variantId_locationId: {
                      variantId: variant.id,
                      locationId: inv.locationId,
                    },
                  },
                  data: { reservedQty: { decrement: toRelease } },
                });
                remaining -= toRelease;
              }
            }
          }
        }
      } catch (invErr) {
        console.error("[ORDER STATUS] Inventory adjustment failed:", invErr);
      }

      return updatedOrder;
    });

    // Fetch complete order with relations for email sending
    const completeOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            customerType: true,
          },
        },
        billingAddressRef: true,
        shippingAddressRef: true,
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
      },
    });

    // Reconstruct address objects from denormalized fields
    completeOrder.billingAddress = reconstructAddress(
      completeOrder,
      "billing",
      "billingAddressRef",
    );
    completeOrder.shippingAddress = reconstructAddress(
      completeOrder,
      "shipping",
      "shippingAddressRef",
    );
    delete completeOrder.billingAddressRef;
    delete completeOrder.shippingAddressRef;

    // Automatically create shipment when status changes to SHIPPED
    if (status === "SHIPPED" && existingOrder.status !== "SHIPPED") {
      logger.info(
        "[ORDER STATUS UPDATE] Status changed to SHIPPED, creating shipment automatically",
      );
      try {
        // Only create shipment if one doesn't already exist
        if (!existingOrder.shipmentTrackingNumber) {
          const shipmentResult = await createShipmentForOrder(id);

          // Update order with shipment details
          await prisma.order.update({
            where: { id },
            data: {
              shipmentTrackingNumber:
                shipmentResult.trackingNumber || undefined,
              shipmentRequestStatus: shipmentResult.trackingNumber
                ? "ACCEPTED_BY_SHIPPER"
                : "CREATED",
            },
          });

          logger.info("[ORDER STATUS UPDATE] Shipment created successfully", {
            shipmentId: shipmentResult.shipmentId,
            trackingNumber: shipmentResult.trackingNumber,
            status: shipmentResult.shipmentStatus,
          });

          // Refresh completeOrder with updated tracking info
          const updatedOrder = await prisma.order.findUnique({
            where: { id },
            include: {
              customer: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  customerType: true,
                },
              },
              billingAddressRef: true,
              shippingAddressRef: true,
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
            },
          });
          if (updatedOrder) {
            Object.assign(completeOrder, updatedOrder);
            // Re-reconstruct addresses after refresh
            completeOrder.billingAddress = reconstructAddress(
              completeOrder,
              "billing",
              "billingAddressRef",
            );
            completeOrder.shippingAddress = reconstructAddress(
              completeOrder,
              "shipping",
              "shippingAddressRef",
            );
            delete completeOrder.billingAddressRef;
            delete completeOrder.shippingAddressRef;
          }
        } else {
          logger.info(
            "[ORDER STATUS UPDATE] Order already has tracking number, skipping shipment creation",
          );
        }
      } catch (shipmentError) {
        console.error(
          "[ORDER STATUS UPDATE] Failed to create shipment automatically:",
          shipmentError,
        );
        // Don't fail the status update if shipment creation fails
        // But update the shipment status to indicate failure
        try {
          await prisma.order.update({
            where: { id },
            data: {
              shipmentRequestStatus: "CREATED", // Indicate shipment was attempted but may have issues
            },
          });
        } catch (updateError) {
          logger.error(
            "[ORDER STATUS UPDATE] Failed to update shipment status",
            updateError,
          );
        }
      }
    }

    // Send emails based on status change - only if shipment wasn't just created
    // (shipment creation already sends the email)
    if (
      status === "SHIPPED" &&
      existingOrder.status !== "SHIPPED" &&
      completeOrder.customer?.email &&
      !shipmentCreatedInThisRequest
    ) {
      try {
        const existingShipment = await prisma.shipment.findFirst({
          where: { orderId: completeOrder.id },
        });

        // Only send email if no shipment exists (manual status update)
        if (!existingShipment) {
          logger.info(
            "[ORDER STATUS UPDATE] Attempting to send shipping notification email to",
            { email: completeOrder.customer.email },
          );
          const { sendShippingNotification } = require("../utils/emailService");
          await sendShippingNotification(
            completeOrder,
            completeOrder.customer,
            null,
          ); // shipment is null here
          logger.info(
            "[ORDER STATUS UPDATE] Shipping notification email sent to",
            { email: completeOrder.customer.email },
          );
        } else {
          logger.info(
            "[ORDER STATUS UPDATE] Shipment exists, skipping email (already sent during shipment creation)",
          );
        }
      } catch (emailError) {
        logger.error(
          "[ORDER STATUS UPDATE] Failed to send shipping notification email",
          emailError,
        );
      }
    }

    // If status changed to CANCELLED, send order cancellation email
    if (
      status === "CANCELLED" &&
      existingOrder.status !== "CANCELLED" &&
      completeOrder.customer?.email
    ) {
      console.log(
        "[ORDER STATUS UPDATE] Attempting to send order cancellation email to:",
        completeOrder.customer.email,
      );
      try {
        await sendOrderCancellation(completeOrder, completeOrder.customer);
        logger.info("[ORDER STATUS UPDATE] Order cancellation email sent to", {
          email: completeOrder.customer.email,
        });
      } catch (emailError) {
        logger.error(
          "[ORDER STATUS UPDATE] Failed to send order cancellation email",
          emailError,
        );
      }
    }

    // Check for tier upgrade eligibility when order is delivered
    if (
      status === "DELIVERED" &&
      existingOrder.status !== "DELIVERED" &&
      completeOrder.customer
    ) {
      try {
        await checkAndCreateTierUpgradeNotification(
          completeOrder.customer,
          completeOrder,
        );
      } catch (error) {
        logger.error(
          "[ORDER STATUS UPDATE] Failed to check tier upgrade eligibility",
          error,
        );
      }
    }

    // Trigger Odoo sync when order status changes to SHIPPED, CANCELLED, or DELIVERED
    // This updates Odoo with the new available quantity
    if (
      ["SHIPPED", "CANCELLED", "DELIVERED", "REFUNDED"].includes(status) &&
      existingOrder.status !== status
    ) {
      (async () => {
        try {
          // Get unique product IDs from order items
          const productIds = [
            ...new Set(
              completeOrder.items
                .map((item) => item.variant?.product?.id)
                .filter(Boolean),
            ),
          ];
          const triggerType =
            status === "CANCELLED" || status === "REFUNDED"
              ? "ORDER_CANCELLED"
              : "ORDER_SHIPPED";
          const triggerReason = `Order #${completeOrder.orderNumber} status changed to ${status}`;

          for (const productId of productIds) {
            await queueProductSync(productId, triggerType, triggerReason, {
              orderId: completeOrder.id,
              initiatedBy: "system",
            });
          }
          console.log(
            `[Orders] Queued Odoo sync for ${productIds.length} products (status: ${status})`,
          );
        } catch (odooErr) {
          console.error(
            "[Orders] Failed to queue Odoo sync for status update:",
            odooErr?.message || odooErr,
          );
        }
      })();
    }

    // Notify sales channel webhooks about inventory changes on status transitions
    if (existingOrder.status !== status) {
      const affectedVariantIds = (completeOrder.items || [])
        .map((item) => item.variantId || item.variant?.id)
        .filter(Boolean);
      if (affectedVariantIds.length > 0) {
        notifySalesChannelWebhooks(affectedVariantIds).catch((err) =>
          logger.error("[ORDER STATUS] Webhook notification failed", err),
        );
      }
    }

    res.json({
      success: true,
      message: "Order status updated successfully",
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        updatedAt: order.updatedAt,
      },
    });
  }),
);

// Customer self-service: cancel own order if PENDING
router.post(
  "/:id/cancel",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = req.user;

    if (!user || user.role !== "CUSTOMER" || !user.customerId) {
      return res
        .status(403)
        .json({ success: false, error: "Access denied. Customers only." });
    }

    const existingOrder = await prisma.order.findUnique({ where: { id } });
    if (!existingOrder) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }
    if (existingOrder.customerId !== user.customerId) {
      return res
        .status(403)
        .json({ success: false, error: "Access denied. Not your order." });
    }
    if (existingOrder.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        error: "Only pending orders can be cancelled.",
      });
    }

    const order = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: { status: "CANCELLED" },
      });
      await logOrderAudit({
        orderId: id,
        userId: user.id,
        action: "STATUS_UPDATED",
        details: {
          previousStatus: existingOrder.status,
          newStatus: "CANCELLED",
          note: "Cancelled by customer",
        },
        req,
      });
      return updated;
    });

    return res.json({
      success: true,
      message: "Order cancelled",
      data: { orderId: order.id, status: order.status },
    });
  }),
);

// Add note to order
router.post(
  "/:id/notes",
  requirePermission("ORDERS", "UPDATE"),
  [
    param("id").isString().withMessage("Order ID is required"),
    body("note").notEmpty().withMessage("Note is required"),
    body("isInternal")
      .optional()
      .isBoolean()
      .withMessage("isInternal must be boolean"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { note, isInternal = true } = req.body;

    // Check if order exists
    const existingOrder = await prisma.order.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    // Create note
    const orderNote = await prisma.orderNote.create({
      data: {
        orderId: id,
        userId: req.user.id,
        note,
        isInternal,
      },
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
    });

    res.status(201).json({
      success: true,
      message: "Note added successfully",
      data: orderNote,
    });
  }),
);

// Get order notes
router.get(
  "/:id/notes",
  requirePermission("ORDERS", "READ"),
  [param("id").isString().withMessage("Order ID is required"), validateRequest],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check if order exists
    const existingOrder = await prisma.order.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    // Get notes
    const notes = await prisma.orderNote.findMany({
      where: { orderId: id },
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
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      data: notes,
    });
  }),
);

// Bulk delete orders (must come before /:id route)
router.delete(
  "/bulk-delete",
  authMiddleware,
  requireRole(["ADMIN", "MANAGER"]),
  [
    body("ids").isArray().withMessage("Order IDs must be an array"),
    body("ids.*")
      .isString()
      .withMessage("Each order ID must be a valid string"),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { ids } = req.body;

    if (!ids || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No orders selected for deletion",
      });
    }

    try {
      // Check if any of the orders have been delivered or have payments
      const ordersToDelete = await prisma.order.findMany({
        where: {
          id: { in: ids },
        },
        include: {
          payments: true,
          items: {
            include: {
              variant: {
                include: {
                  inventory: true,
                },
              },
            },
          },
        },
      });

      // Check for delivered orders
      const deliveredOrders = ordersToDelete.filter(
        (order) => order.status === "DELIVERED",
      );

      if (deliveredOrders.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Cannot delete delivered orders: ${deliveredOrders
            .map((o) => o.orderNumber)
            .join(", ")}`,
        });
      }

      // Use transaction to ensure data consistency
      await prisma.$transaction(async (tx) => {
        // Restore inventory for all orders
        for (const order of ordersToDelete) {
          for (const item of order.items) {
            const variant = item.variant;
            if (variant && variant.inventory) {
              for (const inventory of variant.inventory) {
                await tx.inventory.update({
                  where: {
                    variantId_locationId: {
                      variantId: variant.id,
                      locationId: inventory.locationId,
                    },
                  },
                  data: {
                    // Release the reservation
                    reservedQty: {
                      decrement: item.quantity,
                    },
                  },
                });
              }
            }
          }
        }

        // Delete payments first
        await tx.payment.deleteMany({
          where: {
            orderId: { in: ids },
          },
        });

        // Delete order items (foreign key constraint)
        await tx.orderItem.deleteMany({
          where: {
            orderId: { in: ids },
          },
        });

        // Delete order notes
        await tx.orderNote.deleteMany({
          where: {
            orderId: { in: ids },
          },
        });

        // Delete orders
        await tx.order.deleteMany({
          where: {
            id: { in: ids },
          },
        });
      });

      // Queue Odoo sync for affected products (inventory restored on bulk delete)
      try {
        const affectedProductIds = [
          ...new Set(
            ordersToDelete.flatMap((order) =>
              order.items
                .filter((i) => i.variant?.productId)
                .map((i) => i.variant.productId),
            ),
          ),
        ];
        for (const productId of affectedProductIds) {
          queueProductSync(
            productId,
            "INVENTORY_UPDATE",
            "Bulk order delete inventory restore",
            {
              orderIds: ids,
            },
          ).catch((err) =>
            console.error(
              "[ODOO SYNC] Failed to queue after bulk order delete:",
              err.message,
            ),
          );
        }
      } catch (syncErr) {
        console.error(
          "[ODOO SYNC] Error queuing sync after bulk order delete:",
          syncErr.message,
        );
      }

      res.json({
        success: true,
        message: `Successfully deleted ${ids.length} order(s)`,
        deletedCount: ids.length,
      });
    } catch (error) {
      console.error("Bulk delete orders error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete orders",
      });
    }
  }),
);

// Delete order (soft delete)
router.delete(
  "/:id",
  requirePermission("ORDERS", "DELETE"),
  [param("id").isString().withMessage("Order ID is required"), validateRequest],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check if order exists with customer data
    const existingOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        items: {
          include: {
            variant: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    // Cannot delete shipped or delivered orders
    if (["SHIPPED", "DELIVERED"].includes(existingOrder.status)) {
      return res.status(400).json({
        success: false,
        error: "Cannot delete shipped or delivered orders",
      });
    }

    // Cancel order instead of deleting
    await prisma.order.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    // Send order cancellation email
    try {
      await sendOrderCancellation(
        existingOrder,
        existingOrder.customer,
        "Order cancelled by admin",
      );
      console.log(
        `Order cancellation email sent to ${existingOrder.customer.email}`,
      );
    } catch (emailError) {
      console.error("Failed to send order cancellation email:", emailError);
      // Don't fail the order cancellation if email sending fails
    }

    // Create audit log
    await logOrderAudit({
      orderId: id,
      userId: req.user.id,
      action: "ORDER_CANCELLED",
      details: {
        reason: "Order deleted by admin",
        previousStatus: existingOrder.status,
      },
      req,
    });

    res.json({
      success: true,
      message: "Order cancelled successfully",
    });
  }),
);

// Hard delete order (permanently remove from DB)
router.delete(
  "/:id/hard",
  requirePermission("ORDERS", "DELETE"),
  [param("id").isString().withMessage("Order ID is required"), validateRequest],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    // Prevent deletion of delivered orders if business requires; otherwise allow
    // We'll allow deletion for all to match request

    // Fetch order with items and inventory data
    const orderWithItems = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            variant: {
              include: {
                inventory: true,
              },
            },
          },
        },
      },
    });

    await prisma.$transaction(async (tx) => {
      // Restore inventory before deleting
      if (orderWithItems && orderWithItems.items) {
        for (const item of orderWithItems.items) {
          const variant = item.variant;
          if (variant && variant.inventory) {
            for (const inventory of variant.inventory) {
              await tx.inventory.update({
                where: {
                  variantId_locationId: {
                    variantId: variant.id,
                    locationId: inventory.locationId,
                  },
                },
                data: {
                  // Release the reservation
                  reservedQty: {
                    decrement: item.quantity,
                  },
                },
              });
            }
          }
        }
      }

      await tx.orderNote.deleteMany({ where: { orderId: id } });
      await tx.shipment.deleteMany({ where: { orderId: id } });
      await tx.payment.deleteMany({ where: { orderId: id } });
      await tx.transaction.deleteMany({ where: { orderId: id } });
      await tx.promotionUsage.deleteMany({ where: { orderId: id } });
      await tx.auditLog.deleteMany({ where: { orderId: id } });
      await tx.orderItem.deleteMany({ where: { orderId: id } });
      await tx.order.delete({ where: { id } });
    });

    // Queue Odoo sync for affected products (inventory restored)
    try {
      const affectedProductIds = [
        ...new Set(
          (orderWithItems?.items || [])
            .filter((i) => i.variant?.productId)
            .map((i) => i.variant.productId),
        ),
      ];
      for (const productId of affectedProductIds) {
        queueProductSync(
          productId,
          "INVENTORY_UPDATE",
          "Hard delete order inventory restore",
          {
            orderId: id,
          },
        ).catch((err) =>
          console.error(
            "[ODOO SYNC] Failed to queue after hard delete order:",
            err.message,
          ),
        );
      }
    } catch (syncErr) {
      console.error(
        "[ODOO SYNC] Error queuing sync after hard delete order:",
        syncErr.message,
      );
    }

    res.json({ success: true, message: "Order deleted permanently" });
  }),
);

// Bulk delete (cancel) orders
router.post(
  "/bulk-delete",
  requirePermission("ORDERS", "DELETE"),
  [
    body("ids")
      .isArray({ min: 1 })
      .withMessage("ids must be a non-empty array"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { ids } = req.body;

    // Get orders with customer data before cancelling
    const ordersToCancel = await prisma.order.findMany({
      where: { id: { in: ids }, status: { notIn: ["SHIPPED", "DELIVERED"] } },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        items: {
          include: {
            variant: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Only cancel orders that are not shipped or delivered
    const result = await prisma.order.updateMany({
      where: { id: { in: ids }, status: { notIn: ["SHIPPED", "DELIVERED"] } },
      data: { status: "CANCELLED" },
    });

    // Send cancellation emails for each cancelled order
    for (const order of ordersToCancel) {
      try {
        await sendOrderCancellation(
          order,
          order.customer,
          "Order cancelled by admin",
        );
        console.log(
          `Order cancellation email sent to ${order.customer.email} for order ${order.orderNumber}`,
        );
      } catch (emailError) {
        console.error(
          `Failed to send order cancellation email for order ${order.orderNumber}:`,
          emailError,
        );
        // Continue with other emails even if one fails
      }
    }

    res.json({ success: true, cancelled: result.count });
  }),
);

// Bulk import orders
router.post(
  "/bulk-import",
  requirePermission("ORDERS", "CREATE"),
  [
    body("orders")
      .isArray({ min: 1 })
      .withMessage("orders must be a non-empty array"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { orders } = req.body;
    let created = 0;
    await prisma.$transaction(async (tx) => {
      for (const o of orders) {
        if (!o.customerId || !Array.isArray(o.items) || o.items.length === 0)
          continue;
        const items = o.items.filter((i) => i.variantId && i.quantity);
        if (items.length === 0) continue;
        await tx.order.create({
          data: {
            customerId: o.customerId,
            billingAddressId: o.billingAddressId,
            shippingAddressId: o.shippingAddressId,
            status: o.status || "PENDING",
            items: {
              create: items.map((i) => ({
                variantId: i.variantId,
                quantity: i.quantity,
                unitPrice: i.unitPrice || 0,
              })),
            },
          },
        });
        created++;
      }
    });
    res.json({ success: true, created });
  }),
);

// Customer-initiated cancellation request
router.post(
  "/:id/request-cancellation",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Get order with customer data
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        items: {
          include: {
            variant: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }
    if (order.customerId !== req.user.id && req.user.role !== "ADMIN") {
      return res
        .status(403)
        .json({ success: false, error: "Not authorized to cancel this order" });
    }
    // Only allow cancellation if order is not already cancelled/refunded/delivered
    if (["CANCELLED", "REFUNDED", "DELIVERED"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        error: "Order cannot be cancelled at this stage",
      });
    }

    // Mark order as having a cancellation request
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status: "ON_HOLD" }, // or add a cancellationRequest: true field if you want
    });

    // Optionally, add an order note
    await prisma.orderNote.create({
      data: {
        orderId: id,
        userId: req.user.id,
        note: "Customer requested cancellation",
        isInternal: false,
      },
    });

    // Send cancellation request notification email
    try {
      await sendOrderCancellation(
        order,
        order.customer,
        "Customer requested cancellation",
      );
      console.log(
        `Order cancellation request email sent to ${order.customer.email}`,
      );
    } catch (emailError) {
      console.error(
        "Failed to send order cancellation request email:",
        emailError,
      );
      // Don't fail the cancellation request if email sending fails
    }

    res.json({ success: true, data: updatedOrder });
  }),
);

// Initiate a refund for an order (admin only)
router.post(
  "/:id/refund",
  requireRole(["ADMIN"]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { amount, reason } = req.body;
    // Find the order and payment
    const order = await prisma.order.findUnique({
      where: { id },
      include: { payments: true },
    });
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }
    const payment = order.payments[0];
    if (!payment) {
      return res
        .status(400)
        .json({ success: false, error: "No payment found for this order" });
    }
    // Create refund record
    const refund = await prisma.refund.create({
      data: {
        paymentId: payment.id,
        amount,
        reason,
        status: "PENDING",
      },
    });
    // Log audit
    await logOrderAudit({
      orderId: id,
      userId: req.user.id,
      action: "REFUND_INITIATED",
      details: { amount, reason, refundId: refund.id },
      req,
    });
    res.json({ success: true, data: refund });
  }),
);
// Update refund status (admin only)
router.put(
  "/refunds/:refundId/status",
  requireRole(["ADMIN"]),
  asyncHandler(async (req, res) => {
    const { refundId } = req.params;
    const { status } = req.body;
    const refund = await prisma.refund.update({
      where: { id: refundId },
      data: { status },
    });
    // Log audit
    await logOrderAudit({
      orderId: refund.payment.orderId,
      userId: req.user.id,
      action: "REFUND_STATUS_UPDATE",
      details: { refundId, newStatus: status },
      req,
    });
    res.json({ success: true, data: refund });
  }),
);

// Delete single order (ADMIN only)
router.delete(
  "/:id",
  requireRole(["ADMIN"]),
  [param("id").isString().withMessage("Order ID is required"), validateRequest],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check if order exists
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        payments: true,
        refunds: true,
        auditLogs: true,
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    // Delete in transaction to ensure data integrity
    await prisma.$transaction(async (tx) => {
      // Delete audit logs
      await tx.auditLog.deleteMany({
        where: { orderId: id },
      });

      // Delete refunds
      await tx.refund.deleteMany({
        where: { paymentId: { in: order.payments.map((p) => p.id) } },
      });

      // Delete payments
      await tx.payment.deleteMany({
        where: { orderId: id },
      });

      // Delete order items
      await tx.orderItem.deleteMany({
        where: { orderId: id },
      });

      // Delete the order
      await tx.order.delete({
        where: { id },
      });
    });

    res.json({
      success: true,
      message: `Order ${order.orderNumber} deleted successfully`,
    });
  }),
);

// Delete all orders (ADMIN only) - DANGEROUS OPERATION
router.delete(
  "/admin/delete-all-orders",
  requireRole(["ADMIN"]),
  asyncHandler(async (req, res) => {
    try {
      // Get count before deletion
      const orderCount = await prisma.order.count();

      if (orderCount === 0) {
        return res.json({
          success: true,
          message: "No orders to delete",
          deletedCount: 0,
        });
      }

      // Delete all order-related data in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Delete audit logs
        const auditCount = await tx.auditLog.deleteMany({});

        // Delete refunds (need to get payment IDs first)
        const payments = await tx.payment.findMany({ select: { id: true } });
        const refundCount = await tx.refund.deleteMany({
          where: { paymentId: { in: payments.map((p) => p.id) } },
        });

        // Delete payments
        const paymentCount = await tx.payment.deleteMany({});

        // Delete order items
        const itemCount = await tx.orderItem.deleteMany({});

        // Delete orders
        const orderDeleteResult = await tx.order.deleteMany({});

        return {
          orders: orderDeleteResult.count,
          items: itemCount.count,
          payments: paymentCount.count,
          refunds: refundCount.count,
          auditLogs: auditCount.count,
        };
      });

      res.json({
        success: true,
        message: `Successfully deleted all orders and related data`,
        deletedCount: result,
      });
    } catch (error) {
      console.error("Error deleting all orders:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete orders",
        details: error.message,
      });
    }
  }),
);

// Add audit log utility
async function logOrderAudit({ orderId, userId, action, details, req }) {
  await prisma.auditLog.create({
    data: {
      orderId,
      userId: userId || null,
      action,
      details,
      ipAddress: req?.ip || null,
      userAgent: req?.headers["user-agent"] || null,
    },
  });
}

// Bulk delete orders
router.delete(
  "/bulk-delete",
  authMiddleware,
  requireRole(["ADMIN", "MANAGER"]),
  [
    body("ids").isArray().withMessage("Order IDs must be an array"),
    body("ids.*").isUUID().withMessage("Each order ID must be a valid UUID"),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { ids } = req.body;

    if (!ids || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No orders selected for deletion",
      });
    }

    try {
      // Check if any of the orders have been delivered or have payments
      const ordersToDelete = await prisma.order.findMany({
        where: {
          id: { in: ids },
        },
        include: {
          payments: true,
          items: {
            include: {
              variant: {
                include: {
                  inventory: true,
                },
              },
            },
          },
        },
      });

      // Check for delivered orders or orders with payments
      const deliveredOrders = ordersToDelete.filter(
        (order) => order.status === "DELIVERED",
      );
      const ordersWithPayments = ordersToDelete.filter(
        (order) => order.payments.length > 0,
      );

      if (deliveredOrders.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Cannot delete delivered orders: ${deliveredOrders
            .map((o) => o.orderNumber)
            .join(", ")}`,
        });
      }

      if (ordersWithPayments.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Cannot delete orders with payments: ${ordersWithPayments
            .map((o) => o.orderNumber)
            .join(", ")}`,
        });
      }

      // Use transaction to ensure data consistency
      await prisma.$transaction(async (tx) => {
        // Release reserved inventory for all orders
        for (const order of ordersToDelete) {
          for (const item of order.items) {
            const variant = item.variant;
            if (variant && variant.inventory) {
              for (const inventory of variant.inventory) {
                await tx.inventory.update({
                  where: {
                    variantId_locationId: {
                      variantId: variant.id,
                      locationId: inventory.locationId,
                    },
                  },
                  data: {
                    reservedQty: {
                      decrement: item.quantity,
                    },
                  },
                });
              }
            }
          }
        }

        // Delete order items first (foreign key constraint)
        await tx.orderItem.deleteMany({
          where: {
            orderId: { in: ids },
          },
        });

        // Delete order notes
        await tx.orderNote.deleteMany({
          where: {
            orderId: { in: ids },
          },
        });

        // Delete orders
        await tx.order.deleteMany({
          where: {
            id: { in: ids },
          },
        });
      });

      // Queue Odoo sync for affected products (inventory restored on bulk hard delete)
      try {
        const affectedProductIds = [
          ...new Set(
            ordersToDelete.flatMap((order) =>
              order.items
                .filter((i) => i.variant?.productId)
                .map((i) => i.variant.productId),
            ),
          ),
        ];
        for (const productId of affectedProductIds) {
          queueProductSync(
            productId,
            "INVENTORY_UPDATE",
            "Bulk hard delete orders inventory restore",
            {
              orderIds: ids,
            },
          ).catch((err) =>
            console.error(
              "[ODOO SYNC] Failed to queue after bulk hard delete orders:",
              err.message,
            ),
          );
        }
      } catch (syncErr) {
        console.error(
          "[ODOO SYNC] Error queuing sync after bulk hard delete orders:",
          syncErr.message,
        );
      }

      res.json({
        success: true,
        message: `Successfully deleted ${ids.length} order(s)`,
        deletedCount: ids.length,
      });
    } catch (error) {
      console.error("Bulk delete orders error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete orders",
      });
    }
  }),
);

// Tier upgrade notification function
async function checkAndCreateTierUpgradeNotification(customer, order) {
  try {
    // Only check for B2B customers who might qualify for B2C (Tier 1)
    if (customer.customerType !== "B2B") {
      return;
    }

    // Calculate total lifetime spending for this customer
    const totalSpending = await prisma.order.aggregate({
      where: {
        customerId: customer.id,
        status: "DELIVERED",
      },
      _sum: {
        totalAmount: true,
      },
    });

    const lifetimeSpending = Number(totalSpending._sum.totalAmount || 0);

    // Tier upgrade logic temporarily disabled per user request
    /*
    // Define tier upgrade thresholds (configurable)
    const TIER_UPGRADE_THRESHOLD = 5000; // $5,000 threshold for B2B to B2C upgrade

    if (lifetimeSpending >= TIER_UPGRADE_THRESHOLD) {
      // Check if notification already exists for this customer
      const existingNotification = await prisma.notification.findFirst({
        where: {
          type: 'TIER_UPGRADE_ELIGIBLE',
          customerId: customer.id,
          isRead: false
        }
      });

      if (!existingNotification) {
        // Find sales reps assigned to this customer
        const salesRepAssignments = await prisma.salesRepCustomerAssignment.findMany({
          where: {
            customerId: customer.id
          },
          include: {
            salesRep: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true
                  }
                }
              }
            }
          }
        });

        // Create notifications for each assigned sales rep
        for (const assignment of salesRepAssignments) {
          await prisma.notification.create({
            data: {
              type: 'TIER_UPGRADE_ELIGIBLE',
              title: 'Customer Eligible for Tier Upgrade',
              message: `Your assigned customer ${customer.firstName} ${customer.lastName} (${customer.email}) has reached $${lifetimeSpending.toLocaleString()} in lifetime spending and is eligible for Tier 1 upgrade.`,
              customerId: customer.id,
              orderId: order.id,
              priority: 'HIGH',
              isRead: false,
              metadata: {
                customerName: `${customer.firstName} ${customer.lastName}`,
                customerEmail: customer.email,
                lifetimeSpending: lifetimeSpending,
                threshold: TIER_UPGRADE_THRESHOLD,
                currentTier: 'Tier 2',
                suggestedTier: 'Tier 1',
                salesRepId: assignment.salesRep.user.id,
                salesRepName: `${assignment.salesRep.user.firstName} ${assignment.salesRep.user.lastName}`
              }
            }
          });
        }

        logger.info(`[TIER UPGRADE] Created upgrade notifications for customer ${customer.email} with $${lifetimeSpending} lifetime spending`, { notifiedCount: salesRepAssignments.length });
      }
    }
    */
  } catch (error) {
    logger.error(
      "[TIER UPGRADE] Error checking tier upgrade eligibility",
      error,
    );
  }
}

const { queueReport } = require("../services/reportQueue");

/**
 * Send orders report via email
 */
router.post(
  "/email-report",
  requirePermission("ORDERS", "READ"),
  [
    body("email").isEmail().withMessage("Invalid email address"),
    body("dateFrom").optional().isISO8601(),
    body("dateTo").optional().isISO8601(),
    body("usePSTFilter").optional().isString(),
    body("filters").optional().isObject(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { email, dateFrom, dateTo, usePSTFilter, filters = {} } = req.body;

    // Delegate to background queue
    const result = await queueReport({
      type: "ORDERS",
      email,
      filters: {
        ...filters,
        dateFrom,
        dateTo,
        usePSTFilter: usePSTFilter === "true" || usePSTFilter === true
      },
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
      }
    });

    res.json(result);
  }),
);

module.exports = router;
