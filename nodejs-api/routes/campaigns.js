const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const prisma = require('../prisma/client');
const { requirePermission } = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');
const { asyncHandler } = require('../middleware/errorHandler');
// Assuming dispatchCampaign is from some campaign service or common utils
const { dispatchCampaign } = require('../services/campaignService');

// List campaigns
router.get('/', requirePermission('PROMOTIONS', 'READ'), [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('type').optional().isIn(['EMAIL', 'SMS', 'AUTOMATION']),
  query('status').optional().isIn(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED']),
  validateRequest
], asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, type, status } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where = {};
  if (type) where.type = type;
  if (status) where.status = status;

  const [campaigns, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: parseInt(skip),
      take: parseInt(limit),
      include: { promotion: { select: { code: true } } }
    }),
    prisma.campaign.count({ where })
  ]);

  // Map to table-friendly shape
  const data = await Promise.all(campaigns.map(async (c) => {
    let revenue = 0;
    if (c.promotionId) {
      const r = await prisma.promotionUsage.aggregate({
        where: { promotionId: c.promotionId },
        _sum: { discountAmount: true }
      });
      revenue = Number(r._sum.discountAmount || 0);
    }
    return {
      id: c.id,
      name: c.name,
      type: c.type,
      status: c.status,
      createdAt: c.createdAt.toISOString().split('T')[0],
      audience: c.audienceCount,
      opens: c.openCount,
      clicks: c.clickCount,
      revenue
    };
  }));

  res.json({ success: true, data, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
}));

// Create campaign
router.post('/', requirePermission('PROMOTIONS', 'CREATE'), [
  body('name').notEmpty(),
  body('type').isIn(['EMAIL', 'SMS', 'AUTOMATION']),
  body('status').optional().isIn(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED']),
  body('promotionId').optional().isString(),
  body('emailTemplateType').optional().isString(),
  body('audienceFilter').optional(),
  validateRequest
], asyncHandler(async (req, res) => {
  const { name, type, status = 'DRAFT', promotionId, scheduledAt, emailTemplateType, audienceFilter } = req.body;
  const campaign = await prisma.campaign.create({
    data: {
      name,
      type,
      status,
      promotionId: promotionId || null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      emailTemplateType: emailTemplateType || null,
      audienceFilter: audienceFilter ? (typeof audienceFilter === 'string' ? audienceFilter : JSON.stringify(audienceFilter)) : null
    }
  });
  res.status(201).json({ success: true, data: campaign });
}));

// Send now
router.post('/:id/send', requirePermission('PROMOTIONS', 'UPDATE'), [
  param('id').notEmpty(),
  validateRequest
], asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await dispatchCampaign(id);
  res.json({ success: true, data: result });
}));

// Get campaign
router.get('/:id', requirePermission('PROMOTIONS', 'READ'), [
  param('id').notEmpty(),
  validateRequest
], asyncHandler(async (req, res) => {
  const { id } = req.params;
  const c = await prisma.campaign.findUnique({ where: { id }, include: { promotion: true } });
  if (!c) return res.status(404).json({ success: false, error: 'Campaign not found' });
  res.json({ success: true, data: c });
}));

// Update campaign
router.put('/:id', requirePermission('PROMOTIONS', 'UPDATE'), [
  param('id').notEmpty(),
  body('name').optional().isString(),
  body('status').optional().isIn(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED']),
  validateRequest
], asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, status, emailTemplateType, audienceFilter } = req.body;
  const data = {};
  if (name !== undefined) data.name = name;
  if (status !== undefined) data.status = status;
  if (emailTemplateType !== undefined) data.emailTemplateType = emailTemplateType;
  if (audienceFilter !== undefined) data.audienceFilter = typeof audienceFilter === 'string' ? audienceFilter : JSON.stringify(audienceFilter);
  const updated = await prisma.campaign.update({ where: { id }, data });
  res.json({ success: true, data: updated });
}));

// Metrics
router.get('/:id/metrics', requirePermission('PROMOTIONS', 'READ'), [
  param('id').notEmpty(),
  validateRequest
], asyncHandler(async (req, res) => {
  const { id } = req.params;
  const c = await prisma.campaign.findUnique({ where: { id } });
  if (!c) return res.status(404).json({ success: false, error: 'Campaign not found' });

  let revenue = 0;
  if (c.promotionId) {
    const r = await prisma.promotionUsage.aggregate({
      where: { promotionId: c.promotionId },
      _sum: { discountAmount: true }
    });
    revenue = Number(r._sum.discountAmount || 0);
  }

  res.json({
    success: true,
    data: {
      audience: c.audienceCount,
      sent: c.sentCount,
      opens: c.openCount,
      clicks: c.clickCount,
      revenue
    }
  });
}));

// Recipients preview (basic)
router.get('/:id/recipients', requirePermission('PROMOTIONS', 'READ'), [
  param('id').notEmpty(),
  validateRequest
], asyncHandler(async (req, res) => {
  const { id } = req.params;
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return res.status(404).json({ success: false, error: 'Campaign not found' });

  let audienceFilter = null;
  try { audienceFilter = campaign.audienceFilter ? (typeof campaign.audienceFilter === 'string' ? JSON.parse(campaign.audienceFilter) : campaign.audienceFilter) : null; } catch { }

  const where = { isActive: true };
  if (audienceFilter && audienceFilter.customerType) {
    where.customerType = audienceFilter.customerType;
  }
  const customers = await prisma.customer.findMany({
    where,
    select: { id: true, firstName: true, lastName: true, email: true, customerType: true },
    take: 50
  });
  res.json({ success: true, data: customers.filter(c => !!c.email) });
}));

// Delete campaign
router.delete('/:id', requirePermission('PROMOTIONS', 'DELETE'), [
  param('id').notEmpty(),
  validateRequest
], asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await prisma.campaign.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ success: false, error: 'Campaign not found' });
  await prisma.campaign.delete({ where: { id } });
  res.json({ success: true, message: 'Campaign deleted successfully' });
}));

module.exports = router;


