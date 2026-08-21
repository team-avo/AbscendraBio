/**
 * GHL -> backend email bridge.
 *
 * "GHL as the brain, Resend as the sender." A GoHighLevel workflow decides the
 * timing/logic of a lifecycle sequence (welcome, abandoned cart, re-engagement)
 * and, instead of GHL emailing via its own Mailgun domain, calls this webhook.
 * We send the matching branded template through Resend on the storefront's own
 * verified domain (lineara.co) — keeping all Lineará email on one proven,
 * on-brand channel and sidestepping the GHL/Mailgun DKIM problems from Ascendra.
 *
 * Auth: a shared secret (GHL webhook action sets it as the `x-webhook-token`
 * header, or `?token=` on the URL). Compared timing-safe against
 * GHL_EMAIL_WEBHOOK_SECRET. No secret configured -> 503.
 *
 * Safety: only LIFECYCLE/marketing template types are allowed. Auth-sensitive
 * (PASSWORD_RESET, ACCOUNT_VERIFICATION) and transactional (ORDER_CONFIRMATION,
 * etc.) types are NOT reachable here, so a leaked secret cannot be used to spam
 * password resets or fake order emails.
 *
 * Body: { email, templateType, brand?, data? }
 *   email        recipient (required)
 *   templateType one of ALLOWED_TEMPLATE_TYPES (required)
 *   brand        "lineara" (default) | "ascendra"
 *   data         merge fields for the template ({{firstName}}, {{cartItems}}, ...)
 */
const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const logger = require("../utils/logger");
const { sendEmailWithTemplate, brandStoreData } = require("../utils/emailService");

// Lifecycle/marketing sends the bridge may trigger. Deliberately excludes
// auth (PASSWORD_RESET / ACCOUNT_VERIFICATION) and transactional
// (ORDER_CONFIRMATION, etc.) types so a leaked secret cannot abuse them.
//   LINEARA_WELCOME   Lineará's own welcome — copy edited in the admin template UI.
//   WELCOME_EMAIL     Ascendra's shared welcome (kept available for completeness).
//   MARKETING_GENERIC flexible branded shell — GHL supplies {{subject}},
//                     {{heading}}, {{bodyHtml}} per email (abandoned cart,
//                     re-engagement, any sequence step).
const ALLOWED_TEMPLATE_TYPES = new Set([
  "LINEARA_WELCOME",
  "WELCOME_EMAIL",
  "MARKETING_GENERIC",
]);

const ALLOWED_BRANDS = new Set(["lineara", "ascendra"]);

function timingSafeEqual(a, b) {
  const ab = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  if (ab.length !== bb.length || ab.length === 0) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function isEmail(v) {
  return typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

router.post("/send-email", async (req, res) => {
  const secret = process.env.GHL_EMAIL_WEBHOOK_SECRET;
  if (!secret) {
    logger.warn("[ghl-webhook] called but GHL_EMAIL_WEBHOOK_SECRET is not set");
    return res.status(503).json({ success: false, error: "bridge not configured" });
  }

  const provided = req.get("x-webhook-token") || req.query.token || (req.body && req.body.token);
  if (!timingSafeEqual(provided, secret)) {
    return res.status(401).json({ success: false, error: "unauthorized" });
  }

  const body = req.body || {};
  const email = body.email || body.contactEmail || body.contact_email;
  const templateType = body.templateType || body.template_type;
  const brand = ALLOWED_BRANDS.has(body.brand) ? body.brand : "lineara";
  // Merge brand store details (storeName/storeEmail/storeAddress used by the
  // wrapper + footer) first, then let GHL-provided fields override. Without this
  // the footer would render literal {{storeEmail}} placeholders.
  const data = { ...brandStoreData(brand), ...((body.data && typeof body.data === "object") ? body.data : {}) };

  if (!isEmail(email)) {
    return res.status(400).json({ success: false, error: "valid email is required" });
  }
  if (!templateType || !ALLOWED_TEMPLATE_TYPES.has(templateType)) {
    return res.status(400).json({
      success: false,
      error: `templateType must be one of: ${[...ALLOWED_TEMPLATE_TYPES].join(", ")}`,
    });
  }

  try {
    const result = await sendEmailWithTemplate(templateType, email, data, brand);
    logger.info(`[ghl-webhook] queued ${templateType} (${brand}) for ${email} job=${result.jobId}`);
    return res.json({ success: true, queued: true, jobId: result.jobId });
  } catch (err) {
    logger.error(`[ghl-webhook] failed to queue ${templateType} for ${email}: ${err.message}`);
    return res.status(500).json({ success: false, error: "failed to queue email" });
  }
});

module.exports = router;
