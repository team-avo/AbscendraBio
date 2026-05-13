const prisma = require("../prisma/client");
const logger = require("../utils/logger");
const gmail = require("../services/gmail.service");
const parsers = require("../services/supplier-parsers");
const { ParseError } = require("../services/supplier-parsers/index-shared");

async function processMessage(source, message, processedLabelId) {
  const existing = await prisma.pendingStockReceipt.findUnique({
    where: { gmailMessageId: message.id },
  });
  if (existing) {
    // Already imported — just make sure Gmail is labeled so we don't re-fetch.
    try {
      await gmail.markProcessed(message.id, processedLabelId);
    } catch (err) {
      logger.warn(
        `[SupplierEmailPoll] Failed to re-label already-processed message ${message.id}: ${err.message}`,
      );
    }
    return { skipped: true };
  }

  const full = await gmail.getMessage(message.id);

  let parsed = { orderNumber: null, lines: [] };
  let parseError = null;
  try {
    parsed = parsers.parse(source.parserKey, full.html);
  } catch (err) {
    parseError = err.message;
    if (!(err instanceof ParseError)) {
      logger.error(
        `[SupplierEmailPoll] Unexpected parser error on message ${message.id}: ${err.message}`,
      );
    }
  }

  // Look up mappings in one go
  const mappingsForSource = await prisma.supplierProductMapping.findMany({
    where: { supplierSourceId: source.id },
  });
  const mappingsByName = new Map(
    mappingsForSource.map((m) => [m.supplierProductName.trim().toLowerCase(), m]),
  );

  const linePayload = parsed.lines.map((line) => {
    const mapping = mappingsByName.get(line.supplierProductName.trim().toLowerCase());
    if (mapping) {
      const effective = Math.round(line.parsedQuantity * (mapping.quantityMultiplier || 1));
      return {
        supplierProductName: line.supplierProductName,
        parsedQuantity: line.parsedQuantity,
        matchedVariantId: mapping.variantId,
        effectiveQuantity: effective,
        matchStatus: "AUTO_MATCHED",
      };
    }
    return {
      supplierProductName: line.supplierProductName,
      parsedQuantity: line.parsedQuantity,
      matchStatus: "UNMATCHED",
    };
  });

  await prisma.$transaction(async (tx) => {
    await tx.pendingStockReceipt.create({
      data: {
        supplierSourceId: source.id,
        gmailMessageId: full.id,
        gmailThreadId: full.threadId,
        orderNumber: parsed.orderNumber,
        rawSubject: full.subject,
        rawHtml: full.html,
        receivedAt: full.receivedAt,
        status: "PENDING",
        lines: { create: linePayload },
      },
    });
  });

  try {
    await gmail.markProcessed(message.id, processedLabelId);
  } catch (err) {
    logger.warn(
      `[SupplierEmailPoll] Failed to label processed message ${message.id}: ${err.message}`,
    );
  }

  return {
    created: true,
    parseError,
    lineCount: linePayload.length,
  };
}

async function run() {
  if (!gmail.isConfigured()) {
    return { skipped: "gmail-not-configured" };
  }

  const sources = await prisma.supplierEmailSource.findMany({
    where: { active: true },
  });

  if (sources.length === 0) {
    return { sources: 0 };
  }

  let processedLabelId;
  try {
    processedLabelId = await gmail.getOrCreateProcessedLabel();
  } catch (err) {
    logger.error(`[SupplierEmailPoll] Cannot obtain Gmail label: ${err.message}`);
    return { error: err.message };
  }

  const summary = {
    sources: sources.length,
    fetched: 0,
    created: 0,
    skipped: 0,
    errors: 0,
  };

  for (const source of sources) {
    try {
      const messages = await gmail.listUnreadFromSender(source.senderEmail);
      summary.fetched += messages.length;
      for (const message of messages) {
        try {
          const result = await processMessage(source, message, processedLabelId);
          if (result.created) summary.created += 1;
          else if (result.skipped) summary.skipped += 1;
        } catch (err) {
          summary.errors += 1;
          logger.error(
            `[SupplierEmailPoll] Error processing ${source.senderEmail} message ${message.id}: ${err.message}`,
          );
        }
      }
    } catch (err) {
      summary.errors += 1;
      logger.error(
        `[SupplierEmailPoll] Error fetching from ${source.senderEmail}: ${err.message}`,
      );
    }
  }

  return summary;
}

module.exports = { run };
