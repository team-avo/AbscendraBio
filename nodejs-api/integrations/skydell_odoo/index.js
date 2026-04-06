/**
 * Odoo Integration - Public Exports
 *
 * Main entry point for Odoo inventory sync integration.
 * Use these functions in routes/orders.js and routes/inventory.js
 */

const {
  queueVariantSync,
  queueProductSync,
  queueFullSync,
  getJobStatus,
  getQueueStats,
} = require("./odooSyncQueue");
const {
  syncVariantToOdoo,
  syncProductToOdoo,
  syncAllVariantsToOdoo,
  getVariantPriceForChannel,
  getVariantAttributes,
} = require("./odooSyncService");
const odooClient = require("./odooClient");

module.exports = {
  // Queue functions (recommended for production use - async)
  queueVariantSync, // Legacy - redirects to product sync
  queueProductSync, // Preferred - syncs all variants of a product at once
  queueFullSync,
  getJobStatus,
  getQueueStats,

  // Direct sync functions (for testing or synchronous operations)
  syncVariantToOdoo, // Legacy - redirects to product sync
  syncProductToOdoo, // Preferred - syncs all variants of a product at once
  syncAllVariantsToOdoo,

  // Price and attribute helpers
  getVariantPriceForChannel,
  getVariantAttributes,

  // Integration status helpers
  isIntegrationEnabled: odooClient.isIntegrationEnabled,
  getLinkedSalesChannelId: odooClient.getLinkedSalesChannelId,
  clearConfigCache: odooClient.clearConfigCache,

  // Low-level Odoo client (for advanced use cases)
  odooClient,
};
