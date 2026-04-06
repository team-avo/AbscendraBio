const express = require('express');
const { body, param, query } = require('express-validator');
const prisma = require('../prisma/client');
const validateRequest = require('../middleware/validateRequest');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireRole, requirePermission } = require('../middleware/auth');

const router = express.Router();

// --- Static Routes First (to avoid collision with /:managerId) ---

// Admin: List all sales managers
router.get('/', requireRole(['ADMIN', 'MANAGER']), [
  query('search').optional().isString(),
  validateRequest
], asyncHandler(async (req, res) => {
  const { search } = req.query;
  const managers = await prisma.salesManager.findMany({
    where: (function () {
      if (!search) return {};
      const searchTerms = search.split(/\s+/).filter(Boolean);
      if (searchTerms.length === 0) return {};
      return {
        user: {
          AND: searchTerms.map(term => ({
            OR: [
              { firstName: { contains: term, mode: 'insensitive' } },
              { lastName: { contains: term, mode: 'insensitive' } },
              { email: { contains: term, mode: 'insensitive' } }
            ]
          }))
        }
      };
    })(),
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true } },
      salesReps: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, isActive: true } }
        }
      },
      assignments: {
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, email: true, companyName: true } }
        }
      }
    },
    orderBy: { id: 'desc' }
  });
  res.json({ success: true, data: managers });
}));

// Sales Manager: Get their own assigned sales reps
router.get('/my-team/sales-reps', requireRole(['ADMIN', 'MANAGER', 'SALES_MANAGER']), asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const manager = await prisma.salesManager.findUnique({
    where: { userId },
    include: {
      salesReps: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, isActive: true } },
          assignments: {
            include: {
              customer: { select: { id: true, firstName: true, lastName: true, email: true } }
            }
          }
        }
      }
    }
  });

  if (!manager) {
    return res.status(404).json({ success: false, error: 'Sales manager profile not found' });
  }

  res.json({ success: true, data: manager.salesReps });
}));

// Sales Manager: Get all unassigned sales representatives
router.get('/unassigned-sales-reps', requireRole(['ADMIN', 'SALES_MANAGER']), asyncHandler(async (req, res) => {
  const reps = await prisma.salesRepresentative.findMany({
    where: { salesManagerId: null },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, isActive: true } }
    },
    orderBy: [
      { user: { firstName: 'asc' } },
      { user: { lastName: 'asc' } }
    ]
  });

  res.json({ success: true, data: reps });
}));

// Sales Manager: Recruit an unassigned sales representative
router.post('/recruit-sales-rep', requireRole(['ADMIN', 'SALES_MANAGER']), [
  body('salesRepId').isString().withMessage('salesRepId is required'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { salesRepId } = req.body;
  const userId = req.user.id;

  const manager = await prisma.salesManager.findUnique({
    where: { userId }
  });

  if (!manager) {
    return res.status(404).json({ success: false, error: 'Sales manager profile not found' });
  }

  // Find the rep and ensure they are unassigned
  const rep = await prisma.salesRepresentative.findUnique({
    where: { id: salesRepId }
  });

  if (!rep) {
    return res.status(404).json({ success: false, error: 'Sales representative not found' });
  }

  if (rep.salesManagerId) {
    return res.status(400).json({ success: false, error: 'Sales representative is already assigned to a manager' });
  }

  // Assign to this manager
  const updatedRep = await prisma.salesRepresentative.update({
    where: { id: salesRepId },
    data: { salesManagerId: manager.id },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } }
    }
  });

  res.json({ success: true, message: 'Sales representative recruited successfully', data: updatedRep });
}));

// Sales Manager: Create a new sales representative
router.post('/my-team/sales-reps', requireRole(['ADMIN', 'SALES_MANAGER']), [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 4 }).withMessage('Password must be at least 4 characters long'),
  body('firstName').notEmpty().trim().withMessage('First name is required'),
  body('lastName').notEmpty().trim().withMessage('Last name is required'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName } = req.body;
  const managerUserId = req.user.id;
  const isAdmin = req.user.role === 'ADMIN';

  const manager = await prisma.salesManager.findUnique({
    where: { userId: managerUserId }
  });

  if (!manager && !isAdmin) {
    return res.status(404).json({ success: false, error: 'Sales manager profile not found' });
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    return res.status(409).json({ success: false, error: 'User already exists with this email' });
  }

  const bcrypt = require('bcryptjs');
  const hashedPassword = await bcrypt.hash(password, 12);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: 'SALES_REP',
        isActive: true
      }
    });

    const rep = await tx.salesRepresentative.create({
      data: {
        userId: user.id,
        salesManagerId: manager?.id || null
      }
    });

    // Default permissions for Sales Rep
    const modules = ['ANALYTICS', 'PRODUCTS', 'ORDERS', 'CUSTOMERS'];
    const actions = ['CREATE', 'READ', 'UPDATE', 'DELETE'];
    const permissions = modules.flatMap(module =>
      actions
        .filter(action => !(module === 'CUSTOMERS' && action === 'DELETE'))
        .map(action => ({
          userId: user.id,
          module,
          action,
          granted: true
        }))
    );

    await tx.userPermission.createMany({ data: permissions });

    return { user, rep };
  });

  res.status(201).json({ success: true, data: result.rep });
}));

