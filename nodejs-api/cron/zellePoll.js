/**
 * zellePoll.js
 *
 * Polls billing@ascendrabio.com for Zelle payment notification emails.
 * For each new email:
 *   1. Parse the email to extract amount, sender name, memo.
 *   2. Attempt to auto-match to an existing Order (selectedPaymentType=ZELLE, unpaid).
 *   3. Save a ZellePayment row.
 *   4. If HIGH confidence match → create Payment record + auto-confirm.
 *   5. Label the email as processed (ascendra-zelle-processed).
 *
 * Env vars:
 *   BILLING_GMAIL_CLIENT_ID, BILLING_GMAIL_CLIENT_SECRET, BILLING_GMAIL_REFRESH_TOKEN
 *   ZELLE_SENDER_EMAIL   — sender address to poll (e.g. no.reply.alerts@chase.com)
 *                          If not set, uses a broad "zelle" keyword search.
 *   ZELLE_BANK           — parser to use: chase | bofa | wells | generic (default)
 */

const prisma = require("../prisma/client");
const logger = require("../utils/logger");
const billingGmail = require("../services/billing-gmail.service");
const { parse: parseZelleEmail, looksLikeZelle, ZelleParseError } = require("../services/zelle-parser");

// ─── Order matching ───────────────────────────────────────────────────────────

/**
 * Normalise a name for fuzzy comparison: lowercase, trim, collapse spaces.
 */
