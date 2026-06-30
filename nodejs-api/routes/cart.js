const express = require("express");
const { body, param } = require("express-validator");
const prisma = require("../prisma/client");
const validateRequest = require("../middleware/validateRequest");
const { asyncHandler } = require("../middleware/errorHandler");
const { requireRole } = require("../middleware/auth");
const { getPricingCustomerType } = require("../utils/pricingMapper");
const { bulkUnitPrice, isRetailPricing } = require("../utils/bulkTiers");

const router = express.Router();

async function findOrCreateActiveCart(customerId) {
  let cart = await prisma.cart.findFirst({
    where: { customerId, isActive: true },
    include: {
      items: {
        include: {
          variant: {
            include: {
              segmentPrices: true,
              bulkPrices: {
                orderBy: { minQty: 'asc' }
              },
              inventory: {
                select: {
                  quantity: true,
                  reservedQty: true,
                  sellWhenOutOfStock: true,
                  locationId: true,
                },
              },
              product: {
                include: { images: { take: 1, orderBy: { sortOrder: "asc" } } },
              },
            },
          },
        },
      },
    },
  });
  if (!cart) {
    cart = await prisma.cart.create({
      data: { customerId },
      include: {
        items: {
          include: {
            variant: {
              include: {
                segmentPrices: true,
                bulkPrices: {
                  orderBy: { minQty: 'asc' }
                },
                inventory: {
                  select: {
                    quantity: true,
                    reservedQty: true,
                    sellWhenOutOfStock: true,
                    locationId: true,
                  },
                },
                product: {
                  include: {
                    images: { take: 1, orderBy: { sortOrder: "asc" } },
                  },
                },
              },
            },
          },
        },
      },
    });
  }
  return cart;
}

function computeUnitPrice(variant, customerType) {
  // Map customer type to pricing tier (B2B->B2C, ENTERPRISE_2->ENTERPRISE_1)
  const pricingCustomerType = getPricingCustomerType(customerType);

  // If customerType is provided and segment prices exist, use them
  if (
    pricingCustomerType &&
    variant.segmentPrices &&
    variant.segmentPrices.length > 0
  ) {
    const segmentPrice = variant.segmentPrices.find(
      (sp) => sp.customerType === pricingCustomerType
    );
    if (segmentPrice) {
      // Check if salePrice > 0, otherwise use regularPrice
      return segmentPrice.salePrice > 0 ? segmentPrice.salePrice : segmentPrice.regularPrice;
    }
  }

  // Fallback to variant's base prices
  // For B2B/ENTERPRISE customers without segment pricing, use regularPrice only (no sale)
  if (pricingCustomerType && pricingCustomerType !== "B2C") {
    return variant.regularPrice;
  }

  // For B2C or no customer type, check if salePrice > 0, otherwise use regularPrice
  return variant.salePrice > 0 ? variant.salePrice : variant.regularPrice;
}

/**
 * Computes the applicable price for a variant based on quantity and customer type
 * Priority: 1. Bulk pricing (if quantity qualifies), 2. Segment pricing, 3. Base variant pricing
 * @param {Object} variant - The product variant with bulkPrices, segmentPrices, regularPrice, salePrice
 * @param {number} quantity - The quantity being purchased
 * @param {string} customerType - The customer type (B2C, B2B, ENTERPRISE_1, ENTERPRISE_2)
 * @returns {Decimal} The applicable unit price
 */
function computeApplicablePrice(variant, quantity, customerType) {
  // Explicit admin-set per-variant bulk prices take precedence when present.
  if (variant.bulkPrices && variant.bulkPrices.length > 0) {
    // Find the applicable bulk price tier
    // bulkPrices are ordered by minQty ascending
    let applicableBulkPrice = null;
    for (const bulkPrice of variant.bulkPrices) {
      const meetsMin = quantity >= bulkPrice.minQty;
      const meetsMax = bulkPrice.maxQty === null || quantity <= bulkPrice.maxQty;
      if (meetsMin && meetsMax) {
        applicableBulkPrice = bulkPrice.price;
        break;
      }
    }

    // If bulk pricing applies, return it
    if (applicableBulkPrice !== null) {
      return applicableBulkPrice;
    }
  }

  // Public retail bulk-quantity discount: retail (B2C / guest) only, computed
  // off the regular listed price. Wholesale/enterprise account pricing is left
  // untouched so the two systems stay distinct.
  const pricingCustomerType = getPricingCustomerType(customerType);
  if (isRetailPricing(pricingCustomerType)) {
    return bulkUnitPrice(variant.regularPrice, quantity);
  }

  // Fall back to customer type-based (segment) pricing.
  return computeUnitPrice(variant, customerType);
}

