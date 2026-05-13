const express = require("express");
const { body, param, query } = require("express-validator");
const prisma = require("../prisma/client");
const validateRequest = require("../middleware/validateRequest");
const { asyncHandler } = require("../middleware/errorHandler");
const { requirePermission } = require("../middleware/auth");
const { applyBulkMovement } = require("../services/inventory.service");
const parsers = require("../services/supplier-parsers");

const router = express.Router();

// ------------- Suppliers (SupplierEmailSource) -------------

router.get(
  "/suppliers",
  requirePermission("INVENTORY", "READ"),
  asyncHandler(async (req, res) => {
    const sources = await prisma.supplierEmailSource.findMany({
      include: { location: true, _count: { select: { receipts: true, mappings: true } } },
      orderBy: { name: "asc" },
    });
    res.json({ success: true, data: sources });
  }),
);

router.post(
  "/suppliers",
  requirePermission("INVENTORY", "CREATE"),
  [
    body("name").isString().isLength({ min: 1, max: 100 }),
    body("senderEmail").isEmail(),
    body("parserKey").isString().isIn(parsers.listParserKeys()),
    body("defaultLocationId").isString(),
    body("active").optional().isBoolean(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { name, senderEmail, parserKey, defaultLocationId, active } = req.body;
    const location = await prisma.location.findUnique({ where: { id: defaultLocationId } });
    if (!location) {
      return res.status(400).json({ success: false, error: "Unknown defaultLocationId" });
    }
    const created = await prisma.supplierEmailSource.create({
      data: {
        name,
        senderEmail: senderEmail.toLowerCase(),
        parserKey,
        defaultLocationId,
        active: active !== false,
      },
      include: { location: true },
    });
    res.status(201).json({ success: true, data: created });
  }),
);

router.patch(
  "/suppliers/:id",
  requirePermission("INVENTORY", "UPDATE"),
  [
    param("id").isString(),
    body("name").optional().isString(),
    body("senderEmail").optional().isEmail(),
    body("parserKey").optional().isString().isIn(parsers.listParserKeys()),
    body("defaultLocationId").optional().isString(),
    body("active").optional().isBoolean(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const data = {};
    for (const key of ["name", "parserKey", "defaultLocationId", "active"]) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }
    if (req.body.senderEmail !== undefined) data.senderEmail = String(req.body.senderEmail).toLowerCase();

    const updated = await prisma.supplierEmailSource.update({
      where: { id },
      data,
      include: { location: true },
    });
    res.json({ success: true, data: updated });
  }),
);

router.delete(
  "/suppliers/:id",
  requirePermission("INVENTORY", "DELETE"),
  [param("id").isString(), validateRequest],
  asyncHandler(async (req, res) => {
    await prisma.supplierEmailSource.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  }),
);

// Available parser keys (for "Add supplier" form)
router.get(
  "/parsers",
  requirePermission("INVENTORY", "READ"),
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: parsers.listParserKeys() });
  }),
);

// ------------- Product mappings (SupplierProductMapping) -------------

router.get(
  "/suppliers/:id/mappings",
  requirePermission("INVENTORY", "READ"),
  [param("id").isString(), validateRequest],
  asyncHandler(async (req, res) => {
    const mappings = await prisma.supplierProductMapping.findMany({
      where: { supplierSourceId: req.params.id },
      include: {
        variant: { include: { product: { select: { name: true } } } },
      },
      orderBy: { supplierProductName: "asc" },
    });
    res.json({ success: true, data: mappings });
  }),
);

router.delete(
  "/mappings/:id",
  requirePermission("INVENTORY", "UPDATE"),
  [param("id").isString(), validateRequest],
  asyncHandler(async (req, res) => {
    await prisma.supplierProductMapping.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  }),
);

// ------------- Pending receipts -------------

router.get(
  "/",
  requirePermission("INVENTORY", "READ"),
  [
    query("status").optional().isIn(["PENDING", "APPROVED", "REJECTED", "PARTIAL"]),
    query("supplierSourceId").optional().isString(),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "25", 10);
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.supplierSourceId) where.supplierSourceId = req.query.supplierSourceId;

    const [total, items, pendingCount] = await Promise.all([
      prisma.pendingStockReceipt.count({ where }),
      prisma.pendingStockReceipt.findMany({
        where,
        include: {
          source: { select: { id: true, name: true, senderEmail: true } },
          _count: { select: { lines: true } },
          lines: { select: { matchStatus: true } },
        },
        orderBy: { receivedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.pendingStockReceipt.count({ where: { status: "PENDING" } }),
    ]);

    const data = items.map((r) => {
      const matched = r.lines.filter((l) =>
        l.matchStatus === "AUTO_MATCHED" || l.matchStatus === "MANUAL_MATCHED",
      ).length;
      return {
        id: r.id,
        orderNumber: r.orderNumber,
        rawSubject: r.rawSubject,
        receivedAt: r.receivedAt,
        status: r.status,
        source: r.source,
        lineCount: r._count.lines,
        matchedCount: matched,
        processedAt: r.processedAt,
      };
    });

    res.json({
      success: true,
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      pendingCount,
    });
  }),
);

