const { google } = require("googleapis");
const logger = require("../utils/logger");

let cachedGmailClient = null;
let cachedLabelId = null;

function isConfigured() {
  return Boolean(
    process.env.GMAIL_CLIENT_ID &&
      process.env.GMAIL_CLIENT_SECRET &&
      process.env.GMAIL_REFRESH_TOKEN,
  );
}

function buildOAuth2Client() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    "urn:ietf:wg:oauth:2.0:oob",
  );
  oauth2.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return oauth2;
}

function getGmailClient() {
  if (cachedGmailClient) return cachedGmailClient;
  if (!isConfigured()) {
    throw new Error(
      "Gmail is not configured. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN in .env",
    );
  }
  const auth = buildOAuth2Client();
  cachedGmailClient = google.gmail({ version: "v1", auth });
  return cachedGmailClient;
}

async function getOrCreateProcessedLabel() {
  if (cachedLabelId) return cachedLabelId;
  const labelName = process.env.GMAIL_PROCESSED_LABEL || "ascendra-processed";
  const gmail = getGmailClient();

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
  const labelName = process.env.GMAIL_PROCESSED_LABEL || "ascendra-processed";
  const gmail = getGmailClient();
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
  const gmail = getGmailClient();
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
  const gmail = getGmailClient();
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: {
      addLabelIds: [labelId],
      removeLabelIds: ["UNREAD"],
    },
  });
}

module.exports = {
  isConfigured,
  getGmailClient,
  getOrCreateProcessedLabel,
  listUnreadFromSender,
  getMessage,
  markProcessed,
};
