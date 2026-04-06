import type { Metadata } from "next";
import { api, type Product, resolveImageUrl } from "@/lib/api";

type SiteConfig = {
  siteName: string;
  baseUrl: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultOgImageUrl?: string;
  allowIndexing: boolean;
};

let cachedConfig: SiteConfig | null = null;
let cachedAt = 0;

async function fetchSiteConfig(): Promise<SiteConfig> {
  try {
    // If API URL is missing, skip network call
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;
    if (!apiUrl) throw new Error("API URL not configured");

    // Always swallow network failures and fall back to defaults
    const resp = await api.getSiteSeo().catch(() => ({ success: false } as any));
    const envBase = process.env.FRONTEND_URL || "http://localhost:3000";
    if (resp.success && resp.data) {
      const d = resp.data as any;
      return {
        siteName: d.siteName || "Centre Labs",
        baseUrl: envBase.replace(/\/$/, ""),
        defaultTitle: d.defaultTitle || "Centre Labs",
        defaultDescription: d.defaultDescription || "Providing science backed solutions for medical providers.",
        defaultOgImageUrl: d.defaultOgImageUrl || undefined,
        allowIndexing: d.allowIndexing !== false,
      };
    }
  } catch { }
  return {
    siteName: "Centre Labs",
    baseUrl: (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, ""),
    defaultTitle: "Centre Labs",
    defaultDescription: "Providing science backed solutions for medical providers.",
    defaultOgImageUrl: undefined,
    allowIndexing: true,
  };
}

export async function getSiteConfig(): Promise<SiteConfig> {
  const now = Date.now();
  if (cachedConfig && now - cachedAt < 5 * 60 * 1000) return cachedConfig;
  cachedConfig = await fetchSiteConfig();
  cachedAt = now;
  return cachedConfig;
}

export function absoluteUrl(baseUrl: string, path?: string): string {
  const p = path || "/";
  if (/^https?:\/\//i.test(p)) return p;
  return `${baseUrl}${p.startsWith("/") ? p : `/${p}`}`;
}

export function buildWebPageJsonLd(opts: {
  url: string;
  name: string;
  description?: string;
  images?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    url: opts.url,
    name: opts.name,
    description: opts.description || undefined,
    image: (opts.images || []).filter(Boolean),
  };
}

export function buildProductJsonLd(product: Product, url: string) {
  const images = (product.images || []).map((i) => resolveImageUrl(i.url)).filter(Boolean);
  const offers = (product.variants || []).map((v) => ({
    "@type": "Offer",
    priceCurrency: "USD",
    price: String(v.salePrice ?? v.regularPrice),
    availability: "https://schema.org/InStock",
    sku: v.sku,
    url,
  }));
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.seoTitle || product.name,
    description: product.seoDescription || product.description || "",
    image: images,
    url,
    offers: offers.length ? (offers.length === 1 ? offers[0] : offers) : undefined,
  };
}

export function buildArticleJsonLd(opts: {
  url: string;
  headline: string;
  description?: string;
  image?: string[];
  datePublished?: string;
  dateModified?: string;
  authorName?: string;
  publisherName?: string;
  publisherLogo?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": opts.url,
    },
    headline: opts.headline,
    description: opts.description,
    image: opts.image && opts.image.length ? opts.image : undefined,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified || opts.datePublished,
    author: opts.authorName ? { "@type": "Person", name: opts.authorName } : undefined,
    publisher: opts.publisherName
      ? {
        "@type": "Organization",
        name: opts.publisherName,
        logo: opts.publisherLogo
          ? { "@type": "ImageObject", url: opts.publisherLogo }
          : undefined,
      }
      : undefined,
  };
}

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data, null, 2).replace(/</g, '\\u003c');
}

export async function buildMetadataForWebPage(opts: {
  title?: string;
  description?: string;
  path?: string;
  images?: string[];
}): Promise<Metadata> {
  const cfg = await getSiteConfig();
  const title = opts.title || cfg.defaultTitle;
  const description = opts.description || cfg.defaultDescription;
  const url = absoluteUrl(cfg.baseUrl, opts.path || "/");
  const images = (opts.images && opts.images.length ? opts.images : [cfg.defaultOgImageUrl]).filter(Boolean) as string[];

  return {
    title,
    description,
    alternates: { canonical: url },
    icons: {
      icon: "/logo.png",
      shortcut: "/logo.png",
      apple: "/logo.png",
    },
    openGraph: {
      title,
      description,
      url,
      siteName: cfg.siteName,
      images,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images,
    },
    robots: cfg.allowIndexing ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export async function buildMetadataForProduct(product: Product, path: string): Promise<Metadata> {
  const cfg = await getSiteConfig();
  const title = product.seoTitle || product.name;
  const description = product.seoDescription || product.description || cfg.defaultDescription;
  const url = absoluteUrl(cfg.baseUrl, path);
  const images = ((product.images || []).map((i) => resolveImageUrl(i.url)) as string[]);
  const ogImages = images.length ? images : (cfg.defaultOgImageUrl ? [cfg.defaultOgImageUrl] : []);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: cfg.siteName,
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImages,
    },
    robots: cfg.allowIndexing ? { index: true, follow: true } : { index: false, follow: false },
  };
}
