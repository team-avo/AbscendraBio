/**
 * Label Tracking Sync Cron Job
 *
 * Runs every hour. Fetches orders with status SHIPPED or LABEL_CREATED that have
 * a ShipStation label, checks the label tracking status via ShipStation API, and:
 *
 *  - LABEL_CREATED → SHIPPED  when ShipStation says DESPATCHED (+ auto shipment creation)
 *  - SHIPPED       → DELIVERED when ShipStation says DELIVERED
 *
 * Uses batching (50 orders per batch) and per-call delays (500ms) to avoid
 * overwhelming the server and hitting ShipStation rate limits.
 */

const prisma = require('../prisma/client');
const { ssRequest } = require('../utils/shipstationClient');
const logger = require('../utils/logger');
const { sendShippingNotification } = require('../utils/emailService');

// ---------- configuration ----------
const BATCH_SIZE = 50;
const MAX_ORDERS_PER_RUN = 500; // Scalability: limit how many we check in one hour
const DELAY_BETWEEN_CALLS_MS = 500;
const DELAY_BETWEEN_BATCHES_MS = 2000;

// Concurrency guard
let isSyncRunning = false;

// ShipStation status_detail_code or status_code values that indicate "dispatched / in-transit"
const DISPATCHED_STATUSES = new Set([
    'DESPATCHED',
    'COLLECTION_MADE',
    'IN_TRANSIT',
    'OUT_FOR_DELIVERY',
    'RECEIVED_BY_CARRIER',
    'RECEIVED_LOCAL_DELIVERY_DEPOT',
    'HUB_SCAN_OUT',
    'ELEC_ADVICE_RECD_BY_CARRIER',
    'SUB_CONTRACTOR_RECEIVED',
    'SUB_CONTRACTOR_EVENT',
    'IT', // In Transit (short code)
    'AC', // Accepted (short code) 
]);

// ShipStation status_detail_code or status_code values that indicate "delivered"
const DELIVERED_STATUSES = new Set([
    'DELIVERED',
    'DELIVERED_DAMAGED',
    'DELIVERED_IN_PART',
    'DELIVERED_SPECIFIED_SAFE_PLACE',
    'DELIVERED_TO_ALTERNATIVE_DELIVERY_LOCATION',
    'DELIVERED_TO_NEIGHBOUR',
    'DELIVERED_TO_PO_BOX',
    'DELIVERED_TO_LOCKER_COLLECTION_POINT',
    'PARCEL_COLLECTED_FROM_PICKUP_POINT',
    'PROOF_OF_DELIVERY',
    'DL', // Delivered (short code)
    'DE', // Delivered (short code)
]);

// ---------- helpers ----------
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

