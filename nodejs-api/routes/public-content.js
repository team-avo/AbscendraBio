const express = require("express");
const prisma = require("../prisma/client");
const { asyncHandler } = require("../middleware/errorHandler");

const router = express.Router();

// Public: get footer settings with sections and links
router.get(
  "/footer",
  asyncHandler(async (req, res) => {
    const settings = await prisma.footerSettings.findFirst({
      include: {
        sections: {
          include: { links: { orderBy: { order: "asc" } } },
          orderBy: { order: "asc" },
        },
        FooterContact: true,
      },
      orderBy: { updatedAt: "desc" },
    });
    res.json({ success: true, data: settings || null });
  })
);

// Note: avoid duplicate declarations and exports; keep a single router/prisma

// GET /api/public-pages/:slug - public fetch by slug (published and public only)
router.get("/:slug", async (req, res, next) => {
  try {
    const slug = (req.params.slug || "").trim().replace(/^\//, "");
    if (!slug) return res.status(400).json({ success: false, error: "slug is required" });

    const isPreview = String(req.query.preview || "") === "1";

    const where = isPreview
      ? { slug }
      : { slug, isPublic: true, status: "PUBLISHED" };

    const page = await prisma.pageContent.findFirst({
      where,
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
        publishedAt: true,
        updatedAt: true,
      },
    });

    if (!page) return res.status(404).json({ success: false, error: "Page not found" });

    // Best-effort page view tracking (avoid duplicates by IP within 24 hours)
    if (!isPreview) {
      (async () => {
        try {
          const rawHeader = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "";
          const headerStr = Array.isArray(rawHeader) ? rawHeader[0] : String(rawHeader);
          const ip = (headerStr || "").split(",")[0].trim() || req.ip || "";
          const userAgent = String(req.headers["user-agent"] || "");
          const referrer = String(req.headers["referer"] || req.headers["referrer"] || "");
          if (!ip) return; // skip if no IP

          const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const existing = await prisma.pageView.findFirst({
            where: { pageId: page.id, ipAddress: ip, viewedAt: { gte: since } },
            select: { id: true },
          });
          if (!existing) {
            await prisma.pageView.create({
              data: { pageId: page.id, ipAddress: ip, userAgent, referrer },
            });
          }
        } catch (e) {
          // do not block response on analytics errors
          console.error("[public-pages] view track error", e);
        }
      })();
    }

    res.json({ success: true, data: page });
  } catch (err) {
    next(err);
  }
});

// -----------------------------
// Public Navigation (no auth)
// -----------------------------

// GET /api/public-pages/navigation/menus?location=main|footer
router.get("/navigation/menus", async (req, res, next) => {
  try {
    const location = (req.query.location || "").toString().toLowerCase();
    const where = { isActive: true };
    if (location) Object.assign(where, { location });
    const menus = await prisma.navigationMenu.findMany({
      where,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        location: true,
        isActive: true,
      },
    });
    res.json({ success: true, data: { menus } });
  } catch (err) {
    next(err);
  }
});

// GET /api/public-pages/navigation/menus/:id/items
router.get("/navigation/menus/:id/items", async (req, res, next) => {
  try {
    const rawItems = await prisma.navigationItem.findMany({
      where: { menuId: req.params.id, isActive: true },
      orderBy: { order: "asc" },
      select: {
        id: true,
        title: true,
        url: true,
        pageId: true,
        target: true,
        order: true,
        isActive: true,
        parentId: true,
        page: { select: { slug: true, status: true, isPublic: true } },
      },
    });
    const items = rawItems.map((it) => {
      let href = "";
      // Prefer page relation if present
      if (it.page && it.page.slug) {
        href = `/p/${String(it.page.slug).replace(/^\//, "")}`;
      } else if (it.url) {
        const urlStr = String(it.url);
        if (/^https?:\/\//i.test(urlStr) || /^mailto:/i.test(urlStr) || /^tel:/i.test(urlStr)) {
          href = urlStr; // external or special
        } else if (urlStr.startsWith("/")) {
          // Internal pretty URL → route through public renderer
          href = `/p/${urlStr.replace(/^\//, "")}`;
        } else {
          href = `/${urlStr}`; // normalize
        }
      }
      // Normalize target
      let target = String(it.target || "_self").toLowerCase();
      if (target !== "_blank") target = "_self";
      // Auto-open external links in new tab if not explicitly set
      if (target === "_self" && (/^https?:\/\//i.test(href) || /^mailto:/i.test(href) || /^tel:/i.test(href))) {
        target = "_blank";
      }
      return { ...it, href, target };
    });
    res.json({ success: true, data: { items } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;


