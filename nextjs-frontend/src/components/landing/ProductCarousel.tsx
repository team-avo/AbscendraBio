"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import ProductDetailView from "@/components/products/ProductDetailView";
import { ProductCard } from "@/components/products/ProductCard";


export function ProductCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0); // mobile slide index
  const [pageIndex, setPageIndex] = useState(0); // desktop page index
  const [items, setItems] = useState<any[]>([]);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const { user } = useAuth();

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
  }, [user]);

  const pageSize = 4;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const pageItems = useMemo(() => {
    if (items.length === 0) return [] as any[];
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
    <div className="bg-white relative" suppressHydrationWarning>
      <div className="max-w-7xl mx-auto px-6">

        {/* Mobile: auto-advancing carousel (all items) */}
        <div className="md:hidden overflow-hidden relative">
          <div className="flex transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
            {items.map((product, idx) => (
              <div key={product.id} className="w-full flex-shrink-0 px-2 h-full">
                <ProductCard 
                  product={product} 
                  index={idx} 
                  onQuickView={(id) => setQuickViewId(String(id))} 
                />
              </div>
            ))}
          </div>
          {items.length > 1 && (
            <Button onClick={() => setCurrentIndex((prev) => (prev - 1 + items.length) % items.length)} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white hover:bg-gray-50 border border-gray-100 shadow-md md:hidden z-30" size="icon" aria-label="Previous">
              <ChevronLeft className="w-5 h-5 text-[#043061]" />
            </Button>
          )}
          {items.length > 1 && (
            <Button onClick={() => setCurrentIndex((prev) => (prev + 1) % items.length)} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white hover:bg-gray-50 border border-gray-100 shadow-md md:hidden z-30" size="icon" aria-label="Next">
              <ChevronRight className="w-5 h-5 text-[#043061]" />
            </Button>
          )}
        </div>

        {/* Desktop: paged grid of 4 with arrows when more than 4 */}
        <div className="hidden md:block relative">
          {items.length > pageSize && (
            <>
              <Button onClick={() => setPageIndex((prev) => (prev - 1 + totalPages) % totalPages)} className="absolute -left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white hover:bg-gray-50 border border-gray-100 shadow-lg z-30" size="icon" aria-label="Previous">
                <ChevronLeft className="w-6 h-6 text-[#043061]" />
              </Button>
              <Button onClick={() => setPageIndex((prev) => (prev + 1) % totalPages)} className="absolute -right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white hover:bg-gray-50 border border-gray-100 shadow-lg z-30" size="icon" aria-label="Next">
                <ChevronRight className="w-6 h-6 text-[#043061]" />
              </Button>
            </>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {pageItems.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                index={index}
                onQuickView={(id) => setQuickViewId(String(id))}
              />
            ))}
          </div>
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
    </div>
  );
}

export default ProductCarousel;


