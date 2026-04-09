"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import LandingHeader from "@/components/landing/LandingHeader";
import { Barlow } from "next/font/google";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"] });
import ProductsClient from "./products-client";
import { api, type Product, resolveImageUrl } from "@/lib/api";
import logger from '@/lib/logger';

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
      // Allow fetching products without authentication for landing page visibility

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
          // Product is in stock if ANY variant has available inventory or OOS selling enabled
          const inStock = (p.variants || []).some((v) => (v.inventory || []).some((inv: any) => inv.sellWhenOutOfStock || (inv.quantity - (inv.reservedQty || 0)) > 0));
          const concentrations = (p.variants || []).map((v) => v.name).filter(Boolean);
          const rating = p._count?.reviews ? Math.min(5, 4 + (p._count.reviews % 10) / 10) : 4.6; // placeholder until ratings implemented
          const reviews = p._count?.reviews ?? 0;
          const category = p.categories && p.categories.length > 0 ? p.categories[0].name : "Physician Directed Peptides";

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
            // Enrich for client add-to-cart
            _firstVariantId: firstVariant?.id,
            _firstVariantName: firstVariant?.name,
            // Enrich with variant pricing for customer-type pricing on client
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
        // Set empty array on error to prevent crashes
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
        const category = p.categories && p.categories.length > 0 ? p.categories[0].name : "Physician Directed Peptides";
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

  // Infinite scroll: observe sentinel
  useEffect(() => {
    // Allow infinite scroll for public users too
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          // Load next page when sentinel is visible
          loadMore();
        }
      }
    }, { root: null, rootMargin: '200px', threshold: 0 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [isAuthenticated, page, totalPages, loadingMore]);

  return (
    <div className="force-light min-h-screen bg-white text-black">
      <LandingHeader />

      {/* Hero Banner with Responsive Images */}
      <div className="w-full">
        <div className="hidden sm:block relative w-full aspect-[3072/750]">
          <Image
            src="/President-Desktop-Banner.png"
            alt="Presidents Day Banner"
            fill
            className="object-cover"
            priority
          />
        </div>
        <div className="block sm:hidden relative w-full aspect-[1280/1000]">
          <Image
            src="/Presidents-MobileBanner.png"
            alt="Presidents Day Banner"
            fill
            className="object-cover"
            priority
          />
        </div>
      </div>

      {/* Text Header */}
      <div className="w-full bg-[#f8f9fa] py-12 sm:py-16 text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-[#0B1215] mb-4 tracking-tight">
          Physician Grade Peptides
        </h1>
        <div className="flex items-center justify-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#00D95A]"></div>
          <p className="text-gray-500 font-medium text-base sm:text-lg">
            99%+ Purity Guaranteed
          </p>
        </div>
      </div>

      {/* Client list */}
      <div className="px-4 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading products...</p>
            </div>
          </div>
        ) : (
          <>
            <ProductsClient products={products} />
            {page < totalPages && (
              <div ref={sentinelRef} className="py-8 text-center text-sm text-gray-500">Loading more…</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}


