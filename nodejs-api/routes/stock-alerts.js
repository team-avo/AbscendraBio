const express = require('express');
const { requirePermission } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { triggerStockAlertManually } = require('../utils/stockAlertScheduler');

const router = express.Router();

/**
 * Health check endpoint
 * GET /api/stock-alerts/health
 */
router.get(
  '/health',
  asyncHandler(async (req, res) => {
    res.json({ success: true, message: 'Stock alerts service is running' });
  })
);

/**
 * Manually trigger stock alert email
 * POST /api/stock-alerts/trigger
 * Requires: INVENTORY READ permission
 */
router.post(
  '/trigger',
  requirePermission('INVENTORY', 'READ'),
  asyncHandler(async (req, res) => {
    console.log('Manual stock alert trigger requested');
    
    const result = await triggerStockAlertManually();
    
    if (result.success) {
      return res.json({
        success: true,
        message: result.message,
        data: result,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  })
);

module.exports = router;
