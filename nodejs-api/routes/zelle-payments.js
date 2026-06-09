/**
 * routes/zelle-payments.js
 *
 * Admin endpoints for reviewing and confirming Zelle payment detections.
 *
 * All routes require authentication (authMiddleware applied in app.js).
 * Read operations need ORDERS/READ, write operations need ORDERS/UPDATE.
 *
 * GET  /api/zelle-payments              — paginated list with optional status filter
 * GET  /api/zelle-payments/:id          — single record with linked order info
 * POST /api/zelle-payments/:id/confirm  — confirm a MATCHED payment (creates Payment record)
 * POST /api/zelle-payments/:id/link     — manually link UNMATCHED payment to an order + confirm
 * POST /api/zelle-payments/:id/ignore   — mark as IGNORED
 */

const express = require("express");
const { param, query, body } = require("express-validator");
const prisma = require("../prisma/client");
const validateRequest = require("../middleware/validateRequest");
const { asyncHandler } = require("../middleware/errorHandler");
const { requirePermission } = require("../middleware/auth");

const router = express.Router();

// ─── List ─────────────────────────────────────────────────────────────────────

router.get(
  "/",
  requirePermission("ORDERS", "READ"),
  [
    query("status")
      .optional()
      .isIn(["UNMATCHED", "MATCHED", "CONFIRMED", "MANUALLY_MATCHED", "IGNORED"]),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "25", 10);

    const where = {};
    if (req.query.status) where.status = req.query.status;

    const [total, items, unmatchedCount] = await Promise.all([
      prisma.zellePayment.count({ where }),
      prisma.zellePayment.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              totalAmount: true,
              status: true,
              billingFirstName: true,
              billingLastName: true,
              customer: { select: { firstName: true, lastName: true, email: true } },
            },
          },
        },
        orderBy: { receivedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.zellePayment.count({ where: { status: { in: ["UNMATCHED", "MATCHED"] } } }),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      pendingReviewCount: unmatchedCount,
    });
  }),
);

// ─── Single ───────────────────────────────────────────────────────────────────

router.get(
  "/:id",
  requirePermission("ORDERS", "READ"),
  [param("id").isString(), validateRequest],
  asyncHandler(async (req, res) => {
    const record = await prisma.zellePayment.findUnique({
      where: { id: req.params.id },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            status: true,
            selectedPaymentType: true,
            billingFirstName: true,
            billingLastName: true,
            billingAddress1: true,
            billingCity: true,
            billingState: true,
            customer: { select: { id: true, firstName: true, lastName: true, email: true } },
            payments: {
              select: { id: true, paymentMethod: true, status: true, amount: true, paidAt: true },
            },
          },
        },
      },
    });

    if (!record) {
      return res.status(404).json({ success: false, error: "Zelle payment not found" });
    }

    res.json({ success: true, data: record });
  }),
);

// ─── Confirm (MATCHED → CONFIRMED) ───────────────────────────────────────────

