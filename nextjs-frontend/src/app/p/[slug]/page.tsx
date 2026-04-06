import { api } from "@/lib/api";
import type { Metadata } from "next";
import { buildMetadataForWebPage, buildWebPageJsonLd, getSiteConfig, absoluteUrl, serializeJsonLd } from "@/lib/seo";
import LandingHeader from "@/components/landing/LandingHeader";
import { sanitizeHtml } from "@/lib/sanitize";

type PageData = {
  title: string;
  excerpt?: string | null;
  content: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  ogImage?: string | null;
  slug: string;
};

async function fetchPageData(slug: string, isPreview: boolean): Promise<PageData | null> {
  try {
    if (isPreview) {
      const resp = await api.getPreviewPageBySlug(slug);
      return resp.success && resp.data ? (resp.data as PageData) : null;
    }
    const resp = await api.getPublicPageBySlug(slug);
    return resp.success && resp.data ? (resp.data as PageData) : null;
  } catch {
    return null;
  }
}

export default async function PublicPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  const slug = (resolvedParams.slug || "").toString();
  const isPreview = String(resolvedSearch?.preview || "") === "1";

  // For preview, also support calling the public endpoint with ?preview=1 to avoid auth issues
  let page = await fetchPageData(slug, isPreview);
  if (!page && isPreview) {
    try {
      const resp = await api.getPublicPageBySlug(slug, { preview: true });
      if (resp.success && resp.data) page = resp.data as any;
    } catch { }
  }
  if (!page) {
    return (
      <>
        <LandingHeader />
        <div className="container mx-auto p-6">Not found</div>
      </>
    );
  }

  const title = page.metaTitle || page.title;
  const description = page.metaDescription || page.excerpt || "";

  return (
    <>
      <LandingHeader />
      <div className="container mx-auto p-6 prose max-w-none">
        <h1>{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
        <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.content) }} />
      </div>
    </>
  );
}


export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  const slug = (resolvedParams.slug || "").toString();
  const isPreview = String(resolvedSearch?.preview || "") === "1";
  const page = await fetchPageData(slug, isPreview);
  if (!page) return {};
  return buildMetadataForWebPage({
    title: page.metaTitle || page.title,
    description: page.metaDescription || page.excerpt || "",
    path: `/p/${slug}`,
    images: page.ogImage ? [page.ogImage] : undefined,
  });
}

async function JsonLd({ slug, isPreview }: { slug: string; isPreview: boolean }) {
  const page = await fetchPageData(slug, isPreview);
  if (!page) return null;
  const cfg = await getSiteConfig();
  const url = absoluteUrl(cfg.baseUrl, `/p/${slug}`);
  const jsonLd = buildWebPageJsonLd({ url, name: page.title, description: page.metaDescription || page.excerpt || undefined });
  return <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />;
}


