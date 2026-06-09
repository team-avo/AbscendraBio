/**
 * Side effects to run when an order's status changes during automated tracking
 * sync (the hourly label cron). Two concerns, each fully defensive — they log
 * and swallow their own errors so they can NEVER break the status sync:
 *
 *   recordOrderStatusChange()      -> writes an AuditLog history entry
 *   adjustInventoryForStatusChange -> releases reserved stock + decrements
 *                                     on-hand quantity when goods physically
 *                                     leave (first transition into SHIPPED/DELIVERED)
 */
const prisma = require('../prisma/client');
const logger = require('../utils/logger');

// Statuses that mean "not yet physically shipped".
const PRE_SHIP_STATUSES = new Set(['PENDING', 'PROCESSING', 'LABEL_CREATED', 'ON_HOLD']);
// Statuses that mean "goods have left".
const SHIPPED_OUT_STATUSES = new Set(['SHIPPED', 'DELIVERED']);

// Cache the system user used to attribute cron-initiated audit entries.
let systemUserIdPromise;
async function getSystemUserId() {
  if (!systemUserIdPromise) {
    systemUserIdPromise = prisma.user
      .findFirst({ where: { role: 'ADMIN' }, select: { id: true } })
      .then((u) => u?.id || null)
      .catch(() => null);
  }
  return systemUserIdPromise;
}

/**
 * Write an order status-change audit record (reuses the AuditLog model used by
 * the rest of the app). Attributed to a system admin user since the cron has no
 * request user.
 * @returns {Promise<boolean>} true if written
 */
async function recordOrderStatusChange({ orderId, orderNumber, fromStatus, toStatus, source = 'LABEL_TRACKING_SYNC' }) {
  try {
    const userId = await getSystemUserId();
    if (!userId) {
      logger.warn('[orderStatusEffects] No system user found; skipping audit log');
      return false;
    }
    await prisma.auditLog.create({
      data: {
        orderId,
        userId,
        action: 'ORDER_STATUS_CHANGED',
        details: { orderNumber, fromStatus, toStatus, source },
      },
    });
    return true;
  } catch (err) {
    logger.warn(`[orderStatusEffects] Failed to write audit for order ${orderNumber}: ${err.message}`);
    return false;
  }
}

/**
 * Adjust inventory when an order's goods physically leave the warehouse.
 *
 * Only acts on the FIRST transition out of a pre-ship status into SHIPPED or
 * DELIVERED (so SHIPPED -> DELIVERED is a no-op and we never double-decrement).
 * For each order item it releases the reservation (reservedQty) and decrements
 * on-hand quantity, recording an OUTBOUND InventoryMovement.
 *
 * @param {object} order  order with `items` (each with variantId/quantity) loaded
 * @param {string} fromStatus
 * @param {string} toStatus
 * @returns {Promise<{adjusted:number, skipped:boolean}>}
 */
async function adjustInventoryForStatusChange(order, fromStatus, toStatus) {
  // Only when goods leave for the first time.
  if (!(PRE_SHIP_STATUSES.has(fromStatus) && SHIPPED_OUT_STATUSES.has(toStatus))) {
    return { adjusted: 0, skipped: true };
  }

  const items = order.items || [];
  let adjusted = 0;

  for (const item of items) {
    try {
      const variantId = item.variantId || item.variant?.id;
      const qty = item.quantity || 0;
      if (!variantId || qty <= 0) continue;

      // Pick the inventory record holding the reservation (highest reservedQty),
      // else the one with the most on-hand stock.
      const inv =
        (await prisma.inventory.findFirst({
          where: { variantId, reservedQty: { gt: 0 } },
          orderBy: { reservedQty: 'desc' },
        })) ||
        (await prisma.inventory.findFirst({
          where: { variantId },
          orderBy: { quantity: 'desc' },
        }));

      if (!inv) continue;

      const newQuantity = Math.max(0, inv.quantity - qty);
      const newReserved = Math.max(0, inv.reservedQty - qty);

      await prisma.inventory.update({
        where: { id: inv.id },
        data: { quantity: newQuantity, reservedQty: newReserved },
      });

      await prisma.inventoryMovement.create({
        data: {
          inventoryId: inv.id,
          type: 'OUTBOUND',
          quantity: qty,
          reason: `Order #${order.orderNumber} ${String(toStatus).toLowerCase()} (label tracking sync)`,
        },
      });
      adjusted += 1;
    } catch (err) {
      logger.warn(`[orderStatusEffects] Inventory adjust failed for order ${order.orderNumber}, variant ${item.variantId}: ${err.message}`);
    }
  }

  if (adjusted > 0) {
    logger.info(`[orderStatusEffects] Adjusted inventory for ${adjusted} item(s) on order ${order.orderNumber} (${fromStatus} -> ${toStatus})`);
  }
  return { adjusted, skipped: false };
}

module.exports = { recordOrderStatusChange, adjustInventoryForStatusChange };
