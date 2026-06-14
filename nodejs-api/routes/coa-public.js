/**
 * PUBLIC COA trace endpoint (the QR code target). No auth.
 * Returns a safe, brand-neutral view of an APPROVED COA only.
 * Mounted at /api/public/coa.
 */
const express = require("express");
const prisma = require("../prisma/client");

const router = express.Router();

router.get("/:coaNumber", async (req, res) => {
  const n = parseInt(req.params.coaNumber, 10);
  if (Number.isNaN(n)) return res.status(400).json({ success: false, error: "Invalid COA number" });
  const coa = await prisma.coa.findUnique({
    where: { coaNumber: n },
    include: { ownerCompany: true, lab: true, tests: true, lot: { include: { peptide: true, strength: true } } },
  });
  if (!coa || coa.status !== "APPROVED") return res.status(404).json({ success: false, error: "COA not found" });

  res.json({
    success: true,
    data: {
      coaNumber: coa.coaNumber,
      status: coa.status,
      peptide: coa.lot.peptide.name,
      strength: coa.lot.strength.label,
      lotNumber: coa.lot.lotNumber,
      mfgDate: coa.lot.mfgDate,
      expirationDate: coa.lot.expirationDate,
      lab: coa.lab.name,
      testsPerformed: coa.tests.map((t) => t.name),
      hplcPurity: coa.hplcPurity,
      msConfirmed: coa.msConfirmed,
      overallResult: coa.overallResult,
      dateReceived: coa.dateReceived,
      fileUrl: coa.fileUrl,
    },
  });
});

module.exports = router;
