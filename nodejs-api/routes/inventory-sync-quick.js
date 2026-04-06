const express = require('express');
const router = express.Router();
const prisma = require('../prisma/client');
const { requirePermission } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { ssRequest } = require('../utils/shipstationClient');

/**
 * Smart sync endpoint that:
 * 1. Fetches all ShipStation inventory
 * 2. Gets all database variants with shipstationSku
 * 3. Matches ShipStation SKU with database shipstationSku column
 * 4. Updates inventory quantities for matched items
 */
router.post(
  '/quick-sync',
  requirePermission('INVENTORY', 'WRITE'),
  asyncHandler(async (req, res) => {
    console.log('[QUICK SYNC] Starting smart inventory sync...');
    const startTime = Date.now();

    try {
      // Fetch all ShipStation inventory
      console.log('[QUICK SYNC] Fetching ShipStation inventory...');
      let allInventory = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await ssRequest('GET', `/v2/inventory?page_size=100&page=${page}`);
        if (response.data && response.data.inventory && response.data.inventory.length > 0) {
          allInventory = allInventory.concat(response.data.inventory);
          if (response.data.pages && page < response.data.pages) {
            page++;
          } else {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      console.log(`[QUICK SYNC] Fetched ${allInventory.length} items from ShipStation`);

      // Get all database variants with shipstationSku
      const variants = await prisma.productVariant.findMany({
        select: {
          id: true,
          name: true,
          shipstationSku: true,
          product: { select: { name: true } }
        }
      });

      console.log(`[QUICK SYNC] Found ${variants.length} variants in database`);

      // Create a map of shipstationSku -> variant for quick lookup
      const skuToVariant = {};
      variants.forEach(variant => {
        if (variant.shipstationSku) {
          skuToVariant[variant.shipstationSku] = variant;
        }
      });

      console.log(`[QUICK SYNC] Variants with shipstationSku: ${Object.keys(skuToVariant).length}`);
      console.log(`[QUICK SYNC] Sample SKUs in database: ${Object.keys(skuToVariant).slice(0, 5).join(', ')}`);

      // Get or create default location
      let location = await prisma.location.findFirst({ where: { isActive: true } });
      if (!location) {
        location = await prisma.location.create({
          data: { name: 'Default Warehouse', isActive: true }
        });
        console.log('[QUICK SYNC] Created default location');
      }

      let synced = 0;
      let skipped = 0;
      let errors = 0;

      // Match ShipStation inventory with database variants by shipstationSku
      for (const ssItem of allInventory) {
        try {
          const shipstationSku = ssItem.sku;

          // Extract available quantity
          let quantity = ssItem.available || ssItem.on_hand || 0;

          console.log(`[QUICK SYNC] Processing SKU: ${shipstationSku}, Quantity: ${quantity}`);

          // Find matching variant by shipstationSku
          const variant = skuToVariant[shipstationSku];

          if (!variant) {
            console.warn(`[QUICK SYNC] ⊘ No variant found for SKU: ${shipstationSku}`);
            skipped++;
            continue;
          }

          // Update or create inventory
          let inventory = await prisma.inventory.findUnique({
            where: {
              variantId_locationId: {
                variantId: variant.id,
                locationId: location.id
              }
            }
          });

          if (!inventory) {
            await prisma.inventory.create({
              data: {
                variantId: variant.id,
                locationId: location.id,
                quantity: quantity,
                reservedQty: 0,
                lowStockAlert: 10
              }
            });
            console.log(`[QUICK SYNC] ✓ Created inventory for ${variant.product.name} - ${variant.name}: ${quantity} units`);
          } else {
            await prisma.inventory.update({
              where: { id: inventory.id },
              data: { quantity: quantity, updatedAt: new Date() }
            });
            console.log(`[QUICK SYNC] ✓ Updated inventory for ${variant.product.name} - ${variant.name}: ${quantity} units`);
          }

          synced++;
        } catch (error) {
          console.error(`[QUICK SYNC] ✗ Error processing SKU ${ssItem.sku}:`, error.message);
          errors++;
        }
      }

      const duration = Date.now() - startTime;

      res.json({
        success: true,
        message: `Synced ${synced} items from ShipStation`,
        data: {
          synced,
          skipped,
          errors,
          total: allInventory.length,
          duration: `${duration}ms`
        }
      });
    } catch (error) {
      console.error('[QUICK SYNC] Fatal error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Quick sync failed'
      });
    }
  })
);

module.exports = router;
