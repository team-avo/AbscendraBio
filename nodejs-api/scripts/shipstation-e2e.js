/**
 * Full end-to-end ShipStation flow test (system level).
 *
 *   node scripts/shipstation-e2e.js
 *
 * Requires the backend running with SHIPSTATION_JWKS_URL pointed at this
 * script's local JWKS server (so the signed webhook can be verified):
 *   SHIPSTATION_JWKS_URL=http://localhost:4790/jwks npm start
 *
 * Steps: create test order -> rate shop -> buy test label -> persist tracking
 * -> deliver a real RSA-SHA256-signed tracking webhook over HTTP -> verify DB
 * -> verify idempotency on redelivery -> clean up the test order.
 */
require("dotenv").config();
const http = require("http");
const crypto = require("crypto");
const prisma = require("../prisma/client");
const { ssRequest } = require("../utils/shipstationClient");
const { getShipFrom } = require("../config/shipFrom");
const { createShipmentForOrder } = require("../services/shipmentService");

const BACKEND = "http://localhost:5001";
const JWKS_PORT = 4790;
const CUSTOMER_ID = "cmnyxg9oe0038xmstjvk02snt"; // john.doe@example.com (seed)

const steps = [];
function ok(name, detail) { steps.push({ name, ok: true, detail }); console.log(`  ✅ ${name}${detail ? "  — " + detail : ""}`); }
function bad(name, detail) { steps.push({ name, ok: false, detail }); console.log(`  ❌ ${name}  — ${detail}`); }

