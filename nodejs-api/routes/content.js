const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");

// GET /api/content/pages - list pages with filters and pagination
router.get("/pages", async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "10", 10);
    const skip = (page - 1) * limit;
    const search = (req.query.search || "").trim();
    const status = req.query.status;
    const type = req.query.type;

    const where = {};
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
        { excerpt: { contains: search, mode: "insensitive" } },
      ];
    }
    if (status) where.status = status;
    if (type) where.pageType = type;

    const [items, total] = await Promise.all([
      prisma.pageContent.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
        include: {
          author: true,
          _count: { select: { views: true } },
        },
      }),
      prisma.pageContent.count({ where }),
    ]);

    const result = items.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      status: p.status,
      pageType: p.pageType,
      views: p._count?.views || 0,
      author: p.author ? { id: p.author.id, firstName: p.author.firstName, lastName: p.author.lastName } : null,
      updatedAt: p.updatedAt,
      createdAt: p.createdAt,
      publishedAt: p.publishedAt,
    }));

    res.json({
      success: true,
      data: {
        pages: result,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// Content stats: pages, published, views, media counts/sizes
router.get("/stats", async (req, res, next) => {
  try {
    const [totalPages, publishedPages, totalViews, mediaCount, mediaSize] = await Promise.all([
      prisma.pageContent.count(),
      prisma.pageContent.count({ where: { status: "PUBLISHED" } }),
      prisma.pageView.count(),
      prisma.mediaFile.count(),
      prisma.mediaFile.aggregate({ _sum: { size: true } }),
    ]);

    res.json({
      success: true,
      data: {
        totalPages,
        publishedPages,
        totalViews,
        mediaCount,
        mediaTotalBytes: mediaSize?._sum?.size || 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------
// Content Analytics (page views)
// -----------------------------
// GET /api/content/analytics/pages?rangeDays=30&type=ALL|BLOG_POST|STATIC_PAGE
router.get("/analytics/pages", async (req, res, next) => {
  try {
    const rangeDays = Math.max(1, parseInt(req.query.rangeDays || "30", 10));
    const type = String(req.query.type || "ALL");
    const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

    // Fetch views in range with page details
    const views = await prisma.pageView.findMany({
      where: {
        viewedAt: { gte: since },
        ...(type && type !== "ALL" ? { page: { pageType: type } } : {}),
      },
      select: {
        pageId: true,
        viewedAt: true,
        page: { select: { id: true, title: true, slug: true, pageType: true } },
      },
      orderBy: { viewedAt: "asc" },
    });

    // Build daily buckets
    const fmt = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);
    const daily = new Map();
    const topMap = new Map();
    for (const v of views) {
      const day = fmt(v.viewedAt);
      daily.set(day, (daily.get(day) || 0) + 1);
      const key = v.pageId;
      const existing = topMap.get(key) || { count: 0, page: v.page };
      existing.count += 1;
      topMap.set(key, existing);
    }

    // Ensure all days present
    const series = [];
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const day = fmt(d);
      series.push({ day, views: daily.get(day) || 0 });
    }

    const topPages = Array.from(topMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((t) => ({
        id: t.page?.id,
        title: t.page?.title,
        slug: t.page?.slug,
        pageType: t.page?.pageType,
        views: t.count,
      }));

    res.json({ success: true, data: { series, topPages } });
  } catch (err) {
    next(err);
  }
});

// Admin: Footer settings CRUD (simple get/update)
router.get("/footer", async (req, res, next) => {
  try {
    const settings = await prisma.footerSettings.findFirst({
      include: { sections: { include: { links: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } }, FooterContact: true },
      orderBy: { updatedAt: "desc" },
    });
    res.json({ success: true, data: settings || null });
  } catch (err) { next(err); }
});

router.put("/footer", async (req, res, next) => {
  try {
    const payload = req.body || {};
    const existing = await prisma.footerSettings.findFirst();
    const up = await prisma.$transaction(async (tx) => {
      let settings;
      if (existing) {
        settings = await tx.footerSettings.update({
          where: { id: existing.id },
          data: {
            siteTitle: payload.siteTitle,
            siteDescription: payload.siteDescription,
            facebookUrl: payload.facebookUrl,
            twitterUrl: payload.twitterUrl,
            instagramUrl: payload.instagramUrl,
            updatedAt: new Date(),
          },
        });
        const oldSections = await tx.footerSection.findMany({ where: { settingsId: settings.id } });
        await tx.footerLink.deleteMany({ where: { sectionId: { in: oldSections.map((s) => s.id) } } });
        await tx.footerSection.deleteMany({ where: { settingsId: settings.id } });
        await tx.footerContact.deleteMany({ where: { settingsId: settings.id } });
      } else {
        settings = await tx.footerSettings.create({
          data: {
            siteTitle: payload.siteTitle,
            siteDescription: payload.siteDescription,
            facebookUrl: payload.facebookUrl,
            twitterUrl: payload.twitterUrl,
            instagramUrl: payload.instagramUrl,
          }
        });
      }
      if (Array.isArray(payload.sections)) {
        for (const [idx, sec] of payload.sections.entries()) {
          const section = await tx.footerSection.create({ data: { settingsId: settings.id, title: sec.title, order: typeof sec.order === "number" ? sec.order : idx } });
          if (Array.isArray(sec.links)) {
            for (const [lidx, lnk] of sec.links.entries()) {
              await tx.footerLink.create({ data: { sectionId: section.id, title: lnk.title, href: lnk.href, target: lnk.target || "_self", order: typeof lnk.order === "number" ? lnk.order : lidx } });
            }
          }
        }
      }
      if (payload.contact) {
        await tx.footerContact.create({
          data: {
            settingsId: settings.id,
            title: payload.contact.title || 'Contact',
            email: payload.contact.email || null,
            phone: payload.contact.phone || null,
            address: payload.contact.address || null,
          }
        });
      }
      return settings.id;
    });
    const result = await prisma.footerSettings.findUnique({ where: { id: up }, include: { sections: { include: { links: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } }, FooterContact: true } });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// GET /api/content/analytics/pages/:id?rangeDays=30
router.get("/analytics/pages/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const rangeDays = Math.max(1, parseInt(req.query.rangeDays || "30", 10));
    const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);
    const views = await prisma.pageView.findMany({
      where: { pageId: id, viewedAt: { gte: since } },
      select: { viewedAt: true },
      orderBy: { viewedAt: "asc" },
    });
    const fmt = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);
    const daily = new Map();
    for (const v of views) {
      const day = fmt(v.viewedAt);
      daily.set(day, (daily.get(day) || 0) + 1);
    }
    const series = [];
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const day = fmt(d);
      series.push({ day, views: daily.get(day) || 0 });
    }
    res.json({ success: true, data: { series } });
  } catch (err) {
    next(err);
  }
});

// GET /api/content/pages/:id - get a single page
router.get("/pages/:id", async (req, res, next) => {
  try {
    const page = await prisma.pageContent.findUnique({
      where: { id: req.params.id },
      include: {
        author: true,
        versions: { orderBy: { version: "desc" }, take: 10 },
        tags: true,
      },
    });
    if (!page) return res.status(404).json({ success: false, error: "Page not found" });
    res.json({ success: true, data: page });
  } catch (err) {
    next(err);
  }
});

// POST /api/content/pages - create page
router.post("/pages", async (req, res, next) => {
  try {
    const {
      title,
      slug,
      excerpt,
      content,
      contentFormat = "RICH_TEXT",
      metaTitle,
      metaDescription,
      metaKeywords,
      ogImage,
      pageType = "STATIC_PAGE",
      status = "DRAFT",
      isPublic = true,
      allowComments = false,
      authorId,
      tagIds,
      publishedAt,
    } = req.body || {};

    if (!title || !slug || !content || !authorId) {
      return res.status(400).json({ success: false, error: "title, slug, content, authorId are required" });
    }

    const created = await prisma.pageContent.create({
      data: {
        title,
        slug,
        excerpt,
        content,
        contentFormat,
        metaTitle,
        metaDescription,
        metaKeywords,
        ogImage,
        pageType,
        status,
        isPublic,
        allowComments,
        authorId,
        publishedAt,
        tags: tagIds && Array.isArray(tagIds) ? { connect: tagIds.map((id) => ({ id })) } : undefined,
        versions: {
          create: {
            title,
            content,
            contentFormat,
            version: 1,
            isCurrent: true,
            createdBy: authorId,
          },
        },
      },
      include: { author: true },
    });

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ success: false, error: "Slug already exists" });
    }
    next(err);
  }
});

// PUT /api/content/pages/:id - update page, creates new content version when content/title changes
router.put("/pages/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const existing = await prisma.pageContent.findUnique({ where: { id }, include: { versions: true } });
    if (!existing) return res.status(404).json({ success: false, error: "Page not found" });

    const {
      title,
      slug,
      excerpt,
      content,
      contentFormat,
      metaTitle,
      metaDescription,
      metaKeywords,
      ogImage,
      pageType,
      status,
      isPublic,
      allowComments,
      authorId,
      tagIds,
      publishedAt,
    } = req.body || {};

    // Determine if we need a new version
    const contentChanged = typeof content === "string" && content !== existing.content;
    const titleChanged = typeof title === "string" && title !== existing.title;

    const updated = await prisma.$transaction(async (tx) => {
      const updatedPage = await tx.pageContent.update({
        where: { id },
        data: {
          title,
          slug,
          excerpt,
          content,
          contentFormat,
          metaTitle,
          metaDescription,
          metaKeywords,
          ogImage,
          pageType,
          status,
          isPublic,
          allowComments,
          authorId,
          publishedAt,
          ...(Array.isArray(tagIds)
            ? {
              tags: {
                set: [],
                connect: tagIds.map((tid) => ({ id: tid })),
              },
            }
            : {}),
        },
        include: { versions: true },
      });

      if (contentChanged || titleChanged) {
        const nextVersion = (updatedPage.versions?.reduce((max, v) => Math.max(max, v.version), 0) || 0) + 1;
        if (updatedPage.versions?.length) {
          await tx.contentVersion.updateMany({ where: { pageId: id, isCurrent: true }, data: { isCurrent: false } });
        }
        await tx.contentVersion.create({
          data: {
            pageId: id,
            title: title ?? existing.title,
            content: content ?? existing.content,
            contentFormat: contentFormat ?? existing.contentFormat,
            version: nextVersion,
            isCurrent: true,
            createdBy: authorId ?? existing.authorId,
          },
        });
      }

      return updatedPage;
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ success: false, error: "Slug already exists" });
    }
    next(err);
  }
});

