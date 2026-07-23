const express = require('express');
const bcrypt = require('bcryptjs');
const { body, param, query } = require('express-validator');
const prisma = require('../prisma/client');
const validateRequest = require('../middleware/validateRequest');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireRole, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Get all users with pagination and filters
router.get('/', requireRole(['ADMIN', 'MANAGER']), [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('role').optional().isIn(['ADMIN', 'MANAGER', 'STAFF', 'SALES_REP', 'CUSTOMER']).withMessage('Invalid role'),
  query('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
  query('search').optional().isString().withMessage('Search must be a string'),
  validateRequest
], asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    role,
    isActive,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Build where clause - exclude CUSTOMER users
  const where = {};

  // Always exclude CUSTOMER users unless explicitly filtering for them (which shouldn't happen)
  if (role && role !== 'CUSTOMER') {
    where.role = role;
  } else if (!role) {
    where.role = { not: 'CUSTOMER' };
  }

  if (isActive !== undefined) where.isActive = isActive === 'true';
  if (search) {
    const searchTerms = search.split(/\s+/).filter(Boolean);
    if (searchTerms.length > 0) {
      where.AND = [
        ...(where.AND || []),
        ...searchTerms.map(term => ({
          OR: [
            { firstName: { contains: term, mode: "insensitive" } },
            { lastName: { contains: term, mode: "insensitive" } },
            { email: { contains: term, mode: "insensitive" } },
          ]
        }))
      ];
    }
  }

  // Get users and total count
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            orders: true,
            permissions: true
          }
        }
      }
    }),
    prisma.user.count({ where })
  ]);

  res.json({
    success: true,
    data: {
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    }
  });
}));

// Get user statistics (excluding CUSTOMER role)
router.get('/stats', requireRole(['ADMIN', 'MANAGER']), asyncHandler(async (req, res) => {
  const stats = await Promise.all([
    prisma.user.count({
      where: { role: { not: 'CUSTOMER' } }
    }),
    prisma.user.count({
      where: {
        role: { not: 'CUSTOMER' },
        isActive: true
      }
    }),
    prisma.user.count({
      where: {
        role: { not: 'CUSTOMER' },
        isActive: false
      }
    }),
    prisma.user.count({
      where: {
        role: 'ADMIN'
      }
    })
  ]);

  res.json({
    success: true,
    data: {
      total: stats[0],
      active: stats[1],
      inactive: stats[2],
      admins: stats[3]
    }
  });
}));

// Get user by ID
router.get('/:id', requireRole(['ADMIN', 'MANAGER']), [
  param('id').isString().withMessage('User ID is required'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      permissions: {
        select: {
          id: true,
          module: true,
          action: true,
          granted: true
        }
      },
      _count: {
        select: {
          orders: true,
          orderNotes: true
        }
      }
    }
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  res.json({
    success: true,
    data: user
  });
}));

