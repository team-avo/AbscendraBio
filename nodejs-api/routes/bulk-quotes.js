const express = require('express');
const prisma = require('../prisma/client');
const { authMiddleware, requireRole } = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');
const { body, param, query } = require('express-validator');
const { sendEmailWithTemplate } = require('../utils/emailService');
const logger = require('../utils/logger');

const router = express.Router();

// Get all bulk quotes with filtering and pagination
// Note: CUSTOMER can read only their own bulk quotes
router.get('/', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'SALES_REP', 'CUSTOMER']), [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('isRead').optional().isBoolean().toBoolean(),
  query('customerId').optional().isString(),
  query('productId').optional().isString(),
  query('search').optional().isString(),
  validateRequest
], async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      isRead,
      customerId,
      productId,
      search
    } = req.query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where = {};

    if (isRead !== undefined) {
      where.isRead = isRead;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (productId) {
      where.productId = productId;
    }

    // For customers, restrict to their own customerId regardless of query
    if (req.user.role === 'CUSTOMER') {
      if (!req.user.customerId) {
        return res.status(403).json({ error: 'Access denied. Customer profile not linked.' });
      }
      where.customerId = req.user.customerId;
    }

    // For sales reps, only show their assigned customers
    if (req.user.role === 'SALES_REP') {
      const salesRep = await prisma.salesRepresentative.findUnique({
        where: { userId: req.user.id },
        include: { assignments: { select: { customerId: true } } }
      });

      if (!salesRep) {
        return res.status(403).json({ error: 'Sales representative not found' });
      }

      const assignedCustomerIds = salesRep.assignments.map(a => a.customerId);
      where.customerId = { in: assignedCustomerIds };
    }

    // Search functionality
    if (search) {
      where.OR = [
        { customer: { firstName: { contains: search, mode: 'insensitive' } } },
        { customer: { lastName: { contains: search, mode: 'insensitive' } } },
        { customer: { email: { contains: search, mode: 'insensitive' } } },
        { product: { name: { contains: search, mode: 'insensitive' } } },
        { notes: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [bulkQuotes, total] = await Promise.all([
      prisma.bulkQuote.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              images: { take: 1, select: { url: true } }
            }
          },
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              mobile: true,
              customerType: true
            }
          },
          reader: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.bulkQuote.count({ where })
    ]);

    res.json({
      data: bulkQuotes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching bulk quotes', error);
    res.status(500).json({ error: 'Failed to fetch bulk quotes' });
  }
});

// Get single bulk quote by ID
// Note: CUSTOMER can read a quote only if it belongs to them
router.get('/:id', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'SALES_REP', 'CUSTOMER']), [
  param('id').isString(),
  validateRequest
], async (req, res) => {
  try {
    const { id } = req.params;

    const bulkQuote = await prisma.bulkQuote.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            description: true,
            images: { select: { url: true, altText: true } }
          }
        },
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            mobile: true,
            customerType: true,
            addresses: {
              where: { isDefault: true },
              select: {
                address1: true,
                city: true,
                state: true,
                postalCode: true,
                country: true
              }
            }
          }
        },
        reader: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!bulkQuote) {
      return res.status(404).json({ error: 'Bulk quote not found' });
    }

    // For customers, ensure ownership
    if (req.user.role === 'CUSTOMER') {
      if (!req.user.customerId || req.user.customerId !== bulkQuote.customerId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // For sales reps, check if they have access to this customer
    if (req.user.role === 'SALES_REP') {
      const salesRep = await prisma.salesRepresentative.findUnique({
        where: { userId: req.user.id },
        include: { assignments: { select: { customerId: true } } }
      });

      if (!salesRep || !salesRep.assignments.some(a => a.customerId === bulkQuote.customerId)) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    res.json(bulkQuote);
  } catch (error) {
    logger.error('Error fetching bulk quote', error);
    res.status(500).json({ error: 'Failed to fetch bulk quote' });
  }
});

// Create new bulk quote request
router.post('/', [
  body('productId').isString().notEmpty(),
  body('customerId').isString().notEmpty(),
  body('quantity').isInt({ min: 1 }),
  body('notes').optional().isString(),
  validateRequest
], async (req, res) => {
  try {
    const { productId, customerId, quantity, notes } = req.body;

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, status: true }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (product.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Product is not available for bulk quotes' });
    }

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, firstName: true, lastName: true, email: true }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const bulkQuote = await prisma.bulkQuote.create({
      data: {
        productId,
        customerId,
        quantity,
        notes
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            images: { take: 1, select: { url: true } }
          }
        },
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    res.status(201).json(bulkQuote);
  } catch (error) {
    logger.error('Error creating bulk quote', error);
    res.status(500).json({ error: 'Failed to create bulk quote request' });
  }
});

