#!/usr/bin/env node
// Creates 21 products / 30 variants from Ion Peptide Order #141139,
// maps the receipt lines, adds inventory, and marks the receipt APPROVED.

require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

// ── Product definitions ────────────────────────────────────────────────────────
// regularPrice = supplier unit cost (admin should update retail markup later)
// supplierName  = exact string from the Ion Peptide email (for line mapping)
const PRODUCTS = [
  {
    name: "Bacteriostatic Water (BW)",
    description: "Sterile bacteriostatic water used as a reconstitution solution for peptide vials.",
    variants: [
      { name: "10ml Vial", sku: "BW-10ML",  regularPrice: 424.02, supplierName: "BW - 10ml",  qty: 60 },
      { name: "3ml Vial",  sku: "BW-3ML",   regularPrice: 7.00,   supplierName: "BW - 3ml",   qty: 40 },
    ],
  },
  {
    name: "BW-H (Branded)",
    description: "Ion Peptide branded bacteriostatic water reconstitution solution.",
    variants: [
      { name: "Standard Vial", sku: "BW-H-BRAND", regularPrice: 25.00, supplierName: "BW-H Brand", qty: 40 },
    ],
  },
  {
    name: "BPC-157 + TB-500 Blend",
    description: "Combination peptide blend of BPC-157 and Thymosin Beta-4 (TB-500) for recovery and regeneration.",
    variants: [
      { name: "10mg/10mg Vial", sku: "BPC157-TB500-10-10MG", regularPrice: 79.00,  supplierName: "BPC157+TB500 - 10/10mg", qty: 30 },
      { name: "5mg/5mg Vial",   sku: "BPC157-TB500-5-5MG",   regularPrice: 48.00,  supplierName: "BPC157+TB500 - 5/5mg",   qty: 30 },
    ],
  },
  {
    name: "CJC-1295 + Ipamorelin (No DAC)",
    description: "Growth hormone releasing peptide combination — CJC-1295 (No DAC) paired with Ipamorelin.",
    variants: [
      { name: "5mg/5mg Vial", sku: "CJC-IPAMO-NODAC-5-5MG", regularPrice: 59.00, supplierName: "CJC-1295+Ipamo - 5/5mg (No DAC)", qty: 30 },
    ],
  },
  {
    name: "GHK-Cu (Copper Peptide)",
    description: "GHK-Cu (Copper peptide) — a naturally occurring tripeptide with skin repair and anti-aging properties.",
    variants: [
      { name: "100mg Vial", sku: "GHK-CU-100MG", regularPrice: 45.00, supplierName: "GHK-Cu - 100mg", qty: 30 },
      { name: "50mg Vial",  sku: "GHK-CU-50MG",  regularPrice: 29.00, supplierName: "GHK-Cu - 50mg",  qty: 30 },
    ],
  },
  {
    name: "GLOW Blend",
    description: "Ion Peptide proprietary GLOW peptide blend formulated for skin and aesthetic support.",
    variants: [
      { name: "70mg Vial", sku: "GLOW-70MG", regularPrice: 89.00, supplierName: "GLOW - 70mg", qty: 30 },
    ],
  },
  {
    name: "Glutathione",
    description: "Glutathione — a powerful endogenous antioxidant peptide supporting cellular detoxification.",
    variants: [
      { name: "1500mg Vial", sku: "GLUTATHIONE-1500MG", regularPrice: 55.00, supplierName: "Glutathione - 1500mg", qty: 40 },
      { name: "600mg Vial",  sku: "GLUTATHIONE-600MG",  regularPrice: 29.00, supplierName: "Glutathione - 600mg",  qty: 20 },
    ],
  },
  {
    name: "KLOW Blend",
    description: "Ion Peptide proprietary KLOW peptide blend.",
    variants: [
      { name: "80mg Vial", sku: "KLOW-80MG", regularPrice: 109.00, supplierName: "KLOW - 80mg", qty: 50 },
    ],
  },
  {
    name: "KPV",
    description: "KPV (Lys-Pro-Val) — an anti-inflammatory tripeptide derived from alpha-MSH.",
    variants: [
      { name: "10mg Vial", sku: "KPV-10MG", regularPrice: 49.00, supplierName: "KPV - 10mg", qty: 20 },
    ],
  },
  {
    name: "Melanotan II (MLT II)",
    description: "Melanotan II — a synthetic analogue of alpha-MSH studied for its tanning and libido-related effects.",
    variants: [
      { name: "10mg Vial", sku: "MLTII-10MG", regularPrice: 35.00, supplierName: "MLT II - 10mg", qty: 20 },
    ],
  },
  {
    name: "NAD+",
    description: "Nicotinamide Adenine Dinucleotide (NAD+) — essential coenzyme involved in energy metabolism and cellular repair.",
    variants: [
      { name: "500mg Vial", sku: "NAD-500MG", regularPrice: 44.00, supplierName: "NAD+ - 500mg", qty: 60 },
    ],
  },
  {
    name: "PT-141 (Bremelanotide)",
    description: "PT-141 (Bremelanotide) — a melanocortin receptor agonist studied for sexual dysfunction.",
    variants: [
      { name: "10mg Vial", sku: "PT141-10MG", regularPrice: 37.00, supplierName: "PT-141 - 10mg", qty: 10 },
    ],
  },
  {
    name: "ION-3R",
    description: "Ion Peptide proprietary ION-3R peptide formulation.",
    variants: [
      { name: "10mg Vial", sku: "ION3R-10MG",  regularPrice: 58.50,  supplierName: "ION-3R - 10mg",  qty: 120 },
      { name: "20mg Vial", sku: "ION3R-20MG",  regularPrice: 99.95,  supplierName: "ION-3R - 20mg",  qty: 40 },
      { name: "50mg Vial", sku: "ION3R-50MG",  regularPrice: 189.00, supplierName: "ION-3R - 50mg",  qty: 20 },
      { name: "60mg Vial", sku: "ION3R-60MG",  regularPrice: 219.00, supplierName: "ION-3R - 60mg",  qty: 20 },
    ],
  },
  {
    name: "Selank",
    description: "Selank — a synthetic heptapeptide analogue of tuftsin with anxiolytic and nootropic properties.",
    variants: [
      { name: "10mg Vial", sku: "SELANK-10MG", regularPrice: 34.65, supplierName: "Selank - 10mg", qty: 30 },
    ],
  },
  {
    name: "Semax",
    description: "Semax — a synthetic peptide based on ACTH(4-7) studied for cognitive enhancement and neuroprotection.",
    variants: [
      { name: "10mg Vial", sku: "SEMAX-10MG", regularPrice: 32.90, supplierName: "Semax - 10mg", qty: 30 },
    ],
  },
  {
    name: "Semax + Selank Blend",
    description: "Combination blend of Semax and Selank peptides for cognitive and anxiolytic support.",
    variants: [
      { name: "10mg/10mg Vial", sku: "SEMAX-SELANK-10-10MG", regularPrice: 89.00, supplierName: "Semax/Selank - 10/10mg", qty: 20 },
    ],
  },
  {
    name: "TB-500 (Thymosin Beta-4)",
    description: "TB-500 (Thymosin Beta-4) — a naturally occurring peptide studied for tissue repair, wound healing, and recovery.",
    variants: [
      { name: "10mg Vial", sku: "TB500-10MG", regularPrice: 49.00, supplierName: "TB-500 - 10mg", qty: 30 },
    ],
  },
  {
    name: "Tesamorelin + Ipamorelin Blend",
    description: "Combination of Tesamorelin and Ipamorelin growth hormone secretagogues.",
    variants: [
      { name: "10mg/3mg Vial", sku: "TESA-IPAMO-10-3MG", regularPrice: 99.00, supplierName: "Tesa/Ipamo - 10/3mg", qty: 20 },
    ],
  },
  {
    name: "Tesamorelin (Tesa)",
    description: "Tesamorelin — a growth hormone releasing factor analogue studied for body composition and cognitive effects.",
    variants: [
      { name: "10mg Vial", sku: "TESA-10MG", regularPrice: 69.95, supplierName: "Tesa - 10mg", qty: 30 },
    ],
  },
  {
    name: "Thymosin Alpha-1",
    description: "Thymosin Alpha-1 — a naturally occurring thymic peptide studied for immune modulation.",
    variants: [
      { name: "10mg Vial", sku: "THYMOSIN-A1-10MG", regularPrice: 65.00, supplierName: "Thymosin Alpha-1 - 10mg", qty: 20 },
    ],
  },
  {
    name: "ION-2T",
    description: "Ion Peptide proprietary ION-2T peptide formulation.",
    variants: [
      { name: "10mg Vial", sku: "ION2T-10MG",  regularPrice: 49.00,  supplierName: "ION-2T - 10mg",  qty: 60 },
      { name: "40mg Vial", sku: "ION2T-40MG",  regularPrice: 129.00, supplierName: "ION-2T - 40mg",  qty: 20 },
      { name: "60mg Vial", sku: "ION2T-60MG",  regularPrice: 149.00, supplierName: "ION-2T - 60mg",  qty: 20 },
    ],
  },
];

