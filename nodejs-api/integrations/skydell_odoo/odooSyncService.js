/**
 * Odoo Inventory Sync Service
 *
 * Core business logic for syncing product inventory to Odoo.
 * Handles stock calculation, dynamic pricing, and variant attributes.
 */

const prisma = require("../../prisma/client");
const odooClient = require("./odooClient");

/**
 * Calculate total available stock for a variant across all locations
 * Available stock = (quantity - reservedQty) summed across all locations
 *
 * @param {string} variantId - ProductVariant ID
 * @returns {Promise<number>} - Total available stock
 */
async function calculateAvailableStock(variantId) {
  const inventoryRecords = await prisma.inventory.findMany({
    where: {
      variantId: variantId,
      location: {
        isActive: true,
      },
    },
    select: {
      quantity: true,
      reservedQty: true,
    },
  });

  let totalAvailable = 0;
  for (const record of inventoryRecords) {
    const available = record.quantity - (record.reservedQty || 0);
    totalAvailable += Math.max(0, available); // Don't allow negative stock
  }

  return totalAvailable;
}

/**
 * Get variant price from linked Sales Channel
 * Falls back to variant's regular price if no channel price exists
 *
 * @param {string} variantId - ProductVariant ID
 * @param {string|null} salesChannelId - Sales Channel ID (from config)
 * @param {number} fallbackPrice - Variant's regular price
 * @returns {Promise<number>} - Price for Odoo
 */
async function getVariantPriceForChannel(
  variantId,
  salesChannelId,
  fallbackPrice,
) {
  if (!salesChannelId) {
    console.log(
      `[OdooSyncService] No sales channel linked, using fallback price: ${fallbackPrice}`,
    );
    return fallbackPrice || 0;
  }

  const channelPrice = await prisma.salesChannelPrice.findUnique({
    where: {
      salesChannelId_variantId: {
        salesChannelId: salesChannelId,
        variantId: variantId,
      },
    },
    select: {
      price: true,
    },
  });

  if (channelPrice) {
    const price = parseFloat(channelPrice.price);
    console.log(
      `[OdooSyncService] Found channel price for variant ${variantId}: ${price}`,
    );
    return price;
  }

  console.log(
    `[OdooSyncService] No channel price, using fallback: ${fallbackPrice}`,
  );
  return fallbackPrice || 0;
}

/**
 * Get variant options as attributes object for Odoo
 * Maps VariantOption name/value pairs to { "Name": "Value" } format
 * Also includes variant name as "Strength" attribute if not already present
 *
 * @param {string} variantId - ProductVariant ID
 * @param {string} variantName - Variant name (e.g., "5mg", "10mg") to use as Strength
 * @returns {Promise<Object>} - Attributes object for Odoo
 */
async function getVariantAttributes(variantId, variantName = null) {
  const options = await prisma.variantOption.findMany({
    where: { variantId: variantId },
    select: {
      name: true,
      value: true,
    },
  });

  const attributes = {};
  for (const option of options) {
    attributes[option.name] = option.value;
  }

  // If no "Strength" attribute exists and we have a variant name, use it as Strength
  if (!attributes["Strength"] && variantName) {
    attributes["Strength"] = variantName;
  }

  return attributes;
}

/**
 * Build Odoo product payload from variant data
 *
 * @param {Object} variant - ProductVariant with product relation
 * @param {number} availableStock - Total available stock
 * @returns {Object} - Odoo product payload
 */
function buildOdooProductPayload(variant, availableStock) {
  // Combine product name and variant name: "Product - Variant"
  const fullName = `${variant.product.name} - ${variant.name}`;

  return {
    name: fullName,
    default_code: variant.sku,
    vendor_on_hand_qty: availableStock,
  };
}

/**
 * Sync an entire product with all its variants to Odoo in a single API call
 * This is more efficient than syncing each variant separately
 *
 * @param {string} productId - Product ID
 * @param {string} triggerType - Sync trigger type (enum value)
 * @param {string} triggerReason - Human-readable reason
 * @param {Object} context - Additional context (orderId, initiatedBy, etc.)
 * @returns {Promise<Object>} - Sync result
 */
