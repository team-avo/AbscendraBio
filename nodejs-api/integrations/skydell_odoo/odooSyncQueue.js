/**
 * Odoo Inventory Sync Queue
 *
 * Bull queue for async processing of Odoo sync jobs.
 * Handles FULL_SYNC, PRODUCT_SYNC, and VARIANT_SYNC job types with retry logic.
 */

const Queue = require("bull");
const odooSyncService = require("./odooSyncService");

// Initialize Redis config (same pattern as emailService.js)
const redisConfig = {
  host: process.env.REDIS_HOST || "peptides_dev_redis",
  port: process.env.REDIS_PORT || 6379,
};

// Fallback for local dev if not using docker networking
if (process.env.NODE_ENV !== "production" && !process.env.REDIS_HOST) {
  redisConfig.host = "127.0.0.1";
}

// Initialize Bull Queue
const odooSyncQueue = new Queue("odoo-sync-queue", {
  redis: redisConfig,
  limiter: {
    max: 5, // 5 sync operations
    duration: 1000, // per second (to avoid overwhelming Odoo API)
  },
});

console.log(
  "[OdooSyncQueue] Queue initialized with Redis config:",
  redisConfig,
);

// Process sync jobs
odooSyncQueue.process(async (job) => {
  const { type, ...data } = job.data;
  console.log(`[OdooSyncQueue] Processing job ${job.id} of type ${type}`);

  try {
    if (type === "PRODUCT_SYNC") {
      // Sync a product with all its variants (preferred)
      const { productId, triggerType, triggerReason, context } = data;
      return await odooSyncService.syncProductToOdoo(
        productId,
        triggerType,
        triggerReason,
        context || {},
      );
    } else if (type === "VARIANT_SYNC") {
      // Legacy: Sync a single variant (redirects to product sync)
      const { variantId, triggerType, triggerReason, context } = data;
      return await odooSyncService.syncVariantToOdoo(
        variantId,
        triggerType,
        triggerReason,
        context || {},
      );
    } else if (type === "FULL_SYNC") {
      // Sync all active products
      const { triggerType } = data;
      return await odooSyncService.syncAllVariantsToOdoo(triggerType);
    } else {
      throw new Error(`Unknown job type: ${type}`);
    }
  } catch (error) {
    console.error(`[OdooSyncQueue] Job ${job.id} failed:`, error);
    throw error;
  }
});

// Job event handlers
odooSyncQueue.on("completed", (job, result) => {
  console.log(`[OdooSyncQueue] Job ${job.id} completed:`, result);
});

odooSyncQueue.on("failed", (job, err) => {
  console.error(`[OdooSyncQueue] Job ${job.id} failed:`, err.message);
});

odooSyncQueue.on("stalled", (job) => {
  console.warn(`[OdooSyncQueue] Job ${job.id} stalled`);
});

/**
 * Queue a sync for a single variant (redirects to product sync internally)
 * Kept for backward compatibility - triggers will queue the parent product
 *
 * @param {string} variantId - ProductVariant ID
 * @param {string} triggerType - Sync trigger type (enum value)
 * @param {string} triggerReason - Human-readable reason (e.g., "Order #ORD-001 created")
 * @param {Object} context - Additional context (orderId, initiatedBy, etc.)
 * @returns {Promise<Object>} - Job info
 */
