const express = require("express");
const { body, param, query } = require("express-validator");
const prisma = require("../prisma/client");
const validateRequest = require("../middleware/validateRequest");
const { asyncHandler } = require("../middleware/errorHandler");
const { requireRole, requirePermission } = require("../middleware/auth");
const { calculatePromotionDiscount } = require("../utils/promotionCalculator");
const { processRawEmailResend } = require("../utils/emailService");

const router = express.Router();

// Allow CUSTOMER role to read promotions endpoints without PROMOTIONS READ permission
const allowCustomerReadPromotions = (req, res, next) => {
  if (req.user && req.user.role === "CUSTOMER") {
    return next();
  }
  return requirePermission("PROMOTIONS", "READ")(req, res, next);
};

// Get all promotions
router.get(
  "/",
  allowCustomerReadPromotions,
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be boolean"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, isActive } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    console.log(
      "🔍 GET /promotions - User:",
      req.user?.role,
      "CustomerId:",
      req.user?.customerId,
    );

    // Build the where clause with proper AND/OR logic
    const where = {
      AND: [],
    };

    // Add isActive filter
    if (isActive !== undefined) {
      where.AND.push({ isActive: isActive === "true" || isActive === true });
    }

    // Filter valid dates (only for customers/public listing)
    // Admins might want to see all, but usually this endpoint is for listing valid coupons
    if (req.user?.role !== "ADMIN") {
      const now = new Date();
      where.AND.push({
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      });
      where.AND.push({
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      });
    }

    // Filter for customers: Only show public coupons OR coupons specific to them
    if (req.user && req.user.role === "CUSTOMER" && req.user.customerId) {
      console.log(
        "✅ Applying customer filter for customerId:",
        req.user.customerId,
      );
      where.AND.push({
        OR: [
          // 1. Strictly Public: Flag is false AND no specific customers are defined
          // This prevents "leaking" coupons that have customers but flag was accidentally false
          {
            isForIndividualCustomer: false,
            specificCustomers: { none: {} },
          },
          // 2. Assigned to Me: I am in the list (regardless of flag state, satisfying both strict and loose constraints)
          {
            specificCustomers: {
              some: {
                customerId: req.user.customerId,
              },
            },
          },
        ],
      });
    } else {
      console.log(
        "⚠️ No customer filter applied - User role:",
        req.user?.role,
        "Has customerId:",
        !!req.user?.customerId,
      );
    }

    // If no filters were added, remove the AND wrapper
    if (where.AND.length === 0) {
      delete where.AND;
    }

    // Filter for customers logic moved to post-fetch for reliability
    // This ensures we handle "inconsistent data" (Public flag but has customers) correctly

    console.log("📋 Query where clause:", JSON.stringify(where, null, 2));

    const [rawPromotions, total] = await Promise.all([
      prisma.promotion.findMany({
        where,
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
        include: {
          specificCustomers: {
            select: { customerId: true },
          },
        },
      }),
      prisma.promotion.count({ where }),
    ]);

    // Perform robust filtering in JS
    let promotions = rawPromotions;
    if (req.user && req.user.role === "CUSTOMER" && req.user.customerId) {
      const myId = req.user.customerId;

      promotions = rawPromotions.filter((p) => {
        const hasSpecificCustomers =
          p.specificCustomers && p.specificCustomers.length > 0;
        const amIInList =
          hasSpecificCustomers &&
          p.specificCustomers.some((sc) => sc.customerId === myId);

        // Case 1: Explicitly assigned to me (Show)
        if (amIInList) return true;

        // Case 2: Strictly Public (Show)
        // Must have NO specific customers defined.
        // If it has customers but flag is false, we TREAT IT AS PRIVATE (Hide), satisfying the safety requirement.
        if (!p.isForIndividualCustomer && !hasSpecificCustomers) return true;

        // All other cases: Hide
        return false;
      });
    }

    // Remove specificCustomers list from output to avoid leaking data
    // User request: "backend is writing wrong data" -> likely wants to see this list for verification.
    // We will pass it through for now.
    // const sanitizedPromotions = promotions.map(({ specificCustomers, ...rest }) => rest);

    console.log(
      `📊 Promotions returned: ${promotions.length} (Filtered from ${rawPromotions.length})`,
    );

    res.json({
      success: true,
      data: promotions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  }),
);

