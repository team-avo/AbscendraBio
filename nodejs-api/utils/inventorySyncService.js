const prisma = require("../prisma/client");
const { ssRequest } = require("./shipstationClient");
const { notifySalesChannelWebhooks } = require("./webhookService");
const { queueProductSync } = require("../integrations/skydell_odoo");

/**
 * Sync inventory from ShipStation to database
 * Fetches inventory levels from ShipStation API and updates the Inventory quantity column
 * Matches ShipStation SKU with ProductVariant shipstationSku
 */
async function syncShipStationInventory() {
  try {
    console.log("[INVENTORY SYNC] Starting ShipStation inventory sync...");

    // Fetch all inventory from ShipStation
    let allInventory = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      try {
        console.log(
          `[INVENTORY SYNC] Fetching ShipStation inventory page ${page}...`,
        );
        const response = await ssRequest(
          "GET",
          `/v2/inventory?page_size=100&page=${page}`,
        );

        if (
          response.data &&
          response.data.inventory &&
          response.data.inventory.length > 0
        ) {
          allInventory = allInventory.concat(response.data.inventory);
          console.log(
            `[INVENTORY SYNC] Page ${page}: ${response.data.inventory.length} items fetched`,
          );

          if (response.data.pages && page < response.data.pages) {
            page++;
          } else {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      } catch (pageError) {
        console.error(
          `[INVENTORY SYNC] Error fetching page ${page}:`,
          pageError.message,
        );
        hasMore = false;
      }
    }

    console.log(
      `[INVENTORY SYNC] Total items fetched from ShipStation: ${allInventory.length}`,
    );

    if (allInventory.length === 0) {
      console.warn("[INVENTORY SYNC] No inventory items found in ShipStation");
      return {
        success: true,
        synced: 0,
        skipped: 0,
        errors: 0,
        total: 0,
        message: "No items to sync",
      };
    }

    // Get all product variants with shipstationSku
    const variants = await prisma.productVariant.findMany({
      select: {
        id: true,
        productId: true,
        shipstationSku: true,
        name: true,
        product: { select: { name: true } },
      },
    });

    console.log(
      `[INVENTORY SYNC] Found ${variants.length} product variants in database`,
    );

    // Create a map of shipstationSku -> variant for quick lookup
    const skuToVariant = {};
    variants.forEach((variant) => {
      if (variant.shipstationSku) {
        skuToVariant[variant.shipstationSku] = variant;
      }
    });

    console.log(
      `[INVENTORY SYNC] Variants with shipstationSku: ${Object.keys(skuToVariant).length}`,
    );

    // Get or create default location
    let location = await prisma.location.findFirst({
      where: { isActive: true },
    });
    if (!location) {
      location = await prisma.location.create({
        data: { name: "Main Warehouse", isActive: true },
      });
      console.log("[INVENTORY SYNC] Created default location");
    }

    let synced = 0;
    let skipped = 0;
    let errors = 0;
    const syncedVariantIds = [];

    // Process each inventory item from ShipStation
    for (const ssItem of allInventory) {
      try {
        const shipstationSku = ssItem.sku;
        const quantity = ssItem.available || ssItem.on_hand || 0;

        console.log(
          `[INVENTORY SYNC] Processing SKU: ${shipstationSku}, Quantity: ${quantity}`,
        );

        // Find matching variant by shipstationSku
        const variant = skuToVariant[shipstationSku];

        if (!variant) {
          console.warn(
            `[INVENTORY SYNC] No variant found for SKU: ${shipstationSku}`,
          );
          skipped++;
          continue;
        }

        // Get or create inventory record
        let inventory = await prisma.inventory.findUnique({
          where: {
            variantId_locationId: {
              variantId: variant.id,
              locationId: location.id,
            },
          },
        });

        if (!inventory) {
          // Create new inventory record
          await prisma.inventory.create({
            data: {
              variantId: variant.id,
              locationId: location.id,
              quantity: quantity,
              reservedQty: 0,
              lowStockAlert: 10,
            },
          });
          console.log(
            `[INVENTORY SYNC] Created inventory for ${variant.product.name}: ${quantity} units`,
          );
        } else {
          // Update existing inventory record
          const oldQuantity = inventory.quantity;
          await prisma.inventory.update({
            where: { id: inventory.id },
            data: { quantity: quantity, updatedAt: new Date() },
          });
          console.log(
            `[INVENTORY SYNC] Updated ${variant.product.name}: ${oldQuantity} → ${quantity} units`,
          );
        }

        synced++;
        syncedVariantIds.push(variant.id);
      } catch (itemError) {
        console.error(
          `[INVENTORY SYNC] Error processing SKU ${ssItem.sku}:`,
          itemError.message,
        );
        errors++;
      }
    }

    console.log(
      `[INVENTORY SYNC] Sync completed: ${synced} synced, ${skipped} skipped, ${errors} errors`,
    );

    // Notify sales channel webhooks about all synced variants
    if (syncedVariantIds.length > 0) {
      notifySalesChannelWebhooks(syncedVariantIds).catch((err) =>
        console.error("[INVENTORY SYNC] Webhook notification failed:", err),
      );
    }

    // Queue Odoo sync for all affected products (ShipStation bulk inventory sync)
    try {
      const syncedProductIds = [
        ...new Set(
          syncedVariantIds
            .map((vid) => {
              const v = variants.find((vr) => vr.id === vid);
              return v?.productId;
            })
            .filter(Boolean),
        ),
      ];
      for (const productId of syncedProductIds) {
        queueProductSync(
          productId,
          "INVENTORY_UPDATE",
          "ShipStation bulk inventory sync",
        ).catch((err) =>
          console.error(
            "[ODOO SYNC] Failed to queue after ShipStation sync:",
            err.message,
          ),
        );
      }
    } catch (syncErr) {
      console.error(
        "[ODOO SYNC] Error queuing sync after ShipStation bulk sync:",
        syncErr.message,
      );
    }

    return {
      success: true,
      synced,
      skipped,
      errors,
      total: allInventory.length,
      message: `Synced ${synced} items from ShipStation`,
    };
  } catch (error) {
    console.error("[INVENTORY SYNC] Fatal error:", error);
    return {
      success: false,
      error: error.message,
      message: "Failed to sync inventory from ShipStation",
      synced: 0,
      skipped: 0,
      errors: 1,
      total: 0,
    };
  }
}

/**
 * Sync inventory for a specific SKU
 */
async function syncSingleSkuInventory(sku) {
  try {
    console.log(`[INVENTORY SYNC] Syncing single SKU: ${sku}`);

    // Fetch inventory for this SKU from ShipStation
    const response = await ssRequest("GET", `/v2/inventory?sku=${sku}`);

    if (
      !response.data ||
      !response.data.inventory ||
      response.data.inventory.length === 0
    ) {
      console.warn(`[INVENTORY SYNC] No inventory found for SKU: ${sku}`);
      return { success: false, message: "SKU not found in ShipStation" };
    }

    const ssItem = response.data.inventory[0];

    // Extract quantity from ShipStation response
    // Use 'available' (already accounts for reserved items)
    // Fallback to 'on_hand' if available is not present
    let quantity = 0;
    if (ssItem.available !== undefined) {
      quantity = ssItem.available;
    } else if (ssItem.on_hand !== undefined) {
      quantity = ssItem.on_hand;
    } else if (ssItem.quantity !== undefined) {
      if (
        typeof ssItem.quantity === "object" &&
        ssItem.quantity.available !== undefined
      ) {
        quantity = ssItem.quantity.available;
      } else if (
        typeof ssItem.quantity === "object" &&
        ssItem.quantity.onHand !== undefined
      ) {
        quantity = ssItem.quantity.onHand;
      } else if (typeof ssItem.quantity === "number") {
        quantity = ssItem.quantity;
      }
    }

    // Find variant by shipstationSku only
    const variant = await prisma.productVariant.findFirst({
      where: {
        shipstationSku: sku,
      },
      select: {
        id: true,
        productId: true,
        sku: true,
        shipstationSku: true,
      },
    });

    if (!variant) {
      console.warn(`[INVENTORY SYNC] No variant found for SKU: ${sku}`);
      return { success: false, message: "Variant not found in database" };
    }

    // Get default location
    let location = await prisma.location.findFirst({
      where: { isActive: true },
    });

    if (!location) {
      location = await prisma.location.create({
        data: {
          name: "Main Warehouse",
          isActive: true,
        },
      });
    }

    // Update or create inventory
    let inventory = await prisma.inventory.findUnique({
      where: {
        variantId_locationId: {
          variantId: variant.id,
          locationId: location.id,
        },
      },
    });

    if (!inventory) {
      inventory = await prisma.inventory.create({
        data: {
          variantId: variant.id,
          locationId: location.id,
          quantity: quantity,
          reservedQty: 0,
          lowStockAlert: 10,
        },
      });
    } else {
      inventory = await prisma.inventory.update({
        where: { id: inventory.id },
        data: {
          quantity: quantity,
          updatedAt: new Date(),
        },
      });
    }

    console.log(`[INVENTORY SYNC] Updated SKU ${sku}: ${quantity} units`);

    // Notify sales channel webhooks
    notifySalesChannelWebhooks([variant.id]).catch((err) =>
      console.error("[INVENTORY SYNC] Webhook notification failed:", err),
    );

    // Queue Odoo sync for the affected product (single SKU sync)
    if (variant.productId) {
      queueProductSync(
        variant.productId,
        "INVENTORY_UPDATE",
        "ShipStation single SKU sync",
        { sku },
      ).catch((err) =>
        console.error(
          "[ODOO SYNC] Failed to queue after single SKU sync:",
          err.message,
        ),
      );
    }

    return {
      success: true,
      sku,
      quantity: ssItem.quantity,
      message: `Updated inventory for SKU ${sku}`,
    };
  } catch (error) {
    console.error(`[INVENTORY SYNC] Error syncing SKU ${sku}:`, error);
    return {
      success: false,
      error: error.message,
      message: `Failed to sync SKU ${sku}`,
    };
  }
}

module.exports = {
  syncShipStationInventory,
  syncSingleSkuInventory,
};
