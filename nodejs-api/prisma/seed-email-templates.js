/* Seed the default transactional email templates (idempotent).
 *
 * The `email_templates` table shipped empty, which silently broke every DB-template email for both
 * storefronts (order confirmation, shipping, payment, welcome, password reset, verification). This
 * upserts the brand-neutral defaults from email-templates.data.js so those emails render again.
 *
 * SAFE TO RE-RUN: upsert keyed on the unique `type`. By default it does NOT clobber a template that
 * already exists AND has been hand-edited (e.g. via the admin UI) — pass FORCE_SEED_TEMPLATES=1 to
 * overwrite existing rows with the defaults. Fresh/empty rows are always created.
 *
 * Run:  node prisma/seed-email-templates.js
 *       FORCE_SEED_TEMPLATES=1 node prisma/seed-email-templates.js   # overwrite existing
 */

const prisma = require("./client");
const { TEMPLATES } = require("./email-templates.data");

const FORCE = process.env.FORCE_SEED_TEMPLATES === "1";

async function main() {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const t of TEMPLATES) {
    const existing = await prisma.emailTemplate.findUnique({ where: { type: t.type } });
    const fields = {
      name: t.name,
      subject: t.subject,
      htmlContent: t.htmlContent,
      textContent: t.textContent || null,
      contentType: "HTML_CONTENT",
      isActive: true,
    };

    if (!existing) {
      await prisma.emailTemplate.create({ data: { type: t.type, ...fields } });
      created++;
      console.log(`  created  ${t.type}`);
    } else if (FORCE) {
      await prisma.emailTemplate.update({ where: { type: t.type }, data: fields });
      updated++;
      console.log(`  updated  ${t.type} (forced)`);
    } else {
      skipped++;
      console.log(`  skipped  ${t.type} (already exists — set FORCE_SEED_TEMPLATES=1 to overwrite)`);
    }
  }

  console.log(`\nEmail templates seeded: ${created} created, ${updated} updated, ${skipped} skipped.`);
}

main()
  .catch((e) => {
    console.error("Email template seed failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
