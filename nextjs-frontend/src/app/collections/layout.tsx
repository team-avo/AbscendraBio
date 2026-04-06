import type { Metadata } from "next";
import { buildMetadataForWebPage, getSiteConfig, absoluteUrl, serializeJsonLd } from "@/lib/seo";
import { api } from "@/lib/api";

export async function generateMetadata(): Promise<Metadata> {
	return buildMetadataForWebPage({ title: "Collections", description: "Browse product collections" });
}

async function JsonLd() {
	try {
		const cfg = await getSiteConfig();
		const resp = await api.getStorefrontProducts({ page: 1, limit: 50 });
		const items = (resp.success && resp.data ? resp.data.products : []).map((p, i) => ({
			"@type": "ListItem",
			position: i + 1,
			url: absoluteUrl(cfg.baseUrl, `/landing/products/${(p as any).seoSlug || p.id}`),
			name: p.name,
		}));
		const jsonLd = {
			"@context": "https://schema.org",
			"@type": "ItemList",
			itemListElement: items,
		};
		return <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />;
	} catch {
		return null;
	}
}

export default async function CollectionsLayout({ children }: { children: React.ReactNode }) {
	return (
		<>
			<JsonLd />
			{children}
		</>
	);
}