// Get current customer's active cart
router.get(
  "/",
  requireRole(["CUSTOMER"]),
  asyncHandler(async (req, res) => {
    const customerId = req.user.customerId;

    // Get customer to determine customerType for pricing
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { customerType: true },
    });

    let cart = await findOrCreateActiveCart(customerId);

    // Filter and remove inactive items
    const inactiveItemIds = [];
    if (cart.items && cart.items.length > 0) {
      for (const item of cart.items) {
        if (!item.variant.isActive || item.variant.product.status !== 'ACTIVE') {
          inactiveItemIds.push(item.id);
        }
      }
    }

    if (inactiveItemIds.length > 0) {
      await prisma.cartItem.deleteMany({
        where: { id: { in: inactiveItemIds } }
      });
      // Re-fetch cart to get clean state
      cart = await findOrCreateActiveCart(customerId);
    }

    // Update unitPrice with latest applicable pricing for each item
    if (cart.items && cart.items.length > 0) {
      cart.items = cart.items.map((item) => {
        const applicablePrice = computeApplicablePrice(
          item.variant,
          item.quantity,
          customer?.customerType
        );
        return {
          ...item,
          unitPrice: applicablePrice, // Update unitPrice for backward compatibility
        };
      });
    }

    res.json({ success: true, data: cart });
  })
);

