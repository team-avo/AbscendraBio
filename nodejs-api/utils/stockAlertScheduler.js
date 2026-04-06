const prisma = require('../prisma/client');
const cron = require('node-cron');
const { sendStockAlertEmail } = require('./emailService');

// Store for tracking which alerts have been sent today
const sentAlertsToday = new Set();

/**
 * Get store information including email
 */
const getStoreInformation = async () => {
  try {
    const store = await prisma.storeInformation.findFirst();
    return store;
  } catch (error) {
    console.error('Error fetching store information:', error);
    return null;
  }
};

/**
 * Get all low stock items
 */
const getLowStockItems = async () => {
  try {
    // Fetch all inventory items and filter in memory
    const allInventory = await prisma.inventory.findMany({
      include: {
        variant: {
          include: {
            product: {
              select: { name: true, status: true },
            },
          },
        },
        location: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    console.log(`[DEBUG] Total inventory records found: ${allInventory.length}`);
    if (allInventory.length > 0) {
      console.log(`[DEBUG] Sample inventory item:`, JSON.stringify(allInventory[0], null, 2));
    }

    // Filter for low stock items (quantity > 0 but <= lowStockAlert)
    const lowStockItems = allInventory.filter((item) => {
      const total = item.quantity || 0;
      const reserved = item.reservedQty || 0;
      const available = Math.max(0, total - reserved);
      const threshold = item.lowStockAlert || 0;
      return available > 0 && available <= threshold;
    });

    return lowStockItems;
  } catch (error) {
    console.error('Error fetching low stock items:', error);
    return [];
  }
};

/**
 * Get all out of stock items
 */
const getOutOfStockItems = async () => {
  try {
    // Fetch all inventory items and filter in memory
    const allInventory = await prisma.inventory.findMany({
      include: {
        variant: {
          include: {
            product: {
              select: { name: true, status: true },
            },
          },
        },
        location: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    console.log(`[DEBUG] Total inventory records found: ${allInventory.length}`);

    // Filter for out of stock items (available quantity <= 0)
    const outOfStockFromInventory = allInventory.filter((item) => {
      const total = item.quantity || 0;
      const reserved = item.reservedQty || 0;
      const available = Math.max(0, total - reserved);
      return available <= 0;
    });

    console.log(`[DEBUG] Out of stock from inventory records: ${outOfStockFromInventory.length}`);

    // Also fetch variants with NO inventory records (these are completely out of stock)
    const variantsWithoutInventory = await prisma.productVariant.findMany({
      where: {
        inventory: { none: {} }, // No inventory records exist
      },
      include: {
        product: { select: { name: true, status: true } },
      },
    });

    console.log(`[DEBUG] Variants with no inventory records: ${variantsWithoutInventory.length}`);

    // Convert variants without inventory to synthetic inventory items
    const syntheticOutOfStockItems = variantsWithoutInventory.map((variant) => ({
      id: `synthetic-${variant.id}`,
      quantity: 0,
      reservedQty: 0,
      lowStockAlert: 10,
      variant: {
        id: variant.id,
        sku: variant.sku,
        name: variant.name,
        product: {
          name: variant.product?.name || '',
          status: variant.product?.status || 'ACTIVE',
        },
      },
      location: {
        id: '',
        name: 'Unassigned',
      },
    }));

    // Combine both out of stock sources
    const allOutOfStockItems = [...outOfStockFromInventory, ...syntheticOutOfStockItems];
    console.log(`[DEBUG] Total out of stock items (including synthetic): ${allOutOfStockItems.length}`);

    return allOutOfStockItems;
  } catch (error) {
    console.error('Error fetching out of stock items:', error);
    return [];
  }
};

/**
 * Send stock alert email using emailService
 */
const sendStockAlertEmailToStore = async (storeEmail, lowStockItems, outOfStockItems, storeInfo) => {
  try {
    if (!storeEmail) {
      console.warn('No store email configured for stock alerts');
      return;
    }

    const totalAlerts = lowStockItems.length + outOfStockItems.length;

    if (totalAlerts === 0) {
      console.log('No stock alerts to send');
      return;
    }

    console.log(`Sending stock alert email to ${storeEmail}`);
    const result = await sendStockAlertEmail(storeEmail, lowStockItems, outOfStockItems, storeInfo);
    console.log('Stock alert email sent successfully');
    return result;
  } catch (error) {
    console.error('Error sending stock alert email:', error);
    throw error;
  }
};

/**
 * Check and send stock alerts
 */
const checkAndSendStockAlerts = async () => {
  try {
    console.log(`[${new Date().toISOString()}] Starting stock alert check...`);

    // Get store information
    const store = await getStoreInformation();
    if (!store || !store.email) {
      console.warn('Store information not found or email not configured');
      return;
    }

    console.log(`Store email configured: ${store.email}`);

    // Get low stock and out of stock items
    console.log('Fetching low stock items...');
    const lowStockItems = await getLowStockItems();
    console.log(`Found ${lowStockItems.length} low stock items`);

    console.log('Fetching out of stock items...');
    const outOfStockItems = await getOutOfStockItems();
    console.log(`Found ${outOfStockItems.length} out of stock items`);

    const totalAlerts = lowStockItems.length + outOfStockItems.length;

    if (totalAlerts === 0) {
      console.log('No stock alerts to send - all inventory levels are healthy');
      return;
    }

    console.log(`Found ${totalAlerts} stock alerts (${outOfStockItems.length} out of stock, ${lowStockItems.length} low stock)`);

    // Send email alert
    await sendStockAlertEmailToStore(store.email, lowStockItems, outOfStockItems, store);

    console.log(`[${new Date().toISOString()}] Stock alert check completed successfully`);
  } catch (error) {
    console.error('Error in stock alert check:', error);
  }
};

/**
 * Initialize stock alert scheduler
 * Runs daily at 1:00 AM (01:00)
 */
const initializeStockAlertScheduler = () => {
  try {
    console.log('Initializing stock alert scheduler...');

    // Schedule job to run daily at 1:00 AM
    // Cron format: minute hour day month day-of-week
    // 0 1 * * * = 1:00 AM every day
    const job = cron.schedule('0 1 * * *', async () => {
      console.log(`[${new Date().toISOString()}] Stock alert scheduler triggered`);
      await checkAndSendStockAlerts();
    });

    console.log('Stock alert scheduler initialized successfully');
    console.log('Scheduler will run daily at 1:00 AM');

    return job;
  } catch (error) {
    console.error('Error initializing stock alert scheduler:', error);
    throw error;
  }
};

/**
 * Manual trigger for testing (can be called from API endpoint)
 */
const triggerStockAlertManually = async () => {
  try {
    console.log('Manually triggering stock alert check...');
    await checkAndSendStockAlerts();
    return { success: true, message: 'Stock alert check completed' };
  } catch (error) {
    console.error('Error in manual stock alert trigger:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  initializeStockAlertScheduler,
  triggerStockAlertManually,
  checkAndSendStockAlerts,
  sendStockAlertEmail,
  getLowStockItems,
  getOutOfStockItems,
};
