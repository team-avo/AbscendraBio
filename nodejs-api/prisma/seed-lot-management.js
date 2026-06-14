/**
 * Seeds the Lot Management registries from the Ascendra Bio COA Tracker workbook.
 * Idempotent (upsert by code/key). Data lives in prisma/seed-data/lot-management.json.
 *
 *   node prisma/seed-lot-management.js
 */
const fs = require("fs");
const path = require("path");
const prisma = require("./client");

async function main() {
  const data = JSON.parse(
    fs.readFileSync(path.join(__dirname, "seed-data", "lot-management.json"), "utf8"),
  );

  // Companies
  for (const c of data.companies) {
    await prisma.company.upsert({
      where: { code: c.code },
      update: { name: c.name },
      create: { name: c.name, code: c.code },
    });
  }

  // Pattern configs
  for (const p of data.patterns) {
    await prisma.patternConfig.upsert({
      where: { key: p.key },
      update: { pattern: p.pattern, notes: p.notes },
      create: { key: p.key, pattern: p.pattern, notes: p.notes },
    });
  }

  // Suppliers
  for (const s of data.suppliers) {
    await prisma.supplier.upsert({
      where: { code: s.code },
      update: { name: s.name, contactEmail: s.contactEmail, phone: s.phone, country: s.country, notes: s.notes },
      create: s,
    });
  }

  // Labs
  for (const l of data.labs) {
    await prisma.lab.upsert({
      where: { code: l.code },
      update: { name: l.name, methodsOffered: l.methodsOffered, contactEmail: l.contactEmail, phone: l.phone, turnaround: l.turnaround, notes: l.notes },
      create: l,
    });
  }

  // Testing services
  for (const sv of data.services) {
    await prisma.testingService.upsert({
      where: { code: sv.code },
      update: { name: sv.name, category: sv.category, description: sv.description, typicalLabs: sv.typicalLabs },
      create: sv,
    });
  }

  // Peptides + strengths
  for (const p of data.peptides) {
    const { strengths, ...fields } = p;
    const peptide = await prisma.peptide.upsert({
      where: { code: p.code },
      update: { ...fields },
      create: { ...fields },
    });
    // reconcile strengths (upsert by peptideId+code)
    let order = 0;
    for (const st of strengths) {
      await prisma.peptideStrength.upsert({
        where: { peptideId_code: { peptideId: peptide.id, code: st.code } },
        update: { label: st.label, displayOrder: order },
        create: { peptideId: peptide.id, label: st.label, code: st.code, displayOrder: order },
      });
      order += 1;
    }
  }

  const counts = {
    companies: await prisma.company.count(),
    peptides: await prisma.peptide.count(),
    strengths: await prisma.peptideStrength.count(),
    suppliers: await prisma.supplier.count(),
    labs: await prisma.lab.count(),
    services: await prisma.testingService.count(),
    patterns: await prisma.patternConfig.count(),
  };
  console.log("Lot Management seed complete:", JSON.stringify(counts));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
