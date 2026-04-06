const express = require('express');
const prisma = require('../prisma/client');
const { asyncHandler } = require('../middleware/errorHandler');
const { requirePermission, authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get notifications for sales reps and admins
router.get('/', authMiddleware, requirePermission('CUSTOMERS', 'READ'), asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    type,
    priority,
    isRead,
    customerId
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const user = req.user;

  // Build where clause
  const where = {};
  if (type) where.type = type;
  if (priority) where.priority = priority;
  if (isRead !== undefined) where.isRead = isRead === 'true';
  if (customerId) where.customerId = customerId;

  // For sales reps, only show notifications for their assigned customers
  if (user.role === 'SALES_REP') {
    // Get customer IDs assigned to this sales rep
    const assignedCustomers = await prisma.salesRepCustomerAssignment.findMany({
      where: { salesRep: { userId: user.id } },
      select: { customerId: true }
    });

    const assignedCustomerIds = assignedCustomers.map(assignment => assignment.customerId);

    if (assignedCustomerIds.length === 0) {
      // No assigned customers, return empty result
      return res.json({
        success: true,
        data: {
          notifications: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            pages: 0
          }
        }
      });
    }

    // Filter notifications to only include assigned customers
    where.customerId = { in: assignedCustomerIds };
  }

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ],
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            customerType: true
          }
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            status: true
          }
        }
      }
    }),
    prisma.notification.count({ where })
  ]);

  res.json({
    success: true,
    data: {
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    }
  });
}));

// Get unread notification count
router.get('/unread-count', authMiddleware, requirePermission('CUSTOMERS', 'READ'), asyncHandler(async (req, res) => {
  const count = await prisma.notification.count({
    where: { isRead: false }
  });

  res.json({
    success: true,
    data: { count }
  });
}));

// Mark notification as read
router.patch('/:id/read', authMiddleware, requirePermission('CUSTOMERS', 'READ'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const notification = await prisma.notification.update({
    where: { id },
    data: {
      isRead: true,
      readAt: new Date()
    }
  });

  res.json({
    success: true,
    data: notification
  });
}));

// Mark all notifications as read
router.patch('/mark-all-read', authMiddleware, requirePermission('CUSTOMERS', 'READ'), asyncHandler(async (req, res) => {
  const result = await prisma.notification.updateMany({
    where: { isRead: false },
    data: {
      isRead: true,
      readAt: new Date()
    }
  });

  res.json({
    success: true,
    data: { updatedCount: result.count }
  });
}));

// Delete notification
router.delete('/:id', authMiddleware, requirePermission('CUSTOMERS', 'DELETE'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  await prisma.notification.delete({
    where: { id }
  });

  res.json({
    success: true,
    message: 'Notification deleted successfully'
  });
}));

// Get tier upgrade notifications specifically
router.get('/tier-upgrades', authMiddleware, requirePermission('CUSTOMERS', 'READ'), asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const user = req.user;

  // Build where clause
  const where = {
    type: 'TIER_UPGRADE_ELIGIBLE'
  };

  // For sales reps, only show notifications for their assigned customers
  if (user.role === 'SALES_REP') {
    // Get customer IDs assigned to this sales rep
    const assignedCustomers = await prisma.salesRepCustomerAssignment.findMany({
      where: { salesRep: { userId: user.id } },
      select: { customerId: true }
    });

    const assignedCustomerIds = assignedCustomers.map(assignment => assignment.customerId);

    if (assignedCustomerIds.length === 0) {
      // No assigned customers, return empty result
      return res.json({
        success: true,
        data: {
          notifications: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            pages: 0
          }
        }
      });
    }

    // Filter notifications to only include assigned customers
    where.customerId = { in: assignedCustomerIds };
  }

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ],
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            customerType: true
          }
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            status: true
          }
        }
      }
    }),
    prisma.notification.count({
      where
    })
  ]);

  res.json({
    success: true,
    data: {
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    }
  });
}));

module.exports = router;
