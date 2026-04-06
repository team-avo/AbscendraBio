const express = require("express");
const { body, param, query } = require("express-validator");
const prisma = require("../prisma/client");
const validateRequest = require("../middleware/validateRequest");
const { asyncHandler } = require("../middleware/errorHandler");
const { requireRole, requirePermission } = require("../middleware/auth");
const {
  getPSTFinancialRange,
  getFinancialDateKey,
  getPSTTime,
} = require("../utils/timezoneUtils");
const { generateSalesAnalyticsExcel } = require("../services/reportService");
const { processRawEmailResend } = require("../utils/emailService");
const { queueReport } = require("../services/reportQueue");

const router = express.Router();

// Unified access: ADMIN/MANAGER or explicit ANALYTICS READ permission
const canAccessAnalytics = (req, res, next) => {
  if (!req.user) {
    return res
      .status(401)
      .json({ error: "Access denied. User not authenticated." });
  }
  if (
    req.user.role === "ADMIN" ||
    req.user.role === "MANAGER" ||
    req.user.role === "SALES_MANAGER"
  ) {
    return next();
  }
  const hasPermission = (req.user.permissions || []).some(
    (p) =>
      String(p.module).toLowerCase() === "analytics" &&
      String(p.action).toLowerCase() === "read" &&
      p.granted,
  );
  if (!hasPermission) {
    return res
      .status(403)
      .json({ error: "Access denied. Missing READ permission for ANALYTICS." });
  }
  next();
};

// Helper: get assigned customer IDs for a sales rep/manager user, or null if not restricted
async function getAssignedCustomerIds(user) {
  if (!user) return null;

  if (user.role === "SALES_REP") {
    const assignments = await prisma.salesRepCustomerAssignment.findMany({
      where: { salesRep: { userId: user.id } },
      select: { customerId: true },
    });
    return assignments.map((a) => a.customerId);
  }

  if (user.role === "SALES_MANAGER") {
    const [managerAssignments, repAssignments] = await Promise.all([
      prisma.salesManagerCustomerAssignment.findMany({
        where: { salesManager: { userId: user.id } },
        select: { customerId: true },
      }),
      prisma.salesRepCustomerAssignment.findMany({
        where: {
          salesRep: {
            salesManager: { userId: user.id },
          },
        },
        select: { customerId: true },
      }),
    ]);

    const allIds = new Set([
      ...managerAssignments.map((a) => a.customerId),
      ...repAssignments.map((a) => a.customerId),
    ]);

    return Array.from(allIds);
  }

  return null;
}

function excludeFailedPaymentOrders(where = {}) {
  return {
    ...where,
    AND: [...(where.AND || []), { payments: { none: { status: "FAILED" } } }],
  };
}

