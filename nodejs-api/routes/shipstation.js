const express = require('express');
const router = express.Router();
const prisma = require('../prisma/client');
const { ssRequest } = require('../utils/shipstationClient');
const logger = require('../utils/logger');
const { getShipFrom, getDefaultDimensions } = require('../config/shipFrom');

// Convert a legacy/UI address ({ name, address1, city, state, postalCode, country })
// into the ShipStation V2 shape. Used so the existing admin UI (which still posts
// the old camelCase shape) works against the V2 API.
function toV2Address(a, residential = 'unknown') {
  if (!a) return undefined;
  const country = a.country === 'United States' ? 'US' : a.country || 'US';
  return {
    name: a.name || `${a.firstName || ''} ${a.lastName || ''}`.trim() || 'Customer',
    phone: a.phone || '000-000-0000',
    address_line1: a.address1 || a.address_line1 || '',
    ...(a.address2 ? { address_line2: a.address2 } : {}),
    city_locality: a.city || a.city_locality || '',
    state_province: a.state || a.state_province || '',
    postal_code: a.postalCode || a.postal_code || '',
    country_code: country,
    address_residential_indicator: residential,
  };
}

// --------------------
// Package Pickups APIs
// --------------------

// GET /api/shipstation/pickups - List pickups (proxy query params)
router.get('/pickups', async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const path = qs ? `/v2/pickups?${qs}` : '/v2/pickups';
    const response = await ssRequest('GET', path);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// POST /api/shipstation/pickups - Create/schedule a pickup
router.post('/pickups', async (req, res) => {
  try {
    const response = await ssRequest('POST', '/v2/pickups', req.body);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// GET /api/shipstation/pickups/:pickupId - Get pickup details
router.get('/pickups/:pickupId', async (req, res) => {
  try {
    const { pickupId } = req.params;
    const response = await ssRequest('GET', `/v2/pickups/${pickupId}`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// DELETE /api/shipstation/pickups/:pickupId - Cancel a pickup
router.delete('/pickups/:pickupId', async (req, res) => {
  try {
    const { pickupId } = req.params;
    const response = await ssRequest('DELETE', `/v2/pickups/${pickupId}`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// GET /api/shipstation/carriers - Get available carriers
router.get('/carriers', async (req, res) => {
  try {
    const response = await ssRequest('GET', '/v2/carriers');
    logger.info('ShipStation carriers response', response.data);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    logger.error('ShipStation carriers error', err);
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// GET /api/shipstation/carriers/:carrierId/services - Get carrier services
router.get('/carriers/:carrierId/services', async (req, res) => {
  try {
    const { carrierId } = req.params;
    const response = await ssRequest('GET', `/v2/carriers/${carrierId}/services`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// GET /api/shipstation/carriers/:carrierId/packages - Get carrier package types
router.get('/carriers/:carrierId/packages', async (req, res) => {
  try {
    const { carrierId } = req.params;
    const response = await ssRequest('GET', `/v2/carriers/${carrierId}/packages`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// GET /api/shipstation/warehouses - Get warehouses
router.get('/warehouses', async (req, res) => {
  try {
    const response = await ssRequest('GET', '/v2/warehouses');
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// POST /api/shipstation/rates/estimate - get live rates using ShipStation's rates/estimate endpoint
router.post('/rates/estimate', async (req, res) => {
  try {
    const { shipTo, shipFrom, weightOz, dimensions, carrierCode, carrier_id } = req.body;

    // If request already contains ShipStation-shaped fields, sanitize and pass through
    const allowedKeys = new Set([
      'carrier_id',
      'from_country_code', 'from_postal_code', 'from_city_locality', 'from_state_province',
      'to_country_code', 'to_postal_code', 'to_city_locality', 'to_state_province',
      'weight', 'dimensions', 'confirmation', 'address_residential_indicator', 'ship_date'
    ]);

    const hasPreShaped = typeof req.body?.carrier_id === 'string'
      && typeof req.body?.from_country_code === 'string'
      && typeof req.body?.to_country_code === 'string';

    let estimateRequest;

    if (hasPreShaped) {
      // Pick only allowed keys and ensure types
      estimateRequest = {};
      for (const k of Object.keys(req.body)) {
        if (allowedKeys.has(k)) estimateRequest[k] = req.body[k];
      }
      // Defaults and coercions
      if (!estimateRequest.ship_date) estimateRequest.ship_date = new Date().toISOString();
      if (!estimateRequest.confirmation) estimateRequest.confirmation = 'none';
      if (!estimateRequest.address_residential_indicator) estimateRequest.address_residential_indicator = 'unknown';
      if (estimateRequest.weight && typeof estimateRequest.weight.value === 'number') {
        estimateRequest.weight.value = Math.max(estimateRequest.weight.value, 3); // mock requires > 2 lb
        estimateRequest.weight.unit = 'pound';
      }
      if (estimateRequest.dimensions) {
        estimateRequest.dimensions.unit = 'inch';
      }
    } else {
      // Build from legacy shape
      const carrierId = carrier_id || carrierCode;
      estimateRequest = {
        carrier_id: carrierId,
        from_country_code: shipFrom?.country === 'United States' ? 'US' : shipFrom?.country || 'US',
        from_postal_code: shipFrom?.postalCode || '90210',
        from_city_locality: shipFrom?.city || 'Los Angeles',
        from_state_province: shipFrom?.state || 'CA',
        to_country_code: shipTo?.country === 'United States' ? 'US' : shipTo?.country || 'US',
        to_postal_code: shipTo?.postalCode || '00000',
        to_city_locality: shipTo?.city || 'City',
        to_state_province: shipTo?.state || 'State',
        weight: {
          value: Math.max((weightOz || 1) / 16, 3),
          unit: 'pound'
        },
        dimensions: {
          unit: 'inch',
          length: dimensions?.length || 10,
          width: dimensions?.width || 8,
          height: dimensions?.height || 6
        },
        confirmation: 'none',
        address_residential_indicator: 'unknown',
        ship_date: new Date().toISOString()
      };
    }

    // Final sanitize: drop any undefined/null
    Object.keys(estimateRequest).forEach((k) => {
      if (estimateRequest[k] === undefined || estimateRequest[k] === null) delete estimateRequest[k];
    });

    const response = await ssRequest('POST', '/v2/rates/estimate', estimateRequest);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// POST /api/shipstation/shipments - Create a shipment
router.post('/shipments', async (req, res) => {
  try {
    const { shipTo, shipFrom, carrierCode, serviceCode, packageCode, weightOz, dimensions, items } = req.body;

    const shipment = {
      carrierCode,
      serviceCode,
      packageCode,
      shipTo,
      shipFrom,
      weight: weightOz ? { value: weightOz, unit: 'ounce' } : undefined,
      dimensions,
      items: items || []
    };

    const response = await ssRequest('POST', '/v2/shipments', shipment);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// GET /api/shipstation/shipments/:shipmentId - Get shipment details
router.get('/shipments/:shipmentId', async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const response = await ssRequest('GET', `/v2/shipments/${shipmentId}`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// GET /api/shipstation/shipments/:shipmentId/rates - Get shipment rates
router.get('/shipments/:shipmentId/rates', async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const response = await ssRequest('GET', `/v2/shipments/${shipmentId}/rates`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// GET /api/shipstation/labels/:labelId - Get label details
router.get('/labels/:labelId', async (req, res) => {
  try {
    const { labelId } = req.params;
    const response = await ssRequest('GET', `/v2/labels/${labelId}`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// PUT /api/shipstation/labels/:labelId/void - Void a label
router.put('/labels/:labelId/void', async (req, res) => {
  try {
    const { labelId } = req.params;
    const response = await ssRequest('PUT', `/v2/labels/${labelId}/void`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// GET /api/shipstation/labels/:labelId/track - Get label tracking
router.get('/labels/:labelId/track', async (req, res) => {
  try {
    const { labelId } = req.params;
    const response = await ssRequest('GET', `/v2/labels/${labelId}/track`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// POST /api/shipstation/labels/:labelId/return - Create return label
router.post('/labels/:labelId/return', async (req, res) => {
  try {
    const { labelId } = req.params;
    const response = await ssRequest('POST', `/v2/labels/${labelId}/return`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// POST /api/shipstation/labels - create/purchase a label and update order
router.post('/labels', async (req, res) => {
  try {
    const {
      orderId,
      shipment,
      test_label,
      label_format,
      label_layout,
      label_download_type,
      // legacy/UI fields (camelCase) — used when `shipment` isn't supplied
      shipTo,
      serviceCode,
      weightOz,
      packageCode,
      dimensions,
    } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, error: 'orderId is required' });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    // Accept either a pre-shaped V2 `shipment` object OR the legacy UI payload
    // (shipTo + serviceCode + weightOz). For the legacy case we build the V2
    // shipment server-side and ALWAYS use the configured origin (never a
    // client-supplied ship-from, which the old UI hardcoded to a fake address).
    let finalShipment = shipment;
    if (!finalShipment) {
      if (!serviceCode) {
        return res.status(400).json({ success: false, error: 'serviceCode (or a full shipment object) is required' });
      }
      finalShipment = {
        external_shipment_id: orderId,
        service_code: serviceCode,
        ship_from: getShipFrom(),
        ship_to: toV2Address(shipTo, 'yes'),
        packages: [
          {
            weight: { value: Math.max(1, Math.ceil(weightOz || 16)), unit: 'ounce' },
            dimensions: dimensions || getDefaultDimensions(),
            ...(packageCode ? { package_code: packageCode } : {}),
          },
        ],
      };
    }

    // Build the complete ShipStation label payload
    const labelPayload = {
      shipment: finalShipment,
      validate_address: req.body.validate_address || process.env.SHIPSTATION_VALIDATE_ADDRESS || 'validate_and_clean',
      test_label: test_label || false,
      label_format: label_format || 'pdf',
      label_layout: label_layout || '4x6',
      label_download_type: label_download_type || 'url'
    };

    logger.debug('📤 Sending to ShipStation API', { labelPayload });

    // Create label via ShipStation API
    const response = await ssRequest('POST', '/v2/labels', labelPayload);
    const data = response.data || response;

    logger.info('✅ ShipStation Response', { data });

    const shipmentCost = data?.shipment_cost?.amount || data?.shipmentCost?.amount || null;
    const trackingNumber = data?.tracking_number || data?.trackingNumber || null;

    // Persist label + tracking on the order so the UI/customer can see it.
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        estimatedShippingCost: shipmentCost !== null ? shipmentCost : undefined,
        shipstationLabel: data || {},
        shipmentTrackingNumber: trackingNumber || undefined,
        shipmentRequestStatus: trackingNumber ? 'ACCEPTED_BY_SHIPPER' : undefined,
      },
    });

    return res.json({ success: true, data, order: updated });
  } catch (err) {
    logger.error('❌ Label creation error', { message: err.message, data: err.data, payload: req.body });

    // Extract specific error message from ShipStation response
    let errorMessage = err.message;
    if (err.data?.errors && Array.isArray(err.data.errors) && err.data.errors.length > 0) {
      errorMessage = err.data.errors[0].message || err.message;
    }

    return res.status(err.status || 500).json({
      success: false,
      error: errorMessage,
      status: err.status,
      details: err.data,
      payload: req.body
    });
  }
});

// GET /api/shipstation/labels/:labelId - fetch label status by ID
router.get('/labels/:labelId', async (req, res) => {
  try {
    const { labelId } = req.params;
    if (!labelId) {
      return res.status(400).json({ success: false, error: 'labelId is required' });
    }

    // Fetch label from ShipStation
    const response = await ssRequest('GET', `/v2/labels/${encodeURIComponent(labelId)}?label_download_type=url`);
    const labelData = response.data || response;

    logger.info('✅ ShipStation Label Status', { labelData });

    return res.json({ success: true, data: labelData });
  } catch (err) {
    logger.error('❌ Label fetch error', { message: err.message, status: err.status, details: err.data });
    return res.status(err.status || 500).json({
      success: false,
      error: err.message,
      status: err.status,
      details: err.data
    });
  }
});

// POST /api/shipstation/tracking/sync - fetch latest tracking and append events
router.post('/tracking/sync', async (req, res) => {
  try {
    const { orderId, trackingNumber } = req.body;
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    const tn = trackingNumber || order.shipmentTrackingNumber;
    if (!tn) return res.status(400).json({ success: false, error: 'Missing tracking number' });

    // ShipStation label tracking endpoint
    const { data } = await ssRequest('GET', `/v2/labels/${encodeURIComponent(tn)}/track`);

    // Normalize events
    const events = Array.isArray(data?.events) ? data.events : [];

    // Insert new tracking events (idempotency can be improved with hashes)
    const toCreate = events.map((e) => ({
      orderId: order.id,
      eventType: String(e?.eventCode || e?.status || 'UPDATE'),
      description: String(e?.message || e?.statusDescription || ''),
      location: e?.location,
      city: e?.city,
      state: e?.state,
      country: e?.country,
      postalCode: e?.postalCode,
      occurredAt: e?.eventDate ? new Date(e.eventDate) : new Date(),
    }));

    if (toCreate.length) {
      await prisma.shipmentTrackingEvent.createMany({ data: toCreate });
    }

    // Update high-level order status flag if delivered
    let newStatus = undefined;
    if (events.some((e) => String(e?.status).toUpperCase().includes('DELIVERED'))) {
      newStatus = 'DELIVERED';
    } else if (events.some((e) => String(e?.status).toUpperCase().includes('IN_TRANSIT') || String(e?.status).toUpperCase().includes('OUT_FOR_DELIVERY'))) {
      newStatus = 'ON_THE_WAY';
    }
    if (newStatus) {
      await prisma.order.update({ where: { id: order.id }, data: { shipmentRequestStatus: newStatus } });
    }

    return res.json({ success: true, data: { events } });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// POST /api/shipstation/tracking/sync-all — Manual trigger for batch label tracking sync
// Runs the same logic as the hourly cron job on demand
router.post('/tracking/sync-all', async (req, res) => {
  try {
    const { run: runLabelTrackingSync } = require('../cron/labelTrackingSync');
    logger.info('[ShipStation] Manual label tracking sync triggered');
    const result = await runLabelTrackingSync();
    return res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[ShipStation] Manual label tracking sync error', { message: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/shipstation/tracking/check/:labelId — Check single label tracking status
// Returns the full tracking response from ShipStation for a specific label
router.get('/tracking/check/:labelId', async (req, res) => {
  try {
    const { labelId } = req.params;
    if (!labelId) {
      return res.status(400).json({ success: false, error: 'labelId is required' });
    }

    const { checkSingleLabel } = require('../cron/labelTrackingSync');
    const tracking = await checkSingleLabel(labelId);
    return res.json({ success: true, data: tracking });
  } catch (err) {
    logger.error('[ShipStation] Single label tracking check error', { message: err.message, labelId: req.params.labelId });
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// POST /api/shipstation/tracking/orders/:orderId/sync — Sync single order tracking status
router.post('/tracking/orders/:orderId/sync', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { syncSingleOrder } = require('../cron/labelTrackingSync');

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        shipstationLabel: true,
        status: true,
        shipmentTrackingNumber: true,
      }
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (!order.shipstationLabel || !order.shipstationLabel.label_id) {
      return res.status(400).json({ success: false, error: 'Order has no ShipStation label ID' });
    }

    logger.info(`[ShipStation] Manual tracking sync triggered for order ${order.orderNumber}`);
    const result = await syncSingleOrder(order);

    return res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[ShipStation] Single order tracking sync error', { message: err.message, orderId: req.params.orderId });
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/shipstation/label-sync-logs — historical cron sync log (LabelSyncLog).
// Paginated (default 50/page); filterable by syncStatus and createdAt date range.
router.get('/label-sync-logs', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const where = {};
    if (req.query.syncStatus) where.syncStatus = req.query.syncStatus;
    if (req.query.startDate || req.query.endDate) {
      where.createdAt = {};
      if (req.query.startDate) where.createdAt.gte = new Date(req.query.startDate);
      if (req.query.endDate) where.createdAt.lte = new Date(req.query.endDate);
    }

    const [logs, total] = await Promise.all([
      prisma.labelSyncLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.labelSyncLog.count({ where }),
    ]);

    return res.json({
      success: true,
      data: {
        data: logs,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    logger.error('[ShipStation] List label sync logs error', { message: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/shipstation/tracking/sync-status — List all synced shipping statuses
router.get('/tracking/sync-status', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [statuses, total] = await Promise.all([
      prisma.shippingStatus.findMany({
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          order: {
            select: {
              orderNumber: true,
              status: true
            }
          }
        }
      }),
      prisma.shippingStatus.count()
    ]);

    return res.json({
      success: true,
      data: {
        data: statuses,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (err) {
    logger.error('[ShipStation] List sync status error', { message: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
});

// NOTE: The ShipStation webhook receiver moved to a PUBLIC, signature-verified
// endpoint mounted in app.js at POST /api/webhooks/shipstation. It must not sit
// behind authMiddleware (ShipStation can't send an auth token) and it needs the
// raw request body for RSA-SHA256 verification — neither of which is possible on
// a router mounted under `app.use("/api/shipstation", authMiddleware, ...)`.
// See utils/shipstationWebhook.js and services/shipstationWebhookHandler.js.

// --------------------
// Batches APIs
// --------------------

// GET /api/shipstation/batches - List batches
router.get('/batches', async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const path = qs ? `/v2/batches?${qs}` : '/v2/batches';
    const response = await ssRequest('GET', path);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// POST /api/shipstation/batches - Create a batch
router.post('/batches', async (req, res) => {
  try {
    const response = await ssRequest('POST', '/v2/batches', req.body);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// GET /api/shipstation/batches/external-batch-id/:externalBatchId - Get batch by external ID
router.get('/batches/external-batch-id/:externalBatchId', async (req, res) => {
  try {
    const { externalBatchId } = req.params;
    const response = await ssRequest('GET', `/v2/batches/external_batch_id/${externalBatchId}`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// GET /api/shipstation/batches/:batchId - Get batch details
router.get('/batches/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const response = await ssRequest('GET', `/v2/batches/${batchId}`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// PUT /api/shipstation/batches/:batchId - Update batch
router.put('/batches/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const response = await ssRequest('PUT', `/v2/batches/${batchId}`, req.body);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// DELETE /api/shipstation/batches/:batchId - Delete batch
router.delete('/batches/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const response = await ssRequest('DELETE', `/v2/batches/${batchId}`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// POST /api/shipstation/batches/:batchId/add - Add shipments to batch
router.post('/batches/:batchId/add', async (req, res) => {
  try {
    const { batchId } = req.params;
    const response = await ssRequest('POST', `/v2/batches/${batchId}/add`, req.body);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// GET /api/shipstation/batches/:batchId/errors - Get batch errors
router.get('/batches/:batchId/errors', async (req, res) => {
  try {
    const { batchId } = req.params;
    const response = await ssRequest('GET', `/v2/batches/${batchId}/errors`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// --------------------
// Carriers APIs (Additional)
// --------------------

// GET /api/shipstation/carriers/:carrierId/options - Get carrier options
router.get('/carriers/:carrierId/options', async (req, res) => {
  try {
    const { carrierId } = req.params;
    const response = await ssRequest('GET', `/v2/carriers/${carrierId}/options`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// --------------------
// Downloads APIs
// --------------------

// GET /api/shipstation/downloads/:dir/:subdir/:filename - Download file
router.get('/downloads/:dir/:subdir/:filename', async (req, res) => {
  try {
    const { dir, subdir, filename } = req.params;
    const response = await ssRequest('GET', `/v2/downloads/${dir}/${subdir}/${filename}`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// --------------------
// Fulfillments APIs
// --------------------

// GET /api/shipstation/fulfillments - List fulfillments
router.get('/fulfillments', async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const path = qs ? `/v2/fulfillments?${qs}` : '/v2/fulfillments';
    const response = await ssRequest('GET', path);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// POST /api/shipstation/fulfillments - Create fulfillment
router.post('/fulfillments', async (req, res) => {
  try {
    const response = await ssRequest('POST', '/v2/fulfillments', req.body);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// --------------------
// Inventory APIs
// --------------------

// GET /api/shipstation/inventory - List inventory
router.get('/inventory', async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const path = qs ? `/v2/inventory?${qs}` : '/v2/inventory';
    const response = await ssRequest('GET', path);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// POST /api/shipstation/inventory - Create inventory
router.post('/inventory', async (req, res) => {
  try {
    const response = await ssRequest('POST', '/v2/inventory', req.body);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// GET /api/shipstation/inventory-warehouses - List inventory warehouses
router.get('/inventory-warehouses', async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const path = qs ? `/v2/inventory_warehouses?${qs}` : '/v2/inventory_warehouses';
    const response = await ssRequest('GET', path);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// POST /api/shipstation/inventory-warehouses - Create inventory warehouse
router.post('/inventory-warehouses', async (req, res) => {
  try {
    const response = await ssRequest('POST', '/v2/inventory_warehouses', req.body);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// GET /api/shipstation/inventory-warehouses/:warehouseId - Get inventory warehouse
router.get('/inventory-warehouses/:warehouseId', async (req, res) => {
  try {
    const { warehouseId } = req.params;
    const response = await ssRequest('GET', `/v2/inventory_warehouses/${warehouseId}`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// PUT /api/shipstation/inventory-warehouses/:warehouseId - Update inventory warehouse
router.put('/inventory-warehouses/:warehouseId', async (req, res) => {
  try {
    const { warehouseId } = req.params;
    const response = await ssRequest('PUT', `/v2/inventory_warehouses/${warehouseId}`, req.body);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// DELETE /api/shipstation/inventory-warehouses/:warehouseId - Delete inventory warehouse
router.delete('/inventory-warehouses/:warehouseId', async (req, res) => {
  try {
    const { warehouseId } = req.params;
    const response = await ssRequest('DELETE', `/v2/inventory_warehouses/${warehouseId}`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// GET /api/shipstation/inventory-locations - List inventory locations
router.get('/inventory-locations', async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const path = qs ? `/v2/inventory_locations?${qs}` : '/v2/inventory_locations';
    const response = await ssRequest('GET', path);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// POST /api/shipstation/inventory-locations - Create inventory location
router.post('/inventory-locations', async (req, res) => {
  try {
    const response = await ssRequest('POST', '/v2/inventory_locations', req.body);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// GET /api/shipstation/inventory-locations/:locationId - Get inventory location
router.get('/inventory-locations/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    const response = await ssRequest('GET', `/v2/inventory_locations/${locationId}`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// PUT /api/shipstation/inventory-locations/:locationId - Update inventory location
router.put('/inventory-locations/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    const response = await ssRequest('PUT', `/v2/inventory_locations/${locationId}`, req.body);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// DELETE /api/shipstation/inventory-locations/:locationId - Delete inventory location
router.delete('/inventory-locations/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    const response = await ssRequest('DELETE', `/v2/inventory_locations/${locationId}`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// --------------------
// Labels APIs (Additional)
// --------------------

// GET /api/shipstation/labels - List labels
router.get('/labels', async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const path = qs ? `/v2/labels?${qs}` : '/v2/labels';
    const response = await ssRequest('GET', path);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// POST /api/shipstation/labels/rates/:rateId - Create label from rate
router.post('/labels/rates/:rateId', async (req, res) => {
  try {
    const { rateId } = req.params;
    const response = await ssRequest('POST', `/v2/labels/rates/${rateId}`, req.body);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// POST /api/shipstation/labels/shipment/:shipmentId - Create label from shipment
router.post('/labels/shipment/:shipmentId', async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const response = await ssRequest('POST', `/v2/labels/shipment/${shipmentId}`, req.body);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// --------------------
// Manifests APIs
// --------------------

// GET /api/shipstation/manifests - List manifests
router.get('/manifests', async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const path = qs ? `/v2/manifests?${qs}` : '/v2/manifests';
    const response = await ssRequest('GET', path);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// POST /api/shipstation/manifests - Create manifest
router.post('/manifests', async (req, res) => {
  try {
    const response = await ssRequest('POST', '/v2/manifests', req.body);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// GET /api/shipstation/manifests/:manifestId - Get manifest details
router.get('/manifests/:manifestId', async (req, res) => {
  try {
    const { manifestId } = req.params;
    const response = await ssRequest('GET', `/v2/manifests/${manifestId}`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// --------------------
// Package Types APIs
// --------------------

// GET /api/shipstation/packages - List package types
router.get('/packages', async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const path = qs ? `/v2/packages?${qs}` : '/v2/packages';
    const response = await ssRequest('GET', path);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// POST /api/shipstation/packages - Create package type
router.post('/packages', async (req, res) => {
  try {
    const response = await ssRequest('POST', '/v2/packages', req.body);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// GET /api/shipstation/packages/:packageId - Get package type
router.get('/packages/:packageId', async (req, res) => {
  try {
    const { packageId } = req.params;
    const response = await ssRequest('GET', `/v2/packages/${packageId}`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// PUT /api/shipstation/packages/:packageId - Update package type
router.put('/packages/:packageId', async (req, res) => {
  try {
    const { packageId } = req.params;
    const response = await ssRequest('PUT', `/v2/packages/${packageId}`, req.body);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// DELETE /api/shipstation/packages/:packageId - Delete package type
router.delete('/packages/:packageId', async (req, res) => {
  try {
    const { packageId } = req.params;
    const response = await ssRequest('DELETE', `/v2/packages/${packageId}`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// --------------------
// Products APIs
// --------------------

// GET /api/shipstation/products - List products
router.get('/products', async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const path = qs ? `/v2/products?${qs}` : '/v2/products';
    const response = await ssRequest('GET', path);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// --------------------
// Rates APIs (Additional)
// --------------------

// GET /api/shipstation/rates/:rateId - Get rate details
router.get('/rates/:rateId', async (req, res) => {
  try {
    const { rateId } = req.params;
    const response = await ssRequest('GET', `/v2/rates/${rateId}`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// --------------------
// Shipments APIs (Additional)
// --------------------

// GET /api/shipstation/shipments - List shipments
router.get('/shipments', async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const path = qs ? `/v2/shipments?${qs}` : '/v2/shipments';
    const response = await ssRequest('GET', path);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// GET /api/shipstation/shipments/external-shipment-id/:externalShipmentId - Get shipment by external ID
router.get('/shipments/external-shipment-id/:externalShipmentId', async (req, res) => {
  try {
    const { externalShipmentId } = req.params;
    const response = await ssRequest('GET', `/v2/shipments/external_shipment_id/${externalShipmentId}`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// PUT /api/shipstation/shipments/:shipmentId/cancel - Cancel shipment
router.put('/shipments/:shipmentId/cancel', async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const response = await ssRequest('PUT', `/v2/shipments/${shipmentId}/cancel`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// POST /api/shipstation/shipments/:shipmentId/tags/:tagName - Add tag to shipment
router.post('/shipments/:shipmentId/tags/:tagName', async (req, res) => {
  try {
    const { shipmentId, tagName } = req.params;
    const response = await ssRequest('POST', `/v2/shipments/${shipmentId}/tags/${tagName}`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// DELETE /api/shipstation/shipments/:shipmentId/tags/:tagName - Remove tag from shipment
router.delete('/shipments/:shipmentId/tags/:tagName', async (req, res) => {
  try {
    const { shipmentId, tagName } = req.params;
    const response = await ssRequest('DELETE', `/v2/shipments/${shipmentId}/tags/${tagName}`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// --------------------
// Tags APIs
// --------------------

// GET /api/shipstation/tags - List tags
router.get('/tags', async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const path = qs ? `/v2/tags?${qs}` : '/v2/tags';
    const response = await ssRequest('GET', path);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// POST /api/shipstation/tags/:tagName - Create tag
router.post('/tags/:tagName', async (req, res) => {
  try {
    const { tagName } = req.params;
    const response = await ssRequest('POST', `/v2/tags/${tagName}`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// --------------------
// Tracking APIs
// --------------------

// POST /api/shipstation/tracking/stop - Stop tracking
router.post('/tracking/stop', async (req, res) => {
  try {
    const response = await ssRequest('POST', '/v2/tracking/stop', req.body);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// --------------------
// Users APIs
// --------------------

// GET /api/shipstation/users - List users
router.get('/users', async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const path = qs ? `/v2/users?${qs}` : '/v2/users';
    const response = await ssRequest('GET', path);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// --------------------
// Webhooks Management APIs
// --------------------

// GET /api/shipstation/environment/webhooks - List webhooks
router.get('/environment/webhooks', async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const path = qs ? `/v2/environment/webhooks?${qs}` : '/v2/environment/webhooks';
    const response = await ssRequest('GET', path);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// POST /api/shipstation/environment/webhooks - Create webhook
router.post('/environment/webhooks', async (req, res) => {
  try {
    const response = await ssRequest('POST', '/v2/environment/webhooks', req.body);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});
// ----------- CARRIERS -----------
router.get('/carriers/:carrierId', async (req, res) => {
  try {
    const { carrierId } = req.params;
    const response = await ssRequest('GET', `/v2/carriers/${carrierId}`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});
router.put('/carriers/:carrierId', async (req, res) => {
  try {
    const { carrierId } = req.params;
    const response = await ssRequest('PUT', `/v2/carriers/${carrierId}`, req.body);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});
router.delete('/carriers/:carrierId', async (req, res) => {
  try {
    const { carrierId } = req.params;
    const response = await ssRequest('DELETE', `/v2/carriers/${carrierId}`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// ----------- RATES BY ID -----------
router.get('/rates/:rateId', async (req, res) => {
  try {
    const { rateId } = req.params;
    const response = await ssRequest('GET', `/v2/rates/${rateId}`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// ----------- TAGS -----------
router.get('/tags', async (req, res) => {
  try {
    const response = await ssRequest('GET', '/v2/tags');
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});
router.post('/tags/:tagName', async (req, res) => {
  try {
    const { tagName } = req.params;
    const response = await ssRequest('POST', `/v2/tags/${tagName}`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// ----------- USERS -----------
router.get('/users', async (req, res) => {
  try {
    const response = await ssRequest('GET', '/v2/users');
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// ----------- WAREHOUSES BY ID -----------
router.get('/warehouses/:warehouseId', async (req, res) => {
  try {
    const { warehouseId } = req.params;
    const response = await ssRequest('GET', `/v2/warehouses/${warehouseId}`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// GET /api/shipstation/environment/webhooks/:webhookId - Get webhook
router.get('/environment/webhooks/:webhookId', async (req, res) => {
  try {
    const { webhookId } = req.params;
    const response = await ssRequest('GET', `/v2/environment/webhooks/${webhookId}`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// PUT /api/shipstation/environment/webhooks/:webhookId - Update webhook
router.put('/environment/webhooks/:webhookId', async (req, res) => {
  try {
    const { webhookId } = req.params;
    const response = await ssRequest('PUT', `/v2/environment/webhooks/${webhookId}`, req.body);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

// DELETE /api/shipstation/environment/webhooks/:webhookId - Delete webhook
router.delete('/environment/webhooks/:webhookId', async (req, res) => {
  try {
    const { webhookId } = req.params;
    const response = await ssRequest('DELETE', `/v2/environment/webhooks/${webhookId}`);
    return res.json({ success: true, data: response.data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, details: err.data });
  }
});

module.exports = router;


