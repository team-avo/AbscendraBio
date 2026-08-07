/* Default transactional email templates — single source of truth.
 *
 * WHY THIS EXISTS: the `email_templates` table shipped empty, so every DB-template email
 * (getEmailTemplate throws when a type is missing) silently failed for BOTH storefronts. This file
 * defines clean, brand-NEUTRAL bodies driven entirely by {{placeholders}}. One template per type
 * serves both Ascendra Bio and Lineará because the sender address, header wordmark, and store
 * details all branch by `order.brand` in utils/emailService.js — the body only ever references
 * {{storeName}} etc., never a hardcoded brand.
 *
 * IMPORTANT: `htmlContent` is INNER body HTML only. processEmailWithTemplateResend wraps it in a
 * full HTML document (brand header logo/wordmark on top, a footer with {{storeEmail}} + {{storeAddress}}
 * below, inside a 600px card with 30px padding). Do NOT add <html>/<head>/header/footer here.
 *
 * PLACEHOLDERS: only keys present in a send function's `data` object are substituted; any unknown
 * {{x}} would render literally. Each template below uses ONLY the keys its sender supplies
 * (see utils/emailService.js). Store fields ({{storeName}}/{{storeEmail}}/{{storePhone}}/{{storeAddress}})
 * are supplied to every template by the brand layer.
 *
 * Consumed by prisma/seed-email-templates.js (upsert into the DB) and the review preview.
 */

// Shared inline styles (email-safe: inline, no external CSS, table layout for detail blocks).
const S = {
  h1: "margin:0 0 14px;font-size:22px;line-height:1.3;font-weight:700;color:#111827;",
  p: "margin:0 0 16px;font-size:15px;line-height:1.65;color:#374151;",
  muted: "margin:20px 0 0;font-size:13px;line-height:1.6;color:#6b7280;",
  sign: "margin:22px 0 0;font-size:15px;line-height:1.6;color:#374151;",
  btn: "display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;",
  card: "border:1px solid #e5e7eb;border-radius:10px;background:#fafafa;margin:0 0 4px;",
  cellL: "padding:9px 18px;font-size:13px;color:#6b7280;vertical-align:top;",
  cellR: "padding:9px 18px;font-size:14px;color:#111827;font-weight:600;text-align:right;vertical-align:top;",
};