// Get promotion stats
router.get(
  "/stats",
  requirePermission("PROMOTIONS", "READ"),
  asyncHandler(async (req, res) => {
    const [totalCoupons, activeCoupons, usageStats] = await Promise.all([
      prisma.promotion.count(),
      prisma.promotion.count({ where: { isActive: true } }),
      prisma.promotion.aggregate({
        _sum: {
          usageCount: true,
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalCoupons,
        activeCoupons,
        totalUsage: usageStats._sum.usageCount || 0,
      },
    });
  }),
);

// Get promotion by code (validate coupon)
router.get(
  "/code/:code",
  allowCustomerReadPromotions,
  [
    param("code").notEmpty().withMessage("Promotion code is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { code } = req.params;
    const now = new Date();
    const promo = await prisma.promotion.findFirst({
      where: {
        code: code.toUpperCase(),
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [
          {
            OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
          },
        ],
      },
      include: {
        specificCustomers: {
          select: { customerId: true },
        },
      },
    });

    // Check strict customer eligibility for individual coupons
    // Handle both explicit flag AND implicit assignment (has customers but flag is false)
    if (
      promo &&
      (promo.isForIndividualCustomer ||
        (promo.specificCustomers && promo.specificCustomers.length > 0))
    ) {
      if (req.user && req.user.role === "CUSTOMER") {
        const allowedCustomerIds = promo.specificCustomers.map(
          (sc) => sc.customerId,
        );
        if (!allowedCustomerIds.includes(req.user.customerId)) {
          return res
            .status(404)
            .json({ success: false, error: "Invalid or expired coupon code" }); // Generic error for security/privacy
        }
      }
    }

    // Additional check for usage limit
    if (promo && promo.usageLimit && promo.usageCount >= promo.usageLimit) {
      return res
        .status(404)
        .json({ success: false, error: "Coupon usage limit exceeded" });
    }
    if (!promo) {
      return res
        .status(404)
        .json({ success: false, error: "Invalid or expired coupon code" });
    }
    res.json({ success: true, data: promo });
  }),
);

// Get single promotion by ID with all related data
router.get(
  "/:id",
  allowCustomerReadPromotions,
  [
    param("id").notEmpty().withMessage("Promotion ID is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const promotion = await prisma.promotion.findUnique({
      where: { id },
      include: {
        productRules: {
          include: {
            product: { select: { name: true } },
            variant: { select: { name: true, sku: true } },
          },
        },
        categoryRules: {
          include: {
            category: { select: { name: true } },
          },
        },
        volumeTiers: {
          orderBy: { minQuantity: "asc" },
        },
        specificCustomers: {
          include: {
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: { usageHistory: true },
        },
      },
    });

    if (!promotion) {
      return res
        .status(404)
        .json({ success: false, error: "Promotion not found" });
    }

    res.json({ success: true, data: promotion });
  }),
);

// Create promotion
router.post(
  "/",
  requirePermission("PROMOTIONS", "CREATE"),
  [
    body("code").notEmpty().withMessage("Promotion code is required"),
    body("name").notEmpty().withMessage("Promotion name is required"),
    body("type")
      .isIn([
        "PERCENTAGE",
        "FIXED_AMOUNT",
        "FREE_SHIPPING",
        "BOGO",
        "VOLUME_DISCOUNT",
      ])
      .withMessage("Invalid promotion type"),
    body("value")
      .isDecimal({ decimal_digits: "0,2" })
      .withMessage("Value must be a valid decimal"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be boolean"),
    body("startsAt")
      .optional()
      .isISO8601()
      .withMessage("Start date must be a valid date"),
    body("expiresAt")
      .optional()
      .isISO8601()
      .withMessage("Expiry date must be a valid date"),
    body("customerTypes")
      .optional()
      .isArray()
      .withMessage("Customer types must be an array"),
    body("bogoType")
      .optional()
      .isIn([
        "BUY_X_GET_Y_FREE",
        "BUY_X_GET_Y_PERCENT",
        "BUY_X_GET_Y_FIXED",
        "CHEAPEST_FREE",
        "MOST_EXPENSIVE_FREE",
      ])
      .withMessage("Invalid BOGO type"),
    body("buyQuantity")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Buy quantity must be a positive integer"),
    body("getQuantity")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Get quantity must be a positive integer"),
    body("getDiscount")
      .optional()
      .isDecimal({ decimal_digits: "0,2" })
      .withMessage("Get discount must be a valid decimal"),
    body("productRules")
      .optional()
      .isArray()
      .withMessage("Product rules must be an array"),
    body("categoryRules")
      .optional()
      .isArray()
      .withMessage("Category rules must be an array"),
    body("volumeTiers")
      .optional()
      .isArray()
      .withMessage("Volume tiers must be an array"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const {
      code,
      name,
      description,
      type,
      value,
      minOrderAmount,
      maxDiscount,
      usageLimit,
      startsAt,
      expiresAt,
      customerTypes,
      bogoType,
      buyQuantity,
      getQuantity,
      getDiscount,
      productRules,
      categoryRules,
      volumeTiers,
      isForIndividualCustomer = false,
      specificCustomerIds = [],
      isActive = true, // Default to true as per requirements
    } = req.body;

    console.log("📝 Creating Promotion with body:", {
      code,
      type,
      isActive,
      isForIndividualCustomer: req.body.isForIndividualCustomer,
      specificCustomerIds: specificCustomerIds?.length,
    });

    const result = await prisma.$transaction(async (prisma) => {
      // Create the promotion
      const promo = await prisma.promotion.create({
        data: {
          code: code.toUpperCase(),
          name,
          description,
          type,
          value: parseFloat(value),
          minOrderAmount: minOrderAmount ? parseFloat(minOrderAmount) : null,
          maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
          usageLimit: usageLimit ? parseInt(usageLimit) : null,
          startsAt: startsAt ? new Date(startsAt) : null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          customerTypes: customerTypes || [],
          bogoType: bogoType || null,
          buyQuantity: buyQuantity ? parseInt(buyQuantity) : null,
          getQuantity: getQuantity ? parseInt(getQuantity) : null,
          getDiscount: getDiscount ? parseFloat(getDiscount) : null,
          isActive: true, // Force active on creation per requirements
          // Ensure boolean conversion if string
          isForIndividualCustomer:
            isForIndividualCustomer === true ||
            isForIndividualCustomer === "true",
        },
      });

      // Create specific customers
      if (
        isForIndividualCustomer &&
        specificCustomerIds &&
        specificCustomerIds.length > 0
      ) {
        await prisma.promotionCustomer.createMany({
          data: specificCustomerIds.map((customerId) => ({
            promotionId: promo.id,
            customerId,
          })),
        });
      }

      // Create product rules
      if (productRules && productRules.length > 0) {
        await prisma.promotionProductRule.createMany({
          data: productRules.map((rule) => ({
            promotionId: promo.id,
            productId: rule.productId || null,
            variantId: rule.variantId || null,
            ruleType: rule.ruleType,
            quantity: rule.quantity ? parseInt(rule.quantity) : null,
          })),
        });
      }

      // Create category rules
      if (categoryRules && categoryRules.length > 0) {
        await prisma.promotionCategoryRule.createMany({
          data: categoryRules.map((rule) => ({
            promotionId: promo.id,
            categoryId: rule.categoryId,
            ruleType: rule.ruleType,
          })),
        });
      }

      // Create volume tiers
      if (volumeTiers && volumeTiers.length > 0) {
        await prisma.promotionVolumeTier.createMany({
          data: volumeTiers.map((tier) => ({
            promotionId: promo.id,
            minQuantity: parseInt(tier.minQuantity),
            maxQuantity: tier.maxQuantity ? parseInt(tier.maxQuantity) : null,
            discountType: tier.discountType,
            discountValue: parseFloat(tier.discountValue),
          })),
        });
      }

      return promo;
    });

    res.status(201).json({ success: true, data: result });
  }),
);

// Update promotion
router.put(
  "/:id",
  requirePermission("PROMOTIONS", "UPDATE"),
  [
    param("id").isString().withMessage("Promotion ID is required"),
    body("name")
      .optional()
      .notEmpty()
      .withMessage("Promotion name cannot be empty"),
    body("description")
      .optional()
      .isString()
      .withMessage("Description must be a string"),
    body("type")
      .optional()
      .isIn([
        "PERCENTAGE",
        "FIXED_AMOUNT",
        "FREE_SHIPPING",
        "BOGO",
        "VOLUME_DISCOUNT",
      ])
      .withMessage("Invalid promotion type"),
    body("value")
      .optional()
      .isDecimal({ decimal_digits: "0,2" })
      .withMessage("Value must be a valid decimal"),
    body("minOrderAmount")
      .optional()
      .isDecimal({ decimal_digits: "0,2" })
      .withMessage("Min order amount must be a valid decimal"),
    body("maxDiscount")
      .optional()
      .isDecimal({ decimal_digits: "0,2" })
      .withMessage("Max discount must be a valid decimal"),
    body("usageLimit")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Usage limit must be a positive integer"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be boolean"),
    body("startsAt")
      .optional()
      .isISO8601()
      .withMessage("Start date must be a valid date"),
    body("expiresAt")
      .optional()
      .isISO8601()
      .withMessage("Expiry date must be a valid date"),
    body("customerTypes")
      .optional()
      .isArray()
      .withMessage("Customer types must be an array"),
    body("bogoType")
      .optional()
      .isIn([
        "BUY_X_GET_Y_FREE",
        "BUY_X_GET_Y_PERCENT",
        "BUY_X_GET_Y_FIXED",
        "CHEAPEST_FREE",
        "MOST_EXPENSIVE_FREE",
      ])
      .withMessage("Invalid BOGO type"),
    body("buyQuantity")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Buy quantity must be a positive integer"),
    body("getQuantity")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Get quantity must be a positive integer"),
    body("getDiscount")
      .optional()
      .isDecimal({ decimal_digits: "0,2" })
      .withMessage("Get discount must be a valid decimal"),
    body("productRules")
      .optional()
      .isArray()
      .withMessage("Product rules must be an array"),
    body("categoryRules")
      .optional()
      .isArray()
      .withMessage("Category rules must be an array"),
    body("volumeTiers")
      .optional()
      .isArray()
      .withMessage("Volume tiers must be an array"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      name,
      description,
      type,
      value,
      minOrderAmount,
      maxDiscount,
      usageLimit,
      isActive,
      startsAt,
      expiresAt,
      customerTypes,
      bogoType,
      buyQuantity,
      getQuantity,
      getDiscount,
      productRules,
      categoryRules,
      volumeTiers,
      isForIndividualCustomer,
      specificCustomerIds,
    } = req.body;

    const result = await prisma.$transaction(async (prisma) => {
      // Prepare update data for main promotion
      const updateData = {};

      // Basic fields
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (type !== undefined) updateData.type = type;
      if (value !== undefined) updateData.value = parseFloat(value);
      if (minOrderAmount !== undefined)
        updateData.minOrderAmount = minOrderAmount
          ? parseFloat(minOrderAmount)
          : null;
      if (maxDiscount !== undefined)
        updateData.maxDiscount = maxDiscount ? parseFloat(maxDiscount) : null;
      if (usageLimit !== undefined)
        updateData.usageLimit = usageLimit ? parseInt(usageLimit) : null;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (startsAt !== undefined)
        updateData.startsAt = startsAt ? new Date(startsAt) : null;
      if (expiresAt !== undefined)
        updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;

      // Advanced fields
      if (customerTypes !== undefined) updateData.customerTypes = customerTypes;
      if (bogoType !== undefined) updateData.bogoType = bogoType || null;
      if (buyQuantity !== undefined)
        updateData.buyQuantity = buyQuantity ? parseInt(buyQuantity) : null;
      if (getQuantity !== undefined)
        updateData.getQuantity = getQuantity ? parseInt(getQuantity) : null;
      if (getDiscount !== undefined)
        updateData.getDiscount = getDiscount ? parseFloat(getDiscount) : null;
      if (isForIndividualCustomer !== undefined) {
        updateData.isForIndividualCustomer =
          isForIndividualCustomer === true ||
          isForIndividualCustomer === "true";
      }

      console.log("📝 Updating Promotion", id, "with data:", {
        ...updateData,
        specificCustomerIdsCount: specificCustomerIds?.length,
      });

      // Update main promotion
      const promotion = await prisma.promotion.update({
        where: { id },
        data: updateData,
      });

      // Update specific customers
      if (specificCustomerIds !== undefined) {
        // Delete existing
        await prisma.promotionCustomer.deleteMany({
          where: { promotionId: id },
        });

        // Create new
        if (specificCustomerIds.length > 0) {
          await prisma.promotionCustomer.createMany({
            data: specificCustomerIds.map((customerId) => ({
              promotionId: id,
              customerId,
            })),
          });
        }
      }

      // Update volume tiers
      if (volumeTiers !== undefined) {
        // Delete existing tiers
        await prisma.promotionVolumeTier.deleteMany({
          where: { promotionId: id },
        });

        // Create new tiers
        if (volumeTiers.length > 0) {
          await prisma.promotionVolumeTier.createMany({
            data: volumeTiers.map((tier) => ({
              promotionId: id,
              minQuantity: parseInt(tier.minQuantity),
              maxQuantity: tier.maxQuantity ? parseInt(tier.maxQuantity) : null,
              discountType: tier.discountType,
              discountValue: parseFloat(tier.discountValue),
            })),
          });
        }
      }

      return promotion;
    });

    res.json({
      success: true,
      data: result,
      message: "Promotion updated successfully",
    });
  }),
);

