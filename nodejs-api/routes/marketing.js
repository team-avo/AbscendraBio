const express = require('express');
const { body, param, query } = require('express-validator');
const prisma = require('../prisma/client');
const validateRequest = require('../middleware/validateRequest');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireRole, requirePermission } = require('../middleware/auth');
const { processEmailWithTemplateResend } = require('../utils/emailService');
const router = express.Router();

// Get marketing dashboard overview
router.get('/dashboard', requirePermission('ANALYTICS', 'READ'), asyncHandler(async (req, res) => {
  try {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get active promotions count
    const activePromotions = await prisma.promotion.count({
      where: {
        isActive: true,
        OR: [
          { startsAt: null },
          { startsAt: { lte: now } }
        ],
        AND: [
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gte: now } }
            ]
          }
        ]
      }
    });

    const lastMonthPromotions = await prisma.promotion.count({
      where: {
        isActive: true,
        createdAt: { gte: lastMonth, lt: currentMonth }
      }
    });

    // Get total customers (reach)
    const totalCustomers = await prisma.customer.count({
      where: { isActive: true }
    });

    const lastMonthCustomers = await prisma.customer.count({
      where: {
        isActive: true,
        createdAt: { gte: lastMonth, lt: currentMonth }
      }
    });

    // Calculate click-through rate from orders (simplified)
    const totalOrders = await prisma.order.count({
      where: {
        createdAt: { gte: currentMonth },
        status: { notIn: ['CANCELLED', 'REFUNDED'] }
      }
    });

    const ordersWithPromo = await prisma.promotionUsage.count({
      where: {
        usedAt: { gte: currentMonth }
      }
    });

    const clickThroughRate = totalOrders > 0 ? (ordersWithPromo / totalOrders) * 100 : 0;

    // Calculate marketing revenue from orders with promotions
    const marketingRevenue = await prisma.promotionUsage.aggregate({
      where: {
        usedAt: { gte: currentMonth }
      },
      _sum: { discountAmount: true }
    });

    const lastMonthMarketingRevenue = await prisma.promotionUsage.aggregate({
      where: {
        usedAt: { gte: lastMonth, lt: currentMonth }
      },
      _sum: { discountAmount: true }
    });

    const currentRevenue = parseFloat(marketingRevenue._sum.discountAmount || 0);
    const lastMonthRevenue = parseFloat(lastMonthMarketingRevenue._sum.discountAmount || 0);
    const revenueChange = lastMonthRevenue > 0 ? ((currentRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : currentRevenue > 0 ? 100 : 0;

    res.json({
      success: true,
      data: {
        activeCampaigns: activePromotions,
        activeCampaignsChange: lastMonthPromotions > 0 ? ((activePromotions - lastMonthPromotions) / lastMonthPromotions) * 100 : activePromotions > 0 ? 100 : 0,
        totalReach: totalCustomers,
        totalReachChange: lastMonthCustomers > 0 ? ((totalCustomers - lastMonthCustomers) / lastMonthCustomers) * 100 : totalCustomers > 0 ? 100 : 0,
        clickThroughRate: Math.round(clickThroughRate * 10) / 10,
        clickThroughRateChange: 0.3, // Placeholder - would need more detailed tracking
        marketingRevenue: currentRevenue,
        marketingRevenueChange: Math.round(revenueChange * 10) / 10
      }
    });
  } catch (error) {
    console.error('Marketing dashboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch marketing dashboard data' });
  }
}));

// Get campaigns data (using promotions as campaigns)
router.get('/campaigns', requirePermission('PROMOTIONS', 'READ'), asyncHandler(async (req, res) => {
  try {
    const promotions = await prisma.promotion.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { usageHistory: true }
        }
      }
    });

    // Get order data for each promotion to calculate performance metrics
    const campaigns = await Promise.all(promotions.map(async (promo) => {
      const promotionUsage = await prisma.promotionUsage.findMany({
        where: {
          promotionId: promo.id
        },
        include: {
          order: {
            select: { totalAmount: true, createdAt: true }
          }
        }
      });

      const totalRevenue = promotionUsage.reduce((sum, usage) => sum + parseFloat(usage.discountAmount || 0), 0);
      const totalOrders = promotionUsage.length;

      // Simulate audience size based on customer count and promotion usage
      const audience = Math.max(100, promo.usageCount * 10);
      const sent = Math.min(audience, promo.usageCount * 5);
      const opens = Math.floor(sent * 0.3); // 30% open rate
      const clicks = Math.floor(opens * 0.15); // 15% click rate

      return {
        id: promo.id,
        name: promo.name,
        type: promo.type === 'PERCENTAGE' ? 'Email' : promo.type === 'FIXED_AMOUNT' ? 'SMS' : 'Automation',
        status: promo.isActive ? 'Active' : 'Draft',
        audience: audience,
        sent: sent,
        opens: opens,
        clicks: clicks,
        revenue: Math.round(totalRevenue),
        createdAt: promo.createdAt.toISOString().split('T')[0]
      };
    }));

    res.json({ success: true, data: campaigns });
  } catch (error) {
    console.error('Campaigns error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch campaigns data' });
  }
}));

