/**
 * Odoo API Routes
 *
 * Admin endpoints for triggering manual syncs and viewing sync logs.
 * All routes require authentication.
 */

const express = require("express");
const router = express.Router();
const prisma = require("../../prisma/client");
const {
  queueFullSync,
  getJobStatus,
  getQueueStats,
} = require("./odooSyncQueue");

/**
 * POST /api/odoo/sync/full
 * Queue a full sync of all active variants to Odoo
 */
router.post("/sync/full", async (req, res) => {
  try {
    console.log(`[OdooRoutes] Full sync requested by user ${req.user.email}`);

    const result = await queueFullSync("MANUAL_FULL");

    res.json({
      success: true,
      message: "Full inventory sync has been queued",
      jobId: result.jobId,
      triggerType: result.triggerType,
    });
  } catch (error) {
    console.error("[OdooRoutes] Failed to queue full sync:", error);
    res.status(500).json({
      success: false,
      error: "Failed to queue full sync",
      message: error.message,
    });
  }
});

/**
 * GET /api/odoo/sync/job/:jobId
 * Get status of a specific sync job
 */
router.get("/sync/job/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const status = await getJobStatus(jobId);

    res.json({
      success: true,
      job: status,
    });
  } catch (error) {
    console.error("[OdooRoutes] Failed to get job status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get job status",
      message: error.message,
    });
  }
});

/**
 * GET /api/odoo/sync/queue/stats
 * Get queue statistics
 */
router.get("/sync/queue/stats", async (req, res) => {
  try {
    const stats = await getQueueStats();

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("[OdooRoutes] Failed to get queue stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get queue stats",
      message: error.message,
    });
  }
});

/**
 * GET /api/odoo/sync/logs
 * Get sync logs with pagination and filters
 */
router.get("/sync/logs", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      status,
      triggerType,
      variantSku,
      startDate,
      endDate,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build where clause
    const where = {};

    if (status) {
      where.status = status;
    }

    if (triggerType) {
      where.triggerType = triggerType;
    }

    if (variantSku) {
      where.variantSku = {
        contains: variantSku,
        mode: "insensitive",
      };
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

    // Fetch logs
    const [logs, total] = await Promise.all([
      prisma.odooSyncLog.findMany({
        where,
        skip,
        take,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          variant: {
            select: {
              id: true,
              name: true,
              sku: true,
              product: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.odooSyncLog.count({ where }),
    ]);

    res.json({
      success: true,
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[OdooRoutes] Failed to fetch sync logs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch sync logs",
      message: error.message,
    });
  }
});

/**
 * GET /api/odoo/sync/logs/:id
 * Get a single sync log by ID
 */
router.get("/sync/logs/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const log = await prisma.odooSyncLog.findUnique({
      where: { id },
      include: {
        variant: {
          select: {
            id: true,
            name: true,
            sku: true,
            product: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!log) {
      return res.status(404).json({
        success: false,
        error: "Sync log not found",
      });
    }

    res.json({
      success: true,
      log,
    });
  } catch (error) {
    console.error("[OdooRoutes] Failed to fetch sync log:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch sync log",
      message: error.message,
    });
  }
});

/**
 * GET /api/odoo/sync/stats
 * Get sync statistics
 */
router.get("/sync/stats", async (req, res) => {
  try {
    const [
      totalSyncs,
      successfulSyncs,
      failedSyncs,
      recentSyncs,
      syncsByTrigger,
    ] = await Promise.all([
      prisma.odooSyncLog.count(),
      prisma.odooSyncLog.count({ where: { status: "SUCCESS" } }),
      prisma.odooSyncLog.count({ where: { status: "FAILED" } }),
      prisma.odooSyncLog.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          variantSku: true,
          status: true,
          triggerType: true,
          createdAt: true,
        },
      }),
      prisma.odooSyncLog.groupBy({
        by: ["triggerType"],
        _count: {
          id: true,
        },
      }),
    ]);

    res.json({
      success: true,
      stats: {
        total: totalSyncs,
        successful: successfulSyncs,
        failed: failedSyncs,
        successRate:
          totalSyncs > 0
            ? ((successfulSyncs / totalSyncs) * 100).toFixed(2)
            : 0,
        byTrigger: syncsByTrigger.reduce((acc, item) => {
          acc[item.triggerType] = item._count.id;
          return acc;
        }, {}),
      },
      recent: recentSyncs,
    });
  } catch (error) {
    console.error("[OdooRoutes] Failed to fetch sync stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch sync stats",
      message: error.message,
    });
  }
});

module.exports = router;
