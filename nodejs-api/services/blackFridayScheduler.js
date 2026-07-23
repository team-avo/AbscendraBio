const prisma = require('../prisma/client');
const { sendEmailWithTemplate } = require('../utils/emailService');
const cron = require('node-cron');
const logger = require('../utils/logger');


// Hardcoded Black Friday campaign data
const BLACK_FRIDAY_CONFIG = {
  discountCode: 'BLACKFRIDAY15',
  shopLink: 'https://ascendrabio.com',
  saleStartDate: 'November 27, 2025 at 12:01 AM PST',
  saleEndDate: 'November 28, 2025',
  storeName: 'Ascendra Bio',
  storeEmail: process.env.STORE_EMAIL || 'info@ascendrabio.com',
  storePhone: process.env.STORE_PHONE || '+1 (323) 299-6900',
  storeAddress: process.env.STORE_ADDRESS || '5815 W Sunset Blvd, Suite 401, Los Angeles, CA 90028'
};

/**
 * Send Black Friday emails to all active customers
 */
async function sendBlackFridayEmailsToAllCustomers() {
  try {
    logger.info('[BLACK_FRIDAY_SCHEDULER] Starting email campaign...');

    // Get all active customers with email addresses
    const customers = await prisma.customer.findMany({
      where: {
        isActive: true,
        email: {
          not: ''
        }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true
      }
    });

    logger.info(`[BLACK_FRIDAY_SCHEDULER] Found ${customers.length} active customers to email`);

    if (customers.length === 0) {
      logger.info('[BLACK_FRIDAY_SCHEDULER] No active customers found');
      return {
        sent: 0,
        failed: 0,
        total: 0,
        failedEmails: []
      };
    }

    let sent = 0;
    let failed = 0;
    const failedEmails = [];

    // Send email to each customer using saved template
    for (const customer of customers) {
      try {
        const emailData = {
          customerName: `${customer.firstName} ${customer.lastName}`,
          customerEmail: customer.email,
          ...BLACK_FRIDAY_CONFIG
        };

        logger.info(`[BLACK_FRIDAY_SCHEDULER] Sending email to ${customer.email}...`);

        // Send using saved BLACK_FRIDAY template
        await sendEmailWithTemplate('BLACK_FRIDAY', customer.email, emailData);

        sent++;
        logger.info(`[BLACK_FRIDAY_SCHEDULER] Email sent successfully to ${customer.email}`);
      } catch (error) {
        failed++;
        failedEmails.push({
          email: customer.email,
          error: error.message
        });
        logger.error(`[BLACK_FRIDAY_SCHEDULER] Failed to send email to ${customer.email}: ${error.message}`);
      }
    }

    const result = {
      sent,
      failed,
      total: customers.length,
      failedEmails
    };

    logger.info(`[BLACK_FRIDAY_SCHEDULER] Campaign completed. Sent: ${sent}, Failed: ${failed}`);
    return result;
  } catch (error) {
    logger.error('[BLACK_FRIDAY_SCHEDULER] Error', error);
    throw error;
  }
}

/**
 * Initialize Black Friday scheduler
 * Sends emails on November 27, 2025 at 12:06 AM PST
 * 
 * Timezone Conversion:
 * - Target: November 27, 2025 at 12:06 AM PST
 * - PST is UTC-8
 * - IST is UTC+5:30
 * - IST is 13.5 hours ahead of PST
 * - 12:06 AM PST (Nov 27) + 13.5 hours = 1:36 PM IST (Nov 27)
 * 
 * Cron format: minute hour day month dayOfWeek
 * 36 13 27 11 * = 1:36 PM IST on November 27 (which is 12:06 AM PST on November 27)
 */
function initializeBlackFridayScheduler() {
  logger.info('[BLACK_FRIDAY_SCHEDULER] Initializing Black Friday email scheduler...');

  // Schedule for November 27, 2025 at 12:06 AM PST = 1:36 PM IST on Nov 27
  const cronExpression = '36 13 27 11 *';

  const scheduledTask = cron.schedule(cronExpression, async () => {
    logger.info('[BLACK_FRIDAY_SCHEDULER] ⏰ Scheduled time reached! Sending Black Friday emails...');
    try {
      const result = await sendBlackFridayEmailsToAllCustomers();
      logger.info('[BLACK_FRIDAY_SCHEDULER] ✅ Campaign completed successfully', { result });
    } catch (error) {
      logger.error('[BLACK_FRIDAY_SCHEDULER] ❌ Campaign failed', error);
    }
  });

  logger.info('[BLACK_FRIDAY_SCHEDULER] ✅ Scheduler initialized');
  logger.info('[BLACK_FRIDAY_SCHEDULER] Scheduled to send emails on: November 27, 2025 at 12:06 AM PST');
  logger.info('[BLACK_FRIDAY_SCHEDULER] Server timezone (IST): November 27, 2025 at 1:36 PM');
  logger.info('[BLACK_FRIDAY_SCHEDULER] Cron expression: ' + cronExpression);

  return scheduledTask;
}

module.exports = {
  initializeBlackFridayScheduler,
  sendBlackFridayEmailsToAllCustomers
};
