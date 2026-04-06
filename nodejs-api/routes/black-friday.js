const express = require('express');
const logger = require('../utils/logger');
const { body } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const { asyncHandler } = require('../middleware/errorHandler');
const { requirePermission } = require('../middleware/auth');
const prisma = require('../prisma/client');
const router = express.Router();

// Hardcoded Black Friday campaign data
const BLACK_FRIDAY_CONFIG = {
  discountCode: 'BLACKFRIDAY15',
  shopLink: 'https://centreresearch.org',
  saleStartDate: 'November 25, 2025 at 12:01 AM PST',
  saleEndDate: 'November 28, 2025',
  storeName: 'Centre Labs',
  storeEmail: process.env.STORE_EMAIL || 'info@centreresearch.org',
  storePhone: process.env.STORE_PHONE || '+1 (323) 299-6900',
  storeAddress: process.env.STORE_ADDRESS || '5815 W Sunset Blvd, Suite 401, Los Angeles, CA 90028'
};

/**
 * Helper function to send Black Friday emails to all customers
 */
async function sendBlackFridayEmailsToCustomers() {
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

  logger.info(`[BLACK_FRIDAY] Found ${customers.length} active customers to email`);

  if (customers.length === 0) {
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

      logger.info(`[BLACK_FRIDAY] Sending email to ${customer.email}...`);

      // Send using saved BLACK_FRIDAY template
      await sendEmailWithTemplate('BLACK_FRIDAY', customer.email, emailData);

      sent++;
      logger.info(`[BLACK_FRIDAY] Email sent successfully to ${customer.email}`);
    } catch (error) {
      failed++;
      failedEmails.push({
        email: customer.email,
        error: error.message
      });
      logger.error(`[BLACK_FRIDAY] Failed to send email to ${customer.email}: ${error.message}`);
    }
  }

  return {
    sent,
    failed,
    total: customers.length,
    failedEmails
  };
}

/**
 * POST /black-friday/send
 * Send Black Friday emails to all active customers immediately
 * Uses hardcoded data and saved BLACK_FRIDAY email template
 */
router.post('/send', requirePermission('PROMOTIONS', 'CREATE'), asyncHandler(async (req, res) => {
  logger.info('[BLACK_FRIDAY_ENDPOINT] /send endpoint called');

  try {
    const result = await sendBlackFridayEmailsToCustomers();

    if (result.total === 0) {
      return res.json({
        success: true,
        message: 'No active customers found',
        data: result
      });
    }

    logger.info(`[BLACK_FRIDAY] Campaign completed. Sent: ${result.sent}, Failed: ${result.failed}`);

    res.json({
      success: true,
      message: `Black Friday emails sent. Sent ${result.sent} emails, ${result.failed} failed.`,
      data: result
    });
  } catch (error) {
    logger.error('[BLACK_FRIDAY_ENDPOINT] Error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send Black Friday emails',
      details: error.message
    });
  }
}));

/**
 * POST /black-friday/test
 * Test endpoint - Send test email to a specific address
 * Uses hardcoded data and saved BLACK_FRIDAY email template
 */
router.post('/test', requirePermission('PROMOTIONS', 'CREATE'), [
  body('email').isEmail().withMessage('Valid email is required'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { email } = req.body;

  logger.info('[BLACK_FRIDAY_ENDPOINT] /test endpoint called', { email });

  try {
    const testData = {
      customerName: 'Test Customer',
      customerEmail: email,
      ...BLACK_FRIDAY_CONFIG
    };

    // Send using saved BLACK_FRIDAY template
    await sendEmailWithTemplate('BLACK_FRIDAY', email, testData);

    res.json({
      success: true,
      message: `Test email sent successfully to ${email}`,
      data: {
        email,
        template: 'BLACK_FRIDAY',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('[BLACK_FRIDAY_ENDPOINT] Test email failed', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test email',
      details: error.message
    });
  }
}));

module.exports = router;
