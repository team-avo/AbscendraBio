const prisma = require('../prisma/client');
const { sendEmailWithTemplate } = require('../utils/emailService');
const logger = require('../utils/logger');
const { sendSms } = require('../utils/smsService');


// Build a simple audience: active customers with an email
async function buildAudience(campaign) {
  // Basic audience filter support (by customerType)
  let customerTypeFilter = undefined;
  try {
    if (campaign.audienceFilter) {
      const f = typeof campaign.audienceFilter === 'string' ? JSON.parse(campaign.audienceFilter) : campaign.audienceFilter;
      if (f && f.customerType && ['B2C', 'B2B', 'ENTERPRISE'].includes(f.customerType)) {
        customerTypeFilter = f.customerType;
      }
    }
  } catch { }

  const customers = await prisma.customer.findMany({
    where: {
      isActive: true,
      ...(customerTypeFilter ? { customerType: customerTypeFilter } : {})
    },
    select: { id: true, firstName: true, lastName: true, email: true }
  });
  return customers.filter(c => !!c.email);
}

// Dispatch a campaign to its audience
async function dispatchCampaign(campaignId) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status === 'PAUSED' || campaign.status === 'COMPLETED') {
    return { skipped: true, reason: `Campaign status is ${campaign.status}` };
  }

  const audience = await buildAudience(campaign);

  // Mark as started
  await prisma.campaign.update({ where: { id: campaign.id }, data: { startedAt: new Date(), status: 'ACTIVE' } });

  let sent = 0;
  for (const customer of audience) {
    try {
      const data = {
        customerName: `${customer.firstName} ${customer.lastName}`,
        customerEmail: customer.email,
        storeName: 'Ascendra Bio',
        storeEmail: 'contact@ascendrabio.com',
        storePhone: '+1 (555) 123-4567',
        storeAddress: '123 Research Ave, Science City, SC 12345',
        campaignName: campaign.name
      };
      if (campaign.type === 'EMAIL') {
        const templateType = campaign.emailTemplateType || 'MARKETING_GENERIC';
        await sendEmailWithTemplate(templateType, customer.email, data);
      } else if (campaign.type === 'SMS') {
        const smsBody = `Promo: ${campaign.name} at Ascendra Bio`;
        // Note: customer table currently holds email; extend to mobile if available
        // Attempt send only if mobile exists
        const mobile = customer.mobile || null;
        if (!mobile) throw new Error('No mobile number');
        await sendSms(mobile, smsBody);
      }

      await prisma.campaignEvent.create({
        data: {
          campaignId: campaign.id,
          customerId: customer.id,
          eventType: 'SENT'
        }
      });
      sent += 1;
    } catch (err) {
      // Continue with next recipient; could add a FAILED event if desired
      logger.error(`[Campaign ${campaign.id}] Failed to send to ${customer.email}`, { error: err.message });
    }
  }

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      sentCount: (campaign.sentCount || 0) + sent,
      audienceCount: audience.length,
      status: 'COMPLETED',
      completedAt: new Date()
    }
  });

  return { sent, audience: audience.length };
}

module.exports = {
  dispatchCampaign,
};


