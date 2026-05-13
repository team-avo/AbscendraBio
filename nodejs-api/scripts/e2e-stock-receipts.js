// End-to-end smoke test for the supplier stock receipt flow.
// Does NOT require Gmail credentials — it monkey-patches the gmail service
// to return canned data so the cron's processMessage runs against the fixture HTML.
//
// Steps:
//   1. Ensure a Location + SupplierEmailSource exist (creating test fixtures)
//   2. Seed one SupplierProductMapping (for auto-match)
//   3. Simulate cron: parse fixture HTML, write PendingStockReceipt + lines
//   4. Manually map the remaining UNMATCHED lines to test variants
//   5. Call the approve handler logic and verify InventoryMovement rows
//   6. Print before/after Inventory.quantity for sanity
//   7. Clean up the test rows so the script is idempotent

require("dotenv").config();
const fs = require("fs");
const path = require("path");

// Stub Gmail before requiring the cron module.
const gmail = require("../services/gmail.service");
const FIXTURE = fs.readFileSync(
  path.join(__dirname, "../services/supplier-parsers/__fixtures__/ion-peptide-sample-1.html"),
  "utf8",
);
const CANNED_MESSAGE_ID = `e2e-${Date.now()}`;
gmail.isConfigured = () => true;
gmail.getOrCreateProcessedLabel = async () => "Label_E2E";
gmail.listUnreadFromSender = async () => [
  { id: CANNED_MESSAGE_ID, threadId: "thread-e2e" },
];
gmail.getMessage = async () => ({
  id: CANNED_MESSAGE_ID,
  threadId: "thread-e2e",
  subject: "Fwd: Your ION Peptide order has shipped",
  from: "orders@ionpeptide-test.local",
  receivedAt: new Date(),
  html: FIXTURE,
});
gmail.markProcessed = async () => undefined;

const prisma = require("../prisma/client");
const { run: runCron } = require("../cron/supplierEmailPoll");
const { applyBulkMovement } = require("../services/inventory.service");

const TEST_SENDER = `orders+e2e-${Date.now()}@ionpeptide-test.local`;

async function findOrCreateTestSupplier() {
  const location = await prisma.location.findFirst({ where: { isActive: true } });
  if (!location) throw new Error("No active Location in DB. Seed one first.");

  const source = await prisma.supplierEmailSource.create({
    data: {
      name: "ION Peptide (e2e test)",
      senderEmail: TEST_SENDER.toLowerCase(),
      parserKey: "ion_peptide_v1",
      defaultLocationId: location.id,
      active: true,
    },
  });
  return { source, location };
}

async function seedOneMapping(source) {
  // Pick a real variant and map a supplier name to it so we can verify AUTO_MATCH.
  const variant = await prisma.productVariant.findFirst({ where: { isActive: true } });
  if (!variant) throw new Error("No active ProductVariant in DB.");
  const mapping = await prisma.supplierProductMapping.create({
    data: {
      supplierSourceId: source.id,
      supplierProductName: "BW - 10ml",
      variantId: variant.id,
      quantityMultiplier: 1,
    },
  });
  return { mapping, variant };
}

async function snapshotInventory(variantId, locationId) {
  return prisma.inventory.findFirst({ where: { variantId, locationId } });
}

