/**
 * Odoo Integration Config Seed
 *
 * Seeds the OdooIntegrationConfig table with default values from environment variables.
 * This ensures existing setups continue to work after migrating to database-backed config.
 */

const prisma = require('../client');

async function seedOdooIntegrationConfig(prisma) {
  console.log("🔧 Seeding Odoo Integration Config...");

  // Check if config already exists
  const existingConfig = await prisma.odooIntegrationConfig.findFirst();

  if (existingConfig) {
    console.log("   Config already exists, skipping seed");
    return existingConfig;
  }

  // Create default config from environment variables
  const config = await prisma.odooIntegrationConfig.create({
    data: {
      name: "Skydell Odoo Integration",
      isEnabled: false, // Disabled by default, enable via admin UI
      apiBaseUrl:
        process.env.ODOO_API_BASE_URL || "https://bol9967-odoo18-tk.odoo.com",
      apiToken:
        process.env.ODOO_API_TOKEN ||
        "aO1V5iLQJ285eMPKy1iQv_wuZYOEfSXtxbMjwhTXBoc",
      partnerId: process.env.ODOO_PARTNER_ID || "13",
      salesChannelId: null, // Must be linked via admin UI
      lastSyncStatus: "Not synced yet",
      syncedProducts: 0,
      syncedVariants: 0,
    },
  });

  console.log(`   ✅ Created Odoo Integration Config (ID: ${config.id})`);
  console.log(`   - API Base URL: ${config.apiBaseUrl}`);
  console.log(`   - Partner ID: ${config.partnerId}`);
  console.log(`   - Enabled: ${config.isEnabled}`);
  console.log(`   - Sales Channel: ${config.salesChannelId || "Not linked"}`);

  return config;
}

module.exports = { seedOdooIntegrationConfig };

// Allow running directly: node prisma/seeds/odooIntegrationConfig.js
if (require.main === module) {
  const prisma = require('../client');
  seedOdooIntegrationConfig(prisma)
    .then(() => {
      console.log("Seed completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seed failed:", error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
