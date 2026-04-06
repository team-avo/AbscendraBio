const express = require('express');
const { body, param, query } = require('express-validator');
const prisma = require('../prisma/client');
const validateRequest = require('../middleware/validateRequest');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireRole, requirePermission } = require('../middleware/auth');
const { getPSTFinancialRange, getFinancialDateKey } = require('../utils/timezoneUtils');

const router = express.Router();

// Admin: list sales reps with assignments
// List sales reps with assignments (Admin sees all, Managers see their own)
router.get('/', requireRole(['ADMIN', 'SALES_MANAGER']), [
  query('search').optional().isString(),
  validateRequest
], asyncHandler(async (req, res) => {
  const { search } = req.query;
  const user = req.user;
  const isAdmin = user.role === 'ADMIN';

  const where = {};

  // Search filter
  if (search) {
    const searchTerms = search.split(/\s+/).filter(Boolean);
    if (searchTerms.length > 0) {
      where.user = {
        AND: searchTerms.map(term => ({
          OR: [
            { firstName: { contains: term, mode: 'insensitive' } },
            { lastName: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } }
          ]
        }))
      };
    }
  }

  // Role-based filter
  if (!isAdmin) {
    // If not admin (i.e. Sales Manager), restrict to their own reps
    // First find the manager profile
    const manager = await prisma.salesManager.findUnique({
      where: { userId: user.id }
    });

    if (!manager) {
      return res.json({ success: true, data: [] }); // No manager profile, no reps
    }

    where.salesManagerId = manager.id;
  }

  const reps = await prisma.salesRepresentative.findMany({
    where,
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true } },
      assignments: { include: { customer: { select: { id: true, firstName: true, lastName: true, email: true } } } }
    },
    orderBy: { id: 'desc' }
  });
  res.json({ success: true, data: reps });
}));