// GET /api/content/preview/:slug - preview any page by slug (requires auth), regardless of status/isPublic
router.get("/preview/:slug", async (req, res, next) => {
  try {
    const slug = (req.params.slug || "").trim().replace(/^\//, "");
    if (!slug) return res.status(400).json({ success: false, error: "slug is required" });

    const page = await prisma.pageContent.findFirst({
      where: { slug },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        content: true,
        contentFormat: true,
        metaTitle: true,
        metaDescription: true,
        metaKeywords: true,
        ogImage: true,
        pageType: true,
        status: true,
        isPublic: true,
        publishedAt: true,
        updatedAt: true,
      },
    });

    if (!page) return res.status(404).json({ success: false, error: "Page not found" });

    res.json({ success: true, data: page });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/content/pages/:id - delete a page
router.delete("/pages/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    await prisma.pageContent.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ success: false, error: "Page not found" });
    }
    next(err);
  }
});

module.exports = router;

// -----------------------------
// Navigation Menus CRUD
// -----------------------------
router.get("/menus", async (req, res, next) => {
  try {
    const menus = await prisma.navigationMenu.findMany({
      orderBy: { name: "asc" },
      include: { items: { orderBy: { order: "asc" } } },
    });
    res.json({ success: true, data: { menus } });
  } catch (err) { next(err); }
});

