/**
 * Odoo Integration Config Routes
 *
 * Admin endpoints for managing Odoo integration configuration.
 * Allows enabling/disabling sync, linking to sales channel, and testing connection.
 * Includes log viewing endpoints.
 */

const express = require("express");
const router = express.Router();
const prisma = require("../../prisma/client");
const axios = require("axios");
const {
  getLogs,
  getLogById,
  getStats,
  cleanupOldLogs,
} = require("./odooLogger");

/**
 * GET /api/odoo/config
 * Get current integration configuration
 * Query params:
 *   - salesChannelId: Filter by sales channel (optional)
 */
router.get("/", async (req, res) => {
  try {
    const { salesChannelId } = req.query;

    // Build query based on whether salesChannelId is provided
    const whereClause = salesChannelId ? { salesChannelId } : {};

    // Get config (optionally filtered by sales channel)
    let config = await prisma.odooIntegrationConfig.findFirst({
      where: whereClause,
      include: {
        salesChannel: {
          select: {
            id: true,
            companyName: true,
            contactPerson: true,
            status: true,
          },
        },
      },
    });

    // If no config exists and a salesChannelId was provided, return empty
    // (frontend will handle showing defaults)
    if (!config && salesChannelId) {
      return res.json({
        success: true,
        data: null,
      });
    }

    // If no config exists at all, create one with env var defaults (global config)
    if (!config) {
      config = await prisma.odooIntegrationConfig.create({
        data: {
          name: "Skydell Odoo Integration",
          apiBaseUrl:
            process.env.ODOO_API_BASE_URL ||
            "https://bol9967-odoo18-tk.odoo.com",
          apiToken:
            process.env.ODOO_API_TOKEN ||
            "aO1V5iLQJ285eMPKy1iQv_wuZYOEfSXtxbMjwhTXBoc",
          partnerId: process.env.ODOO_PARTNER_ID || "13",
          isEnabled: false,
        },
        include: {
          salesChannel: true,
        },
      });
    }

    // Mask API token for security (show only last 8 chars)
    const maskedConfig = {
      ...config,
      apiToken: config.apiToken
        ? `${"*".repeat(Math.max(0, config.apiToken.length - 8))}${config.apiToken.slice(-8)}`
        : null,
      apiTokenSet: !!config.apiToken,
    };

    res.json({
      success: true,
      data: maskedConfig,
    });
  } catch (error) {
    console.error("[OdooConfig] Failed to get config:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get configuration",
      message: error.message,
    });
  }
});

/**
 * PUT /api/odoo/config
 * Update or create integration configuration for a sales channel
 */
router.put("/", async (req, res) => {
  try {
    const { salesChannelId, isEnabled, apiBaseUrl, apiToken, partnerId, name } =
      req.body;

    // Find existing config by salesChannelId if provided
    let config = null;
    if (salesChannelId) {
      config = await prisma.odooIntegrationConfig.findUnique({
        where: { salesChannelId },
      });
    } else {
      // Fallback to finding first config (global)
      config = await prisma.odooIntegrationConfig.findFirst();
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (salesChannelId !== undefined)
      updateData.salesChannelId = salesChannelId || null;
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled;
    if (apiBaseUrl !== undefined) updateData.apiBaseUrl = apiBaseUrl;
    // Only update token if provided and not empty/masked
    if (apiToken !== undefined && apiToken !== "" && !apiToken.startsWith("*"))
      updateData.apiToken = apiToken;
    if (partnerId !== undefined) updateData.partnerId = partnerId;

    if (config) {
      config = await prisma.odooIntegrationConfig.update({
        where: { id: config.id },
        data: updateData,
        include: {
          salesChannel: {
            select: {
              id: true,
              companyName: true,
              contactPerson: true,
              status: true,
            },
          },
        },
      });
    } else {
      // Create new config for this sales channel
      config = await prisma.odooIntegrationConfig.create({
        data: {
          name: name || "Odoo Integration",
          apiBaseUrl:
            apiBaseUrl ||
            process.env.ODOO_API_BASE_URL ||
            "https://bol9967-odoo18-tk.odoo.com",
          apiToken:
            apiToken && !apiToken.startsWith("*")
              ? apiToken
              : process.env.ODOO_API_TOKEN ||
                "aO1V5iLQJ285eMPKy1iQv_wuZYOEfSXtxbMjwhTXBoc",
          partnerId: partnerId || process.env.ODOO_PARTNER_ID || "13",
          isEnabled: isEnabled || false,
          salesChannelId: salesChannelId || null,
        },
        include: {
          salesChannel: true,
        },
      });
    }

    // Clear the odoo client config cache
    try {
      const odooClient = require("./odooClient");
      odooClient.clearConfigCache();
    } catch (e) {
      // Ignore if module not found
    }

    console.log(
      `[OdooConfig] Config updated by user ${req.user?.email || "unknown"}:`,
      JSON.stringify({
        isEnabled: config.isEnabled,
        salesChannelId: config.salesChannelId,
      }),
    );

    // Mask API token for response
    const maskedConfig = {
      ...config,
      apiToken: config.apiToken
        ? `${"*".repeat(Math.max(0, config.apiToken.length - 8))}${config.apiToken.slice(-8)}`
        : null,
      apiTokenSet: !!config.apiToken,
    };

    res.json({
      success: true,
      message: "Configuration updated successfully",
      data: maskedConfig,
    });
  } catch (error) {
    console.error("[OdooConfig] Failed to update config:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update configuration",
      message: error.message,
    });
  }
});