// Add item to cart
router.post(
  "/items",
  requireRole(["CUSTOMER"]),
  [
    body("variantId").isString().withMessage("variantId is required"),
    body("quantity")
      .optional()
      .isInt({ min: 1 })
      .withMessage("quantity must be >= 1"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const customerId = req.user.customerId;
    const { variantId, quantity = 1 } = req.body;

    // Get customer to determine customerType
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { customerType: true },
    });

    // Ensure variant exists and is active
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        segmentPrices: true,
        bulkPrices: {
          orderBy: { minQty: 'asc' }
        },
        inventory: {
          select: {
            quantity: true,
            reservedQty: true,
            locationId: true,
            sellWhenOutOfStock: true,
          },
        },
      },
    });
    if (!variant || !variant.isActive) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid or inactive variant" });
    }

    // Check available inventory and OOS status
    let canSellOutOfStock = false;
    const totalAvailable = variant.inventory.reduce((sum, inv) => {
      if (inv.sellWhenOutOfStock) canSellOutOfStock = true;
      const available = Math.max(0, (inv.quantity || 0) - (inv.reservedQty || 0));
      return sum + available;
    }, 0);

    // Get current cart to check existing quantity
    const cart = await findOrCreateActiveCart(customerId);
    const existingItem = await prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId } }
    });

    const currentCartQuantity = existingItem ? existingItem.quantity : 0;
    const newTotalQuantity = currentCartQuantity + quantity;

    if (totalAvailable < newTotalQuantity && !canSellOutOfStock) {
      return res
        .status(400)
        .json({
          success: false,
          error: `Only ${totalAvailable} items available in stock. You already have ${currentCartQuantity} in your cart.`
        });
    }

    // Upsert item (increase quantity if exists)
    const existing = await prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
    });
    let item;
    if (existing) {
      item = await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity },
      });
    } else {
      item = await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          variantId,
          quantity,
          unitPrice: computeUnitPrice(variant, customer?.customerType),
        },
      });
    }

    // Touch cart updatedAt
    await prisma.cart.update({
      where: { id: cart.id },
      data: { updatedAt: new Date() },
    });

    const refreshed = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: {
        items: {
          include: {
            variant: {
              include: {
                segmentPrices: true,
                bulkPrices: {
                  orderBy: { minQty: 'asc' }
                },
                product: {
                  include: {
                    images: { take: 1, orderBy: { sortOrder: "asc" } },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Update unitPrice with latest applicable pricing for each item
    if (refreshed.items && refreshed.items.length > 0) {
      refreshed.items = refreshed.items.map((item) => {
        const applicablePrice = computeApplicablePrice(
          item.variant,
          item.quantity,
          customer?.customerType
        );
        return {
          ...item,
          unitPrice: applicablePrice, // Update unitPrice for backward compatibility
        };
      });
    }

    res.json({ success: true, data: refreshed });
  })
);

// Update item quantity
router.put(
  "/items/:itemId",
  requireRole(["CUSTOMER"]),
  [
    param("itemId").isString().withMessage("itemId is required"),
    body("quantity").isInt({ min: 0 }).withMessage("quantity must be >= 0"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const customerId = req.user.customerId;
    const { itemId } = req.params;
    const { quantity } = req.body;

    // Get customer to determine customerType for pricing
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { customerType: true },
    });

    const cart = await findOrCreateActiveCart(customerId);
    const item = await prisma.cartItem.findUnique({
      where: { id: itemId },
      include: {
        variant: {
          include: {
            inventory: {
              select: {
                quantity: true,
                reservedQty: true,
                locationId: true,
                sellWhenOutOfStock: true,
              },
            },
          },
        },
      },
    });
    if (!item || item.cartId !== cart.id) {
      return res.status(404).json({ success: false, error: "Item not found" });
    }

    if (quantity === 0) {
      await prisma.cartItem.delete({ where: { id: itemId } });
    } else {
      // Check available inventory and sellWhenOutOfStock flag
      let canSellOutOfStock = false;
      const totalAvailable = item.variant.inventory.reduce((sum, inv) => {
        if (inv.sellWhenOutOfStock) canSellOutOfStock = true;
        const available = Math.max(0, (inv.quantity || 0) - (inv.reservedQty || 0));
        return sum + available;
      }, 0);

      // Only reject if insufficient stock AND backorders not allowed
      if (totalAvailable < quantity && !canSellOutOfStock) {
        return res
          .status(400)
          .json({
            success: false,
            error: `Only ${totalAvailable} items available in stock`
          });
      }

      await prisma.cartItem.update({
        where: { id: itemId },
        data: { quantity },
      });
    }

    // Touch cart updatedAt
    await prisma.cart.update({
      where: { id: cart.id },
      data: { updatedAt: new Date() },
    });

    const refreshed = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: {
        items: {
          include: {
            variant: {
              include: {
                segmentPrices: true,
                bulkPrices: {
                  orderBy: { minQty: 'asc' }
                },
                product: {
                  include: {
                    images: { take: 1, orderBy: { sortOrder: "asc" } },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Update unitPrice with latest applicable pricing for each item
    if (refreshed.items && refreshed.items.length > 0) {
      refreshed.items = refreshed.items.map((item) => {
        const applicablePrice = computeApplicablePrice(
          item.variant,
          item.quantity,
          customer?.customerType
        );
        return {
          ...item,
          unitPrice: applicablePrice, // Update unitPrice for backward compatibility
        };
      });
    }

    res.json({ success: true, data: refreshed });
  })
);

// Remove item
router.delete(
  "/items/:itemId",
  requireRole(["CUSTOMER"]),
  [
    param("itemId").isString().withMessage("itemId is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const customerId = req.user.customerId;
    const { itemId } = req.params;

    // Get customer to determine customerType for pricing
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { customerType: true },
    });

    const cart = await findOrCreateActiveCart(customerId);
    const item = await prisma.cartItem.findUnique({ where: { id: itemId } });
    if (!item || item.cartId !== cart.id) {
      return res.status(404).json({ success: false, error: "Item not found" });
    }

    await prisma.cartItem.delete({ where: { id: itemId } });

    // Touch cart updatedAt
    await prisma.cart.update({
      where: { id: cart.id },
      data: { updatedAt: new Date() },
    });

    const refreshed = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: {
        items: {
          include: {
            variant: {
              include: {
                segmentPrices: true,
                bulkPrices: {
                  orderBy: { minQty: 'asc' }
                },
                product: {
                  include: {
                    images: { take: 1, orderBy: { sortOrder: "asc" } },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Update unitPrice with latest applicable pricing for each item
    if (refreshed.items && refreshed.items.length > 0) {
      refreshed.items = refreshed.items.map((item) => {
        const applicablePrice = computeApplicablePrice(
          item.variant,
          item.quantity,
          customer?.customerType
        );
        return {
          ...item,
          unitPrice: applicablePrice, // Update unitPrice for backward compatibility
        };
      });
    }

    res.json({ success: true, data: refreshed });
  })
);

// Merge guest cart
router.post(
  "/merge",
  requireRole(["CUSTOMER"]),
  [
    body("items").isArray({ min: 1 }).withMessage("items array is required"),
    body("items.*.variantId").isString(),
    body("items.*.quantity").isInt({ min: 1 }),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const customerId = req.user.customerId;
    const { items } = req.body;

    // Get customer to determine customerType
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { customerType: true },
    });

    const cart = await findOrCreateActiveCart(customerId);

    for (const it of items) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: it.variantId },
        include: { segmentPrices: true },
      });
      if (!variant || !variant.isActive) continue;
      const existing = await prisma.cartItem.findUnique({
        where: {
          cartId_variantId: { cartId: cart.id, variantId: it.variantId },
        },
      });
      if (existing) {
        await prisma.cartItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + it.quantity },
        });
      } else {
        await prisma.cartItem.create({
          data: {
            cartId: cart.id,
            variantId: it.variantId,
            quantity: it.quantity,
            unitPrice: computeUnitPrice(variant, customer?.customerType),
          },
        });
      }
    }

    const refreshed = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: {
        items: {
          include: {
            variant: { include: { segmentPrices: true, bulkPrices: { orderBy: { minQty: 'asc' } }, product: true } },
          },
        },
      },
    });

    // Update unitPrice with latest applicable pricing for each item
    if (refreshed.items && refreshed.items.length > 0) {
      refreshed.items = refreshed.items.map((item) => {
        const applicablePrice = computeApplicablePrice(
          item.variant,
          item.quantity,
          customer?.customerType
        );
        return {
          ...item,
          unitPrice: applicablePrice, // Update unitPrice for backward compatibility
        };
      });
    }

    res.json({ success: true, data: refreshed });
  })
);

// Validate stock for all cart items, remove out-of-stock items, return removed list
router.post(
  "/validate-stock",
  requireRole(["CUSTOMER"]),
  asyncHandler(async (req, res) => {
    const customerId = req.user.customerId;

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { customerType: true },
    });

    let cart = await findOrCreateActiveCart(customerId);

    const outOfStockItemIds = [];
    const removedItems = [];

    if (cart.items && cart.items.length > 0) {
      for (const item of cart.items) {
        // Check if variant or product is inactive
        if (!item.variant.isActive || item.variant.product.status !== 'ACTIVE') {
          outOfStockItemIds.push(item.id);
          removedItems.push({
            id: item.id,
            variantId: item.variantId,
            productName: item.variant.product?.name || 'Unknown Product',
            variantName: item.variant.name || '',
            quantity: item.quantity,
            reason: 'Product is no longer available',
          });
          continue;
        }

        // Check inventory availability
        let canSellOutOfStock = false;
        const totalAvailable = (item.variant.inventory || []).reduce((sum, inv) => {
          if (inv.sellWhenOutOfStock) canSellOutOfStock = true;
          const available = Math.max(0, (inv.quantity || 0) - (inv.reservedQty || 0));
          return sum + available;
        }, 0);

        if ((totalAvailable <= 0 || totalAvailable < item.quantity) && !canSellOutOfStock) {
          outOfStockItemIds.push(item.id);
          removedItems.push({
            id: item.id,
            variantId: item.variantId,
            productName: item.variant.product?.name || 'Unknown Product',
            variantName: item.variant.name || '',
            quantity: item.quantity,
            reason: totalAvailable <= 0 ? 'Out of stock' : 'Insufficient stock available',
          });
        }
      }
    }

    // Delete out-of-stock items from the cart
    if (outOfStockItemIds.length > 0) {
      await prisma.cartItem.deleteMany({
        where: { id: { in: outOfStockItemIds } },
      });
      // Re-fetch cart to get clean state
      cart = await findOrCreateActiveCart(customerId);
    }

    // Update unitPrice with latest applicable pricing
    if (cart.items && cart.items.length > 0) {
      cart.items = cart.items.map((item) => {
        const applicablePrice = computeApplicablePrice(
          item.variant,
          item.quantity,
          customer?.customerType
        );
        return {
          ...item,
          unitPrice: applicablePrice,
        };
      });
    }

    res.json({
      success: true,
      data: {
        removedItems,
        cart,
      },
    });
  })
);

