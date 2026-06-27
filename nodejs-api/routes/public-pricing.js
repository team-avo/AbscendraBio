/**
 * Public wholesale pricing. Powers the /pricing page, which reads these prices
 * live. No auth: this is prospect facing.
 */
const express = require("express");
const prisma = require("../prisma/client");
const { asyncHandler } = require("../middleware/errorHandler");

const router = express.Router();

// Returns the rows in the exact shape the pricing page expects
// ({ name, strength, reg, m2, m5, m10, cat }).
router.get(
  "/wholesale",
  asyncHandler(async (req, res) => {
    const rows = await prisma.wholesalePrice.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
    const data = rows.map((r) => ({
      name: r.name,
      strength: r.strength,
      reg: r.reg,
      m2: r.m2,
      m5: r.m5,
      m10: r.m10,
      cat: r.category,
    }));
    res.json({ success: true, data });
  }),
);

module.exports = router;
