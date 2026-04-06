const cron = require('node-cron');
const { syncShipStationInventory } = require('./inventorySyncService');

/**
 * Schedule automatic inventory sync from ShipStation
 * Runs daily at 2:00 AM by default
 */
function scheduleInventorySyncJob() {
  try {
    // Schedule sync to run daily at 2:00 AM (02:00)
    // Format: minute hour day month dayOfWeek
    const job = cron.schedule('0 2 * * *', async () => {
      console.log('[INVENTORY SYNC SCHEDULER] Starting scheduled inventory sync...');
      try {
        const result = await syncShipStationInventory();
        console.log('[INVENTORY SYNC SCHEDULER] Sync completed:', result);
      } catch (error) {
        console.error('[INVENTORY SYNC SCHEDULER] Error during scheduled sync:', error);
      }
    });

    console.log('[INVENTORY SYNC SCHEDULER] Inventory sync job scheduled for daily at 2:00 AM');
    return job;
  } catch (error) {
    console.error('[INVENTORY SYNC SCHEDULER] Failed to schedule inventory sync:', error);
    throw error;
  }
}

/**
 * Schedule sync at custom time
 * @param {string} cronExpression - Cron expression for custom schedule
 */
function scheduleInventorySyncJobCustom(cronExpression) {
  try {
    const job = cron.schedule(cronExpression, async () => {
      console.log('[INVENTORY SYNC SCHEDULER] Starting scheduled inventory sync...');
      try {
        const result = await syncShipStationInventory();
        console.log('[INVENTORY SYNC SCHEDULER] Sync completed:', result);
      } catch (error) {
        console.error('[INVENTORY SYNC SCHEDULER] Error during scheduled sync:', error);
      }
    });

    console.log(`[INVENTORY SYNC SCHEDULER] Inventory sync job scheduled with cron: ${cronExpression}`);
    return job;
  } catch (error) {
    console.error('[INVENTORY SYNC SCHEDULER] Failed to schedule inventory sync:', error);
    throw error;
  }
}

module.exports = {
  scheduleInventorySyncJob,
  scheduleInventorySyncJobCustom
};