router.post("/menus", async (req, res, next) => {
  try {
    const { name, location, isActive = true } = req.body || {};
    if (!name || !location) return res.status(400).json({ success: false, error: "name and location are required" });
    const menu = await prisma.navigationMenu.create({ data: { name, location, isActive } });
    res.status(201).json({ success: true, data: menu });
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ success: false, error: "Menu name or location already exists" });
    next(err);
  }
});

router.put("/menus/:id", async (req, res, next) => {
  try {
    const { name, location, isActive } = req.body || {};
    const menu = await prisma.navigationMenu.update({ where: { id: req.params.id }, data: { name, location, isActive } });
    res.json({ success: true, data: menu });
  } catch (err) { next(err); }
});

router.delete("/menus/:id", async (req, res, next) => {
  try {
    await prisma.navigationMenu.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Menu Items
router.get("/menus/:id/items", async (req, res, next) => {
  try {
    const items = await prisma.navigationItem.findMany({ where: { menuId: req.params.id }, orderBy: { order: "asc" } });
    res.json({ success: true, data: { items } });
  } catch (err) { next(err); }
});

router.post("/menus/:id/items", async (req, res, next) => {
  try {
    const menuId = req.params.id;
    const { title, url, pageId, target = "_self", order = 0, isActive = true, parentId } = req.body || {};
    if (!title) return res.status(400).json({ success: false, error: "title is required" });
    const item = await prisma.navigationItem.create({
      data: { menuId, title, url, pageId, target, order, isActive, parentId },
    });
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

router.put("/menus/:menuId/items/:itemId", async (req, res, next) => {
  try {
    const { title, url, pageId, target, order, isActive, parentId } = req.body || {};
    const item = await prisma.navigationItem.update({
      where: { id: req.params.itemId },
      data: { title, url, pageId, target, order, isActive, parentId },
    });
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

router.delete("/menus/:menuId/items/:itemId", async (req, res, next) => {
  try {
    await prisma.navigationItem.delete({ where: { id: req.params.itemId } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.patch("/menus/:menuId/items/reorder", async (req, res, next) => {
  try {
    const { orders } = req.body || {};
    if (!Array.isArray(orders)) return res.status(400).json({ success: false, error: "orders array is required" });
    await prisma.$transaction(
      orders.map((o) => prisma.navigationItem.update({ where: { id: o.id }, data: { order: o.order } }))
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// -----------------------------
// Media listing and CRUD
// -----------------------------
router.get("/media", async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "24", 10);
    const skip = (page - 1) * limit;
    const [files, total] = await Promise.all([
      prisma.mediaFile.findMany({ orderBy: { createdAt: "desc" }, skip, take: limit }),
      prisma.mediaFile.count(),
    ]);
    res.json({ success: true, data: { files, pagination: { page, limit, total, pages: Math.ceil(total / limit) } } });
  } catch (err) { next(err); }
});

router.post("/media", async (req, res, next) => {
  try {
    const { filename, originalName, mimeType, size, url, altText, caption, isPublic = true, uploadedBy } = req.body || {};
    if (!filename || !originalName || !mimeType || !size || !url || !uploadedBy) {
      return res.status(400).json({ success: false, error: "filename, originalName, mimeType, size, url, uploadedBy are required" });
    }
    const created = await prisma.mediaFile.create({
      data: { filename, originalName, mimeType, size: Number(size), url, altText, caption, isPublic, uploadedBy },
    });
    res.status(201).json({ success: true, data: created });
  } catch (err) { next(err); }
});

router.delete("/media/:id", async (req, res, next) => {
  try {
    await prisma.mediaFile.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.put("/media/:id", async (req, res, next) => {
  try {
    const { altText, caption, isPublic } = req.body || {};
    const updated = await prisma.mediaFile.update({
      where: { id: req.params.id },
      data: { altText, caption, isPublic },
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});