async function main() {
  // ── Prereqs ──────────────────────────────────────────────────────────────────
  const location = await prisma.location.findFirst({ where: { isActive: true } });
  if (!location) throw new Error("No active location found");

  const source = await prisma.supplierEmailSource.findFirst({
    where: { senderEmail: "no-reply@ionpeptide.com" },
  });
  if (!source) throw new Error("Ion Peptide supplier source not found");

  const receipt = await prisma.pendingStockReceipt.findUnique({
    where: { gmailMessageId: "manual-seed-order-141139" },
    include: { lines: true },
  });
  if (!receipt) throw new Error("Receipt #141139 not found");

  console.log(`\nUsing location: ${location.name}`);
  console.log(`Using supplier source: ${source.name}`);
  console.log(`Receipt has ${receipt.lines.length} lines\n`);

  // Build a map of supplierName → receipt line for later matching
  const lineBySupplierName = new Map(receipt.lines.map(l => [l.supplierProductName, l]));

  let productsCreated = 0, variantsCreated = 0, linesMatched = 0;

  for (const pd of PRODUCTS) {
    // Check if product already exists
    const existing = await prisma.product.findFirst({ where: { name: pd.name } });
    let product;
    if (existing) {
      console.log(`  [SKIP] Product already exists: "${pd.name}"`);
      product = existing;
    } else {
      product = await prisma.product.create({
        data: {
          name: pd.name,
          description: pd.description,
          status: "ACTIVE",
          displayOrder: 100,
        },
      });
      productsCreated++;
      console.log(`  [CREATE] Product: "${pd.name}" (${product.id})`);
    }

    for (const vd of pd.variants) {
      // Check if variant SKU already exists
      const existingVariant = await prisma.productVariant.findUnique({ where: { sku: vd.sku } });
      let variant;
      if (existingVariant) {
        console.log(`    [SKIP] Variant already exists: ${vd.sku}`);
        variant = existingVariant;
      } else {
        variant = await prisma.productVariant.create({
          data: {
            productId: product.id,
            sku: vd.sku,
            name: vd.name,
            regularPrice: vd.regularPrice,
            isActive: true,
          },
        });
        variantsCreated++;
        console.log(`    [CREATE] Variant: ${vd.name} (${vd.sku}) @ $${vd.regularPrice}`);

        // Create inventory record at 0 (receipt approval will add qty)
        await prisma.inventory.create({
          data: { variantId: variant.id, locationId: location.id, quantity: 0, reservedQty: 0 },
        });
      }

      // Create supplier mapping (for future auto-matching)
      const mappingExists = await prisma.supplierProductMapping.findFirst({
        where: { supplierSourceId: source.id, supplierProductName: vd.supplierName },
      });
      if (!mappingExists) {
        await prisma.supplierProductMapping.create({
          data: { supplierSourceId: source.id, supplierProductName: vd.supplierName, variantId: variant.id },
        });
      }

      // Map the receipt line
      const line = lineBySupplierName.get(vd.supplierName);
      if (line && line.matchStatus !== "MANUAL_MATCHED" && line.matchStatus !== "AUTO_MATCHED") {
        await prisma.pendingStockReceiptLine.update({
          where: { id: line.id },
          data: {
            matchedVariantId: variant.id,
            effectiveQuantity: line.parsedQuantity,
            matchStatus: "MANUAL_MATCHED",
          },
        });
        linesMatched++;
        console.log(`    [MATCH] "${vd.supplierName}" → ${vd.sku} (×${line.parsedQuantity})`);
      } else if (line) {
        console.log(`    [SKIP] Line "${vd.supplierName}" already matched`);
      } else {
        console.log(`    [WARN] No receipt line found for "${vd.supplierName}"`);
      }
    }
  }

  console.log(`\n── Summary ────────────────────────────────────────────────────`);
  console.log(`   Products created : ${productsCreated}`);
  console.log(`   Variants created : ${variantsCreated}`);
  console.log(`   Lines matched    : ${linesMatched}`);

  // ── Approve the receipt ──────────────────────────────────────────────────────
  const updatedReceipt = await prisma.pendingStockReceipt.findUnique({
    where: { id: receipt.id },
    include: { lines: true },
  });
  const matchedLines = updatedReceipt.lines.filter(
    l => (l.matchStatus === "MANUAL_MATCHED" || l.matchStatus === "AUTO_MATCHED") && l.matchedVariantId && l.effectiveQuantity
  );

  console.log(`\n── Approving receipt (${matchedLines.length} matched lines) ──────────────────`);

  for (const line of matchedLines) {
    if (line.appliedMovementId) { console.log(`  [SKIP] ${line.supplierProductName} already applied`); continue; }

    // Add inventory
    const inv = await prisma.inventory.findFirst({ where: { variantId: line.matchedVariantId, locationId: location.id } });
    if (!inv) { console.log(`  [WARN] No inventory record for ${line.supplierProductName}`); continue; }

    await prisma.inventory.update({
      where: { id: inv.id },
      data: { quantity: { increment: line.effectiveQuantity } },
    });

    // Create movement record
    const movement = await prisma.inventoryMovement.create({
      data: {
        inventoryId: inv.id,
        type: "INBOUND",
        quantity: line.effectiveQuantity,
        reason: `Ion Peptide Order #141139 — ${line.supplierProductName}`,
      },
    });

    await prisma.pendingStockReceiptLine.update({
      where: { id: line.id },
      data: { appliedMovementId: movement.id },
    });

    console.log(`  [STOCK] +${line.effectiveQuantity} → ${line.supplierProductName}`);
  }

  // Mark receipt APPROVED
  await prisma.pendingStockReceipt.update({
    where: { id: receipt.id },
    data: { status: "APPROVED" },
  });

  console.log(`\n✅ Receipt #141139 APPROVED. All 30 variants now in stock on production.`);
}

main()
  .then(() => prisma.$disconnect().then(() => process.exit(0)))
  .catch(async err => { console.error("\nFAILED:", err.message); await prisma.$disconnect(); process.exit(1); });
