/**
 * Admin wholesale pricing management. Mounted behind authMiddleware.
 * These rows feed the public /pricing page, so editing here updates the page
 * live, with no code change.
 */
const express = require("express");
const { body, param } = require("express-validator");
const prisma = require("../prisma/client");
const validateRequest = require("../middleware/validateRequest");
const { asyncHandler } = require("../middleware/errorHandler");
const { requirePermission } = require("../middleware/auth");

const router = express.Router();
const READ = requirePermission("products", "READ");
const WRITE = requirePermission("products", "UPDATE");

router.get(
  "/",
  READ,
  asyncHandler(async (req, res) => {
    const rows = await prisma.wholesalePrice.findMany({
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
    res.json({ success: true, data: rows });
  }),
);

router.post(
  "/",
  WRITE,
  [
    body("name").notEmpty().trim().withMessage("Name is required"),
    body("strength").notEmpty().trim().withMessage("Strength is required"),
    body("reg").isFloat({ min: 0 }),
    body("m2").isFloat({ min: 0 }),
    body("m5").isFloat({ min: 0 }),
    body("m10").isFloat({ min: 0 }),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { name, strength, category, reg, m2, m5, m10, displayOrder, isActive } = req.body;
    try {
      const row = await prisma.wholesalePrice.create({
        data: {
          name,
          strength,
          category: category || "Research Peptides",
          reg,
          m2,
          m5,
          m10,
          displayOrder: displayOrder ?? 0,
          isActive: isActive !== false,
        },
      });
      res.json({ success: true, data: row });
    } catch (e) {
      res
        .status(e.code === "P2002" ? 409 : 400)
        .json({ success: false, error: e.code === "P2002" ? "A row with this name and strength already exists" : e.message });
    }
  }),
);

router.patch(
  "/:id",
  WRITE,
  [param("id").isString(), validateRequest],
  asyncHandler(async (req, res) => {
    const fields = {};
    for (const k of ["name", "strength", "category", "reg", "m2", "m5", "m10", "displayOrder", "isActive"]) {
      if (req.body[k] !== undefined) fields[k] = req.body[k];
    }
    try {
      const row = await prisma.wholesalePrice.update({ where: { id: req.params.id }, data: fields });
      res.json({ success: true, data: row });
    } catch (e) {
      res.status(400).json({ success: false, error: e.message });
    }
  }),
);

router.delete(
  "/:id",
  WRITE,
  asyncHandler(async (req, res) => {
    await prisma.wholesalePrice.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  }),
);

module.exports = router;