async function main() {
  console.log("\n=== ShipStation END-TO-END Flow Test ===\n");

  // RSA keypair + local JWKS server so the backend can verify our webhook.
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  // Unique kid per run so the backend's JWKS cache (keyed by kid) always
  // fetches THIS run's fresh public key instead of a previously cached one.
  const KID = `e2e-key-${Date.now()}`;
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: KID, use: "sig", alg: "RS256" };
  const jwksServer = http
    .createServer((req, res) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ keys: [jwk] })); })
    .listen(JWKS_PORT);

  const stamp = Date.now();
  const orderNumber = `E2E-${stamp}`;
  const uniqueTracking = `E2E-TRK-${stamp}`;
  let order;

  try {
    // STEP 1 — create a test order with a VALID, deliverable US address
    order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: CUSTOMER_ID,
        subtotal: 10.0,
        totalAmount: 10.0,
        status: "PROCESSING",
        shippingFirstName: "E2E",
        shippingLastName: "Tester",
        shippingAddress1: "1600 Amphitheatre Pkwy",
        shippingCity: "Mountain View",
        shippingState: "CA",
        shippingPostalCode: "94043",
        shippingCountry: "US",
        shippingPhone: "650-253-0000",
      },
    });
    ok("1. Create test order", `id=${order.id} (${orderNumber})`);

    // STEP 2 — rate shop across all connected carriers
    const carriers = (await ssRequest("GET", "/v2/carriers")).data.carriers || [];
    const from = getShipFrom();
    const est = await ssRequest("POST", "/v2/rates/estimate", {
      carrier_ids: carriers.map((c) => c.carrier_id),
      from_country_code: from.country_code, from_postal_code: from.postal_code,
      to_country_code: "US", to_postal_code: "94043",
      to_city_locality: "Mountain View", to_state_province: "CA",
      weight: { value: 16, unit: "ounce" },
      address_residential_indicator: "no",
    });
    const rates = (Array.isArray(est.data) ? est.data : est.data.rates || [])
      .filter((r) => r.shipping_amount)
      .sort((a, b) => a.shipping_amount.amount - b.shipping_amount.amount);
    if (!rates.length) throw new Error("no rates");
    ok("2. Rate shop", `${rates.length} rates; cheapest ${rates[0].service_code} $${rates[0].shipping_amount.amount}`);

    // STEP 3 — buy a (test) label via the real service, with address validation on
    const label = await createShipmentForOrder(order.id, { testLabel: true, validateAddress: "validate_and_clean" });
    if (!label.labelId) throw new Error("no label");
    ok("3. Buy label (validate_and_clean)", `label=${label.labelId} status=${label.shipmentStatus}`);

    // STEP 4 — persist tracking on the order (mimics routes/orders.js SHIPPED flow)
    await prisma.order.update({
      where: { id: order.id },
      data: { shipmentTrackingNumber: uniqueTracking, shipmentRequestStatus: "ACCEPTED_BY_SHIPPER", status: "SHIPPED" },
    });
    ok("4. Persist tracking on order", `tracking=${uniqueTracking}, status=SHIPPED`);

    // STEP 5 — deliver a REAL signed tracking webhook over HTTP
    const sendWebhook = async () => {
      const payload = JSON.stringify({
        resource_type: "API_TRACK",
        data: {
          tracking_number: uniqueTracking, status_code: "DE", status_description: "Delivered",
          events: [{ occurred_at: new Date(stamp).toISOString(), status_code: "DE", description: "Delivered, Front Door", city_locality: "Mountain View", state_province: "CA", postal_code: "94043", country_code: "US" }],
        },
      });
      const ts = new Date().toISOString();
      const sig = crypto.sign("sha256", Buffer.from(`${ts}.${payload}`, "utf8"), privateKey).toString("base64");
      const res = await fetch(`${BACKEND}/api/webhooks/shipstation`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-shipengine-rsa-sha256-key-id": KID,
          "x-shipengine-rsa-sha256-signature": sig,
          "x-shipengine-timestamp": ts,
        },
        body: payload,
      });
      return res.status;
    };

    const s1 = await sendWebhook();
    if (s1 !== 200) throw new Error(`webhook returned ${s1}`);
    await new Promise((r) => setTimeout(r, 1200)); // handler processes async after 200
    ok("5. Signed webhook accepted (HTTP)", `200 OK, RSA-SHA256 verified`);

    // STEP 6 — verify DB effects
    const afterFirst = await prisma.order.findUnique({ where: { id: order.id } });
    const events1 = await prisma.shipmentTrackingEvent.count({ where: { orderId: order.id } });
    if (afterFirst.shipmentRequestStatus !== "DELIVERED") throw new Error(`status=${afterFirst.shipmentRequestStatus}`);
    if (events1 < 1) throw new Error("no tracking events written");
    ok("6. DB updated by webhook", `status=DELIVERED, trackingEvents=${events1}`);

    // STEP 7 — idempotency: redeliver same webhook, expect NO duplicate events
    const s2 = await sendWebhook();
    await new Promise((r) => setTimeout(r, 1200));
    const events2 = await prisma.shipmentTrackingEvent.count({ where: { orderId: order.id } });
    if (s2 !== 200) throw new Error(`redelivery returned ${s2}`);
    if (events2 !== events1) bad("7. Idempotent redelivery", `events grew ${events1} -> ${events2}`);
    else ok("7. Idempotent redelivery", `events stayed ${events2} (no duplicates)`);
  } catch (err) {
    bad("FLOW", err.message + (err.status ? ` (HTTP ${err.status})` : ""));
  } finally {
    // STEP 8 — clean up the test order + its events
    if (order) {
      await prisma.shipmentTrackingEvent.deleteMany({ where: { orderId: order.id } });
      await prisma.orderItem.deleteMany({ where: { orderId: order.id } }).catch(() => {});
      await prisma.order.delete({ where: { id: order.id } }).catch(() => {});
      ok("8. Cleanup test order", `deleted ${orderNumber}`);
    }
    jwksServer.close();
    await prisma.$disconnect();
  }

  const passed = steps.filter((s) => s.ok).length;
  console.log(`\n=== Summary: ${passed}/${steps.length} steps passed ===\n`);
  process.exit(passed === steps.length ? 0 : 1);
}

main().catch((e) => { console.error("E2E crashed:", e); process.exit(1); });