// Sales Manager: Update a sales representative
router.put('/my-team/sales-reps/:repId', requireRole(['ADMIN', 'SALES_MANAGER']), [
  param('repId').isString(),
  body('firstName').optional().notEmpty().trim(),
  body('lastName').optional().notEmpty().trim(),
  body('email').optional().isEmail().normalizeEmail(),
  body('isActive').optional().isBoolean(),
  validateRequest
], asyncHandler(async (req, res) => {
  const { repId } = req.params;
  const { firstName, lastName, email, isActive } = req.body;
  const managerUserId = req.user.id;
  const isAdmin = req.user.role === 'ADMIN';

  const rep = await prisma.salesRepresentative.findUnique({
    where: { id: repId },
    include: { user: true }
  });

  if (!rep) return res.status(404).json({ success: false, error: 'Sales representative not found' });

  if (!isAdmin) {
    const manager = await prisma.salesManager.findUnique({ where: { userId: managerUserId } });
    if (!manager || rep.salesManagerId !== manager.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: rep.userId },
    data: {
      firstName,
      lastName,
      email,
      isActive
    }
  });

  res.json({ success: true, data: updatedUser });
}));

// Sales Manager: Reset password for a sales representative
router.post('/my-team/sales-reps/:repId/reset-password', requireRole(['ADMIN', 'SALES_MANAGER']), [
  param('repId').isString(),
  body('newPassword').isLength({ min: 4 }).withMessage('Password must be at least 4 characters long'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { repId } = req.params;
  const { newPassword } = req.body;
  const managerUserId = req.user.id;
  const isAdmin = req.user.role === 'ADMIN';

  const rep = await prisma.salesRepresentative.findUnique({
    where: { id: repId }
  });

  if (!rep) return res.status(404).json({ success: false, error: 'Sales representative not found' });

  if (!isAdmin) {
    const manager = await prisma.salesManager.findUnique({ where: { userId: managerUserId } });
    if (!manager || rep.salesManagerId !== manager.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
  }

  const bcrypt = require('bcryptjs');
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: rep.userId },
    data: { password: hashedPassword }
  });

  res.json({ success: true, message: 'Password reset successfully' });
}));

// Sales Manager: Send reset password link to a sales representative
router.post('/my-team/sales-reps/:repId/send-reset-link', requireRole(['ADMIN', 'SALES_MANAGER']), [
  param('repId').isString(),
  validateRequest
], asyncHandler(async (req, res) => {
  const { repId } = req.params;
  const managerUserId = req.user.id;
  const isAdmin = req.user.role === 'ADMIN';

  const rep = await prisma.salesRepresentative.findUnique({
    where: { id: repId },
    include: { user: true }
  });

  if (!rep) return res.status(404).json({ success: false, error: 'Sales representative not found' });

  if (!isAdmin) {
    const manager = await prisma.salesManager.findUnique({ where: { userId: managerUserId } });
    if (!manager || rep.salesManagerId !== manager.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
  }

  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ userId: rep.userId }, process.env.JWT_SECRET, { expiresIn: '365d' });

  try {
    const { sendPasswordResetEmail } = require('../utils/emailService');
    await sendPasswordResetEmail(rep.user, token);
    res.json({ success: true, message: 'Reset email sent successfully' });
  } catch (error) {
    console.error('Failed to send reset email:', error);
    res.status(500).json({ success: false, error: 'Failed to send reset email' });
  }
}));

