const express = require("express");
const { body, param, query } = require("express-validator");
const prisma = require("../prisma/client");
const validateRequest = require("../middleware/validateRequest");
const { asyncHandler } = require("../middleware/errorHandler");
const { requirePermission } = require("../middleware/auth");
const slugify = require("slugify");

const router = express.Router();

// Get all collections with pagination and filters
router.get(
  "/",
  requirePermission("COLLECTIONS", "READ"),
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
      .withMessage("Search must be a string"),
    query("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      search,
      isActive,
      sortBy = "sortOrder",
      sortOrder = "asc",
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const where = {};
    if (typeof isActive === "boolean") where.isActive = isActive;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get collections and total count
    const [collections, total] = await Promise.all([
      prisma.collection.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: { products: true },
          },
        },
      }),
      prisma.collection.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        collections,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  })
);

// Get collection by ID
router.get(
  "/:id",
  requirePermission("COLLECTIONS", "READ"),
  [
    param("id").isString().withMessage("Collection ID is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const collection = await prisma.collection.findUnique({
      where: { id },
      include: {
        products: {
          include: {
            product: {
              include: {
                images: {
                  take: 1,
                  orderBy: { sortOrder: "asc" },
                },
                variants: {
                  select: {
                    id: true,
                    name: true,
                    regularPrice: true,
                    salePrice: true,
                    isActive: true,
                  },
                },
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!collection) {
      return res.status(404).json({
        success: false,
        error: "Collection not found",
      });
    }

    res.json({
      success: true,
      data: collection,
    });
  })
);

// Create new collection
router.post(
  "/",
  requirePermission("COLLECTIONS", "CREATE"),
  [
    body("name").notEmpty().trim().withMessage("Collection name is required"),
    body("description")
      .optional()
      .isString()
      .withMessage("Description must be a string"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean"),
    body("sortOrder")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Sort order must be a non-negative integer"),
    body("productIds")
      .optional()
      .isArray()
      .withMessage("Product IDs must be an array"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const {
      name,
      description,
      isActive = true,
      sortOrder = 0,
      productIds = [],
    } = req.body;

    // Generate slug from name
    const baseSlug = slugify(name, { lower: true, strict: true });
    let slug = baseSlug;
    let counter = 1;

    // Ensure unique slug
    while (await prisma.collection.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Create collection with products in a transaction
    const collection = await prisma.$transaction(async (tx) => {
      // Create collection
      const newCollection = await tx.collection.create({
        data: {
          name,
          description,
          slug,
          isActive,
          sortOrder,
        },
      });

      // Add products if provided
      if (productIds.length > 0) {
        await tx.productCollection.createMany({
          data: productIds.map((productId, index) => ({
            collectionId: newCollection.id,
            productId,
            sortOrder: index,
          })),
        });
      }

      return newCollection;
    });

    res.status(201).json({
      success: true,
      data: collection,
    });
  })
);

// Update collection
router.patch(
  "/:id",
  requirePermission("COLLECTIONS", "UPDATE"),
  [
    param("id").isString().withMessage("Collection ID is required"),
    body("name")
      .optional()
      .notEmpty()
      .trim()
      .withMessage("Collection name cannot be empty"),
    body("description")
      .optional()
      .isString()
      .withMessage("Description must be a string"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean"),
    body("sortOrder")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Sort order must be a non-negative integer"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, description, isActive, sortOrder } = req.body;

    // Check if collection exists
    const existingCollection = await prisma.collection.findUnique({
      where: { id },
    });

    if (!existingCollection) {
      return res.status(404).json({
        success: false,
        error: "Collection not found",
      });
    }

    // Generate new slug if name is changed
    let slug;
    if (name && name !== existingCollection.name) {
      const baseSlug = slugify(name, { lower: true, strict: true });
      slug = baseSlug;
      let counter = 1;

      while (
        await prisma.collection.findUnique({
          where: {
            slug,
            id: { not: id }, // Exclude current collection
          },
        })
      ) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
    }

    // Update collection
    const collection = await prisma.collection.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(slug && { slug }),
      },
    });

    res.json({
      success: true,
      data: collection,
    });
  })
);

// Delete collection
router.delete(
  "/:id",
  requirePermission("COLLECTIONS", "DELETE"),
  [
    param("id").isString().withMessage("Collection ID is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    await prisma.collection.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: "Collection deleted successfully",
    });
  })
);

// Update collection products
router.put(
  "/:id/products",
  requirePermission("COLLECTIONS", "UPDATE"),
  [
    param("id").isString().withMessage("Collection ID is required"),
    body("productIds").isArray().withMessage("Product IDs must be an array"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { productIds } = req.body;

    // Check if collection exists
    const collection = await prisma.collection.findUnique({
      where: { id },
    });

    if (!collection) {
      return res.status(404).json({
        success: false,
        error: "Collection not found",
      });
    }

    // Update products in a transaction
    await prisma.$transaction(async (tx) => {
      // Remove existing products
      await tx.productCollection.deleteMany({
        where: { collectionId: id },
      });

      // Add new products
      if (productIds.length > 0) {
        await tx.productCollection.createMany({
          data: productIds.map((productId, index) => ({
            collectionId: id,
            productId,
            sortOrder: index,
          })),
        });
      }
    });

    res.json({
      success: true,
      message: "Collection products updated successfully",
    });
  })
);

// Reorder collection products
router.patch(
  "/:id/products/reorder",
  requirePermission("COLLECTIONS", "UPDATE"),
  [
    param("id").isString().withMessage("Collection ID is required"),
    body("productOrders")
      .isArray()
      .withMessage("Product orders must be an array"),
    body("productOrders.*.productId")
      .isString()
      .withMessage("Product ID is required"),
    body("productOrders.*.sortOrder")
      .isInt({ min: 0 })
      .withMessage("Sort order must be a non-negative integer"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { productOrders } = req.body;

    // Update sort orders in parallel
    await Promise.all(
      productOrders.map(({ productId, sortOrder }) =>
        prisma.productCollection.update({
          where: {
            collectionId_productId: {
              collectionId: id,
              productId,
            },
          },
          data: { sortOrder },
        })
      )
    );

    res.json({
      success: true,
      message: "Collection products reordered successfully",
    });
  })
);

module.exports = router;
