const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const prisma = require('../prisma/client');
const { requirePermission } = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array(),
    });
  }
  next();
};

// Async handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Get all reviews with pagination and filters
router.get(
  '/',
  requirePermission('PRODUCTS', 'READ'),
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('productId')
      .optional()
      .isString()
      .withMessage('Product ID must be a string'),
    query('isApproved')
      .optional()
      .isBoolean()
      .withMessage('isApproved must be a boolean'),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      productId,
      isApproved,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const where = {};
    if (productId) where.productId = productId;
    if (isApproved !== undefined) where.isApproved = isApproved === 'true';

    // Get reviews and total count
    const [reviews, total] = await Promise.all([
      prisma.productReview.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { [sortBy]: sortOrder },
        include: {
          product: {
            select: {
              id: true,
              name: true,
            },
          },
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      prisma.productReview.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        reviews,
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

// Get single review
router.get(
  '/:id',
  requirePermission('PRODUCTS', 'READ'),
  [
    param('id').isString().withMessage('Review ID is required'),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const review = await prisma.productReview.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
          },
        },
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Review not found',
      });
    }

    res.json({
      success: true,
      data: review,
    });
  })
);

// Approve review
router.put(
  '/:id/approve',
  requirePermission('PRODUCTS', 'UPDATE'),
  [
    param('id').isString().withMessage('Review ID is required'),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const review = await prisma.productReview.findUnique({
      where: { id },
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Review not found',
      });
    }

    const updatedReview = await prisma.productReview.update({
      where: { id },
      data: { isApproved: true },
      include: {
        product: {
          select: {
            id: true,
            name: true,
          },
        },
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    res.json({
      success: true,
      message: 'Review approved successfully',
      data: updatedReview,
    });
  })
);

// Delete review
router.delete(
  '/:id',
  requirePermission('PRODUCTS', 'DELETE'),
  [
    param('id').isString().withMessage('Review ID is required'),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const review = await prisma.productReview.findUnique({
      where: { id },
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Review not found',
      });
    }

    await prisma.productReview.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Review deleted successfully',
    });
  })
);

// Get reviews for a specific product
router.get(
  '/product/:productId',
  requirePermission('PRODUCTS', 'READ'),
  [
    param('productId').isString().withMessage('Product ID is required'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reviews, total] = await Promise.all([
      prisma.productReview.findMany({
        where: { productId },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.productReview.count({ where: { productId } }),
    ]);

    res.json({
      success: true,
      data: {
        reviews,
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

module.exports = router;
