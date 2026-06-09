/**
 * Processes a verified ShipStation/ShipEngine webhook payload.
 *
 * Handles V2 resource types (API_TRACK for tracking) and stays
 * backward-compatible with the older { eventType, data } shape.
 * Tracking events are written idempotently (deduped by eventType+occurredAt)
 * so repeated webhook deliveries never create duplicate history rows.
 */
const prisma = require('../prisma/client');
const logger = require('../utils/logger');

const DELIVERED_CODES = new Set(['DE', 'DELIVERED', 'DELIVERED_DAMAGED']);
const IN_TRANSIT_CODES = new Set([
  'IT', 'AC', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'ACCEPTED', 'DESPATCHED',
]);

async function findOrderByTracking(trackingNumber) {
  if (!trackingNumber) return null;
  return prisma.order.findFirst({
    where: { shipmentTrackingNumber: trackingNumber },
  });
}

async function handleTracking(data) {
  const trackingNumber = data.tracking_number || data.trackingNumber;
  const order = await findOrderByTracking(trackingNumber);
  if (!order) {
    logger.warn('[SS Webhook] No order matches tracking number', { trackingNumber });
    return { matched: false };
  }

  const events = data.events || [];

  // Idempotency: load existing events and skip any (eventType, occurredAt) we already have.
  const existing = await prisma.shipmentTrackingEvent.findMany({
    where: { orderId: order.id },
    select: { occurredAt: true, eventType: true },
  });
  const seen = new Set(
    existing.map((e) => `${e.eventType}|${new Date(e.occurredAt).toISOString()}`),
  );

  const toCreate = [];
  for (const ev of events) {
    const occurredAt = ev.occurred_at ? new Date(ev.occurred_at) : new Date();
    const eventType = String(
      ev.status_code || ev.carrier_status_code || ev.eventCode || 'UPDATE',
    );
    const key = `${eventType}|${occurredAt.toISOString()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    toCreate.push({
      orderId: order.id,
      eventType,
      description: ev.description || ev.message || data.status_description || '',
      location: ev.location || null,
      city: ev.city_locality || ev.city || null,
      state: ev.state_province || ev.state || null,
      country: ev.country_code || ev.country || null,
      postalCode: ev.postal_code || ev.postalCode || null,
      occurredAt,
    });
  }

  if (toCreate.length) {
    await prisma.shipmentTrackingEvent.createMany({ data: toCreate });
  }

  // Order status transitions from the top-level shipment status.
  const statusCode = String(data.status_code || data.status || '').toUpperCase();
  if (DELIVERED_CODES.has(statusCode)) {
    await prisma.order.update({
      where: { id: order.id },
      data: { shipmentRequestStatus: 'DELIVERED' },
    });
  } else if (IN_TRANSIT_CODES.has(statusCode)) {
    await prisma.order.update({
      where: { id: order.id },
      data: { shipmentRequestStatus: 'ON_THE_WAY' },
    });
  }

  return { matched: true, newEvents: toCreate.length };
}

async function processWebhook(payload) {
  const resourceType =
    payload.resource_type || payload.resourceType || payload.eventType;

  switch (resourceType) {
    case 'API_TRACK':
    case 'TRACKING_UPDATED':
      return handleTracking(payload.data || payload);

    case 'LABEL':
    case 'LABEL_CREATED':
    case 'LABEL_PURCHASED': {
      const data = payload.data || payload;
      const trackingNumber = data.tracking_number || data.trackingNumber;
      if (trackingNumber) {
        await prisma.order.updateMany({
          where: { shipmentTrackingNumber: trackingNumber },
          data: { shipmentRequestStatus: 'ACCEPTED_BY_SHIPPER' },
        });
      }
      return { handled: 'label', trackingNumber };
    }

    default:
      logger.warn('[SS Webhook] Unhandled resource_type', { resourceType });
      return { handled: false, resourceType };
  }
}

module.exports = { processWebhook, handleTracking };
