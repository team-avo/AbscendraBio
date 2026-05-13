const express = require("express");
const { body, param, query } = require("express-validator");
const prisma = require("../prisma/client");
const validateRequest = require("../middleware/validateRequest");
const { asyncHandler } = require("../middleware/errorHandler");
const { requireRole, requirePermission } = require("../middleware/auth");
const {
  syncShipStationInventory,
  syncSingleSkuInventory,
} = require("../utils/inventorySyncService");
const { queueProductSync } = require("../integrations/skydell_odoo");
const { notifySalesChannelWebhooks } = require("../utils/webhookService");
const { applyBulkMovement } = require("../services/inventory.service");

const router = express.Router();

// Get inventory for all variants
router.get(
  "/",
  requirePermission("INVENTORY", "READ"),
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("locationId")
      .optional()
      .isString()
      .withMessage("Location ID must be a string"),
    query("lowStock")
      .optional()
      .isBoolean()
      .withMessage("Low stock filter must be boolean"),
    query("outOfStock")
      .optional()
      .isBoolean()
      .withMessage("Out of stock filter must be boolean"),
    query("search")
      .optional()
      .isString()
      .withMessage("Search term must be a string"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const locationId = req.query.locationId;
    const lowStock = req.query.lowStock === "true";
    const outOfStock = req.query.outOfStock === "true";
    const search = req.query.search;

    // Build where clause for inventory rows
    const where = {};
    if (locationId) {
      where.locationId = locationId;
    }
    // Note: Prisma cannot compare two columns directly in a where clause using the JS client.
    // We'll apply lowStock/outOfStock filtering after fetching and combining results.
    if (search) {
      const searchTerms = search.split(/\s+/).filter(Boolean);
      if (searchTerms.length > 0) {
        where.variant = {
          AND: searchTerms.map((term) => ({
            OR: [
              { sku: { contains: term, mode: "insensitive" } },
              { name: { contains: term, mode: "insensitive" } },
              { product: { name: { contains: term, mode: "insensitive" } } },
            ],
          })),
        };
      }
    }

    // Fetch all matching inventory rows (no pagination yet)
    const inventoryRows = await prisma.inventory.findMany({
      where,
      select: {
        id: true,
        quantity: true,
        reservedQty: true,
        lowStockAlert: true,
        variant: {
          include: {
            product: {
              select: { name: true, status: true },
            },
          },
        },
        location: true,
        batches: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    // If location is filtered, we only show existing inventory rows for that location.
    // If no specific location filter, also include variants that have no inventory rows at all (quantity 0),
    // so the inventory screen lists all variants/products.
    let zeroInventoryRows = [];
    if (!locationId) {
      // Build search filter for variants without any inventory
      const variantWhere = {
        // No inventory records exist for this variant
        inventory: { none: {} },
      };
      if (search) {
        const searchTerms = search.split(/\s+/).filter(Boolean);
        if (searchTerms.length > 0) {
          variantWhere.AND = searchTerms.map((term) => ({
            OR: [
              { sku: { contains: term, mode: "insensitive" } },
              { name: { contains: term, mode: "insensitive" } },
              { product: { name: { contains: term, mode: "insensitive" } } },
            ],
          }));
        }
      }

      const variantsWithoutInventory = await prisma.productVariant.findMany({
        where: variantWhere,
        include: {
          product: { select: { name: true, status: true } },
        },
      });

      // Map these to synthetic inventory rows with quantity 0
      zeroInventoryRows = variantsWithoutInventory.map((variant) => ({
        id: `synthetic-${variant.id}`,
        quantity: 0,
        lowStockAlert: 10,
        variant: {
          id: variant.id,
          sku: variant.sku,
          name: variant.name,
          product: {
            name: variant.product?.name || "",
            status: variant.product?.status || "ACTIVE",
          },
        },
        location: {
          id: "",
          name: "Unassigned",
        },
        batches: [],
        updatedAt: variant.updatedAt || new Date(0),
      }));
    }

    let combined = [...inventoryRows, ...zeroInventoryRows];

    // Apply stock-level filters on the combined in-memory list (use available quantity = total - reserved)
    if (outOfStock) {
      combined = combined.filter((row) => {
        const total = row.quantity || 0;
        const reserved = row.reservedQty || 0;
        const available = Math.max(0, total - reserved);
        return available <= 0;
      });
    } else if (lowStock) {
      combined = combined.filter((row) => {
        const total = row.quantity || 0;
        const reserved = row.reservedQty || 0;
        const available = Math.max(0, total - reserved);
        const threshold = row.lowStockAlert || 0;
        return available > 0 && available <= threshold;
      });
    }

    // Sort combined list by updatedAt desc when available (fallback name)
    combined.sort((a, b) => {
      const aDate = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bDate = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bDate - aDate;
    });

    const total = combined.length;
    const paged = combined.slice(skip, skip + limit);

    res.json({
      success: true,
      data: {
        inventory: paged,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  }),
);

// Get aggregated inventory by variant (for inventory management page)
router.get(
  "/management",
  requirePermission("INVENTORY", "READ"),
  [
    query("search")
      .optional()
      .isString()
      .withMessage("Search term must be a string"),
    query("filter")
      .optional()
      .isIn(["all", "low-stock", "out-of-stock"])
      .withMessage("Filter must be all, low-stock, or out-of-stock"),
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
    const search = req.query.search;
    const filter = req.query.filter || "all";
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build where clause for variants
    const variantWhere = {
      isActive: true,
    };

    if (search) {
      const searchTerms = search.split(/\s+/).filter(Boolean);
      if (searchTerms.length > 0) {
        variantWhere.AND = searchTerms.map((term) => ({
          OR: [
            { sku: { contains: term, mode: "insensitive" } },
            { name: { contains: term, mode: "insensitive" } },
            { product: { name: { contains: term, mode: "insensitive" } } },
          ],
        }));
      }
    }

    // First, get total counts for badges (optimized - only counts, no data)
    const allVariants = await prisma.productVariant.findMany({
      where: variantWhere,
      select: {
        id: true,
        inventory: {
          select: {
            quantity: true,
            reservedQty: true,
            lowStockAlert: true,
          },
        },
      },
    });

    // Calculate aggregated totals for badge counts
    const aggregatedForCounts = allVariants.map((variant) => {
      const totalQuantity = variant.inventory.reduce(
        (sum, inv) => sum + Math.max(0, inv.quantity || 0),
        0,
      );
      const totalReserved = variant.inventory.reduce(
        (sum, inv) => sum + Math.max(0, Math.abs(inv.reservedQty || 0)),
        0,
      );
      const totalAvailable = Math.max(0, totalQuantity - totalReserved);
      const lowStockThreshold =
        variant.inventory.length > 0
          ? Math.min(...variant.inventory.map((inv) => inv.lowStockAlert || 10))
          : 10;

      return {
        available: totalAvailable,
        lowStockThreshold: lowStockThreshold,
      };
    });

    const totalCounts = {
      all: aggregatedForCounts.length,
      lowStock: aggregatedForCounts.filter(
        (item) =>
          item.available > 0 && item.available <= item.lowStockThreshold,
      ).length,
      outOfStock: aggregatedForCounts.filter((item) => item.available === 0)
        .length,
    };

    // Now fetch full data with pagination
    const variants = await prisma.productVariant.findMany({
      where: variantWhere,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            status: true,
            images: {
              take: 1,
              orderBy: { sortOrder: "asc" },
              select: { url: true },
            },
          },
        },
        inventory: {
          select: {
            quantity: true,
            reservedQty: true,
            lowStockAlert: true,
          },
        },
      },
      orderBy: [{ product: { name: "asc" } }, { name: "asc" }],
    });

    // Aggregate inventory by variant
    const aggregatedInventory = variants.map((variant) => {
      const totalQuantity = variant.inventory.reduce(
        (sum, inv) => sum + Math.max(0, inv.quantity || 0),
        0,
      );
      const totalReserved = variant.inventory.reduce(
        (sum, inv) => sum + Math.max(0, Math.abs(inv.reservedQty || 0)),
        0,
      );
      const totalAvailable = Math.max(0, totalQuantity - totalReserved);

      // Get the lowest stock alert threshold
      const lowStockThreshold =
        variant.inventory.length > 0
          ? Math.min(...variant.inventory.map((inv) => inv.lowStockAlert || 10))
          : 10;

      return {
        id: variant.id,
        productId: variant.product.id,
        productName: variant.product.name,
        productImage: variant.product.images[0]?.url || null,
        variantName: variant.name,
        sku: variant.sku,
        committed: totalReserved,
        available: totalAvailable,
        onHand: totalQuantity,
        lowStockThreshold: lowStockThreshold,
        barcode: variant.barcode || "",
        sellWhenOutOfStock: variant.sellWhenOutOfStock || false,
        price: parseFloat(
          variant.salePrice > 0 ? variant.salePrice : variant.regularPrice,
        ),
        regularPrice: parseFloat(variant.regularPrice),
        salePrice: variant.salePrice > 0 ? parseFloat(variant.salePrice) : null,
      };
    });

    // Apply filters
    let filteredInventory = aggregatedInventory;
    if (filter === "low-stock") {
      filteredInventory = aggregatedInventory.filter(
        (item) =>
          item.available > 0 && item.available <= item.lowStockThreshold,
      );
    } else if (filter === "out-of-stock") {
      filteredInventory = aggregatedInventory.filter(
        (item) => item.available === 0,
      );
    }

    // Apply pagination
    const total = filteredInventory.length;
    const paginatedInventory = filteredInventory.slice(skip, skip + limit);

    res.json({
      success: true,
      data: paginatedInventory,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      counts: totalCounts,
    });
  }),
);

// Get inventory details by variant ID with location breakdown
router.get(
  "/variant/:variantId/details",
  requirePermission("INVENTORY", "READ"),
  [
    param("variantId").isString().withMessage("Variant ID is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { variantId } = req.params;

    // Fetch variant with all inventory locations
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            status: true,
            images: {
              take: 1,
              orderBy: { sortOrder: "asc" },
              select: { url: true },
            },
          },
        },
        inventory: {
          include: {
            location: {
              select: {
                id: true,
                name: true,
                city: true,
                state: true,
              },
            },
          },
          orderBy: {
            location: {
              name: "asc",
            },
          },
        },
      },
    });

    if (!variant) {
      return res.status(404).json({
        success: false,
        error: "Variant not found",
      });
    }

    // Calculate totals
    const totalQuantity = variant.inventory.reduce(
      (sum, inv) => sum + (inv.quantity || 0),
      0,
    );
    const totalReserved = variant.inventory.reduce(
      (sum, inv) => sum + (inv.reservedQty || 0),
      0,
    );
    const totalAvailable = Math.max(0, totalQuantity - totalReserved);

    // Get the lowest stock alert threshold
    const lowStockThreshold =
      variant.inventory.length > 0
        ? Math.min(...variant.inventory.map((inv) => inv.lowStockAlert || 10))
        : 10;

    // Identify primary inventory (lowest ID) to match PUT logic
    const primaryInventory =
      variant.inventory.reduce(
        (prev, curr) => (!prev || curr.id < prev.id ? curr : prev),
        null,
      ) || variant.inventory[0];

    // Format location inventory
    const locationInventory = variant.inventory.map((inv) => ({
      locationId: inv.locationId,
      locationName: inv.location.name,
      locationCity: inv.location.city,
      locationState: inv.location.state,
      committed: inv.reservedQty || 0,
      available: Math.max(0, (inv.quantity || 0) - (inv.reservedQty || 0)),
      onHand: inv.quantity || 0,
      lowStockAlert: inv.lowStockAlert || 10,
      barcode: inv.barcode || "",
      sellWhenOutOfStock: inv.sellWhenOutOfStock || false,
    }));

    // Build response
    const response = {
      id: variant.id,
      productId: variant.product.id,
      productName: variant.product.name,
      productImage: variant.product.images[0]?.url || null,
      variantName: variant.name,
      sku: variant.sku,
      committed: totalReserved,
      available: totalAvailable,
      onHand: totalQuantity,
      lowStockThreshold: lowStockThreshold,
      barcode: primaryInventory?.barcode || "",
      sellWhenOutOfStock: primaryInventory?.sellWhenOutOfStock || false,
      price: parseFloat(
        variant.salePrice > 0 ? variant.salePrice : variant.regularPrice,
      ),
      regularPrice: parseFloat(variant.regularPrice),
      salePrice: variant.salePrice > 0 ? parseFloat(variant.salePrice) : null,
      locationInventory: locationInventory,
    };

    res.json({
      success: true,
      data: response,
    });
  }),
);

