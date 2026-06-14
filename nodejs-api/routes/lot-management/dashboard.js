/**
 * Lot Management dashboard KPIs (mirrors the workbook's Dashboard tab).
 * Optionally scoped to a company via ?companyId.
 */
const express = require("express");
const prisma = require("../../prisma/client");
const { requirePermission } = require("../../middleware/auth");

const router = express.Router();

router.get("/dashboard", requirePermission("LOTS", "READ"), async (req, res) => {
  const { companyId } = req.query;
  const lotWhere = companyId ? { companyId } : {};
  const coaWhere = companyId ? { OR: [{ ownerCompanyId: companyId }, { shares: { some: { companyId } } }] } : {};
  const now = new Date();
  const in90 = new Date(Date.now() + 90 * 86400000);

  const [
    coaTotal, coaApproved, coaPending, coaAwaiting, coaRejected, coaPassed, hplcAgg,
    lotTotal, lotInTesting, lotReleased, lotQuarantine, lotBad, lotExpiring, lotExpired, uniqueOrders,
    labs,
  ] = await Promise.all([
    prisma.coa.count({ where: coaWhere }),
    prisma.coa.count({ where: { ...coaWhere, status: "APPROVED" } }),
    prisma.coa.count({ where: { ...coaWhere, status: "PENDING_REVIEW" } }),
    prisma.coa.count({ where: { ...coaWhere, status: "AWAITING_RESULTS" } }),
    prisma.coa.count({ where: { ...coaWhere, status: "REJECTED" } }),
    prisma.coa.count({ where: { ...coaWhere, overallResult: "PASS" } }),
    prisma.coa.aggregate({ where: { ...coaWhere, hplcPurity: { not: null } }, _avg: { hplcPurity: true } }),
    prisma.lot.count({ where: lotWhere }),
    prisma.lot.count({ where: { ...lotWhere, status: "IN_TESTING" } }),
    prisma.lot.count({ where: { ...lotWhere, status: "RELEASED" } }),
    prisma.lot.count({ where: { ...lotWhere, status: "QUARANTINE" } }),
    prisma.lot.count({ where: { ...lotWhere, status: { in: ["REJECTED", "EXPIRED", "RECALLED"] } } }),
    prisma.lot.count({ where: { ...lotWhere, expirationDate: { gte: now, lte: in90 } } }),
    prisma.lot.count({ where: { ...lotWhere, expirationDate: { lt: now } } }),
    prisma.lot.findMany({ where: lotWhere, select: { procurementOrderId: true }, distinct: ["procurementOrderId"] }),
    prisma.lab.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  const byLab = await Promise.all(
    labs.map(async (l) => {
      const [total, pass, fail] = await Promise.all([
        prisma.coa.count({ where: { ...coaWhere, labId: l.id } }),
        prisma.coa.count({ where: { ...coaWhere, labId: l.id, overallResult: "PASS" } }),
        prisma.coa.count({ where: { ...coaWhere, labId: l.id, overallResult: "FAIL" } }),
      ]);
      return { lab: l.name, total, pass, fail };
    }),
  );

  res.json({
    success: true,
    data: {
      coa: {
        total: coaTotal,
        approved: coaApproved,
        pendingReview: coaPending,
        awaitingResults: coaAwaiting,
        rejected: coaRejected,
        passRate: coaTotal ? Math.round((coaPassed / coaTotal) * 100) : 0,
        avgHplcPurity: hplcAgg._avg.hplcPurity ? Math.round(hplcAgg._avg.hplcPurity * 100) / 100 : 0,
      },
      lots: {
        total: lotTotal,
        inTesting: lotInTesting,
        released: lotReleased,
        quarantine: lotQuarantine,
        rejectedExpiredRecalled: lotBad,
        expiringWithin90: lotExpiring,
        expired: lotExpired,
        uniqueOrders: uniqueOrders.length,
      },
      byLab,
    },
  });
});

module.exports = router;
