const prisma = require("../prisma/client");
const { queueProductSync } = require("../integrations/skydell_odoo");
const { notifySalesChannelWebhooks } = require("../utils/webhookService");
const logger = require("../utils/logger");

const INBOUND_TYPES = ["PURCHASE", "RETURN", "ADJUSTMENT_IN", "TRANSFER_IN"];

const ALLOWED_TYPES = [
  "PURCHASE",
  "SALE",
  "RETURN",
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
  "TRANSFER_IN",
  "TRANSFER_OUT",
];

function isInbound(type) {
  return INBOUND_TYPES.includes(type);
}

/**
 * Apply a bulk inventory movement and return per-item results.
 *
 * Used by the existing POST /inventory/bulk/movement route and by the
 * supplier stock receipts approve endpoint. Behavior matches the original
 * inline implementation: creates Inventory rows on demand, updates quantity
 * via increment/decrement, writes an InventoryMovement per item, notifies
 * sales-channel webhooks, and queues an Odoo sync.
 *
 * @param {Array<{variantId: string, locationId: string, quantity: number}>} items
 * @param {string} type            one of ALLOWED_TYPES
 * @param {string} reason          required, persisted on InventoryMovement
 * @param {string|null} userId     for Odoo sync attribution
 * @returns {Promise<Array<{inventory: any, movement: any}>>}
 */
async function applyBulkMovement(items, type, reason, userId) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("items array is required");
  }
  if (!ALLOWED_TYPES.includes(type)) {
    throw new Error(`Invalid movement type: ${type}`);
  }
  if (typeof reason !== "string" || reason.trim().length === 0) {
    throw new Error("Reason is required");
  }

  const results = await prisma.$transaction(async (tx) => {
    const processed = [];
    for (const item of items) {
      let inv = await tx.inventory.findFirst({
        where: { variantId: item.variantId, locationId: item.locationId },
      });
      if (!inv) {
        inv = await tx.inventory.create({
          data: {
            variantId: item.variantId,
            locationId: item.locationId,
            quantity: 0,
            lowStockAlert: 10,
          },
        });
      }

      const delta = isInbound(type) ? item.quantity : -item.quantity;

      const updated = await tx.inventory.update({
        where: { id: inv.id },
        data: { quantity: { increment: delta } },
        include: {
          variant: {
            include: { product: { select: { id: true, name: true, status: true } } },
          },
          location: true,
        },
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          inventoryId: inv.id,
          quantity: delta,
          type: isInbound(type) ? "INBOUND" : "OUTBOUND",
          reason,
        },
      });

      processed.push({ inventory: updated, movement });
    }
    return processed;
  });

  // Notify sales channel webhooks about inventory changes
  const variantIds = [
    ...new Set(results.map((r) => r.inventory && r.inventory.variantId).filter(Boolean)),
  ];
  if (variantIds.length > 0) {
    notifySalesChannelWebhooks(variantIds).catch((err) =>
      logger.error(`[BULK MOVEMENT] Webhook notification failed: ${err.message}`),
    );
  }

  // Sync affected products to Odoo
  try {
    const productIds = [
      ...new Set(
        results
          .map(
            (r) =>
              (r.inventory && r.inventory.variant && r.inventory.variant.product && r.inventory.variant.product.id) ||
              (r.inventory && r.inventory.variant && r.inventory.variant.productId),
          )
          .filter(Boolean),
      ),
    ];
    for (const productId of productIds) {
      queueProductSync(
        productId,
        "INVENTORY_ADJUSTMENT_MANUAL",
        `Bulk inventory movement (${type}, ${results.length} items)`,
        { initiatedBy: userId || "system" },
      ).catch((err) =>
        logger.error(`[BULK MOVEMENT] Failed to queue Odoo sync: ${err.message}`),
      );
    }
  } catch (odooErr) {
    logger.error(`[BULK MOVEMENT] Odoo sync queueing failed: ${odooErr.message}`);
  }

  return results;
}

module.exports = {
  applyBulkMovement,
  ALLOWED_TYPES,
  INBOUND_TYPES,
};
