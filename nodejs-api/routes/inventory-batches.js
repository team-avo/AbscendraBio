const express = require('express');
const { body, param, query } = require('express-validator');
const prisma = require('../prisma/client');
const validateRequest = require('../middleware/validateRequest');
const { asyncHandler } = require('../middleware/errorHandler');
const { requirePermission } = require('../middleware/auth');

const router = express.Router();

// Get expiring batches (must be before /:id route)
router.get(
  '/expiring',
  requirePermission('INVENTORY', 'READ'),
  [
    query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365'),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days) || 30; // Default to 30 days
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    try {
      const expiringBatches = await prisma.inventoryBatch.findMany({
        where: {
          expiryDate: {
            lte: futureDate,
            gte: new Date(), // Only future dates, not already expired
          },
        },
        include: {
          inventory: {
            include: {
              variant: {
                include: {
                  product: {
                    select: { name: true, status: true },
                  },
                },
              },
              location: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { expiryDate: 'asc' },
      });

      res.json({ success: true, data: expiringBatches || [] });
    } catch (error) {
      console.error('Error fetching expiring batches:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch expiring batches',
        data: []
      });
    }
  })
);

// Get expired batches (must be before /:id route)
router.get(
  '/expired',
  requirePermission('INVENTORY', 'READ'),
  asyncHandler(async (req, res) => {
    try {
      const expiredBatches = await prisma.inventoryBatch.findMany({
        where: {
          expiryDate: {
            lt: new Date(),
          },
        },
        include: {
          inventory: {
            include: {
              variant: {
                include: {
                  product: {
                    select: { name: true, status: true },
                  },
                },
              },
              location: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { expiryDate: 'desc' },
      });

      res.json({ success: true, data: expiredBatches || [] });
    } catch (error) {
      console.error('Error fetching expired batches:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch expired batches',
        data: []
      });
    }
  })
);

// List all batches for an inventory record
router.get(
  '/',
  requirePermission('INVENTORY', 'READ'),
  [query('inventoryId').isString().withMessage('inventoryId is required'), validateRequest],
  asyncHandler(async (req, res) => {
    const { inventoryId } = req.query;
    const batches = await prisma.inventoryBatch.findMany({
      where: { inventoryId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: batches });
  })
);

// Get a single batch
router.get(
  '/:id',
  requirePermission('INVENTORY', 'READ'),
  [param('id').isString().withMessage('Batch ID is required'), validateRequest],
  asyncHandler(async (req, res) => {
    const batch = await prisma.inventoryBatch.findUnique({ where: { id: req.params.id } });
    if (!batch) return res.status(404).json({ success: false, error: 'Batch not found' });
    res.json({ success: true, data: batch });
  })
);

// Create a new batch
router.post(
  '/',
  requirePermission('INVENTORY', 'CREATE'),
  [
    body('inventoryId').isString().notEmpty().withMessage('inventoryId is required'),
    body('batchNumber').isString().notEmpty().withMessage('Batch number is required'),
    body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
    body('expiryDate').optional().isISO8601().toDate(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { inventoryId, batchNumber, quantity, expiryDate } = req.body;
    const batch = await prisma.inventoryBatch.create({
      data: { inventoryId, batchNumber, quantity, expiryDate },
    });
    res.status(201).json({ success: true, data: batch });
  })
);

// Update a batch
router.put(
  '/:id',
  requirePermission('INVENTORY', 'UPDATE'),
  [
    param('id').isString().withMessage('Batch ID is required'),
    body('batchNumber').optional().isString(),
    body('quantity').optional().isInt({ min: 0 }),
    body('expiryDate').optional().isISO8601().toDate(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { batchNumber, quantity, expiryDate } = req.body;
    const batch = await prisma.inventoryBatch.update({
      where: { id: req.params.id },
      data: { batchNumber, quantity, expiryDate },
    });
    res.json({ success: true, data: batch });
  })
);

// Delete a batch
router.delete(
  '/:id',
  requirePermission('INVENTORY', 'DELETE'),
  [param('id').isString().withMessage('Batch ID is required'), validateRequest],
  asyncHandler(async (req, res) => {
    await prisma.inventoryBatch.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  })
);

module.exports = router;