// Clear entire active cart (remove all items)
router.delete(
  "/",
  requireRole(["CUSTOMER"]),
  asyncHandler(async (req, res) => {
    const customerId = req.user.customerId;
    const cart = await prisma.cart.findFirst({
      where: { customerId, isActive: true },
    });
    if (!cart) {
      return res.json({ success: true, data: { id: null, items: [] } });
    }
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    const refreshed = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    images: { take: 1, orderBy: { sortOrder: "asc" } },
                  },
                },
              },
            },
          },
        },
      },
    });
    res.json({ success: true, data: refreshed });
  })
);


// Admin: Fetch abandoned carts
router.get(
  "/abandoned",
  requireRole(["ADMIN", "SUPER_ADMIN", "STAFF"]),
  asyncHandler(async (req, res) => {
    const minutes = parseInt(req.query.minutes) || 30;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);

    const whereClause = {
      isActive: true,
      items: {
        some: {}, // Must have at least one item
        none: {
          updatedAt: {
            gte: cutoffTime, // No items updated recently
          },
        },
      },
    };

    if (search) {
      whereClause.AND = [
        {
          customer: {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const [total, abandonedCarts] = await Promise.all([
      prisma.cart.count({ where: whereClause }),
      prisma.cart.findMany({
        where: whereClause,
        include: {
          customer: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              customerType: true,
              mobile: true,
            },
          },
          items: {
            include: {
              variant: {
                select: {
                  name: true,
                  sku: true,
                  product: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
            orderBy: {
              updatedAt: 'desc',
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
        skip,
        take: limit,
      }),
    ]);

    res.json({
      success: true,
      data: abandonedCarts,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  })
);

// Admin: Send abandoned cart email
const { sendAbandonedCartEmail } = require('../utils/emailService');

router.post(
  "/abandoned/notify-all",
  requireRole(["ADMIN", "SUPER_ADMIN", "STAFF"]),
  asyncHandler(async (req, res) => {
    const minutes = parseInt(req.body.minutes) || 30;
    const search = req.body.search || '';

    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);

    const whereClause = {
      isActive: true,
      items: {
        some: {}, // Must have at least one item
        none: {
          updatedAt: {
            gte: cutoffTime, // No items updated recently
          },
        },
      },
    };

    if (search) {
      whereClause.AND = [
        {
          customer: {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    // Fetch ALL matching carts (no pagination)
    const carts = await prisma.cart.findMany({
      where: whereClause,
      include: {
        customer: true,
        items: {
          include: {
            variant: {
              include: {
                product: true
              }
            }
          }
        }
      }
    });

    if (carts.length === 0) {
      return res.json({ success: true, message: "No abandoned carts found to notify", count: 0 });
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const checkoutUrl = `${frontendUrl}/landing/checkout`;

    let sentCount = 0;
    let errorCount = 0;

    // Send emails in parallel but settled
    const results = await Promise.allSettled(carts.map(async (cart) => {
      if (!cart.customer || !cart.customer.email) return;
      await sendAbandonedCartEmail(cart, cart.customer, checkoutUrl);
    }));

    results.forEach(result => {
      if (result.status === 'fulfilled') sentCount++;
      else {
        console.error('Failed to send bulk abandoned cart email:', result.reason);
        errorCount++;
      }
    });

    res.json({
      success: true,
      message: `Emails processed. Sent: ${sentCount}, Failed: ${errorCount}`,
      sentCount,
      errorCount
    });
  })
);

router.post(
  "/abandoned/notify",
  requireRole(["ADMIN", "SUPER_ADMIN", "STAFF"]),
  asyncHandler(async (req, res) => {
    const { cartId, email } = req.body;

    if (!cartId || !email) {
      return res.status(400).json({ success: false, error: "Cart ID and email are required" });
    }

    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        customer: true,
        items: {
          include: {
            variant: {
              include: {
                product: true
              }
            }
          }
        }
      }
    });

    if (!cart) {
      return res.status(404).json({ success: false, error: "Cart not found" });
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const checkoutUrl = `${frontendUrl}/landing/checkout`; // Direct to checkout

    try {
      await sendAbandonedCartEmail(cart, cart.customer, checkoutUrl);
      res.json({ success: true, message: "Email sent successfully" });
    } catch (error) {
      console.error('Failed to send abandoned cart email:', error);

      // Use a fallback generic message if template fails, or just return error
      // For now, let's return error to debug if template is missing
      return res.status(500).json({
        success: false,
        error: "Failed to send email. Ensure 'ABANDONED_CART' email template exists."
      });
    }
  })
);

module.exports = router;
