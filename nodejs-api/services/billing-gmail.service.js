/**
 * billing-gmail.service.js
 *
 * Gmail service instance for billing@ascendrabio.com.
 * Used exclusively by the Zelle payment poller.
 *
 * Required env vars:
 *   BILLING_GMAIL_CLIENT_ID
 *   BILLING_GMAIL_CLIENT_SECRET
 *   BILLING_GMAIL_REFRESH_TOKEN
 *
 * Optional:
 *   BILLING_GMAIL_PROCESSED_LABEL  (default: "ascendra-zelle-processed")
 */

const { createGmailService } = require("./gmail.service");

module.exports = createGmailService("BILLING_GMAIL");
