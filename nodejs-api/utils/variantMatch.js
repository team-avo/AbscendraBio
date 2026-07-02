const prisma = require("../prisma/client");

/** Normalize a string for loose matching: lowercase, strip non-alphanumerics. */
function norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Resolve the ProductVariant that a label (peptide strength) maps to.
 *
 * Hybrid "auto-match then remember":
 *  1. If a variant is already linked to this peptideStrengthId, use it (deterministic).
 *  2. Otherwise fuzzy-match by peptide name + strength label against the variant/product
 *     name. On a single confident match, persist the link so future lookups are exact.
 *  3. If zero or multiple candidates match, return null (skip — do not guess).
 *
 * @param {string} peptideStrengthId
 * @returns {Promise<object|null>} the variant (with `product`) or null
 */
async function resolveVariantForStrength(peptideStrengthId) {
  if (!peptideStrengthId) return null;

  // 1) Explicit stored link
  const linked = await prisma.productVariant.findUnique({
    where: { peptideStrengthId },
    include: { product: true },
  });
  if (linked) return linked;

  // 2) Fuzzy match by peptide name + strength label
  const strength = await prisma.peptideStrength.findUnique({
    where: { id: peptideStrengthId },
    include: { peptide: true },
  });
  if (!strength || !strength.peptide) return null;

  const nName = norm(strength.peptide.name); // e.g. "cjc1295nodac"
  const nStrength = norm(strength.label);     // e.g. "10 mg" -> "10mg"
  if (!nName || !nStrength) return null;

  const candidates = await prisma.productVariant.findMany({
    where: { isActive: true, peptideStrengthId: null },
    include: { product: true },
  });

  const matches = candidates.filter((v) => {
    const hay = norm(v.name) + norm(v.product && v.product.name);
    return hay.includes(nName) && hay.includes(nStrength);
  });

  if (matches.length !== 1) return null; // none or ambiguous -> skip

  const match = matches[0];
  // Remember the link so it becomes deterministic next time.
  try {
    await prisma.productVariant.update({
      where: { id: match.id },
      data: { peptideStrengthId },
    });
  } catch (_) {
    // unique race / already linked elsewhere — ignore, still return the match
  }
  return match;
}

module.exports = { resolveVariantForStrength, norm };