// Admin: Sales rep performance analytics
// Sales rep performance analytics (Admin sees all, Managers see their own)
router.get('/performance', requireRole(['ADMIN', 'SALES_MANAGER']), [
  query('range').optional().isIn(['7d', '14d', '30d', '90d', '365d', 'custom', 'all', 'last_7_days', 'last_14_days', 'last_30_days', 'last_90_days', 'last_year', 'all_time', 'day']),
  query('from').optional().isISO8601().withMessage('from must be a valid ISO-8601 date'),
  query('to').optional().isISO8601().withMessage('to must be a valid ISO-8601 date'),
  query('independent').optional().isString(),
  validateRequest
], asyncHandler(async (req, res) => {
  const now = new Date();
  const { range: rawRange, from: fromParam, to: toParam, independent: independentParam } = req.query;
  const isIndependent = independentParam === 'true';

  let rangeParam = typeof rawRange === 'string' ? rawRange : '90d';
  let startDate;
  let endDate;
  let rangeDays;

  // Map "7d", "30d" etc to convenient labels if needed, or just handle logic below
  // We will align strictly with analytics.js logic where possible

  if (rangeParam === 'custom' && fromParam && toParam) {
    const r = getPSTFinancialRange(fromParam, toParam);
    startDate = r.start; endDate = r.end;
  } else if (rangeParam === 'day' && fromParam) {
    const r = getPSTFinancialRange(fromParam, fromParam);
    startDate = r.start; endDate = r.end;
  } else if (rangeParam === '7d' || rangeParam === 'last_7_days') {
    const startDay = new Date(now.getTime() - 6 * 24 * 3600 * 1000);
    const r = getPSTFinancialRange(startDay, now);
    startDate = r.start; endDate = r.end;
  } else if (rangeParam === '14d' || rangeParam === 'last_14_days') {
    const startDay = new Date(now.getTime() - 13 * 24 * 3600 * 1000);
    const r = getPSTFinancialRange(startDay, now);
    startDate = r.start; endDate = r.end;
  } else if (rangeParam === '30d' || rangeParam === 'last_30_days') {
    const startDay = new Date(now.getTime() - 29 * 24 * 3600 * 1000);
    const r = getPSTFinancialRange(startDay, now);
    startDate = r.start; endDate = r.end;
  } else if (rangeParam === '90d' || rangeParam === 'last_90_days') {
    const startDay = new Date(now.getTime() - 89 * 24 * 3600 * 1000);
    const r = getPSTFinancialRange(startDay, now);
    startDate = r.start; endDate = r.end;
  } else if (rangeParam === '365d' || rangeParam === 'last_year') {
    const startDay = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const r = getPSTFinancialRange(startDay, now);
    startDate = r.start; endDate = r.end;
  } else if (rangeParam === 'all' || rangeParam === 'all_time') {
    startDate = new Date('2020-01-01T00:30:00Z');
    endDate = new Date(now.getTime() + 24 * 3600 * 1000);
  } else {
    // Default to 90d if unknown or missing
    rangeParam = '90d';
    const startDay = new Date(now.getTime() - 89 * 24 * 3600 * 1000);
    const r = getPSTFinancialRange(startDay, now);
    startDate = r.start; endDate = r.end;
  }

  rangeDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)));

  const where = {};
  const user = req.user;
  const isAdmin = user.role === 'ADMIN';

  if (isIndependent) {
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    where.salesManagerId = null;
  } else if (!isAdmin) {
    const manager = await prisma.salesManager.findUnique({
      where: { userId: user.id }
    });
    if (!manager) {
      return res.json({ success: true, data: { totals: { totalRevenue: 0, totalOrders: 0, repsActive: 0 }, reps: [] } });
    }
    where.salesManagerId = manager.id;
  }

  const reps = await prisma.salesRepresentative.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          isActive: true,
        },
      },
      assignments: {
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              orders: {
                where: {
                  createdAt: {
                    gte: startDate,
                    lte: endDate,
                  },
                  status: {
                    notIn: ['CANCELLED', 'REFUNDED']
                  },
                  payments: {
                    none: { status: 'FAILED' }
                  }
                },
                select: {
                  id: true,
                  orderNumber: true,
                  status: true,
                  totalAmount: true,
                  createdAt: true,
                  selectedPaymentType: true,
                  payments: {
                    select: {
                      id: true,
                      paymentMethod: true,
                      provider: true,
                      status: true
                    }
                  }
                },
                orderBy: { createdAt: 'desc' },
              },
            },
          },
        },
      },
    },
    orderBy: {
      user: {
        firstName: 'asc',
      },
    },
  });

  let aggregateRevenue = 0;
  let aggregateOrders = 0;
  let aggregateConversion = 0;
  let repsWithCustomers = 0;

  const repsPerformance = reps.map((rep) => {
    const customers = rep.assignments.map((assignment) => assignment.customer);
    const orders = customers.flatMap((customer) =>
      (customer.orders || []).map((order) => ({
        ...order,
        customerId: customer.id,
        customerName: `${customer.firstName} ${customer.lastName}`.trim(),
      }))
    );

    const totalRevenue = orders.reduce(
      (sum, order) => sum + Number(order.totalAmount || 0),
      0
    );
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders ? totalRevenue / totalOrders : 0;
    const assignedCustomers = customers.length;
    const activeCustomers = customers.filter((customer) => (customer.orders || []).length > 0).length;
    const conversionRate =
      assignedCustomers > 0 ? (activeCustomers / assignedCustomers) * 100 : 0;
    const lastOrder = orders.reduce((latest, order) => {
      if (!latest) return order;
      return new Date(order.createdAt) > new Date(latest.createdAt) ? order : latest;
    }, null);

    aggregateRevenue += totalRevenue;
    aggregateOrders += totalOrders;
    if (assignedCustomers > 0) {
      aggregateConversion += conversionRate;
      repsWithCustomers += 1;
    }

    const revenueByMonth = orders.reduce((acc, order) => {
      const date = new Date(order.createdAt);
      let key;
      if (req.query.usePSTFilter === 'true') {
        key = getFinancialDateKey(date).slice(0, 7); // YYYY-MM
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
      if (!acc[key]) {
        acc[key] = { month: key, revenue: 0, orders: 0 };
      }
      acc[key].revenue += Number(order.totalAmount || 0);
      acc[key].orders += 1;
      return acc;
    }, {});

    const monthlyPerformance = Object.values(revenueByMonth)
      .sort((a, b) => a.month.localeCompare(b.month));

    const topCustomers = customers
      .map((customer) => {
        const customerOrders = customer.orders || [];
        const revenue = customerOrders.reduce(
          (sum, order) => sum + Number(order.totalAmount || 0),
          0
        );
        const lastPurchase = customerOrders.reduce((latest, order) => {
          if (!latest) return order;
          return new Date(order.createdAt) > new Date(latest.createdAt) ? order : latest;
        }, null);
        return {
          id: customer.id,
          name: `${customer.firstName} ${customer.lastName}`.trim(),
          email: customer.email,
          revenue,
          orders: customerOrders.length,
          lastOrderDate: lastPurchase ? lastPurchase.createdAt : null,
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20);

    const sortedOrders = orders
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const recentOrders = isIndependent ? sortedOrders : sortedOrders.slice(0, 10);

    const mappedRecentOrders = recentOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      totalAmount: Number(order.totalAmount || 0),
      status: order.status,
      createdAt: order.createdAt,
      customerId: order.customerId,
      customerName: order.customerName,
      customerName: order.customerName,
      selectedPaymentType: order.selectedPaymentType,
      payments: order.payments
    }));

    return {
      salesRepId: rep.id,
      user: rep.user,
      metrics: {
        totalRevenue,
        totalOrders,
        averageOrderValue,
        assignedCustomers,
        activeCustomers,
        conversionRate,
      },
      lastOrderDate: lastOrder ? lastOrder.createdAt : null,
      monthlyPerformance,
      topCustomers,
      recentOrders,
    };
  });

  const data = {
    range: rangeParam,
    rangeDays,
    generatedAt: new Date().toISOString(),
    period: {
      from: startDate.toISOString(),
      to: endDate.toISOString(),
    },
    totals: {
      totalRevenue: aggregateRevenue,
      totalOrders: aggregateOrders,
      averageConversion: repsWithCustomers ? aggregateConversion / repsWithCustomers : 0,
      repsActive: repsPerformance.filter((rep) => rep.metrics.activeCustomers > 0).length,
    },
    reps: repsPerformance.sort((a, b) => (b.metrics?.totalRevenue || 0) - (a.metrics?.totalRevenue || 0)),
  };

  res.json({ success: true, data });
}));

