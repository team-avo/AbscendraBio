/**
 * gmail.service.js
 *
 * Factory-based Gmail service. Supports multiple inboxes by accepting an env-var
 * prefix. The default export (backward-compatible) uses the GMAIL_* prefix and is
 * used by the supplier email poller. A separate billing-gmail.service.js creates
 * an instance for BILLING_GMAIL_* (billing@ascendrabio.com / Zelle detection).
 *
 * Factory usage:
 *   const { createGmailService } = require('./gmail.service');
 *   const billingGmail = createGmailService('BILLING_GMAIL');
 *
 * Legacy usage (unchanged):
 *   const gmail = require('./gmail.service');
 *   gmail.isConfigured(); // uses GMAIL_* env vars
 */

const { google } = require("googleapis");
const logger = require("../utils/logger");

/**
 * Creates a fully self-contained Gmail service instance bound to a specific
 * set of env-var credentials.
 *
 * @param {string} prefix  Env-var prefix, e.g. "GMAIL" or "BILLING_GMAIL"
 */
function createGmailService(prefix) {
  const KEY_CLIENT_ID = `${prefix}_CLIENT_ID`;
  const KEY_CLIENT_SECRET = `${prefix}_CLIENT_SECRET`;
  const KEY_REFRESH_TOKEN = `${prefix}_REFRESH_TOKEN`;
  const KEY_PROCESSED_LABEL = `${prefix}_PROCESSED_LABEL`;

  let cachedClient = null;
  let cachedLabelId = null;

  function isConfigured() {
    return Boolean(
      process.env[KEY_CLIENT_ID] &&
        process.env[KEY_CLIENT_SECRET] &&
        process.env[KEY_REFRESH_TOKEN],
    );
  }

  function buildOAuth2Client() {
    const oauth2 = new google.auth.OAuth2(
      process.env[KEY_CLIENT_ID],
      process.env[KEY_CLIENT_SECRET],
      "urn:ietf:wg:oauth:2.0:oob",
    );
    oauth2.setCredentials({ refresh_token: process.env[KEY_REFRESH_TOKEN] });
    return oauth2;
  }

  function getClient() {
    if (cachedClient) return cachedClient;
    if (!isConfigured()) {
      throw new Error(
        `Gmail (${prefix}) is not configured. Set ${KEY_CLIENT_ID}, ${KEY_CLIENT_SECRET}, and ${KEY_REFRESH_TOKEN} in env.`,
      );
    }
    const auth = buildOAuth2Client();
    cachedClient = google.gmail({ version: "v1", auth });
    return cachedClient;
  }

  async function getOrCreateProcessedLabel() {
    if (cachedLabelId) return cachedLabelId;
    // For the default GMAIL_ prefix keep the original label name so already-labelled
    // messages are not re-processed after this refactor.
    const defaultLabel =
      prefix === "GMAIL" ? "ascendra-processed" : `ascendra-zelle-processed`;
    const labelName = process.env[KEY_PROCESSED_LABEL] || defaultLabel;
    const gmail = getClient();

    const { data } = await gmail.users.labels.list({ userId: "me" });
    const existing = (data.labels || []).find(
      (l) => l.name.toLowerCase() === labelName.toLowerCase(),
    );
    if (existing) {
      cachedLabelId = existing.id;
      return cachedLabelId;
    }

    const { data: created } = await gmail.users.labels.create({
      userId: "me",
      requestBody: {
        name: labelName,
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
      },
    });
    cachedLabelId = created.id;
    return cachedLabelId;
  }

  async function listUnreadFromSender(senderEmail) {
    const defaultLabel =
      prefix === "GMAIL" ? "ascendra-processed" : `ascendra-zelle-processed`;
    const labelName = process.env[KEY_PROCESSED_LABEL] || defaultLabel;
    const gmail = getClient();
    const q = `from:${senderEmail} -label:${labelName}`;

    const messages = [];
    let pageToken;
    do {
      const { data } = await gmail.users.messages.list({
        userId: "me",
        q,
        maxResults: 50,
        pageToken,
      });
      if (Array.isArray(data.messages)) {
        messages.push(...data.messages);
      }
      pageToken = data.nextPageToken;
    } while (pageToken && messages.length < 200);

    return messages.map((m) => ({ id: m.id, threadId: m.threadId }));
  }

  /**
   * List messages matching an arbitrary Gmail search query (no automatic label filter).
   * Used by the Zelle poller which builds its own query.
   */
  async function listByQuery(q) {
    const gmail = getClient();
    const messages = [];
    let pageToken;
    do {
      const { data } = await gmail.users.messages.list({
        userId: "me",
        q,
        maxResults: 50,
        pageToken,
      });
      if (Array.isArray(data.messages)) {
        messages.push(...data.messages);
      }
      pageToken = data.nextPageToken;
    } while (pageToken && messages.length < 200);
    return messages.map((m) => ({ id: m.id, threadId: m.threadId }));
  }

  function decodeBase64Url(data) {
    if (!data) return "";
    const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(normalized, "base64").toString("utf8");
  }

  function extractHtml(payload) {
    if (!payload) return "";
    if (payload.mimeType === "text/html" && payload.body && payload.body.data) {
      return decodeBase64Url(payload.body.data);
    }
    if (Array.isArray(payload.parts)) {
      for (const part of payload.parts) {
        const html = extractHtml(part);
        if (html) return html;
      }
    }
    return "";
  }

  function extractPlainText(payload) {
    if (!payload) return "";
    if (payload.mimeType === "text/plain" && payload.body && payload.body.data) {
      return decodeBase64Url(payload.body.data);
    }
    if (Array.isArray(payload.parts)) {
      for (const part of payload.parts) {
        const text = extractPlainText(part);
        if (text) return text;
      }
    }
    return "";
  }

  function headerValue(headers, name) {
    const target = name.toLowerCase();
    const match = (headers || []).find((h) => h.name.toLowerCase() === target);
    return match ? match.value : null;
  }

  async function getMessage(id) {
    const gmail = getClient();
    const { data } = await gmail.users.messages.get({
      userId: "me",
      id,
      format: "full",
    });
    const headers = data.payload && data.payload.headers;
    const html = extractHtml(data.payload) || extractPlainText(data.payload);
    return {
      id: data.id,
      threadId: data.threadId,
      subject: headerValue(headers, "Subject") || "",
      from: headerValue(headers, "From") || "",
      receivedAt: data.internalDate
        ? new Date(Number(data.internalDate))
        : new Date(),
      html,
    };
  }

  async function markProcessed(messageId, labelId) {
    const gmail = getClient();
    await gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      requestBody: {
        addLabelIds: [labelId],
        removeLabelIds: ["UNREAD"],
      },
    });
  }

  return {
    isConfigured,
    getClient,
    getOrCreateProcessedLabel,
    listUnreadFromSender,
    listByQuery,
    getMessage,
    markProcessed,
  };
}

// ─── Default instance (GMAIL_* prefix — backward-compatible) ─────────────────
const _default = createGmailService("GMAIL");

module.exports = {
  // Factory — use this to create instances for additional inboxes
  createGmailService,

  // Legacy flat exports (identical interface to before this refactor)
  isConfigured: _default.isConfigured,
  getGmailClient: _default.getClient,          // alias kept for supplier poller
  getOrCreateProcessedLabel: _default.getOrCreateProcessedLabel,
  listUnreadFromSender: _default.listUnreadFromSender,
  listByQuery: _default.listByQuery,
  getMessage: _default.getMessage,
  markProcessed: _default.markProcessed,
};
