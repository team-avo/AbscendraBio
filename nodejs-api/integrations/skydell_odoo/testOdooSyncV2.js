/**
 * Odoo Sync Test Script (v2)
 *
 * Simple tests for Odoo integration with variant support.
 * Tests: Connection, Create with variants, Read, Update with variants
 *
 * Usage: node integrations/skydell_odoo/testOdooSyncV2.js [test-name]
 * Tests: connection, create, read, update, all
 */

require("dotenv").config();
const odooClient = require("./odooClient");
const odooSyncService = require("./odooSyncService");

// Test data - unique SKU per run
const timestamp = Date.now();
const TEST_SKU = `TEST-V2-${timestamp}`;
const TEST_VARIANT_SKU = `TEST-V2-VAR-${timestamp}`;

// Test 1: Connection Test
async function testConnection() {
  console.log("\n=== Test 1: Connection Test ===");

  const config = await odooClient.getConfig();
  console.log("Config loaded:", {
    baseUrl: config.apiBaseUrl,
    partnerId: config.partnerId,
    enabled: config.isEnabled,
    salesChannel: config.salesChannelId,
  });

  // Try to read a non-existent product (should fail gracefully)
  const result = await odooClient.readProduct("NON-EXISTENT-SKU-12345");

  if (result.status !== 0) {
    console.log("✅ Connection successful (got response from Odoo)");
    return true;
  } else {
    console.log("❌ Connection failed - no response from server");
    return false;
  }
}

// Test 2: Create Product with Variants
async function testCreateWithVariants() {
  console.log("\n=== Test 2: Create Product with Variants ===");

  const productData = {
    name: `Test Product V2 ${timestamp}`,
    default_code: TEST_SKU,
    vendor_on_hand_qty: 100,
  };

  const supplierData = {
    price: 25.99,
  };

  const variants = [
    {
      default_code: TEST_VARIANT_SKU,
      vendor_on_hand_qty: 50,
      price: 29.99,
      attributes: {
        Size: "5mg",
        Purity: "99.5%",
      },
    },
  ];

  console.log("Creating product:", TEST_SKU);
  console.log("With variant:", TEST_VARIANT_SKU);
  console.log("Attributes:", variants[0].attributes);

  const result = await odooClient.createProductWithVariants(
    productData,
    supplierData,
    variants,
  );

  if (result.success) {
    console.log("✅ Product created successfully");
    console.log("Odoo Product ID:", result.data?.result?.product_id);
    return true;
  } else {
    console.log("❌ Create failed:", result.error);
    return false;
  }
}

// Test 3: Read Product
async function testReadProduct() {
  console.log("\n=== Test 3: Read Product ===");

  const result = await odooClient.readProduct(TEST_SKU);

  if (result.success && result.data?.result?.product) {
    console.log("✅ Product read successfully");
    console.log("Product:", result.data.result.product);
    return true;
  } else {
    console.log("❌ Read failed or product not found");
    console.log("Response:", result.data || result.error);
    return false;
  }
}

// Test 4: Update Product with Variants
async function testUpdateWithVariants() {
  console.log("\n=== Test 4: Update Product with Variants ===");

  const productUpdates = {
    vendor_on_hand_qty: 75,
  };

  const supplierUpdates = {
    price: 27.99,
  };

  const variantUpdates = [
    {
      default_code: TEST_VARIANT_SKU,
      vendor_on_hand_qty: 35,
      price: 31.99,
      attributes: {
        Size: "5mg",
        Purity: "99.5%",
        Batch: "2025-01",
      },
    },
  ];

  console.log("Updating product:", TEST_SKU);
  console.log("New stock: 75, New price: 27.99");
  console.log("Variant new stock: 35, New price: 31.99");

  const result = await odooClient.updateProductWithVariants(
    TEST_SKU,
    productUpdates,
    supplierUpdates,
    variantUpdates,
  );

  if (result.success) {
    console.log("✅ Product updated successfully");
    return true;
  } else {
    console.log("❌ Update failed:", result.error);
    return false;
  }
}

// Test 5: Price Lookup (mock test - requires DB data)
async function testPriceLookup() {
  console.log("\n=== Test 5: Price Lookup ===");

  // This tests the getVariantPriceForChannel function
  // Will use fallback price since we don't have real variant data

  const price = await odooSyncService.getVariantPriceForChannel(
    "non-existent-variant-id",
    null, // No sales channel
    19.99, // Fallback price
  );

  if (price === 19.99) {
    console.log("✅ Price fallback works correctly");
    return true;
  } else {
    console.log("❌ Unexpected price:", price);
    return false;
  }
}

// Test 6: Check Integration Status
async function testIntegrationStatus() {
  console.log("\n=== Test 6: Integration Status ===");

  const enabled = await odooClient.isIntegrationEnabled();
  const salesChannelId = await odooClient.getLinkedSalesChannelId();

  console.log("Integration enabled:", enabled);
  console.log("Linked sales channel:", salesChannelId || "None");
  console.log("✅ Status check completed");
  return true;
}

// Run all tests
async function runAllTests() {
  console.log("=======================================");
  console.log("  Odoo Integration Test Suite v2");
  console.log("=======================================");
  console.log(`Test SKU: ${TEST_SKU}`);
  console.log(`Variant SKU: ${TEST_VARIANT_SKU}`);

  const results = {
    connection: false,
    integrationStatus: false,
    priceLookup: false,
    create: false,
    read: false,
    update: false,
  };

  try {
    results.connection = await testConnection();
    results.integrationStatus = await testIntegrationStatus();
    results.priceLookup = await testPriceLookup();

    // Only run API tests if connection works
    if (results.connection) {
      results.create = await testCreateWithVariants();

      if (results.create) {
        results.read = await testReadProduct();
        results.update = await testUpdateWithVariants();
      }
    }
  } catch (error) {
    console.error("\n❌ Test suite error:", error.message);
  }

  // Summary
  console.log("\n=======================================");
  console.log("  Test Results Summary");
  console.log("=======================================");

  let passed = 0;
  let failed = 0;

  for (const [test, result] of Object.entries(results)) {
    const status = result ? "✅ PASS" : "❌ FAIL";
    console.log(`  ${status}: ${test}`);
    result ? passed++ : failed++;
  }

  console.log("---------------------------------------");
  console.log(`  Total: ${passed} passed, ${failed} failed`);
  console.log("=======================================\n");

  return failed === 0;
}

// CLI handler
async function main() {
  const testName = process.argv[2] || "all";

  switch (testName) {
    case "connection":
      await testConnection();
      break;
    case "status":
      await testIntegrationStatus();
      break;
    case "price":
      await testPriceLookup();
      break;
    case "create":
      await testConnection();
      await testCreateWithVariants();
      break;
    case "read":
      await testReadProduct();
      break;
    case "update":
      await testUpdateWithVariants();
      break;
    case "all":
    default:
      const success = await runAllTests();
      process.exit(success ? 0 : 1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
