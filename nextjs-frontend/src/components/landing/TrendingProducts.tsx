"use client";

import { motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import ProductDetailView from "@/components/products/ProductDetailView";
import { ProductCard } from "@/components/products/ProductCard";


export function TrendingProducts() {
	const [currentIndex, setCurrentIndex] = useState(0);
	const [items, setItems] = useState<any[]>([]);
	const [quickViewId, setQuickViewId] = useState<string | null>(null);
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
					
					// Ensure products have the 'image' property mapped for the component prop
					const processed = list.map(p => ({
						...p,
						image: p.image || (p.images && p.images[0]?.url)
					}));

					if (active) setItems(processed);
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
						{list.map((product, idx) => (
							<div key={product.id} className="w-full flex-shrink-0 px-2 h-full">
								<ProductCard 
									product={product} 
									index={idx}
									onQuickView={(id) => setQuickViewId(String(id))} 
								/>
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
						<ProductCard
							key={product.id}
							product={product}
							index={index}
							onQuickView={(id) => setQuickViewId(String(id))}
						/>
					))}
				</div>
			</div>

			{quickViewId && (
				<Dialog open={!!quickViewId} onOpenChange={(open) => !open && setQuickViewId(null)}>
					<DialogContent className="max-w-xl w-full p-0 overflow-hidden max-h-[90vh] rounded-3xl">
						<DialogTitle className="sr-only">Product Quick View</DialogTitle>
						<DialogDescription className="sr-only">View product details and purchase</DialogDescription>
						<ProductDetailView productId={String(quickViewId)} isModal={true} />
					</DialogContent>
				</Dialog>
			)}
		</section>
	);
}

export default TrendingProducts;


