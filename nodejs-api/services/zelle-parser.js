/**
 * zelle-parser.js
 *
 * Extracts payment details from Zelle notification emails.
 *
 * Zelle notifications arrive from your bank — the exact format depends on
 * which bank Ascendra Bio uses. Set ZELLE_BANK in your env to select a parser:
 *
 *   ZELLE_BANK=chase       (no.reply.alerts@chase.com)
 *   ZELLE_BANK=bofa        (onlinebanking@ealerts.bankofamerica.com)
 *   ZELLE_BANK=wells       (wellsfargo@email.wellsfargo.com)
 *   ZELLE_BANK=generic     (fallback — tries broad regex patterns)
 *
 * If ZELLE_BANK is not set, the generic parser is used.
 *
 * Each parser receives { subject, from, html } and must return:
 *   { senderName: string, amount: number, memo: string|null }
 * or throw a ZelleParseError if the email is not a recognised Zelle notification.
 *
 * TODO (tonight): Once you know which bank billing@ascendrabio.com uses and
 * have a sample email, replace the TODO block in the matching parser below
 * with exact regex patterns derived from that email's HTML/text content.
 */

class ZelleParseError extends Error {
  constructor(message) {
    super(message);
    this.name = "ZelleParseError";
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Strip HTML tags and collapse whitespace for easier regex matching.
 */
function stripHtml(html) {
  return String(html || "")
    // Drop <style>/<script> blocks first — their CSS/JS text survives plain tag-stripping
    // and otherwise pollutes the body regexes (real bank emails carry large inline stylesheets).
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&#36;/g, "$")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse "$1,234.56" or "1234.56" into a float. Returns null if unparseable.
 */
function parseDollarAmount(str) {
  if (!str) return null;
  const cleaned = str.replace(/[$,\s]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// ─── Bank parsers ─────────────────────────────────────────────────────────────

/**
 * Chase: "no.reply.alerts@chase.com"
 * Subject pattern: "You received $X from [Name] with Zelle®"
 *
 * TODO: Replace the regex patterns below with ones verified against a real
 * Chase Zelle notification email from billing@ascendrabio.com.
 */
function parseChase({ subject, from, html }) {
  const text = stripHtml(html);

  // Real Chase "You received money with Zelle®" layout (verified against a live notification
  // 2026-08-19): subject carries no amount; the body reads
  //   "<NAME> sent you money ... Amount $X.XX ... Transaction number N ... Memo <memo> <NAME> is registered ..."
  // Names are ALL CAPS. Amount is a labelled field, memo is the free-text the sender typed.
  const sentYou = text.match(
    /([A-Z][A-Za-z'’.-]*(?:\s+[A-Z][A-Za-z'’.-]*)+)\s+sent\s+you\s+money/,
  );
  const amountLabel = text.match(/\bAmount\b\s*\$?\s*([\d,]+\.\d{2}|[\d,]+)/i);
  if (sentYou && amountLabel) {
    const amount = parseDollarAmount(amountLabel[1]);
    if (amount !== null) {
      const senderName = sentYou[1].replace(/\s+/g, " ").trim();
      // Memo sits between the "Memo" label and the sender-name-repeat + "is registered".
      const memoMatch =
        text.match(
          /\bMemo\b\s+(.+?)\s+(?:[A-Z][A-Za-z'’.-]*\s+){0,4}is\s+registered\b/i,
        ) || text.match(/\bMemo\b[:\s]+([^\n]{1,80}?)\s+(?:Transaction|Sent on)/i);
      return {
        senderName,
        amount,
        memo: memoMatch ? memoMatch[1].trim() : null,
      };
    }
  }

  // Subject match: "You received $150.00 from John Smith with Zelle"
  const subjectMatch = subject.match(
    /you\s+received\s+\$?([\d,]+\.?\d*)\s+from\s+(.+?)\s+with\s+zelle/i,
  );
  if (subjectMatch) {
    const amount = parseDollarAmount(subjectMatch[1]);
    const senderName = subjectMatch[2].trim();
    if (amount !== null) {
      // Memo — Chase sometimes includes it in the body
      const memoMatch = text.match(/memo[:\s]+([^\n.]+)/i);
      return {
        senderName,
        amount,
        memo: memoMatch ? memoMatch[1].trim() : null,
      };
    }
  }

  // Fallback: body text match
  const bodyAmountMatch = text.match(
    /received\s+\$?([\d,]+\.?\d*)\s+from\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/,
  );
  if (bodyAmountMatch) {
    const amount = parseDollarAmount(bodyAmountMatch[1]);
    if (amount !== null) {
      return { senderName: bodyAmountMatch[2].trim(), amount, memo: null };
    }
  }

  throw new ZelleParseError(`Chase parser: unrecognised email format. Subject: "${subject}"`);
}

/**
 * Bank of America: "onlinebanking@ealerts.bankofamerica.com"
 * Subject pattern: "[Name] sent you $X with Zelle®"
 *
 * TODO: Verify against a real BofA Zelle notification.
 */
function parseBofa({ subject, from, html }) {
  const text = stripHtml(html);

  const subjectMatch = subject.match(
    /^(.+?)\s+sent\s+you\s+\$?([\d,]+\.?\d*)\s+with\s+zelle/i,
  );
  if (subjectMatch) {
    const amount = parseDollarAmount(subjectMatch[2]);
    if (amount !== null) {
      const memoMatch = text.match(/(?:note|memo)[:\s]+([^\n.]+)/i);
      return {
        senderName: subjectMatch[1].trim(),
        amount,
        memo: memoMatch ? memoMatch[1].trim() : null,
      };
    }
  }

  throw new ZelleParseError(`BofA parser: unrecognised email format. Subject: "${subject}"`);
}

/**
 * Wells Fargo: "wellsfargo@email.wellsfargo.com"
 * Subject pattern: "You received a Zelle® payment"
 * (amount and sender are in the body)
 *
 * TODO: Verify against a real Wells Fargo Zelle notification.
 */
function parseWells({ subject, from, html }) {
  const text = stripHtml(html);

  // Body: "John Smith sent you $150.00"
  const bodyMatch = text.match(
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+sent\s+you\s+\$?([\d,]+\.?\d*)/,
  );
  if (bodyMatch) {
    const amount = parseDollarAmount(bodyMatch[2]);
    if (amount !== null) {
      const memoMatch = text.match(/(?:note|memo|message)[:\s]+([^\n.]+)/i);
      return {
        senderName: bodyMatch[1].trim(),
        amount,
        memo: memoMatch ? memoMatch[1].trim() : null,
      };
    }
  }

  throw new ZelleParseError(`Wells parser: unrecognised email format. Subject: "${subject}"`);
}

/**
 * Generic fallback parser — tries several common Zelle notification patterns.
 * Works across many banks with minimal tuning.
 *
 * TODO: After seeing a real email from billing@ascendrabio.com, you can either:
 *   a) Set ZELLE_BANK to the matching bank parser above, or
 *   b) Extend the patterns here if your bank isn't listed.
 */
function parseGeneric({ subject, from, html }) {
  const text = stripHtml(html);
  const combined = `${subject} ${text}`;

  // Pattern A: "received $X from Name"
  const patternA = combined.match(
    /received\s+\$?([\d,]+\.?\d*)\s+from\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+)+)/,
  );
  if (patternA) {
    const amount = parseDollarAmount(patternA[1]);
    if (amount !== null) {
      return { senderName: patternA[2].trim(), amount, memo: null };
    }
  }

  // Pattern B: "Name sent you $X"
  const patternB = combined.match(
    /([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+)+)\s+sent\s+you\s+\$?([\d,]+\.?\d*)/,
  );
  if (patternB) {
    const amount = parseDollarAmount(patternB[2]);
    if (amount !== null) {
      return { senderName: patternB[1].trim(), amount, memo: null };
    }
  }

  // Pattern D: labelled amount ("Amount $X") + "Name sent you money" — the modern layout used
  // by Chase (and similar) where the amount isn't inline with the name. Kept here too so a
  // forwarded alert still parses even if content-based bank detection didn't route it to a bank.
  const amountLabel = combined.match(/\bAmount\b\s*\$?\s*([\d,]+\.\d{2}|[\d,]+)/i);
  const sentMoney = combined.match(
    /([A-Z][A-Za-z'’.-]*(?:\s+[A-Z][A-Za-z'’.-]*)+)\s+sent\s+you\s+money/,
  );
  if (amountLabel && sentMoney) {
    const amount = parseDollarAmount(amountLabel[1]);
    if (amount !== null) {
      return { senderName: sentMoney[1].replace(/\s+/g, " ").trim(), amount, memo: null };
    }
  }

  // Pattern C: subject contains amount and Zelle keyword
  const subjectAmount = subject.match(/\$?([\d,]+\.?\d*)/);
  if (subjectAmount && /zelle/i.test(subject)) {
    const amount = parseDollarAmount(subjectAmount[1]);
    // Can't extract sender name reliably — use "Unknown" so the row is still created
    if (amount !== null) {
      return { senderName: "Unknown", amount, memo: null };
    }
  }

  throw new ZelleParseError(
    `Generic parser: no Zelle payment amount/sender found. Subject: "${subject}"`,
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

const PARSERS = {
  chase: parseChase,
  bofa: parseBofa,
  wells: parseWells,
  generic: parseGeneric,
};

/**
 * Strip forwarding prefixes ("Fwd:", "Fw:", "Forward:", stacked) from a subject so a FORWARDED
 * alert matches the same bank subject-patterns as a direct one.
 */
function stripForwardPrefix(subject) {
  return String(subject || "").replace(/^(?:\s*(?:fwd?|fw|forward)\s*:\s*)+/i, "").trim();
}

/**
 * Best-effort bank detection from the email CONTENT, not the envelope sender. When a Zelle alert
 * reaches us via a forward (e.g. Chase alert auto-forwarded from another mailbox), `from` is the
 * forwarding address, not the bank — but the original bank's domain survives in the quoted
 * headers/body. Returns null when nothing matches (→ generic parser).
 */
function detectBank({ subject, from, html }) {
  const hay = `${from || ""} ${subject || ""} ${html || ""}`.toLowerCase();
  if (/chase\.com|jpmorgan/.test(hay)) return "chase";
  if (/bankofamerica\.com|\bbofa\b/.test(hay)) return "bofa";
  if (/wellsfargo\.com|wells\s+fargo/.test(hay)) return "wells";
  return null;
}

/**
 * Parse a Zelle notification email.
 *
 * Bank selection: explicit ZELLE_BANK env → content auto-detect (so a FORWARDED alert, whose
 * envelope sender is the forwarder rather than the bank, still routes to the right parser) →
 * generic. If a bank-specific parser doesn't recognise the message (e.g. HTML reflowed by
 * forwarding), fall back to the lenient generic parser before giving up — a real payment must
 * never be dropped over formatting.
 *
 * @param {{ subject: string, from: string, html: string }} email
 * @returns {{ senderName: string, amount: number, memo: string|null }}
 * @throws {ZelleParseError} if the email is not a recognised Zelle notification
 */
function parse(email) {
  const normalized = { ...email, subject: stripForwardPrefix(email.subject) };
  const explicit = (process.env.ZELLE_BANK || "").toLowerCase();
  const bank = explicit || detectBank(normalized) || "generic";
  const parserFn = PARSERS[bank] || parseGeneric;
  try {
    return parserFn(normalized);
  } catch (err) {
    if (bank !== "generic" && err instanceof ZelleParseError) {
      return parseGeneric(normalized);
    }
    throw err;
  }
}

/**
 * Quick sanity check: does this email look like a Zelle notification at all?
 * Used to skip unrelated emails that happen to match the discovery query.
 */
function looksLikeZelle({ subject, from, html }) {
  return /zelle/i.test(subject || "") || /zelle/i.test(from || "") || /zelle/i.test(html || "");
}

module.exports = { parse, looksLikeZelle, ZelleParseError };
