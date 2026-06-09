/**
 * Tests the admin SHIPPING UI routes end-to-end over HTTP, exactly as the
 * frontend ShipmentManager / rate calculator call them — using a minted admin
 * JWT (programmatic token; no form login). Verifies the fixes that let the
 * legacy UI payloads work against the V2 backend.
 *
 *   node scripts/shipstation-ui-routes-test.js
 */
require("dotenv").config();
const jwt = require("jsonwebtoken");

const BASE = "http://localhost:5001/api";
const ADMIN_ID = "cmnyxg90t0000xmstv8i2gbhk"; // admin@example.com
const ORDER_ID = "cmnyxseir0001xm4vc8elaw7i"; // ORD-10001
const token = jwt.sign({ userId: ADMIN_ID }, process.env.JWT_SECRET, { expiresIn: "1h" });
const H = { "content-type": "application/json", authorization: `Bearer ${token}` };

const results = [];
async function test(name, fn) {
  try { const d = await fn(); results.push(true); console.log(`  ✅ ${name}${d ? "  — " + d : ""}`); }
  catch (e) { results.push(false); console.log(`  ❌ ${name}  — ${e.message}`); }
}
const VALID_SHIPTO = { name: "UI Test", address1: "1600 Amphitheatre Pkwy", city: "Mountain View", state: "CA", postalCode: "94043", country: "US" };

async function run() {
  console.log("\n=== ShipStation Admin UI Routes (HTTP, as the UI calls them) ===\n");

  // 1. GET tracking-events (was a 404 — route didn't exist)
  await test("1. GET /orders/:id/tracking-events", async () => {
    const r = await fetch(`${BASE}/orders/${ORDER_ID}/tracking-events`, { headers: H });
    const j = await r.json();
    if (r.status !== 200 || !j.success || !Array.isArray(j.data)) throw new Error(`status ${r.status} ${JSON.stringify(j).slice(0,120)}`);
    return `200, ${j.data.length} events (array)`;
  });

  // 2. POST /shipstation/rates/estimate with the UI's legacy payload
  await test("2. POST /shipstation/rates/estimate (legacy UI payload)", async () => {
    const r = await fetch(`${BASE}/shipstation/rates/estimate`, { method: "POST", headers: H, body: JSON.stringify({ shipTo: VALID_SHIPTO, weightOz: 16, carrierCode: "se-5365039" }) });
    const j = await r.json();
    const rates = Array.isArray(j.data) ? j.data : j.data?.rates || [];
    if (r.status !== 200 || !j.success || rates.length === 0) throw new Error(`status ${r.status} ${JSON.stringify(j).slice(0,140)}`);
    return `200, ${rates.length} rates`;
  });

  // 3. POST /shipstation/labels with the UI's legacy payload (was broken: read req.body.shipment)
  await test("3. POST /shipstation/labels (legacy UI payload, test label)", async () => {
    const r = await fetch(`${BASE}/shipstation/labels`, {
      method: "POST", headers: H,
      body: JSON.stringify({ orderId: ORDER_ID, shipTo: VALID_SHIPTO, serviceCode: "usps_ground_advantage", weightOz: 16, test_label: true }),
    });
    const j = await r.json();
    if (r.status !== 200 || !j.success || !j.data?.tracking_number) throw new Error(`status ${r.status} ${JSON.stringify(j).slice(0,160)}`);
    return `200, label=${j.data.label_id} tracking=${j.data.tracking_number}`;
  });

  // 4. POST /shipstation/labels with neither shipment nor serviceCode -> 400
  await test("4. POST /shipstation/labels missing data -> 400", async () => {
    const r = await fetch(`${BASE}/shipstation/labels`, { method: "POST", headers: H, body: JSON.stringify({ orderId: ORDER_ID }) });
    if (r.status !== 400) throw new Error(`expected 400, got ${r.status}`);
    return "rejected with 400 as expected";
  });

  // 5. Auth guard still works (no token -> 401)
  await test("5. Auth guard: no token -> 401", async () => {
    const r = await fetch(`${BASE}/orders/${ORDER_ID}/tracking-events`);
    if (r.status !== 401) throw new Error(`expected 401, got ${r.status}`);
    return "401 without token";
  });

  const passed = results.filter(Boolean).length;
  console.log(`\n=== Summary: ${passed}/${results.length} passed ===\n`);
  process.exit(passed === results.length ? 0 : 1);
}
run().catch((e) => { console.error("crashed:", e); process.exit(1); });