async function main() {
  console.log(`Starting e2e — test sender=${TEST_SENDER}`);
  const { source, location } = await findOrCreateTestSupplier();
  const { variant: mappedVariant } = await seedOneMapping(source);

  console.log(`Location:  ${location.name} (${location.id})`);
  console.log(`Supplier:  ${source.name} (${source.id})`);
  console.log(`AutoMatch: "BW - 10ml" -> variant ${mappedVariant.sku} (${mappedVariant.id})`);

  // Snapshot inventory before
  const before = await snapshotInventory(mappedVariant.id, location.id);
  console.log(`Inventory BEFORE for ${mappedVariant.sku}: qty=${before ? before.quantity : "(no row)"}`);

  // Step 1: run the cron — it will use our stubbed gmail.
  const cronResult = await runCron();
  console.log("Cron result:", cronResult);

  // Step 2: fetch the created receipt
  const receipt = await prisma.pendingStockReceipt.findUnique({
    where: { gmailMessageId: CANNED_MESSAGE_ID },
    include: { lines: true },
  });
  if (!receipt) throw new Error("Receipt was not created by cron");
  console.log(
    `Receipt created: id=${receipt.id} orderNumber=${receipt.orderNumber} ` +
      `lines=${receipt.lines.length} status=${receipt.status}`,
  );

  const byStatus = receipt.lines.reduce((acc, l) => {
    acc[l.matchStatus] = (acc[l.matchStatus] || 0) + 1;
    return acc;
  }, {});
  console.log("Line statuses:", byStatus);

  // Verify auto-match worked
  const autoLine = receipt.lines.find((l) => l.matchStatus === "AUTO_MATCHED");
  if (!autoLine) throw new Error("Expected at least one AUTO_MATCHED line (BW - 10ml)");
  console.log(`AUTO_MATCHED line: "${autoLine.supplierProductName}" qty=${autoLine.effectiveQuantity}`);

  // Step 3: manually map one UNMATCHED line to another variant (simulating admin action)
  const unmatched = receipt.lines.filter((l) => l.matchStatus === "UNMATCHED");
  const otherVariant = await prisma.productVariant.findFirst({
    where: { isActive: true, id: { not: mappedVariant.id } },
  });
  if (!otherVariant) throw new Error("Need at least 2 variants in DB");
  if (unmatched.length === 0) throw new Error("Expected unmatched lines for manual map test");

  const lineToManualMap = unmatched[0];
  await prisma.pendingStockReceiptLine.update({
    where: { id: lineToManualMap.id },
    data: {
      matchedVariantId: otherVariant.id,
      effectiveQuantity: lineToManualMap.parsedQuantity,
      matchStatus: "MANUAL_MATCHED",
    },
  });
  console.log(
    `MANUAL_MATCHED line: "${lineToManualMap.supplierProductName}" -> ${otherVariant.sku} qty=${lineToManualMap.parsedQuantity}`,
  );

  // Step 4: approve — apply the matched lines (auto + manual = 2 movements)
  const fresh = await prisma.pendingStockReceipt.findUnique({
    where: { id: receipt.id },
    include: { lines: true, source: true },
  });
  const matchedLines = fresh.lines.filter(
    (l) =>
      (l.matchStatus === "AUTO_MATCHED" || l.matchStatus === "MANUAL_MATCHED") &&
      l.matchedVariantId &&
      l.effectiveQuantity,
  );
  const items = matchedLines.map((l) => ({
    variantId: l.matchedVariantId,
    locationId: fresh.source.defaultLocationId,
    quantity: l.effectiveQuantity,
  }));
  console.log(`Approving ${matchedLines.length} matched lines:`);
  matchedLines.forEach((l) => console.log(`  • ${l.supplierProductName} x ${l.effectiveQuantity}`));

  const results = await applyBulkMovement(
    items,
    "PURCHASE",
    `Supplier receipt #${fresh.orderNumber} via email (${fresh.source.name})`,
    null,
  );
  console.log(`Bulk movement created ${results.length} InventoryMovement rows`);
  results.forEach((r) => console.log(`  movement ${r.movement.id} qty=${r.movement.quantity} type=${r.movement.type}`));

  // Persist movement IDs + receipt status
  const unmatchedRemaining = fresh.lines.some((l) => l.matchStatus === "UNMATCHED");
  await prisma.$transaction([
    ...matchedLines.map((line, idx) =>
      prisma.pendingStockReceiptLine.update({
        where: { id: line.id },
        data: { appliedMovementId: results[idx].movement.id },
      }),
    ),
    prisma.pendingStockReceipt.update({
      where: { id: receipt.id },
      data: { status: unmatchedRemaining ? "PARTIAL" : "APPROVED", processedAt: new Date() },
    }),
  ]);

  const after = await snapshotInventory(mappedVariant.id, location.id);
  console.log(`Inventory AFTER for ${mappedVariant.sku}: qty=${after.quantity} (was ${before ? before.quantity : 0})`);
  const expectedDelta = autoLine.effectiveQuantity;
  const actualDelta = after.quantity - (before ? before.quantity : 0);
  if (actualDelta !== expectedDelta) {
    throw new Error(`Inventory delta mismatch: expected +${expectedDelta}, got ${actualDelta}`);
  }
  console.log(`✓ Inventory delta matches: +${actualDelta}`);

  const finalReceipt = await prisma.pendingStockReceipt.findUnique({ where: { id: receipt.id } });
  console.log(`Final receipt status: ${finalReceipt.status}`);

  // Idempotency: rerun cron — should not create another receipt
  const cronResult2 = await runCron();
  console.log("Second cron run (idempotency check):", cronResult2);
  const count = await prisma.pendingStockReceipt.count({
    where: { gmailMessageId: CANNED_MESSAGE_ID },
  });
  if (count !== 1) throw new Error(`Expected exactly 1 receipt after re-run, got ${count}`);
  console.log("✓ Idempotency holds (still 1 receipt)");

  // Cleanup: reverse inventory effect + delete test rows
  console.log("\nCleaning up test data…");
  // Reverse the inventory: apply SALE for the same items
  await applyBulkMovement(items, "SALE", "e2e cleanup reverse", null);
  await prisma.pendingStockReceiptLine.deleteMany({ where: { receiptId: receipt.id } });
  await prisma.pendingStockReceipt.delete({ where: { id: receipt.id } });
  await prisma.supplierProductMapping.deleteMany({ where: { supplierSourceId: source.id } });
  await prisma.supplierEmailSource.delete({ where: { id: source.id } });
  console.log("✓ Cleanup done");
}

main()
  .then(() => {
    console.log("\nALL CHECKS PASSED ✅");
    return prisma.$disconnect().then(() => process.exit(0));
  })
  .catch(async (err) => {
    console.error("FAILED:", err);
    await prisma.$disconnect().catch(() => undefined);
    process.exit(1);
  });
