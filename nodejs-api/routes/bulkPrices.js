const express = require('express');
const { body, param, query } = require('express-validator');
const prisma = require('../prisma/client');
const validateRequest = require('../middleware/validateRequest');
const { asyncHandler } = require('../middleware/errorHandler');
const { requirePermission } = require('../middleware/auth');

const router = express.Router();

/**
 * Helper function to find applicable bulk price for a given quantity
 * @param {string} variantId - Product variant ID
 * @param {number} quantity - Quantity to check
 * @returns {Promise<object|null>} - Bulk price object or null
 */
async function findApplicableBulkPrice(variantId, quantity) {
    const bulkPrices = await prisma.bulkPrice.findMany({
        where: {
            variantId,
            minQty: { lte: quantity },
            OR: [
                { maxQty: null }, // Unlimited
                { maxQty: { gte: quantity } }
            ]
        },
        orderBy: { minQty: 'desc' } // Get the highest tier that applies
    });

    return bulkPrices.length > 0 ? bulkPrices[0] : null;
}

/**
 * Calculate price for a variant considering bulk pricing
 * @param {string} variantId - Product variant ID
 * @param {number} quantity - Quantity
 * @param {number} regularPrice - Regular unit price
 * @returns {Promise<object>} - { unitPrice, totalPrice, isBulkPrice, bulkPriceId }
 */
async function calculatePriceWithBulk(variantId, quantity, regularPrice) {
    const bulkPrice = await findApplicableBulkPrice(variantId, quantity);

    if (bulkPrice) {
        return {
            unitPrice: parseFloat(bulkPrice.price),
            totalPrice: parseFloat(bulkPrice.price) * quantity,
            isBulkPrice: true,
            bulkPriceId: bulkPrice.id,
            bulkPriceTier: {
                minQty: bulkPrice.minQty,
                maxQty: bulkPrice.maxQty,
                price: parseFloat(bulkPrice.price)
            }
        };
    }

    return {
        unitPrice: parseFloat(regularPrice),
        totalPrice: parseFloat(regularPrice) * quantity,
        isBulkPrice: false,
        bulkPriceId: null,
        bulkPriceTier: null
    };
}

// Get all bulk prices for a variant
router.get('/variant/:variantId', [
    param('variantId').isString().withMessage('Variant ID is required'),
    validateRequest
], asyncHandler(async (req, res) => {
    const { variantId } = req.params;

    const bulkPrices = await prisma.bulkPrice.findMany({
        where: { variantId },
        orderBy: { minQty: 'asc' }
    });

    res.json({
        success: true,
        data: bulkPrices
    });
}));