// Sales Manager: Delete a sales representative
router.delete('/my-team/sales-reps/:repId', requireRole(['ADMIN', 'SALES_MANAGER']), [
  param('repId').isString(),
  validateRequest
], asyncHandler(async (req, res) => {
  const { repId } = req.params;
  const managerUserId = req.user.id;
  const isAdmin = req.user.role === 'ADMIN';

  const rep = await prisma.salesRepresentative.findUnique({
    where: { id: repId }
  });

  if (!rep) return res.status(404).json({ success: false, error: 'Sales representative not found' });

  if (!isAdmin) {
    const manager = await prisma.salesManager.findUnique({ where: { userId: managerUserId } });
    if (!manager || rep.salesManagerId !== manager.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
  }

  await prisma.$transaction(async (tx) => {
    // Delete assignments
    await tx.salesRepCustomerAssignment.deleteMany({ where: { salesRepId: repId } });
    // Delete profile
    await tx.salesRepresentative.delete({ where: { id: repId } });
    // Delete user permissions
    await tx.userPermission.deleteMany({ where: { userId: rep.userId } });
    // Update orders to remove user reference
    await tx.order.updateMany({ where: { userId: rep.userId }, data: { userId: null } });
    // Delete user
    await tx.user.delete({ where: { id: rep.userId } });
  });

  res.json({ success: true, message: 'Sales representative deleted successfully' });
}));

// Sales Manager: Get all sales reps with assignment status (for reassignment)
router.get('/available/sales-reps', requireRole(['ADMIN', 'MANAGER', 'STAFF', 'SALES_MANAGER']), asyncHandler(async (req, res) => {
  const reps = await prisma.salesRepresentative.findMany({
    select: {
      id: true,
      user: { select: { id: true, firstName: true, lastName: true, email: true, isActive: true } },
      salesManager: {
        select: {
          id: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      }
    },
    orderBy: [
      { user: { firstName: 'asc' } },
      { user: { lastName: 'asc' } },
      { id: 'asc' }
    ]
  });

  res.json({ success: true, data: reps });
}));

// Sales Manager: Get all customers with assignment status for potential assignment
router.get('/assignment-candidates', requireRole(['ADMIN', 'MANAGER', 'SALES_MANAGER']), [
  query('search').optional().isString(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 10000 }).toInt(),
  validateRequest
], asyncHandler(async (req, res) => {
  const { search } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 10000, 10000); // Allow high limit for "no limit" feel
  const skip = (page - 1) * limit;

  const where = {};

  if (search) {
    const searchTerms = search.split(/\s+/).filter(Boolean);
    if (searchTerms.length > 0) {
      where.AND = searchTerms.map(term => ({
        OR: [
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
          { companyName: { contains: term, mode: 'insensitive' } }
        ]
      }));
    }
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        companyName: true,
        customerType: true,
        isActive: true,
        isApproved: true,
        createdAt: true,
        salesManagerAssignments: {
          include: {
            salesManager: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true
                  }
                }
              }
            }
          }
        },
        salesAssignments: {
          include: {
            salesRep: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.customer.count({ where })
  ]);

  res.json({
    success: true,
    data: customers,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
}));

// Sales Manager: Assign customer to themselves
router.post('/assign-customer', requireRole(['ADMIN', 'MANAGER', 'SALES_MANAGER']), [
  body('customerId').isString().withMessage('customerId is required'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { customerId } = req.body;
  const userId = req.user.id;

  const manager = await prisma.salesManager.findUnique({
    where: { userId }
  });

  if (!manager) {
    return res.status(404).json({ success: false, error: 'Sales manager profile not found' });
  }

  // Check if customer exists and include salesAssignments to check rep teams
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      salesAssignments: {
        include: {
          salesRep: true
        }
      }
    }
  });

  if (!customer) {
    return res.status(404).json({ success: false, error: 'Customer not found' });
  }

  // Check if already assigned to THIS manager
  const existingAssignment = await prisma.salesManagerCustomerAssignment.findUnique({
    where: {
      salesManagerId_customerId: {
        salesManagerId: manager.id,
        customerId
      }
    }
  });

  if (existingAssignment) {
    return res.status(400).json({ success: false, error: 'Customer already assigned to you' });
  }

  await prisma.$transaction(async (tx) => {
    // 1. Handle Sales Rep Assignments: 
    // if the sales rep linked to the customer is not in the sales managers team, remove it
    for (const assignment of customer.salesAssignments || []) {
      if (assignment.salesRep.salesManagerId !== manager.id) {
        await tx.salesRepCustomerAssignment.delete({
          where: { id: assignment.id }
        });
      }
    }

    // 2. Ensure customer is not assigned to any other manager (reassigning to self)
    // This removes the link to the "old" manager as requested
    await tx.salesManagerCustomerAssignment.deleteMany({
      where: { customerId }
    });

    // 3. Create new assignment for the current manager
    await tx.salesManagerCustomerAssignment.create({
      data: {
        salesManagerId: manager.id,
        customerId
      }
    });
  });

  res.json({ success: true, message: 'Customer assigned successfully' });
}));

// --- Parametric / Admin Action Routes ---