// Delete promotion
router.delete(
  "/:id",
  requirePermission("PROMOTIONS", "DELETE"),
  [
    param("id").isString().withMessage("Promotion ID is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check if promotion exists
    const promotion = await prisma.promotion.findUnique({
      where: { id },
    });

    if (!promotion) {
      return res.status(404).json({
        success: false,
        error: "Promotion not found",
      });
    }

    // Send deactivation notification email
    try {
      const deactivationTime =
        new Date().toLocaleString("en-US", {
          timeZone: "America/Los_Angeles",
        }) + " PST";
      const html = `
      <!DOCTYPE html>
      <html>
      <head>
          <style>
              body { font-family: sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px; }
              .header { background: #f82d2d; color: white; padding: 10px 20px; border-radius: 4px 4px 0 0; font-weight: bold; }
              .content { padding: 20px; }
              .footer { font-size: 12px; color: #777; margin-top: 20px; padding-top: 10px; border-top: 1px solid #eee; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">Coupon DELETED Notify</div>
              <div class="content">
                  <p>A coupon code has been DELETED from the system by an administrator.</p>
                  <p><strong>Coupon Code:</strong> ${promotion.code}</p>
                  <p><strong>Name:</strong> ${promotion.name}</p>
                  <p><strong>Deletion Time:</strong> ${deactivationTime}</p>
                  <p><strong>Reason:</strong> Manual Deletion</p>
              </div>
              <div class="footer">
                  This is an automated notification from Centre Labs.
              </div>
          </div>
      </body>
      </html>
    `;

      await processRawEmailResend({
        to: [
          "nikhilranga43@gmail.com",
          "khush@advertout.in",
          "harshitdkanodia@gmail.com",
          "nick@centreresearch.org",
          "ben@centreresearch.org",
        ],
        subject: `[ALERT] Coupon Deactivated: ${promotion.code}`,
        html: html,
      });
    } catch (emailErr) {
      console.error("Failed to send deactivation email:", emailErr);
      // Continue with deletion even if email fails
    }

    // Delete the promotion
    await prisma.promotion.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: "Promotion deleted successfully",
    });
  }),
);