// Mark bulk quote as read
router.patch('/:id/read', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'SALES_REP']), [
  param('id').isString(),
  validateRequest
], async (req, res) => {
  try {
    const { id } = req.params;

    const bulkQuote = await prisma.bulkQuote.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, email: true } },
        product: { select: { id: true, name: true } }
      }
    });

    if (!bulkQuote) {
      return res.status(404).json({ error: 'Bulk quote not found' });
    }

    // For sales reps, check if they have access to this customer
    if (req.user.role === 'SALES_REP') {
      const salesRep = await prisma.salesRepresentative.findUnique({
        where: { userId: req.user.id },
        include: { assignments: { select: { customerId: true } } }
      });

      if (!salesRep || !salesRep.assignments.some(a => a.customerId === bulkQuote.customerId)) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const updatedBulkQuote = await prisma.bulkQuote.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
        readBy: req.user.id
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            images: { take: 1, select: { url: true } }
          }
        },
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            mobile: true,
            customerType: true
          }
        },
        reader: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Send email notification to customer
    try {
      const emailData = {
        customerName: `${bulkQuote.customer.firstName} ${bulkQuote.customer.lastName}`,
        productName: bulkQuote.product.name,
        quantity: bulkQuote.quantity,
        requestDate: new Date(bulkQuote.createdAt).toLocaleDateString(),
        notes: bulkQuote.notes || '',
        storeName: 'Centre Labs',
        storeEmail: 'contact@centreresearch.com',
        storePhone: '+1 (555) 123-4567',
        storeAddress: '123 Research Ave, Science City, SC 12345'
      };

      await sendEmailWithTemplate('BULK_QUOTE', bulkQuote.customer.email, emailData);
      logger.info(`Bulk quote confirmation email sent to ${bulkQuote.customer.email}`);
    } catch (emailError) {
      logger.error('Failed to send bulk quote confirmation email', emailError);
      // Don't fail the request if email fails
    }

    res.json(updatedBulkQuote);
  } catch (error) {
    logger.error('Error marking bulk quote as read', error);
    res.status(500).json({ error: 'Failed to mark bulk quote as read' });
  }
});

// Mark bulk quote as unread
router.patch('/:id/unread', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'SALES_REP']), [
  param('id').isString(),
  validateRequest
], async (req, res) => {
  try {
    const { id } = req.params;

    const bulkQuote = await prisma.bulkQuote.findUnique({
      where: { id }
    });

    if (!bulkQuote) {
      return res.status(404).json({ error: 'Bulk quote not found' });
    }

    // For sales reps, check if they have access to this customer
    if (req.user.role === 'SALES_REP') {
      const salesRep = await prisma.salesRepresentative.findUnique({
        where: { userId: req.user.id },
        include: { assignments: { select: { customerId: true } } }
      });

      if (!salesRep || !salesRep.assignments.some(a => a.customerId === bulkQuote.customerId)) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const updatedBulkQuote = await prisma.bulkQuote.update({
      where: { id },
      data: {
        isRead: false,
        readAt: null,
        readBy: null
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            images: { take: 1, select: { url: true } }
          }
        },
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            mobile: true,
            customerType: true
          }
        },
        reader: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    res.json(updatedBulkQuote);
  } catch (error) {
    logger.error('Error marking bulk quote as unread', error);
    res.status(500).json({ error: 'Failed to mark bulk quote as unread' });
  }
});

// Delete bulk quote
router.delete('/:id', authMiddleware, requireRole(['ADMIN', 'MANAGER']), [
  param('id').isString(),
  validateRequest
], async (req, res) => {
  try {
    const { id } = req.params;

    const bulkQuote = await prisma.bulkQuote.findUnique({
      where: { id }
    });

    if (!bulkQuote) {
      return res.status(404).json({ error: 'Bulk quote not found' });
    }

    await prisma.bulkQuote.delete({
      where: { id }
    });

    res.json({ message: 'Bulk quote deleted successfully' });
  } catch (error) {
    logger.error('Error deleting bulk quote', error);
    res.status(500).json({ error: 'Failed to delete bulk quote' });
  }
});

module.exports = router;
