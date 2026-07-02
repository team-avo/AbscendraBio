"use client";

import { useEffect, useRef, useState } from "react";
import { Barlow } from "next/font/google";
import { useAuth } from "@/contexts/auth-context";
import { ShieldCheck, FlaskConical, Award } from "lucide-react";
import ProductsClient from "./products-client";
import { api, type Product, resolveImageUrl } from "@/lib/api";
import logger from '@/lib/logger';

const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"] });

const trustBadges = [
  { icon: ShieldCheck, label: "COA Verified", sub: "Every batch tested" },
  { icon: FlaskConical, label: "99%+ Purity", sub: "HPLC confirmed" },
  { icon: Award, label: "GMP Manufactured", sub: "Certified facilities" },
];

export default function LandingProductsPage() {
  const { user, isAuthenticated } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchFirstPage = async () => {
      try {
        const limit = 24;
        const response = await api.getStorefrontProducts({ page: 1, limit });
        const dataBlock = (response.success && response.data) ? response.data : undefined;
        const pageProducts = dataBlock?.products || [];
        const mappedProducts = (pageProducts || []).map((p: Product) => {
          const firstVariant = p.variants && p.variants.length > 0 ? p.variants[0] : undefined;
          const variantFirstImage = ((firstVariant as any)?.images && (firstVariant as any).images.length > 0) ? (firstVariant as any).images[0].url : undefined;
          const productFirstImage = ((p as any).images && (p as any).images.length > 0) ? (p as any).images[0].url : undefined;
          const firstImageRaw = variantFirstImage || productFirstImage || "/products/peptide-1.jpg";
          const firstImage = resolveImageUrl(firstImageRaw);
          const price = firstVariant?.salePrice && firstVariant.salePrice > 0 ? firstVariant.salePrice : firstVariant?.regularPrice ?? 0;
          const originalPrice = firstVariant?.salePrice && firstVariant.salePrice > 0 ? firstVariant?.regularPrice ?? null : null;
          const inStock = (p.variants || []).some((v) => (v.inventory || []).some((inv: any) => inv.sellWhenOutOfStock || (inv.quantity - (inv.reservedQty || 0)) > 0));
          const concentrations = (p.variants || []).map((v) => v.name).filter(Boolean);
          const rating = p._count?.reviews ? Math.min(5, 4 + (p._count.reviews % 10) / 10) : 4.6;
          const reviews = p._count?.reviews ?? 0;
          const category = p.categories && p.categories.length > 0 ? p.categories[0].name : "Assayed Research Peptides";

          return {
            id: (p.variants && p.variants[0]?.seoSlug) || p.id,
            name: p.name,
            fullName: p.name,
            category,
            price: Number(price),
            originalPrice: originalPrice != null ? Number(originalPrice) : null,
            rating: Number(rating.toFixed(1)),
            reviews,
            image: firstImage,
            inStock,
            featured: false,
            purity: "99%+",
            concentrations,
            description: p.description || "",
            _firstVariantId: firstVariant?.id,
            _firstVariantName: firstVariant?.name,
            _variantsPricing: (p.variants || []).map((v) => ({
              id: v.id,
              name: v.name,
              regularPrice: v.regularPrice,
              salePrice: v.salePrice,
              segmentPrices: (v.segmentPrices || []).map((sp) => ({ customerType: sp.customerType, regularPrice: sp.regularPrice, salePrice: sp.salePrice }))
            })),
          };
        });

        setProducts(mappedProducts);
        setPage(1);
        setTotalPages(dataBlock?.pagination?.pages || 1);
      } catch (error) {
        logger.error("Failed to fetch products:", { error: error });
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFirstPage();
  }, [isAuthenticated]);

  const loadMore = async () => {
    if (loadingMore) return;
    const nextPage = page + 1;
    if (nextPage > totalPages) return;
    try {
      setLoadingMore(true);
      const limit = 24;
      const response = await api.getStorefrontProducts({ page: nextPage, limit });
      const dataBlock = (response.success && response.data) ? response.data : undefined;
      const pageProducts = dataBlock?.products || [];
      const mappedProducts = (pageProducts || []).map((p: Product) => {
        const firstVariant = p.variants && p.variants.length > 0 ? p.variants[0] : undefined;
        const variantFirstImage = ((firstVariant as any)?.images && (firstVariant as any).images.length > 0) ? (firstVariant as any).images[0].url : undefined;
        const productFirstImage = ((p as any).images && (p as any).images.length > 0) ? (p as any).images[0].url : undefined;
        const firstImageRaw = variantFirstImage || productFirstImage || "/products/peptide-1.jpg";
        const firstImage = resolveImageUrl(firstImageRaw);
        const price = firstVariant?.salePrice && firstVariant.salePrice > 0 ? firstVariant.salePrice : firstVariant?.regularPrice ?? 0;
        const originalPrice = firstVariant?.salePrice && firstVariant.salePrice > 0 ? firstVariant?.regularPrice ?? null : null;
        const inStock = (firstVariant?.inventory || []).some((inv: any) => inv.sellWhenOutOfStock || (inv.quantity - (inv.reservedQty || 0)) > 0);
        const concentrations = (p.variants || []).map((v) => v.name).filter(Boolean);
        const rating = p._count?.reviews ? Math.min(5, 4 + (p._count.reviews % 10) / 10) : 4.6;
        const reviews = p._count?.reviews ?? 0;
        const category = p.categories && p.categories.length > 0 ? p.categories[0].name : "Assayed Research Peptides";
        return {
          id: (p.variants && p.variants[0]?.seoSlug) || p.id,
          name: p.name,
          fullName: p.name,
          category,
          price: Number(price),
          originalPrice: originalPrice != null ? Number(originalPrice) : null,
          rating: Number(rating.toFixed(1)),
          reviews,
          image: firstImage,
          inStock,
          featured: false,
          purity: "99%+",
          concentrations,
          description: p.description || "",
          _firstVariantId: firstVariant?.id,
          _firstVariantName: firstVariant?.name,
          _variantsPricing: (p.variants || []).map((v) => ({
            id: v.id,
            name: v.name,
            regularPrice: v.regularPrice,
            salePrice: v.salePrice,
            segmentPrices: (v.segmentPrices || []).map((sp) => ({ customerType: sp.customerType, regularPrice: sp.regularPrice, salePrice: sp.salePrice }))
          })),
        };
      });
      setProducts(prev => [...prev, ...mappedProducts]);
      setPage(nextPage);
      setTotalPages(dataBlock?.pagination?.pages || totalPages);
    } catch (e) {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  };

  // Infinite scroll
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) loadMore();
      }
    }, { root: null, rootMargin: '200px', threshold: 0 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [isAuthenticated, page, totalPages, loadingMore]);

  return (
    <div className={`force-light min-h-screen bg-[#F7F9FC] ${barlow.className}`}>

      {/* ── Hero Banner ── */}
      <div className="relative bg-[#043061] overflow-hidden">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.5) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        {/* Blue glow */}
        <div className="absolute top-0 right-0 w-[600px] h-[400px] bg-[#5A9ADA]/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 pt-32 pb-14">
          <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-10">

            {/* Left — Title */}
            <div>
              <span className="inline-block text-xs sm:text-sm font-black uppercase tracking-[0.3em] text-[#5A9ADA] mb-5">
                Research Catalog
              </span>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-none text-white">
                Premium Peptide
              </h1>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extralight tracking-tight leading-none text-gray-400 mt-1">
                Products
              </h1>
              <p className="mt-6 text-base sm:text-lg text-gray-400 max-w-xl leading-relaxed">
                High-purity research peptides with third-party verified certificates. Available to licensed researchers and clinics.
              </p>
            </div>

            {/* Right — Trust badges */}
            <div className="flex flex-row lg:flex-col gap-4 lg:gap-3 pb-1">
              {trustBadges.map(({ icon: Icon, label, sub }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#5A9ADA]/10 border border-[#5A9ADA]/20 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-[#5A9ADA]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white leading-none">{label}</p>
                    <p className="text-xs text-gray-500 mt-1">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom fade into page bg */}
        <div className="h-8 bg-gradient-to-b from-[#043061] to-[#F7F9FC]" />
      </div>

      {/* ── Products Content ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-[#5A9ADA]/20 border-t-[#5A9ADA] animate-spin" />
            <p className="text-sm text-gray-400 font-medium">Loading products…</p>
          </div>
        ) : (
          <>
            <ProductsClient products={products} />
            {page < totalPages && (
              <div ref={sentinelRef} className="py-10 flex justify-center">
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-[#5A9ADA] animate-spin" />
                  Loading more products…
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
