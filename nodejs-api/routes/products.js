const express = require("express");
const { body, param, query } = require("express-validator");
const prisma = require("../prisma/client");
const validateRequest = require("../middleware/validateRequest");
const { asyncHandler } = require("../middleware/errorHandler");
const { requireRole, requirePermission } = require("../middleware/auth");
const { exportProductsToExcel, updateProductsFromExcel } = require("../services/productExportService");
const multer = require("multer");
const { ALLOWED_MIME_TYPES, isValidMimeType } = require("../config/fileUpload");

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (isValidMimeType(file.mimetype, ALLOWED_MIME_TYPES.EXCEL)) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel files (.xlsx) are allowed"), false);
    }
  },
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
});

const router = express.Router();

// Get all products with pagination and filters
router.get(
  "/",
  requirePermission("PRODUCTS", "READ"),
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("status")
      .optional()
      .isIn(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"])
      .withMessage("Invalid status"),
    query("search")
      .optional()
      .isString()
      .withMessage("Search must be a string"),
    query("category")
      .optional()
      .isString()
      .withMessage("Category must be a string"),
    query("tag")
      .optional()
      .isString()
      .withMessage("Tag must be a string"),
    query("isPopular").optional().isBoolean().toBoolean(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      category,
      tag,
      sortBy = "displayOrder",
      sortOrder = "asc",
      isPopular,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const where = {};
    if (status) where.status = status;
    if (search) {
      const searchTerms = search.split(/\s+/).filter(Boolean);
      if (searchTerms.length > 0) {
        where.AND = [
          ...(where.AND || []),
          ...searchTerms.map(term => ({
            OR: [
              { name: { contains: term, mode: "insensitive" } },
              { description: { contains: term, mode: "insensitive" } },
            ]
          }))
        ];
      }
    }
    if (category) {
      where.categories = {
        some: {
          name: { contains: category, mode: "insensitive" },
        },
      };
    }
    if (tag) {
      where.tags = {
        some: {
          tag: { contains: tag, mode: "insensitive" },
        },
      };
    }
    if (typeof isPopular === 'boolean') {
      where.isPopular = isPopular;
    }

    // Get products and total count
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { [sortBy]: sortOrder },
        include: {
          variants: {
            select: {
              id: true,
              sku: true,
              shipstationSku: true,
              name: true,
              description: true,
              regularPrice: true,
              salePrice: true,
              weight: true,
              hsn: true,
              isActive: true,
              seoTitle: true,
              seoDescription: true,
              seoSlug: true,
              inventory: {
                select: {
                  quantity: true,
                  reservedQty: true,
                  locationId: true,
                },
              },
              segmentPrices: true,
              bulkPrices: {
                orderBy: { minQty: 'asc' }
              },
              variantOptions: true,
              images: {
                select: { id: true, url: true, altText: true, sortOrder: true },
                orderBy: { sortOrder: "asc" },
              },
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
          categories: {
            select: {
              id: true,
              name: true,
            },
          },
          tags: {
            select: {
              id: true,
              tag: true,
            },
          },
          _count: {
            select: {
              variants: true,
              reviews: true,
            },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    // Compute status counts ignoring pagination but respecting search/category/tag filters
    const baseWhere = { ...where };
    // Remove specific status filter to compute counts across statuses under same search/category/tag
    if (baseWhere.status) delete baseWhere.status;

    const [activeCount, draftCount, inactiveCount, archivedCount] = await Promise.all([
      prisma.product.count({ where: { ...baseWhere, status: 'ACTIVE' } }),
      prisma.product.count({ where: { ...baseWhere, status: 'DRAFT' } }),
      prisma.product.count({ where: { ...baseWhere, status: 'INACTIVE' } }),
      prisma.product.count({ where: { ...baseWhere, status: 'ARCHIVED' } }),
    ]);

    // Serialize Decimal fields to numbers
    const serializedProducts = products.map(product => ({
      ...product,
      variants: product.variants.map(variant => ({
        ...variant,
        regularPrice: Number(variant.regularPrice),
        salePrice: variant.salePrice ? Number(variant.salePrice) : null,
        weight: variant.weight ? Number(variant.weight) : null,
        segmentPrices: variant.segmentPrices.map(sp => ({
          ...sp,
          regularPrice: Number(sp.regularPrice),
          salePrice: sp.salePrice ? Number(sp.salePrice) : null
        })),
        bulkPrices: variant.bulkPrices.map(bp => ({
          ...bp,
          price: Number(bp.price)
        }))
      }))
    }));

    res.json({
      success: true,
      data: {
        products: serializedProducts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
        stats: {
          active: activeCount,
          draft: draftCount,
          inactive: inactiveCount,
          archived: archivedCount,
        }
      },
    });
  })
);

// Export all products to Excel
router.get(
  "/export/all",
  requirePermission("PRODUCTS", "READ"),
  asyncHandler(async (req, res) => {
    const buffer = await exportProductsToExcel();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=products-export-${new Date().toISOString().split('T')[0]}.xlsx`
    );

    res.send(buffer);
  })
);

// Email all products report
router.post(
  "/email-report",
  requirePermission("PRODUCTS", "READ"),
  [
    body("email").isEmail().withMessage("Valid email is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    const { queueReport } = require("../services/reportQueue");
    await queueReport('products', { email });

    res.json({
      success: true,
      message: "Products report generation queued. It will be sent to your email shortly.",
    });
  })
);

// Import and update products from Excel
router.post(
  "/import/update",
  requirePermission("PRODUCTS", "UPDATE"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded" });
    }

    const result = await updateProductsFromExcel(req.file.buffer);

    res.json({
      success: true,
      data: result
    });
  })
);

// Get product by ID
router.get(
  "/:id",
  requirePermission("PRODUCTS", "READ"),
  [
    param("id").isString().withMessage("Product ID is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        variants: {
          include: {
            variantOptions: true,
            segmentPrices: true,
            bulkPrices: {
              orderBy: { minQty: 'asc' }
            },
            images: { orderBy: { sortOrder: "asc" } },
            thirdPartyReports: true,
            inventory: {
              include: {
                location: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        images: {
          orderBy: { sortOrder: "asc" },
        },
        categories: true,
        tags: true,
        relatedProducts: {
          include: {
            relatedProduct: {
              select: {
                id: true,
                name: true,
                status: true,
                images: {
                  select: {
                    url: true,
                    altText: true,
                  },
                  take: 1,
                  orderBy: { sortOrder: "asc" },
                },
              },
            },
          },
        },
        thirdPartyReports: true,
        reviews: {
          include: {
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }

    // Serialize Decimal fields to numbers
    const serializedProduct = {
      ...product,
      variants: product.variants.map(variant => ({
        ...variant,
        regularPrice: Number(variant.regularPrice),
        salePrice: variant.salePrice ? Number(variant.salePrice) : null,
        weight: variant.weight ? Number(variant.weight) : null,
        segmentPrices: variant.segmentPrices.map(sp => ({
          ...sp,
          regularPrice: Number(sp.regularPrice),
          salePrice: sp.salePrice ? Number(sp.salePrice) : null
        })),
        bulkPrices: variant.bulkPrices.map(bp => ({
          ...bp,
          price: Number(bp.price)
        }))
      }))
    };

    res.json({
      success: true,
      data: serializedProduct,
    });
  })
);

// Create new product
router.post(
  "/",
  requirePermission("PRODUCTS", "CREATE"),
  [
    body("name").notEmpty().trim().withMessage("Product name is required"),
    body("description")
      .optional()
      .isString()
      .withMessage("Description must be a string"),
    body("status")
      .optional()
      .isIn(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"])
      .withMessage("Invalid status"),
    body("shipstationSku")
      .optional()
      .isString()
      .withMessage("ShipStation SKU must be a string"),
    body("categories")
      .optional()
      .isArray()
      .withMessage("Categories must be an array"),
    body("tags").optional().isArray().withMessage("Tags must be an array"),
    body("images").optional().isArray().withMessage("Images must be an array"),
    body("shipstationSku")
      .optional()
      .isString()
      .withMessage("ShipStation SKU must be a string"),
    body("seoTitle").optional().isString().withMessage("SEO title must be a string"),
    body("seoDescription").optional().isString().withMessage("SEO description must be a string"),
    body("seoSlug").optional().isString().withMessage("SEO slug must be a string"),
    body("variants")
      .isArray({ min: 1 })
      .withMessage("At least one variant is required"),
    body("variants.*.sku")
      .notEmpty()
      .withMessage("SKU is required for each variant"),
    body("variants.*.name").notEmpty().withMessage("Variant name is required"),
    body("variants.*.shipstationSku")
      .optional()
      .isString()
      .withMessage("Variant ShipStation SKU must be a string"),
    body("variants.*.regularPrice")
      .isDecimal({ decimal_digits: "0,2" })
      .withMessage("Regular price must be a valid decimal"),
    body("variants.*.salePrice")
      .optional()
      .isDecimal({ decimal_digits: "0,2" })
      .withMessage("Sale price must be a valid decimal"),
    body("variants.*.weight")
      .optional()
      .isDecimal({ decimal_digits: "0,2" })
      .withMessage("Weight must be a valid decimal"),
    body("variants.*.hsn")
      .optional()
      .isString()
      .withMessage("HSN must be a string"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const {
      name,
      description,
      status = "DRAFT",
      shipstationSku,
      categories = [],
      tags = [],
      images = [],
      variants,
      seoTitle,
      seoDescription,
      seoSlug,
    } = req.body;

    // Check if any variant SKU already exists
    const existingSkus = await prisma.productVariant.findMany({
      where: {
        sku: {
          in: variants.map((v) => v.sku),
        },
      },
      select: { sku: true },
    });

    if (existingSkus.length > 0) {
      return res.status(409).json({
        success: false,
        error: `SKU(s) already exist: ${existingSkus
          .map((s) => s.sku)
          .join(", ")}`,
      });
    }

    // Create product with variants in a transaction
    const product = await prisma.$transaction(async (tx) => {
      // Create product
      const newProduct = await tx.product.create({
        data: {
          name,
          description,
          status,
          shipstationSku,
          seoTitle,
          seoDescription,
          seoSlug,
        },
      });

      // Create categories
      if (categories.length > 0) {
        await tx.productCategory.createMany({
          data: categories.map((cat) => ({
            productId: newProduct.id,
            name: cat,
          })),
        });
      }

      // Create tags
      if (tags.length > 0) {
        await tx.productTag.createMany({
          data: tags.map((tag) => ({
            productId: newProduct.id,
            tag,
          })),
        });
      }

      // Create images
      if (images.length > 0) {
        await tx.productImage.createMany({
          data: images.map((img, index) => ({
            productId: newProduct.id,
            url: img.url,
            altText: img.altText || "",
            sortOrder: img.sortOrder || index,
          })),
        });
      }

      // Find or get Main Warehouse location
      let mainWarehouse = await tx.location.findFirst({
        where: { name: "Main Warehouse" },
      });

      // If Main Warehouse doesn't exist, create it
      if (!mainWarehouse) {
        mainWarehouse = await tx.location.create({
          data: {
            name: "Main Warehouse",
            address: "",
            isActive: true,
          },
        });
      }

      // Create variants
      for (const variant of variants) {
        const newVariant = await tx.productVariant.create({
          data: {
            productId: newProduct.id,
            sku: variant.sku,
            name: variant.name,
            shipstationSku: variant.shipstationSku?.trim() || null,
            description: variant.description?.trim() || null,
            regularPrice: variant.regularPrice,
            salePrice: variant.salePrice !== null && variant.salePrice !== undefined ? variant.salePrice : null,
            weight: variant.weight || null,
            hsn: variant.hsn?.trim() || null,
            idealFor: variant.idealFor?.trim() || null,
            keyBenefits: variant.keyBenefits?.trim() || null,
            taxName: variant.taxName?.trim() || null,
            taxPercentage: variant.taxPercentage || null,
            seoTitle: variant.seoTitle?.trim() || null,
            seoDescription: variant.seoDescription?.trim() || null,
            seoSlug: variant.seoSlug?.trim() || null,
            isActive: variant.isActive !== undefined ? variant.isActive : true,
          },
        });

        // Create segment prices
        if (variant.segmentPrices && Array.isArray(variant.segmentPrices) && variant.segmentPrices.length > 0) {
          await tx.segmentPrice.createMany({
            data: variant.segmentPrices
              .filter((sp) => sp.regularPrice > 0)
              .map((sp) => ({
                variantId: newVariant.id,
                customerType: sp.customerType,
                regularPrice: sp.regularPrice,
                salePrice: sp.salePrice !== null && sp.salePrice !== undefined ? sp.salePrice : null,
              })),
          });
        }

        // Create bulk prices
        if (variant.bulkPrices && Array.isArray(variant.bulkPrices) && variant.bulkPrices.length > 0) {
          await tx.bulkPrice.createMany({
            data: variant.bulkPrices
              .filter((bp) => bp.minQty > 0 && bp.price > 0)
              .map((bp) => ({
                variantId: newVariant.id,
                minQty: bp.minQty,
                maxQty: bp.maxQty,
                price: bp.price,
              })),
          });
        }

        // Create variant options
        if (variant.options && variant.options.length > 0) {
          await tx.variantOption.createMany({
            data: variant.options.map((opt) => ({
              variantId: newVariant.id,
              name: opt.name,
              value: opt.value,
            })),
          });
        }

        // Create variant images
        if (Array.isArray(variant.images) && variant.images.length > 0) {
          await tx.variantImage.createMany({
            data: variant.images.map((img, index) => ({
              variantId: newVariant.id,
              url: img.url,
              altText: img.altText || "",
              sortOrder: img.sortOrder || index,
            })),
          });
        }

        // Create inventory for this variant in Main Warehouse with 200 stock
        await tx.inventory.create({
          data: {
            variantId: newVariant.id,
            locationId: mainWarehouse.id,
            quantity: 200,
            reservedQty: 0,
            lowStockAlert: 10,
          },
        });
      }

      // Return complete product with relations
      return tx.product.findUnique({
        where: { id: newProduct.id },
        include: {
          variants: {
            include: {
              variantOptions: true,
              segmentPrices: true,
              images: { orderBy: { sortOrder: "asc" } },
            },
          },
          images: {
            orderBy: { sortOrder: "asc" },
          },
          categories: true,
          tags: true,
        },
      });
    });

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  })
);

// Update product
router.put(
  "/:id",
  requirePermission("PRODUCTS", "UPDATE"),
  [
    param("id").isString().withMessage("Product ID is required"),
    body("name")
      .optional()
      .notEmpty()
      .trim()
      .withMessage("Product name cannot be empty"),
    body("description")
      .optional()
      .isString()
      .withMessage("Description must be a string"),
    body("status")
      .optional()
      .isIn(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"])
      .withMessage("Invalid status"),
    body("categories")
      .optional()
      .isArray()
      .withMessage("Categories must be an array"),
    body("tags").optional().isArray().withMessage("Tags must be an array"),
    body("images").optional().isArray().withMessage("Images must be an array"),
    body("seoTitle").optional().isString().withMessage("SEO title must be a string"),
    body("seoDescription").optional().isString().withMessage("SEO description must be a string"),
    body("seoSlug").optional().isString().withMessage("SEO slug must be a string"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, description, status, shipstationSku, categories, tags, images, seoTitle, seoDescription, seoSlug } = req.body;

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }

    // Update product in a transaction
    const product = await prisma.$transaction(async (tx) => {
      // Update product basic info
      const updateData = {};
      if (name) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (status) updateData.status = status;
      if (seoTitle !== undefined) updateData.seoTitle = seoTitle;
      if (seoDescription !== undefined) updateData.seoDescription = seoDescription;
      if (seoSlug !== undefined) updateData.seoSlug = seoSlug;
      if (shipstationSku !== undefined) updateData.shipstationSku = shipstationSku;

      await tx.product.update({
        where: { id },
        data: updateData,
      });

      // Update categories
      if (categories) {
        await tx.productCategory.deleteMany({
          where: { productId: id },
        });

        if (categories.length > 0) {
          await tx.productCategory.createMany({
            data: categories.map((cat) => ({
              productId: id,
              name: cat,
            })),
          });
        }
      }

      // Update tags
      if (tags) {
        await tx.productTag.deleteMany({
          where: { productId: id },
        });

        if (tags.length > 0) {
          await tx.productTag.createMany({
            data: tags.map((tag) => ({
              productId: id,
              tag,
            })),
          });
        }
      }

      // Update images
      if (images) {
        await tx.productImage.deleteMany({
          where: { productId: id },
        });

        if (images.length > 0) {
          await tx.productImage.createMany({
            data: images.map((img, index) => ({
              productId: id,
              url: img.url,
              altText: img.altText || "",
              sortOrder: img.sortOrder || index,
            })),
          });
        }
      }

      // Return updated product with relations
      return tx.product.findUnique({
        where: { id },
        include: {
          variants: {
            include: {
              variantOptions: true,
            },
          },
          images: {
            orderBy: { sortOrder: "asc" },
          },
          categories: true,
          tags: true,
        },
      });
    });

    res.json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  })
);

// Delete product (permanent deletion from database)
router.delete(
  "/:id",
  requirePermission("PRODUCTS", "DELETE"),
  [
    param("id").isString().withMessage("Product ID is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id },
      include: {
        variants: true,
        images: true,
        categories: true,
        tags: true,
      },
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }

    // Delete product and all related data in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete related data first
      await tx.productRelation.deleteMany({ where: { productId: id } });
      await tx.productRelation.deleteMany({ where: { relatedProductId: id } });
      await tx.productTag.deleteMany({ where: { productId: id } });
      await tx.productCategory.deleteMany({ where: { productId: id } });
      await tx.productImage.deleteMany({ where: { productId: id } });

      // Delete variant-related data
      const variantIds = existingProduct.variants.map(v => v.id);
      if (variantIds.length > 0) {
        // First get inventory IDs for these variants
        const inventories = await tx.inventory.findMany({
          where: { variantId: { in: variantIds } },
          select: { id: true }
        });
        const inventoryIds = inventories.map(inv => inv.id);

        // Delete inventory batches and movements by inventoryId
        if (inventoryIds.length > 0) {
          await tx.inventoryBatch.deleteMany({ where: { inventoryId: { in: inventoryIds } } });
          await tx.inventoryMovement.deleteMany({ where: { inventoryId: { in: inventoryIds } } });
        }

        // Delete other variant-related data
        await tx.segmentPrice.deleteMany({ where: { variantId: { in: variantIds } } });
        await tx.variantOption.deleteMany({ where: { variantId: { in: variantIds } } });
        await tx.variantImage.deleteMany({ where: { variantId: { in: variantIds } } });
        await tx.inventory.deleteMany({ where: { variantId: { in: variantIds } } });
        await tx.productVariant.deleteMany({ where: { productId: id } });
      }

      // Finally delete the product
      await tx.product.delete({ where: { id } });
    });

    res.json({
      success: true,
      message: "Product deleted permanently from database",
    });
  })
);

// Archive product (set status to ARCHIVED)
router.patch(
  "/:id/archive",
  requirePermission("PRODUCTS", "UPDATE"),
  [
    param("id").isString().withMessage("Product ID is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }

    // Set status to ARCHIVED
    await prisma.product.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });

    res.json({
      success: true,
      message: "Product archived successfully",
    });
  })
);

// Bulk delete products (permanent deletion from database)
router.post(
  "/bulk-delete",
  requirePermission("PRODUCTS", "DELETE"),
  [body("ids").isArray({ min: 1 }).withMessage("ids must be a non-empty array"), validateRequest],
  asyncHandler(async (req, res) => {
    const { ids } = req.body;

    // Delete products and all related data in a transaction
    let deletedCount = 0;
    await prisma.$transaction(async (tx) => {
      for (const id of ids) {
        const product = await tx.product.findUnique({
          where: { id },
          include: { variants: true },
        });

        if (product) {
          // Delete related data
          await tx.productRelation.deleteMany({ where: { productId: id } });
          await tx.productRelation.deleteMany({ where: { relatedProductId: id } });
          await tx.productTag.deleteMany({ where: { productId: id } });
          await tx.productCategory.deleteMany({ where: { productId: id } });
          await tx.productImage.deleteMany({ where: { productId: id } });

          // Delete variant-related data
          const variantIds = product.variants.map(v => v.id);
          if (variantIds.length > 0) {
            // First get inventory IDs for these variants
            const inventories = await tx.inventory.findMany({
              where: { variantId: { in: variantIds } },
              select: { id: true }
            });
            const inventoryIds = inventories.map(inv => inv.id);

            // Delete inventory batches and movements by inventoryId
            if (inventoryIds.length > 0) {
              await tx.inventoryBatch.deleteMany({ where: { inventoryId: { in: inventoryIds } } });
              await tx.inventoryMovement.deleteMany({ where: { inventoryId: { in: inventoryIds } } });
            }

            // Delete other variant-related data
            await tx.segmentPrice.deleteMany({ where: { variantId: { in: variantIds } } });
            await tx.variantOption.deleteMany({ where: { variantId: { in: variantIds } } });
            await tx.variantImage.deleteMany({ where: { variantId: { in: variantIds } } });
            await tx.inventory.deleteMany({ where: { variantId: { in: variantIds } } });
            await tx.productVariant.deleteMany({ where: { productId: id } });
          }

          // Delete the product
          await tx.product.delete({ where: { id } });
          deletedCount++;
        }
      }
    });

    res.json({ success: true, deleted: deletedCount });
  })
);

// Bulk import products
router.post(
  "/bulk-import",
  requirePermission("PRODUCTS", "CREATE"),
  [body("products").isArray({ min: 1 }).withMessage("products must be a non-empty array"), validateRequest],
  asyncHandler(async (req, res) => {
    const { products } = req.body;
    let created = 0;
    await prisma.$transaction(async (tx) => {
      for (const p of products) {
        if (!p.name || !Array.isArray(p.variants) || p.variants.length === 0) continue;
        const mainVariant = p.variants[0] || p;
        if (!mainVariant.sku || !mainVariant.regularPrice) continue;
        await tx.product.create({
          data: {
            name: p.name,
            description: p.description || '',
            status: p.status || 'DRAFT',
            variants: {
              create: [{
                sku: mainVariant.sku,
                name: mainVariant.name || p.name,
                regularPrice: parseFloat(mainVariant.regularPrice),
                salePrice: mainVariant.salePrice ? parseFloat(mainVariant.salePrice) : undefined,
                isActive: true,
              }],
            },
          },
        });
        created++;
      }
    });
    res.json({ success: true, created });
  })
);

// Bulk reorder products by displayOrder
router.post(
  "/reorder",
  requirePermission("PRODUCTS", "UPDATE"),
  [
    body("orders").isArray({ min: 1 }).withMessage("orders must be a non-empty array"),
    body("orders.*.id").isString().withMessage("Each item must have id"),
    body("orders.*.displayOrder").isInt({ min: 0 }).withMessage("displayOrder must be integer >= 0"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { orders } = req.body;
    await prisma.$transaction(
      orders.map((o) =>
        prisma.product.update({ where: { id: o.id }, data: { displayOrder: o.displayOrder } })
      )
    );
    res.json({ success: true });
  })
);

// Reorder popular products (and toggle isPopular)
router.post(
  "/popular/reorder",
  requirePermission("PRODUCTS", "UPDATE"),
  [
    body("orders").isArray({ min: 1 }).withMessage("orders must be a non-empty array"),
    body("orders.*.id").isString().withMessage("Each item must have id"),
    body("orders.*.displayOrder").isInt({ min: 0 }).withMessage("displayOrder must be integer >= 0"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { orders } = req.body; // [{id, displayOrder}]
    const popularIds = orders.map((o) => o.id);
    await prisma.$transaction(async (tx) => {
      // Unset products no longer popular
      await tx.product.updateMany({ where: { isPopular: true, id: { notIn: popularIds } }, data: { isPopular: false } });
      await tx.popularProductOrder.deleteMany({ where: { productId: { notIn: popularIds } } });

      // Upsert current list with ordering and ensure flag
      for (const o of orders) {
        await tx.product.update({ where: { id: o.id }, data: { isPopular: true } });
        await tx.popularProductOrder.upsert({
          where: { productId: o.id },
          update: { displayOrder: o.displayOrder },
          create: { productId: o.id, displayOrder: o.displayOrder },
        });
      }
    });
    res.json({ success: true });
  })
);

// Distinct tags for selection
router.get(
  "/tags/distinct",
  // requirePermission("PRODUCTS", "READ"),
  asyncHandler(async (req, res) => {
    const records = await prisma.productTag.findMany({
      distinct: ["tag"],
      select: { tag: true },
      orderBy: { tag: "asc" },
    });
    const tags = records.map((r) => r.tag).filter(Boolean);
    res.json({ success: true, tags });
  })
);

// Create variant for existing product
router.post(
  "/:id/variants",
  requirePermission("PRODUCTS", "CREATE"),
  [
    param("id").isString().withMessage("Product ID is required"),
    body("sku").notEmpty().withMessage("SKU is required"),
    body("name").notEmpty().withMessage("Variant name is required"),
    body("regularPrice")
      .isDecimal({ decimal_digits: "0,2" })
      .withMessage("Regular price must be a valid decimal"),
    body("salePrice")
      .optional()
      .isDecimal({ decimal_digits: "0,2" })
      .withMessage("Sale price must be a valid decimal"),
    body("weight")
      .optional()
      .isDecimal({ decimal_digits: "0,2" })
      .withMessage("Weight must be a valid decimal"),
    body("hsn").optional().isString().withMessage("HSN must be a string"),
    body("options")
      .optional()
      .isArray()
      .withMessage("Options must be an array"),
    body("segmentPrices")
      .optional()
      .isArray()
      .withMessage("Segment prices must be an array"),
    body("segmentPrices.*.customerType")
      .optional()
      .isIn(["B2C", "B2B", "ENTERPRISE_1", "ENTERPRISE_2", "ENTERPRISE"]) // include legacy ENTERPRISE for compatibility
      .withMessage("Invalid customer type"),
    body("segmentPrices.*.regularPrice")
      .optional()
      .isDecimal({ decimal_digits: "0,2" })
      .withMessage("Regular price must be a valid decimal"),
    body("segmentPrices.*.salePrice")
      .optional()
      .isDecimal({ decimal_digits: "0,2" })
      .withMessage("Sale price must be a valid decimal"),
    body("shipstationSku")
      .optional()
      .isString()
      .withMessage("ShipStation SKU must be a string"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      sku,
      shipstationSku,
      name,
      description,
      regularPrice,
      salePrice,
      weight,
      hsn,
      idealFor,
      keyBenefits,
      taxName,
      taxPercentage,
      seoTitle,
      seoDescription,
      seoSlug,
      isActive = true,
      options = [],
      segmentPrices = [],
      bulkPrices = [],
      images,
    } = req.body;

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }

    // Check if SKU already exists
    const existingSku = await prisma.productVariant.findUnique({
      where: { sku },
    });

    if (existingSku) {
      return res.status(409).json({
        success: false,
        error: "SKU already exists",
      });
    }

    // Find or get Main Warehouse location
    let mainWarehouse = await prisma.location.findFirst({
      where: { name: "Main Warehouse" },
    });

    // If Main Warehouse doesn't exist, create it
    if (!mainWarehouse) {
      mainWarehouse = await prisma.location.create({
        data: {
          name: "Main Warehouse",
          address: "123 Warehouse St, Warehouse City, WH 12345, US",
          isActive: true,
        },
      });
    }

    // Create variant with segment prices
    const variant = await prisma.$transaction(async (tx) => {
      const newVariant = await tx.productVariant.create({
        data: {
          productId: id,
          sku,
          shipstationSku: shipstationSku?.trim() || null,
          name,
          description: description?.trim() || null,
          regularPrice,
          salePrice: salePrice !== null && salePrice !== undefined ? salePrice : null,
          weight: weight || null,
          hsn: hsn?.trim() || null,
          idealFor: idealFor?.trim() || null,
          keyBenefits: keyBenefits?.trim() || null,
          taxName: taxName?.trim() || null,
          taxPercentage: taxPercentage || null,
          seoTitle: seoTitle?.trim() || null,
          seoDescription: seoDescription?.trim() || null,
          seoSlug: seoSlug?.trim() || null,
          isActive,
          segmentPrices: {
            createMany: {
              data: segmentPrices
                .filter((sp) => sp.regularPrice > 0)
                .map((sp) => ({
                  customerType: sp.customerType,
                  regularPrice: sp.regularPrice,
                  salePrice: sp.salePrice !== null && sp.salePrice !== undefined ? sp.salePrice : null,
                })),
            },
          },
          variantOptions: {
            createMany: {
              data: options.map((opt) => ({
                name: opt.name,
                value: opt.value,
              })),
            },
          },
        },
      });

      if (Array.isArray(images) && images.length > 0) {
        await tx.variantImage.createMany({
          data: images.map((img, index) => ({
            variantId: newVariant.id,
            url: img.url,
            altText: img.altText || "",
            sortOrder: img.sortOrder || index,
          })),
        });
      }

      // Create bulk prices
      if (Array.isArray(bulkPrices) && bulkPrices.length > 0) {
        await tx.bulkPrice.createMany({
          data: bulkPrices
            .filter((bp) => bp.minQty > 0 && bp.price > 0)
            .map((bp) => ({
              variantId: newVariant.id,
              minQty: bp.minQty,
              maxQty: bp.maxQty,
              price: bp.price,
            })),
        });
      }

      // Create inventory for this variant in Main Warehouse with 200 stock
      await tx.inventory.create({
        data: {
          variantId: newVariant.id,
          locationId: mainWarehouse.id,
          quantity: 200,
          reservedQty: 0,
          lowStockAlert: 10,
        },
      });

      return tx.productVariant.findUnique({
        where: { id: newVariant.id },
        include: {
          variantOptions: true,
          segmentPrices: true,
          images: { orderBy: { sortOrder: "asc" } },
        },
      });
    });

    res.status(201).json({
      success: true,
      message: "Variant created successfully",
      data: variant,
    });
  })
);

// Update variant
router.put(
  "/:productId/variants/:variantId",
  requirePermission("PRODUCTS", "UPDATE"),
  [
    param("productId").isString().withMessage("Product ID is required"),
    param("variantId").isString().withMessage("Variant ID is required"),
    body("sku").optional().notEmpty().withMessage("SKU cannot be empty"),
    body("name")
      .optional()
      .notEmpty()
      .withMessage("Variant name cannot be empty"),
    body("regularPrice")
      .optional()
      .isDecimal({ decimal_digits: "0,2" })
      .withMessage("Regular price must be a valid decimal"),
    body("salePrice")
      .optional()
      .isDecimal({ decimal_digits: "0,2" })
      .withMessage("Sale price must be a valid decimal"),
    body("weight")
      .optional()
      .isDecimal({ decimal_digits: "0,2" })
      .withMessage("Weight must be a valid decimal"),
    body("hsn").optional().isString().withMessage("HSN must be a string"),
    body("idealFor").optional().isString().withMessage("Ideal for must be a string"),
    body("keyBenefits").optional().isString().withMessage("Key benefits must be a string"),
    body("taxName").optional().isString().withMessage("Tax name must be a string"),
    body("taxPercentage")
      .optional()
      .isDecimal({ decimal_digits: "0,2" })
      .withMessage("Tax percentage must be a valid decimal"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be boolean"),
    body("options")
      .optional()
      .isArray()
      .withMessage("Options must be an array"),
    body("segmentPrices")
      .optional()
      .isArray()
      .withMessage("Segment prices must be an array"),
    body("segmentPrices.*.customerType")
      .optional()
      .isIn(["B2C", "B2B", "ENTERPRISE_1", "ENTERPRISE_2", "ENTERPRISE"]) // include legacy ENTERPRISE for compatibility
      .withMessage("Invalid customer type"),
    body("segmentPrices.*.regularPrice")
      .optional()
      .isDecimal({ decimal_digits: "0,2" })
      .withMessage("Regular price must be a valid decimal"),
    body("segmentPrices.*.salePrice")
      .optional()
      .isDecimal({ decimal_digits: "0,2" })
      .withMessage("Sale price must be a valid decimal"),
    body("shipstationSku")
      .optional()
      .isString()
      .withMessage("ShipStation SKU must be a string"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { productId, variantId } = req.params;
    const {
      sku,
      shipstationSku,
      name,
      description,
      regularPrice,
      salePrice,
      weight,
      hsn,
      idealFor,
      keyBenefits,
      taxName,
      taxPercentage,
      seoTitle,
      seoDescription,
      seoSlug,
      isActive,
      options,
      segmentPrices,
      bulkPrices,
      images,
    } = req.body;

    // Check if variant exists
    const existingVariant = await prisma.productVariant.findUnique({
      where: { id: variantId, productId },
    });

    if (!existingVariant) {
      return res.status(404).json({
        success: false,
        error: "Variant not found",
      });
    }

    // Check if new SKU already exists (if SKU is being updated)
    if (sku && sku !== existingVariant.sku) {
      const existingSku = await prisma.productVariant.findUnique({
        where: { sku },
      });

      if (existingSku) {
        return res.status(409).json({
          success: false,
          error: "SKU already exists",
        });
      }
    }

    // Update variant
    const variant = await prisma.$transaction(async (tx) => {
      // Update variant basic info
      const updateData = {};
      if (sku) updateData.sku = sku;
      if (shipstationSku !== undefined) updateData.shipstationSku = shipstationSku?.trim() || null;
      if (name) updateData.name = name;
      if (description !== undefined) updateData.description = description?.trim() || null;
      if (regularPrice) updateData.regularPrice = regularPrice;
      if (salePrice !== undefined) updateData.salePrice = salePrice !== null && salePrice !== undefined ? salePrice : null;
      if (weight !== undefined) updateData.weight = weight || null;
      if (hsn !== undefined) updateData.hsn = hsn?.trim() || null;
      if (idealFor !== undefined) updateData.idealFor = idealFor?.trim() || null;
      if (keyBenefits !== undefined) updateData.keyBenefits = keyBenefits?.trim() || null;
      if (taxName !== undefined) updateData.taxName = taxName?.trim() || null;
      if (taxPercentage !== undefined) updateData.taxPercentage = taxPercentage || null;
      if (seoTitle !== undefined) updateData.seoTitle = seoTitle?.trim() || null;
      if (seoDescription !== undefined)
        updateData.seoDescription = seoDescription?.trim() || null;
      if (seoSlug !== undefined) updateData.seoSlug = seoSlug?.trim() || null;
      if (isActive !== undefined) updateData.isActive = isActive;

      await tx.productVariant.update({
        where: { id: variantId },
        data: updateData,
      });

      // Update options
      if (options) {
        await tx.variantOption.deleteMany({
          where: { variantId },
        });

        if (options.length > 0) {
          await tx.variantOption.createMany({
            data: options.map((opt) => ({
              variantId,
              name: opt.name,
              value: opt.value,
            })),
          });
        }
      }

      // Update segment prices
      if (segmentPrices) {
        await tx.segmentPrice.deleteMany({
          where: { variantId },
        });

        if (segmentPrices.length > 0) {
          await tx.segmentPrice.createMany({
            data: segmentPrices.map((sp) => ({
              variantId,
              customerType: sp.customerType,
              regularPrice: sp.regularPrice,
              salePrice: sp.salePrice !== null && sp.salePrice !== undefined ? sp.salePrice : null,
            })),
          });
        }
      }

      // Update bulk prices
      if (bulkPrices) {
        await tx.bulkPrice.deleteMany({
          where: { variantId },
        });

        if (bulkPrices.length > 0) {
          await tx.bulkPrice.createMany({
            data: bulkPrices.map((bp) => ({
              variantId,
              minQty: bp.minQty,
              maxQty: bp.maxQty,
              price: bp.price,
            })),
          });
        }
      }

      // Replace variant images if provided
      if (images) {
        await tx.variantImage.deleteMany({ where: { variantId } });
        if (images.length > 0) {
          await tx.variantImage.createMany({
            data: images.map((img, index) => ({
              variantId,
              url: img.url,
              altText: img.altText || "",
              sortOrder: img.sortOrder || index,
            })),
          });
        }
      }

      return tx.productVariant.findUnique({
        where: { id: variantId },
        include: {
          variantOptions: true,
          segmentPrices: true,
          bulkPrices: {
            orderBy: { minQty: 'asc' }
          },
          images: { orderBy: { sortOrder: "asc" } },
        },
      });
    });

    res.json({
      success: true,
      message: "Variant updated successfully",
      data: variant,
    });
  })
);

// Delete variant
router.delete(
  "/:productId/variants/:variantId",
  requirePermission("PRODUCTS", "DELETE"),
  [
    param("productId").isString().withMessage("Product ID is required"),
    param("variantId").isString().withMessage("Variant ID is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { productId, variantId } = req.params;

    // Check if variant exists
    const existingVariant = await prisma.productVariant.findUnique({
      where: { id: variantId, productId },
      include: {
        images: true,
        segmentPrices: true,
        variantOptions: true,
        inventory: true,
      },
    });

    if (!existingVariant) {
      return res.status(404).json({
        success: false,
        error: "Variant not found",
      });
    }

    // Permanently delete variant and all related data in a transaction
    await prisma.$transaction(async (tx) => {
      // First get inventory IDs for this variant
      const inventories = await tx.inventory.findMany({
        where: { variantId },
        select: { id: true }
      });
      const inventoryIds = inventories.map(inv => inv.id);

      // Delete inventory batches and movements by inventoryId
      if (inventoryIds.length > 0) {
        await tx.inventoryBatch.deleteMany({ where: { inventoryId: { in: inventoryIds } } });
        await tx.inventoryMovement.deleteMany({ where: { inventoryId: { in: inventoryIds } } });
      }

      // Delete other variant-related data
      await tx.segmentPrice.deleteMany({ where: { variantId } });
      await tx.variantOption.deleteMany({ where: { variantId } });
      await tx.variantImage.deleteMany({ where: { variantId } });
      await tx.inventory.deleteMany({ where: { variantId } });

      // Finally delete the variant
      await tx.productVariant.delete({ where: { id: variantId } });
    });

    res.json({
      success: true,
      message: "Variant deleted permanently from database",
    });
  })
);

// List tags for a product
router.get(
  '/:id/tags',
  requirePermission('PRODUCTS', 'READ'),
  [param('id').isString().withMessage('Product ID is required'), validateRequest],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: { tags: true },
    });
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, data: product.tags });
  })
);
// Add a tag to a product
router.post(
  '/:id/tags',
  requirePermission('PRODUCTS', 'UPDATE'),
  [param('id').isString().withMessage('Product ID is required'), body('tag').isString().notEmpty().withMessage('Tag is required'), validateRequest],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { tag } = req.body;
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    const newTag = await prisma.productTag.create({ data: { productId: id, tag } });
    res.status(201).json({ success: true, data: newTag });
  })
);
// Remove a tag from a product
router.delete(
  '/:id/tags/:tagId',
  requirePermission('PRODUCTS', 'UPDATE'),
  [param('id').isString().withMessage('Product ID is required'), param('tagId').isString().withMessage('Tag ID is required'), validateRequest],
  asyncHandler(async (req, res) => {
    const { tagId } = req.params;
    await prisma.productTag.delete({ where: { id: tagId } });
    res.json({ success: true });
  })
);

// Product Relations Management
router.post(
  "/:id/relations",
  requirePermission("PRODUCTS", "UPDATE"),
  [
    param("id").isString().withMessage("Product ID is required"),
    body("relatedProductId").isString().withMessage("Related product ID is required"),
    body("type").isIn(["RELATED", "UPSELL", "CROSS_SELL"]).withMessage("Invalid relation type"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { relatedProductId, type } = req.body;

    // Check if product exists
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }

    // Check if related product exists
    const relatedProduct = await prisma.product.findUnique({ where: { id: relatedProductId } });
    if (!relatedProduct) {
      return res.status(404).json({
        success: false,
        error: "Related product not found",
      });
    }

    // Check if relation already exists
    const existingRelation = await prisma.productRelation.findUnique({
      where: {
        productId_relatedProductId_type: {
          productId: id,
          relatedProductId,
          type,
        },
      },
    });

    if (existingRelation) {
      return res.status(409).json({
        success: false,
        error: "Relation already exists",
      });
    }

    // Create relation
    const relation = await prisma.productRelation.create({
      data: {
        productId: id,
        relatedProductId,
        type,
      },
      include: {
        relatedProduct: {
          select: {
            id: true,
            name: true,
            status: true,
            images: {
              select: {
                url: true,
                altText: true,
              },
              take: 1,
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
    });

    res.json({
      success: true,
      message: "Product relation created successfully",
      data: relation,
    });
  })
);

router.delete(
  "/:productId/relations/:relationId",
  requirePermission("PRODUCTS", "UPDATE"),
  [
    param("productId").isString().withMessage("Product ID is required"),
    param("relationId").isString().withMessage("Relation ID is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { productId, relationId } = req.params;

    // Check if relation exists and belongs to the product
    const relation = await prisma.productRelation.findUnique({
      where: { id: relationId, productId },
    });

    if (!relation) {
      return res.status(404).json({
        success: false,
        error: "Relation not found",
      });
    }

    // Delete relation
    await prisma.productRelation.delete({
      where: { id: relationId },
    });

    res.json({
      success: true,
      message: "Product relation deleted successfully",
    });
  })
);

router.get(
  "/:id/relations",
  requirePermission("PRODUCTS", "READ"),
  [
    param("id").isString().withMessage("Product ID is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const relations = await prisma.productRelation.findMany({
      where: { productId: id },
      include: {
        relatedProduct: {
          select: {
            id: true,
            name: true,
            status: true,
            images: {
              select: {
                url: true,
                altText: true,
              },
              take: 1,
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      data: relations,
    });
  })
);

module.exports = router;