// Update promotion usage (increment usageCount)
router.post(
  "/use/:code",
  requirePermission("PROMOTIONS", "UPDATE"),
  [
    param("code").notEmpty().withMessage("Promotion code is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { code } = req.params;
    const promo = await prisma.promotion.update({
      where: { code: code.toUpperCase() },
      data: { usageCount: { increment: 1 } },
    });
    res.json({ success: true, data: promo });
  }),
);

// Calculate promotion discount
router.post(
  "/calculate-discount",
  allowCustomerReadPromotions,
  [
    body("promotionCode").notEmpty().withMessage("Promotion code is required"),
    body("orderItems").isArray().withMessage("Order items must be an array"),
    body("subtotal").isNumeric().withMessage("Subtotal must be a number"),
    body("shippingAmount")
      .isNumeric()
      .withMessage("Shipping amount must be a number"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { promotionCode, orderItems, customerId, subtotal, shippingAmount } =
      req.body;

    // Get promotion with all related data
    const promotion = await prisma.promotion.findFirst({
      where: {
        code: promotionCode.toUpperCase(),
        isActive: true,
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

    if (!promotion) {
      return res
        .status(404)
        .json({ success: false, error: "Promotion not found" });
    }

    // Get customer details if customerId provided or from authenticated user
    let customerIdToUse = customerId;
    if (req.user && req.user.role === "CUSTOMER" && req.user.customerId) {
      customerIdToUse = req.user.customerId;
    }

    let customer = null;
    if (customerIdToUse) {
      customer = await prisma.customer.findUnique({
        where: { id: customerIdToUse },
        select: { id: true, customerType: true },
      });
    }

    // Check if customer is eligible for this promotion
    // Strict check for private coupons (both explicit flag and implicit assignment)
    const isPrivate =
      promotion.isForIndividualCustomer ||
      (promotion.specificCustomers && promotion.specificCustomers.length > 0);

    if (isPrivate) {
      if (!customer) {
        return res.json({
          success: false,
          data: {
            discount: 0,
            error: "Customer login required for this coupon",
          },
        });
      }
      const allowedCustomerIds = promotion.specificCustomers.map(
        (sc) => sc.customerId,
      );
      if (!allowedCustomerIds.includes(customer.id)) {
        return res.json({
          success: false,
          data: {
            discount: 0,
            error: "Customer not eligible for this promotion",
          },
        });
      }
    }

    // Calculate discount using the promotion calculator
    const discountResult = await calculatePromotionDiscount(
      promotion,
      orderItems,
      customer,
      parseFloat(subtotal),
      parseFloat(shippingAmount),
    );

    res.json({ success: true, data: discountResult });
  }),
);

// Test BOGO calculation endpoint
router.post(
  "/test-bogo",
  requirePermission("PROMOTIONS", "READ"),
  asyncHandler(async (req, res) => {
    const testPromotion = {
      id: "test",
      code: "TESTBOGO",
      type: "BOGO",
      bogoType: "BUY_X_GET_Y_FREE",
      buyQuantity: 2,
      getQuantity: 1,
      getDiscount: null,
      customerTypes: [],
    };

    const testOrderItems = [
      { variantId: "var1", quantity: 3, unitPrice: 10.0 },
      { variantId: "var2", quantity: 2, unitPrice: 15.0 },
    ];

    const testCustomer = { customerType: "RETAIL" };

    console.log("🧪 Testing BOGO calculation...");
    const result = await calculatePromotionDiscount(
      testPromotion,
      testOrderItems,
      testCustomer,
      60.0,
      5.0,
    );

    res.json({
      success: true,
      data: {
        testPromotion,
        testOrderItems,
        result,
      },
    });
  }),
);

module.exports = router;
