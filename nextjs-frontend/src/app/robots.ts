import type { MetadataRoute } from "next";
import { getSiteConfig } from "@/lib/seo";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const cfg = await getSiteConfig();
  return {
    rules: cfg.allowIndexing
      ? [{ userAgent: "*" }]
      : [{ userAgent: "*", disallow: "/" }],
    sitemap: `${cfg.baseUrl}/sitemap.xml`,
    host: cfg.baseUrl,
  };
}


