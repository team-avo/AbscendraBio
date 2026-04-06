"use client";

import { motion } from "motion/react";
import { Award, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import ImageWithFallback from "./figma/ImageWithFallback";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { api, resolveImageUrl } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Barlow } from "next/font/google";

const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"] });

type CarouselItem = {
  id: string;
  name: string;
  description: string;
  priceLabel: string;
  image: string;
  purity?: string;
};

export function ProductCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0); // mobile slide index
  const [pageIndex, setPageIndex] = useState(0); // desktop page index
  const [items, setItems] = useState<CarouselItem[]>([]);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    (async () => {
      // Only fetch products if user is authenticated
      if (!user) {
        if (active) setItems([]);
        return;
      }

      try {
        const resp = await api.getStorefrontProducts({ page: 1, limit: 24, isPopular: true });
        const list = Array.isArray((resp as any)?.data)
          ? ((resp as any).data as any[])
          : (Array.isArray((resp as any)?.data?.products) ? ((resp as any).data.products as any[]) : []);
        // Determine customer type and map to pricing tier
        // B2B customers see B2C pricing, ENTERPRISE_2 customers see ENTERPRISE_1 pricing
        const rawCustomerType: 'B2C' | 'B2B' | 'ENTERPRISE_1' | 'ENTERPRISE_2' | undefined =
          user?.customer?.customerType || (user?.role === 'CUSTOMER' ? 'B2C' : undefined);

        // Map customer types for pricing (B2B → B2C, ENTERPRISE_2 → ENTERPRISE_1)
        const pricingCustomerType = rawCustomerType === 'B2B'
          ? 'B2C'
          : rawCustomerType === 'ENTERPRISE_2'
            ? 'ENTERPRISE_1'
            : rawCustomerType;

        const mapped: CarouselItem[] = list.map((p: any) => {
          const firstVariant: any = (p.variants && p.variants[0]) || {};
          // Start with variant's regular price (no sale price)
          let price = firstVariant?.regularPrice ?? p.basePrice ?? 0;

          // Check for segment pricing based on mapped customer type
          if (pricingCustomerType && Array.isArray(firstVariant?.segmentPrices)) {
            const seg = firstVariant.segmentPrices.find((sp: any) => sp.customerType === pricingCustomerType);
            if (seg) {
              // Use only regular price from segment, not sale price
              price = seg.regularPrice ?? price;
            }
          }
          const images = p.images || firstVariant.images || [];
          const image = resolveImageUrl(images[0]?.url || "/peptide-vial-bpc157.png");
          const slug = p.seoSlug || firstVariant.seoSlug || p.id;
          return {
            id: String(p.id ?? firstVariant.id ?? Math.random()),
            name: String(p.name || firstVariant.name || "Product"),
            description: String(p.shortDescription || p.description || firstVariant.description || ""),
            priceLabel: user ? (price ? `$${Number(price).toFixed(2)}` : "") : "",
            image,
            purity: "99.8%",
            // @ts-ignore attach for links
            seoSlug: slug,
          };
        });
        if (active) setItems(mapped);
      } catch (e) {
        if (active) setItems([]);
      }
    })();
    return () => { active = false; };
  }, [user]);

  const pageSize = 4;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const pageItems = useMemo(() => {
    if (items.length === 0) return [] as CarouselItem[];
    const start = pageIndex * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, pageIndex]);

  useEffect(() => {
    if (items.length === 0) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [items.length]);

  // Don't render the section at all if user is not authenticated
  if (!user) {
    return null;
  }

  return (
    <section className="py-20 bg-background relative overflow-hidden" suppressHydrationWarning>
      <div className="absolute inset-0 opacity-0" />

      <div className="max-w-7xl mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center mb-16">
          <h2 className={`text-5xl font-bold text-foreground mb-4 ${barlow.className}`}>Popular Peptides</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">Some of the most adored peptides for your practice</p>
        </motion.div>

        {/* Mobile: auto-advancing carousel (all items) */}
        <div className="md:hidden overflow-hidden relative">
          <div className="flex transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
            {items.map((product) => (
              <div key={product.id} className="w-full flex-shrink-0 px-1">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="backdrop-blur-lg bg-card/50 border border-border rounded-3xl p-8 relative overflow-hidden group mx-3 h-full flex flex-col">
                  <Link href={`/landing/products/${(product as any).seoSlug || product.id}`} className="absolute inset-0 z-10" aria-label="Open details" />
                  <div className="absolute top-4 left-4 z-20">
                    <motion.div className="flex items-center gap-2 bg-card/70 backdrop-blur-sm border border-border rounded-full px-3 py-1 w-fit" animate={{ boxShadow: ["0 0 0 rgba(0, 0, 0, 0)", "0 0 10px rgba(0, 0, 0, 0.15)", "0 0 0 rgba(0, 0, 0, 0)"] }} transition={{ duration: 2, repeat: Infinity }}>
                      <Award className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-600">{product.purity} Purity</span>
                    </motion.div>
                  </div>

                  <div className="relative mt-8 mb-6">
                    <motion.div className="w-32 h-32 mx-auto rounded-full overflow-hidden border-4 border-border" whileHover={{ scale: 1.03 }} transition={{ duration: 0.25 }}>
                      <ImageWithFallback src={product.image} alt={product.name} className="w-full h-full object-cover" />
                    </motion.div>
                  </div>
                  <div className="text-center flex flex-col flex-1">
                    <h3 className={`text-2xl font-bold text-foreground mb-2 ${barlow.className}`}>{product.name}</h3>
                    <p className="text-muted-foreground mb-4 line-clamp-3 min-h-[4.5rem]">{product.description}</p>
                    <div className="text-3xl font-bold text-foreground mb-6">{product.priceLabel}</div>
                    <Button
                      className="relative z-20 w-full bg-card hover:bg-accent border border-border text-foreground rounded-full py-3 backdrop-blur-sm transition-all duration-300 group/btn overflow-hidden mt-auto"
                      onClick={() => {
                        if (!user) { toast.info('Please sign in to add items'); return; }
                        router.push(`/landing/products/${(product as any).seoSlug || product.id}`);
                      }}
                    >
                      <span className="relative z-10">Add to Cart</span>
                      <motion.div className="absolute inset-0 bg-foreground/10 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" style={{ width: "30%" }} />
                    </Button>
                  </div>
                </motion.div>
              </div>
            ))}
          </div>
          {items.length > 1 && (
            <Button onClick={() => setCurrentIndex((prev) => (prev - 1 + items.length) % items.length)} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/70 hover:bg-card border border-border backdrop-blur-sm md:hidden z-30 shadow" size="icon" aria-label="Previous">
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </Button>
          )}
          {items.length > 1 && (
            <Button onClick={() => setCurrentIndex((prev) => (prev + 1) % items.length)} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/70 hover:bg-card border border-border backdrop-blur-sm md:hidden z-30 shadow" size="icon" aria-label="Next">
              <ChevronRight className="w-5 h-5 text-foreground" />
            </Button>
          )}
        </div>

        {/* Desktop: paged grid of 4 with arrows when more than 4 */}
        <div className="hidden md:block relative">
          {items.length > pageSize && (
            <>
              <Button onClick={() => setPageIndex((prev) => (prev - 1 + totalPages) % totalPages)} className="absolute -left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/70 hover:bg-card border border-border backdrop-blur-sm z-30 shadow" size="icon" aria-label="Previous">
                <ChevronLeft className="w-5 h-5 text-foreground" />
              </Button>
              <Button onClick={() => setPageIndex((prev) => (prev + 1) % totalPages)} className="absolute -right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/70 hover:bg-card border border-border backdrop-blur-sm z-30 shadow" size="icon" aria-label="Next">
                <ChevronRight className="w-5 h-5 text-foreground" />
              </Button>
            </>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {pageItems.map((product, index) => (
              <motion.div key={product.id} whileHover={{ y: -8 }} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: index * 0.08 }} className="h-full">
                <div className="backdrop-blur-lg bg-card/50 border border-border rounded-3xl p-8 relative overflow-hidden group hover:shadow-2xl transition-all duration-300 h-full flex flex-col">
                  <Link href={`/landing/products/${(product as any).seoSlug || product.id}`} className="absolute inset-0 z-10" aria-label="Open details" />
                  <div className="absolute top-4 left-4 z-20">
                    <motion.div className="flex items-center gap-2 bg-card/70 backdrop-blur-sm border border-border rounded-full px-3 py-1 w-fit" animate={{ boxShadow: ["0 0 0 rgba(0, 0, 0, 0)", "0 0 10px rgba(0, 0, 0, 0.15)", "0 0 0 rgba(0, 0, 0, 0)"] }} transition={{ duration: 2, repeat: Infinity }}>
                      <Award className="w-4 h-4 text-green-600" />
                      {!!product.purity && <span className="text-sm text-green-600">{product.purity} Purity</span>}
                    </motion.div>
                  </div>

                  <div className="relative mt-8 mb-6">
                    <motion.div className="w-32 h-32 mx-auto rounded-full overflow-hidden border-4 border-border" whileHover={{ scale: 1.05 }} transition={{ duration: 0.25 }}>
                      <ImageWithFallback src={product.image} alt={product.name} className="w-full h-full object-cover" />
                    </motion.div>
                  </div>
                  <div className="text-center flex flex-col flex-1">
                    <h3 className={`text-2xl font-bold text-foreground mb-2 ${barlow.className}`}>{product.name}</h3>
                    <p className="text-muted-foreground mb-4 line-clamp-3 min-h-[4.5rem]">{product.description}</p>
                    <div className="text-3xl font-bold text-foreground mb-6">{product.priceLabel}</div>
                    <Button
                      className="relative z-20 w-full bg-card hover:bg-accent border border-border text-foreground rounded-full py-3 backdrop-blur-sm transition-all duration-300 group/btn overflow-hidden mt-auto"
                      onClick={() => {
                        if (!user) { toast.info('Please sign in to add items'); return; }
                        router.push(`/landing/products/${(product as any).seoSlug || product.id}`);
                      }}
                    >
                      <span className="relative z-10">Add to Cart</span>
                      <motion.div className="absolute inset-0 bg-foreground/10 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" style={{ width: "30%" }} />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}

export default ProductCarousel;