async function syncProductToOdoo(
  productId,
  triggerType = "MANUAL_FULL",
  triggerReason = null,
  context = {},
) {
  console.log(
    `[OdooSyncService] Starting product sync for ${productId}, trigger: ${triggerType}`,
  );

  // Check if integration is enabled
  const enabled = await odooClient.isIntegrationEnabled();
  if (!enabled) {
    console.log(`[OdooSyncService] Integration is disabled, skipping sync`);
    return {
      success: false,
      skipped: true,
      reason: "Integration is disabled",
    };
  }

  const salesChannelId = await odooClient.getLinkedSalesChannelId();

  try {
    // Fetch product with all active variants
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: {
          where: { isActive: true },
          include: {
            inventory: {
              where: {
                location: { isActive: true },
              },
              select: {
                quantity: true,
                reservedQty: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    if (product.status !== "ACTIVE") {
      console.log(
        `[OdooSyncService] Skipping inactive product ${product.name}`,
      );
      return {
        success: false,
        skipped: true,
        reason: "Product is inactive",
      };
    }

    // Filter variants that have prices in the linked sales channel
    let variantsToSync = product.variants;
    if (salesChannelId) {
      const channelPrices = await prisma.salesChannelPrice.findMany({
        where: {
          salesChannelId: salesChannelId,
          variantId: { in: product.variants.map((v) => v.id) },
        },
        select: { variantId: true, price: true },
      });

      const priceMap = new Map(
        channelPrices.map((p) => [p.variantId, parseFloat(p.price)]),
      );
      variantsToSync = product.variants.filter((v) => priceMap.has(v.id));

      if (variantsToSync.length === 0) {
        console.log(
          `[OdooSyncService] No variants of product ${product.name} have prices in sales channel`,
        );
        return {
          success: false,
          skipped: true,
          reason: "No variants in linked sales channel price list",
        };
      }
    }

    // Build variants array for Odoo API
    const variantsPayload = [];
    let totalStock = 0;

    for (const variant of variantsToSync) {
      // Calculate available stock for this variant
      let availableStock = 0;
      for (const inv of variant.inventory) {
        const available = (inv.quantity || 0) - (inv.reservedQty || 0);
        availableStock += Math.max(0, available);
      }
      totalStock += availableStock;

      // Get price from sales channel or fallback
      let price = parseFloat(variant.regularPrice || 0);
      if (salesChannelId) {
        const channelPrice = await prisma.salesChannelPrice.findUnique({
          where: {
            salesChannelId_variantId: {
              salesChannelId: salesChannelId,
              variantId: variant.id,
            },
          },
        });
        if (channelPrice) {
          price = parseFloat(channelPrice.price);
        }
      }

      // Get attributes (use variant name as Strength)
      const attributes = await getVariantAttributes(variant.id, variant.name);

      variantsPayload.push({
        default_code: variant.sku,
        vendor_on_hand_qty: availableStock,
        price: price,
        attributes: attributes,
      });
    }

    // Use the first variant's SKU as the base product SKU for Odoo
    const baseVariant = variantsToSync[0];
    const productPayload = {
      name: product.name,
      default_code: baseVariant.sku, // Use first variant SKU as product code
      vendor_on_hand_qty: totalStock,
    };

    // Check if product exists in Odoo (check by first variant SKU)
    let exists = await odooClient.productExists(baseVariant.sku);

    let odooResult;
    let requestPayload;

    if (exists) {
      // Update existing product with all variants
      console.log(
        `[OdooSyncService] Updating product ${product.name} with ${variantsPayload.length} variants in Odoo`,
      );
      requestPayload = {
        default_code: baseVariant.sku,
        product: { vendor_on_hand_qty: totalStock },
        supplier: { price: variantsPayload[0]?.price || 0 },
        variants: variantsPayload,
      };
      odooResult = await odooClient.updateProductWithVariants(
        baseVariant.sku,
        { vendor_on_hand_qty: totalStock },
        { price: variantsPayload[0]?.price || 0 },
        variantsPayload,
      );
    } else {
      // Create new product with all variants
      console.log(
        `[OdooSyncService] Creating product ${product.name} with ${variantsPayload.length} variants in Odoo`,
      );
      requestPayload = {
        product: productPayload,
        supplier: { price: variantsPayload[0]?.price || 0 },
        variants: variantsPayload,
      };
      odooResult = await odooClient.createProductWithVariants(
        productPayload,
        { price: variantsPayload[0]?.price || 0 },
        variantsPayload,
      );

      // If CREATE failed because a variant SKU already exists in Odoo, fall back to UPDATE.
      // This handles cases where productExists() returned false but Odoo already has the
      // product (e.g. readProduct lookup returned an error-shaped 200 that looked like
      // "not found", or the product was created via a different code path).
      if (
        !odooResult.success &&
        odooResult.appError === "variant_default_code_exists"
      ) {
        console.log(
          `[OdooSyncService] CREATE failed (variant_default_code_exists) — retrying as UPDATE for ${product.name}`,
        );
        exists = true;
        requestPayload = {
          default_code: baseVariant.sku,
          product: { vendor_on_hand_qty: totalStock },
          supplier: { price: variantsPayload[0]?.price || 0 },
          variants: variantsPayload,
        };
        odooResult = await odooClient.updateProductWithVariants(
          baseVariant.sku,
          { vendor_on_hand_qty: totalStock },
          { price: variantsPayload[0]?.price || 0 },
          variantsPayload,
        );
      }
    }

    // Log the sync attempt (one log per product, not per variant)
    const syncLog = await prisma.odooSyncLog.create({
      data: {
        triggerType: triggerType,
        triggerReason:
          triggerReason || `Synced ${variantsPayload.length} variants`,
        variantId: baseVariant.id,
        variantSku: variantsPayload.map((v) => v.default_code).join(", "),
        productId: product.id,
        productName: product.name,
        orderId: context.orderId || null,
        httpMethod: "POST",
        endpoint: exists
          ? "/vendor_api/product/update"
          : "/vendor_api/product/create",
        statusCode: odooResult.status || null,
        requestPayload: requestPayload,
        responsePayload: odooResult.data || odooResult.error || null,
        status: odooResult.success ? "SUCCESS" : "FAILED",
        errorMessage: odooResult.success
          ? null
          : odooResult.errorMessage ||
            JSON.stringify(odooResult.error) ||
            "Unknown error",
        duration: odooResult.duration || null,
        initiatedBy: context.initiatedBy || "system",
        salesChannelId: salesChannelId || null,
      },
    });

    console.log(
      `[OdooSyncService] Product sync ${odooResult.success ? "succeeded" : "failed"} for ${product.name} (${variantsPayload.length} variants)`,
    );

    return {
      success: odooResult.success,
      productId: product.id,
      productName: product.name,
      variantCount: variantsPayload.length,
      variantSkus: variantsPayload.map((v) => v.default_code),
      logId: syncLog.id,
      odooResponse: odooResult,
    };
  } catch (error) {
    console.error(
      `[OdooSyncService] Error syncing product ${productId}:`,
      error,
    );

    try {
      const syncLog = await prisma.odooSyncLog.create({
        data: {
          triggerType: triggerType,
          triggerReason: triggerReason,
          productId: productId,
          variantSku: "UNKNOWN",
          orderId: context.orderId || null,
          requestPayload: { error: "Failed before request" },
          responsePayload: null,
          status: "FAILED",
          errorMessage: error.message,
          initiatedBy: context.initiatedBy || "system",
          salesChannelId: salesChannelId || null,
        },
      });

      return {
        success: false,
        productId: productId,
        logId: syncLog.id,
        error: error.message,
      };
    } catch (logError) {
      console.error(`[OdooSyncService] Failed to create error log:`, logError);
      throw error;
    }
  }
}

/**
 * Sync a single variant to Odoo (syncs the entire parent product)
 * This is a convenience wrapper that finds the product and syncs all its variants
 *
 * @param {string} variantId - ProductVariant ID
 * @param {string} triggerType - Sync trigger type (enum value)
 * @param {string} triggerReason - Human-readable reason (e.g., "Order #ORD-001 created")
 * @param {Object} context - Additional context (orderId, initiatedBy, etc.)
 * @returns {Promise<Object>} - Sync result with log ID
 */
async function syncVariantToOdoo(
  variantId,
  triggerType = "MANUAL_FULL",
  triggerReason = null,
  context = {},
) {
  console.log(
    `[OdooSyncService] Sync requested for variant ${variantId}, finding parent product...`,
  );

  // Find the variant's product
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: {
      id: true,
      sku: true,
      productId: true,
      product: {
        select: { id: true, name: true },
      },
    },
  });

  if (!variant) {
    console.error(`[OdooSyncService] Variant ${variantId} not found`);
    return {
      success: false,
      error: `Variant ${variantId} not found`,
    };
  }

  // Sync the entire product (which includes all variants)
  return syncProductToOdoo(
    variant.productId,
    triggerType,
    triggerReason,
    context,
  );
}

/**
 * Sync all active products to Odoo (grouped by product, one API call per product)
 *
 * @param {string} triggerType - Sync trigger type
 * @returns {Promise<Object>} - Sync summary
 */
async function syncAllVariantsToOdoo(triggerType = "MANUAL_FULL") {
  console.log(`[OdooSyncService] Starting full sync, trigger: ${triggerType}`);

  // Check if integration is enabled
  const enabled = await odooClient.isIntegrationEnabled();
  if (!enabled) {
    console.log(
      `[OdooSyncService] Integration is disabled, skipping full sync`,
    );
    return {
      success: false,
      skipped: true,
      reason: "Integration is disabled",
    };
  }

  const startTime = Date.now();
  const results = {
    totalProducts: 0,
    totalVariants: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    details: [],
  };

  try {
    // Fetch all active products with their active variants count
    const products = await prisma.product.findMany({
      where: {
        status: "ACTIVE",
        variants: {
          some: { isActive: true },
        },
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            variants: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    results.totalProducts = products.length;
    results.totalVariants = products.reduce(
      (sum, p) => sum + p._count.variants,
      0,
    );
    console.log(
      `[OdooSyncService] Found ${results.totalProducts} active products with ${results.totalVariants} variants to sync`,
    );

    // Sync each product (all its variants in one API call)
    for (const product of products) {
      const syncResult = await syncProductToOdoo(product.id, triggerType);

      if (syncResult.skipped) {
        results.skipped++;
      } else if (syncResult.success) {
        results.succeeded++;
      } else {
        results.failed++;
      }

      results.details.push({
        productId: product.id,
        productName: product.name,
        variantCount: syncResult.variantCount || 0,
        success: syncResult.success,
        skipped: syncResult.skipped || false,
        logId: syncResult.logId,
      });
    }

    // Update config with sync stats
    await updateSyncStats(results.succeeded, results.totalProducts);

    const duration = Date.now() - startTime;
    console.log(`[OdooSyncService] Full sync completed in ${duration}ms:`, {
      totalProducts: results.totalProducts,
      totalVariants: results.totalVariants,
      succeeded: results.succeeded,
      failed: results.failed,
      skipped: results.skipped,
    });

    return {
      success: true,
      duration,
      ...results,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(
      `[OdooSyncService] Full sync failed after ${duration}ms:`,
      error,
    );

    return {
      success: false,
      duration,
      error: error.message,
      ...results,
    };
  }
}

/**
 * Update sync statistics in config
 */
async function updateSyncStats(syncedProducts, totalProducts) {
  try {
    const config = await prisma.odooIntegrationConfig.findFirst();
    if (config) {
      await prisma.odooIntegrationConfig.update({
        where: { id: config.id },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: `Synced ${syncedProducts}/${totalProducts} products`,
          syncedVariants: syncedProducts, // Keep field name for compatibility
        },
      });
      odooClient.clearConfigCache();
    }
  } catch (error) {
    console.error(`[OdooSyncService] Failed to update sync stats:`, error);
  }
}

module.exports = {
  calculateAvailableStock,
  getVariantPriceForChannel,
  getVariantAttributes,
  syncVariantToOdoo,
  syncProductToOdoo,
  syncAllVariantsToOdoo,
};
