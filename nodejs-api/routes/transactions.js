const express = require('express');
const { body, param, query } = require('express-validator');
const prisma = require('../prisma/client');
const validateRequest = require('../middleware/validateRequest');
const { asyncHandler } = require('../middleware/errorHandler');
const { authMiddleware, requirePermission } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// List/filter transactions
router.get(
  '/',
  authMiddleware,
  requirePermission('PAYMENTS', 'READ'),
  [
    query('orderId').optional().isString(),
    query('paymentStatus').optional().isString(),
    query('paymentGatewayName').optional().isString(),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('search').optional().isString(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { orderId, paymentStatus, paymentGatewayName, page = 1, limit = 20, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (orderId) where.orderId = orderId;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (paymentGatewayName) where.paymentGatewayName = paymentGatewayName;

    // Add search functionality
    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { orderId: { contains: search, mode: 'insensitive' } },
        { paymentGatewayTransactionId: { contains: search, mode: 'insensitive' } },
        { order: { customer: { firstName: { contains: search, mode: 'insensitive' } } } },
        { order: { customer: { lastName: { contains: search, mode: 'insensitive' } } } },
        { order: { customer: { email: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const [transactions, total, statsAgg] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            include: {
              customer: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
      prisma.transaction.count({ where }),
      prisma.transaction.groupBy({
        by: ['paymentStatus'],
        where: {
          ...where,
          paymentStatus: undefined // We want breakdown regardless of status filter
        },
        _sum: { amount: true },
        _count: { id: true }
      })
    ]);

    // Calculate derived stats
    const statsBreakdown = statsAgg.reduce((acc, curr) => {
      acc[curr.paymentStatus] = {
        count: curr._count.id,
        amount: parseFloat(curr._sum.amount || 0)
      };
      return acc;
    }, {});

    const totalRevenue = statsBreakdown['COMPLETED']?.amount || 0;
    const pendingAmount = statsBreakdown['PENDING']?.amount || 0;
    const failedCount = statsBreakdown['FAILED']?.count || 0;
    const completedCount = statsBreakdown['COMPLETED']?.count || 0;
    const totalProcessed = completedCount + failedCount;
    const successRate = totalProcessed > 0 ? (completedCount / totalProcessed) * 100 : 0;

    res.json({
      success: true,
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      stats: {
        totalRevenue,
        pendingAmount,
        failedCount,
        successRate
      }
    });
  })
);

// Get transaction details
router.get(
  '/:id',
  authMiddleware,
  requirePermission('PAYMENTS', 'READ'),
  [param('id').isString(), validateRequest],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            items: {
              include: {
                variant: {
                  include: {
                    product: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    res.json({ success: true, data: transaction });
  })
);

// Create a new transaction (manual/direct or future gateway)
router.post(
  '/',
  authMiddleware,
  requirePermission('PAYMENTS', 'CREATE'),
  [
    body('orderId').isString().withMessage('Order ID is required'),
    body('amount').isDecimal({ decimal_digits: '0,2' }).withMessage('Amount is required and must be a valid decimal'),
    body('paymentStatus').isIn(['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED']).withMessage('Invalid payment status'),
    body('paymentGatewayName').isIn(['AUTHORIZE_NET', 'MANUAL', 'OTHER']).withMessage('Invalid payment gateway name'),
    body('paymentGatewayTransactionId').optional().isString(),
    body('paymentGatewayResponse').optional().isString(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const {
      orderId,
      amount,
      paymentStatus,
      paymentGatewayName,
      paymentGatewayTransactionId,
      paymentGatewayResponse
    } = req.body;

    // Validate order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        transactions: true,
      }
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Calculate total paid amount
    const totalPaid = order.transactions
      .filter(t => t.paymentStatus === 'COMPLETED')
      .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

    const newAmount = parseFloat(amount);
    const orderTotal = parseFloat(order.totalAmount.toString());

    // Check for overpayment
    if (totalPaid + newAmount > orderTotal) {
      return res.status(400).json({
        success: false,
        error: `Payment amount would exceed order total. Order total: $${orderTotal.toFixed(2)}, Already paid: $${totalPaid.toFixed(2)}, Remaining: $${(orderTotal - totalPaid).toFixed(2)}`
      });
    }

    // Create transaction
    const transaction = await prisma.transaction.create({
      data: {
        orderId,
        amount: newAmount,
        paymentStatus,
        paymentGatewayName,
        paymentGatewayTransactionId,
        paymentGatewayResponse,
      },
      include: {
        order: {
          include: {
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Create/update corresponding Payment record for UI consistency
    try {
      const paymentMethod = paymentGatewayName === 'AUTHORIZE_NET'
        ? 'CREDIT_CARD'
        : paymentGatewayName === 'MANUAL'
          ? 'BANK_TRANSFER'
          : 'STRIPE';
      await prisma.payment.create({
        data: {
          orderId,
          paymentMethod,
          provider: paymentGatewayName === 'AUTHORIZE_NET' ? 'authorize.net' : (paymentGatewayName === 'MANUAL' ? 'manual' : 'other'),
          transactionId: transaction.id, // link payment to our internal transaction id
          amount: newAmount,
          currency: 'USD',
          status: paymentStatus,
          paidAt: paymentStatus === 'COMPLETED' ? new Date() : null,
        }
      });

      // If completed, send PAYMENT_SUCCESS email to customer
      if (paymentStatus === 'COMPLETED') {
        try {
          const orderWithCustomer = await prisma.order.findUnique({
            where: { id: orderId },
            include: { customer: true }
          });
          if (orderWithCustomer?.customer?.email) {
            const { sendPaymentSuccess } = require('../utils/emailService');
            const methodLabel = paymentGatewayName === 'MANUAL' ? 'Manual' : (paymentGatewayName || 'Card');
            await sendPaymentSuccess(orderWithCustomer, orderWithCustomer.customer, newAmount, methodLabel);
          }
        } catch (mailErr) {
          if (process.env.NODE_ENV !== 'production') {
            logger.warn('[Transactions] Failed to send payment success email', { message: mailErr?.message });
          }
        }
      }
    } catch (e) {
      // Non-fatal if payment row already exists or creation fails
      if (process.env.NODE_ENV !== 'production') {
        logger.warn('[Transactions] Failed to create payment record for transaction', { transactionId: transaction.id, error: e.message });
      }
    }

    // Update order status to PROCESSING if fully paid and still PENDING
    const newTotalPaid = totalPaid + (paymentStatus === 'COMPLETED' ? newAmount : 0);
    if (newTotalPaid >= orderTotal && paymentStatus === 'COMPLETED' && order.status === 'PENDING') {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'PROCESSING' }
      });
    }

    res.status(201).json({ success: true, data: transaction });
  })
);

// Update transaction status
router.put(
  '/:id',
  authMiddleware,
  requirePermission('PAYMENTS', 'UPDATE'),
  [
    param('id').isString().withMessage('Transaction ID is required'),
    body('paymentStatus').optional().isIn(['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED']).withMessage('Invalid payment status'),
    body('paymentGatewayTransactionId').optional().isString(),
    body('paymentGatewayResponse').optional().isString(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { paymentStatus, paymentGatewayTransactionId, paymentGatewayResponse } = req.body;

    const updateData = {};
    if (paymentStatus !== undefined) updateData.paymentStatus = paymentStatus;
    if (paymentGatewayTransactionId !== undefined) updateData.paymentGatewayTransactionId = paymentGatewayTransactionId;
    if (paymentGatewayResponse !== undefined) updateData.paymentGatewayResponse = paymentGatewayResponse;

    const transaction = await prisma.transaction.update({
      where: { id },
      data: updateData,
      include: {
        order: {
          include: {
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            transactions: true,
          },
        },
      },
    });

    // Update order payment status if needed
    if (paymentStatus) {
      // Sync ALL corresponding Payment rows for this order
      try {
        logger.info('[Transactions] Syncing payments for transaction', { transactionId: transaction.id, orderId: transaction.orderId });

        // Get all payments for this order
        const allPaymentsForOrder = await prisma.payment.findMany({
          where: { orderId: transaction.orderId }
        });
        logger.debug('[Transactions] Found payments for order', {
          count: allPaymentsForOrder.length,
          payments: allPaymentsForOrder.map(p => ({ id: p.id, status: p.status }))
        });

        // Update ALL payments with FAILED or PENDING status to the new status
        const updateResult = await prisma.payment.updateMany({
          where: {
            orderId: transaction.orderId,
            status: { in: ['FAILED', 'PENDING'] }
          },
          data: {
            status: paymentStatus,
            paidAt: paymentStatus === 'COMPLETED' ? new Date() : undefined
          }
        });

        logger.info(`[Transactions] Updated ${updateResult.count} payment(s) for order ${transaction.orderId} to status ${paymentStatus}`);
      } catch (e) {
        logger.error('[Transactions] Failed to sync payment status for transaction', { transactionId: transaction.id, error: e });
      }

      const order = transaction.order;
      const totalPaid = order.transactions
        .filter(t => t.paymentStatus === 'COMPLETED')
        .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

      const orderTotal = parseFloat(order.totalAmount.toString());

      if (totalPaid >= orderTotal) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            // If fully paid and currently PENDING, move to PROCESSING
            ...(order.status === 'PENDING' ? { status: 'PROCESSING' } : {})
          }
        });
      }


      // If a MANUAL payment is marked COMPLETED by admin, send payment success, then order confirmation
      if (paymentStatus === 'COMPLETED' && transaction.paymentGatewayName === 'MANUAL') {
        try {
          const freshOrder = await prisma.order.findUnique({
            where: { id: order.id },
            include: {
              customer: true,
              items: { include: { variant: { include: { product: true } } } },
            }
          });
          if (freshOrder?.customer?.email) {
            const { sendPaymentSuccess, sendOrderConfirmation } = require('../utils/emailService');
            await sendPaymentSuccess(freshOrder, freshOrder.customer, transaction.amount, 'Manual');
            await sendOrderConfirmation(freshOrder, freshOrder.customer);
          }
        } catch (mailErr) {
          logger.error('[Transactions] Failed to send manual payment/order confirmation emails', mailErr);
        }
      }
    }

    res.json({ success: true, data: transaction });
  })
);

// Delete transaction
router.delete(
  '/:id',
  authMiddleware,
  requirePermission('PAYMENTS', 'DELETE'),
  [param('id').isString().withMessage('Transaction ID is required'), validateRequest],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: { order: true }
    });

    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    await prisma.transaction.delete({
      where: { id }
    });

    // Recalculate order payment status
    const remainingTransactions = await prisma.transaction.findMany({
      where: { orderId: transaction.orderId }
    });

    const totalPaid = remainingTransactions
      .filter(t => t.paymentStatus === 'COMPLETED')
      .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

    const orderTotal = parseFloat(transaction.order.totalAmount.toString());

    let newStatus = transaction.order.status;

    // If fully paid, ensure status is at least PROCESSING
    if (totalPaid >= orderTotal) {
      if (newStatus === 'PENDING') {
        newStatus = 'PROCESSING';
      }
    } else {
      // If not fully paid, revert PROCESSING to PENDING
      // (Don't touch SHIPPED, DELIVERED, etc.)
      if (newStatus === 'PROCESSING') {
        newStatus = 'PENDING';
      }
    }

    if (newStatus !== transaction.order.status) {
      await prisma.order.update({
        where: { id: transaction.orderId },
        data: { status: newStatus }
      });
    }

    res.json({ success: true, message: 'Transaction deleted successfully' });
  })
);

// Email all transactions report
router.post(
  '/email-report',
  authMiddleware,
  requirePermission('PAYMENTS', 'READ'),
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('orderId').optional().isString(),
    body('paymentStatus').optional().isString(),
    body('paymentGatewayName').optional().isString(),
    body('search').optional().isString(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { email, orderId, paymentStatus, paymentGatewayName, search } = req.body;

    const { queueReport } = require('../services/reportQueue');
    await queueReport({
      type: 'TRANSACTIONS',
      email,
      filters: { orderId, paymentStatus, paymentGatewayName, search },
      user: { id: req.user.id, role: req.user.role }
    });

    res.json({
      success: true,
      message: 'Transactions report generation queued. It will be sent to your email shortly.',
    });
  })
);

module.exports = router;