/**
 * POST /api/odoo/config/test-connection
 * Test connection to Odoo API
 * Accepts credentials in body for testing before saving
 */
router.post("/test-connection", async (req, res) => {
  try {
    const { apiBaseUrl, apiToken, partnerId } = req.body;

    // Use provided credentials or fall back to stored config
    let testUrl = apiBaseUrl;
    let testToken = apiToken;
    let testPartnerId = partnerId;

    // If credentials not provided in body, try to get from DB
    if (!testUrl || !testToken || !testPartnerId) {
      const config = await prisma.odooIntegrationConfig.findFirst();
      if (config) {
        testUrl = testUrl || config.apiBaseUrl;
        // Only use stored token if no token provided or token is masked
        testToken =
          testToken && !testToken.startsWith("*") ? testToken : config.apiToken;
        testPartnerId = testPartnerId || config.partnerId;
      }
    }

    if (!testUrl || !testToken || !testPartnerId) {
      return res.status(400).json({
        success: true,
        connected: false,
        error: "Missing credentials",
        message: "API Base URL, Token, and Partner ID are required",
      });
    }

    // Test connection by trying to read a non-existent product
    const testSku = `TEST-CONNECTION-${Date.now()}`;
    const url = `${testUrl}/vendor_api/product/read?partner_id=${testPartnerId}`;

    const startTime = Date.now();
    const response = await axios({
      method: "POST",
      url,
      headers: {
        Authorization: `Bearer ${testToken}`,
        "Content-Type": "application/json",
      },
      data: { default_code: testSku },
      timeout: 15000,
    });
    const duration = Date.now() - startTime;

    // If we get a response (even "product_not_found"), connection is working
    // The result could be an object like {error: "product_not_found"} which still means connection works
    const hasResult =
      response.data &&
      (response.data.result !== undefined || response.data.jsonrpc === "2.0");
    const isConnected = hasResult === true; // Ensure boolean

    res.json({
      success: true,
      connected: isConnected,
      responseTime: duration,
      message: isConnected
        ? "Connection successful"
        : "Connection failed - unexpected response",
      details: {
        status: response.status,
        hasResult: !!response.data?.result,
      },
    });
  } catch (error) {
    console.error("[OdooConfig] Connection test failed:", error.message);

    let errorMessage = "Connection failed";
    if (error.code === "ECONNREFUSED") {
      errorMessage = "Connection refused - check API URL";
    } else if (error.code === "ETIMEDOUT" || error.code === "ECONNABORTED") {
      errorMessage = "Connection timed out";
    } else if (error.response?.status === 401) {
      errorMessage = "Authentication failed - check API token";
    } else if (error.response?.status === 403) {
      errorMessage = "Access forbidden - check partner ID";
    }

    res.json({
      success: true,
      connected: false,
      responseTime: null,
      message: errorMessage,
      error: error.message,
    });
  }
});

/**
 * GET /api/odoo/config/sales-channels
 * Get available sales channels for linking
 */
router.get("/sales-channels", async (req, res) => {
  try {
    const salesChannels = await prisma.salesChannel.findMany({
      where: {
        status: "ACTIVE",
      },
      select: {
        id: true,
        companyName: true,
        contactPerson: true,
        type: true,
        fulfillmentModel: true,
        _count: {
          select: {
            prices: true,
          },
        },
      },
      orderBy: {
        companyName: "asc",
      },
    });

    // Check which one is already linked
    const config = await prisma.odooIntegrationConfig.findFirst({
      select: { salesChannelId: true },
    });

    const channelsWithStatus = salesChannels.map((channel) => ({
      ...channel,
      priceListCount: channel._count.prices,
      isLinkedToOdoo: config?.salesChannelId === channel.id,
    }));

    res.json({
      success: true,
      salesChannels: channelsWithStatus,
    });
  } catch (error) {
    console.error("[OdooConfig] Failed to get sales channels:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get sales channels",
      message: error.message,
    });
  }
});

