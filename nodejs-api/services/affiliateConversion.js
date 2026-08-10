/* Affiliate conversion reporting — signed webhook to the Lineará partner portal.
 *
 * Fires ONCE when an order's payment is CONFIRMED (never on creation) for orders that carry affiliate
 * attribution (order.affiliateId, captured at checkout from the sealed lineara_ref cookie). Credits
 * the affiliate on the portal side. Per the portal's STOREFRONT_INTEGRATION contract:
 *   POST {AFFILIATE_PORTAL_BASE_URL}/api/integrations/orders
 *   Headers: X-Lineara-Timestamp (unix seconds), X-Lineara-Signature: "sha256=" + hex HMAC-SHA256
 *            of "<timestamp>.<raw body>" keyed with the WRITE signing secret (per-origin), ±5m skew.
 *   Idempotency on eventId ONLY (we use a deterministic evt_paid_<orderId>).
 *   commissionableCents = merchandise subtotal − discounts (shipping + tax EXCLUDED); items must sum
 *   to it exactly. Amounts are integer cents.
 *
 * DORMANT-BY-DEFAULT: no-op unless BOTH AFFILIATE_PORTAL_BASE_URL and AFFILIATE_PORTAL_WRITE_SECRET
 * are set — safe to deploy before the secret arrives. FAIL-SAFE: never throws into the payment path;
 * retries 5xx/202/network with backoff; never retries 4xx (a malformed call won't fix itself).
 *
 * WRITE secret (HMAC, this file) is a DIFFERENT credential from the READ bearer key the storefront
 * uses to resolve slugs — never interchange them.
 */

const crypto = require("crypto");
const prisma = require("../prisma/client");
const logger = require("../utils/logger");

const CONVERSION_PATH = "/api/integrations/orders";
const MAX_ATTEMPTS = 4;
const TIMEOUT_MS = 10000;

const baseUrl = () => (process.env.AFFILIATE_PORTAL_BASE_URL || "").trim().replace(/\/+$/, "");
const writeSecret = () => (process.env.AFFILIATE_PORTAL_WRITE_SECRET || "").trim();
const isEnabled = () => Boolean(baseUrl() && writeSecret());

const toCents = (d) => Math.round(Number(d) * 100);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// "sha256=" + lowercase hex HMAC-SHA256 of "<ts>.<body>", keyed with the WRITE secret.
function signature(ts, rawBody) {
  return "sha256=" + crypto.createHmac("sha256", writeSecret()).update(`${ts}.${rawBody}`).digest("hex");
}

/* POST a serialized event with fresh signature per attempt (timestamp must be within skew each try). */
async function postEvent(payload) {
  if (!isEnabled()) {
    logger.info(`[affiliate] portal dormant (env unset) — not reporting ${payload.event} ${payload.orderRef}`);
    return { skipped: true };
  }
  const rawBody = JSON.stringify(payload); // serialise ONCE; sign and post these exact bytes
  const url = baseUrl() + CONVERSION_PATH;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const ts = Math.floor(Date.now() / 1000).toString();
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Lineara-Timestamp": ts,
          "X-Lineara-Signature": signature(ts, rawBody),
        },
        body: rawBody,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const text = await res.text().catch(() => "");

      if (res.status === 200) {
        // recorded | duplicate | held_for_review — all terminal successes, do NOT retry
        logger.info(`[affiliate] ${payload.event} ${payload.orderRef} -> 200 ${text}`);
        return { ok: true, status: 200, body: text };
      }
      if (res.status >= 400 && res.status < 500) {
        // malformed/unauthorized — retrying won't help; surface loudly
        logger.error(`[affiliate] ${payload.event} ${payload.orderRef} -> ${res.status} ${text} (NOT retrying)`);
        return { ok: false, status: res.status, body: text };
      }
      // 202 held (wants retry) or 5xx — fall through to backoff
      logger.warn(`[affiliate] ${payload.event} ${payload.orderRef} -> ${res.status} ${text} (attempt ${attempt}/${MAX_ATTEMPTS})`);
    } catch (err) {
      logger.warn(`[affiliate] ${payload.event} ${payload.orderRef} network error attempt ${attempt}/${MAX_ATTEMPTS}: ${err.message}`);
    }
    if (attempt < MAX_ATTEMPTS) await sleep(500 * 2 ** (attempt - 1)); // 0.5s, 1s, 2s
  }
  logger.error(`[affiliate] gave up reporting ${payload.event} ${payload.orderRef} after ${MAX_ATTEMPTS} attempts`);
  return { ok: false, gaveUp: true };
}

