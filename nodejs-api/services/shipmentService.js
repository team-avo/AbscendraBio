const { ssRequest } = require("../utils/shipstationClient");
const prisma = require("../prisma/client");
const logger = require("../utils/logger");
const { getShipFrom, getDefaultDimensions } = require("../config/shipFrom");

const DEFAULT_SERVICE_CODE =
  process.env.SHIPSTATION_DEFAULT_SERVICE_CODE || "usps_ground_advantage";

// Address validation mode for label creation. "validate_and_clean" (the safe
// production default) blocks labels for undeliverable addresses; can be relaxed
// to "validate_only" or "no_validation" via env.
const DEFAULT_VALIDATE_ADDRESS =
  process.env.SHIPSTATION_VALIDATE_ADDRESS || "validate_and_clean";

/**
 * Create a shipping label in ShipStation (V2 API) for an order.
 *
 * Uses the V2 `/v2/labels` endpoint (the legacy V1 `/shipments/createlabel`
 * endpoint does not exist on api.shipstation.com). Ship-from comes from the
 * configurable origin in config/shipFrom.js.
 *
 * @param {string} orderId
 * @param {object} [opts]
 * @param {boolean} [opts.testLabel=true] create a non-billable test label
 * @param {string}  [opts.serviceCode]    override the carrier service code
 * @param {string}  [opts.validateAddress] override address validation mode
 * @returns {Promise<{shipmentId, trackingNumber, shipmentStatus, labelUrl, labelId, shipmentCost}>}
 */
async function createShipmentForOrder(orderId, opts = {}) {
  // Test vs real labels. Controlled by env so the test phase (free fake labels)
  // and go-live (real, paid labels) is a one-line switch, no code change.
  // NOTE: FedEx does NOT support test labels — keep the default carrier on USPS
  // while SHIPSTATION_TEST_LABELS=true.
  const testLabel =
    opts.testLabel !== undefined
      ? opts.testLabel
      : process.env.SHIPSTATION_TEST_LABELS === "true";
  const serviceCode = opts.serviceCode || DEFAULT_SERVICE_CODE;
  const validateAddress = opts.validateAddress || DEFAULT_VALIDATE_ADDRESS;

  try {
    logger.info("[ShipmentService] Creating V2 label for order", {
      orderId,
      testLabel,
      serviceCode,
    });

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: {
          include: {
            variant: { include: { product: true } },
          },
        },
      },
    });

    if (!order) throw new Error("Order not found");

    // Read shipping address from denormalized order fields, fallback to FK lookup
    let shippingAddress;
    if (order.shippingFirstName) {
      shippingAddress = {
        firstName: order.shippingFirstName,
        lastName: order.shippingLastName || "",
        address1: order.shippingAddress1 || "",
        city: order.shippingCity || "",
        state: order.shippingState || "",
        postalCode: order.shippingPostalCode || "",
        country: order.shippingCountry || "US",
        phone: order.shippingPhone || null,
      };
    } else if (order.shippingAddressId) {
      shippingAddress = await prisma.address.findUnique({
        where: { id: order.shippingAddressId },
      });
    }
    if (!shippingAddress) throw new Error("Shipping address not found");

    // Package weight. NOTE: ProductVariant has a `weight` column (Decimal) but
    // its UNIT is not encoded in the schema, so by default we use a safe flat
    // per-item ounce weight (the previous code referenced a non-existent
    // `weightOz` field and so always fell back to 16oz). Once the column's unit
    // is confirmed, set SHIPSTATION_WEIGHT_UNIT (gram|ounce|pound|kilogram) to
    // use the real per-variant weights.
    const weightUnit = process.env.SHIPSTATION_WEIGHT_UNIT;
    const defaultItemOz = parseFloat(
      process.env.SHIPSTATION_DEFAULT_ITEM_WEIGHT_OZ || "16",
    );
    let packageWeight;
    if (weightUnit) {
      const total = order.items.reduce(
        (t, item) =>
          t +
          (item.variant?.weight != null ? Number(item.variant.weight) : 0) *
            item.quantity,
        0,
      );
      packageWeight =
        total > 0
          ? { value: total, unit: weightUnit }
          : { value: defaultItemOz, unit: "ounce" };
    } else {
      const totalOz = order.items.reduce(
        (t, item) => t + defaultItemOz * item.quantity,
        0,
      );
      packageWeight = {
        value: Math.max(1, Math.ceil(totalOz || defaultItemOz)),
        unit: "ounce",
      };
    }

    const shipTo = {
      name:
        `${shippingAddress.firstName || ""} ${shippingAddress.lastName || ""}`.trim() ||
        "Customer",
      phone:
        shippingAddress.phone || order.customer?.mobile || "000-000-0000",
      address_line1: shippingAddress.address1,
      city_locality: shippingAddress.city,
      state_province: shippingAddress.state,
      postal_code: shippingAddress.postalCode,
      country_code: shippingAddress.country || "US",
      address_residential_indicator: "yes",
    };

    // ShipStation V2 label payload.
    // - external_shipment_id ties the ShipStation shipment back to our order
    //   (traceability + helps avoid duplicate shipments on retry).
    // - validate_address asks ShipStation to validate & clean the destination
    //   before buying the label, catching bad addresses early.
    const labelPayload = {
      shipment: {
        external_shipment_id: orderId,
        service_code: serviceCode,
        ship_from: getShipFrom(),
        ship_to: shipTo,
        packages: [{ weight: packageWeight, dimensions: getDefaultDimensions() }],
      },
      validate_address: validateAddress,
      test_label: testLabel,
      label_format: "pdf",
      label_layout: "4x6",
      label_download_type: "url",
    };

    logger.debug("[ShipmentService] Sending /v2/labels payload", {
      service_code: serviceCode,
    });
    const labelResp = await ssRequest("POST", "/v2/labels", labelPayload);
    const data = labelResp.data || labelResp;
    logger.info("[ShipmentService] ✅ V2 label created", {
      label_id: data.label_id,
      tracking_number: data.tracking_number,
    });

    return {
      labelId: data.label_id,
      shipmentId: data.shipment_id,
      trackingNumber: data.tracking_number,
      shipmentStatus: data.status || "completed",
      labelUrl: data.label_download?.href || data.label_download?.pdf || null,
      shipmentCost: data.shipment_cost?.amount ?? null,
    };
  } catch (error) {
    logger.error("[ShipmentService] ❌ Error creating shipment", {
      message: error.message,
    });
    if (error.data) {
      logger.error("[ShipmentService] ShipStation error details", {
        details: error.data,
      });
    }
    throw error;
  }
}

module.exports = { createShipmentForOrder };