// A label/value detail card. `pairs` = [[label, valueHtml], ...].
function detailRows(pairs) {
  const rows = pairs
    .map(
      ([k, v], i) =>
        `<tr><td style="${S.cellL}${i ? "border-top:1px solid #eef0f2;" : ""}">${k}</td>` +
        `<td style="${S.cellR}${i ? "border-top:1px solid #eef0f2;" : ""}">${v}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${S.card}"><tbody>${rows}</tbody></table>`;
}

function button(href, label) {
  return `<p style="margin:22px 0 6px;"><a href="${href}" style="${S.btn}">${label}</a></p>`;
}

const signoff = `<p style="${S.sign}">— The {{storeName}} team</p>`;

const TEMPLATES = [
  {
    type: "ORDER_CONFIRMATION",
    name: "Order Confirmation",
    subject: "Order {{orderNumber}} confirmed — {{storeName}}",
    htmlContent:
      `<h1 style="${S.h1}">Thanks, {{customerName}} — your order is in.</h1>` +
      `<p style="${S.p}">We have received order <strong>{{orderNumber}}</strong> and it is being prepared. Here is a summary for your records.</p>` +
      detailRows([
        ["Order number", "{{orderNumber}}"],
        ["Order date", "{{orderDate}}"],
        ["Items", "{{orderItems}}"],
        ["Order total", "{{orderTotal}}"],
        ["Estimated delivery", "{{estimatedDelivery}}"],
      ]) +
      button("{{orderLink}}", "View your order") +
      `<p style="${S.muted}">If payment is still outstanding, follow the payment instructions shown in your account to release your order. Any questions, just reply to this email.</p>` +
      signoff,
    textContent:
      "Thanks, {{customerName}} — your order is in.\n\n" +
      "We have received order {{orderNumber}} and it is being prepared.\n\n" +
      "Order number: {{orderNumber}}\nOrder date: {{orderDate}}\nItems: {{orderItems}}\nOrder total: {{orderTotal}}\nEstimated delivery: {{estimatedDelivery}}\n\n" +
      "View your order: {{orderLink}}\n\n" +
      "If payment is still outstanding, follow the payment instructions shown in your account to release your order.\n\n— The {{storeName}} team",
  },
  {
    type: "SHIPPING_NOTIFICATION",
    name: "Shipping Notification",
    subject: "Your {{storeName}} order {{orderNumber}} has shipped",
    htmlContent:
      `<h1 style="${S.h1}">Your order is on its way.</h1>` +
      `<p style="${S.p}">Good news, {{customerName}} — order <strong>{{orderNumber}}</strong> has shipped.</p>` +
      detailRows([
        ["Carrier", "{{carrier}}"],
        ["Tracking number", "{{trackingNumber}}"],
        ["Items", "{{orderItems}}"],
        ["Estimated delivery", "{{estimatedDelivery}}"],
      ]) +
      button("{{trackingUrl}}", "Track your shipment") +
      `<p style="${S.muted}">Tracking can take a few hours to update after a label is created. Any questions, just reply to this email.</p>` +
      signoff,
    textContent:
      "Your order is on its way.\n\n" +
      "Good news, {{customerName}} — order {{orderNumber}} has shipped.\n\n" +
      "Carrier: {{carrier}}\nTracking number: {{trackingNumber}}\nItems: {{orderItems}}\nEstimated delivery: {{estimatedDelivery}}\n\n" +
      "Track your shipment: {{trackingUrl}}\n\n— The {{storeName}} team",
  },
  {
    type: "PAYMENT_SUCCESS",
    name: "Payment Received",
    subject: "Payment received for order {{orderNumber}} — {{storeName}}",
    htmlContent:
      `<h1 style="${S.h1}">Payment received — thank you.</h1>` +
      `<p style="${S.p}">Hi {{customerName}}, we have matched your payment to order <strong>{{orderNumber}}</strong>. It is now released and being processed.</p>` +
      detailRows([
        ["Order number", "{{orderNumber}}"],
        ["Amount paid", "{{amountPaid}}"],
        ["Payment method", "{{paymentMethod}}"],
        ["Order total", "{{orderTotal}}"],
        ["Order date", "{{orderDate}}"],
      ]) +
      `<p style="${S.muted}">You will receive a separate email with tracking once your order ships. Any questions, just reply to this email.</p>` +
      signoff,
    textContent:
      "Payment received — thank you.\n\n" +
      "Hi {{customerName}}, we have matched your payment to order {{orderNumber}}. It is now released and being processed.\n\n" +
      "Order number: {{orderNumber}}\nAmount paid: {{amountPaid}}\nPayment method: {{paymentMethod}}\nOrder total: {{orderTotal}}\nOrder date: {{orderDate}}\n\n" +
      "You will receive tracking once your order ships.\n\n— The {{storeName}} team",
  },
  {
    type: "ORDER_CANCELLED",
    name: "Order Cancelled",
    subject: "Order {{orderNumber}} cancelled — {{storeName}}",
    htmlContent:
      `<h1 style="${S.h1}">Your order has been cancelled.</h1>` +
      `<p style="${S.p}">Hi {{customerName}}, order <strong>{{orderNumber}}</strong> has been cancelled. If you have already paid, any funds received will be returned to you.</p>` +
      detailRows([
        ["Order number", "{{orderNumber}}"],
        ["Order date", "{{orderDate}}"],
        ["Items", "{{orderItems}}"],
        ["Order total", "{{orderTotal}}"],
        ["Reason", "{{cancellationReason}}"],
      ]) +
      `<p style="${S.muted}">If this was not expected, reply to this email and we will help sort it out.</p>` +
      signoff,
    textContent:
      "Your order has been cancelled.\n\n" +
      "Hi {{customerName}}, order {{orderNumber}} has been cancelled. If you have already paid, any funds received will be returned to you.\n\n" +
      "Order number: {{orderNumber}}\nOrder date: {{orderDate}}\nItems: {{orderItems}}\nOrder total: {{orderTotal}}\nReason: {{cancellationReason}}\n\n— The {{storeName}} team",
  },
  {
    type: "WELCOME_EMAIL",
    name: "Welcome",
    subject: "Welcome to {{storeName}}",
    htmlContent:
      `<h1 style="${S.h1}">Welcome, {{customerName}}.</h1>` +
      `<p style="${S.p}">Your {{storeName}} account is ready. Confirm your email to activate it and start browsing the catalog.</p>` +
      button("{{verificationLink}}", "Confirm your email") +
      `<p style="${S.p}">As a thank-you, use code <strong>{{discountCode}}</strong> for {{discountAmount}} off your first order.</p>` +
      `<p style="${S.muted}">If you did not create this account, you can ignore this email.</p>` +
      signoff,
    textContent:
      "Welcome, {{customerName}}.\n\n" +
      "Your {{storeName}} account is ready. Confirm your email to activate it: {{verificationLink}}\n\n" +
      "As a thank-you, use code {{discountCode}} for {{discountAmount}} off your first order.\n\n" +
      "If you did not create this account, you can ignore this email.\n\n— The {{storeName}} team",
  },
  {
    type: "PASSWORD_RESET",
    name: "Password Reset",
    subject: "Reset your {{storeName}} password",
    htmlContent:
      `<h1 style="${S.h1}">Reset your password.</h1>` +
      `<p style="${S.p}">Hi {{customerName}}, we received a request to reset the password for your {{storeName}} account. Click below to choose a new one.</p>` +
      button("{{resetLink}}", "Reset password") +
      `<p style="${S.muted}">This link expires shortly for your security. If you did not request a reset, you can safely ignore this email — your password will not change.</p>` +
      signoff,
    textContent:
      "Reset your password.\n\n" +
      "Hi {{customerName}}, we received a request to reset the password for your {{storeName}} account.\n\n" +
      "Reset it here: {{resetLink}}\n\n" +
      "This link expires shortly. If you did not request a reset, ignore this email — your password will not change.\n\n— The {{storeName}} team",
  },
  {
    type: "ACCOUNT_VERIFICATION",
    name: "Verify Email",
    subject: "Verify your {{storeName}} email",
    htmlContent:
      `<h1 style="${S.h1}">Confirm your email.</h1>` +
      `<p style="${S.p}">Hi {{customerName}}, please confirm this email address to activate your {{storeName}} account.</p>` +
      button("{{verificationLink}}", "Verify email") +
      `<p style="${S.muted}">If you did not create a {{storeName}} account, you can ignore this email.</p>` +
      signoff,
    textContent:
      "Confirm your email.\n\n" +
      "Hi {{customerName}}, please confirm this email address to activate your {{storeName}} account: {{verificationLink}}\n\n" +
      "If you did not create a {{storeName}} account, you can ignore this email.\n\n— The {{storeName}} team",
  },
];

module.exports = { TEMPLATES };
