const prisma = require('../prisma/client');
const { dispatchCampaign } = require('../services/campaignService');
const logger = require('../utils/logger');


// Run every 5 minutes
async function run() {
  const now = new Date();
  const due = await prisma.campaign.findMany({
    where: {
      status: { in: ['DRAFT', 'ACTIVE'] },
      scheduledAt: { lte: now }
    },
    select: { id: true }
  });

  for (const c of due) {
    try {
      await dispatchCampaign(c.id);
    } catch (err) {
      logger.error(`[Scheduler] Failed to dispatch campaign ${c.id}`, { error: err.message });
    }
  }
}

module.exports = { run };