router.get(
  "/:id",
  requirePermission("INVENTORY", "READ"),
  [param("id").isString(), validateRequest],
  asyncHandler(async (req, res) => {
    const receipt = await prisma.pendingStockReceipt.findUnique({
      where: { id: req.params.id },
      include: {
        source: { include: { location: true } },
        processedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        lines: {
          include: {
            variant: {
              include: { product: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });
    if (!receipt) {
      return res.status(404).json({ success: false, error: "Receipt not found" });
    }
    res.json({ success: true, data: receipt });
  }),
);

router.patch(
  "/:id/lines/:lineId",
  requirePermission("INVENTORY", "UPDATE"),
  [
    param("id").isString(),
    param("lineId").isString(),
    body("variantId").isString(),
    body("quantityMultiplier").optional().isFloat({ gt: 0 }),
    body("rememberMapping").optional().isBoolean(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id, lineId } = req.params;
    const { variantId, quantityMultiplier, rememberMapping } = req.body;
    const multiplier = quantityMultiplier || 1;

    const line = await prisma.pendingStockReceiptLine.findUnique({
      where: { id: lineId },
      include: { receipt: true },
    });
    if (!line || line.receiptId !== id) {
      return res.status(404).json({ success: false, error: "Line not found on this receipt" });
    }

    const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant) {
      return res.status(400).json({ success: false, error: "Unknown variantId" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedLine = await tx.pendingStockReceiptLine.update({
        where: { id: lineId },
        data: {
          matchedVariantId: variantId,
          effectiveQuantity: Math.round(line.parsedQuantity * multiplier),
          matchStatus: "MANUAL_MATCHED",
        },
      });

      if (rememberMapping !== false) {
        await tx.supplierProductMapping.upsert({
          where: {
            supplierSourceId_supplierProductName: {
              supplierSourceId: line.receipt.supplierSourceId,
              supplierProductName: line.supplierProductName,
            },
          },
          update: { variantId, quantityMultiplier: multiplier },
          create: {
            supplierSourceId: line.receipt.supplierSourceId,
            supplierProductName: line.supplierProductName,
            variantId,
            quantityMultiplier: multiplier,
          },
        });
      }

      return updatedLine;
    });

    res.json({ success: true, data: updated });
  }),
);

router.patch(
  "/:id/lines/:lineId/unlink",
  requirePermission("INVENTORY", "UPDATE"),
  [param("id").isString(), param("lineId").isString(), validateRequest],
  asyncHandler(async (req, res) => {
    const { id, lineId } = req.params;
    const line = await prisma.pendingStockReceiptLine.findUnique({ where: { id: lineId } });
    if (!line || line.receiptId !== id) {
      return res.status(404).json({ success: false, error: "Line not found on this receipt" });
    }
    if (line.appliedMovementId) {
      return res.status(400).json({
        success: false,
        error: "Cannot unlink a line that has already been applied to inventory",
      });
    }
    const updated = await prisma.pendingStockReceiptLine.update({
      where: { id: lineId },
      data: { matchedVariantId: null, effectiveQuantity: null, matchStatus: "UNMATCHED" },
    });
    res.json({ success: true, data: updated });
  }),
);

router.post(
  "/:id/approve",
  requirePermission("INVENTORY", "CREATE"),
  [param("id").isString(), validateRequest],
  asyncHandler(async (req, res) => {
    const receipt = await prisma.pendingStockReceipt.findUnique({
      where: { id: req.params.id },
      include: { source: true, lines: true },
    });
    if (!receipt) {
      return res.status(404).json({ success: false, error: "Receipt not found" });
    }
    if (receipt.status === "APPROVED" || receipt.status === "REJECTED") {
      return res.status(400).json({
        success: false,
        error: `Receipt is already ${receipt.status}`,
      });
    }

    const matchedLines = receipt.lines.filter(
      (l) =>
        (l.matchStatus === "AUTO_MATCHED" || l.matchStatus === "MANUAL_MATCHED") &&
        l.matchedVariantId &&
        l.effectiveQuantity &&
        !l.appliedMovementId,
    );

    if (matchedLines.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No matched lines to approve. Map at least one line to a variant first.",
      });
    }

    const items = matchedLines.map((l) => ({
      variantId: l.matchedVariantId,
      locationId: receipt.source.defaultLocationId,
      quantity: l.effectiveQuantity,
    }));

    const reason = `Supplier receipt${receipt.orderNumber ? " #" + receipt.orderNumber : ""} via email (${receipt.source.name})`;
    const results = await applyBulkMovement(items, "PURCHASE", reason, req.user && req.user.id);

    // Persist movement IDs onto the lines and update the receipt status.
    const unmatchedRemaining = receipt.lines.some(
      (l) => l.matchStatus === "UNMATCHED" && !l.appliedMovementId,
    );
    const status = unmatchedRemaining ? "PARTIAL" : "APPROVED";

    await prisma.$transaction([
      ...matchedLines.map((line, idx) =>
        prisma.pendingStockReceiptLine.update({
          where: { id: line.id },
          data: { appliedMovementId: results[idx].movement.id },
        }),
      ),
      prisma.pendingStockReceipt.update({
        where: { id: receipt.id },
        data: {
          status,
          processedAt: new Date(),
          processedById: (req.user && req.user.id) || null,
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        status,
        appliedLines: matchedLines.length,
        movements: results.map((r) => r.movement.id),
      },
    });
  }),
);

router.post(
  "/:id/reject",
  requirePermission("INVENTORY", "UPDATE"),
  [param("id").isString(), validateRequest],
  asyncHandler(async (req, res) => {
    const receipt = await prisma.pendingStockReceipt.findUnique({
      where: { id: req.params.id },
    });
    if (!receipt) {
      return res.status(404).json({ success: false, error: "Receipt not found" });
    }
    if (receipt.status === "APPROVED") {
      return res.status(400).json({
        success: false,
        error: "Cannot reject a receipt that has already been approved",
      });
    }
    const updated = await prisma.pendingStockReceipt.update({
      where: { id: receipt.id },
      data: {
        status: "REJECTED",
        processedAt: new Date(),
        processedById: (req.user && req.user.id) || null,
      },
    });
    res.json({ success: true, data: updated });
  }),
);

module.exports = router;