/* Build order.paid line items — each line's ACTUAL charged total (bulk price when a discount applied,
   else the regular line total). commissionableCents is their exact sum (shipping/tax excluded). */
function buildItems(order) {
  return (order.items || []).map((it) => {
    const charged = it.bulkTotalPrice != null ? it.bulkTotalPrice : it.totalPrice;
    const line = { sku: it.variant?.sku || "unknown", quantity: it.quantity, amountCents: toCents(charged) };
    const name = it.variant?.product?.name;
    if (name) line.name = name; // optional; omit rather than send empty
    return line;
  });
}

/* Report a confirmed payment. Call at each payment-CONFIRMED site. No-op for non-affiliate orders.
   `occurredAt` should be the confirmation instant (defaults to now). Never throws. */
async function reportPaidConversion(orderId, { occurredAt } = {}) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { variant: { include: { product: true } } } } },
    });
    if (!order || !order.affiliateId) return { skipped: true }; // not affiliate-attributed
    if (!isEnabled()) return { skipped: true };

    const items = buildItems(order);
    const commissionableCents = items.reduce((s, i) => s + i.amountCents, 0);
    const payload = {
      event: "order.paid",
      eventId: `evt_paid_${order.id}`, // deterministic → idempotent on retry
      orderRef: order.orderNumber,
      affiliateId: order.affiliateId,
      occurredAt: (occurredAt ? new Date(occurredAt) : new Date()).toISOString(),
      currency: "USD",
      totalCents: toCents(order.totalAmount),
      commissionableCents,
      items,
    };
    if (order.affiliateSlug) payload.affiliateCode = order.affiliateSlug;
    if (order.affiliateClickId) payload.clickId = order.affiliateClickId;
    return await postEvent(payload);
  } catch (err) {
    logger.error(`[affiliate] reportPaidConversion(${orderId}) failed (non-fatal): ${err.message}`);
    return { ok: false, error: err.message };
  }
}

/* Report a reversal (order.refunded | order.cancelled | order.chargeback) against a prior order.paid.
   Only meaningful for orders that were paid (and thus reported). `items` defaults to the full order.
   Ready helper — wire into the cancel/refund path once the paid path is validated in the rehearsal. */
async function reportReversal(orderId, event, { items, note, occurredAt } = {}) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { variant: { include: { product: true } } } } },
    });
    if (!order || !order.affiliateId) return { skipped: true };
    if (!isEnabled()) return { skipped: true };

    const payload = {
      event, // order.refunded | order.cancelled | order.chargeback
      eventId: `evt_${event.replace("order.", "")}_${order.id}`,
      originalEventId: `evt_paid_${order.id}`,
      orderRef: order.orderNumber,
      occurredAt: (occurredAt ? new Date(occurredAt) : new Date()).toISOString(),
      items: items || buildItems(order),
    };
    if (note) payload.note = note;
    return await postEvent(payload);
  } catch (err) {
    logger.error(`[affiliate] reportReversal(${orderId}, ${event}) failed (non-fatal): ${err.message}`);
    return { ok: false, error: err.message };
  }
}

module.exports = { reportPaidConversion, reportReversal, isEnabled, signature, buildItems };
