#!/usr/bin/env node
// One-off script: seeds the Ion Peptide Order #141139 as a PendingStockReceipt
// in production so it can be reviewed and approved via /inventory/receipts.

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

const ORDER_LINES = [
  { supplierProductName: "BW - 10ml",              parsedQuantity: 60 },
  { supplierProductName: "BW - 3ml",               parsedQuantity: 40 },
  { supplierProductName: "BPC157+TB500 - 10/10mg", parsedQuantity: 30 },
  { supplierProductName: "BPC157+TB500 - 5/5mg",   parsedQuantity: 30 },
  { supplierProductName: "CJC-1295+Ipamo - 5/5mg (No DAC)", parsedQuantity: 30 },
  { supplierProductName: "GHK-Cu - 100mg",         parsedQuantity: 30 },
  { supplierProductName: "GHK-Cu - 50mg",          parsedQuantity: 30 },
  { supplierProductName: "GLOW - 70mg",            parsedQuantity: 30 },
  { supplierProductName: "Glutathione - 1500mg",   parsedQuantity: 40 },
  { supplierProductName: "Glutathione - 600mg",    parsedQuantity: 20 },
  { supplierProductName: "BW-H Brand",             parsedQuantity: 40 },
  { supplierProductName: "KLOW - 80mg",            parsedQuantity: 50 },
];

async function main() {
  // 1. Ensure a Location exists
  let location = await prisma.location.findFirst({ where: { isActive: true } });
  if (!location) {
    console.log("No active location found — creating default warehouse location...");
    location = await prisma.location.create({
      data: { name: "Main Warehouse", isActive: true, country: "US" },
    });
    console.log(`  Created location: ${location.id} (${location.name})`);
  } else {
    console.log(`Using location: ${location.id} (${location.name})`);
  }

  // 2. Ensure SupplierEmailSource for Ion Peptide exists
  let source = await prisma.supplierEmailSource.findFirst({
    where: { senderEmail: "no-reply@ionpeptide.com" },
  });
  if (!source) {
    source = await prisma.supplierEmailSource.create({
      data: {
        name: "Ion Peptide",
        senderEmail: "no-reply@ionpeptide.com",
        parserKey: "ion_peptide_v1",
        defaultLocationId: location.id,
        active: true,
      },
    });
    console.log(`Created supplier source: ${source.id}`);
  } else {
    console.log(`Using existing supplier source: ${source.id} (${source.name})`);
  }

  // 3. Guard: don't duplicate if already seeded
  const existing = await prisma.pendingStockReceipt.findUnique({
    where: { gmailMessageId: "manual-seed-order-141139" },
  });
  if (existing) {
    console.log(`Receipt for Order #141139 already exists (id=${existing.id}, status=${existing.status}). Nothing to do.`);
    return;
  }

  // 4. Create PendingStockReceipt + lines
  const receipt = await prisma.pendingStockReceipt.create({
    data: {
      supplierSourceId: source.id,
      gmailMessageId: "manual-seed-order-141139",
      gmailThreadId: null,
      orderNumber: "141139",
      rawSubject: "Fwd: Your ION Peptide order has shipped",
      rawHtml: "<p>Manually seeded from fixture — Ion Peptide Order #141139</p>",
      receivedAt: new Date("2026-05-16T00:00:00Z"),
      status: "PENDING",
      lines: {
        create: ORDER_LINES.map((l) => ({
          supplierProductName: l.supplierProductName,
          parsedQuantity: l.parsedQuantity,
          matchStatus: "UNMATCHED",
        })),
      },
    },
    include: { lines: true },
  });

  console.log(`\n✅ Created PendingStockReceipt id=${receipt.id} orderNumber=${receipt.orderNumber}`);
  console.log(`   Lines (${receipt.lines.length}):`);
  receipt.lines.forEach((l) =>
    console.log(`     • ${l.supplierProductName} ×${l.parsedQuantity} [${l.matchStatus}]`)
  );
  console.log(`\nReview & approve at: https://www.ascendrabio.com/inventory/receipts`);
}

main()
  .then(() => prisma.$disconnect().then(() => process.exit(0)))
  .catch(async (err) => {
    console.error("FAILED:", err.message);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
