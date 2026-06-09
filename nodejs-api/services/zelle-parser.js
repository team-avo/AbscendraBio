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
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
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
 * Parse a Zelle notification email.
 *
 * @param {{ subject: string, from: string, html: string }} email
 * @returns {{ senderName: string, amount: number, memo: string|null }}
 * @throws {ZelleParseError} if the email is not a recognised Zelle notification
 */
function parse(email) {
  const bank = (process.env.ZELLE_BANK || "generic").toLowerCase();
  const parserFn = PARSERS[bank] || parseGeneric;
  return parserFn(email);
}

/**
 * Quick sanity check: does this email look like a Zelle notification at all?
 * Used to skip unrelated emails that happen to be from the same sender domain.
 */
function looksLikeZelle({ subject, from }) {
  return /zelle/i.test(subject) || /zelle/i.test(from);
}

module.exports = { parse, looksLikeZelle, ZelleParseError };