// Create new user
router.post('/', requireRole(['ADMIN']), [
  body('email')
    .isEmail()
    .normalizeEmail({
      gmail_remove_dots: false,
      gmail_remove_subaddress: false,
      gmail_convert_googlemaildotcom: false,
    })
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 4 })
    .withMessage('Password must be at least 4 characters long')
    .custom((val) => !/\s/.test(val))
    .withMessage('Password cannot contain spaces'),
  body('firstName').notEmpty().trim().withMessage('First name is required'),
  body('lastName').notEmpty().trim().withMessage('Last name is required'),
  body('role').isIn(['ADMIN', 'MANAGER', 'STAFF', 'SALES_REP', 'SALES_MANAGER', 'CUSTOMER']).withMessage('Invalid role'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, role, isActive = true } = req.body;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    return res.status(409).json({
      success: false,
      error: 'User already exists with this email'
    });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role,
      isActive
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });

  // If created as SALES_REP, ensure a sales representative profile exists
  if (user.role === 'SALES_REP') {
    await prisma.salesRepresentative.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id }
    });

    // Default permissions for Sales Rep:
    // - Analytics: grant full CRUD so they can access all analytics tabs
    // - Products/Orders/Customers: grant READ by default
    const analyticsCrud = ['CREATE', 'READ', 'UPDATE', 'DELETE'].map(action => ({
      userId: user.id,
      module: 'ANALYTICS',
      action,
      granted: true
    }));
    const crudModules = ['PRODUCTS', 'ORDERS', 'CUSTOMERS'];
    const crudPerms = crudModules.flatMap(module =>
      ['CREATE', 'READ', 'UPDATE', 'DELETE'].map(action => ({
        userId: user.id,
        module,
        action,
        granted: true
      }))
    );

    // Clean existing to avoid duplicates, then insert
    await prisma.userPermission.deleteMany({
      where: {
        userId: user.id,
        OR: [
          { module: 'ANALYTICS' },
          { module: { in: crudModules } }
        ]
      }
    });
    await prisma.userPermission.createMany({ data: [...analyticsCrud, ...crudPerms] });
  }

  // If created as SALES_MANAGER, ensure a sales manager profile exists
  if (user.role === 'SALES_MANAGER') {
    await prisma.salesManager.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id }
    });
  }

  // Fire-and-forget credentials email to the user
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
    });
    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
    const logoUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/logo.png`;
    const subject = 'Your Ascendra Bio account credentials';
    const html = `
      <body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f6f7fb;">
        <table align="center" cellpadding="0" cellspacing="0" width="600" style="background:#ffffff;margin:24px auto;border:1px solid #eee;border-radius:8px;overflow:hidden">
          <tr><td style="padding:24px 24px 0 24px;text-align:center;background:#ffffff;border-bottom:1px solid #f0f0f0;">
            <img src="${logoUrl}" alt="Ascendra Bio" style="display:inline-block;width:120px;height:auto;margin:0 auto 8px auto;" />
            <h1 style="margin:16px 0 8px 0;color:#111827;font-size:22px;">Welcome to Ascendra Bio</h1>
            <p style="margin:0 0 16px 0;color:#6b7280;font-size:14px;">Hello ${firstName || ''}, your admin user has been created.</p>
          </td></tr>
          <tr><td style="padding:24px;">
            <h3 style="margin:0 0 8px 0;color:#111827;font-size:16px;">Login credentials</h3>
            <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px 0">
              <tr><td style="padding:8px 0;color:#374151;font-size:14px;width:120px;">Email</td><td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;">${email}</td></tr>
              <tr><td style="padding:8px 0;color:#374151;font-size:14px;width:120px;">Password</td><td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;">${password}</td></tr>
            </table>
            <div style="text-align:center;margin-top:16px;">
              <a href="${loginUrl}" style="display:inline-block;padding:12px 20px;background:#111827;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600">Login to your account</a>
            </div>
          </td></tr>
        </table>
      </body>`;
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject,
      html,
    });
  } catch (e) {
    console.error('Failed to send user credentials email:', e);
  }

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: user
  });
}));

// Update user
router.put('/:id', requireRole(['ADMIN']), [
  param('id').isString().withMessage('User ID is required'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail({
      gmail_remove_dots: false,
      gmail_remove_subaddress: false,
      gmail_convert_googlemaildotcom: false,
    })
    .withMessage('Valid email is required'),
  body('firstName').optional().notEmpty().trim().withMessage('First name cannot be empty'),
  body('lastName').optional().notEmpty().trim().withMessage('Last name cannot be empty'),
  body('role').optional().isIn(['ADMIN', 'MANAGER', 'STAFF', 'SALES_REP', 'SALES_MANAGER', 'CUSTOMER']).withMessage('Invalid role'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { email, firstName, lastName, role, isActive } = req.body;

  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { id }
  });

  if (!existingUser) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  // Check if email is already taken by another user
  if (email && email !== existingUser.email) {
    const emailExists = await prisma.user.findUnique({
      where: { email }
    });

    if (emailExists) {
      return res.status(409).json({
        success: false,
        error: 'Email is already taken'
      });
    }
  }

  // Prepare update data
  const updateData = {};
  if (email) updateData.email = email;
  if (firstName) updateData.firstName = firstName;
  if (lastName) updateData.lastName = lastName;
  if (role) updateData.role = role;
  if (isActive !== undefined) updateData.isActive = isActive;

  // Update user
  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });

  // If updated to SALES_REP, ensure profile exists
  if (role === 'SALES_REP') {
    await prisma.salesRepresentative.upsert({
      where: { userId: id },
      update: {},
      create: { userId: id }
    });
  }

  // If updated to SALES_MANAGER, ensure profile exists
  if (role === 'SALES_MANAGER') {
    await prisma.salesManager.upsert({
      where: { userId: id },
      update: {},
      create: { userId: id }
    });
  }

  res.json({
    success: true,
    message: 'User updated successfully',
    data: user
  });
}));

// Deactivate user (soft delete)
router.patch('/:id/deactivate', requireRole(['ADMIN']), [
  param('id').isString().withMessage('User ID is required'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { id }
  });

  if (!existingUser) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  // Cannot deactivate self
  if (id === req.user.id) {
    return res.status(400).json({
      success: false,
      error: 'Cannot deactivate yourself'
    });
  }

  // Soft delete by setting isActive to false
  await prisma.user.update({
    where: { id },
    data: { isActive: false }
  });

  res.json({
    success: true,
    message: 'User deactivated successfully'
  });
}));

// Hard delete user (permanent deletion)
router.delete('/:id', requireRole(['ADMIN']), [
  param('id').isString().withMessage('User ID is required'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { id },
    include: {
      salesRepresentative: true,
      customer: true,
    }
  });

  if (!existingUser) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  // Cannot delete self
  if (id === req.user.id) {
    return res.status(400).json({
      success: false,
      error: 'Cannot delete yourself'
    });
  }

  // Hard delete user and related data in transaction
  await prisma.$transaction(async (tx) => {
    // Delete user permissions
    await tx.userPermission.deleteMany({
      where: { userId: id }
    });

    // Delete audit logs
    await tx.auditLog.deleteMany({
      where: { userId: id }
    });

    // Delete email verification tokens
    await tx.emailVerificationToken.deleteMany({
      where: { userId: id }
    });

    // Delete sales representative profile if exists
    if (existingUser.salesRepresentative) {
      // Delete sales rep assignments first
      await tx.salesRepCustomerAssignment.deleteMany({
        where: { salesRepId: existingUser.salesRepresentative.id }
      });
      // Delete sales rep profile
      await tx.salesRepresentative.delete({
        where: { id: existingUser.salesRepresentative.id }
      });
    }

    // Delete order notes
    await tx.orderNote.deleteMany({
      where: { userId: id }
    });

    // Note: Orders are kept but user reference will be null
    await tx.order.updateMany({
      where: { userId: id },
      data: { userId: null }
    });

    // Finally delete the user
    await tx.user.delete({
      where: { id }
    });
  });

  res.json({
    success: true,
    message: 'User permanently deleted successfully'
  });
}));

// Reset user password
router.post('/:id/reset-password', requireRole(['ADMIN']), [
  param('id').isString().withMessage('User ID is required'),
  body('newPassword')
    .isLength({ min: 4 })
    .withMessage('New password must be at least 4 characters long')
    .custom((val) => !/\s/.test(val))
    .withMessage('New password cannot contain spaces'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { id }
  });

  if (!existingUser) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  // Update password
  await prisma.user.update({
    where: { id },
    data: { password: hashedPassword }
  });

  res.json({
    success: true,
    message: 'Password reset successfully'
  });
}));

// Manage user permissions
router.put('/:id/permissions', requireRole(['ADMIN']), [
  param('id').isString().withMessage('User ID is required'),
  body('permissions').isArray().withMessage('Permissions must be an array'),
  body('permissions.*.module').notEmpty().withMessage('Module is required'),
  body('permissions.*.action').isIn(['CREATE', 'READ', 'UPDATE', 'DELETE']).withMessage('Invalid action'),
  body('permissions.*.granted').isBoolean().withMessage('Granted must be boolean'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { permissions } = req.body;

  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { id }
  });

  if (!existingUser) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  // Delete existing permissions
  await prisma.userPermission.deleteMany({
    where: { userId: id }
  });

  // Create new permissions
  const permissionData = permissions.map(perm => ({
    userId: id,
    module: perm.module,
    action: perm.action,
    granted: perm.granted
  }));

  await prisma.userPermission.createMany({
    data: permissionData
  });

  // Get updated user with permissions
  const updatedUser = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      permissions: {
        select: {
          id: true,
          module: true,
          action: true,
          granted: true
        }
      }
    }
  });

  res.json({
    success: true,
    message: 'User permissions updated successfully',
    data: updatedUser
  });
}));

module.exports = router;
