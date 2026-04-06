const express = require("express");
const { body, param, query } = require("express-validator");
const prisma = require("../prisma/client");
const validateRequest = require("../middleware/validateRequest");
const { asyncHandler } = require("../middleware/errorHandler");
const { requireRole, requirePermission } = require("../middleware/auth");

const router = express.Router();

// List all tax rates (optionally filter by country/state)
router.get(
  "/",
  requirePermission("SETTINGS", "READ"),
  [
    query("country").optional().isString(),
    query("state").optional().isString(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { country, state } = req.query;
    const where = {};
    if (country) where.country = country;
    if (state) where.state = state;
    const taxRates = await prisma.taxRate.findMany({ where, orderBy: { country: "asc" } });
    res.json({ success: true, data: taxRates });
  })
);

// Create a new tax rate
router.post(
  "/",
  requirePermission("SETTINGS", "CREATE"),
  [
    body("country").isString(),
    body("state").optional().isString(),
    body("rate").isDecimal({ decimal_digits: "0,2" }),
    body("type").isString(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { country, state, rate, type } = req.body;
    const taxRate = await prisma.taxRate.create({
      data: { country, state, rate: parseFloat(rate), type },
    });
    res.status(201).json({ success: true, data: taxRate });
  })
);

// Update a tax rate
router.put(
  "/:id",
  requirePermission("SETTINGS", "UPDATE"),
  [
    param("id").isString(),
    body("country").optional().isString(),
    body("state").optional().isString(),
    body("rate").optional().isDecimal({ decimal_digits: "0,2" }),
    body("type").optional().isString(),
    body("isActive").optional().isBoolean(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { country, state, rate, type, isActive } = req.body;
    const data = {};
    if (country !== undefined) data.country = country;
    if (state !== undefined) data.state = state;
    if (rate !== undefined) data.rate = parseFloat(rate);
    if (type !== undefined) data.type = type;
    if (isActive !== undefined) data.isActive = isActive;
    const taxRate = await prisma.taxRate.update({ where: { id }, data });
    res.json({ success: true, data: taxRate });
  })
);

// Delete (deactivate) a tax rate
router.delete(
  "/:id",
  requirePermission("SETTINGS", "DELETE"),
  [param("id").isString(), validateRequest],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const taxRate = await prisma.taxRate.update({ where: { id }, data: { isActive: false } });
    res.json({ success: true, data: taxRate });
  })
);

// Get applicable tax rate for a given country/state
router.get(
  "/applicable",
  [query("country").isString(), query("state").optional().isString(), validateRequest],
  asyncHandler(async (req, res) => {
    const { country, state } = req.query;
    // Prefer state-specific, then country-wide, then fallback to 0
    let taxRate = null;
    if (state) {
      taxRate = await prisma.taxRate.findFirst({
        where: { country, state, isActive: true },
        orderBy: { updatedAt: "desc" },
      });
    }
    if (!taxRate) {
      taxRate = await prisma.taxRate.findFirst({
        where: { country, state: null, isActive: true },
        orderBy: { updatedAt: "desc" },
      });
    }
    res.json({ success: true, data: taxRate });
  })
);

module.exports = router; 