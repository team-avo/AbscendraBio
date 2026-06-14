/**
 * Label template management (brand-scoped artwork + placeholder zones) and the
 * print-ready label renderer for an approved COA's lot.
 */
const express = require("express");
const prisma = require("../../prisma/client");
const { requirePermission } = require("../../middleware/auth");
const { uploadSingleImage } = require("../../utils/s3Service");
const { renderLabel } = require("../../services/labelService");

const router = express.Router();
const READ = requirePermission("LOTS", "READ");
const WRITE = requirePermission("LOTS", "UPDATE");
const PRINT = requirePermission("COA", "PRINT");

router.get("/label-templates", READ, async (req, res) => {
  const { companyId, peptideId } = req.query;
  const where = { isActive: true };
  if (companyId) where.companyId = companyId;
  if (peptideId) where.peptideId = peptideId;
  res.json({ success: true, data: await prisma.labelTemplate.findMany({ where, include: { company: true }, orderBy: { createdAt: "desc" } }) });
});

// Upload base label artwork (image), returns the URL to store on the template
router.post("/label-templates/artwork", WRITE, uploadSingleImage, async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: "No image provided (field name: image)" });
  res.json({ success: true, data: { artworkUrl: req.file.location, artworkKey: req.file.key } });
});

router.post("/label-templates", WRITE, async (req, res) => {
  try {
    const row = await prisma.labelTemplate.create({ data: req.body });
    res.json({ success: true, data: row });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});
router.patch("/label-templates/:id", WRITE, async (req, res) => {
  try {
    const row = await prisma.labelTemplate.update({ where: { id: req.params.id }, data: req.body });
    res.json({ success: true, data: row });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});
router.delete("/label-templates/:id", WRITE, async (req, res) => {
  try {
    await prisma.labelTemplate.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// Render the print-ready label PDF for a COA's lot
router.get("/coas/:id/label", PRINT, async (req, res) => {
  try {
    const coa = await prisma.coa.findUnique({
      where: { id: req.params.id },
      include: { lot: { include: { peptide: true, strength: true, company: true } }, ownerCompany: true },
    });
    if (!coa) return res.status(404).json({ success: false, error: "COA not found" });

    // Pick template: explicit id, else brand+peptide, else brand default
    let template = null;
    if (req.query.templateId) template = await prisma.labelTemplate.findUnique({ where: { id: req.query.templateId } });
    if (!template) template = await prisma.labelTemplate.findFirst({ where: { companyId: coa.ownerCompanyId, peptideId: coa.lot.peptideId, isActive: true } });
    if (!template) template = await prisma.labelTemplate.findFirst({ where: { companyId: coa.ownerCompanyId, isActive: true } });
    if (!template) return res.status(400).json({ success: false, error: "No label template for this brand. Create one first." });

    const pdf = await renderLabel({ coa, lot: coa.lot, template });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${coa.filename}.pdf"`);
    res.send(pdf);
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

module.exports = router;
