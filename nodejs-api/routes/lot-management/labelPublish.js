const express = require("express");
const prisma = require("../../prisma/client");
const { requirePermission } = require("../../middleware/auth");
const { resolveVariantForStrength } = require("../../utils/variantMatch");

const router = express.Router();
const APPLY = requirePermission("PRODUCTS", "UPDATE");

/**
 * POST /api/lot-management/labels/apply-image
 * Body: { peptideStrengthId, imageUrl, altText? }
 *
 * Called by the Label Studio right after a label is generated: it takes the
 * uploaded vial-mockup image and makes it the primary image on the matching
 * product VARIANT and its PRODUCT (prepended at sortOrder 0; previous images
 * are kept after it as a fallback). Mapping is resolved + remembered via
 * resolveVariantForStrength. If nothing matches, it is a no-op (applied:false).
 */
router.post("/labels/apply-image", APPLY, async (req, res) => {
  try {
    const { peptideStrengthId, imageUrl, altText } = req.body || {};
    if (!peptideStrengthId || !imageUrl) {
      return res.status(400).json({ success: false, error: "peptideStrengthId and imageUrl are required" });
    }

    const variant = await resolveVariantForStrength(peptideStrengthId);
    if (!variant) {
      return res.json({
        success: true,
        data: { applied: false, reason: "No matching product for this peptide + strength" },
      });
    }

    const alt = altText || `${variant.name} vial`;

    const prepend = async (tx, model, key, id) => {
      const existing = await tx[model].findMany({ where: { [key]: id }, orderBy: { sortOrder: "asc" } });
      await tx[model].deleteMany({ where: { [key]: id } });
      await tx[model].create({ data: { [key]: id, url: imageUrl, altText: alt, sortOrder: 0 } });
      if (existing.length) {
        await tx[model].createMany({
          data: existing.map((im, i) => ({ [key]: id, url: im.url, altText: im.altText, sortOrder: i + 1 })),
        });
      }
    };

    await prisma.$transaction(async (tx) => {
      await prepend(tx, "variantImage", "variantId", variant.id);
      await prepend(tx, "productImage", "productId", variant.productId);
    });

    return res.json({
      success: true,
      data: { applied: true, variantId: variant.id, sku: variant.sku, productId: variant.productId },
    });
  } catch (e) {
    return res.status(400).json({ success: false, error: e.message });
  }
});

module.exports = router;
