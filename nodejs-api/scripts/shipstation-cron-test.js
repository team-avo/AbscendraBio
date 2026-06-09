/**
 * Tests the NEW label-tracking cron behaviors added for spec parity:
 *   - PU/DP event detection drives LABEL_CREATED -> SHIPPED
 *   - recordOrderStatusChange writes an AuditLog
 *   - adjustInventoryForStatusChange releases reserved + decrements on-hand
 *   - writeLabelSyncLog writes a LabelSyncLog row
 *
 * ShipStation's tracking call is stubbed via globalThis.fetch (set BEFORE the
 * client module loads, since it captures fetch at require time). Uses a real
 * throwaway order + a real inventory row whose values are restored afterward.
 *
 *   node scripts/shipstation-cron-test.js
 */
require('dotenv').config();

const INV_ID = 'cmnyxg9p6004dxmstd0c5zhct';
const VARIANT_ID = 'cmnyxg9op003lxmstquiq6yf6';
const CUSTOMER_ID = 'cmnyxg9oe0038xmstjvk02snt';
const stamp = Date.now();
const orderNumber = `CRON-${stamp}`;
const trackingNumber = `CRON-TRK-${stamp}`;
const LABEL_ID = `se-test-cron-${stamp}`;

// --- stub fetch BEFORE requiring the client (it captures fetch at load) ---
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes('/v2/labels/') && u.includes('/track')) {
    const body = JSON.stringify({
      tracking_number: trackingNumber,
      carrier_code: 'usps',
      status_code: 'UN', // NOT in any status set — forces reliance on the PU event
      status_detail_code: '',
      status_description: 'In progress',
      events: [{ event_code: 'PU', description: 'Picked Up', occurred_at: new Date(stamp).toISOString() }],
    });
    return { ok: true, status: 200, headers: { get: () => null }, text: async () => body };
  }
  return realFetch(url, init);
};

const prisma = require('../prisma/client');
const cron = require('../cron/labelTrackingSync');
const { adjustInventoryForStatusChange } = require('../services/orderStatusEffects');

const results = [];
function check(name, cond, detail) {
  results.push(!!cond);
  console.log(`  ${cond ? '✅' : '❌'} ${name}${detail ? '  — ' + detail : ''}`);
}

async function main() {
  console.log('\n=== ShipStation Cron Parity Test (PU/DP + audit + inventory + LabelSyncLog) ===\n');
  let order;
  const inv0 = await prisma.inventory.findUnique({ where: { id: INV_ID } });

  try {
    // Seed a reservation so we can watch it get released.
    await prisma.inventory.update({ where: { id: INV_ID }, data: { reservedQty: 5 } });

    order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: CUSTOMER_ID,
        subtotal: 10, totalAmount: 10,
        status: 'LABEL_CREATED',
        shipstationLabel: { label_id: LABEL_ID },
        items: { create: [{ variantId: VARIANT_ID, quantity: 1, unitPrice: 10, totalPrice: 10 }] },
      },
    });

    // Load like the cron does (customer + items.variant).
    const loaded = await prisma.order.findUnique({
      where: { id: order.id },
      include: { customer: true, items: { include: { variant: true } } },
    });

    // --- run the cron's single-order sync (hits the stubbed tracking) ---
    const result = await cron.syncSingleOrder(loaded);
    check('1. PU event drove LABEL_CREATED -> SHIPPED', result.action === 'updated' && result.to === 'SHIPPED', `action=${result.action} to=${result.to}`);

    const after = await prisma.order.findUnique({ where: { id: order.id } });
    check('2. Order status persisted SHIPPED', after.status === 'SHIPPED', `status=${after.status}`);

    const audit = await prisma.auditLog.findFirst({ where: { orderId: order.id, action: 'ORDER_STATUS_CHANGED' } });
    check('3. AuditLog written', !!audit, audit ? `details=${JSON.stringify(audit.details)}` : 'none');

    const invAfter = await prisma.inventory.findUnique({ where: { id: INV_ID } });
    check('4. Inventory on-hand decremented (5 -> ?)', invAfter.quantity === inv0.quantity - 1, `quantity ${inv0.quantity} -> ${invAfter.quantity}`);
    check('5. Reserved released (5 -> 4)', invAfter.reservedQty === 4, `reservedQty 5 -> ${invAfter.reservedQty}`);

    const movement = await prisma.inventoryMovement.findFirst({ where: { inventoryId: INV_ID, reason: { contains: orderNumber } } });
    check('6. OUTBOUND InventoryMovement recorded', movement && movement.type === 'OUTBOUND', movement ? `qty=${movement.quantity}` : 'none');

    // --- LabelSyncLog ---
    await cron.writeLabelSyncLog(loaded, result);
    const lsl = await prisma.labelSyncLog.findFirst({ where: { orderNumber } });
    check('7. LabelSyncLog written (SUCCESS)', lsl && lsl.syncStatus === 'SUCCESS', lsl ? `before=${lsl.statusBefore} after=${lsl.statusAfter}` : 'none');

    // --- idempotency: SHIPPED -> DELIVERED must NOT decrement again ---
    const r = await adjustInventoryForStatusChange(loaded, 'SHIPPED', 'DELIVERED');
    const invFinal = await prisma.inventory.findUnique({ where: { id: INV_ID } });
    check('8. SHIPPED->DELIVERED does not re-decrement', r.skipped === true && invFinal.quantity === invAfter.quantity, `skipped=${r.skipped}`);
  } catch (err) {
    check('FLOW', false, err.message);
  } finally {
    // cleanup (children first, then order; restore inventory + fetch)
    if (order) {
      await prisma.inventoryMovement.deleteMany({ where: { reason: { contains: orderNumber } } }).catch(() => {});
      await prisma.labelSyncLog.deleteMany({ where: { orderNumber } }).catch(() => {});
      await prisma.shipment.deleteMany({ where: { orderId: order.id } }).catch(() => {});
      await prisma.shipmentTrackingEvent.deleteMany({ where: { orderId: order.id } }).catch(() => {});
      await prisma.shippingStatus.deleteMany({ where: { orderId: order.id } }).catch(() => {});
      await prisma.auditLog.deleteMany({ where: { orderId: order.id } }).catch(() => {});
      await prisma.orderItem.deleteMany({ where: { orderId: order.id } }).catch(() => {});
      await prisma.order.delete({ where: { id: order.id } }).catch(() => {});
    }
    if (inv0) await prisma.inventory.update({ where: { id: INV_ID }, data: { quantity: inv0.quantity, reservedQty: inv0.reservedQty } }).catch(() => {});
    globalThis.fetch = realFetch;
    await prisma.$disconnect();
  }

  const passed = results.filter(Boolean).length;
  console.log(`\n=== Summary: ${passed}/${results.length} passed ===\n`);
  process.exit(passed === results.length ? 0 : 1);
}
main().catch((e) => { console.error('crashed:', e); process.exit(1); });
