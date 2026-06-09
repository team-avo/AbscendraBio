/**
 * ShipStation / ShipEngine webhook signature verification.
 *
 * Implements the documented RSA-SHA256 + JWKS scheme:
 *   https://www.shipengine.com/docs/webhooks/
 *
 * - Signature headers: x-shipengine-rsa-sha256-key-id / -signature / -timestamp
 * - Public keys fetched from the JWKS endpoint (cached) and matched by `kid`
 * - Signed payload is `${timestamp}.${rawBody}` using the RAW, unparsed body
 * - Missing headers -> 404, stale/invalid timestamp -> 400, bad signature -> 401
 */
const crypto = require('crypto');

const JWKS_URL = process.env.SHIPSTATION_JWKS_URL || 'https://api.shipengine.com/jwks';
const REPLAY_WINDOW_MS = parseInt(process.env.SHIPSTATION_WEBHOOK_REPLAY_MS || '300000', 10); // 5 min
const fetchFn = globalThis.fetch;

let jwksCache = { keysByKid: {}, fetchedAt: 0 };

async function fetchJwks() {
  const res = await fetchFn(JWKS_URL);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const body = await res.json();
  const keysByKid = {};
  for (const k of body.keys || []) keysByKid[k.kid] = k;
  jwksCache = { keysByKid, fetchedAt: Date.now() };
  return keysByKid;
}

async function getJwk(kid) {
  if (jwksCache.keysByKid[kid]) return jwksCache.keysByKid[kid];
  const keysByKid = await fetchJwks(); // refresh on cache miss
  return keysByKid[kid];
}

/**
 * Low-level: verify a base64 RSA-SHA256 signature of `signedData` against a JWK.
 * Exported for unit testing. Returns boolean.
 */
function verifySignature(signedData, signatureB64, jwk) {
  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  return crypto.verify(
    'sha256',
    Buffer.from(signedData, 'utf8'),
    publicKey,
    Buffer.from(signatureB64, 'base64'),
  );
}

/**
 * Verify an incoming webhook.
 * @param {string} rawBody  raw, unparsed request body
 * @param {object} headers  request headers (case-insensitive lookups handled)
 * @returns {Promise<{ok: boolean, status: number, reason?: string}>}
 */
async function verifyWebhook(rawBody, headers) {
  const h = (name) => headers[name] ?? headers[name.toLowerCase()];
  const keyId = h('x-shipengine-rsa-sha256-key-id');
  const signature = h('x-shipengine-rsa-sha256-signature');
  const timestamp = h('x-shipengine-timestamp');

  // Missing headers -> 404 to hide the endpoint from probes.
  if (!keyId || !signature || !timestamp) {
    return { ok: false, status: 404, reason: 'missing signature headers' };
  }

  // Replay protection: timestamp must be within ±REPLAY_WINDOW (allow future skew).
  const ts = Date.parse(timestamp);
  if (Number.isNaN(ts) || Math.abs(Date.now() - ts) > REPLAY_WINDOW_MS) {
    return { ok: false, status: 400, reason: 'stale or invalid timestamp' };
  }

  let jwk;
  try {
    jwk = await getJwk(keyId);
  } catch (e) {
    return { ok: false, status: 401, reason: `jwks error: ${e.message}` };
  }
  if (!jwk) return { ok: false, status: 401, reason: 'unknown key id' };

  try {
    const ok = verifySignature(`${timestamp}.${rawBody}`, signature, jwk);
    return ok
      ? { ok: true, status: 200 }
      : { ok: false, status: 401, reason: 'signature mismatch' };
  } catch (e) {
    return { ok: false, status: 401, reason: `verify error: ${e.message}` };
  }
}

module.exports = { verifyWebhook, verifySignature, fetchJwks, JWKS_URL };
