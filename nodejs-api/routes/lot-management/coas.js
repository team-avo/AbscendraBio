/**
 * COA logging. Created from a Lot (auto-fills order/peptide/strength/mfg).
 * Filename and COA number auto-generate. Results logged on return, then approved
 * which triggers QR generation. Supports sharing a COA with the other brand.
 */
const express = require("express");
const prisma = require("../../prisma/client");
const { requirePermission } = require("../../middleware/auth");
const { uploadSingleThirdPartyReportFile } = require("../../utils/s3Service");
const gen = require("../../services/lotIdGenerator");
const { generateCoaQr } = require("../../services/coaQrService");

const router = express.Router();
const READ = requirePermission("COA", "READ");
const CREATE = requirePermission("COA", "CREATE");
const UPDATE = requirePermission("COA", "UPDATE");
const APPROVE = requirePermission("COA", "APPROVE");

const coaInclude = {
  ownerCompany: true,
  lot: { include: { peptide: true, strength: true, company: true } },
  lab: true,
  tests: true,
  shares: { include: { company: true } },
};

router.get("/coas", READ, async (req, res) => {
  const { status, labId, companyId, page = 1, limit = 50 } = req.query;
  const where = {};
  if (status) where.status = status;
  if (labId) where.labId = labId;
  if (companyId) where.OR = [{ ownerCompanyId: companyId }, { shares: { some: { companyId } } }];
  const take = parseInt(limit);
  const skip = (parseInt(page) - 1) * take;
  const [rows, total] = await Promise.all([
    prisma.coa.findMany({ where, include: coaInclude, orderBy: { coaNumber: "desc" }, skip, take }),
    prisma.coa.count({ where }),
  ]);
  res.json({ success: true, data: { data: rows, pagination: { total, page: parseInt(page), limit: take, totalPages: Math.ceil(total / take) } } });
});

router.get("/coas/:id", READ, async (req, res) => {
  const row = await prisma.coa.findUnique({ where: { id: req.params.id }, include: coaInclude });
  if (!row) return res.status(404).json({ success: false, error: "COA not found" });
  res.json({ success: true, data: row });
});

// Create from a lot
router.post("/coas", CREATE, async (req, res) => {
  try {
    const { lotId, labId, dateSubmitted, testIds = [], ownerCompanyId, filename } = req.body;
    const result = await prisma.$transaction(async (tx) => {
      const lot = await tx.lot.findUnique({ where: { id: lotId }, include: { peptide: true, strength: true } });
      const lab = await tx.lab.findUnique({ where: { id: labId } });
      if (!lot || !lab) throw new Error("Invalid lot or lab");
      const owner = ownerCompanyId || lot.companyId;
      const ownerCompany = await tx.company.findUnique({ where: { id: owner } });
      const patterns = await gen.getPatterns();
      const coaNumber = await gen.nextCoaNumber(tx);
      const fname =
        filename ||
        gen.buildCoaFilename(patterns.COA_FILENAME, {
          brandCode: ownerCompany.code,
          peptideCode: lot.peptide.code,
          strengthCode: lot.strength.code,
          lotNumber: lot.lotNumber,
          labCode: lab.code,
          dateSubmitted,
        });
      return tx.coa.create({
        data: {
          coaNumber,
          filename: fname,
          ownerCompanyId: owner,
          lotId,
          labId,
          dateSubmitted: new Date(dateSubmitted),
          tests: { connect: testIds.map((id) => ({ id })) },
        },
        include: coaInclude,
      });
    });
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// Log results
router.patch("/coas/:id/results", UPDATE, async (req, res) => {
  try {
    const b = req.body;
    const data = {};
    if (b.testDate !== undefined) data.testDate = b.testDate ? new Date(b.testDate) : null;
    if (b.dateReceived !== undefined) data.dateReceived = b.dateReceived ? new Date(b.dateReceived) : null;
    if (b.hplcPurity !== undefined) data.hplcPurity = b.hplcPurity === null || b.hplcPurity === "" ? null : parseFloat(b.hplcPurity);
    if (b.msConfirmed !== undefined) data.msConfirmed = b.msConfirmed;
    if (b.overallResult !== undefined) data.overallResult = b.overallResult;
    if (b.reviewedBy !== undefined) data.reviewedBy = b.reviewedBy;
    if (b.reviewDate !== undefined) data.reviewDate = b.reviewDate ? new Date(b.reviewDate) : null;
    if (b.status !== undefined) data.status = b.status;
    if (b.notes !== undefined) data.notes = b.notes;
    if (Array.isArray(b.testIds)) data.tests = { set: b.testIds.map((id) => ({ id })) };
    const row = await prisma.coa.update({ where: { id: req.params.id }, data, include: coaInclude });
    res.json({ success: true, data: row });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// Upload the COA file (PDF)
router.post("/coas/:id/file", UPDATE, uploadSingleThirdPartyReportFile, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "No file provided (field name: file)" });
    const row = await prisma.coa.update({ where: { id: req.params.id }, data: { fileUrl: req.file.location, fileKey: req.file.key } });
    res.json({ success: true, data: { fileUrl: row.fileUrl, fileKey: row.fileKey } });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// Approve -> generate QR
router.post("/coas/:id/approve", APPROVE, async (req, res) => {
  try {
    const coa = await prisma.coa.findUnique({ where: { id: req.params.id } });
    if (!coa) return res.status(404).json({ success: false, error: "COA not found" });
    let qrUrl = coa.qrCodeUrl;
    try {
      qrUrl = await generateCoaQr(coa);
    } catch (qe) {
      console.warn("[COA] QR generation failed:", qe.message);
    }
    const row = await prisma.coa.update({
      where: { id: req.params.id },
      data: { status: "APPROVED", reviewDate: coa.reviewDate || new Date(), qrCodeUrl: qrUrl || undefined },
      include: coaInclude,
    });
    res.json({ success: true, data: row });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// Share / unshare a COA with another brand (single source of truth, a link not a copy)
router.post("/coas/:id/share", APPROVE, async (req, res) => {
  try {
    const { companyId } = req.body;
    await prisma.coaShare.upsert({
      where: { coaId_companyId: { coaId: req.params.id, companyId } },
      update: {},
      create: { coaId: req.params.id, companyId },
    });
    const row = await prisma.coa.findUnique({ where: { id: req.params.id }, include: coaInclude });
    res.json({ success: true, data: row });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});
router.delete("/coas/:id/share/:companyId", APPROVE, async (req, res) => {
  try {
    await prisma.coaShare.deleteMany({ where: { coaId: req.params.id, companyId: req.params.companyId } });
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

module.exports = router;
