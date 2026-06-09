/**
 * Deletes ALL demo data seeded by shipstation-demo-seed.js (orderNumber "DEMO-*").
 *   node scripts/shipstation-demo-cleanup.js
 */
require('dotenv').config();
const p = require('../prisma/client');

(async () => {
  const orders = await p.order.findMany({ where: { orderNumber: { startsWith: 'DEMO-' } }, select: { id: true, orderNumber: true } });
  const ids = orders.map((o) => o.id);
  let removed = { orders: 0, shippingStatus: 0, labelSyncLog: 0, trackingEvents: 0, audit: 0, shipments: 0, items: 0 };

  if (ids.length) {
    removed.labelSyncLog = (await p.labelSyncLog.deleteMany({ where: { OR: [{ orderId: { in: ids } }, { orderNumber: { startsWith: 'DEMO-' } }] } })).count;
    removed.shippingStatus = (await p.shippingStatus.deleteMany({ where: { orderId: { in: ids } } })).count;
    removed.trackingEvents = (await p.shipmentTrackingEvent.deleteMany({ where: { orderId: { in: ids } } })).count;
    removed.audit = (await p.auditLog.deleteMany({ where: { orderId: { in: ids } } })).count;
    removed.shipments = (await p.shipment.deleteMany({ where: { orderId: { in: ids } } })).count;
    removed.items = (await p.orderItem.deleteMany({ where: { orderId: { in: ids } } })).count;
    removed.orders = (await p.order.deleteMany({ where: { id: { in: ids } } })).count;
  }
  // belt-and-suspenders: any stray demo label sync logs / shipping statuses by tag
  removed.labelSyncLog += (await p.labelSyncLog.deleteMany({ where: { orderNumber: { startsWith: 'DEMO-' } } })).count;
  removed.shippingStatus += (await p.shippingStatus.deleteMany({ where: { labelId: { startsWith: 'demo-ss-' } } })).count;

  console.log('Removed demo data:', JSON.stringify(removed));
  console.log('Demo orders deleted:', orders.map((o) => o.orderNumber).join(', ') || '(none)');
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
