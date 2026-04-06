import type { MetadataRoute } from "next";
import { getSiteConfig, absoluteUrl } from "@/lib/seo";
import { api } from "@/lib/api";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cfg = await getSiteConfig();

  // Static top-level pages
  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl(cfg.baseUrl, "/"), lastModified: new Date() },
    { url: absoluteUrl(cfg.baseUrl, "/collections"), lastModified: new Date() },
  ];

  // Dynamic Content Pages (published only)
  try {
    const resp = await api.getContentPages({ page: 1, limit: 500, status: "PUBLISHED" as any });
    if (resp.success && resp.data) {
      for (const p of resp.data.pages || []) {
        const path = `/p/${String(p.slug || "").replace(/^\//, "")}`;
        entries.push({ url: absoluteUrl(cfg.baseUrl, path), lastModified: new Date(p.updatedAt || p.createdAt || Date.now()) });
      }
    }
  } catch {}

  // Public products list to sitemap (basic coverage)
  try {
    const resp = await api.getStorefrontProducts({ page: 1, limit: 200 });
    if (resp.success && resp.data) {
      for (const prod of resp.data.products || []) {
        const slug = (prod as any).seoSlug || prod.id;
        const path = `/landing/products/${slug}`;
        entries.push({ url: absoluteUrl(cfg.baseUrl, path), lastModified: new Date(prod.updatedAt || prod.createdAt) });
      }
    }
  } catch {}

  return entries;
}


