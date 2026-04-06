const express = require("express");
const { body, param, query } = require("express-validator");
const prisma = require("../prisma/client");
const validateRequest = require("../middleware/validateRequest");
const { asyncHandler } = require("../middleware/errorHandler");
const { requirePermission } = require("../middleware/auth");
const { sendShippingNotification } = require("../utils/emailService");
const { queueProductSync } = require("../integrations/skydell_odoo");
const logger = require("../utils/logger");

const router = express.Router();

// IMPORTANT: Specific routes must come BEFORE parameterized routes
// to avoid route conflicts (e.g., /zones being matched by /:id)

// Public endpoint: Get shipments for an order (customers can view their own shipments)
router.get(
  "/public/order/:orderId",
  [
    param("orderId").isString().withMessage("Order ID is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    // Verify order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, customerId: true },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    const shipments = await prisma.shipment.findMany({
      where: { orderId },
      orderBy: { createdAt: "desc" },
      include: {
        order: {
          select: {
            orderNumber: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: shipments,
    });
  }),
);

// Public endpoint: Get all active shipping tiers for checkout
router.get(
  "/public/tiers",
  asyncHandler(async (req, res) => {
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const tiers = await prisma.shippingTier.findMany({
      where: { isActive: true },
      orderBy: { minSubtotal: "asc" },
    });

    res.json({
      success: true,
      data: tiers,
    });
  }),
);

// Get shipping zones
router.get(
  "/zones",
  requirePermission("SHIPPING", "READ"),
  asyncHandler(async (req, res) => {
    const zones = await prisma.shippingZone.findMany({
      include: {
        rates: {
          where: { isActive: true },
          orderBy: { rate: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    res.json({
      success: true,
      data: zones,
    });
  }),
);

// Get shipping rates
router.get(
  "/rates",
  requirePermission("SHIPPING", "READ"),
  [
    query("zoneId")
      .optional()
      .isString()
      .withMessage("Zone ID must be a string"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { zoneId } = req.query;

    const where = {};
    if (zoneId) where.zoneId = zoneId;

    const rates = await prisma.shippingRate.findMany({
      where,
      include: {
        zone: {
          select: {
            id: true,
            name: true,
            countries: true,
          },
        },
      },
      orderBy: [{ zone: { name: "asc" } }, { rate: "asc" }],
    });

    res.json({
      success: true,
      data: rates,
    });
  }),
);

// Get carriers
router.get(
  "/carriers",
  requirePermission("SHIPPING", "READ"),
  asyncHandler(async (req, res) => {
    const carriers = await prisma.carrier.findMany({
      orderBy: { name: "asc" },
    });

    // Don't expose sensitive API credentials
    const sanitizedCarriers = carriers.map((carrier) => ({
      ...carrier,
      apiKey: carrier.apiKey ? "***" : null,
      apiSecret: carrier.apiSecret ? "***" : null,
    }));

    res.json({
      success: true,
      data: sanitizedCarriers,
    });
  }),
);

// Get applicable shipping rate for a given country and order details
router.get(
  "/applicable-rate",
  [
    query("country").isString().withMessage("Country is required"),
    query("subtotal").isDecimal().withMessage("Subtotal must be a decimal"),
    query("weight")
      .optional()
      .isDecimal()
      .withMessage("Weight must be a decimal"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { country, subtotal, weight = 0 } = req.query;

    // Find shipping zone that includes this country
    const shippingZone = await prisma.shippingZone.findFirst({
      where: {
        countries: {
          has: country, // PostgreSQL array contains operator
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
      return res.json({ success: true, data: null });
    }

    const orderSubtotal = parseFloat(subtotal);
    const orderWeight = parseFloat(weight);

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
      if (rate.minPrice && orderSubtotal < parseFloat(rate.minPrice)) {
        isApplicable = false;
      }
      if (rate.maxPrice && orderSubtotal > parseFloat(rate.maxPrice)) {
        isApplicable = false;
      }

      if (isApplicable) {
        // Check if free shipping threshold is met
        if (
          rate.freeShippingThreshold &&
          orderSubtotal >= parseFloat(rate.freeShippingThreshold)
        ) {
          return res.json({
            success: true,
            data: {
              ...rate,
              finalRate: 0,
              reason: `Free shipping (order over $${rate.freeShippingThreshold})`,
            },
          });
        }

        return res.json({
          success: true,
          data: {
            ...rate,
            finalRate: parseFloat(rate.rate),
            reason: rate.name,
          },
        });
      }
    }

    res.json({ success: true, data: null });
  }),
);

// Get shipments by order ID (specific route before /:id)
router.get(
  "/order/:orderId",
  requirePermission("SHIPPING", "READ"),
  [
    param("orderId").isString().withMessage("Order ID is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    // Verify order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    const shipments = await prisma.shipment.findMany({
      where: { orderId },
      orderBy: { createdAt: "desc" },
      include: {
        order: {
          select: {
            orderNumber: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: shipments,
    });
  }),
);

// Get all shipments
router.get(
  "/",
  requirePermission("SHIPPING", "READ"),
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("orderId")
      .optional()
      .isString()
      .withMessage("Order ID must be a string"),
    query("status")
      .optional()
      .isString()
      .withMessage("Status must be a string"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, orderId, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build filter conditions
    const where = {};
    if (orderId) where.orderId = orderId;
    if (status) where.status = status;

    // Get shipments and total count
    const [shipments, total] = await Promise.all([
      prisma.shipment.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
        include: {
          order: {
            select: {
              orderNumber: true,
              customer: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
      prisma.shipment.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        shipments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  }),
);

// Create shipment
router.post(
  "/",
  requirePermission("SHIPPING", "CREATE"),
  [
    body("orderId").isString().withMessage("Order ID is required"),
    body("carrier").notEmpty().withMessage("Carrier is required"),
    body("trackingNumber")
      .optional()
      .isString()
      .withMessage("Tracking number must be a string"),
    body("trackingUrl")
      .optional()
      .isURL()
      .withMessage("Tracking URL must be valid"),
    body("status")
      .optional()
      .isIn([
        "PENDING",
        "SHIPPED",
        "IN_TRANSIT",
        "DELIVERED",
        "RETURNED",
        "CANCELLED",
      ])
      .withMessage("Invalid status"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const {
      orderId,
      carrier,
      trackingNumber,
      trackingUrl,
      status = "PENDING",
    } = req.body;

    // Verify order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: {
          include: {
            variant: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    // Create shipment
    const shipment = await prisma.shipment.create({
      data: {
        orderId,
        carrier,
        trackingNumber,
        trackingUrl,
        status,
        shippedAt: status === "SHIPPED" ? new Date() : null,
      },
      include: {
        order: {
          include: {
            customer: true,
            items: {
              include: {
                variant: {
                  include: {
                    product: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Update order status if shipment is shipped
    if (
      status === "SHIPPED" &&
      ["PROCESSING", "LABEL_CREATED", "PENDING"].includes(order.status)
    ) {
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: orderId },
          data: { status: "SHIPPED" },
        });

        // Deduct inventory (Reserved and On Hand)
        const items = order.items;
        const variantIds = items.map((i) => i.variantId);
        const variants = await tx.productVariant.findMany({
          where: { id: { in: variantIds } },
          include: { inventory: true },
        });

        for (const item of items) {
          const variant = variants.find((v) => v.id === item.variantId);
          if (!variant) continue;
          let remaining = item.quantity;

          // Pass 1: Deduct from Reserved (and Quantity)
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

          // Pass 2: If still remaining (wasn't reserved?), deduct from Quantity
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
      });

      // Queue Odoo sync for all affected products (inventory changed)
      try {
        const affectedProductIds = [
          ...new Set(
            order.items
              .filter((i) => i.variant?.productId)
              .map((i) => i.variant.productId),
          ),
        ];
        for (const productId of affectedProductIds) {
          queueProductSync(
            productId,
            "INVENTORY_UPDATE",
            "Shipment inventory deduction",
            {
              orderId: order.id,
              shipmentId: shipment.id,
            },
          ).catch((err) =>
            logger.error(
              "[ODOO SYNC] Failed to queue after shipment deduction",
              { error: err.message },
            ),
          );
        }
      } catch (syncErr) {
        logger.error(
          "[ODOO SYNC] Error queuing sync after shipment deduction",
          { error: syncErr.message },
        );
      }
    }

    // Send shipping notification email if shipment is shipped
    if (status === "SHIPPED" && shipment.order?.customer?.email) {
      logger.debug("[SHIPMENT CREATE] Request body", { body: req.body });
      logger.debug("[SHIPMENT CREATE] Order fetched", {
        id: order?.id,
        orderNumber: order?.orderNumber,
        customer: order?.customer?.email,
      });
      logger.info("[SHIPMENT CREATE] Shipment created", {
        id: shipment.id,
        status: shipment.status,
        orderId: shipment.orderId,
      });
      try {
        await sendShippingNotification(
          shipment.order,
          shipment.order.customer,
          shipment,
        );
        logger.info("[SHIPMENT CREATE] Shipping notification email sent", {
          email: shipment.order.customer.email,
        });
      } catch (emailError) {
        logger.error(
          "[SHIPMENT CREATE] Failed to send shipping notification email",
          emailError,
        );
        // Don't fail the shipment creation if email sending fails
      }
    }

    res.status(201).json({
      success: true,
      data: shipment,
    });
  }),
);

// Update shipment tracking
router.put(
  "/:id/tracking",
  requirePermission("SHIPPING", "UPDATE"),
  [
    param("id").isString().withMessage("Shipment ID is required"),
    body("trackingNumber")
      .optional()
      .isString()
      .withMessage("Tracking number must be a string"),
    body("trackingUrl")
      .optional()
      .isURL()
      .withMessage("Tracking URL must be valid"),
    body("status")
      .optional()
      .isIn([
        "PENDING",
        "SHIPPED",
        "IN_TRANSIT",
        "DELIVERED",
        "RETURNED",
        "CANCELLED",
      ])
      .withMessage("Invalid status"),
    body("carrier")
      .optional()
      .isString()
      .withMessage("Carrier must be a string"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { trackingNumber, trackingUrl, status, carrier } = req.body;

    // Verify shipment exists
    const existingShipment = await prisma.shipment.findUnique({
      where: { id },
      include: {
        order: {
          select: { id: true, status: true },
        },
      },
    });

    if (!existingShipment) {
      return res.status(404).json({
        success: false,
        error: "Shipment not found",
      });
    }

    logger.debug("[SHIPMENT UPDATE] Request", {
      params: req.params,
      body: req.body,
    });
    logger.debug("[SHIPMENT UPDATE] Existing shipment", {
      id: existingShipment?.id,
      status: existingShipment?.status,
    });

    // Prepare update data
    const updateData = {};
    if (trackingNumber !== undefined)
      updateData.trackingNumber = trackingNumber;
    if (trackingUrl !== undefined) updateData.trackingUrl = trackingUrl;
    if (carrier !== undefined) updateData.carrier = carrier;
    if (status !== undefined) {
      updateData.status = status;

      // Set timestamps based on status
      if (status === "SHIPPED" && !existingShipment.shippedAt) {
        updateData.shippedAt = new Date();
      }
      if (status === "DELIVERED") {
        updateData.deliveredAt = new Date();
      }
    }

    // Update shipment
    const shipment = await prisma.shipment.update({
      where: { id },
      data: updateData,
      include: {
        order: {
          include: {
            customer: true,
            items: {
              include: {
                variant: {
                  include: {
                    product: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    logger.info("[SHIPMENT UPDATE] Shipment updated", {
      id: shipment.id,
      status: shipment.status,
      orderId: shipment.orderId,
    });

    // Update order status based on shipment status
    if (status) {
      let orderStatus = null;
      if (
        status === "SHIPPED" &&
        existingShipment.order.status === "PROCESSING"
      ) {
        orderStatus = "SHIPPED";
      } else if (
        status === "DELIVERED" &&
        ["PROCESSING", "SHIPPED"].includes(existingShipment.order.status)
      ) {
        orderStatus = "DELIVERED";
      }

      if (orderStatus) {
        await prisma.order.update({
          where: { id: existingShipment.order.id },
          data: { status: orderStatus },
        });
      }
    }

    // Send shipping notification email if status changed to SHIPPED
    if (
      status === "SHIPPED" &&
      existingShipment.status !== "SHIPPED" &&
      shipment.order?.customer?.email
    ) {
      logger.info(
        "[SHIPMENT UPDATE] Attempting to send shipping notification email",
        { email: shipment.order.customer.email },
      );
      try {
        await sendShippingNotification(
          shipment.order,
          shipment.order.customer,
          shipment,
        );
        logger.info("[SHIPMENT UPDATE] Shipping notification email sent", {
          email: shipment.order.customer.email,
        });
      } catch (emailError) {
        logger.error(
          "[SHIPMENT UPDATE] Failed to send shipping notification email",
          emailError,
        );
        // Don't fail the shipment update if email sending fails
      }
    }

    res.json({
      success: true,
      data: shipment,
    });
  }),
);

// Shipping Tier Endpoints
// IMPORTANT: These must come BEFORE /:id to avoid route conflicts

// Get all shipping tiers
router.get(
  "/tiers",
  requirePermission("SHIPPING", "READ"),
  asyncHandler(async (req, res) => {
    const tiers = await prisma.shippingTier.findMany({
      orderBy: { minSubtotal: "asc" },
    });

    res.json({
      success: true,
      data: tiers,
    });
  }),
);

// Get a single shipping tier
router.get(
  "/tiers/:id",
  requirePermission("SHIPPING", "READ"),
  [param("id").isString().withMessage("Tier ID is required"), validateRequest],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const tier = await prisma.shippingTier.findUnique({
      where: { id },
    });

    if (!tier) {
      return res.status(404).json({
        success: false,
        error: "Shipping tier not found",
      });
    }

    res.json({
      success: true,
      data: tier,
    });
  }),
);

// Create a shipping tier
router.post(
  "/tiers",
  requirePermission("SHIPPING", "CREATE"),
  [
    body("name").isString().withMessage("Name is required"),
    body("minSubtotal")
      .isDecimal()
      .withMessage("minSubtotal must be a decimal"),
    body("maxSubtotal")
      .optional({ nullable: true })
      .isDecimal()
      .withMessage("maxSubtotal must be a decimal or null"),
    body("shippingRate")
      .isDecimal()
      .withMessage("shippingRate must be a decimal"),
    body("serviceName").optional().isString(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { name, minSubtotal, maxSubtotal, shippingRate, serviceName } =
      req.body;

    const newTier = await prisma.shippingTier.create({
      data: {
        name,
        minSubtotal,
        maxSubtotal,
        shippingRate,
        serviceName,
      },
    });

    res.status(201).json({
      success: true,
      data: newTier,
    });
  }),
);

// Update a shipping tier
router.put(
  "/tiers/:id",
  requirePermission("SHIPPING", "UPDATE"),
  [
    param("id").isString().withMessage("Tier ID is required"),
    body("name").optional().isString(),
    body("minSubtotal").optional().isDecimal(),
    body("maxSubtotal").optional({ nullable: true }).isDecimal(),
    body("shippingRate").optional().isDecimal(),
    body("serviceName").optional().isString(),
    body("isActive").optional().isBoolean(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      name,
      minSubtotal,
      maxSubtotal,
      shippingRate,
      serviceName,
      isActive,
    } = req.body;

    const existingTier = await prisma.shippingTier.findUnique({
      where: { id },
    });

    if (!existingTier) {
      return res.status(404).json({
        success: false,
        error: "Shipping tier not found",
      });
    }

    const updatedTier = await prisma.shippingTier.update({
      where: { id },
      data: {
        name,
        minSubtotal,
        maxSubtotal,
        shippingRate,
        serviceName,
        isActive,
      },
    });

    res.json({
      success: true,
      data: updatedTier,
    });
  }),
);

// Delete a shipping tier
router.delete(
  "/tiers/:id",
  requirePermission("SHIPPING", "DELETE"),
  [param("id").isString().withMessage("Tier ID is required"), validateRequest],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const existingTier = await prisma.shippingTier.findUnique({
      where: { id },
    });

    if (!existingTier) {
      return res.status(404).json({
        success: false,
        error: "Shipping tier not found",
      });
    }

    await prisma.shippingTier.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: "Shipping tier deleted successfully",
    });
  }),
);

// Get single shipment
router.get(
  "/:id",
  requirePermission("SHIPPING", "READ"),
  [
    param("id").isString().withMessage("Shipment ID is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const shipment = await prisma.shipment.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            orderNumber: true,
            status: true,
            shippingFirstName: true,
            shippingLastName: true,
            shippingCompany: true,
            shippingAddress1: true,
            shippingAddress2: true,
            shippingCity: true,
            shippingState: true,
            shippingPostalCode: true,
            shippingCountry: true,
            shippingPhone: true,
            customer: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!shipment) {
      return res.status(404).json({
        success: false,
        error: "Shipment not found",
      });
    }

    // Reconstruct shippingAddress from denormalized fields
    if (shipment.order) {
      shipment.order.shippingAddress = {
        firstName: shipment.order.shippingFirstName || "",
        lastName: shipment.order.shippingLastName || "",
        company: shipment.order.shippingCompany || null,
        address1: shipment.order.shippingAddress1 || "",
        address2: shipment.order.shippingAddress2 || null,
        city: shipment.order.shippingCity || "",
        state: shipment.order.shippingState || "",
        postalCode: shipment.order.shippingPostalCode || "",
        country: shipment.order.shippingCountry || "US",
        phone: shipment.order.shippingPhone || null,
      };
    }

    res.json({
      success: true,
      data: shipment,
    });
  }),
);

// Delete shipment
router.delete(
  "/:id",
  requirePermission("SHIPPING", "DELETE"),
  [
    param("id").isString().withMessage("Shipment ID is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Verify shipment exists
    const existingShipment = await prisma.shipment.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existingShipment) {
      return res.status(404).json({
        success: false,
        error: "Shipment not found",
      });
    }

    // Only allow deletion if shipment is not delivered
    if (existingShipment.status === "DELIVERED") {
      return res.status(400).json({
        success: false,
        error: "Cannot delete delivered shipment",
      });
    }

    await prisma.shipment.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: "Shipment deleted successfully",
    });
  }),
);

// Get shipments by order ID
router.get(
  "/order/:orderId",
  requirePermission("SHIPPING", "READ"),
  [
    param("orderId").isString().withMessage("Order ID is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    // Verify order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    const shipments = await prisma.shipment.findMany({
      where: { orderId },
      orderBy: { createdAt: "desc" },
      include: {
        order: {
          select: {
            orderNumber: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: shipments,
    });
  }),
);

// Create shipping zone
router.post(
  "/zones",
  requirePermission("SHIPPING", "CREATE"),
  [
    body("name").notEmpty().withMessage("Zone name is required"),
    body("countries").isArray().withMessage("Countries must be an array"),
    body("countries.*").isString().withMessage("Each country must be a string"),
    body("rates").optional().isArray().withMessage("Rates must be an array"),
    body("rates.*.name")
      .optional()
      .notEmpty()
      .withMessage("Rate name is required"),
    body("rates.*.rate")
      .optional()
      .isNumeric()
      .withMessage("Rate must be a number"),
    body("rates.*.estimatedDays")
      .optional()
      .isString()
      .withMessage("Estimated days must be a string"),
    body("rates.*.freeShippingThreshold")
      .optional()
      .isNumeric()
      .withMessage("Free shipping threshold must be a number"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { name, countries, rates } = req.body;

    // Check if zone name already exists
    const existingZone = await prisma.shippingZone.findUnique({
      where: { name },
    });

    if (existingZone) {
      return res.status(400).json({
        success: false,
        error: "Shipping zone with this name already exists",
      });
    }

    // Create zone with optional rates
    const zoneData = {
      name,
      countries,
    };

    if (rates && rates.length > 0) {
      zoneData.rates = {
        create: rates.map((rate) => ({
          name: rate.name,
          rate: parseFloat(rate.rate),
          estimatedDays: rate.estimatedDays || null,
          freeShippingThreshold: rate.freeShippingThreshold
            ? parseFloat(rate.freeShippingThreshold)
            : null,
          isActive: true,
        })),
      };
    }

    const zone = await prisma.shippingZone.create({
      data: zoneData,
      include: {
        rates: true,
      },
    });

    res.status(201).json({
      success: true,
      data: zone,
    });
  }),
);

// Update shipping zone
router.put(
  "/zones/:id",
  requirePermission("SHIPPING", "UPDATE"),
  [
    param("id").isString().withMessage("Zone ID is required"),
    body("name").optional().notEmpty().withMessage("Zone name cannot be empty"),
    body("countries")
      .optional()
      .isArray()
      .withMessage("Countries must be an array"),
    body("countries.*")
      .optional()
      .isString()
      .withMessage("Each country must be a string"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, countries } = req.body;

    // Check if zone exists
    const existingZone = await prisma.shippingZone.findUnique({
      where: { id },
    });

    if (!existingZone) {
      return res.status(404).json({
        success: false,
        error: "Shipping zone not found",
      });
    }

    // Check if new name conflicts with existing zone
    if (name && name !== existingZone.name) {
      const nameConflict = await prisma.shippingZone.findUnique({
        where: { name },
      });

      if (nameConflict) {
        return res.status(400).json({
          success: false,
          error: "Shipping zone with this name already exists",
        });
      }
    }

    const updatedZone = await prisma.shippingZone.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(countries && { countries }),
      },
      include: {
        rates: {
          where: { isActive: true },
          orderBy: { rate: "asc" },
        },
      },
    });

    res.json({
      success: true,
      data: updatedZone,
    });
  }),
);

// Delete shipping zone
router.delete(
  "/zones/:id",
  requirePermission("SHIPPING", "DELETE"),
  [param("id").isString().withMessage("Zone ID is required"), validateRequest],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check if zone exists
    const existingZone = await prisma.shippingZone.findUnique({
      where: { id },
      include: {
        rates: true,
      },
    });

    if (!existingZone) {
      return res.status(404).json({
        success: false,
        error: "Shipping zone not found",
      });
    }

    // Delete the zone (rates will be cascade deleted)
    await prisma.shippingZone.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: "Shipping zone deleted successfully",
    });
  }),
);

// Create shipping rate
router.post(
  "/rates",
  requirePermission("SHIPPING", "CREATE"),
  [
    body("zoneId").isString().withMessage("Zone ID is required"),
    body("name").notEmpty().withMessage("Rate name is required"),
    body("rate").isNumeric().withMessage("Rate must be a number"),
    body("minWeight")
      .optional()
      .isNumeric()
      .withMessage("Min weight must be a number"),
    body("maxWeight")
      .optional()
      .isNumeric()
      .withMessage("Max weight must be a number"),
    body("minPrice")
      .optional()
      .isNumeric()
      .withMessage("Min price must be a number"),
    body("maxPrice")
      .optional()
      .isNumeric()
      .withMessage("Max price must be a number"),
    body("freeShippingThreshold")
      .optional()
      .isNumeric()
      .withMessage("Free shipping threshold must be a number"),
    body("estimatedDays")
      .optional()
      .isString()
      .withMessage("Estimated days must be a string"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const {
      zoneId,
      name,
      rate,
      minWeight,
      maxWeight,
      minPrice,
      maxPrice,
      freeShippingThreshold,
      estimatedDays,
      isActive = true,
    } = req.body;

    // Verify zone exists
    const zone = await prisma.shippingZone.findUnique({
      where: { id: zoneId },
    });

    if (!zone) {
      return res.status(404).json({
        success: false,
        error: "Shipping zone not found",
      });
    }

    const shippingRate = await prisma.shippingRate.create({
      data: {
        zoneId,
        name,
        rate: parseFloat(rate),
        minWeight: minWeight ? parseFloat(minWeight) : null,
        maxWeight: maxWeight ? parseFloat(maxWeight) : null,
        minPrice: minPrice ? parseFloat(minPrice) : null,
        maxPrice: maxPrice ? parseFloat(maxPrice) : null,
        freeShippingThreshold: freeShippingThreshold
          ? parseFloat(freeShippingThreshold)
          : null,
        estimatedDays,
        isActive,
      },
      include: {
        zone: {
          select: {
            id: true,
            name: true,
            countries: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: shippingRate,
    });
  }),
);

// Update shipping rate
router.put(
  "/rates/:id",
  requirePermission("SHIPPING", "UPDATE"),
  [
    param("id").isString().withMessage("Rate ID is required"),
    body("name").optional().notEmpty().withMessage("Rate name cannot be empty"),
    body("rate").optional().isNumeric().withMessage("Rate must be a number"),
    body("minWeight")
      .optional()
      .isNumeric()
      .withMessage("Min weight must be a number"),
    body("maxWeight")
      .optional()
      .isNumeric()
      .withMessage("Max weight must be a number"),
    body("minPrice")
      .optional()
      .isNumeric()
      .withMessage("Min price must be a number"),
    body("maxPrice")
      .optional()
      .isNumeric()
      .withMessage("Max price must be a number"),
    body("freeShippingThreshold")
      .optional()
      .isNumeric()
      .withMessage("Free shipping threshold must be a number"),
    body("estimatedDays")
      .optional()
      .isString()
      .withMessage("Estimated days must be a string"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      name,
      rate,
      minWeight,
      maxWeight,
      minPrice,
      maxPrice,
      freeShippingThreshold,
      estimatedDays,
      isActive,
    } = req.body;

    // Check if rate exists
    const existingRate = await prisma.shippingRate.findUnique({
      where: { id },
    });

    if (!existingRate) {
      return res.status(404).json({
        success: false,
        error: "Shipping rate not found",
      });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (rate !== undefined) updateData.rate = parseFloat(rate);
    if (minWeight !== undefined)
      updateData.minWeight = minWeight ? parseFloat(minWeight) : null;
    if (maxWeight !== undefined)
      updateData.maxWeight = maxWeight ? parseFloat(maxWeight) : null;
    if (minPrice !== undefined)
      updateData.minPrice = minPrice ? parseFloat(minPrice) : null;
    if (maxPrice !== undefined)
      updateData.maxPrice = maxPrice ? parseFloat(maxPrice) : null;
    if (freeShippingThreshold !== undefined)
      updateData.freeShippingThreshold = freeShippingThreshold
        ? parseFloat(freeShippingThreshold)
        : null;
    if (estimatedDays !== undefined) updateData.estimatedDays = estimatedDays;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedRate = await prisma.shippingRate.update({
      where: { id },
      data: updateData,
      include: {
        zone: {
          select: {
            id: true,
            name: true,
            countries: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: updatedRate,
    });
  }),
);

// Delete shipping rate
router.delete(
  "/rates/:id",
  requirePermission("SHIPPING", "DELETE"),
  [param("id").isString().withMessage("Rate ID is required"), validateRequest],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check if rate exists
    const existingRate = await prisma.shippingRate.findUnique({
      where: { id },
    });

    if (!existingRate) {
      return res.status(404).json({
        success: false,
        error: "Shipping rate not found",
      });
    }

    await prisma.shippingRate.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: "Shipping rate deleted successfully",
    });
  }),
);

// Create carrier
router.post(
  "/carriers",
  requirePermission("SHIPPING", "CREATE"),
  [
    body("name").notEmpty().withMessage("Carrier name is required"),
    body("code").notEmpty().withMessage("Carrier code is required"),
    body("apiKey")
      .optional()
      .isString()
      .withMessage("API key must be a string"),
    body("apiSecret")
      .optional()
      .isString()
      .withMessage("API secret must be a string"),
    body("services")
      .optional()
      .isArray()
      .withMessage("Services must be an array"),
    body("services.*")
      .optional()
      .isString()
      .withMessage("Each service must be a string"),
    body("trackingUrl")
      .optional()
      .isURL()
      .withMessage("Tracking URL must be valid"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const {
      name,
      code,
      apiKey,
      apiSecret,
      services = [],
      trackingUrl,
      isActive = true,
    } = req.body;

    // Check if carrier name or code already exists
    const existingCarrier = await prisma.carrier.findFirst({
      where: {
        OR: [{ name }, { code }],
      },
    });

    if (existingCarrier) {
      return res.status(400).json({
        success: false,
        error: "Carrier with this name or code already exists",
      });
    }

    const carrier = await prisma.carrier.create({
      data: {
        name,
        code: code.toUpperCase(),
        apiKey,
        apiSecret,
        services,
        trackingUrl,
        isActive,
      },
    });

    // Don't expose sensitive API credentials in response
    const sanitizedCarrier = {
      ...carrier,
      apiKey: carrier.apiKey ? "***" : null,
      apiSecret: carrier.apiSecret ? "***" : null,
    };

    res.status(201).json({
      success: true,
      data: sanitizedCarrier,
    });
  }),
);

// Update carrier
router.put(
  "/carriers/:id",
  requirePermission("SHIPPING", "UPDATE"),
  [
    param("id").isString().withMessage("Carrier ID is required"),
    body("name")
      .optional()
      .notEmpty()
      .withMessage("Carrier name cannot be empty"),
    body("code")
      .optional()
      .notEmpty()
      .withMessage("Carrier code cannot be empty"),
    body("apiKey")
      .optional()
      .isString()
      .withMessage("API key must be a string"),
    body("apiSecret")
      .optional()
      .isString()
      .withMessage("API secret must be a string"),
    body("services")
      .optional()
      .isArray()
      .withMessage("Services must be an array"),
    body("services.*")
      .optional()
      .isString()
      .withMessage("Each service must be a string"),
    body("trackingUrl")
      .optional()
      .isURL()
      .withMessage("Tracking URL must be valid"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, code, apiKey, apiSecret, services, trackingUrl, isActive } =
      req.body;

    // Check if carrier exists
    const existingCarrier = await prisma.carrier.findUnique({
      where: { id },
    });

    if (!existingCarrier) {
      return res.status(404).json({
        success: false,
        error: "Carrier not found",
      });
    }

    // Check if new name or code conflicts with existing carriers
    if (name || code) {
      const conflictWhere = [];
      if (name && name !== existingCarrier.name) {
        conflictWhere.push({ name });
      }
      if (code && code.toUpperCase() !== existingCarrier.code) {
        conflictWhere.push({ code: code.toUpperCase() });
      }

      if (conflictWhere.length > 0) {
        const nameConflict = await prisma.carrier.findFirst({
          where: {
            AND: [{ id: { not: id } }, { OR: conflictWhere }],
          },
        });

        if (nameConflict) {
          return res.status(400).json({
            success: false,
            error: "Carrier with this name or code already exists",
          });
        }
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (code !== undefined) updateData.code = code.toUpperCase();
    if (apiKey !== undefined) updateData.apiKey = apiKey;
    if (apiSecret !== undefined) updateData.apiSecret = apiSecret;
    if (services !== undefined) updateData.services = services;
    if (trackingUrl !== undefined) updateData.trackingUrl = trackingUrl;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedCarrier = await prisma.carrier.update({
      where: { id },
      data: updateData,
    });

    // Don't expose sensitive API credentials in response
    const sanitizedCarrier = {
      ...updatedCarrier,
      apiKey: updatedCarrier.apiKey ? "***" : null,
      apiSecret: updatedCarrier.apiSecret ? "***" : null,
    };

    res.json({
      success: true,
      data: sanitizedCarrier,
    });
  }),
);

// Delete carrier
router.delete(
  "/carriers/:id",
  requirePermission("SHIPPING", "DELETE"),
  [
    param("id").isString().withMessage("Carrier ID is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check if carrier exists
    const existingCarrier = await prisma.carrier.findUnique({
      where: { id },
    });

    if (!existingCarrier) {
      return res.status(404).json({
        success: false,
        error: "Carrier not found",
      });
    }

    await prisma.carrier.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: "Carrier deleted successfully",
    });
  }),
);

module.exports = router;