function normaliseName(name) {
  return (name || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Count how many tokens (words) two normalised names share.
 */
function sharedTokenCount(a, b) {
  const tokensA = new Set(normaliseName(a).split(" ").filter(Boolean));
  const tokensB = normaliseName(b).split(" ").filter(Boolean);
  return tokensB.filter((t) => tokensA.has(t)).length;
}

/**
 * Attempt to find an Order to link to this Zelle payment.
 *
 * Returns { orderId, confidence } or null.
 *   confidence: "HIGH" — unique exact-amount + name overlap ≥ 2 words
 *               "LOW"  — amount matches but multiple orders, or name doesn't match
 */
async function matchOrder(parsedAmount, parsedSenderName) {
  // Find unpaid orders that were placed with Zelle
  const candidates = await prisma.order.findMany({
    where: {
      selectedPaymentType: "ZELLE",
      status: { in: ["PENDING", "PROCESSING", "ON_HOLD"] },
      // Exclude orders that already have a completed Zelle Payment
      payments: {
        none: {
          paymentMethod: "ZELLE",
          status: "COMPLETED",
        },
      },
    },
    select: {
      id: true,
      totalAmount: true,
      billingFirstName: true,
      billingLastName: true,
      customer: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  // Filter by exact amount match (Decimal comparison via string)
  const amountCandidates = candidates.filter((o) => {
    const orderAmt = parseFloat(o.totalAmount.toString());
    return Math.abs(orderAmt - parsedAmount) < 0.01;
  });

  if (amountCandidates.length === 0) return null;

  // Score by name overlap
  const scored = amountCandidates.map((o) => {
    const billingName = `${o.billingFirstName || ""} ${o.billingLastName || ""}`;
    const customerName = `${o.customer?.firstName || ""} ${o.customer?.lastName || ""}`;
    const score = Math.max(
      sharedTokenCount(parsedSenderName, billingName),
      sharedTokenCount(parsedSenderName, customerName),
    );
    return { orderId: o.id, score };
  });

  const best = scored.sort((a, b) => b.score - a.score)[0];

  if (amountCandidates.length === 1 && best.score >= 2) {
    return { orderId: best.orderId, confidence: "HIGH" };
  }

  // Single amount match but name doesn't match well — still link but flag LOW
  if (amountCandidates.length === 1 && best.score >= 1) {
    return { orderId: best.orderId, confidence: "LOW" };
  }

  // Multiple orders at same amount
  return { orderId: best.orderId, confidence: "LOW" };
}

// ─── Process one email ────────────────────────────────────────────────────────

async function processMessage(message, processedLabelId) {
  // Skip if already imported
  const existing = await prisma.zellePayment.findUnique({
    where: { gmailMessageId: message.id },
  });
  if (existing) {
    try {
      await billingGmail.markProcessed(message.id, processedLabelId);
    } catch (err) {
      logger.warn(`[ZellePoll] Failed to re-label already-processed message ${message.id}: ${err.message}`);
    }
    return { skipped: true };
  }

  const full = await billingGmail.getMessage(message.id);

  // Quick filter — if it doesn't look Zelle-related at all, skip silently
  if (!looksLikeZelle(full)) {
    logger.info(`[ZellePoll] Skipping non-Zelle email: "${full.subject}"`);
    return { skipped: true };
  }

  // Parse
  let parsed = null;
  let parseError = null;
  try {
    parsed = parseZelleEmail({ subject: full.subject, from: full.from, html: full.html });
  } catch (err) {
    parseError = err.message;
    if (!(err instanceof ZelleParseError)) {
      logger.error(`[ZellePoll] Unexpected parser error on ${message.id}: ${err.message}`);
    }
  }

  // If we couldn't parse, store a placeholder row so the admin can see it
  const parsedAmount = parsed ? parsed.amount : 0;
  const parsedSenderName = parsed ? parsed.senderName : "Parse failed";
  const parsedMemo = parsed ? (parsed.memo || null) : null;

  // Auto-match to order
  let matchResult = null;
  if (parsed && parsedAmount > 0) {
    try {
      matchResult = await matchOrder(parsedAmount, parsedSenderName);
    } catch (err) {
      logger.error(`[ZellePoll] Order matching error: ${err.message}`);
    }
  }

  const isHighConfidence = matchResult && matchResult.confidence === "HIGH";

  // Persist ZellePayment row and optionally create Payment in one transaction
  await prisma.$transaction(async (tx) => {
    const zellePayment = await tx.zellePayment.create({
      data: {
        gmailMessageId: full.id,
        gmailThreadId: full.threadId || null,
        rawSubject: full.subject,
        rawHtml: full.html,
        receivedAt: full.receivedAt,
        parsedAmount: parsedAmount,
        parsedSenderName,
        parsedMemo,
        status: matchResult
          ? isHighConfidence
            ? "CONFIRMED"
            : "MATCHED"
          : "UNMATCHED",
        matchConfidence: matchResult ? matchResult.confidence : null,
        orderId: matchResult ? matchResult.orderId : null,
        confirmedAt: isHighConfidence ? new Date() : null,
      },
    });

    // Auto-create Payment record for HIGH confidence matches
    if (isHighConfidence && matchResult.orderId) {
      await tx.payment.create({
        data: {
          orderId: matchResult.orderId,
          paymentMethod: "ZELLE",
          provider: "zelle",
          transactionId: full.id, // Gmail message ID as transaction reference
          amount: parsedAmount,
          currency: "USD",
          status: "COMPLETED",
          paidAt: full.receivedAt,
        },
      });

      // Note: OrderNote requires a userId so we skip automated note creation here.
      // Admins can add notes manually from the Zelle payments review page.
    }
  });

  // Label the email so we don't re-process it
  try {
    await billingGmail.markProcessed(message.id, processedLabelId);
  } catch (err) {
    logger.warn(`[ZellePoll] Failed to label message ${message.id}: ${err.message}`);
  }

  return {
    created: true,
    parseError,
    matched: !!matchResult,
    confidence: matchResult?.confidence || null,
    autoConfirmed: isHighConfidence,
  };
}

// ─── Main run function ────────────────────────────────────────────────────────

async function run() {
  if (!billingGmail.isConfigured()) {
    return { skipped: "billing-gmail-not-configured" };
  }

  // Build the Gmail query
  const senderEmail = process.env.ZELLE_SENDER_EMAIL;
  let processedLabelId;
  try {
    processedLabelId = await billingGmail.getOrCreateProcessedLabel();
  } catch (err) {
    logger.error(`[ZellePoll] Cannot obtain Gmail label: ${err.message}`);
    return { error: err.message };
  }

  let messages;
  try {
    if (senderEmail) {
      // Targeted: only emails from the known Zelle notification sender
      messages = await billingGmail.listUnreadFromSender(senderEmail);
    } else {
      // Broad: any email with "zelle" in subject that hasn't been processed yet
      const labelName =
        process.env.BILLING_GMAIL_PROCESSED_LABEL || "ascendra-zelle-processed";
      messages = await billingGmail.listByQuery(
        `subject:zelle -label:${labelName}`,
      );
    }
  } catch (err) {
    logger.error(`[ZellePoll] Error fetching emails: ${err.message}`);
    return { error: err.message };
  }

  const summary = {
    fetched: messages.length,
    created: 0,
    skipped: 0,
    matched: 0,
    autoConfirmed: 0,
    errors: 0,
  };

  for (const message of messages) {
    try {
      const result = await processMessage(message, processedLabelId);
      if (result.created) {
        summary.created += 1;
        if (result.matched) summary.matched += 1;
        if (result.autoConfirmed) summary.autoConfirmed += 1;
      } else if (result.skipped) {
        summary.skipped += 1;
      }
    } catch (err) {
      summary.errors += 1;
      logger.error(`[ZellePoll] Error processing message ${message.id}: ${err.message}`);
    }
  }

  return summary;
}

module.exports = { run };