// Get dashboard overview
router.get(
  "/dashboard",
  canAccessAnalytics,
  asyncHandler(async (req, res) => {
    try {
      const assignedCustomerIds = await getAssignedCustomerIds(req.user);
      // If SALES_REP and no assignments, short-circuit with empty analytics
      if (
        Array.isArray(assignedCustomerIds) &&
        assignedCustomerIds.length === 0
      ) {
        return res.json({
          success: true,
          data: {
            totalRevenue: 0,
            revenueChange: 0,
            totalOrders: 0,
            orderChange: 0,
            totalCustomers: 0,
            customerChange: 0,
            activeProducts: 0,
            productChange: -2.1,
            customerLifetimeValue: 0,
            clvChange: 0,
            recentOrders: [],
            topProducts: [],
            customerTypeData: [
              { name: "B2C", value: 0, color: "#0088FE", count: 0 },
              { name: "B2B", value: 0, color: "#00C49F", count: 0 },
              { name: "ENTERPRISE_1", value: 0, color: "#FFBB28", count: 0 },
              { name: "ENTERPRISE_2", value: 0, color: "#8884D8", count: 0 },
            ],
            salesData: [],
          },
        });
      }

      // Determine range
      const now = new Date();
      const range = req.query.range || "last_30_days";
      const fromParam = req.query.from ? new Date(req.query.from) : null;
      const toParam = req.query.to ? new Date(req.query.to) : null;
      const salesChannelId = req.query.salesChannelId;

      let salesChannelFilter = {};
      if (salesChannelId === "research") {
        salesChannelFilter = { salesChannelId: null };
      } else if (salesChannelId === "channels") {
        salesChannelFilter = { salesChannelId: { not: null } };
      } else if (salesChannelId) {
        salesChannelFilter = { salesChannelId: salesChannelId };
      }
      let currentStart, currentEnd, compareStart, compareEnd;

      // Default to PST financial range logic as it's the primary requirement now
      if (range === "custom" && fromParam && toParam) {
        const r = getPSTFinancialRange(fromParam, toParam);
        currentStart = r.start;
        currentEnd = r.end;
      } else if (range === "day" && fromParam) {
        const r = getPSTFinancialRange(fromParam, fromParam);
        currentStart = r.start;
        currentEnd = r.end;
      } else if (range === "last_7_days") {
        const startDay = new Date(now.getTime() - 6 * 24 * 3600 * 1000);
        const r = getPSTFinancialRange(startDay, now);
        currentStart = r.start;
        currentEnd = r.end;
      } else if (range === "last_90_days") {
        const startDay = new Date(now.getTime() - 89 * 24 * 3600 * 1000);
        const r = getPSTFinancialRange(startDay, now);
        currentStart = r.start;
        currentEnd = r.end;
      } else if (range === "last_year") {
        const startDay = new Date(
          now.getFullYear() - 1,
          now.getMonth(),
          now.getDate(),
        );
        const r = getPSTFinancialRange(startDay, now);
        currentStart = r.start;
        currentEnd = r.end;
      } else if (range === "all" || range === "all_time") {
        currentStart = new Date("2020-01-01T00:30:00Z");
        currentEnd = new Date(now.getTime() + 24 * 3600 * 1000); // Buffer for future
      } else {
        // last_30_days default
        const startDay = new Date(now.getTime() - 29 * 24 * 3600 * 1000);
        const r = getPSTFinancialRange(startDay, now);
        currentStart = r.start;
        currentEnd = r.end;
      }

      // Comparison range calculation (offset current range by its duration)
      const duration = currentEnd.getTime() - currentStart.getTime();
      compareStart = new Date(currentStart.getTime() - duration);
      compareEnd = new Date(currentEnd.getTime() - duration);

      // Find the most recent month that has data
      const mostRecentOrder = await prisma.order.findFirst({
        orderBy: {
          createdAt: "desc",
        },
        select: {
          createdAt: true,
        },
        where: {
          ...(Array.isArray(assignedCustomerIds)
            ? { customerId: { in: assignedCustomerIds } }
            : {}),
        },
      });

      // If no orders exist, use current month
      let referenceDate = now;
      if (mostRecentOrder) {
        referenceDate = mostRecentOrder.createdAt;
      }

      // Create dates using the reference date (most recent month with data)
      const currentMonthStart = new Date(
        Date.UTC(referenceDate.getFullYear(), referenceDate.getMonth(), 1),
      );
      const currentMonthEnd = new Date(
        Date.UTC(
          referenceDate.getFullYear(),
          referenceDate.getMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        ),
      );

      const lastMonthStart = new Date(
        Date.UTC(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1),
      );
      const lastMonthEnd = new Date(
        Date.UTC(
          referenceDate.getFullYear(),
          referenceDate.getMonth(),
          0,
          23,
          59,
          59,
          999,
        ),
      );

      // Get total revenue (current month vs last month)
      const currentMonthRevenue = await prisma.order.aggregate({
        where: excludeFailedPaymentOrders({
          createdAt: { gte: currentStart, lte: currentEnd },
          status: {
            notIn: ["CANCELLED", "REFUNDED"],
          },
          ...(Array.isArray(assignedCustomerIds)
            ? { customerId: { in: assignedCustomerIds } }
            : {}),
          ...salesChannelFilter,
        }),
        _sum: {
          totalAmount: true,
        },
      });

      const lastMonthRevenue = await prisma.order.aggregate({
        where: excludeFailedPaymentOrders({
          createdAt: { gte: compareStart, lte: compareEnd },
          status: {
            notIn: ["CANCELLED", "REFUNDED"],
          },
          ...(Array.isArray(assignedCustomerIds)
            ? { customerId: { in: assignedCustomerIds } }
            : {}),
          ...salesChannelFilter,
        }),
        _sum: {
          totalAmount: true,
        },
      });

      const totalRevenue = currentMonthRevenue._sum.totalAmount || 0;
      const lastMonthRevenueAmount = lastMonthRevenue._sum.totalAmount || 0;
      const revenueChange =
        lastMonthRevenueAmount > 0
          ? ((totalRevenue - lastMonthRevenueAmount) / lastMonthRevenueAmount) *
          100
          : totalRevenue > 0
            ? 100
            : 0; // If current month has data but last month doesn't, show +100%

      // Get total orders (current month vs last month)
      const currentMonthOrders = await prisma.order.count({
        where: excludeFailedPaymentOrders({
          createdAt: { gte: currentStart, lte: currentEnd },
          status: {
            notIn: ["CANCELLED", "REFUNDED"],
          },
          ...(Array.isArray(assignedCustomerIds)
            ? { customerId: { in: assignedCustomerIds } }
            : {}),
          ...salesChannelFilter,
        }),
      });

      const lastMonthOrders = await prisma.order.count({
        where: excludeFailedPaymentOrders({
          createdAt: { gte: compareStart, lte: compareEnd },
          status: {
            notIn: ["CANCELLED", "REFUNDED"],
          },
          ...(Array.isArray(assignedCustomerIds)
            ? { customerId: { in: assignedCustomerIds } }
            : {}),
          ...salesChannelFilter,
        }),
      });

      const orderChange =
        lastMonthOrders > 0
          ? ((currentMonthOrders - lastMonthOrders) / lastMonthOrders) * 100
          : currentMonthOrders > 0
            ? 100
            : 0; // If current month has orders but last month doesn't, show +100%
      // Compute Customer Lifetime Value (CLV) as revenue per purchasing customer for the selected period
      const currentOrdersForClv = await prisma.order.findMany({
        where: excludeFailedPaymentOrders({
          createdAt: { gte: currentStart, lte: currentEnd },
          status: { notIn: ["CANCELLED", "REFUNDED"] },
          ...(Array.isArray(assignedCustomerIds)
            ? { customerId: { in: assignedCustomerIds } }
            : {}),
          ...salesChannelFilter,
        }),
        select: {
          customerId: true,
          totalAmount: true,
        },
      });

      const prevOrdersForClv = await prisma.order.findMany({
        where: excludeFailedPaymentOrders({
          createdAt: { gte: compareStart, lte: compareEnd },
          status: { notIn: ["CANCELLED", "REFUNDED"] },
          ...(Array.isArray(assignedCustomerIds)
            ? { customerId: { in: assignedCustomerIds } }
            : {}),
          ...salesChannelFilter,
        }),
        select: {
          customerId: true,
          totalAmount: true,
        },
      });
      const uniqueCurrentCustomers =
        new Set((currentOrdersForClv || []).map((o) => String(o.customerId)))
          .size || 0;
      const uniquePrevCustomers =
        new Set((prevOrdersForClv || []).map((o) => String(o.customerId)))
          .size || 0;
      const customerLifetimeValue =
        uniqueCurrentCustomers > 0
          ? Number(totalRevenue) / uniqueCurrentCustomers
          : 0;
      const prevClv =
        uniquePrevCustomers > 0
          ? Number(lastMonthRevenueAmount) / uniquePrevCustomers
          : 0;
      const clvChange =
        prevClv > 0
          ? ((customerLifetimeValue - prevClv) / prevClv) * 100
          : customerLifetimeValue > 0
            ? 100
            : 0;

      // Get total customers (current month vs last month)
      const currentMonthCustomers = await prisma.customer.count({
        where: {
          createdAt: {
            gte: currentMonthStart,
            lte: currentMonthEnd,
          },
          ...(Array.isArray(assignedCustomerIds)
            ? { id: { in: assignedCustomerIds } }
            : {}),
          ...(salesChannelId
            ? { orders: { some: { ...salesChannelFilter } } }
            : {}),
        },
      });

      const lastMonthCustomers = await prisma.customer.count({
        where: {
          createdAt: {
            gte: lastMonthStart,
            lte: lastMonthEnd,
          },
          ...(Array.isArray(assignedCustomerIds)
            ? { id: { in: assignedCustomerIds } }
            : {}),
          ...(salesChannelId
            ? { orders: { some: { ...salesChannelFilter } } }
            : {}),
        },
      });

      const customerChange =
        lastMonthCustomers > 0
          ? ((currentMonthCustomers - lastMonthCustomers) /
            lastMonthCustomers) *
          100
          : currentMonthCustomers > 0
            ? 100
            : 0; // If current month has customers but last month doesn't, show +100%

      // Get active products (current vs last month)
      const currentActiveProducts = await prisma.product.count({
        where: {
          status: "ACTIVE",
        },
      });

      // For products, we'll compare with a previous snapshot or use a simple calculation
      // Since we don't have historical product status, we'll use a simple approach
      const productChange = -2.1; // This could be calculated from audit logs in the future

      // Get recent orders for the dashboard
      const recentOrders = await prisma.order.findMany({
        take: 5,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          customer: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        where: excludeFailedPaymentOrders({
          status: {
            notIn: ["CANCELLED", "REFUNDED"],
          },
          ...(Array.isArray(assignedCustomerIds)
            ? { customerId: { in: assignedCustomerIds } }
            : {}),
          ...salesChannelFilter,
        }),
      });

      // Get top products by sales - using the current month range
      const topProducts = await prisma.orderItem.groupBy({
        by: ["variantId"],
        _sum: {
          quantity: true,
          totalPrice: true,
        },
        orderBy: {
          _sum: {
            quantity: "desc",
          },
        },
        take: 4,
        where: {
          order: {
            status: {
              notIn: ["CANCELLED", "REFUNDED"],
            },
            payments: { none: { status: "FAILED" } },
            createdAt: { gte: currentStart, lte: currentEnd },
            ...(Array.isArray(assignedCustomerIds)
              ? { customerId: { in: assignedCustomerIds } }
              : {}),
            ...salesChannelFilter,
          },
        },
      });

      // Get product details for top products
      const topProductsWithDetails = await Promise.all(
        topProducts.map(async (item) => {
          const variant = await prisma.productVariant.findUnique({
            where: { id: item.variantId },
            include: {
              product: {
                select: {
                  name: true,
                  status: true,
                },
              },
              inventory: {
                select: {
                  quantity: true,
                },
              },
            },
          });

          return {
            id: item.variantId,
            name: variant?.product.name || "Unknown Product",
            sales: item._sum.quantity || 0,
            revenue: parseFloat(item._sum.totalPrice || 0),
            stock: variant?.inventory?.[0]?.quantity || 0,
            trend: "up", // This could be calculated from historical data
          };
        }),
      );

      // Get customer distribution by type
      const customerDistribution = await prisma.customer.groupBy({
        by: ["customerType"],
        _count: {
          id: true,
        },
        where: {
          ...(Array.isArray(assignedCustomerIds)
            ? { id: { in: assignedCustomerIds } }
            : {}),
          ...(salesChannelId
            ? { orders: { some: { ...salesChannelFilter } } }
            : {}),
        },
      });

      // Get revenue by customer type
      const revenueByCustomerType = await prisma.order.groupBy({
        by: ["customerId"],
        _sum: {
          totalAmount: true,
        },
        where: excludeFailedPaymentOrders({
          createdAt: { gte: currentStart, lte: currentEnd },
          status: {
            notIn: ["CANCELLED", "REFUNDED"],
          },
          ...(Array.isArray(assignedCustomerIds)
            ? { customerId: { in: assignedCustomerIds } }
            : {}),
          ...salesChannelFilter,
        }),
      });

      // Map customer IDs to their types
      const customerIds = revenueByCustomerType
        .map((r) => r.customerId)
        .filter(Boolean);
      const customers = await prisma.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, customerType: true },
      });
      const customerTypeMap = new Map(
        customers.map((c) => [c.id, c.customerType]),
      );

      // Aggregate revenue by customer type
      const revenueByType = new Map();
      for (const rev of revenueByCustomerType) {
        const customerType = customerTypeMap.get(rev.customerId);
        if (customerType) {
          const current = revenueByType.get(customerType) || 0;
          revenueByType.set(
            customerType,
            current + Number(rev._sum.totalAmount || 0),
          );
        }
      }

      const totalCustomers = customerDistribution.reduce(
        (sum, item) => sum + item._count.id,
        0,
      );

      // Ensure all customer types are included, even if they have 0 customers
      const allCustomerTypes = ["B2C", "B2B", "ENTERPRISE_1", "ENTERPRISE_2"];
      const customerTypeData = allCustomerTypes.map((customerType) => {
        const existingData = customerDistribution.find(
          (item) => item.customerType === customerType,
        );
        const count = existingData ? existingData._count.id : 0;
        const percentage =
          totalCustomers > 0 ? Math.round((count / totalCustomers) * 100) : 0;
        const revenue = revenueByType.get(customerType) || 0;

        // Assign colors for each customer type
        let color;
        switch (customerType) {
          case "B2C":
            color = "#0088FE";
            break;
          case "B2B":
            color = "#00C49F";
            break;
          case "ENTERPRISE_1":
            color = "#FFBB28";
            break;
          case "ENTERPRISE_2":
            color = "#8884D8";
            break;
          default:
            color = "#8884D8";
        }

        return {
          name: customerType,
          value: percentage,
          color: color,
          count: count,
          revenue: Math.round(revenue),
        };
      });

      // For the chart, we always want at least 6 months of data
      const chartStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const effectiveChartStart =
        currentStart < chartStart ? currentStart : chartStart;

      // Get monthly sales data for the chart
      const monthlySales = await prisma.order.groupBy({
        by: ["createdAt"],
        _sum: {
          totalAmount: true,
        },
        _count: {
          id: true,
        },
        where: excludeFailedPaymentOrders({
          createdAt: { gte: effectiveChartStart },
          status: {
            notIn: ["CANCELLED", "REFUNDED"],
          },
          ...(Array.isArray(assignedCustomerIds)
            ? { customerId: { in: assignedCustomerIds } }
            : {}),
          ...salesChannelFilter,
        }),
        orderBy: {
          createdAt: "asc",
        },
      });

      // Group by month for the chart
      const salesData = [];
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];

      // Aggregate into day or month buckets depending on range length
      const days = Math.ceil((currentEnd - currentStart) / (24 * 3600 * 1000));

      if (days <= 1) {
        // Hourly buckets for single day view
        for (let i = 0; i < 24; i++) {
          const hourLabel = `${i.toString().padStart(2, "0")}:00 PST`;
          const hourSales = monthlySales.filter((sale) => {
            // STRICT FIX: Ensure the sale actually belongs to the selected day (currentStart/currentEnd)
            // The 'monthlySales' query fetches 5+ months back, so we must filter by the specific day here.
            const saleDate = new Date(sale.createdAt);
            if (saleDate < currentStart || saleDate > currentEnd) return false;

            const pst = getPSTTime(sale.createdAt);
            return pst.getUTCHours() === i;
          });
          const revenue = hourSales.reduce(
            (sum, sale) => sum + parseFloat(sale._sum.totalAmount || 0),
            0,
          );
          const orders = hourSales.reduce(
            (sum, sale) => sum + sale._count.id,
            0,
          );
          salesData.push({
            month: hourLabel,
            date: hourLabel,
            revenue: Math.round(revenue),
            orders,
          });
        }
      } else if (days <= 62) {
        // daily buckets using financial dates
        let iterateDate = new Date(currentStart.getTime());
        while (iterateDate < currentEnd) {
          const ymd = getFinancialDateKey(iterateDate);
          const daySales = monthlySales.filter(
            (sale) => getFinancialDateKey(sale.createdAt) === ymd,
          );
          const revenue = daySales.reduce(
            (sum, sale) => sum + parseFloat(sale._sum.totalAmount || 0),
            0,
          );
          const orders = daySales.reduce(
            (sum, sale) => sum + sale._count.id,
            0,
          );
          salesData.push({
            month: ymd,
            date: ymd,
            revenue: Math.round(revenue),
            orders,
          });

          // Move to next day (add 24 hours)
          iterateDate.setTime(iterateDate.getTime() + 24 * 3600 * 1000);
        }
      } else {
        // monthly buckets for longer ranges
        for (let offset = 11; offset >= 0; offset--) {
          const monthDate = new Date(
            now.getFullYear(),
            now.getMonth() - offset,
            1,
          );
          const monthKey = months[monthDate.getMonth()];
          const monthSales = monthlySales.filter((sale) => {
            const saleDate = new Date(sale.createdAt);
            return (
              saleDate.getUTCMonth() === monthDate.getMonth() &&
              saleDate.getUTCFullYear() === monthDate.getFullYear()
            );
          });
          const revenue = monthSales.reduce(
            (sum, sale) => sum + parseFloat(sale._sum.totalAmount || 0),
            0,
          );
          const orders = monthSales.reduce(
            (sum, sale) => sum + sale._count.id,
            0,
          );
          if (revenue > 0 || orders > 0 || offset < 6) {
            // Show at least last 6 months or anything with data
            salesData.push({
              month: monthKey,
              date: monthKey,
              revenue: Math.round(revenue),
              orders,
            });
          }
        }
      }

      res.json({
        success: true,
        data: {
          totalRevenue: parseFloat(totalRevenue),
          revenueChange: Math.round(revenueChange * 10) / 10,
          totalOrders: currentMonthOrders,
          orderChange: Math.round(orderChange * 10) / 10,
          totalCustomers: currentMonthCustomers,
          customerChange: Math.round(customerChange * 10) / 10,
          activeProducts: currentActiveProducts,
          productChange: productChange,
          customerLifetimeValue: Math.round(customerLifetimeValue * 100) / 100,
          clvChange: Math.round(clvChange * 10) / 10,
          recentOrders: recentOrders.map((order) => ({
            id: order.orderNumber,
            customer: `${order.customer.firstName} ${order.customer.lastName}`,
            email: order.customer.email,
            amount: parseFloat(order.totalAmount),
            status: order.status.toLowerCase(),
            date: order.createdAt,
          })),
          topProducts: topProductsWithDetails,
          customerTypeData,
          salesData,
        },
      });
    } catch (error) {
      console.error("Dashboard analytics error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch dashboard analytics",
      });
    }
  }),
);

