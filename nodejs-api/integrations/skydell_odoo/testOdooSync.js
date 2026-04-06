/**
 * Test Script for Odoo Integration
 *
 * Creates a test product variant and syncs it directly to Odoo.
 * Run this script locally before pushing to staging.
 *
 * Usage:
 *   node integrations/skydell_odoo/testOdooSync.js
 */

require("dotenv").config();
const prisma = require("../../prisma/client");
const odooClient = require("./odooClient");
const { syncVariantToOdoo } = require("./odooSyncService");

const TEST_PRODUCT_NAME = "test_local_product";
const TEST_VARIANT_SKU = "TEST-LOCAL-001";
const TEST_VARIANT_NAME = "5mg";

async function main() {
  console.log("\n========================================");
  console.log("Odoo Integration Test Script");
  console.log("========================================\n");

  console.log("Configuration:");
  console.log(
    `  Base URL: ${
      process.env.ODOO_API_BASE_URL || "https://bol9967-odoo18-tk.odoo.com"
    }`,
  );
  console.log(`  Partner ID: ${process.env.ODOO_PARTNER_ID || "13"}`);
  console.log(
    `  API Token: ${(
      process.env.ODOO_API_TOKEN ||
      "aO1V5iLQJ285eMPKy1iQv_wuZYOEfSXtxbMjwhTXBoc"
    ).substring(0, 10)}...`,
  );
  console.log("");

  try {
    // Step 1: Check if test product already exists
    console.log("Step 1: Checking for existing test product...");
    let testProduct = await prisma.product.findFirst({
      where: { name: TEST_PRODUCT_NAME },
    });

    if (!testProduct) {
      console.log("  → Creating test product...");
      testProduct = await prisma.product.create({
        data: {
          name: TEST_PRODUCT_NAME,
          description: "Test product for Odoo integration - safe to delete",
          status: "ACTIVE",
        },
      });
      console.log(`  ✓ Test product created: ${testProduct.id}`);
    } else {
      console.log(`  ✓ Test product exists: ${testProduct.id}`);
    }

    // Step 2: Check if test variant already exists
    console.log("\nStep 2: Checking for existing test variant...");
    let testVariant = await prisma.productVariant.findFirst({
      where: { sku: TEST_VARIANT_SKU },
    });

    if (!testVariant) {
      console.log("  → Creating test variant...");
      testVariant = await prisma.productVariant.create({
        data: {
          productId: testProduct.id,
          sku: TEST_VARIANT_SKU,
          name: TEST_VARIANT_NAME,
          description: "Test variant for Odoo sync",
          regularPrice: 99.99,
          salePrice: 79.99,
          isActive: true,
        },
      });
      console.log(`  ✓ Test variant created: ${testVariant.id}`);
    } else {
      console.log(`  ✓ Test variant exists: ${testVariant.id}`);
    }

    // Step 3: Create or update inventory
    console.log("\nStep 3: Setting up inventory...");

    // Get default location
    let location = await prisma.location.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });

    if (!location) {
      console.log("  → Creating default location...");
      location = await prisma.location.create({
        data: {
          name: "Test Warehouse",
          address: "123 Test St",
          city: "Test City",
          state: "CA",
          country: "US",
          postalCode: "90001",
          isActive: true,
        },
      });
      console.log(`  ✓ Location created: ${location.id}`);
    } else {
      console.log(`  ✓ Using location: ${location.name} (${location.id})`);
    }

    // Check inventory
    let inventory = await prisma.inventory.findFirst({
      where: {
        variantId: testVariant.id,
        locationId: location.id,
      },
    });

    if (!inventory) {
      console.log("  → Creating inventory record...");
      inventory = await prisma.inventory.create({
        data: {
          variantId: testVariant.id,
          locationId: location.id,
          quantity: 100,
          reservedQty: 10,
          lowStockAlert: 20,
        },
      });
      console.log(`  ✓ Inventory created: ${inventory.id}`);
    } else {
      console.log("  → Updating inventory record...");
      inventory = await prisma.inventory.update({
        where: { id: inventory.id },
        data: {
          quantity: 100,
          reservedQty: 10,
        },
      });
      console.log(`  ✓ Inventory updated: ${inventory.id}`);
    }

    console.log(
      `  ✓ Available stock: ${inventory.quantity - inventory.reservedQty} units`,
    );

    // Step 4: Test direct Odoo API calls
    console.log("\n========================================");
    console.log("Step 4: Testing Direct Odoo API");
    console.log("========================================\n");

    // Test 1: Read product (to check if it exists)
    console.log("Test 4a: Reading product from Odoo...");
    const readResult = await odooClient.readProduct(TEST_VARIANT_SKU);
    console.log(`  Result: ${readResult.success ? "SUCCESS" : "FAILED"}`);
    if (readResult.success) {
      console.log(
        "  Product exists in Odoo:",
        JSON.stringify(readResult.data, null, 2),
      );
    } else {
      console.log(
        "  Product does not exist in Odoo (this is expected for first run)",
      );
    }

    // Test 2: Create or Update product
    const productExists =
      readResult.success && readResult.data && !readResult.data.error;

    if (productExists) {
      console.log("\nTest 4b: Updating product in Odoo...");
      const updateResult = await odooClient.updateProduct(
        TEST_VARIANT_SKU,
        { vendor_on_hand_qty: 90 },
        { price: 0 },
      );
      console.log(`  Result: ${updateResult.success ? "SUCCESS" : "FAILED"}`);
      if (updateResult.success) {
        console.log("  ✓ Product updated successfully");
      } else {
        console.error("  ✗ Update failed:", updateResult.error);
      }
    } else {
      console.log("\nTest 4b: Creating product in Odoo...");
      const createResult = await odooClient.createProduct(
        {
          name: `${TEST_PRODUCT_NAME} - ${TEST_VARIANT_NAME}`,
          default_code: TEST_VARIANT_SKU,
          vendor_on_hand_qty: 90,
        },
        { price: 0 },
      );
      console.log(`  Result: ${createResult.success ? "SUCCESS" : "FAILED"}`);
      if (createResult.success) {
        console.log("  ✓ Product created successfully");
        console.log("  Response:", JSON.stringify(createResult.data, null, 2));
      } else {
        console.error("  ✗ Creation failed:", createResult.error);
      }
    }

    // Step 5: Test sync service (with logging)
    console.log("\n========================================");
    console.log("Step 5: Testing Sync Service");
    console.log("========================================\n");

    const syncResult = await syncVariantToOdoo(testVariant.id, "TEST");
    console.log(`Sync Result: ${syncResult.success ? "SUCCESS" : "FAILED"}`);
    console.log(`  Variant ID: ${syncResult.variantId}`);
    console.log(`  Variant SKU: ${syncResult.variantSku}`);
    console.log(`  Log ID: ${syncResult.logId}`);

    if (syncResult.success) {
      console.log("  ✓ Sync completed successfully");
    } else {
      console.error(
        "  ✗ Sync failed:",
        syncResult.error || syncResult.odooResponse?.error,
      );
    }

    // Step 6: Verify sync log was created
    console.log("\nStep 6: Verifying sync log...");
    const syncLog = await prisma.odooSyncLog.findUnique({
      where: { id: syncResult.logId },
    });

    if (syncLog) {
      console.log("  ✓ Sync log created successfully");
      console.log("  Log details:");
      console.log(`    - Status: ${syncLog.status}`);
      console.log(`    - Trigger: ${syncLog.triggerType}`);
      console.log(`    - Variant SKU: ${syncLog.variantSku}`);
      console.log(`    - Created: ${syncLog.createdAt}`);
      if (syncLog.errorMessage) {
        console.log(`    - Error: ${syncLog.errorMessage}`);
      }
    } else {
      console.error("  ✗ Sync log not found!");
    }

    console.log("\n========================================");
    console.log("Test Complete!");
    console.log("========================================\n");

    console.log("Summary:");
    console.log(`  Product: ${testProduct.name} (${testProduct.id})`);
    console.log(`  Variant: ${testVariant.sku} (${testVariant.id})`);
    console.log(
      `  Inventory: ${
        inventory.quantity - inventory.reservedQty
      } units available`,
    );
    console.log(`  Sync Status: ${syncResult.success ? "SUCCESS" : "FAILED"}`);
    console.log(`  Log ID: ${syncResult.logId}`);
    console.log("");
    console.log("Next steps:");
    console.log(
      "  1. Check the Odoo system to verify the product was created/updated",
    );
    console.log("  2. Query sync logs via API: GET /api/odoo/sync/logs");
    console.log(
      "  3. If successful, test order shipment and inventory update triggers",
    );
    console.log(
      "  4. Clean up: Delete test product and variant from database if desired",
    );
    console.log("");
  } catch (error) {
    console.error("\n========================================");
    console.error("ERROR:", error.message);
    console.error("========================================\n");
    console.error("Full error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
main();