// Admin: Create or upsert a sales manager for a userId
router.post('/', requireRole(['ADMIN']), [
  body('userId').isString().withMessage('userId is required'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { userId } = req.body;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  // Ensure role is SALES_MANAGER
  if (user.role !== 'SALES_MANAGER') {
    await prisma.user.update({ where: { id: userId }, data: { role: 'SALES_MANAGER' } });
  }

  const manager = await prisma.salesManager.upsert({
    where: { userId },
    update: {},
    create: { userId }
  });
  res.status(201).json({ success: true, data: manager });
}));

// Admin: Get a specific sales manager with details
router.get('/:managerId', requireRole(['ADMIN', 'MANAGER']), [
  param('managerId').isString(),
  validateRequest
], asyncHandler(async (req, res) => {
  const { managerId } = req.params;
  const manager = await prisma.salesManager.findUnique({
    where: { id: managerId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true } },
      assignments: {
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, email: true, companyName: true } }
        }
      },
      salesReps: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, isActive: true } },
          assignments: { include: { customer: { select: { id: true, firstName: true, lastName: true, email: true, companyName: true } } } }
        }
      }
    }
  });

  if (!manager) {
    return res.status(404).json({ success: false, error: 'Sales manager not found' });
  }

  res.json({ success: true, data: manager });
}));

// Admin: Assign sales reps to a sales manager
router.put('/:managerId/sales-reps', requireRole(['ADMIN']), [
  param('managerId').isString(),
  body('salesRepIds').isArray({ min: 0 }).withMessage('salesRepIds must be array'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { managerId } = req.params;
  const { salesRepIds } = req.body;

  const manager = await prisma.salesManager.findUnique({ where: { id: managerId } });
  if (!manager) return res.status(404).json({ success: false, error: 'Sales manager not found' });

  await prisma.$transaction(async (tx) => {
    await tx.salesRepresentative.updateMany({
      where: { salesManagerId: managerId },
      data: { salesManagerId: null }
    });

    if (salesRepIds && salesRepIds.length > 0) {
      await tx.salesRepresentative.updateMany({
        where: { id: { in: salesRepIds } },
        data: { salesManagerId: managerId }
      });
    }
  });

  const updated = await prisma.salesManager.findUnique({
    where: { id: managerId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      salesReps: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } }
        }
      },
      assignments: {
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, email: true, companyName: true } }
        }
      }
    }
  });
  res.json({ success: true, data: updated });
}));

// Admin: Assign customers to sales manager
router.put('/:managerId/assignments', requireRole(['ADMIN']), [
  param('managerId').isString(),
  body('customerIds').isArray({ min: 0 }).withMessage('customerIds must be array'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { managerId } = req.params;
  const { customerIds } = req.body;

  const manager = await prisma.salesManager.findUnique({ where: { id: managerId } });
  if (!manager) return res.status(404).json({ success: false, error: 'Sales manager not found' });

  await prisma.$transaction(async (tx) => {
    // 1. Remove all existing assignments for the target manager (clearing their list to be replaced)
    await tx.salesManagerCustomerAssignment.deleteMany({ where: { salesManagerId: managerId } });

    if (customerIds && customerIds.length > 0) {
      // 2. Ensure the customers being assigned are NOT assigned to anyone else (steal them)
      // Delete ANY entries involving these customers
      await tx.salesManagerCustomerAssignment.deleteMany({
        where: {
          customerId: { in: customerIds }
        }
      });

      // 3. Create the new assignments
      await tx.salesManagerCustomerAssignment.createMany({
        data: customerIds.map((cid) => ({ salesManagerId: managerId, customerId: cid }))
      });
    }
  });

  const updated = await prisma.salesManager.findUnique({
    where: { id: managerId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true } },
      assignments: {
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, email: true, companyName: true } }
        }
      },
      salesReps: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, isActive: true } }
        }
      }
    }
  });

  res.json({ success: true, data: updated, message: 'Assignments updated successfully' });
}));

// Admin: Delete a sales manager
router.delete('/:managerId', requireRole(['ADMIN']), [
  param('managerId').isString(),
  validateRequest
], asyncHandler(async (req, res) => {
  const { managerId } = req.params;

  const manager = await prisma.salesManager.findUnique({ where: { id: managerId } });
  if (!manager) return res.status(404).json({ success: false, error: 'Sales manager not found' });

  await prisma.$transaction(async (tx) => {
    await tx.salesRepresentative.updateMany({
      where: { salesManagerId: managerId },
      data: { salesManagerId: null }
    });

    await tx.salesManager.delete({ where: { id: managerId } });

    await tx.user.update({
      where: { id: manager.userId },
      data: { role: 'STAFF' }
    });
  });

  res.json({ success: true, message: 'Sales manager deleted successfully' });
}));

module.exports = router;
