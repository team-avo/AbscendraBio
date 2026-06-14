/**
 * Auto-generation engine for Lot Management.
 *
 * Builds Lot Numbers, Order IDs, COA filenames, and expiry dates from
 * configurable patterns (PatternConfig table, with built-in defaults).
 * The build* functions are pure (take an explicit pattern) so they are
 * unit-testable; the DB-backed helpers load patterns and the sequence counter.
 */
const prisma = require("../prisma/client");

const DEFAULT_PATTERNS = {
  LOT_NUMBER: "[PEPTIDE]-[STRENGTH]-[YYMMDD]-[SEQ]",
  ORDER_ID: "ORD-[SUPPLIER]-[YYMMDD]",
  COA_FILENAME: "[BRAND]_[PEPTIDE]_[STRENGTH]_[LOT]_[LAB]_[YYYYMMDD]",
  EXPIRATION: "MFG+24M",
};
const DEFAULT_SHELF_LIFE_MONTHS = 24;

const pad2 = (n) => String(n).padStart(2, "0");

function fmtDate(d, fmt) {
  const dt = new Date(d);
  const yyyy = dt.getUTCFullYear();
  const yy = String(yyyy).slice(-2);
  const mm = pad2(dt.getUTCMonth() + 1);
  const dd = pad2(dt.getUTCDate());
  if (fmt === "YYMMDD") return `${yy}${mm}${dd}`;
  if (fmt === "YYYYMMDD") return `${yyyy}${mm}${dd}`;
  return "";
}

// Replace [TOKEN] placeholders; unknown tokens are left intact.
function applyPattern(pattern, tokens) {
  return pattern.replace(/\[([A-Z0-9]+)\]/g, (m, key) =>
    tokens[key] !== undefined ? String(tokens[key]) : m,
  );
}

function buildLotNumber(pattern, { peptideCode, strengthCode, mfgDate, seq }) {
  return applyPattern(pattern, {
    PEPTIDE: peptideCode,
    STRENGTH: strengthCode,
    YYMMDD: fmtDate(mfgDate, "YYMMDD"),
    SEQ: pad2(seq),
  });
}

function buildOrderId(pattern, { supplierCode, orderDate }) {
  return applyPattern(pattern, {
    SUPPLIER: supplierCode,
    YYMMDD: fmtDate(orderDate, "YYMMDD"),
  });
}

function buildCoaFilename(
  pattern,
  { brandCode, peptideCode, strengthCode, lotNumber, labCode, dateSubmitted },
) {
  return applyPattern(pattern, {
    BRAND: brandCode,
    PEPTIDE: peptideCode,
    STRENGTH: strengthCode,
    LOT: lotNumber,
    LAB: labCode,
    YYYYMMDD: fmtDate(dateSubmitted, "YYYYMMDD"),
  });
}

function calcExpiration(mfgDate, shelfLifeMonths) {
  const d = new Date(mfgDate);
  const m = shelfLifeMonths || DEFAULT_SHELF_LIFE_MONTHS;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + m, d.getUTCDate()));
}

function budText(shelfLifeMonths) {
  const m = shelfLifeMonths || DEFAULT_SHELF_LIFE_MONTHS;
  if (m % 12 === 0) {
    const y = m / 12;
    return `${y} Year${y > 1 ? "s" : ""}`;
  }
  return `${m} Months`;
}

let _patternCache = null;
async function getPatterns() {
  if (_patternCache) return _patternCache;
  const rows = await prisma.patternConfig.findMany();
  const map = { ...DEFAULT_PATTERNS };
  for (const r of rows) map[r.key] = r.pattern;
  _patternCache = map;
  return map;
}
function clearPatternCache() {
  _patternCache = null;
}

// 2-digit sequence, auto-increment per peptide + strength + mfg date.
async function nextSequence({ peptideId, peptideStrengthId, mfgDate }, tx = prisma) {
  const day = new Date(mfgDate);
  const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
  const end = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + 1));
  const agg = await tx.lot.aggregate({
    where: { peptideId, peptideStrengthId, mfgDate: { gte: start, lt: end } },
    _max: { seq: true },
  });
  return (agg._max.seq || 0) + 1;
}

// Next sequential COA number.
async function nextCoaNumber(tx = prisma) {
  const agg = await tx.coa.aggregate({ _max: { coaNumber: true } });
  return (agg._max.coaNumber || 0) + 1;
}

module.exports = {
  DEFAULT_PATTERNS,
  DEFAULT_SHELF_LIFE_MONTHS,
  fmtDate,
  applyPattern,
  buildLotNumber,
  buildOrderId,
  buildCoaFilename,
  calcExpiration,
  budText,
  getPatterns,
  clearPatternCache,
  nextSequence,
  nextCoaNumber,
};