// Sales Rep: Get all customers with assignment status for potential assignment
router.get('/assignment-candidates', requireRole(['ADMIN', 'SALES_REP', 'SALES_MANAGER']), [
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
        },
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

// Admin: get a single sales rep by ID
router.get('/:salesRepId', requireRole(['ADMIN']), [
  param('salesRepId').isString(),
  validateRequest
], asyncHandler(async (req, res) => {
  const { salesRepId } = req.params;
  const rep = await prisma.salesRepresentative.findUnique({
    where: { id: salesRepId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true } },
      assignments: { include: { customer: { select: { id: true, firstName: true, lastName: true, email: true } } } }
    }
  });
  if (!rep) return res.status(404).json({ success: false, error: 'Sales representative not found' });
  res.json({ success: true, data: rep });
}));

// Admin: create or upsert a sales rep for a userId
router.post('/', requireRole(['ADMIN']), [
  body('userId').isString().withMessage('userId is required'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { userId } = req.body;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  // Ensure role is SALES_REP
  if (user.role !== 'SALES_REP') {
    await prisma.user.update({ where: { id: userId }, data: { role: 'SALES_REP' } });
  }
  const rep = await prisma.salesRepresentative.upsert({
    where: { userId },
    update: {},
    create: { userId }
  });
  res.status(201).json({ success: true, data: rep });
}));

// Admin: assign customers to sales rep (replace list)
// Assign customers to sales rep (replace list)
router.put('/:salesRepId/assignments', requireRole(['ADMIN', 'SALES_MANAGER']), [
  param('salesRepId').isString(),
  body('customerIds').isArray({ min: 0 }).withMessage('customerIds must be array'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { salesRepId } = req.params;
  const { customerIds } = req.body;
  const user = req.user;
  const isAdmin = user.role === 'ADMIN';

  const rep = await prisma.salesRepresentative.findUnique({ where: { id: salesRepId } });
  if (!rep) return res.status(404).json({ success: false, error: 'Sales representative not found' });

  // If Sales Manager, verify this rep belongs to them
  if (!isAdmin) {
    const manager = await prisma.salesManager.findUnique({
      where: { userId: user.id }
    });
    if (!manager || rep.salesManagerId !== manager.id) {
      return res.status(403).json({ success: false, error: 'You can only assign customers to your own sales representatives' });
    }
  }

  await prisma.$transaction(async (tx) => {
    // 1. Remove all existing assignments for this sales rep (clearing their list to be replaced)
    await tx.salesRepCustomerAssignment.deleteMany({ where: { salesRepId } });

    if (customerIds && customerIds.length > 0) {
      // 2. Ensure the customers being assigned are NOT assigned to any other rep (steal them)
      await tx.salesRepCustomerAssignment.deleteMany({
        where: {
          customerId: { in: customerIds }
        }
      });

      // 3. Create the new assignments
      await tx.salesRepCustomerAssignment.createMany({
        data: customerIds.map((cid) => ({ salesRepId, customerId: cid }))
      });
    }
  });

  const updated = await prisma.salesRepresentative.findUnique({
    where: { id: salesRepId },
    include: { assignments: { include: { customer: true } } }
  });
  res.json({ success: true, data: updated });
}));

// Admin: delete a single assignment
router.delete('/:salesRepId/assignments/:customerId', requireRole(['ADMIN']), [
  param('salesRepId').isString(),
  param('customerId').isString(),
  validateRequest
], asyncHandler(async (req, res) => {
  const { salesRepId, customerId } = req.params;
  await prisma.salesRepCustomerAssignment.deleteMany({ where: { salesRepId, customerId } });
  res.json({ success: true });
}));

// Sales Rep: Assign customer to themselves
router.post('/assign-customer', requireRole(['SALES_REP']), [
  body('customerId').isString().withMessage('customerId is required'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { customerId } = req.body;
  const salesRepId = req.user.salesRepId;

  if (!salesRepId) {
    return res.status(400).json({ success: false, error: 'Sales rep profile not found' });
  }

  // Check if customer exists
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { salesAssignments: true }
  });

  if (!customer) {
    return res.status(404).json({ success: false, error: 'Customer not found' });
  }

  // Check if already assigned
  if (customer.salesAssignments && customer.salesAssignments.length > 0) {
    return res.status(400).json({ success: false, error: 'Customer is already assigned to another sales rep' });
  }

  // Create assignment
  await prisma.salesRepCustomerAssignment.create({
    data: {
      salesRepId,
      customerId
    }
  });

  res.json({ success: true, message: 'Customer assigned successfully' });
}));

module.exports = router;