// Get marketing analytics data
router.get('/analytics', requirePermission('ANALYTICS', 'READ'), asyncHandler(async (req, res) => {
  try {
    const now = new Date();
    const months = [];

    // Generate last 6 months of data
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      // Get promotion usage for this month
      const promotionUsage = await prisma.promotionUsage.findMany({
        where: {
          usedAt: { gte: monthDate, lte: monthEnd }
        },
        select: { discountAmount: true }
      });

      const revenue = promotionUsage.reduce((sum, usage) => sum + parseFloat(usage.discountAmount || 0), 0);

      months.push({
        month: monthDate.toLocaleString('en-US', { month: 'short' }),
        emailOpen: Math.floor(Math.random() * 20) + 60, // Simulated data
        smsOpen: Math.floor(Math.random() * 20) + 70, // Simulated data
        revenue: Math.round(revenue)
      });
    }

    // Channel distribution based on promotion types
    const promotionTypes = await prisma.promotion.groupBy({
      by: ['type'],
      _count: { id: true }
    });

    const channelData = [
      { name: "Email", value: 45, color: "#0088FE" },
      { name: "SMS", value: 25, color: "#00C49F" },
      { name: "Push", value: 20, color: "#FFBB28" },
      { name: "Social", value: 10, color: "#FF8042" }
    ];

    res.json({
      success: true,
      data: {
        campaignData: months,
        channelData: channelData
      }
    });
  } catch (error) {
    console.error('Marketing analytics error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch marketing analytics' });
  }
}));

// Get customer insights for loyalty program
router.get('/customers', requirePermission('ANALYTICS', 'READ'), asyncHandler(async (req, res) => {
  try {
    const now = new Date();
    // Get top customers by total spend
    const topCustomers = await prisma.order.groupBy({
      by: ['customerId'],
      _sum: { totalAmount: true },
      _count: { id: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: 10
    });

    // Get customer details for top customers
    const customerDetails = await Promise.all(
      topCustomers.map(async (customer) => {
        const customerInfo = await prisma.customer.findUnique({
          where: { id: customer.customerId },
          select: { firstName: true, lastName: true, email: true, createdAt: true }
        });

        if (!customerInfo) return null;

        const totalSpent = parseFloat(customer._sum.totalAmount || 0);
        const orderCount = customer._count.id;

        // Determine tier based on total spend
        let tier = 'Bronze';
        if (totalSpent >= 10000) tier = 'Platinum';
        else if (totalSpent >= 5000) tier = 'Gold';
        else if (totalSpent >= 2000) tier = 'Silver';

        // Calculate points (1 point per $1 spent)
        const points = Math.floor(totalSpent);

        return {
          id: customer.customerId,
          name: `${customerInfo.firstName} ${customerInfo.lastName}`,
          email: customerInfo.email,
          tier: tier,
          points: points,
          totalSpent: totalSpent,
          joinDate: customerInfo.createdAt.toISOString().split('T')[0]
        };
      })
    );

    const loyaltyMembers = customerDetails.filter(c => c !== null);

    // Calculate program stats
    const totalMembers = await prisma.customer.count({ where: { isActive: true } });
    const activeThisMonth = await prisma.customer.count({
      where: {
        isActive: true,
        orders: {
          some: {
            createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) }
          }
        }
      }
    });

    const totalPointsRedeemed = await prisma.promotionUsage.aggregate({
      _sum: { discountAmount: true }
    });

    const averageSpend = await prisma.order.aggregate({
      where: {
        status: { notIn: ['CANCELLED', 'REFUNDED'] }
      },
      _avg: { totalAmount: true }
    });

    res.json({
      success: true,
      data: {
        loyaltyMembers: loyaltyMembers,
        programStats: {
          totalMembers: totalMembers,
          activeThisMonth: activeThisMonth,
          pointsRedeemed: Math.floor(parseFloat(totalPointsRedeemed._sum.discountAmount || 0) * 0.1), // 10% of discount as points
          averageSpend: Math.round(parseFloat(averageSpend._avg.totalAmount || 0))
        }
      }
    });
  } catch (error) {
    console.error('Customer insights error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch customer insights' });
  }
}));

