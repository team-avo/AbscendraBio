const express = require("express");
const { body, param } = require("express-validator");
const prisma = require("../prisma/client");
const validateRequest = require("../middleware/validateRequest");
const { asyncHandler } = require("../middleware/errorHandler");
const { authMiddleware, requireRole } = require("../middleware/auth");
const multer = require("multer");
const ExcelJS = require("exceljs");
const { ALLOWED_MIME_TYPES, isValidMimeType } = require("../config/fileUpload");

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (isValidMimeType(file.mimetype, ALLOWED_MIME_TYPES.EXCEL)) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel files (.xlsx) are allowed"), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

/**
 * Build denormalized address snapshot fields for an order.
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
const {
  findOptimalWarehouse,
  reserveInventoryFromWarehouse,
} = require("../services/warehouseService");
const { queueProductSync } = require("../integrations/skydell_odoo");
const router = express.Router();

// -----------------------------------------------------------------------------
// 1. Create Sales Channel
// -----------------------------------------------------------------------------
router.post(
  "/",
  authMiddleware,
  requireRole(["ADMIN"]), // Restrict to Admin
  [
    body("companyName").notEmpty().withMessage("Company Name is required"),
    body("contactPerson").notEmpty().withMessage("Contact Person is required"),
    body("contactNumber").optional(),
    body("type")
      .optional()
      .isIn(["OWN", "PARTNER"])
      .withMessage("Invalid Type"),
    body("fulfillmentModel")
      .optional()
      .isIn(["OWN_ECOMMERCE", "DROPSHIP"])
      .withMessage("Invalid Fulfillment Model"),
    body("webhookUrl")
      .optional({ values: "falsy" })
      .isURL()
      .withMessage("Invalid Webhook URL"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const {
      companyName,
      contactPerson,
      contactNumber,
      contactEmail,
      type = "PARTNER",
      fulfillmentModel = "DROPSHIP",
      paymentTerms,
      status = "ACTIVE",
      webhookUrl,
      autoPaid,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
    } = req.body;

    const channel = await prisma.salesChannel.create({
      data: {
        companyName,
        contactPerson,
        contactNumber,
        contactEmail,
        type,
        fulfillmentModel,
        paymentTerms,
        status,
        webhookUrl: webhookUrl || null,
        autoPaid: autoPaid === true,
        addressLine1: addressLine1 || null,
        addressLine2: addressLine2 || null,
        city: city || null,
        state: state || null,
        postalCode: postalCode || null,
        country: country || null,
      },
    });

    res.status(201).json({ success: true, data: channel });
  }),
);

// -----------------------------------------------------------------------------
// 2. Get All Sales Channels
// -----------------------------------------------------------------------------
router.get(
  "/",
  authMiddleware,
  requireRole(["ADMIN", "STAFF"]),
  asyncHandler(async (req, res) => {
    const channels = await prisma.salesChannel.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: channels });
  }),
);

// -----------------------------------------------------------------------------
// 3. Get Sales Channel Details
// -----------------------------------------------------------------------------
router.get(
  "/:id",
  authMiddleware,
  requireRole(["ADMIN", "STAFF"]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const channel = await prisma.salesChannel.findUnique({
      where: { id },
      include: {
        prices: true,
      },
    });

    if (!channel) {
      return res
        .status(404)
        .json({ success: false, error: "Sales Channel not found" });
    }

    res.json({ success: true, data: channel });
  }),
);

// -----------------------------------------------------------------------------
// 3.5 Update Sales Channel
// -----------------------------------------------------------------------------
router.put(
  "/:id",
  authMiddleware,
  requireRole(["ADMIN"]),
  [
    body("companyName").optional().notEmpty(),
    body("contactPerson").optional().notEmpty(),
    body("type").optional().isIn(["OWN", "PARTNER"]),
    body("status").optional().isIn(["ACTIVE", "PAUSED"]),
    body("webhookUrl")
      .optional({ values: "falsy" })
      .isURL()
      .withMessage("Invalid Webhook URL"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      companyName,
      contactPerson,
      contactNumber,
      contactEmail,
      type,
      fulfillmentModel,
      paymentTerms,
      status,
      webhookUrl,
      autoPaid,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
    } = req.body;

    // Check existence
    const existing = await prisma.salesChannel.findUnique({ where: { id } });
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, error: "Channel not found" });
    }

    const updated = await prisma.salesChannel.update({
      where: { id },
      data: {
        companyName,
        contactPerson,
        contactNumber,
        contactEmail,
        type,
        fulfillmentModel,
        paymentTerms,
        status,
        autoPaid: autoPaid !== undefined ? autoPaid === true : undefined,
        webhookUrl: webhookUrl !== undefined ? webhookUrl || null : undefined,
        addressLine1:
          addressLine1 !== undefined ? addressLine1 || null : undefined,
        addressLine2:
          addressLine2 !== undefined ? addressLine2 || null : undefined,
        city: city !== undefined ? city || null : undefined,
        state: state !== undefined ? state || null : undefined,
        postalCode: postalCode !== undefined ? postalCode || null : undefined,
        country: country !== undefined ? country || null : undefined,
      },
    });

    res.json({ success: true, data: updated });
  }),
);

// -----------------------------------------------------------------------------
// 3.6 Delete Sales Channel
// -----------------------------------------------------------------------------
router.delete(
  "/:id",
  authMiddleware,
  requireRole(["ADMIN"]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const channel = await prisma.salesChannel.findUnique({
      where: { id },
      include: {
        _count: {
          select: { orders: true },
        },
      },
    });

    if (!channel) {
      return res
        .status(404)
        .json({ success: false, error: "Sales Channel not found" });
    }

    // Perform deletion in a transaction to ensure data integrity
    await prisma.$transaction(async (tx) => {
      // 0. Delete related ledger entries and statements first to avoid foreign key violations
      await tx.partnerLedgerEntry.deleteMany({
        where: { salesChannelId: id },
      });

      await tx.partnerStatement.deleteMany({
        where: { salesChannelId: id },
      });

      // 1. Unlink any orders associated with this channel
      if (channel._count.orders > 0) {
        await tx.order.updateMany({
          where: { salesChannelId: id },
          data: { salesChannelId: null },
        });
      }

      // 2. Delete the Sales Channel (Prices and Statement Config will cascade automatically)
      await tx.salesChannel.delete({
        where: { id },
      });
    });

    res.json({
      success: true,
      message:
        "Sales Channel deleted successfully. Associated orders have been unlinked.",
    });
  }),
);

// -----------------------------------------------------------------------------
// 4. Download Price List Template
// -----------------------------------------------------------------------------
router.get(
  "/:id/price-list/template",
  authMiddleware,
  requireRole(["ADMIN", "STAFF"]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Fetch all active variants
    const variants = await prisma.productVariant.findMany({
      where: { isActive: true },
      select: {
        id: true,
        sku: true,
        name: true,
        regularPrice: true,
        salePrice: true,
        product: {
          select: { name: true },
        },
      },
      orderBy: { sku: "asc" },
    });

    // Fetch existing prices for this channel to pre-fill
    const existingPrices = await prisma.salesChannelPrice.findMany({
      where: { salesChannelId: id },
    });
    const priceMap = new Map(
      existingPrices.map((p) => [p.variantId, Number(p.price)]),
    );

    // Create Excel Workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Price List");

    worksheet.columns = [
      { header: "SKU", key: "sku", width: 25 },
      { header: "Product / Variant Name", key: "name", width: 40 },
      { header: "Channel Price", key: "price", width: 15 },
    ];

    // Add rows
    variants.forEach((v) => {
      const productName = v.product ? v.product.name : "";
      const fullName =
        productName === v.name ? productName : `${productName} - ${v.name}`;
      // User requested to show regular price specifically
      const centreResearchPrice = Number(v.regularPrice);

      worksheet.addRow({
        sku: v.sku,
        name: fullName,
        price: priceMap.get(v.id) || centreResearchPrice || 0,
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=price-list-${id}.xlsx`,
    );

    await workbook.xlsx.write(res);
    res.end();
  }),
);

// -----------------------------------------------------------------------------
// 5. Upload Price List
// -----------------------------------------------------------------------------
router.post(
  "/:id/price-list/upload",
  authMiddleware,
  requireRole(["ADMIN"]),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { dryRun } = req.query;

    if (!req.file && !req.body.updates) {
      return res
        .status(400)
        .json({ success: false, error: "No file uploaded or data provided" });
    }

    let updates = [];
    const errors = [];

    if (req.file) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      const worksheet = workbook.getWorksheet(1);

      if (!worksheet) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid Excel file" });
      }

      // Iterate rows (skip header)
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        const skuVal = row.getCell(1).value;
        const priceVal = row.getCell(3).value;

        if (skuVal !== null && priceVal !== null) {
          const sku = String(skuVal).trim();
          const price = parseFloat(String(priceVal));

          if (!sku) return;

          if (isNaN(price) || price < 0) {
            errors.push(`Row ${rowNumber}: Invalid price for SKU ${sku}`);
          } else {
            updates.push({ sku, price });
          }
        }
      });
    } else if (req.body.updates) {
      updates = req.body.updates;
    }

    if (dryRun === "true") {
      const preview = [];
      for (const item of updates) {
        const variant = await prisma.productVariant.findUnique({
          where: { sku: item.sku },
          include: { product: { select: { name: true } } },
        });

        if (variant) {
          preview.push({
            sku: item.sku,
            name: variant.product
              ? `${variant.product.name} - ${variant.name}`
              : variant.name,
            centreResearchPrice: Number(variant.regularPrice),
            channelPrice: item.price,
          });
        } else {
          errors.push(`SKU ${item.sku} not found`);
        }
      }
      return res.json({
        success: true,
        preview,
        totalFound: preview.length,
        totalErrors: errors.length,
        errors,
      });
    }

    let updatedCount = 0;
    for (const item of updates) {
      const variant = await prisma.productVariant.findUnique({
        where: { sku: item.sku },
      });

      if (variant) {
        await prisma.salesChannelPrice.upsert({
          where: {
            salesChannelId_variantId: {
              salesChannelId: id,
              variantId: variant.id,
            },
          },
          create: {
            salesChannelId: id,
            variantId: variant.id,
            price: item.price,
          },
          update: {
            price: item.price,
          },
        });
        updatedCount++;
      }
    }

    res.json({
      success: true,
      message: `Updated ${updatedCount} prices.`,
      errors: errors.length > 0 ? errors : undefined,
    });
  }),
);

// -----------------------------------------------------------------------------
// 5.5 Get Channel Prices (UI Table)
// -----------------------------------------------------------------------------
router.get(
  "/:id/prices",
  authMiddleware,
  requireRole(["ADMIN", "STAFF"]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { page = 1, limit = 50, search = "" } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      isActive: true,
      OR: search
        ? [
          { name: { contains: search, mode: "insensitive" } },
          { sku: { contains: search, mode: "insensitive" } },
          { product: { name: { contains: search, mode: "insensitive" } } },
        ]
        : undefined,
    };

    const [total, variants] = await Promise.all([
      prisma.productVariant.count({ where }),
      prisma.productVariant.findMany({
        where,
        skip: Number(skip),
        take: Number(limit),
        include: {
          product: { select: { name: true } },
          salesChannelPrices: {
            where: { salesChannelId: id },
          },
        },
        orderBy: { sku: "asc" },
      }),
    ]);

    const data = variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      name: v.product ? `${v.product.name} - ${v.name}` : v.name,
      regularPrice: Number(v.regularPrice),
      channelPrice:
        v.salesChannelPrices.length > 0
          ? Number(v.salesChannelPrices[0].price)
          : null,
    }));

    res.json({
      success: true,
      data: data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  }),
);

// -----------------------------------------------------------------------------
// 5.6 Batch Update Channel Prices (UI Table)
// -----------------------------------------------------------------------------
router.put(
  "/:id/prices",
  authMiddleware,
  requireRole(["ADMIN"]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { updates } = req.body; // Array of { variantId, price }

    if (!Array.isArray(updates)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid updates format" });
    }

    const operations = updates.map((update) =>
      prisma.salesChannelPrice.upsert({
        where: {
          salesChannelId_variantId: {
            salesChannelId: id,
            variantId: update.variantId,
          },
        },
        create: {
          salesChannelId: id,
          variantId: update.variantId,
          price: update.price,
        },
        update: {
          price: update.price,
        },
      }),
    );

    await prisma.$transaction(operations);

    res.json({ success: true, message: "Prices updated successfully" });
  }),
);

// -----------------------------------------------------------------------------
// 6a. Supply Channel — Product Catalog (Protected by API Key)
// -----------------------------------------------------------------------------
router.get(
  "/integration/products",
  asyncHandler(async (req, res) => {
    const apiKey = req.header("X-API-Key");
    if (!apiKey) {
      return res.status(401).json({ success: false, error: "Missing API Key" });
    }

    const channel = await prisma.salesChannel.findUnique({
      where: { apiKey },
    });

    if (!channel) {
      return res.status(401).json({ success: false, error: "Invalid API Key" });
    }

    if (channel.status !== "ACTIVE") {
      return res
        .status(403)
        .json({ success: false, error: "Sales Channel is not active" });
    }

    const products = await prisma.product.findMany({
      where: { status: "ACTIVE" },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        categories: true,
        tags: true,
        variants: {
          where: { isActive: true },
          include: {
            variantOptions: true,
            images: { orderBy: { sortOrder: "asc" } },
            inventory: true,
          },
        },
      },
    });

    const formatted = products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      images: p.images.map((img) => ({
        url: img.url,
        altText: img.altText,
        sortOrder: img.sortOrder,
      })),
      categories: p.categories.map((pc) => pc.name),
      tags: p.tags.map((pt) => pt.tag),
      variants: p.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        name: v.name,
        regularPrice: Number(v.regularPrice),
        salePrice: v.salePrice ? Number(v.salePrice) : null,
        weight: v.weight ? Number(v.weight) : null,
        hsn: v.hsn,
        inventory: v.inventory.reduce(
          (sum, inv) => sum + ((inv.quantity || 0) - (inv.reservedQty || 0)),
          0,
        ),
        options: v.variantOptions.map((o) => ({
          name: o.name,
          value: o.value,
        })),
        images: (v.images || []).map((img) => ({
          url: img.url,
          altText: img.altText,
          sortOrder: img.sortOrder,
        })),
      })),
    }));

    res.json({ success: true, data: { products: formatted } });
  }),
);

// -----------------------------------------------------------------------------
// 6b. Supply Channel — Inventory Levels (Protected by API Key)
// -----------------------------------------------------------------------------
router.get(
  "/integration/inventory",
  asyncHandler(async (req, res) => {
    const apiKey = req.header("X-API-Key");
    if (!apiKey) {
      return res.status(401).json({ success: false, error: "Missing API Key" });
    }

    const channel = await prisma.salesChannel.findUnique({
      where: { apiKey },
    });

    if (!channel) {
      return res.status(401).json({ success: false, error: "Invalid API Key" });
    }

    if (channel.status !== "ACTIVE") {
      return res
        .status(403)
        .json({ success: false, error: "Sales Channel is not active" });
    }

    const variants = await prisma.productVariant.findMany({
      where: {
        isActive: true,
        product: { status: "ACTIVE" },
      },
      include: {
        product: { select: { id: true, name: true } },
        inventory: true,
      },
    });

    const inventory = variants.map((v) => ({
      variantId: v.id,
      sku: v.sku,
      productId: v.product.id,
      productName: v.product.name,
      quantity: v.inventory.reduce(
        (sum, inv) => sum + ((inv.quantity || 0) - (inv.reservedQty || 0)),
        0,
      ),
    }));

    res.json({ success: true, data: { inventory } });
  }),
);

// -----------------------------------------------------------------------------
// 6c. External Order Creation (Protected by API Key)
// -----------------------------------------------------------------------------
router.post(
  "/integration/orders",
  asyncHandler(async (req, res) => {
    const apiKey = req.header("X-API-Key");
    if (!apiKey) {
      return res.status(401).json({ success: false, error: "Missing API Key" });
    }

    // Authenticate
    const channel = await prisma.salesChannel.findUnique({
      where: { apiKey },
    });

    if (!channel) {
      return res.status(401).json({ success: false, error: "Invalid API Key" });
    }

    if (channel.status !== "ACTIVE") {
      return res
        .status(403)
        .json({ success: false, error: "Sales Channel is not active" });
    }

    const { partnerOrderId, customer, items } = req.body;

    // Idempotency check: Don't duplicate orders from the same partner with the same external ID
    if (partnerOrderId) {
      const existingOrder = await prisma.order.findFirst({
        where: {
          salesChannelId: channel.id,
          partnerOrderId: String(partnerOrderId),
        },
      });

      if (existingOrder) {
        return res.status(400).json({
          success: false,
          error:
            "An order with this partnerOrderId already exists for this channel.",
          orderId: existingOrder.id,
          orderNumber: existingOrder.orderNumber,
        });
      }
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "Items array is required" });
    }

    // 1. Process Items & Pricing
    const orderItems = [];
    let subtotal = 0;

    for (const item of items) {
      const { variantId, quantity } = item;

      // Validate quantity
      if (!quantity || quantity <= 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid quantity for variant ${variantId}`,
        });
      }

      // Check Channel Pricing
      // First try to find by variantId (database ID), then fall back to SKU lookup
      let channelPrice = null;
      let resolvedVariantId = variantId;

      // Try 1: Look up by Variant ID directly
      channelPrice = await prisma.salesChannelPrice.findUnique({
        where: {
          salesChannelId_variantId: {
            salesChannelId: channel.id,
            variantId: variantId,
          },
        },
        include: { variant: true },
      });

      // Try 2: If not found by ID, try looking up variant by SKU first
      if (!channelPrice) {
        const variantBySku = await prisma.productVariant.findFirst({
          where: { sku: variantId },
          select: { id: true, sku: true },
        });

        if (variantBySku) {
          resolvedVariantId = variantBySku.id;
          channelPrice = await prisma.salesChannelPrice.findUnique({
            where: {
              salesChannelId_variantId: {
                salesChannelId: channel.id,
                variantId: variantBySku.id,
              },
            },
            include: { variant: true },
          });
        }
      }

      if (!channelPrice) {
        return res.status(400).json({
          success: false,
          error: `Price not configured for variant ${variantId} on this channel. Tried both ID and SKU lookup.`,
        });
      }

      const unitPrice = Number(channelPrice.price);
      const totalPrice = unitPrice * quantity;

      subtotal += totalPrice;
      orderItems.push({
        variantId: resolvedVariantId, // Use the resolved variant ID (from ID or SKU lookup)
        sku: channelPrice.variant?.sku || variantId,
        quantity,
        unitPrice,
        totalPrice,
      });
    }

    // 1.5 Resolve Shipping Amount from Sales Channel Shipping Tiers
    // Partners can pin a specific tier by sending shippingTierId (DB id) or uniqueTierId.
    // If neither is provided, fall back to subtotal-range matching.
    const {
      shippingOption,
      shippingTierId,
      uniqueTierId: requestedUniqueTierId,
    } = req.body;

    let matchedShippingTier = null;

    if (shippingTierId || requestedUniqueTierId) {
      // Partner explicitly requested a tier — look it up by id or uniqueTierId
      matchedShippingTier = await prisma.salesChannelShippingTier.findFirst({
        where: {
          salesChannelId: channel.id,
          isActive: true,
          ...(shippingTierId
            ? { id: shippingTierId }
            : { uniqueTierId: requestedUniqueTierId }),
        },
      });

      if (!matchedShippingTier) {
        return res.status(400).json({
          success: false,
          error: `Shipping tier not found or inactive: ${shippingTierId
            ? `id=${shippingTierId}`
            : `uniqueTierId=${requestedUniqueTierId}`
            }`,
        });
      }
    } else {
      // Auto-match by subtotal range
      matchedShippingTier = await prisma.salesChannelShippingTier.findFirst({
        where: {
          salesChannelId: channel.id,
          isActive: true,
          minSubtotal: { lte: subtotal },
          OR: [{ maxSubtotal: null }, { maxSubtotal: { gt: subtotal } }],
        },
        orderBy: { minSubtotal: "desc" }, // Most specific (highest min) first
      });
    }

    const shippingAmount = matchedShippingTier
      ? parseFloat(matchedShippingTier.shippingRate)
      : 0;
    const totalAmount = subtotal + shippingAmount;

    // 2. Handle Customer
    // Payload: { firstName, lastName, address, ... }
    // We need to create or find a customer.
    // Basic implementation: Create a new customer or find by email if provided.

    let customerId;
    // Basic mock of customer creation/finding.
    // IMPORTANT: Integration orders might just attach to a generic 'Partner Customer' or
    // create individual customers. Let's assume individual customer creation for dropship.

    const email =
      customer.email ||
      `partner_${channel.id}_${partnerOrderId}@placeholder.com`;

    // Find existing customer by email
    let dbCustomer = await prisma.customer.findUnique({
      where: { email },
    });

    if (!dbCustomer) {
      dbCustomer = await prisma.customer.create({
        data: {
          firstName: customer.firstName || "Unknown",
          lastName: customer.lastName || "Unknown",
          email: email,
          mobile:
            customer.phone ||
            `TEMP_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          isApproved: true,
          customerType: "B2C",
        },
      });
    }
    customerId = dbCustomer.id;

    // 3. Create Addresses
    const payloadShipping = req.body.shippingAddress || customer;
    const payloadBilling = req.body.billingAddress || customer;

    const shippingAddressData = {
      customerId,
      firstName: payloadShipping.firstName || customer.firstName || "Unknown",
      lastName: payloadShipping.lastName || customer.lastName || "Unknown",
      address1:
        payloadShipping.address1 || payloadShipping.address || "Unknown",
      city: payloadShipping.city || "Unknown",
      state: payloadShipping.state || "Unknown",
      postalCode: payloadShipping.zip || payloadShipping.postalCode || "00000",
      country: payloadShipping.country || "US",
      type: "SHIPPING",
    };

    const shippingAddress = await prisma.address.create({
      data: shippingAddressData,
    });

    const billingAddressData = {
      customerId,
      firstName: payloadBilling.firstName || customer.firstName || "Unknown",
      lastName: payloadBilling.lastName || customer.lastName || "Unknown",
      address1: payloadBilling.address1 || payloadBilling.address || "Unknown",
      city: payloadBilling.city || "Unknown",
      state: payloadBilling.state || "Unknown",
      postalCode: payloadBilling.zip || payloadBilling.postalCode || "00000",
      country: payloadBilling.country || "US",
      type: "BILLING",
    };

    const billingAddress = await prisma.address.create({
      data: billingAddressData,
    });

    // 4. Create Order and Reserve Inventory (Atomic Transaction)
    const result = await prisma.$transaction(async (tx) => {
      // 4.1 Generate Order Number
      const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // 4.2 Create the Order
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          customerId,
          salesChannelId: channel.id,
          partnerOrderId: partnerOrderId,
          status: "PENDING",
          subtotal: subtotal,
          shippingAmount: shippingAmount,
          totalAmount: totalAmount,
          shippingAddressId: shippingAddress.id,
          billingAddressId: billingAddress.id,
          ...buildAddressSnapshot(shippingAddressData, "shipping"),
          ...buildAddressSnapshot(billingAddressData, "billing"),
          items: {
            create: orderItems.map((item) => ({
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
          },
        },
      });

      // 4.3 Check for Existing Credit (Auto-Debit)
      // Calculate current balance (Receivables - Payments)
      const [totalReceivables, totalPayments] = await Promise.all([
        tx.partnerLedgerEntry.aggregate({
          where: { salesChannelId: channel.id, type: "RECEIVABLE" },
          _sum: { amount: true },
        }),
        tx.partnerLedgerEntry.aggregate({
          where: { salesChannelId: channel.id, type: "PAYMENT" },
          _sum: { amount: true },
        }),
      ]);

      const currentBalance =
        Number(totalReceivables._sum.amount || 0) -
        Number(totalPayments._sum.amount || 0);

      let initialStatus = "UNPAID";
      let initialRemaining = totalAmount;

      // If balance is negative, we have credit
      if (currentBalance < 0) {
        const creditAvailable = Math.abs(currentBalance);
        const amountPaidByCredit = Math.min(creditAvailable, totalAmount);

        if (amountPaidByCredit > 0) {
          initialRemaining = totalAmount - amountPaidByCredit;
          initialStatus = initialRemaining <= 0.01 ? "PAID" : "PARTIALLY_PAID"; // float tolerance

          console.log(
            `[SalesChannel] Auto-applied credit of ${amountPaidByCredit} to order ${orderNumber}`,
          );
        }
      }

      await tx.partnerLedgerEntry.create({
        data: {
          salesChannelId: channel.id,
          orderId: newOrder.id,
          type: "RECEIVABLE",
          amount: totalAmount,
          remainingAmount: initialRemaining,
          status: initialStatus,
          description: `Imported order ${orderNumber} (External ID: ${partnerOrderId})${shippingAmount > 0
            ? ` | Shipping: $${shippingAmount.toFixed(2)}`
            : ""
            }`,
        },
      });

      // 4.4 Auto-mark order as paid if channel has autoPaid enabled
      if (channel.autoPaid) {
        await tx.transaction.create({
          data: {
            orderId: newOrder.id,
            amount: totalAmount,
            paymentStatus: "COMPLETED",
            paymentGatewayName: "MANUAL",
            paymentGatewayTransactionId: `auto-paid-${newOrder.orderNumber}`,
          },
        });
        await tx.payment.create({
          data: {
            orderId: newOrder.id,
            paymentMethod: "BANK_TRANSFER",
            provider: "sales_channel_auto_paid",
            amount: totalAmount,
            currency: "USD",
            status: "COMPLETED",
            paidAt: new Date(),
          },
        });
        console.log(
          `[SalesChannel] Auto-paid order ${newOrder.orderNumber} for channel ${channel.companyName}`,
        );
      }

      // 4.5 Update Sales Channel Balances (Optimization)
      await tx.salesChannel.update({
        where: { id: channel.id },
        data: {
          currentBalance: { increment: totalAmount },
          pendingBalance: { increment: totalAmount },
        },
      });

      // 4.3 Find Optimal Warehouse and Reserve Stock
      try {
        const warehouseResult = await findOptimalWarehouse(
          shippingAddress.id,
          orderItems,
        );

        if (warehouseResult && warehouseResult.warehouse) {
          console.log(
            `[SalesChannel] Reserving inventory from warehouse: ${warehouseResult.warehouse.id} for order ${newOrder.orderNumber}`,
          );
          await reserveInventoryFromWarehouse(
            warehouseResult.warehouse.id,
            orderItems,
            tx,
          );
        }
      } catch (warehouseError) {
        console.error(
          `[SalesChannel] Warehouse stock reservation failed for order ${newOrder.orderNumber}:`,
          warehouseError,
        );
        // We log the error but don't fail the order creation (back-office can handle stock issues if needed)
        // This matches the behavior in main orders.js where it might fallback or just log warnings
      }

      return newOrder;
    });

    // Trigger Odoo sync for affected products (non-blocking)
    (async () => {
      try {
        // Get unique product IDs from order items (need to look up from variantIds)
        const variants = await prisma.productVariant.findMany({
          where: { id: { in: orderItems.map((item) => item.variantId) } },
          select: { productId: true },
        });
        const productIds = [
          ...new Set(variants.map((v) => v.productId).filter(Boolean)),
        ];

        for (const productId of productIds) {
          await queueProductSync(
            productId,
            "ORDER_CREATED",
            `Sales Channel Order #${result.orderNumber} created via API`,
            {
              orderId: result.id,
              initiatedBy: "system",
              salesChannelId: channel.id,
            },
          );
        }
        console.log(
          `[SalesChannel] Queued Odoo sync for ${productIds.length} products from order ${result.orderNumber}`,
        );
      } catch (odooErr) {
        console.error(
          "[SalesChannel] Failed to queue Odoo sync for integration order:",
          odooErr?.message || odooErr,
        );
      }
    })();

    // Notify sales channel webhooks about inventory change from integration order
    const integrationOrderVariantIds = orderItems
      .map((item) => item.variantId)
      .filter(Boolean);
    if (integrationOrderVariantIds.length > 0) {
      const { notifySalesChannelWebhooks } = require("../utils/webhookService");
      notifySalesChannelWebhooks(integrationOrderVariantIds).catch((err) =>
        console.error("[INTEGRATION ORDER] Webhook notification failed:", err),
      );
    }

    res.status(201).json({
      success: true,
      data: {
        orderId: result.id,
        orderNumber: result.orderNumber,
        status: result.status,
        subtotal: subtotal,
        shippingAmount: shippingAmount,
        totalAmount: totalAmount,
        shippingTierApplied: matchedShippingTier
          ? {
            id: matchedShippingTier.id,
            uniqueTierId: matchedShippingTier.uniqueTierId || null,
            name: matchedShippingTier.name,
            serviceName: matchedShippingTier.serviceName || null,
          }
          : null,
        items: orderItems.map((item) => ({
          variantId: item.variantId,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
      },
    });
  }),
);

// -----------------------------------------------------------------------------
// 6d. Get Order Status (Protected by API Key)
// GET /integration/orders/:orderId — lookup by partnerOrderId OR internal order id
// -----------------------------------------------------------------------------
router.get(
  "/integration/orders/:orderId",
  asyncHandler(async (req, res) => {
    const apiKey = req.header("X-API-Key");
    if (!apiKey) {
      return res.status(401).json({ success: false, error: "Missing API Key" });
    }

    const channel = await prisma.salesChannel.findUnique({
      where: { apiKey },
    });

    if (!channel) {
      return res.status(401).json({ success: false, error: "Invalid API Key" });
    }

    if (channel.status !== "ACTIVE") {
      return res
        .status(403)
        .json({ success: false, error: "Sales Channel is not active" });
    }

    const { orderId } = req.params;

    // Shared include for order queries
    const orderInclude = {
      items: {
        select: {
          variantId: true,
          quantity: true,
          unitPrice: true,
          totalPrice: true,
          variant: {
            select: {
              sku: true,
              name: true,
              product: {
                select: { name: true },
              },
            },
          },
        },
      },
      shipments: {
        select: {
          id: true,
          carrier: true,
          trackingNumber: true,
          trackingUrl: true,
          status: true,
          shippedAt: true,
          deliveredAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
      trackingEvents: {
        select: {
          eventType: true,
          description: true,
          location: true,
          city: true,
          state: true,
          country: true,
          postalCode: true,
          occurredAt: true,
        },
        orderBy: { occurredAt: "desc" },
      },
    };

    // Try lookup by internal order id first, then by partnerOrderId
    let order = await prisma.order.findFirst({
      where: { id: orderId, salesChannelId: channel.id },
      include: orderInclude,
    });

    if (!order) {
      order = await prisma.order.findFirst({
        where: { partnerOrderId: String(orderId), salesChannelId: channel.id },
        include: orderInclude,
      });
    }

    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    res.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        partnerOrderId: order.partnerOrderId || null,
        status: order.status,
        shipmentRequestStatus: order.shipmentRequestStatus || null,
        trackingNumber: order.shipmentTrackingNumber || null,
        subtotal: Number(order.subtotal),
        discountAmount: Number(order.discountAmount),
        shippingAmount: Number(order.shippingAmount),
        taxAmount: Number(order.taxAmount),
        totalAmount: Number(order.totalAmount),
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        shippingAddress: {
          firstName: order.shippingFirstName || null,
          lastName: order.shippingLastName || null,
          address1: order.shippingAddress1 || null,
          address2: order.shippingAddress2 || null,
          city: order.shippingCity || null,
          state: order.shippingState || null,
          postalCode: order.shippingPostalCode || null,
          country: order.shippingCountry || null,
        },
        items: order.items.map((item) => ({
          variantId: item.variantId,
          sku: item.variant?.sku || null,
          productName: item.variant?.product?.name || null,
          variantName: item.variant?.name || null,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
        })),
        shipments: order.shipments.map((s) => ({
          id: s.id,
          carrier: s.carrier,
          trackingNumber: s.trackingNumber || null,
          trackingUrl: s.trackingUrl || null,
          status: s.status,
          shippedAt: s.shippedAt || null,
          deliveredAt: s.deliveredAt || null,
        })),
        trackingEvents: order.trackingEvents.map((e) => ({
          eventType: e.eventType,
          description: e.description,
          location: e.location || null,
          city: e.city || null,
          state: e.state || null,
          country: e.country || null,
          postalCode: e.postalCode || null,
          occurredAt: e.occurredAt,
        })),
      },
    });
  }),
);

// -----------------------------------------------------------------------------
// 6d. External Order Cancellation (Protected by API Key)
// -----------------------------------------------------------------------------
router.delete(
  "/integration/orders/:partnerOrderId",
  asyncHandler(async (req, res) => {
    const apiKey = req.header("X-API-Key");
    if (!apiKey) {
      return res.status(401).json({ success: false, error: "Missing API Key" });
    }

    const channel = await prisma.salesChannel.findUnique({
      where: { apiKey },
    });

    if (!channel) {
      return res.status(401).json({ success: false, error: "Invalid API Key" });
    }

    if (channel.status !== "ACTIVE") {
      return res
        .status(403)
        .json({ success: false, error: "Sales Channel is not active" });
    }

    const { partnerOrderId } = req.params;

    const order = await prisma.order.findFirst({
      where: {
        salesChannelId: channel.id,
        partnerOrderId: String(partnerOrderId),
      },
    });

    if (!order) {
      return res
        .status(404)
        .json({ success: false, error: "Order not found for this channel" });
    }

    if (order.status === "CANCELLED") {
      return res.json({
        success: true,
        message: "Order is already cancelled",
        orderId: order.id,
        orderNumber: order.orderNumber,
      });
    }

    // Update order status to CANCELLED
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED" },
    });

    res.json({
      success: true,
      message: "Order cancelled successfully",
      orderId: updatedOrder.id,
      orderNumber: updatedOrder.orderNumber,
    });
  }),
);

// PUT /api/sales-channels/integration/orders/:partnerOrderId
// Called by SwBiologix to push status updates
router.put(
  "/integration/orders/:partnerOrderId",
  asyncHandler(async (req, res) => {
    const apiKey = req.header("X-API-Key");
    if (!apiKey)
      return res.status(401).json({ success: false, error: "Missing API Key" });

    const channel = await prisma.salesChannel.findFirst({
      where: { apiKey, status: "ACTIVE" },
    });
    if (!channel)
      return res.status(401).json({ success: false, error: "Invalid API Key" });

    const { partnerOrderId } = req.params;
    const { status, paymentStatus } = req.body;

    const order = await prisma.order.findFirst({
      where: { salesChannelId: channel.id, partnerOrderId },
    });
    if (!order)
      return res.status(404).json({ success: false, error: "Order not found" });

    const updateData = {};
    if (status) updateData.status = status;
    if (paymentStatus) {
      // Try to update existing Payment records first
      const updatedCount = await prisma.payment.updateMany({
        where: { orderId: order.id, status: { in: ["PENDING"] } },
        data: {
          status: paymentStatus,
          ...(paymentStatus === "COMPLETED" ? { paidAt: new Date() } : {}),
        },
      });

      // If no Payment records existed (integration-created orders), create one
      if (updatedCount.count === 0) {
        const existingPayment = await prisma.payment.findFirst({
          where: { orderId: order.id },
        });
        if (!existingPayment) {
          await prisma.payment.create({
            data: {
              orderId: order.id,
              paymentMethod: "BANK_TRANSFER",
              provider: "partner_push",
              amount: order.totalAmount,
              status: paymentStatus,
              ...(paymentStatus === "COMPLETED" ? { paidAt: new Date() } : {}),
            },
          });
        }
      }
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: updateData,
    });

    res.json({
      success: true,
      data: { orderId: updated.id, status: updated.status },
    });
  }),
);

// -----------------------------------------------------------------------------
// 7. Get Channel Analytics
// -----------------------------------------------------------------------------
router.get(
  "/:id/analytics",
  authMiddleware,
  requireRole(["ADMIN", "STAFF"]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { range = "30d", from, to } = req.query;

    const channel = await prisma.salesChannel.findUnique({ where: { id } });
    if (!channel) {
      return res
        .status(404)
        .json({ success: false, error: "Channel not found" });
    }

    let startDate = new Date();
    let endDate = new Date();

    if (range === "custom" && from && to) {
      startDate = new Date(from);
      endDate = new Date(to);
    } else {
      switch (range) {
        case "1d":
          if (from) {
            startDate = new Date(from);
            endDate = new Date(from);
          } else {
            startDate.setDate(startDate.getDate() - 1);
          }
          break;
        case "7d":
          startDate.setDate(startDate.getDate() - 7);
          break;
        case "30d":
          startDate.setDate(startDate.getDate() - 30);
          break;
        case "60d":
          startDate.setDate(startDate.getDate() - 60);
          break;
        case "6m":
          startDate.setMonth(startDate.getMonth() - 6);
          break;
        case "1y":
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default:
          startDate.setDate(startDate.getDate() - 30);
      }
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    // Get all orders for this channel in range
    const orders = await prisma.order.findMany({
      where: {
        salesChannelId: id,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        totalAmount: true,
        createdAt: true,
        status: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Basic Aggregations
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce(
      (sum, o) => sum + Number(o.totalAmount),
      0,
    );
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Status distribution
    const statusCounts = orders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {});

    // Time Series generation
    const timeSeries = [];
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (range === "1d") {
      // Hourly buckets for single day
      for (let i = 0; i < 24; i++) {
        const hourDate = new Date(startDate);
        hourDate.setHours(i, 0, 0, 0);
        timeSeries.push({
          label: `${i.toString().padStart(2, "0")}:00`,
          date: hourDate.toISOString(),
          orders: 0,
          revenue: 0,
        });
      }

      orders.forEach((o) => {
        const hour = o.createdAt.getHours();
        if (timeSeries[hour]) {
          timeSeries[hour].orders += 1;
          timeSeries[hour].revenue += Number(o.totalAmount);
        }
      });
    } else {
      // Daily buckets for other ranges
      for (let i = 0; i <= diffDays; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split("T")[0];
        timeSeries.push({
          label: dateStr,
          date: dateStr,
          orders: 0,
          revenue: 0,
        });
      }

      orders.forEach((o) => {
        const dateStr = o.createdAt.toISOString().split("T")[0];
        const dayEntry = timeSeries.find((d) => d.label === dateStr);
        if (dayEntry) {
          dayEntry.orders += 1;
          dayEntry.revenue += Number(o.totalAmount);
        }
      });
    }

    res.json({
      success: true,
      data: {
        summary: {
          totalOrders,
          totalRevenue,
          avgOrderValue,
          statusCounts,
        },
        timeSeries,
      },
    });
  }),
);

// -----------------------------------------------------------------------------
// 8. Partner Billing - Configuration
// -----------------------------------------------------------------------------
router.get(
  "/:id/billing/config",
  authMiddleware,
  requireRole(["ADMIN", "STAFF"]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    let config = await prisma.partnerStatementConfig.findUnique({
      where: { salesChannelId: id },
    });

    if (!config) {
      // Create default config if not exists
      config = await prisma.partnerStatementConfig.create({
        data: { salesChannelId: id },
      });
    }

    res.json({ success: true, data: config });
  }),
);

router.put(
  "/:id/billing/config",
  authMiddleware,
  requireRole(["ADMIN"]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      billingCycleDays,
      balanceThreshold,
      orderCountThreshold,
      statementTotalThreshold,
      paymentInstructions,
      escalationDays,
    } = req.body;

    const config = await prisma.partnerStatementConfig.upsert({
      where: { salesChannelId: id },
      create: {
        salesChannelId: id,
        billingCycleDays: Number(billingCycleDays) || 14,
        balanceThreshold: balanceThreshold ? Number(balanceThreshold) : null,
        orderCountThreshold: orderCountThreshold
          ? Number(orderCountThreshold)
          : null,
        statementTotalThreshold: statementTotalThreshold
          ? Number(statementTotalThreshold)
          : null,
        paymentInstructions,
        escalationDays: Number(escalationDays) || 7,
      },
      update: {
        billingCycleDays: billingCycleDays
          ? Number(billingCycleDays)
          : undefined,
        balanceThreshold:
          balanceThreshold !== undefined ? Number(balanceThreshold) : undefined,
        orderCountThreshold:
          orderCountThreshold !== undefined
            ? Number(orderCountThreshold)
            : undefined,
        statementTotalThreshold:
          statementTotalThreshold !== undefined
            ? Number(statementTotalThreshold)
            : undefined,
        paymentInstructions,
        escalationDays: escalationDays ? Number(escalationDays) : undefined,
      },
    });

    res.json({ success: true, data: config });
  }),
);

// -----------------------------------------------------------------------------
// 9. Partner Billing - Ledger
// -----------------------------------------------------------------------------
router.get(
  "/:id/billing/ledger",
  authMiddleware,
  requireRole(["ADMIN", "STAFF"]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { page = 1, limit = 50, type, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      salesChannelId: id,
      type: type || undefined,
      status: status || undefined,
    };

    const [total, entries, channelData] = await Promise.all([
      prisma.partnerLedgerEntry.count({ where }),
      prisma.partnerLedgerEntry.findMany({
        where,
        skip: Number(skip),
        take: Number(limit),
        orderBy: { createdAt: "desc" },
        include: {
          order: {
            select: {
              orderNumber: true,
              status: true,
              totalAmount: true,
            },
          },
          statement: { select: { referenceId: true } },
        },
      }),
      prisma.salesChannel.findUnique({
        where: { id },
        select: { currentBalance: true, pendingBalance: true },
      }),
    ]);

    res.json({
      success: true,
      data: entries,
      currentBalance: Number(channelData?.currentBalance || 0),
      pendingBalance: Number(channelData?.pendingBalance || 0), // Also exposed now
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  }),
);

// -----------------------------------------------------------------------------
// 10. Partner Billing - Payments (FIFO Allocation)
// -----------------------------------------------------------------------------
router.post(
  "/:id/billing/payments",
  authMiddleware,
  requireRole(["ADMIN"]),
  [
    body("amount").isDecimal().withMessage("Amount must be a decimal"),
    body("referenceId").optional().isString(),
    body("description").optional().isString(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { amount, referenceId, description } = req.body;
    const paymentAmount = Number(amount);

    if (paymentAmount <= 0) {
      return res
        .status(400)
        .json({ success: false, error: "Amount must be greater than zero" });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the payment entry in the ledger
      const paymentEntry = await tx.partnerLedgerEntry.create({
        data: {
          salesChannelId: id,
          type: "PAYMENT",
          amount: paymentAmount,
          remainingAmount: 0,
          status: "PAID",
          referenceId,
          description:
            description || `Payment received - Ref: ${referenceId || "N/A"}`,
        },
      });

      // 1.5 Update Sales Channel Balances (Optimization)
      await tx.salesChannel.update({
        where: { id },
        data: {
          currentBalance: { decrement: paymentAmount },
          pendingBalance: { decrement: paymentAmount },
        },
      });

      // 2. FIFO Allocation Logic
      // Find all unpaid or partially paid receivables for this channel, oldest first
      const outstandingReceivables = await tx.partnerLedgerEntry.findMany({
        where: {
          salesChannelId: id,
          type: "RECEIVABLE",
          status: { in: ["UNPAID", "PARTIALLY_PAID"] },
        },
        orderBy: { createdAt: "asc" },
      });

      let remainingPayment = paymentAmount;

      for (const receivable of outstandingReceivables) {
        if (remainingPayment <= 0) break;

        const currentRemaining = Number(receivable.remainingAmount);

        if (remainingPayment >= currentRemaining) {
          // Fully pay this receivable
          remainingPayment -= currentRemaining;

          await tx.partnerLedgerEntry.update({
            where: { id: receivable.id },
            data: {
              remainingAmount: 0,
              status: "PAID",
            },
          });
        } else {
          // Partially pay this receivable
          const newRemaining = currentRemaining - remainingPayment;
          remainingPayment = 0;

          await tx.partnerLedgerEntry.update({
            where: { id: receivable.id },
            data: {
              remainingAmount: newRemaining,
              status: "PARTIALLY_PAID",
            },
          });
        }
      }

      return paymentEntry;
    });

    res.json({ success: true, data: result });
  }),
);

// -----------------------------------------------------------------------------
// 11. Partner Billing - Statements
// -----------------------------------------------------------------------------
router.get(
  "/:id/billing/statements",
  authMiddleware,
  requireRole(["ADMIN", "STAFF"]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [total, statements] = await Promise.all([
      prisma.partnerStatement.count({ where: { salesChannelId: id } }),
      prisma.partnerStatement.findMany({
        where: { salesChannelId: id },
        skip: Number(skip),
        take: Number(limit),
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { ledgerEntries: true } },
        },
      }),
    ]);

    res.json({
      success: true,
      data: statements,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  }),
);

// -----------------------------------------------------------------------------
// Manual Statement Generation
// -----------------------------------------------------------------------------
router.post(
  "/:id/generate-statement",
  authMiddleware,
  requireRole(["ADMIN", "STAFF"]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      generatePartnerStatements,
    } = require("../cron/partnerBillingScheduler");

    // Verify channel exists
    const channel = await prisma.salesChannel.findUnique({
      where: { id },
      include: { statementConfig: true },
    });

    if (!channel) {
      return res
        .status(404)
        .json({ success: false, message: "Sales channel not found" });
    }

    // Trigger statement generation for this specific channel
    const result = await generatePartnerStatements(id);

    res.json({
      success: true,
      message: "Statement generation triggered",
      data: result,
    });
  }),
);

// -----------------------------------------------------------------------------
// Mark Statement as Paid
// -----------------------------------------------------------------------------
router.post(
  "/:id/billing/statements/:statementId/pay",
  authMiddleware,
  requireRole(["ADMIN", "STAFF"]),
  asyncHandler(async (req, res) => {
    const { id, statementId } = req.params;

    // Calculate and create payment in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch Statement and Channel
      const statement = await tx.partnerStatement.findFirst({
        where: { id: statementId, salesChannelId: id },
        include: { salesChannel: true },
      });

      if (!statement) {
        throw new Error("Statement not found");
      }

      if (statement.status === "PAID") {
        throw new Error("Statement is already PAID");
      }

      // 2. Calculate Amount to Pay
      const amountToPay =
        Number(statement.totalAmount) - Number(statement.paidAmount);

      if (amountToPay <= 0) {
        // Maybe it was marked paid but status didn't update? Correction.
        await tx.partnerStatement.update({
          where: { id: statementId },
          data: { status: "PAID" },
        });
        return { message: "Statement was already fully paid. Status updated." };
      }

      // 3. Create Payment Ledger Entry
      await tx.partnerLedgerEntry.create({
        data: {
          salesChannelId: id,
          type: "PAYMENT",
          amount: amountToPay,
          remainingAmount: 0, // Assuming full allocation or generic payment
          status: "PAID",
          referenceId: statement.referenceId,
          description: `Payment for Statement ${statement.referenceId}`,
        },
      });

      // 4. Update Sales Channel Balances
      await tx.salesChannel.update({
        where: { id },
        data: {
          currentBalance: { decrement: amountToPay },
          pendingBalance: { decrement: amountToPay },
        },
      });

      // 5. Targeted Allocation: Pay off items IN THIS STATEMENT first
      // Find all unpaid receivables linked to this statement
      const statementItems = await tx.partnerLedgerEntry.findMany({
        where: {
          salesChannelId: id,
          statementId: statementId,
          type: "RECEIVABLE",
          status: { in: ["UNPAID", "PARTIALLY_PAID"] },
        },
      });

      let remainingPayment = amountToPay;

      // Pay specific statement items
      for (const item of statementItems) {
        if (remainingPayment <= 0.01) break;

        const openAmount = Number(item.remainingAmount);
        const allocate = Math.min(openAmount, remainingPayment);

        if (allocate > 0) {
          const newRemaining = openAmount - allocate;
          await tx.partnerLedgerEntry.update({
            where: { id: item.id },
            data: {
              remainingAmount: newRemaining,
              status: newRemaining <= 0.01 ? "PAID" : "PARTIALLY_PAID",
            },
          });
          remainingPayment -= allocate;
        }
      }

      // 6. Update Statement Status
      await tx.partnerStatement.update({
        where: { id: statementId },
        data: {
          status: "PAID",
          paidAmount: { increment: amountToPay },
          lastReminderAt: new Date(), // treating payment as an interaction
        },
      });

      return { success: true };
    });

    res.json(result);
  }),
);

// -----------------------------------------------------------------------------
// Manual Payment Reminder
// -----------------------------------------------------------------------------
router.post(
  "/:id/send-reminder/:statementId",
  authMiddleware,
  requireRole(["ADMIN", "STAFF"]),
  asyncHandler(async (req, res) => {
    const { id, statementId } = req.params;
    const { queueEmail } = require("../utils/emailService");

    // Verify statement exists and belongs to channel
    const statement = await prisma.partnerStatement.findFirst({
      where: {
        id: statementId,
        salesChannelId: id,
      },
      include: {
        salesChannel: {
          include: { statementConfig: true },
        },
      },
    });

    if (!statement) {
      return res
        .status(404)
        .json({ success: false, message: "Statement not found" });
    }

    // Queue reminder email
    await queueEmail({
      type: "TEMPLATE",
      templateType: "PARTNER_PAYMENT_REMINDER",
      recipientEmail:
        statement.salesChannel.contactEmail || "billing@placeholder.com",
      data: {
        companyName: statement.salesChannel.companyName,
        statementId: statement.referenceId,
        totalAmount: statement.totalAmount.toFixed(2),
        dueDate: statement.dueDate.toLocaleDateString(),
        paymentInstructions:
          statement.salesChannel.statementConfig?.paymentInstructions ||
          "Please pay via Bank Transfer.",
      },
    });

    // Update reminder count
    await prisma.partnerStatement.update({
      where: { id: statementId },
      data: {
        remindersSent: { increment: 1 },
        lastReminderAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: "Payment reminder sent successfully",
    });
  }),
);

// -----------------------------------------------------------------------------
// Export Ledger
// -----------------------------------------------------------------------------
router.get(
  "/:id/export-ledger",
  authMiddleware,
  requireRole(["ADMIN", "STAFF"]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { format = "csv" } = req.query;

    // Fetch ledger entries
    const entries = await prisma.partnerLedgerEntry.findMany({
      where: { salesChannelId: id },
      include: { order: true },
      orderBy: { createdAt: "desc" },
    });

    // Calculate running balance
    let runningBalance = 0;
    const enrichedEntries = entries
      .reverse()
      .map((entry) => {
        if (entry.type === "RECEIVABLE") {
          runningBalance += Number(entry.amount);
        } else if (entry.type === "PAYMENT") {
          runningBalance -= Number(entry.amount);
        }

        return {
          date: entry.createdAt.toLocaleDateString(),
          type: entry.type,
          description:
            entry.description ||
            (entry.order ? `Order ${entry.order.id}` : "N/A"),
          amount: Number(entry.amount).toFixed(2),
          runningBalance: runningBalance.toFixed(2),
          openAmount: Number(entry.remainingAmount).toFixed(2),
          status: entry.status,
        };
      })
      .reverse();

    if (format === "excel") {
      // Generate Excel
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Ledger");

      worksheet.columns = [
        { header: "Date", key: "date", width: 15 },
        { header: "Type", key: "type", width: 15 },
        { header: "Description", key: "description", width: 40 },
        { header: "Amount", key: "amount", width: 15 },
        { header: "Open Amount", key: "openAmount", width: 15 },
        { header: "Status", key: "status", width: 15 },
        { header: "Running Balance", key: "runningBalance", width: 18 },
      ];

      enrichedEntries.forEach((entry) => worksheet.addRow(entry));

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=ledger-${id}.xlsx`,
      );

      await workbook.xlsx.write(res);
      res.end();
    } else {
      // Generate CSV
      const csv = [
        [
          "Date",
          "Type",
          "Description",
          "Amount",
          "Open Amount",
          "Status",
          "Running Balance",
        ],
        ...enrichedEntries.map((e) => [
          e.date,
          e.type,
          e.description,
          e.amount,
          e.openAmount,
          e.status,
          e.runningBalance,
        ]),
      ]
        .map((row) => row.join(","))
        .join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=ledger-${id}.csv`,
      );
      res.send(csv);
    }
  }),
);

// -----------------------------------------------------------------------------
// Export Statements
// -----------------------------------------------------------------------------
router.get(
  "/:id/export-statements",
  authMiddleware,
  requireRole(["ADMIN", "STAFF"]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { format = "csv" } = req.query;

    // Fetch statements
    const statements = await prisma.partnerStatement.findMany({
      where: { salesChannelId: id },
      orderBy: { createdAt: "desc" },
    });

    const data = statements.map((stmt) => ({
      statementId: stmt.referenceId,
      date: stmt.createdAt.toLocaleDateString(),
      totalAmount: Number(stmt.totalAmount).toFixed(2),
      paidAmount: Number(stmt.paidAmount).toFixed(2),
      balance: (Number(stmt.totalAmount) - Number(stmt.paidAmount)).toFixed(2),
      dueDate: stmt.dueDate.toLocaleDateString(),
      status: stmt.status,
      remindersSent: stmt.remindersSent,
    }));

    if (format === "excel") {
      // Generate Excel
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Statements");

      worksheet.columns = [
        { header: "Statement ID", key: "statementId", width: 20 },
        { header: "Date", key: "date", width: 15 },
        { header: "Total Amount", key: "totalAmount", width: 15 },
        { header: "Paid Amount", key: "paidAmount", width: 15 },
        { header: "Balance", key: "balance", width: 15 },
        { header: "Due Date", key: "dueDate", width: 15 },
        { header: "Status", key: "status", width: 15 },
        { header: "Reminders Sent", key: "remindersSent", width: 15 },
      ];

      data.forEach((row) => worksheet.addRow(row));

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=statements-${id}.xlsx`,
      );

      await workbook.xlsx.write(res);
      res.end();
    } else {
      // Generate CSV
      const csv = [
        [
          "Statement ID",
          "Date",
          "Total Amount",
          "Paid Amount",
          "Balance",
          "Due Date",
          "Status",
          "Reminders Sent",
        ],
        ...data.map((s) => [
          s.statementId,
          s.date,
          s.totalAmount,
          s.paidAmount,
          s.balance,
          s.dueDate,
          s.status,
          s.remindersSent,
        ]),
      ]
        .map((row) => row.join(","))
        .join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=statements-${id}.csv`,
      );
      res.send(csv);
    }
  }),
);

// -----------------------------------------------------------------------------
// 12. Sales Channel Shipping Tiers - Public (X-API-Key)
// GET /integration/shipping-tiers — returns active tiers for the authenticated channel
// -----------------------------------------------------------------------------
router.get(
  "/integration/shipping-tiers",
  asyncHandler(async (req, res) => {
    const apiKey = req.header("X-API-Key");
    if (!apiKey) {
      return res.status(401).json({ success: false, error: "Missing API Key" });
    }

    const channel = await prisma.salesChannel.findUnique({
      where: { apiKey },
    });

    if (!channel) {
      return res.status(401).json({ success: false, error: "Invalid API Key" });
    }

    if (channel.status !== "ACTIVE") {
      return res
        .status(403)
        .json({ success: false, error: "Sales Channel is not active" });
    }

    const tiers = await prisma.salesChannelShippingTier.findMany({
      where: { salesChannelId: channel.id, isActive: true },
      orderBy: { minSubtotal: "asc" },
      select: {
        id: true,
        uniqueTierId: true,
        name: true,
        minSubtotal: true,
        maxSubtotal: true,
        shippingRate: true,
        serviceName: true,
      },
    });

    res.json({
      success: true,
      data: tiers.map((t) => ({
        ...t,
        minSubtotal: Number(t.minSubtotal),
        maxSubtotal: t.maxSubtotal !== null ? Number(t.maxSubtotal) : null,
        shippingRate: Number(t.shippingRate),
      })),
    });
  }),
);

// Note: To select a tier when creating an order, send one of:
//   shippingTierId: "<tier DB id>"   — exact DB id match
//   uniqueTierId: "<uniqueTierId>"   — e.g. "1_DAY", "2_DAY", "STANDARD"
// If neither is sent, the tier is auto-selected by subtotal range.

// -----------------------------------------------------------------------------
// 13. Sales Channel Shipping Tiers - Admin CRUD
// -----------------------------------------------------------------------------

// GET /:id/shipping-tiers — list all tiers for a channel (admin)
router.get(
  "/:id/shipping-tiers",
  authMiddleware,
  requireRole(["ADMIN", "STAFF"]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const channel = await prisma.salesChannel.findUnique({ where: { id } });
    if (!channel) {
      return res
        .status(404)
        .json({ success: false, error: "Sales Channel not found" });
    }

    const tiers = await prisma.salesChannelShippingTier.findMany({
      where: { salesChannelId: id },
      orderBy: { minSubtotal: "asc" },
    });

    res.json({
      success: true,
      data: tiers.map((t) => ({
        ...t,
        minSubtotal: Number(t.minSubtotal),
        maxSubtotal: t.maxSubtotal !== null ? Number(t.maxSubtotal) : null,
        shippingRate: Number(t.shippingRate),
      })),
    });
  }),
);

// POST /:id/shipping-tiers — create a tier for a channel
router.post(
  "/:id/shipping-tiers",
  authMiddleware,
  requireRole(["ADMIN"]),
  [
    body("name").notEmpty().withMessage("Name is required"),
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
      uniqueTierId,
    } = req.body;

    const channel = await prisma.salesChannel.findUnique({ where: { id } });
    if (!channel) {
      return res
        .status(404)
        .json({ success: false, error: "Sales Channel not found" });
    }

    const tier = await prisma.salesChannelShippingTier.create({
      data: {
        salesChannelId: id,
        uniqueTierId: uniqueTierId || null,
        name,
        minSubtotal,
        maxSubtotal: maxSubtotal ?? null,
        shippingRate,
        serviceName: serviceName || null,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        ...tier,
        minSubtotal: Number(tier.minSubtotal),
        maxSubtotal:
          tier.maxSubtotal !== null ? Number(tier.maxSubtotal) : null,
        shippingRate: Number(tier.shippingRate),
      },
    });
  }),
);

// PUT /:id/shipping-tiers/:tierId — update a tier
router.put(
  "/:id/shipping-tiers/:tierId",
  authMiddleware,
  requireRole(["ADMIN"]),
  [
    body("name").optional().notEmpty(),
    body("minSubtotal").optional().isDecimal(),
    body("maxSubtotal").optional({ nullable: true }).isDecimal(),
    body("shippingRate").optional().isDecimal(),
    body("serviceName").optional().isString(),
    body("isActive").optional().isBoolean(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id, tierId } = req.params;
    const {
      name,
      minSubtotal,
      maxSubtotal,
      shippingRate,
      serviceName,
      isActive,
      uniqueTierId,
    } = req.body;

    const existing = await prisma.salesChannelShippingTier.findFirst({
      where: { id: tierId, salesChannelId: id },
    });

    if (!existing) {
      return res
        .status(404)
        .json({ success: false, error: "Shipping tier not found" });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (uniqueTierId !== undefined)
      updateData.uniqueTierId = uniqueTierId || null;
    if (minSubtotal !== undefined) updateData.minSubtotal = minSubtotal;
    if (maxSubtotal !== undefined) updateData.maxSubtotal = maxSubtotal ?? null;
    if (shippingRate !== undefined) updateData.shippingRate = shippingRate;
    if (serviceName !== undefined) updateData.serviceName = serviceName || null;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updated = await prisma.salesChannelShippingTier.update({
      where: { id: tierId },
      data: updateData,
    });

    res.json({
      success: true,
      data: {
        ...updated,
        minSubtotal: Number(updated.minSubtotal),
        maxSubtotal:
          updated.maxSubtotal !== null ? Number(updated.maxSubtotal) : null,
        shippingRate: Number(updated.shippingRate),
      },
    });
  }),
);

// DELETE /:id/shipping-tiers/:tierId — delete a tier
router.delete(
  "/:id/shipping-tiers/:tierId",
  authMiddleware,
  requireRole(["ADMIN"]),
  asyncHandler(async (req, res) => {
    const { id, tierId } = req.params;

    const existing = await prisma.salesChannelShippingTier.findFirst({
      where: { id: tierId, salesChannelId: id },
    });

    if (!existing) {
      return res
        .status(404)
        .json({ success: false, error: "Shipping tier not found" });
    }

    await prisma.salesChannelShippingTier.delete({
      where: { id: tierId },
    });

    res.json({ success: true, message: "Shipping tier deleted successfully" });
  }),
);

module.exports = router;