async function queueVariantSync(
  variantId,
  triggerType = "MANUAL_FULL",
  triggerReason = null,
  context = {},
) {
  try {
    const job = await odooSyncQueue.add(
      {
        type: "VARIANT_SYNC",
        variantId,
        triggerType,
        triggerReason,
        context,
      },
      {
        attempts: 3, // Retry 3 times on failure
        backoff: {
          type: "exponential", // Exponential backoff
          delay: 2000, // Starting delay of 2 seconds
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 500, // Keep last 500 failed jobs for debugging
      },
    );

    console.log(
      `[OdooSyncQueue] Variant sync queued: ${job.id} (Variant: ${variantId}, Trigger: ${triggerType}, Reason: ${triggerReason || "N/A"})`,
    );

    return {
      success: true,
      message: "Variant sync queued",
      jobId: job.id,
      variantId,
      triggerType,
    };
  } catch (error) {
    console.error("[OdooSyncQueue] Failed to queue variant sync:", error);
    throw error;
  }
}

/**
 * Queue a sync for a product (all its variants in one API call)
 * This is the preferred way to sync - more efficient than per-variant
 *
 * @param {string} productId - Product ID
 * @param {string} triggerType - Sync trigger type (enum value)
 * @param {string} triggerReason - Human-readable reason (e.g., "Order #ORD-001 created")
 * @param {Object} context - Additional context (orderId, initiatedBy, etc.)
 * @returns {Promise<Object>} - Job info
 */
async function queueProductSync(
  productId,
  triggerType = "MANUAL_FULL",
  triggerReason = null,
  context = {},
) {
  try {
    // Use a job ID based on productId to deduplicate (prevents multiple syncs for same product)
    const jobId = `product-sync-${productId}-${Date.now()}`;

    const job = await odooSyncQueue.add(
      {
        type: "PRODUCT_SYNC",
        productId,
        triggerType,
        triggerReason,
        context,
      },
      {
        jobId, // Unique job ID for tracking
        attempts: 3, // Retry 3 times on failure
        backoff: {
          type: "exponential", // Exponential backoff
          delay: 2000, // Starting delay of 2 seconds
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 500, // Keep last 500 failed jobs for debugging
      },
    );

    console.log(
      `[OdooSyncQueue] Product sync queued: ${job.id} (Product: ${productId}, Trigger: ${triggerType}, Reason: ${triggerReason || "N/A"})`,
    );

    return {
      success: true,
      message: "Product sync queued",
      jobId: job.id,
      productId,
      triggerType,
    };
  } catch (error) {
    console.error("[OdooSyncQueue] Failed to queue product sync:", error);
    throw error;
  }
}

/**
 * Queue a full sync of all active variants
 *
 * @param {string} triggerType - Sync trigger type (enum value)
 * @returns {Promise<Object>} - Job info
 */
async function queueFullSync(triggerType = "MANUAL_FULL") {
  try {
    const job = await odooSyncQueue.add(
      {
        type: "FULL_SYNC",
        triggerType,
      },
      {
        attempts: 1, // Don't retry full syncs automatically (can be manually triggered)
        timeout: 600000, // 10 minute timeout for full syncs
        removeOnComplete: 50, // Keep last 50 full sync jobs
        removeOnFail: 100, // Keep last 100 failed full syncs
      },
    );

    console.log(
      `[OdooSyncQueue] Full sync queued: ${job.id} (Trigger: ${triggerType})`,
    );

    return {
      success: true,
      message: "Full sync queued",
      jobId: job.id,
      triggerType,
    };
  } catch (error) {
    console.error("[OdooSyncQueue] Failed to queue full sync:", error);
    throw error;
  }
}

/**
 * Get job status
 *
 * @param {string} jobId - Bull job ID
 * @returns {Promise<Object>} - Job status
 */
async function getJobStatus(jobId) {
  try {
    const job = await odooSyncQueue.getJob(jobId);

    if (!job) {
      return {
        found: false,
        message: "Job not found",
      };
    }

    const state = await job.getState();
    const progress = job.progress();
    const result = job.returnvalue;
    const failedReason = job.failedReason;

    return {
      found: true,
      id: job.id,
      name: job.name,
      data: job.data,
      state,
      progress,
      result,
      failedReason,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    };
  } catch (error) {
    console.error("[OdooSyncQueue] Failed to get job status:", error);
    throw error;
  }
}

/**
 * Get queue statistics
 *
 * @returns {Promise<Object>} - Queue stats
 */
async function getQueueStats() {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      odooSyncQueue.getWaitingCount(),
      odooSyncQueue.getActiveCount(),
      odooSyncQueue.getCompletedCount(),
      odooSyncQueue.getFailedCount(),
      odooSyncQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  } catch (error) {
    console.error("[OdooSyncQueue] Failed to get queue stats:", error);
    throw error;
  }
}

module.exports = {
  odooSyncQueue,
  queueVariantSync,
  queueProductSync,
  queueFullSync,
  getJobStatus,
  getQueueStats,
};
