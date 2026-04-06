/**
 * Odoo Sync Logger
 * Logs all API calls to Odoo with request/response details
 */

const prisma = require("../../prisma/client");

/**
 * Log an Odoo API call
 * @param {Object} params - Log parameters
 * @param {string} params.triggerType - Type of trigger (MANUAL_FULL, ORDER_CREATED, etc.)
 * @param {string} [params.triggerReason] - Human-readable reason
 * @param {string} [params.variantId] - Variant ID if applicable
 * @param {string} [params.variantSku] - Variant SKU
 * @param {string} [params.productId] - Product ID if applicable
 * @param {string} [params.productName] - Product name
 * @param {string} [params.orderId] - Order ID if applicable
 * @param {string} [params.httpMethod] - HTTP method (GET, POST, PUT, DELETE)
 * @param {string} [params.endpoint] - API endpoint
 * @param {number} [params.statusCode] - HTTP status code
 * @param {Object} [params.requestPayload] - Request body
 * @param {Object} [params.responsePayload] - Response body
 * @param {string} params.status - SUCCESS, FAILED, or PENDING
 * @param {string} [params.errorMessage] - Error message if failed
 * @param {number} [params.duration] - Request duration in ms
 * @param {string} [params.initiatedBy] - User ID or "system"
 * @param {string} [params.salesChannelId] - Sales channel ID
 */
async function logOdooSync(params) {
  try {
    const log = await prisma.odooSyncLog.create({
      data: {
        triggerType: params.triggerType,
        triggerReason: params.triggerReason || null,
        variantId: params.variantId || null,
        variantSku: params.variantSku || null,
        productId: params.productId || null,
        productName: params.productName || null,
        orderId: params.orderId || null,
        httpMethod: params.httpMethod || null,
        endpoint: params.endpoint || null,
        statusCode: params.statusCode || null,
        requestPayload: params.requestPayload || null,
        responsePayload: params.responsePayload || null,
        status: params.status,
        errorMessage: params.errorMessage || null,
        duration: params.duration || null,
        initiatedBy: params.initiatedBy || "system",
        salesChannelId: params.salesChannelId || null,
      },
    });

    return log;
  } catch (error) {
    console.error("[OdooLogger] Failed to create log entry:", error.message);
    // Don't throw - logging failures shouldn't break the main flow
    return null;
  }
}

/**
 * Get sync logs with filtering and pagination
 * @param {Object} options - Query options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=50] - Items per page
 * @param {string} [options.status] - Filter by status
 * @param {string} [options.triggerType] - Filter by trigger type
 * @param {string} [options.salesChannelId] - Filter by sales channel
 * @param {string} [options.variantId] - Filter by variant
 * @param {string} [options.productId] - Filter by product
 * @param {string} [options.orderId] - Filter by order
 * @param {string} [options.search] - Search in SKU, product name, error message
 * @param {Date} [options.startDate] - Filter from date
 * @param {Date} [options.endDate] - Filter to date
 */
async function getLogs(options = {}) {
  const {
    page = 1,
    limit = 50,
    status,
    triggerType,
    salesChannelId,
    variantId,
    productId,
    orderId,
    search,
    startDate,
    endDate,
  } = options;

  const where = {};

  if (status) {
    where.status = status;
  }

  if (triggerType) {
    where.triggerType = triggerType;
  }

  if (salesChannelId) {
    where.salesChannelId = salesChannelId;
  }

  if (variantId) {
    where.variantId = variantId;
  }

  if (productId) {
    where.productId = productId;
  }

  if (orderId) {
    where.orderId = orderId;
  }

  if (search) {
    where.OR = [
      { variantSku: { contains: search, mode: "insensitive" } },
      { productName: { contains: search, mode: "insensitive" } },
      { errorMessage: { contains: search, mode: "insensitive" } },
      { triggerReason: { contains: search, mode: "insensitive" } },
    ];
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      where.createdAt.lte = new Date(endDate);
    }
  }

  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.odooSyncLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        variant: {
          select: {
            id: true,
            sku: true,
            name: true,
            product: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
          },
        },
        salesChannel: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
    }),
    prisma.odooSyncLog.count({ where }),
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get a single log entry with full details
 * @param {string} id - Log ID
 */
async function getLogById(id) {
  return prisma.odooSyncLog.findUnique({
    where: { id },
    include: {
      variant: {
        select: {
          id: true,
          sku: true,
          name: true,
          product: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
        },
      },
      salesChannel: {
        select: {
          id: true,
          companyName: true,
        },
      },
    },
  });
}

/**
 * Get sync statistics
 * @param {string} [salesChannelId] - Filter by sales channel
 * @param {number} [days=7] - Number of days to look back
 */
async function getStats(salesChannelId = null, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const where = {
    createdAt: { gte: startDate },
  };

  if (salesChannelId) {
    where.salesChannelId = salesChannelId;
  }

  const [total, success, failed, byTrigger] = await Promise.all([
    prisma.odooSyncLog.count({ where }),
    prisma.odooSyncLog.count({ where: { ...where, status: "SUCCESS" } }),
    prisma.odooSyncLog.count({ where: { ...where, status: "FAILED" } }),
    prisma.odooSyncLog.groupBy({
      by: ["triggerType"],
      where,
      _count: { id: true },
    }),
  ]);

  const recentErrors = await prisma.odooSyncLog.findMany({
    where: { ...where, status: "FAILED" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      triggerType: true,
      triggerReason: true,
      variantSku: true,
      productName: true,
      errorMessage: true,
      createdAt: true,
    },
  });

  return {
    period: `Last ${days} days`,
    total,
    success,
    failed,
    successRate: total > 0 ? ((success / total) * 100).toFixed(1) : 0,
    byTrigger: byTrigger.map((t) => ({
      type: t.triggerType,
      count: t._count.id,
    })),
    recentErrors,
  };
}

/**
 * Delete old logs (for cleanup)
 * @param {number} [daysToKeep=90] - Days of logs to keep
 */
async function cleanupOldLogs(daysToKeep = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const result = await prisma.odooSyncLog.deleteMany({
    where: {
      createdAt: { lt: cutoffDate },
    },
  });

  console.log(`[OdooLogger] Cleaned up ${result.count} old log entries`);
  return result.count;
}

module.exports = {
  logOdooSync,
  getLogs,
  getLogById,
  getStats,
  cleanupOldLogs,
};
