const express = require("express");
const { body, param, query } = require("express-validator");
const prisma = require('../prisma/client');
const validateRequest = require("../middleware/validateRequest");
const { asyncHandler } = require("../middleware/errorHandler");
const { requireRole, requirePermission } = require("../middleware/auth");

const router = express.Router();

// Get all categories with pagination and search
router.get(
  "/",
  // requirePermission("PRODUCTS", "READ"),
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("search")
      .optional()
      .isString()
      .withMessage("Search term must be a string"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search;

    // Build where clause
    const where = {};
    if (search) {
      where.name = {
        contains: search,
        mode: "insensitive",
      };
    }

    // Get categories with pagination
    const [categories, total] = await Promise.all([
      prisma.productCategory.findMany({
        where,
        include: {
          product: {
            select: {
              name: true,
              status: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { name: "asc" },
      }),
      prisma.productCategory.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        categories,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  })
);

// Get distinct category names for selection
router.get(
  "/distinct",
  // requirePermission("PRODUCTS", "READ"),
  asyncHandler(async (req, res) => {
    const records = await prisma.productCategory.findMany({
      distinct: ["name"],
      select: { name: true },
      orderBy: { name: "asc" },
    });
    const categories = records.map((r) => r.name).filter(Boolean);
    res.json({ success: true, categories });
  })
);

// Get category by ID
router.get(
  "/:id",
  requirePermission("PRODUCTS", "READ"),
  [
    param("id").isString().withMessage("Category ID is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const category = await prisma.productCategory.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            name: true,
            status: true,
          },
        },
      },
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: "Category not found",
      });
    }

    res.json({
      success: true,
      data: category,
    });
  })
);

// Create category
router.post(
  "/",
  // requirePermission("PRODUCTS", "CREATE"),
  [
    body("name")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Category name is required"),
    body("productId").isString().withMessage("Product ID is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { name, productId } = req.body;

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }

    // Create category
    const category = await prisma.productCategory.create({
      data: {
        name,
        productId,
      },
      include: {
        product: {
          select: {
            name: true,
            status: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: category,
    });
  })
);

// Update category
router.put(
  "/:id",
  requirePermission("PRODUCTS", "UPDATE"),
  [
    param("id").isString().withMessage("Category ID is required"),
    body("name")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Category name is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    // Check if category exists
    const existingCategory = await prisma.productCategory.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        error: "Category not found",
      });
    }

    // Update category
    const category = await prisma.productCategory.update({
      where: { id },
      data: { name },
      include: {
        product: {
          select: {
            name: true,
            status: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: category,
    });
  })
);

// Delete category
router.delete(
  "/:id",
  requirePermission("PRODUCTS", "DELETE"),
  [
    param("id").isString().withMessage("Category ID is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check if category exists
    const existingCategory = await prisma.productCategory.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        error: "Category not found",
      });
    }

    // Delete category
    await prisma.productCategory.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: "Category deleted successfully",
    });
  })
);

module.exports = router;
