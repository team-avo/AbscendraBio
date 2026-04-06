"use client";

import { motion } from "motion/react";
import { Star, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import ImageWithFallback from "./figma/ImageWithFallback";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { api, resolveImageUrl } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type TrendingItem = {
	id: string;
	name: string;
	category: string;
	rating: number;
	reviews: number;
	price: string;
	originalPrice?: string;
	trend: string;
	image: string;
	seoSlug?: string;
};

export function TrendingProducts() {
	const [currentIndex, setCurrentIndex] = useState(0);
	const [items, setItems] = useState<TrendingItem[]>([]);
	const { user } = useAuth();
	const router = useRouter();

	useEffect(() => {
		let active = true;
		(async () => {
			try {
				const resp = await api.getStorefrontProducts({ page: 1, limit: 12 });
				const list = Array.isArray((resp as any)?.data)
					? ((resp as any).data as any[])
					: (Array.isArray((resp as any)?.data?.products) ? ((resp as any).data.products as any[]) : []);
				const mapped: TrendingItem[] = list.map((p: any) => {
					const firstVariant = (p.variants && p.variants[0]) || {};
					const regularPrice = firstVariant?.regularPrice ?? p.basePrice ?? 0;
					const salePrice = firstVariant?.salePrice ?? regularPrice;
					const images = p.images || firstVariant.images || [];
					const image = resolveImageUrl(images[0]?.url || "/peptide-vial-bpc157.png");
					const slug = p.seoSlug || firstVariant.seoSlug || p.id;
					return {
						id: String(p.id ?? firstVariant.id ?? Math.random()),
						name: String(p.name || firstVariant.name || "Product"),
						category: String((p.categories?.[0]?.name) || "Peptide"),
						rating: 4.9,
						reviews: 156,
						price: user ? (salePrice ? `$${Number(salePrice).toFixed(2)}` : "") : "",
						originalPrice: user && regularPrice && salePrice < regularPrice ? `$${Number(regularPrice).toFixed(2)}` : undefined,
						trend: "+25%",
						image,
						seoSlug: slug,
					};
				});
				if (active) setItems(mapped);
			} catch (e) {
				if (active) setItems([]);
			}
		})();
		return () => { active = false; };
	}, []);

	const list = useMemo(() => (items.length > 0 ? items.slice(0, 3) : []), [items]);

	useEffect(() => {
		if (list.length === 0) return;
		const timer = setInterval(() => setCurrentIndex((prev) => (prev + 1) % list.length), 4000);
		return () => clearInterval(timer);
	}, [list.length]);

	return (
		<section className="py-20 bg-background relative overflow-hidden">
			<div className="absolute inset-0 opacity-0" />

			<div className="max-w-7xl mx-auto px-6 relative z-10">
				<motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center mb-16">
					<div className="flex items-center justify-center gap-3 mb-4">

						<h2 className="text-5xl font-bold text-foreground">Trending Now</h2>

					</div>
					<p className="text-xl text-muted-foreground max-w-3xl mx-auto">The most popular peptides among researchers worldwide</p>
				</motion.div>

				{/* Mobile: auto-advancing carousel */}
				<div className="md:hidden overflow-hidden relative">
					<div className="flex transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
						{list.map((product) => (
							<div key={product.id} className="w-full flex-shrink-0 px-1">
								<div className="relative backdrop-blur-lg bg-card/50 border border-border rounded-3xl overflow-hidden transition-all duration-500 group mx-3 h-full flex flex-col">
									<Link href={`/landing/products/${product.seoSlug || product.id}`} className="absolute inset-0 z-10" aria-label="Open details" />

									<motion.div className="absolute top-4 right-4 z-20 flex items-center gap-1 bg-card text-foreground px-3 py-1 rounded-full text-sm font-bold border border-border" animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}>
										<TrendingUp className="w-3 h-3" />
										{product.trend}
									</motion.div>
									<div className="relative h-48 overflow-hidden">
										<motion.div className="absolute inset-0" whileHover={{ scale: 1.05 }} transition={{ duration: 0.3 }}>
											<ImageWithFallback src={product.image} alt={product.name} className="w-full h-full object-cover" />
											<div className="absolute inset-0 bg-black/10" />
										</motion.div>
									</div>
									<div className="p-6 relative z-20 flex flex-col flex-1">
										<div className="flex items-center justify-between mb-2">
											<div className="flex items-center gap-1">
												<Star className="w-4 h-4 text-yellow-500 fill-current" />
												<span className="text-sm text-foreground">{product.rating}</span>
												<span className="text-xs text-muted-foreground">({product.reviews})</span>
											</div>
										</div>
										<h3 className="text-xl font-bold text-foreground mb-3">{product.name}</h3>
										<div className="flex items-center gap-3 mb-4">
											<div className="text-2xl font-bold text-foreground">{product.price}</div>
											{!!product.originalPrice && (<span className="text-muted-foreground line-through text-sm">{product.originalPrice}</span>)}
										</div>
										<Button
											className="relative z-20 w-full bg-card hover:bg-accent border border-border text-foreground rounded-full py-3 backdrop-blur-sm transition-all duration-300 group/btn overflow-hidden mt-auto"
											onClick={() => {
												if (!user) { toast.info('Please sign in to add items'); return; }
												router.push(`/landing/products/${product.seoSlug || product.id}`);
											}}
										>
											<span className="relative z-10">Add to Cart</span>
											<motion.div className="absolute inset-0 bg-foreground/10 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" style={{ width: "30%" }} />
										</Button>
									</div>
								</div>
							</div>
						))}
					</div>
					<Button onClick={() => setCurrentIndex((prev) => (prev - 1 + list.length) % list.length)} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/70 hover:bg-card border border-border backdrop-blur-sm md:hidden" size="icon" aria-label="Previous">
						<ChevronLeft className="w-5 h-5 text-foreground" />
					</Button>
					<Button onClick={() => setCurrentIndex((prev) => (prev + 1) % list.length)} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/70 hover:bg-card border border-border backdrop-blur-sm md:hidden" size="icon" aria-label="Next">
						<ChevronRight className="w-5 h-5 text-foreground" />
					</Button>
				</div>

				{/* Desktop: stagger-animated grid */}
				<div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-8">
					{list.map((product, index) => (
						<motion.div
							key={product.id}
							initial={{ opacity: 0, y: 50 }}
							whileInView={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.6, delay: index * 0.1 }}
							whileHover={{ y: -12, scale: 1.02 }}
							className="group relative"
						>
							<div className="relative backdrop-blur-lg bg-card/50 border border-border rounded-3xl overflow-hidden transition-all duration-500 group-hover:border-border/70 group-hover:shadow-2xl h-full flex flex-col">
								<Link href={`/landing/products/${product.seoSlug || product.id}`} className="absolute inset-0 z-10" aria-label="Open details" />

								<motion.div className="absolute top-4 right-4 z-20 flex items-center gap-1 bg-card text-foreground px-3 py-1 rounded-full text-sm font-bold border border-border" animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}>
									<TrendingUp className="w-3 h-3" />
									{product.trend}
								</motion.div>
								<div className="relative h-48 overflow-hidden">
									<motion.div className="absolute inset-0" whileHover={{ scale: 1.05 }} transition={{ duration: 0.3 }}>
										<ImageWithFallback src={product.image} alt={product.name} className="w-full h-full object-cover" />
										<div className="absolute inset-0 bg-black/10" />
									</motion.div>
								</div>
								<div className="p-6 relative z-20 flex flex-col flex-1">
									<div className="flex items-center justify-between mb-2">
										<div className="flex items-center gap-1">
											<Star className="w-4 h-4 text-yellow-500 fill-current" />
											<span className="text-sm text-foreground">{product.rating}</span>
											<span className="text-xs text-muted-foreground">({product.reviews})</span>
										</div>
									</div>
									<h3 className="text-xl font-bold text-foreground mb-3 transition-all duration-300">{product.name}</h3>
									<div className="flex items-center gap-3 mb-4">
										<div className="text-2xl font-bold text-foreground">{product.price}</div>
										{!!product.originalPrice && (<span className="text-muted-foreground line-through text-sm">{product.originalPrice}</span>)}
									</div>
									<Button
										className="relative z-20 w-full bg-card hover:bg-accent border border-border text-foreground rounded-full py-3 backdrop-blur-sm transition-all duration-300 group/btn overflow-hidden mt-auto"
										onClick={() => {
											if (!user) { toast.info('Please sign in to add items'); return; }
											router.push(`/landing/products/${product.seoSlug || product.id}`);
										}}
									>
										<span className="relative z-10">Add to Cart</span>
										<motion.div className="absolute inset-0 bg-foreground/10 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" style={{ width: "30%" }} />
									</Button>
								</div>
								<div className="absolute inset-0 bg-foreground/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
							</div>
						</motion.div>
					))}
				</div>

				<motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }} className="text-center mt-16">
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-8 place-items-center">
						{[
							{ label: "Orders This Week", value: "2,847" },
							{ label: "Happy Researchers", value: "15,632" },
							{ label: "Countries Served", value: "50+" },
						].map((stat, i) => (
							<div key={i} className="w-full sm:w-auto backdrop-blur-sm bg-card/30 border border-border rounded-2xl p-4">
								<motion.div className="text-xl sm:text-2xl font-bold text-foreground" animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}>
									{stat.value}
								</motion.div>
								<div className="text-xs sm:text-sm text-muted-foreground">{stat.label}</div>
							</div>
						))}
					</div>
				</motion.div>
			</div>
		</section>
	);
}

export default TrendingProducts;


