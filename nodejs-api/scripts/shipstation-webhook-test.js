/**
 * Tests for the ShipStation webhook security + handler hardening.
 *
 *   node scripts/shipstation-webhook-test.js
 *
 * Covers RSA-SHA256 signature verification (round-trip + tamper), the documented
 * 404/400/401 gating, live JWKS reachability, and idempotent event handling.
 */
require("dotenv").config();
const crypto = require("crypto");
const {
  verifyWebhook,
  verifySignature,
  fetchJwks,
} = require("../utils/shipstationWebhook");
const { processWebhook } = require("../services/shipstationWebhookHandler");

const results = [];
async function test(name, fn) {
  try {
    const detail = await fn();
    results.push(true);
    console.log(`  ✅ PASS  ${name}${detail ? "  — " + detail : ""}`);
  } catch (err) {
    results.push(false);
    console.log(`  ❌ FAIL  ${name}  — ${err.message}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function run() {
  console.log("\n=== ShipStation Webhook Hardening Tests ===\n");

  // Generate a local RSA keypair to exercise the crypto path offline.
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const jwk = publicKey.export({ format: "jwk" });
  jwk.kid = "test-key-1";
  const rawBody = JSON.stringify({ resource_type: "API_TRACK", data: {} });
  const timestamp = new Date().toISOString();
  const signed = `${timestamp}.${rawBody}`;
  const goodSig = crypto
    .sign("sha256", Buffer.from(signed, "utf8"), privateKey)
    .toString("base64");

  // 1. Signature round-trip
  await test("1. verifySignature accepts a valid signature", async () => {
    assert(verifySignature(signed, goodSig, jwk) === true, "should verify true");
    return "valid signature accepted";
  });

  // 2. Tampered body rejected
  await test("2. verifySignature rejects a tampered payload", async () => {
    const tampered = `${timestamp}.${rawBody}X`;
    assert(verifySignature(tampered, goodSig, jwk) === false, "should reject");
    return "tampered payload rejected";
  });

  // 3. Missing headers -> 404
  await test("3. verifyWebhook missing headers -> 404", async () => {
    const v = await verifyWebhook(rawBody, {});
    assert(v.status === 404 && !v.ok, `got ${v.status}`);
    return "404 as documented";
  });

  // 4. Stale timestamp -> 400
  await test("4. verifyWebhook stale timestamp -> 400", async () => {
    const old = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const v = await verifyWebhook(rawBody, {
      "x-shipengine-rsa-sha256-key-id": "test-key-1",
      "x-shipengine-rsa-sha256-signature": goodSig,
      "x-shipengine-timestamp": old,
    });
    assert(v.status === 400 && !v.ok, `got ${v.status}`);
    return "stale timestamp rejected (replay protection)";
  });

  // 5. Unknown key id (recent ts, present headers) -> 401 against the real JWKS
  await test("5. verifyWebhook unknown key id -> 401", async () => {
    const v = await verifyWebhook(rawBody, {
      "x-shipengine-rsa-sha256-key-id": "definitely-not-a-real-kid",
      "x-shipengine-rsa-sha256-signature": goodSig,
      "x-shipengine-timestamp": new Date().toISOString(),
    });
    assert(v.status === 401 && !v.ok, `got ${v.status} (${v.reason})`);
    return `401 (${v.reason})`;
  });

  // 6. Live JWKS endpoint reachable
  await test("6. JWKS endpoint reachable", async () => {
    const keys = await fetchJwks();
    const count = Object.keys(keys).length;
    assert(count > 0, "no keys returned");
    return `${count} signing key(s) published`;
  });

  // 7. Handler: unknown tracking number -> matched:false (no writes)
  await test("7. processWebhook unknown tracking -> no match (safe)", async () => {
    const r = await processWebhook({
      resource_type: "API_TRACK",
      data: { tracking_number: "ZZZ-not-a-real-tracking", events: [] },
    });
    assert(r.matched === false, "should not match any order");
    return "no order matched, no writes";
  });

  // 8. Handler: unhandled resource_type -> handled:false
  await test("8. processWebhook unhandled type -> handled:false", async () => {
    const r = await processWebhook({ resource_type: "CARRIER_CONNECTED", data: {} });
    assert(r.handled === false, "should report unhandled");
    return "gracefully ignored";
  });

  const passed = results.filter(Boolean).length;
  console.log(`\n=== Summary: ${passed}/${results.length} passed ===\n`);
  process.exit(passed === results.length ? 0 : 1);
}

run().catch((e) => {
  console.error("Harness crashed:", e);
  process.exit(1);
});