// Update variant inventory (updates the primary location)
router.put(
  "/variant/:variantId/update",
  requirePermission("INVENTORY", "UPDATE"),
  [
    param("variantId").isString().withMessage("Variant ID is required"),
    body("onHand")
      .optional()
      .isInt({ min: 0 })
      .withMessage("On hand quantity must be a non-negative integer"),
    body("committed")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Committed quantity must be a non-negative integer"),
    body("reason").optional().isString().withMessage("Reason must be a string"),
    body("barcode").optional().isString(),
    body("sellWhenOutOfStock").optional().isBoolean(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { variantId } = req.params;
    const { onHand, committed, reason, barcode, sellWhenOutOfStock } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      // Get all inventory records for this variant
      const inventoryRecords = await tx.inventory.findMany({
        where: { variantId },
        include: { location: true },
        orderBy: { id: "asc" },
      });

      if (inventoryRecords.length === 0) {
        throw new Error("No inventory records found for this variant");
      }

      // Update the first location's inventory (primary location)
      const primaryInventory = inventoryRecords[0];
      const oldQuantity = primaryInventory.quantity;

      // Prepare update data
      const updateData = {};
      if (onHand !== undefined) updateData.quantity = onHand;
      if (committed !== undefined) updateData.reservedQty = committed;
      if (barcode !== undefined) updateData.barcode = barcode;
      if (sellWhenOutOfStock !== undefined)
        updateData.sellWhenOutOfStock = sellWhenOutOfStock;

      let updatedInventory = primaryInventory;

      // Only update if there are changes
      if (Object.keys(updateData).length > 0) {
        updatedInventory = await tx.inventory.update({
          where: { id: primaryInventory.id },
          data: updateData,
          include: {
            variant: {
              include: {
                product: {
                  select: { name: true, status: true },
                },
              },
            },
            location: true,
          },
        });
      }

      // Create inventory movement record if quantity changed
      const newQuantity = updatedInventory.quantity;
      if (newQuantity !== oldQuantity) {
        const quantityChange = newQuantity - oldQuantity;
        const movementType = quantityChange > 0 ? "INBOUND" : "OUTBOUND";
        await tx.inventoryMovement.create({
          data: {
            inventoryId: primaryInventory.id,
            quantity: quantityChange,
            type: movementType,
            reason: reason || "Manual adjustment from inventory management",
          },
        });
      }

      return updatedInventory;
    });

    // Sync inventory to Odoo after successful update
    try {
      // Get productId for the variant
      const variantData = await prisma.productVariant.findUnique({
        where: { id: variantId },
        select: { productId: true },
      });

      if (variantData?.productId) {
        console.log(
          "[INVENTORY UPDATE] Queueing Odoo inventory sync for product:",
          variantData.productId,
        );
        await queueProductSync(
          variantData.productId,
          "INVENTORY_ADJUSTMENT_MANUAL",
          `Manual inventory adjustment via admin panel`,
          { initiatedBy: req.user?.id || "system" },
        ).catch((err) => {
          console.error(`[INVENTORY UPDATE] Failed to queue Odoo sync:`, err);
        });
      }
    } catch (odooErr) {
      console.error("[INVENTORY UPDATE] Odoo sync queueing failed:", odooErr);
      // Don't fail the inventory update if Odoo sync fails
    }

    // Notify sales channel webhooks about inventory change
    notifySalesChannelWebhooks([variantId]).catch((err) =>
      console.error("[INVENTORY UPDATE] Webhook notification failed:", err),
    );

    res.json({
      success: true,
      data: result,
      message: "Inventory updated successfully",
    });
  }),
);

