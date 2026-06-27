/**
 * Seeds wholesale pricing rows for the public /pricing page.
 * Idempotent (upsert by name+strength). Source: prisma/seed-data/wholesale-pricing.json,
 * extracted from the pricing page Peter provided.
 *
 *   node prisma/seed-wholesale-pricing.js
 */
const fs = require("fs");
const path = require("path");
const prisma = require("./client");

async function main() {
  // Only seed when empty, so admin edits in production are never overwritten on
  // a later deploy. Run a manual reseed if you intentionally want to reset.
  const existing = await prisma.wholesalePrice.count();
  if (existing > 0) {
    console.log(`Wholesale pricing already has ${existing} rows; skipping seed.`);
    return;
  }
  const rows = JSON.parse(
    fs.readFileSync(path.join(__dirname, "seed-data", "wholesale-pricing.json"), "utf8"),
  );
  let order = 0;
  for (const r of rows) {
    await prisma.wholesalePrice.upsert({
      where: { name_strength: { name: r.name, strength: r.strength } },
      update: {
        category: r.category,
        reg: r.reg,
        m2: r.m2,
        m5: r.m5,
        m10: r.m10,
        displayOrder: order,
        isActive: true,
      },
      create: {
        name: r.name,
        strength: r.strength,
        category: r.category,
        reg: r.reg,
        m2: r.m2,
        m5: r.m5,
        m10: r.m10,
        displayOrder: order,
      },
    });
    order += 1;
  }
  const count = await prisma.wholesalePrice.count();
  console.log(`Wholesale pricing seed complete: ${count} rows`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
