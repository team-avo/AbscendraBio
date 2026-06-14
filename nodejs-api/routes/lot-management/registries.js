/**
 * Registry CRUD for the Lot Management module:
 * companies, peptides (+strengths), suppliers, labs, testing services, patterns.
 */
const express = require("express");
const prisma = require("../../prisma/client");
const { requirePermission } = require("../../middleware/auth");
const { clearPatternCache } = require("../../services/lotIdGenerator");

const router = express.Router();
const READ = requirePermission("LOTS", "READ");
const WRITE = requirePermission("LOTS", "UPDATE");

// Generic registry CRUD (soft-delete via isActive)
function registry(path, model, orderBy = { name: "asc" }) {
  router.get(`/${path}`, READ, async (req, res) => {
    const where = req.query.activeOnly === "true" ? { isActive: true } : {};
    const rows = await prisma[model].findMany({ where, orderBy });
    res.json({ success: true, data: rows });
  });
  router.post(`/${path}`, WRITE, async (req, res) => {
    try {
      const row = await prisma[model].create({ data: req.body });
      res.json({ success: true, data: row });
    } catch (e) {
      res.status(e.code === "P2002" ? 409 : 400).json({ success: false, error: e.code === "P2002" ? "Code already exists" : e.message });
    }
  });
  router.patch(`/${path}/:id`, WRITE, async (req, res) => {
    try {
      const row = await prisma[model].update({ where: { id: req.params.id }, data: req.body });
      res.json({ success: true, data: row });
    } catch (e) {
      res.status(400).json({ success: false, error: e.message });
    }
  });
  router.delete(`/${path}/:id`, WRITE, async (req, res) => {
    try {
      await prisma[model].update({ where: { id: req.params.id }, data: { isActive: false } });
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ success: false, error: e.message });
    }
  });
}

registry("companies", "company", { code: "asc" });
registry("suppliers", "supplier");
registry("labs", "lab");
registry("services", "testingService", { category: "asc" });

// Peptides (with strengths)
router.get("/peptides", READ, async (req, res) => {
  const where = req.query.activeOnly === "true" ? { isActive: true } : {};
  const rows = await prisma.peptide.findMany({
    where,
    orderBy: { name: "asc" },
    include: { strengths: { orderBy: { displayOrder: "asc" } } },
  });
  res.json({ success: true, data: rows });
});
router.get("/peptides/:id", READ, async (req, res) => {
  const row = await prisma.peptide.findUnique({ where: { id: req.params.id }, include: { strengths: { orderBy: { displayOrder: "asc" } } } });
  if (!row) return res.status(404).json({ success: false, error: "Peptide not found" });
  res.json({ success: true, data: row });
});
router.post("/peptides", WRITE, async (req, res) => {
  try {
    const { strengths = [], ...fields } = req.body;
    const row = await prisma.peptide.create({
      data: { ...fields, strengths: { create: strengths.map((s, i) => ({ label: s.label, code: s.code, displayOrder: i })) } },
      include: { strengths: true },
    });
    res.json({ success: true, data: row });
  } catch (e) {
    res.status(e.code === "P2002" ? 409 : 400).json({ success: false, error: e.code === "P2002" ? "Peptide code already exists" : e.message });
  }
});
router.patch("/peptides/:id", WRITE, async (req, res) => {
  try {
    const { strengths, ...fields } = req.body;
    await prisma.peptide.update({ where: { id: req.params.id }, data: fields });
    if (Array.isArray(strengths)) {
      await prisma.peptideStrength.deleteMany({ where: { peptideId: req.params.id, code: { notIn: strengths.map((s) => s.code) } } });
      let i = 0;
      for (const s of strengths) {
        await prisma.peptideStrength.upsert({
          where: { peptideId_code: { peptideId: req.params.id, code: s.code } },
          update: { label: s.label, displayOrder: i },
          create: { peptideId: req.params.id, label: s.label, code: s.code, displayOrder: i },
        });
        i += 1;
      }
    }
    const full = await prisma.peptide.findUnique({ where: { id: req.params.id }, include: { strengths: { orderBy: { displayOrder: "asc" } } } });
    res.json({ success: true, data: full });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});
router.delete("/peptides/:id", WRITE, async (req, res) => {
  try {
    await prisma.peptide.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// Pattern configs (configurable auto-generation formats)
router.get("/patterns", READ, async (req, res) => {
  res.json({ success: true, data: await prisma.patternConfig.findMany({ orderBy: { key: "asc" } }) });
});
router.patch("/patterns/:id", WRITE, async (req, res) => {
  try {
    const row = await prisma.patternConfig.update({ where: { id: req.params.id }, data: { pattern: req.body.pattern, notes: req.body.notes } });
    clearPatternCache();
    res.json({ success: true, data: row });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

module.exports = router;
