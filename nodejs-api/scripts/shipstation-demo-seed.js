/**
 * Seeds clearly-marked FAKE data for a live UI walkthrough of the ShipStation
 * integration, then prints the IDs needed to navigate. Everything is tagged
 * (orderNumber "DEMO-*", labelId "demo-*") so shipstation-demo-cleanup.js can
 * remove it precisely.
 *
 *   node scripts/shipstation-demo-seed.js
 */
require('dotenv').config();
const p = require('../prisma/client');
const { createShipmentForOrder } = require('../services/shipmentService');

(async () => {
  const stamp = Date.now();
  const orderNumber = `DEMO-${stamp}`;

  const customer = await p.customer.findFirst({ select: { id: true, email: true, firstName: true, lastName: true } });
  const variant = await p.productVariant.findFirst({ select: { id: true } });

  // 1) Demo order with a valid, deliverable address
  const order = await p.order.create({
    data: {
      orderNumber,
      customerId: customer.id,
      subtotal: 120, totalAmount: 120,
      status: 'LABEL_CREATED',
      shippingFirstName: 'Demo', shippingLastName: 'Buyer',
      shippingAddress1: '1600 Amphitheatre Pkwy', shippingCity: 'Mountain View',
      shippingState: 'CA', shippingPostalCode: '94043', shippingCountry: 'US',
      shippingPhone: '650-253-0000',
      items: { create: [{ variantId: variant.id, quantity: 2, unitPrice: 60, totalPrice: 120 }] },
    },
  });

  // 2) Buy a real ShipStation test label so the order has a genuine label_id
  const label = await createShipmentForOrder(order.id, { testLabel: true, validateAddress: 'no_validation' });
  await p.order.update({
    where: { id: order.id },
    data: {
      shipstationLabel: { label_id: label.labelId, tracking_number: label.trackingNumber, label_download: { href: label.labelUrl } },
      shipmentTrackingNumber: label.trackingNumber,
      shipmentRequestStatus: 'ACCEPTED_BY_SHIPPER',
      estimatedShippingCost: 8.45,
    },
  });

  // 3) Fake ShippingStatus rows (populate the Shipping Monitor page)
  const ssRows = [
    { labelId: `demo-ss-${stamp}-1`, shipmentStatus: 'DELIVERED', statusDetailCode: 'DE' },
    { labelId: `demo-ss-${stamp}-2`, shipmentStatus: 'SHIPPED', statusDetailCode: 'IT' },
    { labelId: `demo-ss-${stamp}-3`, shipmentStatus: 'LABEL_CREATED', statusDetailCode: 'AC' },
  ];
  for (const r of ssRows) {
    await p.shippingStatus.create({
      data: { ...r, orderId: order.id, rawData: { tracking_number: label.trackingNumber, status_code: r.statusDetailCode, events: [{ event_code: 'PU', description: 'Picked Up' }] } },
    });
  }

  // 4) Fake LabelSyncLog rows (populate the Label Sync Logs page)
  const lslRows = [
    { statusBefore: 'LABEL_CREATED', statusAfter: 'SHIPPED', syncStatus: 'SUCCESS', shipstationLabelId: `demo-ss-${stamp}-1`, shipstationStatus: 'PU' },
    { statusBefore: 'SHIPPED', statusAfter: 'SHIPPED', syncStatus: 'NO_CHANGE', shipstationLabelId: `demo-ss-${stamp}-2`, shipstationStatus: 'IT' },
    { statusBefore: 'LABEL_CREATED', statusAfter: null, syncStatus: 'FAILED', failureReason: 'Test labels can not be accessed after creation', shipstationLabelId: `demo-ss-${stamp}-3` },
  ];
  for (const r of lslRows) {
    await p.labelSyncLog.create({ data: { ...r, orderId: order.id, orderNumber, apiResponseJson: { demo: true } } });
  }

  console.log('=== DEMO DATA SEEDED ===');
  console.log('orderNumber:', orderNumber);
  console.log('orderId:', order.id);
  console.log('real ShipStation label_id:', label.labelId, '| tracking:', label.trackingNumber);
  console.log('customer:', customer.email, '| id:', customer.id);
  console.log('seeded: 1 order, 3 ShippingStatus, 3 LabelSyncLog');
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