// Removed old placeholder analytics endpoints to avoid route conflicts

// Get abandoned cart reports
router.get(
  "/abandoned-carts",
  requirePermission("ANALYTICS", "READ"),
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      message: "Abandoned carts analytics endpoint - To be implemented",
      data: [],
    });
  }),
);

// Sales Reports
router.get(
  "/sales",
  canAccessAnalytics,
  asyncHandler(async (req, res) => {
    const assignedCustomerIds = await getAssignedCustomerIds(req.user);
    if (
      Array.isArray(assignedCustomerIds) &&
      assignedCustomerIds.length === 0
    ) {
      return res.json({
        success: true,
        data: {
          range: req.query.range || "last_30_days",
          totalRevenue: 0,
          totalOrders: 0,
          daily: [],
        },
      });
    }
    const now = new Date();
    const range = req.query.range || "last_30_days";
    const fromParam = req.query.from ? new Date(req.query.from) : null;
    const toParam = req.query.to ? new Date(req.query.to) : null;
    const detailed = req.query.detailed === "true";
    const salesChannelId = req.query.salesChannelId;

    let salesChannelFilter = {};
    if (salesChannelId === "research") {
      salesChannelFilter = { salesChannelId: null };
    } else if (salesChannelId === "channels") {
      salesChannelFilter = { salesChannelId: { not: null } };
    } else if (salesChannelId) {
      salesChannelFilter = { salesChannelId: salesChannelId };
    }

    let start, end;

    if (range === "day" && fromParam) {
      const r = getPSTFinancialRange(fromParam, fromParam);
      start = r.start;
      end = r.end;
    } else if (range === "last_7_days") {
      const startDay = new Date(now.getTime() - 6 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      start = r.start;
      end = r.end;
    } else if (range === "last_90_days") {
      const startDay = new Date(now.getTime() - 89 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      start = r.start;
      end = r.end;
    } else if (range === "last_year") {
      const startDay = new Date(
        now.getFullYear() - 1,
        now.getMonth(),
        now.getDate(),
      );
      const r = getPSTFinancialRange(startDay, now);
      start = r.start;
      end = r.end;
    } else if (range === "all" || range === "all_time") {
      start = new Date("2020-01-01T00:30:00Z");
      end = new Date(now.getTime() + 24 * 3600 * 1000);
    } else if (range === "custom" && fromParam && toParam) {
      const r = getPSTFinancialRange(fromParam, toParam);
      start = r.start;
      end = r.end;
    } else {
      // Default: last 30 days
      const startDay = new Date(now.getTime() - 29 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      start = r.start;
      end = r.end;
    }

    // If detailed view is requested, return individual orders
    if (detailed) {
      const orders = await prisma.order.findMany({
        where: excludeFailedPaymentOrders({
          createdAt: { gte: start, lte: end },
          status: { notIn: ["CANCELLED", "REFUNDED"] },
          ...(Array.isArray(assignedCustomerIds)
            ? { customerId: { in: assignedCustomerIds } }
            : {}),
          ...salesChannelFilter,
        }),
        select: {
          id: true,
          orderNumber: true,
          createdAt: true,
          totalAmount: true,
          status: true,
          selectedPaymentType: true,
          payments: {
            select: {
              paymentMethod: true,
            },
            take: 1,
          },
          customer: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" }, // Changed to desc for logs usually
      });

      const daily = orders.map((o) => ({
        orderId: o.id,
        orderNumber: o.orderNumber,
        date: o.createdAt.toISOString(),
        revenue: Number(o.totalAmount || 0),
        status: o.status,
        paymentMethod:
          o.selectedPaymentType || o.payments?.[0]?.paymentMethod || "N/A",
        customerName: o.customer
          ? `${o.customer.firstName} ${o.customer.lastName}`
          : "Guest",
        customerEmail: o.customer?.email || "",
      }));

      const totalRevenue = orders.reduce(
        (s, o) => s + Number(o.totalAmount || 0),
        0,
      );
      const totalOrders = orders.length;

      // Also provide aggregated data for charts
      const daysDiff = (end.getTime() - start.getTime()) / (1000 * 3600 * 24);
      const useHourly = daysDiff <= 1.1;

      const byTime = new Map();
      for (const o of orders) {
        const d = new Date(o.createdAt);
        let key;
        if (useHourly) {
          // Round to PST hour
          const pst = getPSTTime(o.createdAt);
          pst.setUTCMinutes(0, 0, 0);
          key = pst.toISOString().replace("T", " ").substring(11, 16) + " PST";
        } else {
          key = getFinancialDateKey(d);
        }

        if (!byTime.has(key))
          byTime.set(key, { date: key, revenue: 0, orders: 0 });
        const item = byTime.get(key);
        item.revenue += Number(o.totalAmount || 0);
        item.orders += 1;
      }
      const chartData = Array.from(byTime.values()).sort((a, b) =>
        a.date.localeCompare(b.date),
      );

      return res.json({
        success: true,
        data: {
          range,
          start: start.toISOString(),
          end: end.toISOString(),
          totalRevenue,
          totalOrders,
          daily,
          chartData,
          detailed: true,
        },
      });
    }

    // Default aggregated view
    const orders = await prisma.order.findMany({
      where: excludeFailedPaymentOrders({
        createdAt: { gte: start, lte: end },
        status: { notIn: ["CANCELLED", "REFUNDED"] },
        ...(Array.isArray(assignedCustomerIds)
          ? { customerId: { in: assignedCustomerIds } }
          : {}),
        ...salesChannelFilter,
      }),
      select: { id: true, createdAt: true, totalAmount: true },
    });

    // Bucket by day or hour depending on range
    const daysDiff = (end.getTime() - start.getTime()) / (1000 * 3600 * 24);
    const useHourly = daysDiff <= 1.1; // Allow slight buffer

    const byTime = new Map();
    for (const o of orders) {
      const d = new Date(o.createdAt);
      let key;
      if (useHourly) {
        // Round to PST hour
        const pst = getPSTTime(o.createdAt);
        pst.setUTCMinutes(0, 0, 0);
        key = pst.toISOString().replace("T", " ").substring(11, 16) + " PST";
      } else {
        key = getFinancialDateKey(d);
      }

      if (!byTime.has(key))
        byTime.set(key, { date: key, revenue: 0, orders: 0 });
      const item = byTime.get(key);
      item.revenue += Number(o.totalAmount || 0);
      item.orders += 1;
    }
    const daily = Array.from(byTime.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    const totalRevenue = daily.reduce((s, d) => s + d.revenue, 0);
    const totalOrders = daily.reduce((s, d) => s + d.orders, 0);

    res.json({
      success: true,
      data: {
        range,
        start: start.toISOString(),
        end: end.toISOString(),
        totalRevenue,
        totalOrders,
        daily,
      },
    });
  }),
);

// Sales Email Report
router.post(
  "/email-report",
  canAccessAnalytics,
  [
    body("email").isEmail().withMessage("Valid email required"),
    body("range").optional().isString(),
    body("from").optional().isISO8601(),
    body("to").optional().isISO8601(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const {
      email,
      range,
      from,
      to,
      usePSTFilter,
      salesChannelId,
      managerId,
      salesRepId,
    } = req.body;

    // Delegate to background queue
    const result = await queueReport({
      type: "ANALYTICS",
      email,
      filters: {
        range,
        from,
        to,
        usePSTFilter: usePSTFilter === "true" || usePSTFilter === true,
        salesChannelId,
        managerId,
        salesRepId,
      },
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
      }
    });

    res.json(result);
  }),
);

// Product Performance
router.get(
  "/products",
  canAccessAnalytics,
  asyncHandler(async (req, res) => {
    const assignedCustomerIds = await getAssignedCustomerIds(req.user);
    const now = new Date();
    const range = req.query.range || "last_30_days";
    const fromParam = req.query.from ? new Date(req.query.from) : null;
    const toParam = req.query.to ? new Date(req.query.to) : null;
    const salesChannelId = req.query.salesChannelId;

    let salesChannelFilter = {};
    if (salesChannelId === "research") {
      salesChannelFilter = { salesChannelId: null };
    } else if (salesChannelId === "channels") {
      salesChannelFilter = { salesChannelId: { not: null } };
    } else if (salesChannelId) {
      salesChannelFilter = { salesChannelId: salesChannelId };
    }

    let start, end;

    if (range === "day" && fromParam) {
      const r = getPSTFinancialRange(fromParam, fromParam);
      start = r.start;
      end = r.end;
    } else if (range === "last_7_days") {
      const startDay = new Date(now.getTime() - 6 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      start = r.start;
      end = r.end;
    } else if (range === "last_90_days") {
      const startDay = new Date(now.getTime() - 89 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      start = r.start;
      end = r.end;
    } else if (range === "last_year") {
      const startDay = new Date(
        now.getFullYear() - 1,
        now.getMonth(),
        now.getDate(),
      );
      const r = getPSTFinancialRange(startDay, now);
      start = r.start;
      end = r.end;
    } else if (range === "all" || range === "all_time") {
      start = new Date("2020-01-01T00:30:00Z");
      end = new Date(now.getTime() + 24 * 3600 * 1000);
    } else if (range === "custom" && fromParam && toParam) {
      const r = getPSTFinancialRange(fromParam, toParam);
      start = r.start;
      end = r.end;
    } else {
      // Default: last 30 days
      const startDay = new Date(now.getTime() - 29 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      start = r.start;
      end = r.end;
    }

    // Aggregate order items by variant then join product
    // Prefer computing revenue as sum(unitPrice * quantity) to handle missing totalPrice
    const orderedItems = await prisma.orderItem.findMany({
      where: {
        order: {
          status: { notIn: ["CANCELLED", "REFUNDED"] },
          payments: { none: { status: "FAILED" } },
          createdAt: { gte: start, lte: end },
          ...(Array.isArray(assignedCustomerIds)
            ? { customerId: { in: assignedCustomerIds } }
            : {}),
          ...salesChannelFilter,
        },
      },
      select: {
        variantId: true,
        quantity: true,
        unitPrice: true,
        totalPrice: true,
      },
    });
    const itemsMap = new Map();
    for (const it of orderedItems) {
      if (!it.variantId) continue;
      const key = it.variantId;
      const prev = itemsMap.get(key) || { quantity: 0, revenue: 0 };
      const qty = Number(it.quantity || 0);
      const unit = Number(it.unitPrice || 0);
      const total = Number(it.totalPrice || 0);
      prev.quantity += qty;
      prev.revenue += total > 0 ? total : unit * qty;
      itemsMap.set(key, prev);
    }
    const items = Array.from(itemsMap.entries())
      .map(([variantId, agg]) => ({
        variantId,
        _sum: { quantity: agg.quantity, totalPrice: agg.revenue },
      }))
      .sort((a, b) => Number(b._sum.totalPrice) - Number(a._sum.totalPrice));

    let sourceItems = items;
    let usedRange = range;

    let top = await Promise.all(
      sourceItems.slice(0, 50).map(async (it) => {
        const variant = await prisma.productVariant.findUnique({
          where: { id: it.variantId },
          include: {
            product: { select: { id: true, name: true, status: true } },
            inventory: { select: { quantity: true } },
            images: {
              select: { url: true },
              orderBy: { sortOrder: "asc" },
              take: 1,
            },
          },
        });
        return {
          variantId: it.variantId,
          productId: variant?.product?.id,
          name: variant?.product?.name || "Unknown",
          variantName: variant?.name,
          revenue: Number(it._sum.totalPrice || 0),
          sales: Number(it._sum.quantity || 0),
          stock: variant?.inventory?.[0]?.quantity || 0,
          image: variant?.images?.[0]?.url || null,
        };
      }),
    );

    res.json({ success: true, data: { range: usedRange, top } });
  }),
);

// Customer Order Frequency
router.get(
  "/customers/order-frequency",
  canAccessAnalytics,
  asyncHandler(async (req, res) => {
    const assignedCustomerIds = await getAssignedCustomerIds(req.user);
    const search = req.query.search;
    const salesChannelId = req.query.salesChannelId;
    const range = req.query.range || "all_time";
    const fromParam = req.query.from ? new Date(req.query.from) : null;
    const toParam = req.query.to ? new Date(req.query.to) : null;

    // Pagination & Tabs
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const tab = req.query.tab || "1";
    const plusFilter = req.query.plusFilter || "ALL";

    const searchFilter = search
      ? {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      }
      : undefined;

    let salesChannelFilter = {};
    if (salesChannelId === "research") {
      salesChannelFilter = { salesChannelId: null };
    } else if (salesChannelId === "channels") {
      salesChannelFilter = { salesChannelId: { not: null } };
    } else if (salesChannelId) {
      salesChannelFilter = { salesChannelId: salesChannelId };
    }

    // Date range logic (PST)
    let startDate, endDate;
    const now = new Date();
    if (range === "custom" && fromParam && toParam) {
      const r = getPSTFinancialRange(fromParam, toParam);
      startDate = r.start;
      endDate = r.end;
    } else if (range === "day" && fromParam) {
      const r = getPSTFinancialRange(fromParam, fromParam);
      startDate = r.start;
      endDate = r.end;
    } else if (range === "last_7_days") {
      const startDay = new Date(now.getTime() - 6 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      startDate = r.start;
      endDate = r.end;
    } else if (range === "last_14_days") {
      const startDay = new Date(now.getTime() - 13 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      startDate = r.start;
      endDate = r.end;
    } else if (range === "last_30_days") {
      const startDay = new Date(now.getTime() - 29 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      startDate = r.start;
      endDate = r.end;
    } else if (range === "last_60_days") {
      const startDay = new Date(now.getTime() - 59 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      startDate = r.start;
      endDate = r.end;
    } else if (range === "last_90_days") {
      const startDay = new Date(now.getTime() - 89 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      startDate = r.start;
      endDate = r.end;
    } else if (range === "last_year") {
      const startDay = new Date(
        now.getFullYear() - 1,
        now.getMonth(),
        now.getDate(),
      );
      const r = getPSTFinancialRange(startDay, now);
      startDate = r.start;
      endDate = r.end;
    } else {
      startDate = null;
      endDate = null;
    }

    const orderWhere = excludeFailedPaymentOrders({
      status: { notIn: ["CANCELLED", "REFUNDED"] },
      ...(startDate && endDate
        ? { createdAt: { gte: startDate, lte: endDate } }
        : {}),
      ...salesChannelFilter,
    });

    // 1. Fetch ALL matching customer IDs + order summaries for metrics and filtering
    const allCustomers = await prisma.customer.findMany({
      where: {
        ...(Array.isArray(assignedCustomerIds)
          ? { id: { in: assignedCustomerIds } }
          : {}),
        ...(searchFilter ? searchFilter : {}),
      },
      select: {
        id: true,
        orders: {
          where: orderWhere,
          select: { totalAmount: true },
        },
      },
    });

    // Calculate order counts and revenue in JS based on the filtered orders
    const customerSummaries = allCustomers.map((c) => {
      const orders = c.orders || [];
      return {
        id: c.id,
        ordersCount: parseInt(orders.length) || 0,
        revenue: orders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0),
      };
    });

    // 2. Calculate global metrics based on current filters (search, dates, channel)
    const neverOrdered = customerSummaries.filter(
      (c) => c.ordersCount === 0,
    ).length;
    const singleOrder = customerSummaries.filter(
      (c) => c.ordersCount === 1,
    ).length;
    const repeatOrder =
      plusFilter === "ALL"
        ? customerSummaries.filter((c) => c.ordersCount >= 2).length
        : customerSummaries.filter((c) => c.ordersCount >= parseInt(plusFilter))
          .length;

    const metrics = {
      total: customerSummaries.length, // All matching profiles
      activeInPeriod: singleOrder + repeatOrder, // Total with at least one order in period
      neverOrdered,
      singleOrder,
      repeatOrder,
    };

    // 3. Filter IDs based on current tab
    let filteredList = [];
    if (tab === "0") {
      filteredList = customerSummaries.filter((c) => c.ordersCount === 0);
    } else if (tab === "1") {
      filteredList = customerSummaries.filter((c) => c.ordersCount === 1);
    } else if (tab === "repeat") {
      if (plusFilter === "ALL") {
        filteredList = customerSummaries.filter((c) => c.ordersCount >= 2);
      } else {
        const threshold = parseInt(plusFilter);
        filteredList = customerSummaries.filter(
          (c) => !isNaN(threshold) && c.ordersCount >= threshold,
        );
      }
    } else {
      filteredList = customerSummaries;
    }

    // Sort by revenue descending
    filteredList.sort((a, b) => b.revenue - a.revenue);

    // Pagination
    const totalItems = filteredList.length;
    const totalPages = Math.ceil(totalItems / limit);
    const pagedList = filteredList.slice((page - 1) * limit, page * limit);
    const pagedIds = pagedList.map((c) => c.id);

    // 4. Fetch FULL details for paged customers
    const finalCustomers = await prisma.customer.findMany({
      where: { id: { in: pagedIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        customerType: true,
        createdAt: true,
        salesAssignments: {
          select: {
            salesRep: {
              select: {
                user: {
                  select: { firstName: true, lastName: true, email: true },
                },
              },
            },
          },
          take: 1,
          orderBy: { assignedAt: "desc" },
        },
      },
    });

    // Merge with pre-calculated revenue/ordersCount
    const finalData = finalCustomers.map((c) => {
      const summary = pagedList.find((s) => s.id === c.id);
      const salesRep = c.salesAssignments?.[0]?.salesRep?.user;
      return {
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        email: c.email,
        customerType: c.customerType,
        orders: summary.ordersCount,
        revenue: summary.revenue,
        since: c.createdAt,
        salesRep: salesRep
          ? {
            name: `${salesRep.firstName} ${salesRep.lastName}`,
            email: salesRep.email,
          }
          : null,
      };
    });

    // Sort again to ensure original order (revenue desc) is maintained after findMany
    finalData.sort((a, b) => b.revenue - a.revenue);

    res.json({
      success: true,
      data: finalData,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
      },
      metrics,
    });
  }),
);

// Customer Insights
router.get(
  "/customers",
  canAccessAnalytics,
  asyncHandler(async (req, res) => {
    const assignedCustomerIds = await getAssignedCustomerIds(req.user);
    const now = new Date();
    const range = req.query.range || "last_30_days";
    const fromParam = req.query.from ? new Date(req.query.from) : null;
    const toParam = req.query.to ? new Date(req.query.to) : null;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;

    let start, end;
    if (range === "day" && fromParam) {
      const r = getPSTFinancialRange(fromParam, fromParam);
      start = r.start;
      end = r.end;
    } else if (range === "last_7_days") {
      const startDay = new Date(now.getTime() - 6 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      start = r.start;
      end = r.end;
    } else if (range === "last_14_days") {
      const startDay = new Date(now.getTime() - 13 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      start = r.start;
      end = r.end;
    } else if (range === "last_30_days") {
      const startDay = new Date(now.getTime() - 29 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      start = r.start;
      end = r.end;
    } else if (range === "last_60_days") {
      const startDay = new Date(now.getTime() - 59 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      start = r.start;
      end = r.end;
    } else if (range === "last_90_days") {
      const startDay = new Date(now.getTime() - 89 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      start = r.start;
      end = r.end;
    } else if (range === "last_year") {
      const startDay = new Date(
        now.getFullYear() - 1,
        now.getMonth(),
        now.getDate(),
      );
      const r = getPSTFinancialRange(startDay, now);
      start = r.start;
      end = r.end;
    } else if (range === "all" || range === "all_time") {
      start = new Date("2020-01-01T00:30:00Z");
      end = new Date(now.getTime() + 24 * 3600 * 1000);
    } else if (range === "custom" && fromParam && toParam) {
      const r = getPSTFinancialRange(fromParam, toParam);
      start = r.start;
      end = r.end;
    } else {
      // Default: last 30 days
      const startDay = new Date(now.getTime() - 29 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      start = r.start;
      end = r.end;
    }

    const search = req.query.search;
    const managerId = req.query.managerId;
    const salesChannelId = req.query.salesChannelId;

    let salesChannelFilter = {};
    if (salesChannelId === "research") {
      salesChannelFilter = { salesChannelId: null };
    } else if (salesChannelId === "channels") {
      salesChannelFilter = { salesChannelId: { not: null } };
    } else if (salesChannelId) {
      salesChannelFilter = { salesChannelId: salesChannelId };
    }

    const searchFilter = search
      ? {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      }
      : undefined;

    let assignedIdsByManager = null;
    if (
      managerId &&
      (req.user.role === "ADMIN" || req.user.role === "MANAGER")
    ) {
      const assignments = await prisma.salesManagerCustomerAssignment.findMany({
        where: { salesManagerId: managerId },
        select: { customerId: true },
      });
      assignedIdsByManager = assignments.map((a) => a.customerId);
    }

    const effectiveCustomerIds = assignedIdsByManager || assignedCustomerIds;

    // 1. Fetch orders in range to calculate revenue
    const orders = await prisma.order.findMany({
      where: excludeFailedPaymentOrders({
        createdAt: { gte: start, lte: end },
        status: { notIn: ["CANCELLED", "REFUNDED"] },
        ...(Array.isArray(effectiveCustomerIds)
          ? { customerId: { in: effectiveCustomerIds } }
          : {}),
        ...(searchFilter ? { customer: searchFilter } : {}),
        ...salesChannelFilter,
      }),
      select: {
        customerId: true,
        totalAmount: true,
      },
    });

    const byCustomerMap = new Map();
    for (const o of orders) {
      const key = o.customerId || "unknown";
      const prev = byCustomerMap.get(key) || { revenue: 0, orders: 0 };
      const orderRevenue = Number(o.totalAmount || 0);
      prev.revenue += orderRevenue;
      prev.orders += 1;
      byCustomerMap.set(key, prev);
    }

    // 2. Fetch all customers matching filters (search, manager, etc.)
    const matchingCustomers = await prisma.customer.findMany({
      where: {
        ...(Array.isArray(effectiveCustomerIds)
          ? { id: { in: effectiveCustomerIds } }
          : {}),
        ...(searchFilter ? searchFilter : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        customerType: true,
        createdAt: true,
        salesAssignments: {
          select: {
            salesRep: {
              select: {
                user: {
                  select: { firstName: true, lastName: true, email: true },
                },
              },
            },
          },
          take: 1,
          orderBy: { assignedAt: "desc" },
        },
      },
    });

    // 3. Build topCustomers list merging revenue data
    let fullList = matchingCustomers.map((c) => {
      const agg = byCustomerMap.get(c.id) || { revenue: 0, orders: 0 };
      const salesRep = c.salesAssignments?.[0]?.salesRep?.user;
      return {
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        email: c.email,
        customerType: c.customerType,
        orders: agg.orders,
        revenue: agg.revenue,
        since: c.createdAt,
        salesRep: salesRep
          ? {
            name: `${salesRep.firstName} ${salesRep.lastName}`,
            email: salesRep.email,
          }
          : null,
      };
    });

    // Sort by revenue desc
    fullList.sort((a, b) => b.revenue - a.revenue);

    // 4. Calculate global segments
    const segmentsMap = {};
    fullList.forEach((c) => {
      const type = c.customerType || "UNKNOWN";
      segmentsMap[type] = (segmentsMap[type] || 0) + 1;
    });
    const segments = Object.entries(segmentsMap).map(
      ([customerType, count]) => ({
        customerType,
        _count: { id: count },
      }),
    );

    // 5. Paginate the list
    const totalItems = fullList.length;
    const totalPages = Math.ceil(totalItems / limit);
    const paginatedCustomers = fullList.slice((page - 1) * limit, page * limit);

    res.json({
      success: true,
      data: {
        range,
        segments,
        topCustomers: paginatedCustomers,
        pagination: {
          page,
          limit,
          totalItems,
          totalPages,
        },
      },
    });
  }),
);

// Customer Summary for Analytics
router.get(
  "/customers/:customerId/summary",
  canAccessAnalytics,
  asyncHandler(async (req, res) => {
    const { customerId } = req.params;
    const now = new Date();
    const assignedCustomerIds = await getAssignedCustomerIds(req.user);

    if (
      Array.isArray(assignedCustomerIds) &&
      !assignedCustomerIds.includes(customerId)
    ) {
      return res
        .status(403)
        .json({ success: false, error: "Unauthorized to view this customer" });
    }

    const range = req.query.range || "all_time";
    const fromParam = req.query.from ? new Date(req.query.from) : null;
    const toParam = req.query.to ? new Date(req.query.to) : null;
    const salesChannelId = req.query.salesChannelId;

    let salesChannelFilter = {};
    if (salesChannelId === "research") {
      salesChannelFilter = { salesChannelId: null };
    } else if (salesChannelId === "channels") {
      salesChannelFilter = { salesChannelId: { not: null } };
    } else if (salesChannelId) {
      salesChannelFilter = { salesChannelId: salesChannelId };
    }

    // Date range logic (PST) - Keep in sync with order-frequency
    let startDate, endDate;
    if (range === "custom" && fromParam && toParam) {
      const r = getPSTFinancialRange(fromParam, toParam);
      startDate = r.start;
      endDate = r.end;
    } else if (range === "day" && fromParam) {
      const r = getPSTFinancialRange(fromParam, fromParam);
      startDate = r.start;
      endDate = r.end;
    } else if (range === "last_7_days") {
      const startDay = new Date(now.getTime() - 6 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      startDate = r.start;
      endDate = r.end;
    } else if (range === "last_30_days") {
      const startDay = new Date(now.getTime() - 29 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      startDate = r.start;
      endDate = r.end;
    } else if (range === "last_90_days") {
      const startDay = new Date(now.getTime() - 89 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      startDate = r.start;
      endDate = r.end;
    } else if (range === "last_year") {
      const startDay = new Date(
        now.getFullYear() - 1,
        now.getMonth(),
        now.getDate(),
      );
      const r = getPSTFinancialRange(startDay, now);
      startDate = r.start;
      endDate = r.end;
    }

    const dateFilter =
      startDate && endDate
        ? {
          createdAt: { gte: startDate, lte: endDate },
        }
        : {};

    const customerData = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        customerType: true,
        createdAt: true,
        salesAssignments: {
          select: {
            salesRep: {
              select: {
                user: {
                  select: { firstName: true, lastName: true, email: true },
                },
              },
            },
          },
          take: 1,
          orderBy: { assignedAt: "desc" },
        },
      },
    });

    if (!customerData) {
      return res
        .status(404)
        .json({ success: false, error: "Customer not found" });
    }

    const salesRep = customerData.salesAssignments?.[0]?.salesRep?.user;
    const customer = {
      ...customerData,
      salesRep: salesRep
        ? {
          name: `${salesRep.firstName} ${salesRep.lastName}`,
          email: salesRep.email,
        }
        : null,
    };

    // Get recent orders and items
    const orders = await prisma.order.findMany({
      where: excludeFailedPaymentOrders({
        customerId: customerId,
        status: { notIn: ["CANCELLED", "REFUNDED"] },
        ...dateFilter,
        ...salesChannelFilter,
      }),
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    // Aggregate top ordered products
    const allOrderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          customerId: customerId,
          status: { notIn: ["CANCELLED", "REFUNDED"] },
          payments: { none: { status: "FAILED" } },
          ...dateFilter,
          ...salesChannelFilter,
        },
      },
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
    });

    const productMap = new Map();
    allOrderItems.forEach((item) => {
      const pName = item.variant?.product?.name || "Unknown Product";
      const vName = item.variant?.name || "";
      const key = `${pName} ${vName}`;
      const image = item.variant?.product?.images?.[0]?.url || null;

      const prev = productMap.get(key) || {
        quantity: 0,
        revenue: 0,
        name: key,
        image,
      };
      prev.quantity += item.quantity || 0;
      const bulkTotal = Number(item.bulkTotalPrice || 0);
      const total = Number(item.totalPrice || 0);
      const unit = Number(item.unitPrice || 0);
      prev.revenue += bulkTotal > 0 ? bulkTotal : (total > 0 ? total : unit * (item.quantity || 0));
      productMap.set(key, prev);
    });

    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    // Get all orders for growth analysis (last 12 financial months)
    const masterStartDay = new Date(now);
    masterStartDay.setMonth(now.getMonth() - 11);
    masterStartDay.setDate(1);
    const masterRange = getPSTFinancialRange(masterStartDay, now);
    const twelveMonthsAgo = masterRange.start;

    const growthOrders = await prisma.order.findMany({
      where: excludeFailedPaymentOrders({
        customerId: customerId,
        status: { notIn: ["CANCELLED", "REFUNDED"] },
        createdAt: { gte: twelveMonthsAgo },
      }),
      select: { totalAmount: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const growthMap = new Map();

    growthOrders.forEach((o) => {
      const key = getFinancialDateKey(o.createdAt);
      // Extract month/year from financial date key (YYYY-MM-DD)
      const [y, m, d] = key.split("-");
      const label = `${monthNames[parseInt(m) - 1]} ${y.slice(2)}`;

      if (!growthMap.has(label)) {
        growthMap.set(label, {
          date: label,
          revenue: 0,
          orders: 0,
          sortKey: `${y}-${m}`,
        });
      }
      const existing = growthMap.get(label);
      existing.revenue += Number(o.totalAmount || 0);
      existing.orders += 1;
    });

    const monthlyGrowth = Array.from(growthMap.values())
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(({ sortKey, ...rest }) => rest);

    res.json({
      success: true,
      data: {
        customer,
        recentOrders: orders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          totalAmount: Number(o.totalAmount || 0),
          status: o.status,
          createdAt: o.createdAt,
          itemsCount: o.items.length,
          items: o.items.map((it) => ({
            name: it.variant?.product?.name,
            variantName: it.variant?.name,
            quantity: it.quantity,
            price: Number(it.unitPrice || 0),
          })),
        })),
        topProducts,
        monthlyGrowth,
      },
    });
  }),
);

// Sales Managers performance analytics
router.get(
  "/sales-managers",
  requireRole(["ADMIN", "SALES_MANAGER"]),
  [
    query("range")
      .optional()
      .isIn(["day", "7d", "30d", "90d", "365d", "custom", "all"]),
    query("from")
      .optional()
      .isISO8601()
      .withMessage("from must be a valid ISO-8601 date"),
    query("to")
      .optional()
      .isISO8601()
      .withMessage("to must be a valid ISO-8601 date"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const now = new Date();
    const { range: rawRange, from: fromParam, to: toParam } = req.query;
    const dayMs = 24 * 60 * 60 * 1000;

    let rangeParam = typeof rawRange === "string" ? rawRange : "90d";
    let startDate;
    let endDate;
    let rangeDays;

    if (rangeParam === "custom" && fromParam && toParam) {
      const r = getPSTFinancialRange(fromParam, toParam);
      startDate = r.start;
      endDate = r.end;
    } else if (rangeParam === "day" && fromParam) {
      const r = getPSTFinancialRange(fromParam, fromParam);
      startDate = r.start;
      endDate = r.end;
    } else if (rangeParam === "7d" || rangeParam === "last_7_days") {
      const startDay = new Date(now.getTime() - 6 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      startDate = r.start;
      endDate = r.end;
    } else if (rangeParam === "30d" || rangeParam === "last_30_days") {
      const startDay = new Date(now.getTime() - 29 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      startDate = r.start;
      endDate = r.end;
    } else if (rangeParam === "90d" || rangeParam === "last_90_days") {
      const startDay = new Date(now.getTime() - 89 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      startDate = r.start;
      endDate = r.end;
    } else if (rangeParam === "365d" || rangeParam === "last_year") {
      const startDay = new Date(
        now.getFullYear() - 1,
        now.getMonth(),
        now.getDate(),
      );
      const r = getPSTFinancialRange(startDay, now);
      startDate = r.start;
      endDate = r.end;
    } else if (rangeParam === "all") {
      startDate = new Date("2020-01-01T00:30:00Z");
      endDate = new Date(now.getTime() + 24 * 3600 * 1000);
    } else {
      // Default 90d
      const startDay = new Date(now.getTime() - 89 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      startDate = r.start;
      endDate = r.end;
    }

    rangeDays = Math.max(
      1,
      Math.ceil((endDate.getTime() - startDate.getTime()) / dayMs),
    );

    if (req.user.role === "SALES_MANAGER") {
      const manager = await prisma.salesManager.findUnique({
        where: { userId: req.user.id },
        include: {
          salesReps: {
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
                            notIn: ["CANCELLED", "REFUNDED"],
                          },
                          payments: { none: { status: "FAILED" } },
                        },
                        select: {
                          id: true,
                          orderNumber: true,
                          status: true,
                          totalAmount: true,
                          createdAt: true,
                        },
                        orderBy: { createdAt: "desc" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!manager || !manager.salesReps.length) {
        return res.json({
          success: true,
          data: {
            range: rangeParam,
            rangeDays,
            generatedAt: new Date().toISOString(),
            period: {
              from: startDate.toISOString(),
              to: endDate.toISOString(),
            },
            totals: {
              totalRevenue: 0,
              totalOrders: 0,
              averageConversion: 0,
              managersActive: 0,
            },
            managers: [],
          },
        });
      }

      // Process sales reps data for this manager
      let aggregateRevenue = 0;
      let aggregateOrders = 0;
      let repsWithCustomers = 0;

      const repsPerformance = manager.salesReps.map((rep) => {
        const customers = rep.assignments.map(
          (assignment) => assignment.customer,
        );
        const orders = customers.flatMap((customer) =>
          (customer.orders || []).map((order) => ({
            ...order,
            customerId: customer.id,
            customerName: `${customer.firstName} ${customer.lastName}`.trim(),
          })),
        );

        const totalRevenue = orders.reduce(
          (sum, order) => sum + Number(order.totalAmount || 0),
          0,
        );
        const totalOrders = orders.length;
        const averageOrderValue = totalOrders ? totalRevenue / totalOrders : 0;
        const assignedCustomers = customers.length;
        const activeCustomers = customers.filter(
          (customer) => (customer.orders || []).length > 0,
        ).length;

        aggregateRevenue += totalRevenue;
        aggregateOrders += totalOrders;
        if (assignedCustomers > 0) {
          repsWithCustomers += 1;
        }

        const recentOrders = orders
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .map((order) => {
            const customerName =
              order.customerName ||
              (order.customer
                ? `${order.customer.firstName || ""} ${order.customer.lastName || ""}`.trim() ||
                order.customer.email ||
                "Guest"
                : "Guest");
            return {
              id: order.id,
              orderNumber: order.orderNumber,
              totalAmount: Number(order.totalAmount || 0),
              status: order.status,
              createdAt: order.createdAt,
              customerName,
              customerId: order.customerId,
            };
          });

        return {
          salesManagerId: rep.id,
          user: rep.user,
          metrics: {
            totalRevenue,
            totalOrders,
            averageOrderValue,
            assignedReps: assignedCustomers,
            activeReps: activeCustomers,
          },
          monthlyPerformance: [],
          topReps: [],
          recentOrders,
        };
      });

      const data = {
        range: rangeParam,
        rangeDays,
        generatedAt: new Date().toISOString(),
        period: { from: startDate.toISOString(), to: endDate.toISOString() },
        totals: {
          totalRevenue: aggregateRevenue,
          totalOrders: aggregateOrders,
          averageConversion: repsWithCustomers
            ? (repsWithCustomers / manager.salesReps.length) * 100
            : 0,
          managersActive: repsPerformance.filter(
            (rep) => rep.metrics.activeReps > 0,
          ).length,
        },
        managers: repsPerformance,
      };

      return res.json({ success: true, data });
    }

    // For ADMIN users, show all managers' data
    const managers = await prisma.salesManager.findMany({
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
        salesReps: {
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
                          notIn: ["CANCELLED", "REFUNDED"],
                        },
                        payments: { none: { status: "FAILED" } },
                      },
                      select: {
                        id: true,
                        orderNumber: true,
                        status: true,
                        totalAmount: true,
                        createdAt: true,
                      },
                      orderBy: { createdAt: "desc" },
                    },
                  },
                },
              },
            },
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
                    createdAt: { gte: startDate, lte: endDate },
                    status: { notIn: ["CANCELLED", "REFUNDED"] },
                    payments: { none: { status: "FAILED" } },
                  },
                  select: {
                    id: true,
                    orderNumber: true,
                    status: true,
                    totalAmount: true,
                    createdAt: true,
                  },
                  orderBy: { createdAt: "desc" },
                },
              },
            },
          },
        },
      },
      orderBy: {
        user: {
          firstName: "asc",
        },
      },
    });

    let aggregateRevenue = 0;
    let aggregateOrders = 0;
    let managersWithReps = 0;

    const managersPerformance = managers.map((manager) => {
      // Aggregate data from all sales reps under this manager
      let managerRevenue = 0;
      let managerOrders = 0;
      let assignedReps = manager.salesReps.length;
      let activeReps = 0;

      const allOrders = [];

      manager.salesReps.forEach((rep) => {
        const customers = rep.assignments.map(
          (assignment) => assignment.customer,
        );
        const repOrders = customers.flatMap((customer) =>
          (customer.orders || []).map((order) => ({
            ...order,
            customerId: customer.id,
            customerName: `${customer.firstName} ${customer.lastName}`.trim(),
            repName: `${rep.user.firstName} ${rep.user.lastName}`.trim(),
          })),
        );

        const repRevenue = repOrders.reduce(
          (sum, order) => sum + Number(order.totalAmount || 0),
          0,
        );
        const repOrderCount = repOrders.length;

        if (repOrderCount > 0) {
          activeReps += 1;
        }

        managerRevenue += repRevenue;
        managerOrders += repOrderCount;
        allOrders.push(...repOrders);
      });

      // Aggregate data from personal assignments
      let personalRevenue = 0;
      let personalOrders = 0;
      const personalAssignedCustomers = manager.assignments.length;
      let personalActiveCustomers = 0;

      const personalOrdersList = manager.assignments.flatMap((assignment) => {
        const customer = assignment.customer;
        const orders = (customer.orders || []).map((order) => ({
          ...order,
          customerId: customer.id,
          customerName: `${customer.firstName} ${customer.lastName}`.trim(),
          repName: "Direct Assignment",
        }));

        if (orders.length > 0) {
          personalActiveCustomers += 1;
        }
        return orders;
      });

      personalRevenue = personalOrdersList.reduce(
        (sum, order) => sum + Number(order.totalAmount || 0),
        0,
      );
      personalOrders = personalOrdersList.length;

      const personalAverageOrderValue = personalOrders
        ? personalRevenue / personalOrders
        : 0;

      const averageOrderValue = managerOrders
        ? managerRevenue / managerOrders
        : 0;

      aggregateRevenue += managerRevenue;
      aggregateOrders += managerOrders;
      if (assignedReps > 0) {
        managersWithReps += 1;
      }

      const revenueByMonth = allOrders.reduce((acc, order) => {
        const key = getFinancialDateKey(order.createdAt);
        if (!acc[key]) {
          acc[key] = { date: key, revenue: 0, orders: 0 };
        }
        acc[key].revenue += Number(order.totalAmount || 0);
        acc[key].orders += 1;
        return acc;
      }, {});

      const monthlyPerformance = Object.values(revenueByMonth).sort((a, b) =>
        a.date.localeCompare(b.date),
      );

      const reps = manager.salesReps
        .map((rep) => {
          const customers = rep.assignments.map(
            (assignment) => assignment.customer,
          );
          const repOrders = customers.flatMap((customer) =>
            (customer.orders || []).map((order) => ({
              ...order,
              customerId: customer.id,
            })),
          );
          const revenue = repOrders.reduce(
            (sum, order) => sum + Number(order.totalAmount || 0),
            0,
          );
          return {
            id: rep.id,
            name: `${rep.user.firstName} ${rep.user.lastName}`.trim(),
            email: rep.user.email,
            revenue,
            orders: repOrders.length,
          };
        })
        .sort((a, b) => b.revenue - a.revenue);

      const recentOrders = allOrders
        .slice()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map((order) => {
          const customerName =
            order.customerName ||
            (order.customer
              ? `${order.customer.firstName || ""} ${order.customer.lastName || ""}`.trim() ||
              order.customer.email ||
              "Guest"
              : "Guest");
          return {
            id: order.id,
            orderNumber: order.orderNumber,
            totalAmount: Number(order.totalAmount || 0),
            status: order.status,
            createdAt: order.createdAt,
            repName: order.repName,
            customerName,
            customerId: order.customerId,
            customer: order.customer, // Include full if needed for dialog
          };
        });

      return {
        salesManagerId: manager.id,
        user: manager.user,
        metrics: {
          totalRevenue: managerRevenue,
          totalOrders: managerOrders,
          averageOrderValue,
          assignedReps,
          activeReps,
          personalRevenue,
          personalOrders,
          personalAverageOrderValue,
          personalAssignedCustomers,
          personalActiveCustomers,
        },
        monthlyPerformance,
        reps,
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
        averageConversion: managersWithReps
          ? (managersWithReps / managers.length) * 100
          : 0,
        managersActive: managersPerformance.filter(
          (manager) => manager.metrics.activeReps > 0,
        ).length,
      },
      managers: managersPerformance,
    };

    res.json({ success: true, data });
  }),
);

// Get available regions (states and cities) for filters
router.get(
  "/sales/regions/filters",
  canAccessAnalytics,
  asyncHandler(async (req, res) => {
    const assignedCustomerIds = await getAssignedCustomerIds(req.user);
    const salesChannelId = req.query.salesChannelId;

    let salesChannelFilter = {};
    if (salesChannelId === "research") {
      salesChannelFilter = { salesChannelId: null };
    } else if (salesChannelId === "channels") {
      salesChannelFilter = { salesChannelId: { not: null } };
    } else if (salesChannelId) {
      salesChannelFilter = { salesChannelId: salesChannelId };
    }

    // We want to find unique states and cities where orders exist
    const addresses = await prisma.address.findMany({
      where: {
        shippingOrders: {
          some: {
            status: { notIn: ["CANCELLED", "REFUNDED"] },
            payments: { none: { status: "FAILED" } },
            ...(Array.isArray(assignedCustomerIds)
              ? { customerId: { in: assignedCustomerIds } }
              : {}),
            ...salesChannelFilter,
          },
        },
      },
      select: {
        state: true,
        city: true,
      },
      distinct: ["state", "city"],
    });

    const states = [
      ...new Set(addresses.map((a) => a.state?.trim()).filter(Boolean)),
    ].sort();
    const stateCityMap = {};

    addresses.forEach((a) => {
      const s = a.state?.trim();
      const c = a.city?.trim();
      if (s && c) {
        if (!stateCityMap[s]) stateCityMap[s] = new Set();
        stateCityMap[s].add(c);
      }
    });

    const result = {
      states: states,
      citiesByState: Object.keys(stateCityMap).reduce((acc, state) => {
        acc[state] = [...stateCityMap[state]].sort();
        return acc;
      }, {}),
    };

    res.json({ success: true, data: result });
  }),
);

// Sales by Region
router.get(
  "/sales/by-region",
  canAccessAnalytics,
  asyncHandler(async (req, res) => {
    const assignedCustomerIds = await getAssignedCustomerIds(req.user);
    const now = new Date();
    const range = req.query.range || "last_30_days";
    const fromParam = req.query.from ? new Date(req.query.from) : null;
    const toParam = req.query.to ? new Date(req.query.to) : null;
    const salesChannelId = req.query.salesChannelId;

    let salesChannelFilter = {};
    if (salesChannelId === "research") {
      salesChannelFilter = { salesChannelId: null };
    } else if (salesChannelId === "channels") {
      salesChannelFilter = { salesChannelId: { not: null } };
    } else if (salesChannelId) {
      salesChannelFilter = { salesChannelId: salesChannelId };
    }

    let start, end;

    if (range === "custom" && fromParam && toParam) {
      const r = getPSTFinancialRange(fromParam, toParam);
      start = r.start;
      end = r.end;
    } else if (range === "day" && fromParam) {
      const r = getPSTFinancialRange(fromParam, fromParam);
      start = r.start;
      end = r.end;
    } else if (range === "last_7_days") {
      const startDay = new Date(now.getTime() - 6 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      start = r.start;
      end = r.end;
    } else if (range === "last_90_days") {
      const startDay = new Date(now.getTime() - 89 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      start = r.start;
      end = r.end;
    } else if (range === "last_year") {
      const startDay = new Date(
        now.getFullYear() - 1,
        now.getMonth(),
        now.getDate(),
      );
      const r = getPSTFinancialRange(startDay, now);
      start = r.start;
      end = r.end;
    } else if (range === "all" || range === "all_time") {
      start = new Date("2020-01-01T00:30:00Z");
      end = new Date(now.getTime() + 24 * 3600 * 1000);
    } else {
      // Default: last 30 days
      const startDay = new Date(now.getTime() - 29 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      start = r.start;
      end = r.end;
    }

    let stateFilter = req.query.state;
    let cityFilter = req.query.city;

    const whereClause = {
      createdAt: { gte: start, lte: end },
      status: { notIn: ["CANCELLED", "REFUNDED"] },
      ...(Array.isArray(assignedCustomerIds)
        ? { customerId: { in: assignedCustomerIds } }
        : {}),
      ...salesChannelFilter,
    };

    // Clean filters and ignore "all" options
    const isAll = (val) => {
      if (typeof val !== "string") return true; // If not a string (or missing), treat as "all"
      const lower = val.toLowerCase();
      return lower.includes("all ") || lower === "all" || lower.trim() === "";
    };

    if (stateFilter && !isAll(stateFilter)) {
      stateFilter = stateFilter.trim();
      whereClause.shippingAddress = {
        state: { contains: stateFilter, mode: "insensitive" },
      };

      if (cityFilter && !isAll(cityFilter)) {
        cityFilter = cityFilter.trim();
        whereClause.shippingAddress.city = {
          contains: cityFilter,
          mode: "insensitive",
        };
      }
    }

    const orders = await prisma.order.findMany({
      where: excludeFailedPaymentOrders(whereClause),
      select: {
        totalAmount: true,
        shippingState: true,
        shippingCity: true,
        shippingCountry: true,
      },
    });

    const regionMap = new Map();
    const groupByCity = stateFilter && !isAll(stateFilter);

    for (const order of orders) {
      let key = "Other";
      if (order.shippingState || order.shippingCity) {
        const groupKey = groupByCity
          ? order.shippingCity || "Unknown"
          : order.shippingState || "Unknown";
        key = groupKey.trim() || "Unknown";
      }

      const prev = regionMap.get(key) || { revenue: 0, orders: 0, region: key };
      prev.revenue += Number(order.totalAmount || 0);
      prev.orders += 1;
      regionMap.set(key, prev);
    }

    const result = Array.from(regionMap.values()).sort(
      (a, b) => b.revenue - a.revenue,
    );

    res.json({ success: true, data: result });
  }),
);

// SKU Performance: calculates quantity purchased for a given range and the percentage change vs the previous period
router.get(
  "/sku-performance",
  canAccessAnalytics,
  asyncHandler(async (req, res) => {
    const assignedCustomerIds = await getAssignedCustomerIds(req.user);
    const now = new Date();

    const range = req.query.range || "6_months";
    const fromParam = req.query.from ? new Date(req.query.from) : null;
    const toParam = req.query.to ? new Date(req.query.to) : null;

    let startDate, endDate;

    if (range === "day" && fromParam) {
      const r = getPSTFinancialRange(fromParam, fromParam);
      startDate = r.start;
      endDate = r.end;
    } else if (range === "7_days") {
      const startDay = new Date(now.getTime() - 6 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      startDate = r.start;
      endDate = r.end;
    } else if (range === "1_month" || range === "last_30_days") {
      const startDay = new Date(now.getTime() - 29 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      startDate = r.start;
      endDate = r.end;
    } else if (range === "3_months" || range === "last_90_days") {
      const startDay = new Date(now.getTime() - 89 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      startDate = r.start;
      endDate = r.end;
    } else if (range === "6_months" || range === "last_180_days") {
      const startDay = new Date(now.getTime() - 179 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      startDate = r.start;
      endDate = r.end;
    } else if (range === "12_months" || range === "last_year") {
      const startDay = new Date(
        now.getFullYear() - 1,
        now.getMonth(),
        now.getDate(),
      );
      const r = getPSTFinancialRange(startDay, now);
      startDate = r.start;
      endDate = r.end;
    } else if (range === "all_time" || range === "all") {
      startDate = new Date("2020-01-01T00:30:00Z");
      endDate = new Date(now.getTime() + 24 * 3600 * 1000);
    } else if (range === "custom" && fromParam && toParam) {
      const r = getPSTFinancialRange(fromParam, toParam);
      startDate = r.start;
      endDate = r.end;
    } else {
      // Default: 6 months
      const startDay = new Date(now.getTime() - 179 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      startDate = r.start;
      endDate = r.end;
    }

    const salesChannelId = req.query.salesChannelId;

    let salesChannelFilter = {};
    if (salesChannelId === "research") {
      salesChannelFilter = { salesChannelId: null };
    } else if (salesChannelId === "channels") {
      salesChannelFilter = { salesChannelId: { not: null } };
    } else if (salesChannelId) {
      salesChannelFilter = { salesChannelId: salesChannelId };
    }

    // Query order items for the selected period
    const orderItems = await prisma.orderItem.groupBy({
      by: ["variantId"],
      _sum: { quantity: true },
      where: {
        order: {
          status: { notIn: ["CANCELLED", "REFUNDED"] },
          payments: { none: { status: "FAILED" } },
          createdAt: { gte: startDate, lte: endDate },
          ...(Array.isArray(assignedCustomerIds)
            ? { customerId: { in: assignedCustomerIds } }
            : {}),
          ...salesChannelFilter,
        },
      },
    });

    // Get variant details
    const variantIds = orderItems.map((item) => item.variantId).filter(Boolean);

    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: {
        id: true,
        sku: true,
        name: true,
        product: { select: { name: true } },
      },
    });

    // Build the response data
    const performanceData = orderItems
      .map((item) => {
        const variant = variants.find((v) => v.id === item.variantId);
        if (!variant) return null;

        return {
          id: variant.id,
          sku: variant.sku,
          name: variant.name,
          productName: variant.product.name,
          totalSold: item._sum.quantity || 0,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        };
      })
      .filter(Boolean);

    res.json({
      success: true,
      data: performanceData,
    });
  }),
);

// Get detailed SKU comparison data (weekly or monthly)
router.get(
  "/sku/:variantId/comparison",
  canAccessAnalytics,
  asyncHandler(async (req, res) => {
    const { variantId } = req.params;
    const period = req.query.period || "week"; // 'week' or 'month'
    const salesChannelId = req.query.salesChannelId;
    const assignedCustomerIds = await getAssignedCustomerIds(req.user);

    let salesChannelFilter = {};
    if (salesChannelId === "research") {
      salesChannelFilter = { salesChannelId: null };
    } else if (salesChannelId === "channels") {
      salesChannelFilter = { salesChannelId: { not: null } };
    }

    if (salesChannelId) {
      salesChannelFilter = { salesChannelId: salesChannelId };
    }

    // Fetch variant details
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: true },
    });

    if (!variant) {
      return res
        .status(404)
        .json({ success: false, error: "Variant not found" });
    }

    const now = new Date();

    let currentStart, currentEnd, previousStart, previousEnd;
    let groupByFormat;

    if (period === "week") {
      const startDay = new Date(now.getTime() - 6 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      currentStart = r.start;
      currentEnd = r.end;

      const prevStartDay = new Date(startDay.getTime() - 7 * 24 * 3600 * 1000);
      const prevEndDay = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      const pr = getPSTFinancialRange(prevStartDay, prevEndDay);
      previousStart = pr.start;
      previousEnd = pr.end;
    } else {
      // month
      const startDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const r = getPSTFinancialRange(startDay, now);
      currentStart = r.start;
      currentEnd = r.end;

      const prevStartDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevEndDay = new Date(now.getFullYear(), now.getMonth(), 0);
      const pr = getPSTFinancialRange(prevStartDay, prevEndDay);
      previousStart = pr.start;
      previousEnd = pr.end;
    }

    // Helper to get sales data for a period
    const getSalesData = async (start, end, filter = {}) => {
      const orders = await prisma.order.findMany({
        where: {
          status: { notIn: ["CANCELLED", "REFUNDED"] },
          payments: { none: { status: "FAILED" } },
          createdAt: { gte: start, lte: end },
          ...(Array.isArray(assignedCustomerIds)
            ? { customerId: { in: assignedCustomerIds } }
            : {}),
          ...filter, // Use passed filter
          items: {
            some: { variantId },
          },
        },
        include: {
          items: {
            where: { variantId },
            select: { quantity: true },
          },
        },
      });

      const total = orders.reduce((sum, order) => {
        return (
          sum +
          order.items.reduce((itemSum, item) => itemSum + item.quantity, 0)
        );
      }, 0);

      // Group by day for chart
      const dailyData = {};
      orders.forEach((order) => {
        const date = new Date(order.createdAt);
        let key;
        if (req.query.usePSTFilter === "true") {
          key = getFinancialDateKey(date);
        } else {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        }
        if (!dailyData[key]) dailyData[key] = 0;
        order.items.forEach((item) => {
          dailyData[key] += item.quantity;
        });
      });

      // Fill missing days with 0
      const days = [];
      const current = new Date(start);
      while (current <= end) {
        const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
        days.push({
          date: key,
          value: dailyData[key] || 0,
        });
        current.setDate(current.getDate() + 1);
      }

      return { total, daily: days };
    };

    const [currentData, previousData] = await Promise.all([
      getSalesData(currentStart, currentEnd, salesChannelFilter),
      getSalesData(previousStart, previousEnd, salesChannelFilter),
    ]);

    // Calculate total outflow (all time)
    const totalOutflow = await prisma.orderItem.aggregate({
      _sum: { quantity: true },
      where: {
        variantId,
        order: {
          status: { notIn: ["CANCELLED", "REFUNDED"] },
          payments: { none: { status: "FAILED" } },
          ...(Array.isArray(assignedCustomerIds)
            ? { customerId: { in: assignedCustomerIds } }
            : {}),
          ...salesChannelFilter,
        },
      },
    });

    res.json({
      success: true,
      data: {
        variantId: variant.id,
        sku: variant.sku,
        name: variant.name,
        productName: variant.product.name,
        totalOutflow: totalOutflow._sum.quantity || 0,
        period,
        comparison: {
          current: {
            label: period === "week" ? "This Week" : "This Month",
            total: currentData.total,
            daily: currentData.daily,
          },
          previous: {
            label: period === "week" ? "Last Week" : "Last Month",
            total: previousData.total,
            daily: previousData.daily,
          },
        },
      },
    });
  }),
);

router.get(
  "/sku/:variantId/performance-history",
  canAccessAnalytics,
  asyncHandler(async (req, res) => {
    const { variantId } = req.params;
    const assignedCustomerIds = await getAssignedCustomerIds(req.user);
    const salesChannelId = req.query.salesChannelId;
    const period = req.query.period || "week"; // 'week' or 'month'

    let salesChannelFilter = {};
    if (salesChannelId === "research") {
      salesChannelFilter = { salesChannelId: null };
    } else if (salesChannelId === "channels") {
      salesChannelFilter = { salesChannelId: { not: null } };
    } else if (salesChannelId) {
      salesChannelFilter = { salesChannelId: salesChannelId };
    }

    const now = new Date();
    const formatDateLabel = (date) => {
      const d = date.getUTCDate(); // Use UTC as these are financial boundaries
      const m = date.toLocaleDateString("en-US", {
        month: "short",
        timeZone: "UTC",
      });
      const suffix =
        d % 10 === 1 && d !== 11
          ? "st"
          : d % 10 === 2 && d !== 12
            ? "nd"
            : d % 10 === 3 && d !== 13
              ? "rd"
              : "th";
      return `${d}${suffix} ${m}`;
    };

    // Determine the overall range (last 6 months of financial days)
    const masterRangeDay = new Date(now);
    masterRangeDay.setMonth(now.getMonth() - 6);
    const masterRange = getPSTFinancialRange(masterRangeDay, now);
    const historyStart = masterRange.start;
    const historyEnd = masterRange.end;

    const performanceData = [];
    let pointer = new Date(now);

    while (pointer >= masterRangeDay) {
      let bFrom, bTo, label;
      if (period === "week") {
        const dayOfWeek = pointer.getDay();
        const startOfWeek = new Date(pointer);
        startOfWeek.setDate(pointer.getDate() - dayOfWeek);
        const r = getPSTFinancialRange(startOfWeek, pointer);
        bFrom = r.start;
        bTo = r.end;
        label = `${formatDateLabel(startOfWeek)} - ${formatDateLabel(pointer)}`;
        pointer.setDate(pointer.getDate() - 7);
      } else {
        const startOfMonth = new Date(
          pointer.getFullYear(),
          pointer.getMonth(),
          1,
        );
        const endOfMonth = new Date(
          pointer.getFullYear(),
          pointer.getMonth() + 1,
          0,
        );
        const r = getPSTFinancialRange(startOfMonth, endOfMonth);
        bFrom = r.start;
        bTo = r.end;
        label = startOfMonth.toLocaleString("default", {
          month: "long",
          year: "numeric",
        });
        pointer.setMonth(pointer.getMonth() - 1);
      }
      performanceData.push({ start: bFrom, end: bTo, label, total: 0 });
      if (performanceData.length >= 12) break; // Limit to 12 buckets
    }

    const orderItems = await prisma.orderItem.findMany({
      where: {
        variantId,
        order: {
          status: { notIn: ["CANCELLED", "REFUNDED"] },
          payments: { none: { status: "FAILED" } },
          createdAt: {
            gte: historyStart,
            lte: historyEnd,
          },
          ...(Array.isArray(assignedCustomerIds)
            ? { customerId: { in: assignedCustomerIds } }
            : {}),
          ...salesChannelFilter,
        },
      },
      select: {
        quantity: true,
        order: { select: { createdAt: true } },
      },
    });

    let grandTotal = 0;
    orderItems.forEach((item) => {
      const createdAt = new Date(item.order.createdAt);
      grandTotal += item.quantity;
      for (const bucket of performanceData) {
        if (createdAt >= bucket.start && createdAt <= bucket.end) {
          bucket.total += item.quantity;
          break;
        }
      }
    });

    for (let i = 0; i < performanceData.length - 1; i++) {
      const currentTotal = performanceData[i].total;
      const previousTotal = performanceData[i + 1].total;
      if (previousTotal === 0) {
        performanceData[i].delta = currentTotal > 0 ? 100 : 0;
      } else {
        performanceData[i].delta =
          ((currentTotal - previousTotal) / previousTotal) * 100;
      }
    }

    res.json({
      success: true,
      data: {
        summary: {
          totalUnits: grandTotal,
          totalUnits: grandTotal,
          startDate: historyStart.toISOString(),
          endDate: now.toISOString(),
          label: `Total units in last 6 months (${formatDateLabel(historyStart)} ${historyStart.getFullYear()} - ${formatDateLabel(now)} ${now.getFullYear()}): ${grandTotal}`,
        },
        weeks: performanceData.map((w) => ({
          label: w.label,
          total: w.total,
          delta: w.delta !== undefined ? w.delta : null,
        })),
      },
    });
  }),
);

// Get detailed report for a specific sales manager or representative
router.get(
  "/sales-person-report",
  canAccessAnalytics,
  asyncHandler(async (req, res) => {
    const { managerId, salesRepId, range, from, to, salesChannelId } =
      req.query;
    const now = new Date();
    const fromParam = from ? new Date(from) : null;
    const toParam = to ? new Date(to) : null;

    let start, end;
    if (range === "day" && fromParam) {
      const r = getPSTFinancialRange(fromParam, fromParam);
      start = r.start;
      end = r.end;
    } else if (range === "last_7_days") {
      const startDay = new Date(now.getTime() - 6 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      start = r.start;
      end = r.end;
    } else if (range === "last_14_days") {
      const startDay = new Date(now.getTime() - 13 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      start = r.start;
      end = r.end;
    } else if (range === "last_30_days") {
      const startDay = new Date(now.getTime() - 29 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      start = r.start;
      end = r.end;
    } else if (range === "last_90_days") {
      const startDay = new Date(now.getTime() - 89 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      start = r.start;
      end = r.end;
    } else if (range === "last_year") {
      const startDay = new Date(
        now.getFullYear() - 1,
        now.getMonth(),
        now.getDate(),
      );
      const r = getPSTFinancialRange(startDay, now);
      start = r.start;
      end = r.end;
    } else if (range === "all" || range === "all_time") {
      start = new Date("2020-01-01T00:30:00Z");
      end = new Date(now.getTime() + 24 * 3600 * 1000);
    } else if (range === "custom" && fromParam && toParam) {
      const r = getPSTFinancialRange(fromParam, toParam);
      start = r.start;
      end = r.end;
    } else {
      const startDay = new Date(now.getTime() - 29 * 24 * 3600 * 1000);
      const r = getPSTFinancialRange(startDay, now);
      start = r.start;
      end = r.end;
    }

    let targetCustomerIds = [];
    let personName = "";

    if (salesRepId) {
      const rep = await prisma.salesRepresentative.findUnique({
        where: { id: salesRepId },
        include: { user: true, assignments: true },
      });
      if (rep) {
        targetCustomerIds = rep.assignments.map((a) => a.customerId);
        personName = `${rep.user.firstName} ${rep.user.lastName}`;
      }
    } else if (managerId) {
      const manager = await prisma.salesManager.findUnique({
        where: { id: managerId },
        include: {
          user: true,
          assignments: true,
          salesReps: {
            include: { assignments: true },
          },
        },
      });
      if (manager) {
        const managerCustIds = manager.assignments.map((a) => a.customerId);
        const repCustIds = manager.salesReps.flatMap((r) =>
          r.assignments.map((a) => a.customerId),
        );
        targetCustomerIds = Array.from(
          new Set([...managerCustIds, ...repCustIds]),
        );
        personName = `${manager.user.firstName} ${manager.user.lastName}`;
      }
    } else {
      const assignedIds = await getAssignedCustomerIds(req.user);
      if (Array.isArray(assignedIds)) {
        targetCustomerIds = assignedIds;
      }
      personName = `${req.user.firstName} ${req.user.lastName}`;
    }

    if (targetCustomerIds.length === 0) {
      return res.json({
        success: true,
        data: {
          personName,
          totalRevenue: 0,
          totalOrders: 0,
          firstTimeOrdersCount: 0,
          repeatOrdersCount: 0,
          dailyBreakdown: [],
          detailedOrders: [],
        },
      });
    }

    const orders = await prisma.order.findMany({
      where: excludeFailedPaymentOrders({
        customerId: { in: targetCustomerIds },
        createdAt: { gte: start, lte: end },
        status: { notIn: ["CANCELLED", "REFUNDED"] },
        ...(salesChannelId ? { salesChannelId } : {}),
      }),
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            salesAssignments: {
              include: {
                salesRep: {
                  include: {
                    user: {
                      select: {
                        firstName: true,
                        lastName: true,
                      },
                    },
                  },
                },
              },
            },
            orders: {
              where: excludeFailedPaymentOrders({
                status: { notIn: ["CANCELLED", "REFUNDED"] },
              }),
              select: { createdAt: true },
              orderBy: { createdAt: "asc" },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    let totalRevenue = 0;
    const detailedOrders = orders.map((order) => {
      const orderTotal = Number(order.totalAmount || 0);
      totalRevenue += orderTotal;

      const firstOrderAt = order.customer?.orders?.[0]?.createdAt;
      const isFirstTime =
        firstOrderAt && firstOrderAt.getTime() === order.createdAt.getTime();

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        date: order.createdAt.toISOString(),
        revenue: orderTotal,
        status: order.status,
        customerName: order.customer
          ? `${order.customer.firstName} ${order.customer.lastName}`
          : "Guest",
        customerEmail: order.customer?.email || "",
        type: isFirstTime ? "First-time" : "Repeat",
        salesRepName: order.customer?.salesAssignments?.[0]?.salesRep?.user
          ? `${order.customer.salesAssignments[0].salesRep.user.firstName} ${order.customer.salesAssignments[0].salesRep.user.lastName}`
          : "N/A",
      };
    });

    const firstTimeOrdersCount = detailedOrders.filter(
      (o) => o.type === "First-time",
    ).length;
    const repeatOrdersCount = detailedOrders.length - firstTimeOrdersCount;

    // Initialize daily breakdown with zero-filling
    const dailyMap = new Map();
    let iter = new Date(start);
    // Add 1 hour buffer to avoid timezone edge cases while iterating
    iter.setUTCHours(iter.getUTCHours() + 1);

    while (iter <= end) {
      const dayKey = getFinancialDateKey(iter);
      if (!dailyMap.has(dayKey)) {
        dailyMap.set(dayKey, { date: dayKey, revenue: 0, orders: 0 });
      }
      iter.setUTCDate(iter.getUTCDate() + 1);
    }

    detailedOrders.forEach((o) => {
      const dayKey = getFinancialDateKey(new Date(o.date));
      const dayData = dailyMap.get(dayKey);
      if (dayData) {
        dayData.revenue += o.revenue;
        dayData.orders += 1;
      }
    });

    const dailyBreakdown = Array.from(dailyMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    res.json({
      success: true,
      data: {
        personName,
        totalRevenue,
        totalOrders: detailedOrders.length,
        firstTimeOrdersCount,
        repeatOrdersCount,
        dailyBreakdown,
        detailedOrders,
      },
    });
  }),
);

module.exports = router;
