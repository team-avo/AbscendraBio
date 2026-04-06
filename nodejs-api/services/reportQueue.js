/**
 * Report Generation Queue
 * 
 * Bull queue for async processing of Excel/CSV report generation jobs.
 * Handles 'ORDERS', 'ANALYTICS', and 'CUSTOMERS' report types.
 */

const Queue = require("bull");
const path = require("path");

// Initialize Redis config (same pattern as other queues in the system)
const redisConfig = {
    host: process.env.REDIS_HOST || "peptides_dev_redis",
    port: process.env.REDIS_PORT || 6379,
};

// Fallback for local dev if not using docker networking
if (process.env.NODE_ENV !== "production" && !process.env.REDIS_HOST) {
    redisConfig.host = "127.0.0.1";
}

// Initialize Bull Queue
const reportQueue = new Queue("report-queue", {
    redis: redisConfig,
    settings: {
        lockDuration: 60000, // 60 seconds
        stalledInterval: 60000,
    }
});

console.log(
    "[ReportQueue] Queue initialized with Redis config:",
    redisConfig,
);

/**
 * Queue a report generation job
 * 
 * @param {Object} data - Job data
 * @param {string} data.type - Report type ('ORDERS', 'ANALYTICS', 'CUSTOMERS')
 * @param {string} data.email - Recipient email
 * @param {Object} data.filters - Filters for the report
 * @param {Object} data.user - User info for permission checks/audit
 * @returns {Promise<Object>} - Job info
 */
async function queueReport(data) {
    try {
        const job = await reportQueue.add(data, {
            attempts: 3,
            backoff: {
                type: "exponential",
                delay: 5000,
            },
            removeOnComplete: 100,
            removeOnFail: 500,
        });

        console.log(
            `[ReportQueue] Report job queued: ${job.id} (Type: ${data.type}, Email: ${data.email})`
        );

        return {
            success: true,
            message: "Report generation queued",
            jobId: job.id,
        };
    } catch (error) {
        console.error("[ReportQueue] Failed to queue report:", error);
        throw error;
    }
}

module.exports = {
    reportQueue,
    queueReport,
};
