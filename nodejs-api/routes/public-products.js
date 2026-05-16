const express = require("express");
const { param, query } = require("express-validator");
const prisma = require("../prisma/client");
const validateRequest = require("../middleware/validateRequest");
const { asyncHandler } = require("../middleware/errorHandler");

const router = express.Router();

// Public: list products (ACTIVE only)
router.get(
  "/",
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
    query("category")
      .optional()
      .isString()
      .withMessage("Category must be a string"),
    query("isPopular").optional().isBoolean().toBoolean(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 12,
      search,
      category,
      sortBy = "displayOrder",
      sortOrder = "asc",
      isPopular,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { status: "ACTIVE" };
    if (search) {
      const searchTerms = search.split(/\s+/).filter(t => t.length > 1 && /[a-z0-9]/i.test(t));
      if (searchTerms.length > 0) {
        where.AND = [
          ...(where.AND || []),
          ...searchTerms.map(term => ({
            OR: [
              { name: { contains: term, mode: "insensitive" } },
              { description: { contains: term, mode: "insensitive" } },
              { variants: { some: { name: { contains: term, mode: "insensitive" } } } },
              { variants: { some: { sku: { contains: term, mode: "insensitive" } } } },
            ]
          }))
        ];
      }
    }
    if (category) {
      where.categories = {
        some: { name: { equals: category, mode: "insensitive" } },
      };
    }
    if (typeof isPopular === 'boolean') {
      where.isPopular = isPopular;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: typeof isPopular === 'boolean' && isPopular
          ? [{ popularOrder: { displayOrder: 'asc' } }, { displayOrder: 'asc' }]
          : { [sortBy]: sortOrder },
        include: {
          variants: {
            where: { isActive: true },
            select: {
              id: true,
              sku: true,
              name: true,
              description: true,
              regularPrice: true,
              salePrice: true,
              isActive: true,
              seoSlug: true,
              variantOptions: true,
              segmentPrices: true,
              bulkPrices: {
                orderBy: { minQty: 'asc' }
              },
              inventory: {
                select: { quantity: true, reservedQty: true, sellWhenOutOfStock: true },
              },
            },
          },
          images: {
            select: { id: true, url: true, altText: true, sortOrder: true },
            orderBy: { sortOrder: "asc" },
          },
          categories: { select: { id: true, name: true } },
          tags: { select: { id: true, tag: true } },
          _count: { select: { reviews: true, variants: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        products: products
          // Filter out products with no active variants
          .filter((product) => product.variants.length > 0)
          .map((product) => ({
            ...product,
            inStock: product.variants.some((variant) => {
              if (variant.inventory.some(inv => inv.sellWhenOutOfStock)) return true;
              const totalAvailable = variant.inventory.reduce((sum, inv) => {
                const available = Math.max(0, (inv.quantity || 0) - (inv.reservedQty || 0));
                return sum + available;
              }, 0);
              return totalAvailable > 0;
            }),
            _firstVariantId: product.variants[0]?.id,
          })),
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

// Public: batch fetch variant details (for guest cart enrichment)
router.get(
  "/variants/batch",
  [
    query("ids").isString().withMessage("ids query param is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const ids = String(req.query.ids).split(",").map(s => s.trim()).filter(Boolean).slice(0, 50);
    if (ids.length === 0) return res.json({ success: true, data: [] });

    const variants = await prisma.productVariant.findMany({
      where: { id: { in: ids }, isActive: true },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            status: true,
            images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } },
          },
        },
        inventory: {
          select: { quantity: true, reservedQty: true, sellWhenOutOfStock: true, locationId: true },
        },
      },
    });

    const data = variants
      .filter(v => v.product?.status === "ACTIVE")
      .map(v => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        regularPrice: v.regularPrice,
        salePrice: v.salePrice,
        product: v.product,
        inventory: v.inventory,
        inStock:
          v.inventory.some(inv => inv.sellWhenOutOfStock) ||
          v.inventory.reduce((sum, inv) => sum + Math.max(0, (inv.quantity || 0) - (inv.reservedQty || 0)), 0) > 0,
      }));

    res.json({ success: true, data });
  }),
);

// Public: get product by id or slug
router.get(
  "/:id",
  [
    param("id").isString().withMessage("Product ID is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params; // can be product id or seoSlug

    // First try to find by product ID (fast, indexed lookup)
    let product = await prisma.product.findFirst({
      where: {
        id,
        status: "ACTIVE",
      },
      include: {
        variants: {
          where: { isActive: true },
          include: {
            variantOptions: true,
            segmentPrices: true,
            bulkPrices: {
              orderBy: { minQty: 'asc' }
            },
            inventory: {
              select: {
                id: true,
                quantity: true,
                reservedQty: true,
                locationId: true,
                sellWhenOutOfStock: true,
              },
            },
            images: {
              select: { id: true, url: true, altText: true, sortOrder: true },
              orderBy: { sortOrder: "asc" },
            },
          },
        },
        images: {
          orderBy: { sortOrder: "asc" },
        },
        categories: true,
        tags: true,
        _count: { select: { reviews: true } },
      },
    });

    // If not found by ID, try by variant slug (slower fallback)
    if (!product) {
      const variant = await prisma.productVariant.findFirst({
        where: {
          seoSlug: id,
          isActive: true,
          product: { status: "ACTIVE" },
        },
        include: {
          product: {
            include: {
              variants: {
                where: { isActive: true },
                include: {
                  variantOptions: true,
                  segmentPrices: true,
                  bulkPrices: {
                    orderBy: { minQty: 'asc' }
                  },
                  inventory: {
                    select: {
                      id: true,
                      quantity: true,
                      reservedQty: true,
                      locationId: true,
                      sellWhenOutOfStock: true,
                    },
                  },
                  images: {
                    select: {
                      id: true,
                      url: true,
                      altText: true,
                      sortOrder: true,
                    },
                    orderBy: { sortOrder: "asc" },
                  },
                },
              },
              images: {
                orderBy: { sortOrder: "asc" },
              },
              categories: true,
              tags: true,
              _count: { select: { reviews: true } },
            },
          },
        },
      });
      product = variant?.product;
    }

    if (!product) {
      return res
        .status(404)
        .json({ success: false, error: "Product not found" });
    }

    // Calculate inStock for each variant
    const productWithStock = {
      ...product,
      variants: product.variants.map((variant) => ({
        ...variant,
        inStock: variant.inventory.some(inv => inv.sellWhenOutOfStock) || variant.inventory.reduce((sum, inv) => {
          const available = Math.max(0, (inv.quantity || 0) - (inv.reservedQty || 0));
          return sum + available;
        }, 0) > 0,
      })),
      inStock: product.variants.some((variant) => {
        if (variant.inventory.some(inv => inv.sellWhenOutOfStock)) return true;
        const totalAvailable = variant.inventory.reduce((sum, inv) => {
          const available = Math.max(0, (inv.quantity || 0) - (inv.reservedQty || 0));
          return sum + available;
        }, 0);
        return totalAvailable > 0;
      }),
    };

    res.json({ success: true, data: productWithStock });
  })
);

module.exports = router;
