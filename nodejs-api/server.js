const http = require('http');
const cron = require('node-cron');
const app = require('./app');
const { run: runPublishScheduler } = require('./cron/publishScheduler');
const { run: runSettlementChecker } = require('./cron/settlementChecker');
const { run: runPromotionExpiryScheduler } = require('./cron/promotionExpiryScheduler');
const { generatePartnerStatements, sendPaymentReminders } = require('./cron/partnerBillingScheduler');
const { syncShipStationInventory } = require('./utils/inventorySyncService');
const { run: runLabelTrackingSync } = require('./cron/labelTrackingSync');
const logger = require('./utils/logger');
const port = process.env.PORT || 4000;
const server = http.createServer(app);

// Validate Critical Environment Variables at startup
const requiredEnvVars = ['RESEND_API_KEY', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  logger.error('CRITICAL ERROR: The following environment variables are not set:');
  missingEnvVars.forEach(envVar => logger.error(`- ${envVar}`));
  logger.error('The application cannot start without these. Please set them and restart the server.');
  process.exit(1);
}

server.listen(port, () => {
  logger.info(`API server listening on port ${port}`);
});

// Campaign scheduler removed per requirements

// Run content publish scheduler every minute
cron.schedule('* * * * *', async () => {
  try {
    const result = await runPublishScheduler();
    if (result.updated) {
      logger.info(`[Cron] Published ${result.updated} scheduled pages/posts`);
    }
  } catch (err) {
    logger.error(`[Cron] Publish scheduler error: ${err.message}`);
  }
});

// Run Authorize.Net settlement checker daily at 02:15 server time
cron.schedule('15 2 * * *', async () => {
  try {
    const result = await runSettlementChecker();
    if (result.updated) {
      logger.info(`[Cron] Settlement checker updated ${result.updated} transactions/payments`);
    } else {
      logger.info('[Cron] Settlement checker: no updates');
    }
  } catch (err) {
    logger.error(`[Cron] Settlement checker error: ${err.message}`);
  }
});

// Run ShipStation inventory sync daily at 02:30 server time
cron.schedule('30 2 * * *', async () => {
  try {
    logger.info('[Cron] Starting ShipStation inventory sync...');
    const result = await syncShipStationInventory();
    logger.info('[Cron] ShipStation inventory sync completed', {
      synced: result.synced,
      skipped: result.skipped,
      errors: result.errors,
      total: result.total
    });
  } catch (err) {
    logger.error(`[Cron] ShipStation inventory sync error: ${err.message}`);
  }
});

// Run promotion expiry checker every 2 minutes
cron.schedule('*/2 * * * *', async () => {
  try {
    const result = await runPromotionExpiryScheduler();
    if (result.deleted > 0) {
      logger.info(`[Cron] Auto-deleted ${result.deleted} expired promotions`);
    }
  } catch (err) {
    logger.error(`[Cron] Promotion expiry scheduler error: ${err.message}`);
  }
});

// Run Partner Statement Generation twice daily at 3 AM and 3 PM
cron.schedule('0 3,15 * * *', async () => {
  try {
    logger.info('[Cron] Starting partner statement generation...');
    const result = await generatePartnerStatements();
    logger.info('[Cron] Partner statement generation completed', result);
  } catch (err) {
    logger.error(`[Cron] Partner statement generation error: ${err.message}`);
  }
});

// Run Partner Payment Reminders twice daily at 4 AM and 4 PM
cron.schedule('0 4,16 * * *', async () => {
  try {
    logger.info('[Cron] Starting partner payment reminders...');
    const result = await sendPaymentReminders();
    logger.info('[Cron] Partner payment reminders completed', result);
  } catch (err) {
    logger.error(`[Cron] Partner payment reminders error: ${err.message}`);
  }
});

// Run ShipStation label tracking sync every hour
cron.schedule('0 * * * *', async () => {
  try {
    logger.info('[Cron] Starting label tracking sync...');
    const result = await runLabelTrackingSync();
    logger.info('[Cron] Label tracking sync completed', {
      total: result.total,
      checked: result.checked,
      updated: result.updated,
      errors: result.errors,
    });
  } catch (err) {
    logger.error(`[Cron] Label tracking sync error: ${err.message}`);
  }
});


