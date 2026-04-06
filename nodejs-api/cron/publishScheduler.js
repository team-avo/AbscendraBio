const prisma = require("../prisma/client");

async function publishDuePages() {
  const now = new Date();
  // Find DRAFT/SCHEDULED pages with publishedAt in the past
  const due = await prisma.pageContent.findMany({
    where: {
      status: { in: ["DRAFT", "SCHEDULED"] },
      publishedAt: { lte: now },
    },
    select: { id: true, slug: true, status: true },
  });
  if (!due.length) return { updated: 0 };

  await prisma.pageContent.updateMany({
    where: { id: { in: due.map((p) => p.id) } },
    data: { status: "PUBLISHED" },
  });

  return { updated: due.length };
}

async function ensureNavItemsForPublished() {
  // Create main/footer menu if missing
  const [main, footer] = await Promise.all([
    prisma.navigationMenu.upsert({
      where: { location: "main" },
      update: {},
      create: { name: "Main Navigation", location: "main", isActive: true },
    }),
    prisma.navigationMenu.upsert({
      where: { location: "footer" },
      update: {},
      create: { name: "Footer Navigation", location: "footer", isActive: true },
    }),
  ]);

  // Find published pages that have a flag to auto-appear in navigation
  // Using isPublic and status to drive auto inclusion if no nav item exists
  const pages = await prisma.pageContent.findMany({
    where: { status: "PUBLISHED", isPublic: true },
    select: { id: true, title: true, slug: true },
  });

  for (const p of pages) {
    const existsMain = await prisma.navigationItem.findFirst({ where: { menuId: main.id, pageId: p.id } });
    if (!existsMain) {
      await prisma.navigationItem.create({
        data: { menuId: main.id, title: p.title, pageId: p.id, target: "_self", order: 100, isActive: true },
      });
    }

    const existsFooter = await prisma.navigationItem.findFirst({ where: { menuId: footer.id, pageId: p.id } });
    if (!existsFooter) {
      await prisma.navigationItem.create({
        data: { menuId: footer.id, title: p.title, pageId: p.id, target: "_self", order: 100, isActive: true },
      });
    }
  }
}

async function run() {
  const { updated } = await publishDuePages();
  if (updated > 0) {
    await ensureNavItemsForPublished();
  }
  return { updated };
}

module.exports = { run };


