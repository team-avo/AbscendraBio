const express = require("express");
const { query } = require("express-validator");
const prisma = require("../prisma/client");
const validateRequest = require("../middleware/validateRequest");
const { asyncHandler } = require("../middleware/errorHandler");
const { requirePermission } = require("../middleware/auth");

const router = express.Router();

// GET /api/login-audit-logs — paginated list with filters
router.get(
  "/",
  requirePermission("SETTINGS", "READ"),
  [
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
    query("status").optional().isIn(["SUCCESS", "FAILED"]),
    query("email").optional().isString(),
    query("portal").optional().isIn(["admin", "customer"]),
    query("source").optional().isIn(["server", "client"]),
    query("from").optional().isISO8601(),
    query("to").optional().isISO8601(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const skip = (page - 1) * limit;

    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.email)
      where.email = { contains: req.query.email, mode: "insensitive" };
    if (req.query.portal) where.portal = req.query.portal;
    if (req.query.source) where.source = req.query.source;
    if (req.query.from || req.query.to) {
      where.createdAt = {};
      if (req.query.from) where.createdAt.gte = new Date(req.query.from);
      if (req.query.to) where.createdAt.lte = new Date(req.query.to);
    }

    const [data, total] = await Promise.all([
      prisma.loginAttempt.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      }),
      prisma.loginAttempt.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        items: data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  }),
);

// GET /api/login-audit-logs/summary — aggregated stats
router.get(
  "/summary",
  requirePermission("SETTINGS", "READ"),
  [
    query("from").optional().isISO8601(),
    query("to").optional().isISO8601(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const where = {};
    if (req.query.from || req.query.to) {
      where.createdAt = {};
      if (req.query.from) where.createdAt.gte = new Date(req.query.from);
      if (req.query.to) where.createdAt.lte = new Date(req.query.to);
    }

    const [
      totalAttempts,
      successCount,
      failedCount,
      clientErrors,
      uniqueEmails,
      failureGroups,
    ] = await Promise.all([
      prisma.loginAttempt.count({ where }),
      prisma.loginAttempt.count({ where: { ...where, status: "SUCCESS" } }),
      prisma.loginAttempt.count({ where: { ...where, status: "FAILED" } }),
      prisma.loginAttempt.count({ where: { ...where, source: "client" } }),
      prisma.loginAttempt.groupBy({
        by: ["email"],
        where,
        _count: true,
      }),
      prisma.loginAttempt.groupBy({
        by: ["failureReason"],
        where: { ...where, status: "FAILED" },
        _count: { _all: true },
        orderBy: { _count: { failureReason: "desc" } },
      }),
    ]);

    const topFailureReasons = failureGroups
      .filter((g) => g.failureReason)
      .map((g) => ({
        reason: g.failureReason,
        count: g._count._all,
      }));

    res.json({
      success: true,
      data: {
        totalAttempts,
        successCount,
        failedCount,
        successRate:
          totalAttempts > 0
            ? ((successCount / totalAttempts) * 100).toFixed(1)
            : "0.0",
        uniqueEmails: uniqueEmails.length,
        clientReportedErrors: clientErrors,
        topFailureReasons,
      },
    });
  }),
);

// GET /api/login-audit-logs/export — CSV export
router.get(
  "/export",
  requirePermission("SETTINGS", "READ"),
  [
    query("status").optional().isIn(["SUCCESS", "FAILED"]),
    query("email").optional().isString(),
    query("portal").optional().isIn(["admin", "customer"]),
    query("source").optional().isIn(["server", "client"]),
    query("from").optional().isISO8601(),
    query("to").optional().isISO8601(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.email)
      where.email = { contains: req.query.email, mode: "insensitive" };
    if (req.query.portal) where.portal = req.query.portal;
    if (req.query.source) where.source = req.query.source;
    if (req.query.from || req.query.to) {
      where.createdAt = {};
      if (req.query.from) where.createdAt.gte = new Date(req.query.from);
      if (req.query.to) where.createdAt.lte = new Date(req.query.to);
    }

    const data = await prisma.loginAttempt.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 10000, // safety cap
      include: {
        user: {
          select: { firstName: true, lastName: true, role: true },
        },
      },
    });

    // Build CSV
    const headers = [
      "Timestamp",
      "Email",
      "Status",
      "Failure Reason",
      "Failure Detail",
      "Portal",
      "Source",
      "IP Address",
      "User Agent",
      "User Name",
      "User Role",
    ];

    const escCsv = (val) => {
      if (val == null) return "";
      const s = String(val);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const rows = data.map((row) => [
      escCsv(row.createdAt?.toISOString()),
      escCsv(row.email),
      escCsv(row.status),
      escCsv(row.failureReason),
      escCsv(row.failureDetail),
      escCsv(row.portal),
      escCsv(row.source),
      escCsv(row.ipAddress),
      escCsv(row.userAgent),
      escCsv(row.user ? `${row.user.firstName} ${row.user.lastName}` : ""),
      escCsv(row.user?.role),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=login-audit-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    res.send(csv);
  }),
);

module.exports = router;