// ---------- core sync for a single order ----------
async function syncSingleOrder(order) {
    const labelId = order.shipstationLabel?.label_id;
    if (!labelId) return { action: 'skipped', reason: 'no_label_id' };

    logger.info(`[LabelTrackingSync] Checking tracking for order ${order.orderNumber} (Label: ${labelId})`);

    // Call ShipStation tracking API
    const { data: tracking } = await ssRequest('GET', `/v2/labels/${encodeURIComponent(labelId)}/track`);

    const statusDetailCode = tracking?.status_detail_code || '';
    const statusCode = tracking?.status_code || '';
    const statusDescription = tracking?.status_detail_description || tracking?.status_description || 'No description';
    const trackingNumber = tracking?.tracking_number || '';
    const trackingUrl = tracking?.tracking_url || '';
    const carrierCode = tracking?.carrier_code || '';

    logger.info(`[LabelTrackingSync] Order ${order.orderNumber} status: ${statusDetailCode} / ${statusCode} - ${statusDescription}`);

    // Save/Update full shipping status for detailed tracking
    try {
        await prisma.shippingStatus.upsert({
            where: { labelId: labelId },
            update: {
                shipmentStatus: statusCode || null,
                statusDetailCode: statusDetailCode || null,
                rawData: tracking,
                updatedAt: new Date(),
            },
            create: {
                labelId: labelId,
                orderId: order.id,
                shipmentStatus: statusCode || null,
                statusDetailCode: statusDetailCode || null,
                rawData: tracking,
            },
        });
    } catch (statusErr) {
        logger.warn(`[LabelTrackingSync] Failed to save shipping status for order ${order.orderNumber}: ${statusErr.message}`);
    }

    // Save tracking event for audit trail
    try {
        await prisma.shipmentTrackingEvent.create({
            data: {
                orderId: order.id,
                eventType: statusDetailCode || statusCode || 'SYNC',
                description: tracking?.status_detail_description || tracking?.status_description || 'Tracking sync',
                occurredAt: tracking?.actual_delivery_date
                    ? new Date(tracking.actual_delivery_date)
                    : new Date(),
            },
        });
    } catch (_eventErr) {
        // Ignore duplicate event errors
    }

    // ---- LABEL_CREATED → SHIPPED (when dispatched) ----
    if (order.status === 'LABEL_CREATED') {
        if (DISPATCHED_STATUSES.has(statusDetailCode) || DISPATCHED_STATUSES.has(statusCode)) {
            // Auto-create a Shipment record
            try {
                await prisma.shipment.create({
                    data: {
                        orderId: order.id,
                        carrier: carrierCode || 'shipstation',
                        trackingNumber: trackingNumber || null,
                        trackingUrl: trackingUrl || null,
                        status: 'SHIPPED',
                        shippedAt: new Date(),
                    },
                });
            } catch (shipmentErr) {
                // If shipment already exists, continue
                logger.warn(`[LabelTrackingSync] Shipment creation skipped for order ${order.orderNumber}: ${shipmentErr.message}`);
            }

            // Update order status to SHIPPED
            await prisma.order.update({
                where: { id: order.id },
                data: {
                    status: 'SHIPPED',
                    shipmentTrackingNumber: trackingNumber || undefined,
                    shipmentRequestStatus: 'ACCEPTED_BY_SHIPPER',
                },
            });

            // Trigger shipping notification email
            try {
                // Fetch the updated order with all needed relations if they aren't fully loaded
                // Although we included them in the initial findMany, for safety in this logic
                // we'll use the order object we already have if relations are present.
                const shipmentData = {
                    trackingNumber: trackingNumber || 'N/A',
                    carrier: carrierCode || 'shipstation',
                    trackingUrl: trackingUrl || '',
                    estimatedDelivery: '2-3 business days' // Default or from tracking if available
                };

                if (order.customer) {
                    await sendShippingNotification(order, order.customer, shipmentData);
                    logger.info(`[LabelTrackingSync] 📧 Shipping notification queued for order ${order.orderNumber}`);
                } else {
                    logger.warn(`[LabelTrackingSync] ⚠️ Could not send shipping notification for order ${order.orderNumber}: Customer data missing`);
                }
            } catch (emailErr) {
                logger.error(`[LabelTrackingSync] ❌ Failed to send shipping notification for order ${order.orderNumber}: ${emailErr.message}`);
            }

            logger.info(`[LabelTrackingSync] ✅ Order ${order.orderNumber} updated: LABEL_CREATED → SHIPPED (${statusDetailCode})`);
            return { action: 'updated', from: 'LABEL_CREATED', to: 'SHIPPED', statusDetailCode, description: statusDescription };
        }

        // Also check if it's already delivered (skipped shipped state on ShipStation)
        if (DELIVERED_STATUSES.has(statusDetailCode) || DELIVERED_STATUSES.has(statusCode)) {
            logger.info(`[LabelTrackingSync] 📦 Order ${order.orderNumber} is already DELIVERED. Auto-creating shipment...`);
            // Create shipment first
            try {
                await prisma.shipment.create({
                    data: {
                        orderId: order.id,
                        carrier: carrierCode || 'shipstation',
                        trackingNumber: trackingNumber || null,
                        trackingUrl: trackingUrl || null,
                        status: 'DELIVERED',
                        shippedAt: new Date(),
                        deliveredAt: tracking?.actual_delivery_date
                            ? new Date(tracking.actual_delivery_date)
                            : new Date(),
                    },
                });
            } catch (shipmentErr) {
                logger.warn(`[LabelTrackingSync] Shipment creation skipped for order ${order.orderNumber}: ${shipmentErr.message}`);
            }

            await prisma.order.update({
                where: { id: order.id },
                data: {
                    status: 'DELIVERED',
                    shipmentTrackingNumber: trackingNumber || undefined,
                    shipmentRequestStatus: 'DELIVERED',
                },
            });

            logger.info(`[LabelTrackingSync] ✅ Order ${order.orderNumber} updated: LABEL_CREATED → DELIVERED (${statusDetailCode})`);
            return { action: 'updated', from: 'LABEL_CREATED', to: 'DELIVERED', statusDetailCode, description: statusDescription };
        }

        logger.info(`[LabelTrackingSync] Order ${order.orderNumber} remains LABEL_CREATED (Status: ${statusDetailCode})`);
        return { action: 'no_change', status: statusDetailCode, description: statusDescription };
    }

    // ---- SHIPPED → DELIVERED ----
    if (order.status === 'SHIPPED') {
        if (DELIVERED_STATUSES.has(statusDetailCode) || DELIVERED_STATUSES.has(statusCode)) {
            logger.info(`[LabelTrackingSync] 📦 Order ${order.orderNumber} has been DELIVERED. Updating status...`);
            // Update order status to DELIVERED
            await prisma.order.update({
                where: { id: order.id },
                data: {
                    status: 'DELIVERED',
                    shipmentRequestStatus: 'DELIVERED',
                },
            });

            // Also update any existing Shipment record to DELIVERED
            try {
                const existingShipment = await prisma.shipment.findFirst({
                    where: { orderId: order.id },
                    orderBy: { createdAt: 'desc' },
                });
                if (existingShipment) {
                    await prisma.shipment.update({
                        where: { id: existingShipment.id },
                        data: {
                            status: 'DELIVERED',
                            deliveredAt: tracking?.actual_delivery_date
                                ? new Date(tracking.actual_delivery_date)
                                : new Date(),
                        },
                    });
                }
            } catch (shipmentUpdateErr) {
                logger.warn(`[LabelTrackingSync] Shipment update failed for order ${order.orderNumber}: ${shipmentUpdateErr.message}`);
            }

            logger.info(`[LabelTrackingSync] ✅ Order ${order.orderNumber} updated: SHIPPED → DELIVERED (${statusDetailCode})`);
            return { action: 'updated', from: 'SHIPPED', to: 'DELIVERED', statusDetailCode, description: statusDescription };
        }

        logger.info(`[LabelTrackingSync] Order ${order.orderNumber} remains SHIPPED (Status: ${statusDetailCode})`);
        return { action: 'no_change', status: statusDetailCode, description: statusDescription };
    }

    return { action: 'skipped', reason: 'unexpected_status' };
}

