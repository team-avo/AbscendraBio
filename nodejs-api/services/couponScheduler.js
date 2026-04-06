const cron = require('node-cron');
const logger = require('../utils/logger');
const { updateCouponStatuses } = require('../scripts/couponStatusUpdater');

let schedulerRunning = false;

/**
 * Start the coupon status updater scheduler
 * Runs every minute to check and update coupon statuses
 */
function startCouponScheduler() {
  if (schedulerRunning) {
    logger.info('ℹ️ Coupon scheduler is already running');
    return;
  }

  try {
    // Run every minute at the start of the minute
    cron.schedule('0 * * * * *', async () => {
      await updateCouponStatuses();
    });

    schedulerRunning = true;
    logger.info('✅ Coupon scheduler started - will check coupon statuses every minute');
  } catch (error) {
    logger.error('❌ Failed to start coupon scheduler', error);
  }
}

/**
 * Stop the coupon status updater scheduler
 */
function stopCouponScheduler() {
  if (!schedulerRunning) {
    logger.info('ℹ️ Coupon scheduler is not running');
    return;
  }

  try {
    // Stop all cron jobs
    cron.getTasks().forEach(task => task.stop());
    schedulerRunning = false;
    logger.info('✅ Coupon scheduler stopped');
  } catch (error) {
    logger.error('❌ Failed to stop coupon scheduler', error);
  }
}

/**
 * Check if scheduler is running
 */
function isSchedulerRunning() {
  return schedulerRunning;
}

module.exports = {
  startCouponScheduler,
  stopCouponScheduler,
  isSchedulerRunning
};