router.post(
  "/:id/confirm",
  requirePermission("ORDERS", "UPDATE"),
  [param("id").isString(), validateRequest],
  asyncHandler(async (req, res) => {
    const record = await prisma.zellePayment.findUnique({
      where: { id: req.params.id },
    });

    if (!record) {
      return res.status(404).json({ success: false, error: "Zelle payment not found" });
    }
    if (!["MATCHED"].includes(record.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot confirm a payment with status ${record.status}. Only MATCHED payments can be confirmed.`,
      });
    }
    if (!record.orderId) {
      return res.status(400).json({
        success: false,
        error: "No order linked to this payment. Use /link to assign an order first.",
      });
    }

    // Check order isn't already paid via Zelle
    const existingPayment = await prisma.payment.findFirst({
      where: { orderId: record.orderId, paymentMethod: "ZELLE", status: "COMPLETED" },
    });
    if (existingPayment) {
      return res.status(400).json({
        success: false,
        error: "This order already has a completed Zelle payment.",
      });
    }

    await prisma.$transaction([
      prisma.payment.create({
        data: {
          orderId: record.orderId,
          paymentMethod: "ZELLE",
          provider: "zelle",
          transactionId: record.gmailMessageId,
          amount: record.parsedAmount,
          currency: "USD",
          status: "COMPLETED",
          paidAt: record.receivedAt,
        },
      }),
      prisma.zellePayment.update({
        where: { id: record.id },
        data: {
          status: "CONFIRMED",
          confirmedById: req.user?.id || null,
          confirmedAt: new Date(),
        },
      }),
    ]);

    const updated = await prisma.zellePayment.findUnique({
      where: { id: record.id },
      include: { order: { select: { orderNumber: true, status: true } } },
    });

    res.json({ success: true, data: updated });
  }),
);

// ─── Link + confirm (UNMATCHED → MANUALLY_MATCHED) ───────────────────────────

router.post(
  "/:id/link",
  requirePermission("ORDERS", "UPDATE"),
  [
    param("id").isString(),
    body("orderId").isString().withMessage("orderId is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { orderId } = req.body;

    const [record, order] = await Promise.all([
      prisma.zellePayment.findUnique({ where: { id: req.params.id } }),
      prisma.order.findUnique({ where: { id: orderId } }),
    ]);

    if (!record) {
      return res.status(404).json({ success: false, error: "Zelle payment not found" });
    }
    if (!order) {
      return res.status(400).json({ success: false, error: "Order not found" });
    }
    if (["CONFIRMED", "MANUALLY_MATCHED"].includes(record.status)) {
      return res.status(400).json({
        success: false,
        error: `Payment is already ${record.status} and cannot be re-linked.`,
      });
    }
    if (record.status === "IGNORED") {
      return res.status(400).json({
        success: false,
        error: "Cannot link an IGNORED payment. Un-ignore it first.",
      });
    }

    // Check order isn't already paid via Zelle
    const existingPayment = await prisma.payment.findFirst({
      where: { orderId, paymentMethod: "ZELLE", status: "COMPLETED" },
    });
    if (existingPayment) {
      return res.status(400).json({
        success: false,
        error: "This order already has a completed Zelle payment.",
      });
    }

    await prisma.$transaction([
      prisma.payment.create({
        data: {
          orderId,
          paymentMethod: "ZELLE",
          provider: "zelle",
          transactionId: record.gmailMessageId,
          amount: record.parsedAmount,
          currency: "USD",
          status: "COMPLETED",
          paidAt: record.receivedAt,
        },
      }),
      prisma.zellePayment.update({
        where: { id: record.id },
        data: {
          orderId,
          status: "MANUALLY_MATCHED",
          matchConfidence: "MANUAL",
          confirmedById: req.user?.id || null,
          confirmedAt: new Date(),
        },
      }),
    ]);

    const updated = await prisma.zellePayment.findUnique({
      where: { id: record.id },
      include: { order: { select: { orderNumber: true, status: true } } },
    });

    res.json({ success: true, data: updated });
  }),
);

// ─── Ignore ───────────────────────────────────────────────────────────────────

router.post(
  "/:id/ignore",
  requirePermission("ORDERS", "UPDATE"),
  [param("id").isString(), validateRequest],
  asyncHandler(async (req, res) => {
    const record = await prisma.zellePayment.findUnique({ where: { id: req.params.id } });

    if (!record) {
      return res.status(404).json({ success: false, error: "Zelle payment not found" });
    }
    if (["CONFIRMED", "MANUALLY_MATCHED"].includes(record.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot ignore a ${record.status} payment.`,
      });
    }

    const updated = await prisma.zellePayment.update({
      where: { id: record.id },
      data: { status: "IGNORED" },
    });

    res.json({ success: true, data: updated });
  }),
);

// ─── Un-ignore (IGNORED → UNMATCHED) ─────────────────────────────────────────

router.post(
  "/:id/unignore",
  requirePermission("ORDERS", "UPDATE"),
  [param("id").isString(), validateRequest],
  asyncHandler(async (req, res) => {
    const record = await prisma.zellePayment.findUnique({ where: { id: req.params.id } });

    if (!record) {
      return res.status(404).json({ success: false, error: "Zelle payment not found" });
    }
    if (record.status !== "IGNORED") {
      return res.status(400).json({
        success: false,
        error: "Only IGNORED payments can be un-ignored.",
      });
    }

    const updated = await prisma.zellePayment.update({
      where: { id: record.id },
      data: { status: "UNMATCHED" },
    });

    res.json({ success: true, data: updated });
  }),
);

module.exports = router;