// ============================================
// SYNC LOGS ENDPOINTS
// ============================================

/**
 * GET /api/odoo/config/logs
 * Get sync logs with filtering and pagination
 * Query params:
 *   - page: Page number (default: 1)
 *   - limit: Items per page (default: 50)
 *   - status: Filter by status (SUCCESS, FAILED, PENDING)
 *   - triggerType: Filter by trigger type
 *   - salesChannelId: Filter by sales channel
 *   - variantId: Filter by variant
 *   - productId: Filter by product
 *   - orderId: Filter by order
 *   - search: Search in SKU, product name, error message
 *   - startDate: Filter from date
 *   - endDate: Filter to date
 */
router.get("/logs", async (req, res) => {
  try {
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
    } = req.query;

    const result = await getLogs({
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      triggerType,
      salesChannelId,
      variantId,
      productId,
      orderId,
      search,
      startDate,
      endDate,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("[OdooConfig] Failed to get logs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get sync logs",
      message: error.message,
    });
  }
});

/**
 * GET /api/odoo/config/logs/stats
 * Get sync statistics
 * Query params:
 *   - salesChannelId: Filter by sales channel (optional)
 *   - days: Number of days to look back (default: 7)
 */
router.get("/logs/stats", async (req, res) => {
  try {
    const { salesChannelId, days = 7 } = req.query;

    const stats = await getStats(salesChannelId, parseInt(days));

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("[OdooConfig] Failed to get log stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get sync statistics",
      message: error.message,
    });
  }
});

/**
 * GET /api/odoo/config/logs/:id
 * Get a single log entry with full details
 */
router.get("/logs/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const log = await getLogById(id);

    if (!log) {
      return res.status(404).json({
        success: false,
        error: "Log entry not found",
      });
    }

    res.json({
      success: true,
      log,
    });
  } catch (error) {
    console.error("[OdooConfig] Failed to get log:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get log entry",
      message: error.message,
    });
  }
});

/**
 * DELETE /api/odoo/config/logs/cleanup
 * Delete old logs (admin only)
 * Query params:
 *   - daysToKeep: Days of logs to keep (default: 90)
 */
router.delete("/logs/cleanup", async (req, res) => {
  try {
    const { daysToKeep = 90 } = req.query;

    const deletedCount = await cleanupOldLogs(parseInt(daysToKeep));

    res.json({
      success: true,
      message: `Cleaned up ${deletedCount} old log entries`,
      deletedCount,
    });
  } catch (error) {
    console.error("[OdooConfig] Failed to cleanup logs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to cleanup logs",
      message: error.message,
    });
  }
});

/**
 * GET /api/odoo/config/logs/export
 * Export logs as CSV
 */
router.get("/logs/export", async (req, res) => {
  try {
    const { status, triggerType, salesChannelId, startDate, endDate } =
      req.query;

    // Get all matching logs (up to 10000)
    const result = await getLogs({
      page: 1,
      limit: 10000,
      status,
      triggerType,
      salesChannelId,
      startDate,
      endDate,
    });

    // Convert to CSV
    const headers = [
      "ID",
      "Timestamp",
      "Trigger Type",
      "Trigger Reason",
      "SKU",
      "Product Name",
      "Order Number",
      "Status",
      "HTTP Method",
      "Endpoint",
      "Status Code",
      "Duration (ms)",
      "Error Message",
      "Initiated By",
    ];

    const rows = result.logs.map((log) => [
      log.id,
      log.createdAt.toISOString(),
      log.triggerType,
      log.triggerReason || "",
      log.variantSku || "",
      log.productName || log.variant?.product?.name || "",
      log.order?.orderNumber || "",
      log.status,
      log.httpMethod || "",
      log.endpoint || "",
      log.statusCode || "",
      log.duration || "",
      log.errorMessage || "",
      log.initiatedBy || "",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="odoo-sync-logs-${new Date().toISOString().split("T")[0]}.csv"`,
    );
    res.send(csv);
  } catch (error) {
    console.error("[OdooConfig] Failed to export logs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to export logs",
      message: error.message,
    });
  }
});

module.exports = router;