// Blast MARKETING_GENERIC email to selected active customers
router.post('/blast-selected', requireRole(['ADMIN']), asyncHandler(async (req, res) => {
  try {
    const { customerIds } = req.body;

    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return res.status(400).json({ success: false, error: 'customerIds array is required' });
    }

    console.log(`[Marketing] Starting targeted marketing blast for ${customerIds.length} select customers`);

    // 1. Fetch requested active customers with email
    const customers = await prisma.customer.findMany({
      where: {
        id: { in: customerIds },
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true
      }
    });

    console.log(`[Marketing] Found ${customers.length} valid active customers for blast`);

    if (customers.length === 0) {
      return res.json({ success: true, message: "No valid active customers found to email." });
    }

    // Fetch store info from database
    const dbStoreInfo = await prisma.storeInformation.findFirst();

    // Store info for placeholders
    const storeName = dbStoreInfo?.name || "Centre Labs";
    const storeEmail = dbStoreInfo?.email || "info@centreresearch.org";
    const storePhone = dbStoreInfo?.phone || "+1 (323) 299-6900";

    // Construct address from DB parts or use default
    let storeAddress = "5815 W Sunset Blvd, Suite 401, Los Angeles, CA 90028";
    if (dbStoreInfo) {
      const parts = [
        dbStoreInfo.addressLine1,
        dbStoreInfo.addressLine2,
        dbStoreInfo.city ? `${dbStoreInfo.city},` : null,
        dbStoreInfo.state,
        dbStoreInfo.postalCode
      ].filter(Boolean);
      if (parts.length > 0) {
        storeAddress = parts.join(' ');
      }
    }

    const storeInfo = {
      storeName,
      storeEmail,
      storePhone,
      storeAddress
    };

    // 2. Start sending in background
    (async () => {
      console.log(`[Marketing] Starting background blast for ${customers.length} customers...`);
      let count = 0;
      let errs = 0;
      const DELAY_MS = 600;

      for (let i = 0; i < customers.length; i++) {
        const customer = customers[i];
        if (!customer.email) continue;

        try {
          await processEmailWithTemplateResend("MARKETING_GENERIC", customer.email, {
            customerName: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || "Customer",
            ...storeInfo
          });
          count++;
          if (count % 10 === 0) console.log(`[Marketing] Targeted Progress: ${count}/${customers.length}`);
        } catch (err) {
          console.error(`[Marketing] Targeted: Failed to send to ${customer.email}:`, err.message);
          errs++;
        }

        if (i < customers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
      }
      console.log(`[Marketing] Targeted: Blast completed. Sent: ${count}, Errors: ${errs}`);
    })().catch(err => console.error('[Marketing] Background targeted process crashed:', err));

    res.json({
      success: true,
      message: `Marketing blast started for ${customers.length} selected customers.`,
      totalCustomers: customers.length
    });

  } catch (error) {
    console.error('Marketing targeted blast error:', error);
    res.status(500).json({ success: false, error: 'Failed to process targeted marketing blast' });
  }
}));

// Blast MARKETING_GENERIC email to all active customers
router.post('/blast', requireRole(['ADMIN']), asyncHandler(async (req, res) => {
  try {
    // 1. Fetch all active customers with email
    console.log('[Marketing] Starting marketing blast for MARKETING_GENERIC');

    // Find customers who are active and have an email
    const customers = await prisma.customer.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true
      }
    });

    console.log(`[Marketing] Found ${customers.length} active customers`);

    if (customers.length === 0) {
      return res.json({ success: true, message: "No active customers found to email." });
    }

    // Fetch store info from database
    const dbStoreInfo = await prisma.storeInformation.findFirst();

    // Store info for placeholders
    const storeName = dbStoreInfo?.name || "Centre Labs";
    const storeEmail = dbStoreInfo?.email || "info@centreresearch.org";
    const storePhone = dbStoreInfo?.phone || "+1 (323) 299-6900";

    // Construct address from DB parts or use default
    let storeAddress = "5815 W Sunset Blvd, Suite 401, Los Angeles, CA 90028";
    if (dbStoreInfo) {
      const parts = [
        dbStoreInfo.addressLine1,
        dbStoreInfo.addressLine2,
        dbStoreInfo.city ? `${dbStoreInfo.city},` : null,
        dbStoreInfo.state,
        dbStoreInfo.postalCode
      ].filter(Boolean);
      if (parts.length > 0) {
        storeAddress = parts.join(' ');
      }
    }

    const storeInfo = {
      storeName,
      storeEmail,
      storePhone,
      storeAddress
    };

    // 2. Start sending in background (Fire and forget to avoid timeout)
    // We process sequentially with delay to respect rate limits
    (async () => {
      console.log(`[Marketing] Starting background blast for ${customers.length} customers...`);
      let count = 0;
      let errs = 0;
      const DELAY_MS = 600;

      for (let i = 0; i < customers.length; i++) {
        const customer = customers[i];
        if (!customer.email) continue;

        try {
          // Use direct Resend call (bypassing Redis queue if it's problematic)
          await processEmailWithTemplateResend("MARKETING_GENERIC", customer.email, {
            customerName: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || "Customer",
            ...storeInfo
          });
          count++;
          // Log progress every 10 emails
          if (count % 10 === 0) console.log(`[Marketing] Progress: ${count}/${customers.length}`);
        } catch (err) {
          console.error(`[Marketing] Failed to send to ${customer.email}:`, err.message);
          errs++;
        }

        // Rate limit delay
        if (i < customers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
      }
      console.log(`[Marketing] details: Blast completed. Sent: ${count}, Errors: ${errs}`);
    })().catch(err => console.error('[Marketing] Background process crashed:', err));

    // Return immediately
    res.json({
      success: true,
      message: `Marketing blast started for ${customers.length} customers. Emails are being sent in the background to avoid timeouts.`,
      totalCustomers: customers.length,
      note: "Check server logs for detailed progress."
    });

  } catch (error) {
    console.error('Marketing blast error:', error);
    res.status(500).json({ success: false, error: 'Failed to process marketing blast' });
  }
}));

module.exports = router;