// ---------- main run function ----------
async function run() {
    if (isSyncRunning) {
        logger.warn('[LabelTrackingSync] Sync already in progress, skipping this run');
        return { skipped: true, reason: 'already_running' };
    }

    isSyncRunning = true;
    const summary = { total: 0, checked: 0, updated: 0, errors: 0, details: [] };

    try {
        // Scalability: Find orders that haven't been synced yet (highest priority)
        const unsyncedOrders = await prisma.order.findMany({
            where: {
                status: { in: ['SHIPPED', 'LABEL_CREATED'] },
                shipstationLabel: { not: null },
                shippingStatuses: { none: {} }
            },
            include: {
                customer: true,
                items: {
                    include: {
                        variant: {
                            include: {
                                product: true
                            }
                        }
                    }
                }
            },
            take: MAX_ORDERS_PER_RUN,
        });

        let targetOrders = [...unsyncedOrders];

        // If we still have capacity, find orders with the oldest sync records
        if (targetOrders.length < MAX_ORDERS_PER_RUN) {
            const extraCapacity = MAX_ORDERS_PER_RUN - targetOrders.length;
            const staleTracking = await prisma.shippingStatus.findMany({
                where: {
                    order: {
                        status: { in: ['SHIPPED', 'LABEL_CREATED'] }
                    }
                },
                orderBy: { updatedAt: 'asc' },
                take: extraCapacity,
                include: {
                    order: {
                        include: {
                            customer: true,
                            items: {
                                include: {
                                    variant: {
                                        include: {
                                            product: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            const staleOrders = staleTracking.map(st => st.order);
            targetOrders = [...targetOrders, ...staleOrders];
        }

        // Filter and ensure we have unique orders with label_ids
        const withLabelId = targetOrders.filter((o, index, self) => {
            const label = o.shipstationLabel;
            const isUnique = self.findIndex(t => t.id === o.id) === index;
            return isUnique && label && typeof label === 'object' && label.label_id;
        });

        summary.total = withLabelId.length;

        if (withLabelId.length === 0) {
            logger.info('[LabelTrackingSync] No orders with labels to sync');
            return summary;
        }

        logger.info(`[LabelTrackingSync] Starting incremental sync for ${withLabelId.length} orders (prioritizing stale)`);

        const batches = chunk(withLabelId, BATCH_SIZE);

        for (let bi = 0; bi < batches.length; bi++) {
            const batch = batches[bi];
            logger.info(`[LabelTrackingSync] Processing batch ${bi + 1}/${batches.length} (${batch.length} orders)`);

            for (const order of batch) {
                try {
                    const result = await syncSingleOrder(order);
                    summary.checked += 1;
                    if (result.action === 'updated') {
                        summary.updated += 1;
                    }
                    summary.details.push({
                        orderNumber: order.orderNumber,
                        ...result,
                    });
                } catch (err) {
                    summary.errors += 1;
                    summary.details.push({
                        orderNumber: order.orderNumber,
                        action: 'error',
                        error: err.message,
                    });
                    logger.error(`[LabelTrackingSync] ❌ Error processing order ${order.orderNumber}: ${err.message}`);
                }

                // Rate limit: wait between API calls
                await sleep(DELAY_BETWEEN_CALLS_MS);
            }

            // Pause between batches
            if (bi < batches.length - 1) {
                await sleep(DELAY_BETWEEN_BATCHES_MS);
            }
        }

    } finally {
        isSyncRunning = false;
    }

    logger.info(`[LabelTrackingSync] Sync complete`, {
        total: summary.total,
        checked: summary.checked,
        updated: summary.updated,
        errors: summary.errors,
    });

    return summary;
}

// ---------- single order check (for manual API) ----------
async function checkSingleLabel(labelId) {
    const { data: tracking } = await ssRequest('GET', `/v2/labels/${encodeURIComponent(labelId)}/track`);
    return tracking;
}

module.exports = { run, syncSingleOrder, checkSingleLabel };