// Update variant inventory for a specific location
router.put(
  "/variant/:variantId/location/:locationId/update",
  requirePermission("INVENTORY", "UPDATE"),
  [
    param("variantId").isString().withMessage("Variant ID is required"),
    param("locationId").isString().withMessage("Location ID is required"),
    body("onHand")
      .optional()
      .isInt({ min: 0 })
      .withMessage("On Hand must be a non-negative integer"),
    body("committed")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Committed must be a non-negative integer"),
    body("barcode").optional().isString(),
    body("sellWhenOutOfStock").optional().isBoolean(),
    body("reason").optional().isString(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { variantId, locationId } = req.params;
    const { onHand, committed, reason, barcode, sellWhenOutOfStock } = req.body;

    if (
      onHand === undefined &&
      committed === undefined &&
      barcode === undefined &&
      sellWhenOutOfStock === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "At least one field to update must be provided",
      });
    }

    // Find the inventory record
    const inventory = await prisma.inventory.findFirst({
      where: {
        variantId,
        locationId,
      },
    });

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: "Inventory record not found for this location",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create movement record(s) if quantity changes
      if (onHand !== undefined && onHand !== inventory.quantity) {
        await tx.inventoryMovement.create({
          data: {
            type: "ADJUSTMENT",
            quantity: onHand - inventory.quantity,
            reason: reason || "Manual location adjustment",
            inventoryId: inventory.id,
            // userId removed as it does not exist in the schema
          },
        });
      }

      // Update inventory
      const updatedInventory = await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          quantity: onHand !== undefined ? onHand : undefined,
          reservedQty: committed !== undefined ? committed : undefined,
          barcode: barcode !== undefined ? barcode : undefined,
          sellWhenOutOfStock:
            sellWhenOutOfStock !== undefined ? sellWhenOutOfStock : undefined,
        },
      });

      return updatedInventory;
    });

    // Sync inventory to Odoo after successful location update
    try {
      // Get productId for the variant
      const variantData = await prisma.productVariant.findUnique({
        where: { id: variantId },
        select: { productId: true },
      });

      if (variantData?.productId) {
        console.log(
          "[INVENTORY UPDATE] Queueing Odoo inventory sync for product:",
          variantData.productId,
        );
        await queueProductSync(
          variantData.productId,
          "INVENTORY_ADJUSTMENT_MANUAL",
          `Manual inventory adjustment at location ${locationId}`,
          { initiatedBy: req.user?.id || "system" },
        ).catch((err) => {
          console.error(`[INVENTORY UPDATE] Failed to queue Odoo sync:`, err);
        });
      }
    } catch (odooErr) {
      console.error("[INVENTORY UPDATE] Odoo sync queueing failed:", odooErr);
      // Don't fail the inventory update if Odoo sync fails
    }

    // Notify sales channel webhooks about inventory change
    notifySalesChannelWebhooks([variantId]).catch((err) =>
      console.error("[INVENTORY UPDATE] Webhook notification failed:", err),
    );

    res.json({
      success: true,
      data: result,
      message: "Location inventory updated successfully",
    });
  }),
);

