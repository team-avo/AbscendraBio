import React from "react";
import type { Metadata } from "next";
import { api } from "@/lib/api";
import { buildMetadataForProduct, buildProductJsonLd, getSiteConfig, absoluteUrl, serializeJsonLd } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!id) return {};
  const resp = await api.getStorefrontProduct(id);
  if (!resp.success || !resp.data) return {};
  const cfg = await getSiteConfig();
  const slug = (resp.data as any).seoSlug || id;
  const path = `/landing/products/${slug}`;
  return buildMetadataForProduct(resp.data, path);
}

async function JsonLd({ id }: { id: string }) {
  const resp = await api.getStorefrontProduct(id);
  if (!resp.success || !resp.data) return null;
  const cfg = await getSiteConfig();
  const slug = (resp.data as any).seoSlug || id;
  const url = absoluteUrl(cfg.baseUrl, `/landing/products/${slug}`);
  const jsonLd = buildProductJsonLd(resp.data, url);
  return (
    <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
  );
}

export default async function LandingProductDetailLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="force-light min-h-screen bg-white text-black" suppressHydrationWarning>
      {/* JSON-LD for Product */}
      <JsonLd id={id} />
      {children}
    </div>
  );
}