// Get applicable bulk price for a specific quantity
router.get('/variant/:variantId/applicable', [
    param('variantId').isString().withMessage('Variant ID is required'),
    query('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    validateRequest
], asyncHandler(async (req, res) => {
    const { variantId } = req.params;
    const quantity = parseInt(req.query.quantity);

    const bulkPrice = await findApplicableBulkPrice(variantId, quantity);

    res.json({
        success: true,
        data: bulkPrice
    });
}));

// Create bulk price
router.post('/', requirePermission('PRODUCTS', 'CREATE'), [
    body('variantId').isString().withMessage('Variant ID is required'),
    body('minQty').isInt({ min: 1 }).withMessage('Minimum quantity must be at least 1'),
    body('maxQty').optional().isInt({ min: 1 }).withMessage('Maximum quantity must be at least 1'),
    body('price').isDecimal().withMessage('Price must be a valid decimal'),
    validateRequest
], asyncHandler(async (req, res) => {
    const { variantId, minQty, maxQty, price } = req.body;

    // Validate that minQty < maxQty if maxQty is provided
    if (maxQty && minQty >= maxQty) {
        return res.status(400).json({
            success: false,
            error: 'Minimum quantity must be less than maximum quantity'
        });
    }

    // Check if variant exists
    const variant = await prisma.productVariant.findUnique({
        where: { id: variantId }
    });

    if (!variant) {
        return res.status(404).json({
            success: false,
            error: 'Product variant not found'
        });
    }

    // Check for overlapping ranges
    const overlapping = await prisma.bulkPrice.findFirst({
        where: {
            variantId,
            OR: [
                // New range starts within existing range
                {
                    minQty: { lte: minQty },
                    OR: [
                        { maxQty: null },
                        { maxQty: { gte: minQty } }
                    ]
                },
                // New range ends within existing range
                maxQty ? {
                    minQty: { lte: maxQty },
                    OR: [
                        { maxQty: null },
                        { maxQty: { gte: maxQty } }
                    ]
                } : {},
                // New range encompasses existing range
                {
                    minQty: { gte: minQty },
                    ...(maxQty ? { maxQty: { lte: maxQty } } : {})
                }
            ].filter(condition => Object.keys(condition).length > 0)
        }
    });

    if (overlapping) {
        return res.status(400).json({
            success: false,
            error: 'Bulk price range overlaps with existing range'
        });
    }

    const bulkPrice = await prisma.bulkPrice.create({
        data: {
            variantId,
            minQty,
            maxQty: maxQty || null,
            price
        }
    });

    res.status(201).json({
        success: true,
        message: 'Bulk price created successfully',
        data: bulkPrice
    });
}));

// Update bulk price
router.put('/:id', requirePermission('PRODUCTS', 'UPDATE'), [
    param('id').isString().withMessage('Bulk price ID is required'),
    body('minQty').optional().isInt({ min: 1 }).withMessage('Minimum quantity must be at least 1'),
    body('maxQty').optional().isInt({ min: 1 }).withMessage('Maximum quantity must be at least 1'),
    body('price').optional().isDecimal().withMessage('Price must be a valid decimal'),
    validateRequest
], asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { minQty, maxQty, price } = req.body;

    const existingBulkPrice = await prisma.bulkPrice.findUnique({
        where: { id }
    });

    if (!existingBulkPrice) {
        return res.status(404).json({
            success: false,
            error: 'Bulk price not found'
        });
    }

    const updateData = {};
    if (minQty !== undefined) updateData.minQty = minQty;
    if (maxQty !== undefined) updateData.maxQty = maxQty || null;
    if (price !== undefined) updateData.price = price;

    // Validate minQty < maxQty
    const finalMinQty = minQty !== undefined ? minQty : existingBulkPrice.minQty;
    const finalMaxQty = maxQty !== undefined ? (maxQty || null) : existingBulkPrice.maxQty;

    if (finalMaxQty && finalMinQty >= finalMaxQty) {
        return res.status(400).json({
            success: false,
            error: 'Minimum quantity must be less than maximum quantity'
        });
    }

    const bulkPrice = await prisma.bulkPrice.update({
        where: { id },
        data: updateData
    });

    res.json({
        success: true,
        message: 'Bulk price updated successfully',
        data: bulkPrice
    });
}));

// Delete bulk price
router.delete('/:id', requirePermission('PRODUCTS', 'DELETE'), [
    param('id').isString().withMessage('Bulk price ID is required'),
    validateRequest
], asyncHandler(async (req, res) => {
    const { id } = req.params;

    const existingBulkPrice = await prisma.bulkPrice.findUnique({
        where: { id }
    });

    if (!existingBulkPrice) {
        return res.status(404).json({
            success: false,
            error: 'Bulk price not found'
        });
    }

    await prisma.bulkPrice.delete({
        where: { id }
    });

    res.json({
        success: true,
        message: 'Bulk price deleted successfully'
    });
}));

// Export helper functions for use in other routes
module.exports = router;
module.exports.findApplicableBulkPrice = findApplicableBulkPrice;
module.exports.calculatePriceWithBulk = calculatePriceWithBulk;