// Get orders contributing to committed stock for a variant
router.get(
  "/variant/:variantId/committed-orders",
  requirePermission("INVENTORY", "READ"),
  [
    param("variantId").isString().withMessage("Variant ID is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { variantId } = req.params;

    // We filter for orders that are not SHIPPED, DELIVERED, CANCELLED, or REFUNDED
    // These statuses generally mean the items are still "committed" or held in the warehouse.
    const orders = await prisma.order.findMany({
      where: {
        items: {
          some: {
            variantId: variantId,
          },
        },
        status: {
          in: ["PENDING", "PROCESSING", "LABEL_CREATED", "ON_HOLD"],
        },
      },
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        items: {
          where: {
            variantId: variantId,
          },
          select: {
            quantity: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const formattedOrders = orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: `${order.customer.firstName} ${order.customer.lastName}`,
      customerEmail: order.customer.email,
      status: order.status,
      quantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
      createdAt: order.createdAt,
    }));

    res.json({
      success: true,
      data: formattedOrders,
    });
  }),
);

// Get inventory by variant ID
router.get(
  "/variant/:variantId",
  requirePermission("INVENTORY", "READ"),
  [
    param("variantId").isString().withMessage("Variant ID is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { variantId } = req.params;

    const inventory = await prisma.inventory.findMany({
      where: { variantId },
      include: {
        location: true,
        variant: {
          include: {
            product: {
              select: {
                name: true,
                status: true,
              },
            },
          },
        },
        batches: true,
      },
    });

    if (!inventory) {
      return res.status(404).json({
        success: false,
        error: "Inventory not found for this variant",
      });
    }

    res.json({
      success: true,
      data: inventory,
    });
  }),
);

// Update inventory
router.put(
  "/:id",
  requirePermission("INVENTORY", "UPDATE"),
  [
    param("id").isString().withMessage("Inventory ID is required"),
    body("quantity")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Quantity must be a non-negative integer"),
    body("lowStockAlert")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Low stock alert must be a non-negative integer"),
    body("reason").optional().isString().withMessage("Reason must be a string"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { quantity, lowStockAlert, reason } = req.body;

    // Start a transaction
    const result = await prisma.$transaction(async (prisma) => {
      // Get current inventory
      const currentInventory = await prisma.inventory.findUnique({
        where: { id },
        include: {
          variant: {
            include: {
              product: true,
            },
          },
          location: true,
        },
      });

      if (!currentInventory) {
        throw new Error("Inventory record not found");
      }

      // Calculate quantity change
      const quantityChange =
        quantity !== undefined ? quantity - currentInventory.quantity : 0;

      // Update inventory
      const updatedInventory = await prisma.inventory.update({
        where: { id },
        data: {
          quantity: quantity !== undefined ? quantity : undefined,
          lowStockAlert:
            lowStockAlert !== undefined ? lowStockAlert : undefined,
        },
        include: {
          variant: {
            include: {
              product: {
                select: {
                  name: true,
                  status: true,
                },
              },
            },
          },
          location: true,
        },
      });

      // Create inventory movement record
      if (quantityChange !== 0) {
        const movementType = quantityChange > 0 ? "INBOUND" : "OUTBOUND";
        await prisma.inventoryMovement.create({
          data: {
            inventoryId: currentInventory.id,
            quantity: quantityChange,
            type: movementType,
            reason:
              typeof reason === "string" && reason.trim().length > 0
                ? reason.trim()
                : "Manual adjustment",
          },
        });
      }

      return updatedInventory;
    });

    // Notify sales channel webhooks about inventory change
    if (result?.variantId) {
      notifySalesChannelWebhooks([result.variantId]).catch((err) =>
        console.error("[INVENTORY UPDATE] Webhook notification failed:", err),
      );
    }

    // Sync inventory to Odoo after successful update
    try {
      const productId =
        result?.variant?.product?.id || result?.variant?.productId;
      if (productId) {
        queueProductSync(
          productId,
          "INVENTORY_ADJUSTMENT_MANUAL",
          `Inventory update via PUT /:id`,
          { initiatedBy: req.user?.id || "system" },
        ).catch((err) =>
          console.error(
            "[INVENTORY UPDATE /:id] Failed to queue Odoo sync:",
            err,
          ),
        );
      }
    } catch (odooErr) {
      console.error(
        "[INVENTORY UPDATE /:id] Odoo sync queueing failed:",
        odooErr,
      );
    }

    res.json({
      success: true,
      data: result,
    });
  }),
);

// Create inventory movement
router.post(
  "/movement",
  requirePermission("INVENTORY", "CREATE"),
  [
    body("variantId").isString().withMessage("Variant ID is required"),
    body("locationId").isString().withMessage("Location ID is required"),
    body("quantity")
      .isInt({ min: 1 })
      .withMessage("Quantity must be a positive integer"),
    body("type")
      .isIn([
        "PURCHASE",
        "SALE",
        "RETURN",
        "ADJUSTMENT_IN",
        "ADJUSTMENT_OUT",
        "TRANSFER_IN",
        "TRANSFER_OUT",
      ])
      .withMessage("Invalid movement type"),
    body("reason").isString().withMessage("Reason is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { variantId, locationId, quantity, type, reason } = req.body;

    const result = await prisma.$transaction(async (prisma) => {
      // Get or create inventory record
      let inventory = await prisma.inventory.findFirst({
        where: {
          variantId,
          locationId,
        },
      });

      if (!inventory) {
        inventory = await prisma.inventory.create({
          data: {
            variantId,
            locationId,
            quantity: 0,
            lowStockAlert: 10, // Default low stock alert
          },
        });
      }

      // Update inventory quantity
      const quantityChange = [
        "PURCHASE",
        "RETURN",
        "ADJUSTMENT_IN",
        "TRANSFER_IN",
      ].includes(type)
        ? quantity
        : -quantity;

      const updatedInventory = await prisma.inventory.update({
        where: { id: inventory.id },
        data: {
          quantity: {
            increment: quantityChange,
          },
        },
        include: {
          variant: {
            include: {
              product: {
                select: {
                  name: true,
                  status: true,
                },
              },
            },
          },
          location: true,
        },
      });

      // Create movement record
      const movementType = [
        "PURCHASE",
        "RETURN",
        "ADJUSTMENT_IN",
        "TRANSFER_IN",
      ].includes(type)
        ? "INBOUND"
        : "OUTBOUND";
      const movement = await prisma.inventoryMovement.create({
        data: {
          inventoryId: inventory.id,
          quantity: quantityChange,
          type: movementType,
          reason,
        },
      });

      return { inventory: updatedInventory, movement };
    });

    // Notify sales channel webhooks about inventory change
    if (result?.inventory?.variantId) {
      notifySalesChannelWebhooks([result.inventory.variantId]).catch((err) =>
        console.error("[INVENTORY MOVEMENT] Webhook notification failed:", err),
      );
    }

    // Sync inventory to Odoo after movement
    try {
      const productId =
        result?.inventory?.variant?.product?.id ||
        result?.inventory?.variant?.productId;
      if (productId) {
        queueProductSync(
          productId,
          "INVENTORY_ADJUSTMENT_MANUAL",
          `Inventory movement (${req.body.type})`,
          { initiatedBy: req.user?.id || "system" },
        ).catch((err) =>
          console.error("[INVENTORY MOVEMENT] Failed to queue Odoo sync:", err),
        );
      }
    } catch (odooErr) {
      console.error("[INVENTORY MOVEMENT] Odoo sync queueing failed:", odooErr);
    }

    res.json({
      success: true,
      data: result,
    });
  }),
);

// Bulk adjust inventory (set absolute quantity or adjust by delta)
router.post(
  "/bulk/adjust",
  requirePermission("INVENTORY", "UPDATE"),
  [
    body("items").isArray({ min: 1 }).withMessage("items array is required"),
    body("items.*.id")
      .isString()
      .withMessage("Inventory id is required for each item"),
    body("items.*.quantity")
      .optional()
      .isInt({ min: 0 })
      .withMessage("quantity must be non-negative"),
    body("items.*.delta")
      .optional()
      .isInt()
      .withMessage("delta must be an integer"),
    body("reason").isString().withMessage("Reason is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { items, reason } = req.body;

    const results = await prisma.$transaction(async (tx) => {
      const processed = [];
      for (const item of items) {
        const current = await tx.inventory.findUnique({
          where: { id: item.id },
          include: { variant: { include: { product: true } }, location: true },
        });
        if (!current) {
          throw new Error(`Inventory record not found: ${item.id}`);
        }

        let newQuantity = current.quantity;
        if (typeof item.quantity === "number") {
          newQuantity = item.quantity;
        } else if (typeof item.delta === "number") {
          newQuantity = Math.max(0, current.quantity + item.delta);
        } else {
          throw new Error("Each item must include either quantity or delta");
        }

        const quantityChange = newQuantity - current.quantity;

        const updated = await tx.inventory.update({
          where: { id: current.id },
          data: { quantity: newQuantity },
          include: {
            variant: {
              include: { product: { select: { name: true, status: true } } },
            },
            location: true,
          },
        });

        if (quantityChange !== 0) {
          await tx.inventoryMovement.create({
            data: {
              inventoryId: current.id,
              quantity: quantityChange,
              type: quantityChange > 0 ? "INBOUND" : "OUTBOUND",
              reason,
            },
          });
        }

        processed.push(updated);
      }
      return processed;
    });

    // Notify sales channel webhooks about inventory changes
    const bulkAdjustVariantIds = [
      ...new Set(results.map((r) => r.variantId).filter(Boolean)),
    ];
    if (bulkAdjustVariantIds.length > 0) {
      notifySalesChannelWebhooks(bulkAdjustVariantIds).catch((err) =>
        console.error("[BULK ADJUST] Webhook notification failed:", err),
      );
    }

    // Sync affected products to Odoo
    try {
      const bulkAdjustProductIds = [
        ...new Set(
          results
            .map((r) => r.variant?.product?.id || r.variant?.productId)
            .filter(Boolean),
        ),
      ];
      for (const productId of bulkAdjustProductIds) {
        queueProductSync(
          productId,
          "INVENTORY_ADJUSTMENT_MANUAL",
          `Bulk inventory adjustment (${results.length} items)`,
          { initiatedBy: req.user?.id || "system" },
        ).catch((err) =>
          console.error("[BULK ADJUST] Failed to queue Odoo sync:", err),
        );
      }
    } catch (odooErr) {
      console.error("[BULK ADJUST] Odoo sync queueing failed:", odooErr);
    }

    res.json({
      success: true,
      data: { updated: results.length, items: results },
    });
  }),
);

// Bulk create movements (adjust by type across many items)
router.post(
  "/bulk/movement",
  requirePermission("INVENTORY", "CREATE"),
  [
    body("items").isArray({ min: 1 }).withMessage("items array is required"),
    body("items.*.variantId").isString().withMessage("variantId is required"),
    body("items.*.locationId").isString().withMessage("locationId is required"),
    body("items.*.quantity")
      .isInt({ min: 1 })
      .withMessage("quantity must be positive"),
    body("type")
      .isIn([
        "PURCHASE",
        "SALE",
        "RETURN",
        "ADJUSTMENT_IN",
        "ADJUSTMENT_OUT",
        "TRANSFER_IN",
        "TRANSFER_OUT",
      ])
      .withMessage("Invalid movement type"),
    body("reason").isString().withMessage("Reason is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { items, type, reason } = req.body;
    const results = await applyBulkMovement(items, type, reason, req.user && req.user.id);
    res.json({
      success: true,
      data: { processed: results.length, items: results },
    });
  }),
);

// Bulk transfer inventory to a target location
router.post(
  "/bulk/transfer",
  requirePermission("INVENTORY", "UPDATE"),
  [
    body("items").isArray({ min: 1 }).withMessage("items array is required"),
    body("items.*.id").isString().withMessage("Inventory id is required"),
    body("items.*.quantity")
      .optional()
      .isInt({ min: 0 })
      .withMessage("quantity must be >= 0"),
    body("targetLocationId")
      .isString()
      .withMessage("targetLocationId is required"),
    body("reason").isString().withMessage("Reason is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { items, targetLocationId, reason } = req.body;

    const results = await prisma.$transaction(async (tx) => {
      const processed = [];
      for (const item of items) {
        let inv;
        let isSynthetic = false;
        let syntheticVariantId = null;

        if (item.id.startsWith("synthetic-")) {
          isSynthetic = true;
          syntheticVariantId = item.id.replace("synthetic-", "");
          // For synthetic items, we treat this as an initialization/adjustment at the target
          // No source inventory exists to decrement
        } else {
          inv = await tx.inventory.findUnique({
            where: { id: item.id },
            include: { variant: true },
          });
          if (!inv) throw new Error(`Inventory not found: ${item.id}`);
        }

        if (!isSynthetic && inv.locationId === targetLocationId) {
          processed.push({ skipped: true, inventoryId: inv.id });
          continue;
        }

        // Determine quantity to transfer
        // For synthetic, quantity MUST be provided as we can't default to "total available"
        const transferQty =
          typeof item.quantity === "number"
            ? item.quantity
            : inv
              ? inv.quantity
              : 0;

        if (transferQty <= 0) {
          processed.push({
            skipped: true,
            inventoryId: item.id,
            reason: "Quantity <= 0",
          });
          continue;
        }

        // Decrement from source (only if real inventory)
        if (!isSynthetic) {
          await tx.inventory.update({
            where: { id: inv.id },
            data: { quantity: { decrement: transferQty } },
          });
          // Log outbound movement from source
          await tx.inventoryMovement.create({
            data: {
              inventoryId: inv.id,
              quantity: -transferQty,
              type: "OUTBOUND",
              reason,
            },
          });
        }

        // Create or find target inventory
        // Use syntheticVariantId if checking synthetic, otherwise inv.variantId
        const variantId = isSynthetic ? syntheticVariantId : inv.variantId;
        const lowStockAlert = !isSynthetic && inv ? inv.lowStockAlert : 10;

        let targetInv = await tx.inventory.findFirst({
          where: { variantId: variantId, locationId: targetLocationId },
        });
        if (!targetInv) {
          targetInv = await tx.inventory.create({
            data: {
              variantId: variantId,
              locationId: targetLocationId,
              quantity: 0,
              lowStockAlert: lowStockAlert,
            },
          });
        }

        // Increment target
        const updatedTarget = await tx.inventory.update({
          where: { id: targetInv.id },
          data: { quantity: { increment: transferQty } },
          include: {
            variant: {
              include: { product: { select: { name: true, status: true } } },
            },
            location: true,
          },
        });

        // Log inbound movement at target
        await tx.inventoryMovement.create({
          data: {
            inventoryId: targetInv.id,
            quantity: transferQty,
            type: "INBOUND",
            reason,
          },
        });

        processed.push({
          fromId: isSynthetic ? null : inv.id,
          toId: targetInv.id,
          quantity: transferQty,
          target: updatedTarget,
        });
        continue; // Continue to next item (skip the old logic block)

        /* 
           NOTE: The lines below are the original logic which is now effectively replaced by the block above 
           that handles both synthetic and normal cases efficiently in one flow. 
           I will structure the 'ReplacementContent' to fully replace the original loop body correctly.
        */
      }
      return processed;
    });

    // Notify sales channel webhooks about inventory changes from transfer
    const transferVariantIds = [
      ...new Set(
        results
          .filter((r) => !r.skipped && r.target?.variantId)
          .map((r) => r.target.variantId),
      ),
    ];
    if (transferVariantIds.length > 0) {
      notifySalesChannelWebhooks(transferVariantIds).catch((err) =>
        console.error("[BULK TRANSFER] Webhook notification failed:", err),
      );
    }

    // Sync affected products to Odoo
    try {
      const transferProductIds = [
        ...new Set(
          results
            .filter((r) => !r.skipped && r.target?.variant?.product)
            .map(
              (r) => r.target.variant.product.id || r.target.variant.productId,
            )
            .filter(Boolean),
        ),
      ];
      for (const productId of transferProductIds) {
        queueProductSync(
          productId,
          "INVENTORY_ADJUSTMENT_MANUAL",
          `Bulk inventory transfer to location`,
          { initiatedBy: req.user?.id || "system" },
        ).catch((err) =>
          console.error("[BULK TRANSFER] Failed to queue Odoo sync:", err),
        );
      }
    } catch (odooErr) {
      console.error("[BULK TRANSFER] Odoo sync queueing failed:", odooErr);
    }

    res.json({
      success: true,
      data: { transferred: results.length, items: results },
    });
  }),
);

// Check inventory availability for a variant
router.get(
  "/availability/:variantId",
  [
    param("variantId").isString().withMessage("Variant ID is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { variantId } = req.params;

    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        inventory: {
          select: {
            quantity: true,
            reservedQty: true,
            locationId: true,
            location: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!variant) {
      return res.status(404).json({
        success: false,
        error: "Variant not found",
      });
    }

    const availability = variant.inventory.map((inv) => ({
      locationId: inv.locationId,
      locationName: inv.location.name,
      totalQuantity: inv.quantity || 0,
      reservedQuantity: inv.reservedQty || 0,
      availableQuantity: Math.max(
        0,
        (inv.quantity || 0) - (inv.reservedQty || 0),
      ),
    }));

    const totalAvailable = availability.reduce(
      (sum, inv) => sum + inv.availableQuantity,
      0,
    );

    res.json({
      success: true,
      data: {
        variantId,
        totalAvailable,
        availability,
        inStock: totalAvailable > 0,
      },
    });
  }),
);

// Get all low stock inventory items
router.get(
  "/low-stock",
  requirePermission("INVENTORY", "READ"),
  asyncHandler(async (req, res) => {
    // Fetch all inventory items
    const allInventory = await prisma.inventory.findMany({
      include: {
        variant: {
          include: {
            product: {
              select: { name: true, status: true },
            },
          },
        },
        location: true,
        batches: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    // Filter for low stock items (quantity > 0 but <= lowStockAlert)
    const lowStockItems = allInventory.filter((item) => {
      const total = item.quantity || 0;
      const reserved = item.reservedQty || 0;
      const available = Math.max(0, total - reserved);
      const threshold = item.lowStockAlert || 0;
      return available > 0 && available <= threshold;
    });

    res.json({ success: true, data: lowStockItems });
  }),
);

// Get all out of stock inventory items
router.get(
  "/out-of-stock",
  requirePermission("INVENTORY", "READ"),
  asyncHandler(async (req, res) => {
    // Fetch all inventory items
    const allInventory = await prisma.inventory.findMany({
      include: {
        variant: {
          include: {
            product: {
              select: { name: true, status: true },
            },
          },
        },
        location: true,
        batches: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    // Filter for out of stock items (quantity <= 0)
    // Note: We use available quantity (total - reserved)
    const outOfStockItems = allInventory.filter((item) => {
      const total = item.quantity || 0;
      const reserved = item.reservedQty || 0;
      const available = Math.max(0, total - reserved);
      return available <= 0;
    });

    res.json({ success: true, data: outOfStockItems });
  }),
);

// Sync inventory from ShipStation (manual trigger)
router.post(
  "/sync/shipstation",
  requirePermission("INVENTORY", "WRITE"),
  asyncHandler(async (req, res) => {
    console.log("[INVENTORY SYNC] Manual sync endpoint triggered");
    const startTime = Date.now();
    const result = await syncShipStationInventory();
    const duration = Date.now() - startTime;

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          synced: result.synced,
          skipped: result.skipped,
          errors: result.errors,
          total: result.total,
          duration: `${duration}ms`,
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        message: result.message,
      });
    }
  }),
);

// Sync inventory for a specific SKU
router.post(
  "/sync/shipstation/:sku",
  requirePermission("INVENTORY", "WRITE"),
  [param("sku").isString().withMessage("SKU is required"), validateRequest],
  asyncHandler(async (req, res) => {
    const { sku } = req.params;
    console.log(`[INVENTORY SYNC] Sync endpoint triggered for SKU: ${sku}`);
    const result = await syncSingleSkuInventory(sku);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          sku: result.sku,
          quantity: result.quantity,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        message: result.message,
      });
    }
  }),
);

module.exports = router;
