"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import LandingHeader from "@/components/landing/LandingHeader";
import { api, type Product, resolveImageUrl, getPublicReportsForProduct, getPublicReportDownloadUrl, type ThirdPartyReport } from "@/lib/api";
import { useCart } from "@/contexts/cart-context";
import { useAuth } from "@/contexts/auth-context";
import { CheckCircle, ChevronRight, Zap, Microscope, Heart, Shield, Truck, Award, Eye, Download, Copy, Tag, Check } from "lucide-react";
import { toast } from "sonner";
import { Barlow } from "next/font/google";
import { CartSidebar } from "@/components/cart/CartSidebar";
import { Button as CartButton } from "@/components/ui/button";
import { BulkQuoteRequestDialog } from "@/components/products/bulk-quote-request-dialog";
import { getPricingCustomerType } from "@/utils/pricingMapper";
import logger from '@/lib/logger';

const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"] });

export default function LandingProductDetailPage() {
  const params = useParams<{ id: string }>();
  const productId = params?.id as string;
  const { add } = useCart();
  const { user } = useAuth();
  const isLoggedIn = !!user;

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [heroSrc, setHeroSrc] = useState<string>("/products/peptide-1.jpg");
  const [customerType, setCustomerType] = useState<"B2C" | "B2B" | "ENTERPRISE_1" | "ENTERPRISE_2" | undefined>(undefined);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [vialAmount, setVialAmount] = useState<number | "">(1);
  const [quantity, setQuantity] = useState<number>(1);
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState<boolean>(false);
  const [bulkQuoteOpen, setBulkQuoteOpen] = useState<boolean>(false);
  const [couponCopied, setCouponCopied] = useState<boolean>(false);
  const [reports, setReports] = useState<ThirdPartyReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState<boolean>(false);


  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!productId) return;
      setLoading(true);
      setError(null);

      // Determine customer type early
      let customerTypeValue: "B2C" | "B2B" | "ENTERPRISE_1" | "ENTERPRISE_2" | undefined = undefined;
      if (user?.customer?.customerType) {
        customerTypeValue = user.customer.customerType;
      } else if (user?.role === 'CUSTOMER') {
        customerTypeValue = 'B2C';
      }

      // Fetch product and favorites in parallel for better performance
      const [productRes, favsRes] = await Promise.all([
        api.getStorefrontProduct(productId),
        user?.customerId
          ? api.getFavorites(user.customerId, { page: 1, limit: 100 })
          : Promise.resolve({ success: false, data: null })
      ]);

      if (!mounted) return;

      // Set customer type
      setCustomerType(customerTypeValue);

      // Set product data
      if (productRes.success && productRes.data) {
        setProduct(productRes.data);
        const firstVariant = (productRes.data.variants && productRes.data.variants[0]) || undefined;
        const variantFirstImage = (((firstVariant as any)?.images) && (firstVariant as any).images.length > 0) ? (firstVariant as any).images[0].url : undefined;
        const productFirstImage = (((productRes.data as any).images) && (productRes.data as any).images.length > 0) ? (productRes.data as any).images[0].url : undefined;
        const firstImage = resolveImageUrl(variantFirstImage || productFirstImage || "/products/peptide-1.jpg");
        setHeroSrc(firstImage);
        setSelectedVariantId(firstVariant?.id || null);
      } else {
        setError(productRes.error || "Failed to load product");
      }

      // Set favorites if loaded
      if (favsRes.success && favsRes.data) {
        const f = favsRes.data.favorites.find(f => f.product?.id === productId);
        setFavoriteId(f ? f.id : null);
      } else {
        setFavoriteId(null);
      }

      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [productId, user]);

  // Fetch reports
  useEffect(() => {
    if (!productId) return;
    (async () => {
      setReportsLoading(true);
      try {
        const res = await getPublicReportsForProduct(productId);
        if (res.success && res.data) {
          setReports(res.data);
        }
      } catch (e) {
        logger.error("Failed to fetch reports", { error: e });
      } finally {
        setReportsLoading(false);
      }
    })();
  }, [productId]);

  const ui = useMemo(() => {
    const name = product?.name || "Product";
    const category = product?.categories && product.categories.length > 0 ? product.categories[0].name : "Physician Directed Peptides";
    const variants = product?.variants || [];
    const selectedVariant = variants.find(v => v.id === selectedVariantId) || variants[0];

    // Helper to safely convert price strings/numbers to numbers (Prisma returns Decimals as strings)
    const toPrice = (val: any): number => {
      if (val === null || val === undefined) return 0;
      return Number(val) || 0;
    };

    // Calculate total quantity for bulk pricing check
    const effectiveVialAmount = typeof vialAmount === 'number' ? vialAmount : 1;
    const totalQuantity = effectiveVialAmount * quantity;

    // Compute price respecting customer tiers and bulk pricing:
    // 1. Check for bulk pricing based on total quantity
    // 2. If no bulk price, check segment pricing
    // 3. Fall back to regular/sale price
    let price = 0;
    let originalPrice: number | null = null;
    let isBulkPrice = false;

    // Check for bulk pricing first
    const bulkPrices = (selectedVariant as any)?.bulkPrices as any[] | undefined;
    if (bulkPrices && bulkPrices.length > 0) {
      const applicableBulk = bulkPrices.find((bp: any) => {
        const minQty = Number(bp.minQty);
        const maxQty = bp.maxQty ? Number(bp.maxQty) : Infinity;
        return totalQuantity >= minQty && totalQuantity <= maxQty;
      });

      if (applicableBulk) {
        price = toPrice(applicableBulk.price);
        originalPrice = toPrice(selectedVariant?.regularPrice);
        isBulkPrice = true;
      }
    }

    // If no bulk price, check segment/regular pricing
    if (!isBulkPrice) {
      // Try to find segment price either on the variant or on a flattened pricing collection
      const findSegmentPrice = () => {
        // Map customer type to pricing tier (B2B->B2C, ENTERPRISE_2->ENTERPRISE_1)
        const pricingType = getPricingCustomerType(customerType);
        logger.info('pricingType', { data: pricingType });

        const onVariant = (selectedVariant as any)?.segmentPrices as any[] | undefined;
        if (onVariant && pricingType) {
          const seg = onVariant.find((sp: any) => sp.customerType === pricingType);
          if (seg) return seg;
        }
        const variantId = selectedVariant?.id;
        const flattened = (product as any)?._variantsPricing as any[] | undefined;
        if (flattened && variantId && pricingType) {
          const vp = flattened.find((v: any) => v.variantId === variantId);
          if (vp && vp.segmentPrices) {
            const seg = vp.segmentPrices.find((sp: any) => sp.customerType === pricingType);
            if (seg) return seg;
          }
        }
        return null;
      };

      const seg = findSegmentPrice();

      // Debug logging
      logger.info('[Product Detail] Customer Type:', { data: customerType });
      logger.info('[Product Detail] Selected Variant:', { name: selectedVariant?.name, id: selectedVariant?.id });
      logger.info('[Product Detail] Segment Prices:', { data: selectedVariant?.segmentPrices });
      logger.info('[Product Detail] Found Segment:', { data: seg });
      logger.info('[Product Detail] Bulk Prices:', { data: bulkPrices });
      logger.info('[Product Detail] Total Quantity:', { data: totalQuantity });

      if (!customerType || customerType === 'B2C') {
        // B2C customers: check for segment price first, then fall back to variant prices
        if (seg) {
          // B2C segment pricing exists
          const segSale = toPrice(seg.salePrice);
          const segRegular = toPrice(seg.regularPrice);
          if (segSale > 0 && segSale < segRegular) {
            price = segSale;
            originalPrice = segRegular;
          } else {
            price = segRegular;
            originalPrice = null;
          }
        } else {
          // No segment pricing, use variant prices
          const varSale = toPrice(selectedVariant?.salePrice);
          const varRegular = toPrice(selectedVariant?.regularPrice);
          if (varSale > 0 && varSale < varRegular) {
            price = varSale;
            originalPrice = varRegular;
          } else {
            price = varRegular;
            originalPrice = null;
          }
        }
      } else {
        // B2B/ENTERPRISE customers: use segment pricing if available, otherwise regular price only
        if (seg) {
          // Tiered customers: honor explicit segment pricing
          const segSale = toPrice(seg.salePrice);
          const segRegular = toPrice(seg.regularPrice);
          if (segSale > 0 && segSale < segRegular) {
            price = segSale;
            originalPrice = segRegular;
          } else {
            price = segRegular;
            originalPrice = null;
          }
        } else {
          // Tiered customers without explicit segment prices see regular list price only (no sales)
          price = toPrice(selectedVariant?.regularPrice);
          originalPrice = null;
        }
      }
    }

    const availableQuantity = (selectedVariant?.inventory || []).reduce((total, inv) => {
      const available = Math.max(0, (inv.quantity || 0) - (inv.reservedQty || 0));
      logger.info(`Inventory location ${inv.locationId}: quantity=${inv.quantity}, reservedQty=${inv.reservedQty}, available=${available}`);
      return total + available;
    }, 0);
    const inStock = availableQuantity >= totalQuantity || (selectedVariant?.inventory || []).some((inv: any) => inv.sellWhenOutOfStock);
    logger.info(`Total available quantity: ${availableQuantity}, needed: ${totalQuantity}, inStock: ${inStock}`);
    const concentrations = variants.map(v => v.name).filter(Boolean);
    const reviews = product?._count?.reviews ?? 0;
    const rating = reviews ? Math.min(5, 4 + (reviews % 10) / 10) : 4.6;
    const currentVariantId = selectedVariant?.id as string | undefined;
    return { name, category, price: Number(price), originalPrice: originalPrice != null ? Number(originalPrice) : null, isBulkPrice, inStock, concentrations, reviews, rating, currentVariantId, variants, availableQuantity };
  }, [product, selectedVariantId, customerType, vialAmount, quantity]);

  // When selected variant changes, if it has images, update hero
  useEffect(() => {
    const v = (product?.variants || []).find((x) => x.id === selectedVariantId);
    const variantFirstImage = (((v as any)?.images) && (v as any).images.length > 0) ? (v as any).images[0].url : undefined;
    const productFirstImage = (((product as any)?.images) && (product as any).images.length > 0) ? (product as any).images[0].url : undefined;
    const nextHero = resolveImageUrl(variantFirstImage || productFirstImage || "/products/peptide-1.jpg");
    setHeroSrc(nextHero);
  }, [selectedVariantId, product]);

  // Filter reports based on selected variant
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      // Show if report is linked to the current product (applies to all variants)
      // OR if it is linked specifically to the selected variant
      const linkedToProduct = r.products?.some((p) => p.id === productId);
      const linkedToVariant = selectedVariantId && r.variants?.some((v) => v.id === selectedVariantId);

      return linkedToProduct || linkedToVariant;
    });
  }, [reports, selectedVariantId, productId]);

  return (
    <div className="force-light min-h-screen bg-white text-black">
      <style jsx>{`
        select {
          background-image: none;
        }
        select:focus {
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
        }
        select option {
          padding: 12px 16px;
          background-color: white;
          color: #374151;
          font-weight: 500;
        }
        select option:hover {
          background-color: #f9fafb;
        }
        select option:checked {
          background-color: #fef2f2;
          color: #dc2626;
        }
      `}</style>
      <LandingHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        {loading && (
          <div className="py-16 text-center text-gray-600">Loading product...</div>
        )}
        {error && !loading && (
          <div className="py-16 text-center text-red-600">{error}</div>
        )}
        {!loading && !error && (
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-start">
            <div className="space-y-6">
              <div className="relative group">
                <div className="relative aspect-square bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl overflow-hidden border border-gray-200 shadow-2xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent" />
                  <img
                    src={heroSrc}
                    alt={ui.name}
                    className="object-cover relative z-10 w-full h-full"
                    onError={() => setHeroSrc(resolveImageUrl("/products/peptide-1.jpg"))}
                  />
                  <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 backdrop-blur-sm">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Lab Verified
                    </Badge>
                    <button
                      aria-label={favoriteId ? 'Remove from favorites' : 'Add to favorites'}
                      className={`w-10 h-10 rounded-full bg-white/80 hover:bg-white border border-gray-200 flex items-center justify-center shadow-sm transition ${favoriteId ? 'text-red-500' : 'text-gray-700'}`}
                      onClick={async () => {
                        if (!user || user.role !== 'CUSTOMER' || !user.customerId) {
                          toast.info('Please sign in as a customer to use favorites');
                          return;
                        }
                        if (favoriteId) {
                          const res = await api.removeFavorite(user.customerId, favoriteId);
                          if (res.success) { setFavoriteId(null); toast.success('Removed from favorites'); }
                        } else {
                          const res = await api.addFavorite(user.customerId, productId);
                          if (res.success && res.data?.id) { setFavoriteId(res.data.id); toast.success('Added to favorites'); }
                        }
                      }}
                    >
                      <Heart className={`w-5 h-5 ${favoriteId ? 'fill-red-500' : ''}`} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 sm:gap-4 mt-4">
                  {(() => {
                    const variant = (product?.variants || []).find((v) => v.id === selectedVariantId) || (product?.variants || [])[0];
                    const gallery = (((variant as any)?.images) && (variant as any).images.length > 0)
                      ? (variant as any).images
                      : (((product as any)?.images) || []);
                    const imgs = (gallery && gallery.length > 0) ? gallery : [{ url: heroSrc, altText: ui.name } as any];
                    return imgs.slice(0, 4).map((img: any, i: number) => (
                      <button key={i} className="aspect-square bg-gray-50 rounded-xl border border-gray-200 hover:border-red-500/50 overflow-hidden transition-all duration-300 hover:scale-105" onClick={() => setHeroSrc(resolveImageUrl(img.url))}>
                        <img src={resolveImageUrl(img.url || "/products/peptide-1.jpg")} alt={img.altText || `Product view ${i + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ));
                  })()}
                </div>
                {/* Feature badges below gallery */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
                    <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 mx-auto mb-3 flex items-center justify-center">
                      <Microscope className="w-6 h-6 text-green-500" />
                    </div>
                    <div className="font-bold text-black">99.9% Pure</div>
                    <div className="text-gray-600 text-sm">Laboratory Grade</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6 sm:space-y-8">
              <div>
                <div className="flex items-center space-x-3 mb-4">
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30 px-3 py-1">Physician Directed</Badge>
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30 px-3 py-1">
                    <CheckCircle className="w-3 h-3 mr-1" /> {ui.inStock ? 'IN STOCK' : 'OUT OF STOCK'}
                  </Badge>
                </div>
                <h1 className="text-3xl sm:text-5xl font-black mb-2 sm:mb-4 text-foreground">{ui.name}</h1>
                {product?.description && (<p className="text-gray-600 text-base sm:text-lg leading-relaxed">{product.description}</p>)}

                {/* Reviews removed per request */}

                <div className="flex flex-wrap items-end gap-2 sm:space-x-4 mt-4 sm:mt-6">
                  {isLoggedIn ? (
                    <>
                      {selectedVariantId && typeof vialAmount === 'number' ? (
                        <>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-3">
                              <span className="text-3xl sm:text-5xl font-black text-black">${(ui.price * vialAmount * quantity).toFixed(2)}</span>
                              {ui.isBulkPrice && (
                                <Badge className="bg-green-500/20 text-green-700 border-green-500/30 px-3 py-1">
                                  Bulk Price
                                </Badge>
                              )}
                            </div>

                          </div>
                          {ui.originalPrice && (
                            <span className="text-xl sm:text-2xl text-gray-500 line-through sm:mb-2">${(ui.originalPrice * vialAmount * quantity).toFixed(2)}</span>
                          )}
                          {(vialAmount > 1 || quantity > 1) && (
                            <span className="text-sm text-gray-600 sm:mb-2">${ui.price.toFixed(2)} per vial</span>
                          )}
                        </>
                      ) : (
                        <span className="text-base sm:text-lg text-gray-600">Please select variant and vial amount to view price</span>
                      )}
                    </>
                  ) : (
                    <span className="text-base sm:text-lg text-gray-600">Please sign in to view price</span>
                  )}
                </div>
              </div>

              <div className="space-y-6 bg-gray-50 rounded-2xl p-4 sm:p-6 border border-gray-200 relative" style={{ zIndex: 1 }}>
                {/* Variable mg Selection */}
                <div className="relative" style={{ zIndex: 30 }}>
                  <label className="block text-sm font-bold text-black mb-3 uppercase tracking-wide">Variable mg</label>
                  <div className="relative">
                    <select
                      value={selectedVariantId || ''}
                      onChange={(e) => setSelectedVariantId(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl bg-white text-gray-700 font-semibold focus:border-red-500 focus:outline-none transition-all duration-200 appearance-none cursor-pointer hover:border-gray-400 shadow-sm"
                      style={{ zIndex: 40 }}
                    >
                      <option value="" disabled>Choose an option</option>
                      {(ui.variants || []).map((v) => (
                        <option key={v.id} value={v.id} className="py-2">
                          {v.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Vial Amount Selection
              <div className="relative" style={{ zIndex: 30 }}>
                <label className="block text-sm font-bold text-black mb-3 uppercase tracking-wide">Vial Amount</label>
                <div className="relative">
                  <select
                    value={vialAmount}
                    onChange={(e) => setVialAmount(Number(e.target.value))}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl bg-white text-gray-700 font-semibold focus:border-red-500 focus:outline-none transition-all duration-200 appearance-none cursor-pointer hover:border-gray-400 shadow-sm"
                    style={{ zIndex: 40 }}
                  >
                    <option value="" disabled>Choose an option</option>
                    {(() => {
                      const selectedVariant = (ui.variants || []).find(v => v.id === selectedVariantId);
                      const availableQuantity = selectedVariant?.inventory?.reduce((total, inv) => total + (inv.quantity - inv.reservedQty), 0) || 0;
                      
                      // Generate options based on available inventory
                      const options = [];
                      if (availableQuantity >= 1) options.push({ value: 1, label: '1 Vial' });
                      if (availableQuantity >= 5) options.push({ value: 5, label: '5 Vials' });
                      if (availableQuantity >= 10) options.push({ value: 10, label: '10 Vials' });
                      
                      // If no specific vial amounts available, show quantity options
                      if (options.length === 0) {
                        for (let i = 1; i <= Math.min(availableQuantity, 10); i++) {
                          options.push({ value: i, label: `${i} Vial${i > 1 ? 's' : ''}` });
                        }
                      }
                      
                      return options.map(option => (
                        <option key={option.value} value={option.value} className="py-2">
                          {option.label}
                        </option>
                      ));
                    })()}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div> */}

                {/* Quantity Controls */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-bold text-black uppercase tracking-wide">Quantity</label>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      className="w-8 h-8 rounded-lg border-2 border-gray-300 hover:border-red-500 flex items-center justify-center transition-colors text-sm font-bold"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={ui.availableQuantity || 999}
                      value={quantity}
                      onChange={(e) => {
                        const newQuantity = parseInt(e.target.value) || 1;
                        setQuantity(Math.max(1, Math.min(newQuantity, ui.availableQuantity || 999)));
                      }}
                      className="w-16 h-8 text-center font-bold text-lg border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none"
                    />
                    <button
                      onClick={() => setQuantity(q => Math.min(q + 1, ui.availableQuantity || 999))}
                      className="w-8 h-8 rounded-lg border-2 border-gray-300 hover:border-green-500 flex items-center justify-center transition-colors text-sm font-bold"
                    >
                      +
                    </button>
                  </div>

                  {/* Quick Bulk Add Buttons */}
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-xs text-gray-600 font-medium">Quick Add:</span>
                    <button
                      onClick={() => setQuantity(q => Math.min(q + 25, ui.availableQuantity || 999))}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                    >
                      +25
                    </button>
                    <button
                      onClick={() => setQuantity(q => Math.min(q + 50, ui.availableQuantity || 999))}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                    >
                      +50
                    </button>
                    <button
                      onClick={() => setQuantity(q => Math.min(q + 75, ui.availableQuantity || 999))}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                    >
                      +75
                    </button>
                  </div>
                </div>
              </div>

              {/* Bulk Pricing Table - Moved above Add to Cart */}
              {(() => {
                const variants = product?.variants || [];
                const selectedVariant = variants.find(v => v.id === selectedVariantId) || variants[0];
                const bulkPrices = (selectedVariant as any)?.bulkPrices;

                if (!bulkPrices || bulkPrices.length === 0) {
                  return null;
                }

                return (
                  <div className="mb-6 relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-black">Bulk Pricing</h3>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden relative">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50/50">
                            <th className="text-center py-3 px-4 font-semibold text-black">Quantity</th>
                            <th className="text-center py-3 px-4 font-semibold text-black">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bulkPrices.map((bulkPrice: any, index: number) => {
                            return (
                              <tr key={bulkPrice.id || index} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                                <td className="py-3 px-4 text-gray-700 text-center font-medium">
                                  {bulkPrice.minQty}{bulkPrice.maxQty ? ` - ${bulkPrice.maxQty}` : '+'}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <div className="flex flex-col items-center justify-center">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-green-600">
                                        ${Number(bulkPrice.price).toFixed(2)}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-gray-500 uppercase font-medium">per item</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-3 sm:space-y-4 mt-8">
                <Button
                  size="lg"
                  className={`w-full text-white border-0 text-base sm:text-lg py-4 sm:py-6 font-bold rounded-xl shadow-lg ${!ui.inStock
                    ? 'bg-gray-500 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-500'
                    }`}
                  disabled={!ui.inStock || !ui.currentVariantId || !isLoggedIn || typeof vialAmount !== 'number'}
                  onClick={() => {
                    if (!isLoggedIn) {
                      toast.info("Please sign in to add to cart");
                      return;
                    }
                    if (!ui.currentVariantId) {
                      toast.info("Please select a variant");
                      return;
                    }
                    if (typeof vialAmount !== 'number') {
                      toast.info("Please select a vial amount");
                      return;
                    }
                    if (ui.currentVariantId && typeof vialAmount === 'number') {
                      // Add to cart with total quantity (vialAmount * quantity)
                      add(ui.currentVariantId, vialAmount * quantity, ui.price)
                        .then(() => {
                          toast.success(`Added ${vialAmount * quantity} vials to cart`);
                          setCartOpen(true);
                        })
                        .catch((error) => {
                          toast.error(error.message || 'Failed to add to cart');
                        });
                    }
                  }}
                >
                  {!ui.inStock ?
                    "OUT OF STOCK" :
                    (isLoggedIn && ui.currentVariantId && typeof vialAmount === 'number' ?
                      `ADD TO CART - $${(ui.price * vialAmount * quantity).toFixed(2)}` :
                      "ADD TO CART")
                  }
                </Button>

                {/* Show available quantity message */}
                {ui.currentVariantId && typeof vialAmount === 'number' && (
                  <div className="text-center text-sm text-gray-600 mt-2">
                    {!ui.inStock ? (
                      <span className="text-red-600 font-medium">Out of Stock</span>
                    ) : null}
                  </div>
                )}
                {/* Bulk Quote button removed - bulk pricing table moved above */}

                {/* Presidents Day Sale Coupon Banner (Commented Out)
                <div className="bg-[#f1ebda] border-4 border-[#2B3B4C] rounded-xl p-6 text-[#C24C42] relative overflow-hidden shadow-xl">
                  <div className="absolute inset-0 border-2 border-[#C24C42] m-[2px] rounded-[9px] pointer-events-none" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="w-5 h-5 text-[#C24C42]" />
                      <span className="font-black text-base uppercase tracking-[0.2em] [text-shadow:1px_1px_0px_#2B3B4C, -1px_-1px_0px_#2B3B4C, 1px_-1px_0px_#2B3B4C, -1px_1px_0px_#2B3B4C]">Presidents' Day Sale</span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-black text-[#2B3B4C] uppercase tracking-tighter">Use code</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText('PRESIDENTS');
                          setCouponCopied(true);
                          setTimeout(() => setCouponCopied(false), 2000);
                        }}
                        className="inline-flex items-center gap-2 bg-[#f1ebda] hover:bg-[#e8e0c8] transition-colors font-mono font-black text-sm sm:text-lg px-5 py-2 rounded-sm border-2 border-[#2B3B4C] cursor-pointer shadow-[3px_3px_0px_#C24C42] relative group"
                        title="Click to copy coupon code"
                      >
                        <div className="absolute inset-0 border border-[#C24C42] m-[1px] rounded-[1px] pointer-events-none" />
                        <span className="relative z-10 [text-shadow:1px_1px_0px_#2B3B4C, -1px_-1px_0px_#2B3B4C, 1px_-1px_0px_#2B3B4C, -1px_1px_0px_#2B3B4C]">PRESIDENTS</span>
                        {couponCopied ? <Check className="w-4 h-4 text-green-700 relative z-10" /> : <Copy className="w-4 h-4 opacity-70 relative z-10" />}
                      </button>
                      <span className="text-sm font-black text-[#2B3B4C] uppercase tracking-tighter">at checkout</span>
                    </div>
                  </div>
                </div>
                */}


                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-gray-700">
                  <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                      <Shield className="w-6 h-6 text-green-500" />
                    </div>
                    <div>
                      <div className="font-semibold text-black">99.9% Purity</div>
                      <div className="text-gray-600 text-xs">Verified by Lab</div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                      <Truck className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                      <div className="font-semibold text-black">Express Shipping</div>
                      <div className="text-gray-600 text-xs">24-48 Hours</div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <Award className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                      <div className="font-semibold text-black">Physician Directed</div>
                      <div className="text-gray-600 text-xs">Premium Quality</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="hidden" />
            </div>
          </div>
        )}

        {/* Professional Use Notice */}
        <div className="mt-12 sm:mt-20">
          <Card className="border-l-4 border-amber-500 bg-amber-50 border-gray-200">
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-amber-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3">Important Note</h3>
                  <p className="text-sm sm:text-base text-gray-900 leading-relaxed">
                    Products sold on this website are intended for <strong>PROFESSIONAL USE ONLY</strong> and are only to be sold to a licensed healthcare provider to be utilized at their discretion in accordance with applicable law.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Third Party Testing Reports */}
        {filteredReports.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-black mb-6 text-foreground uppercase tracking-tight">Testing</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredReports.map((report) => (
                <Card key={report.id} className="overflow-hidden border border-gray-200 hover:border-red-500/30 transition-all duration-300 hover:shadow-lg bg-white group">
                  <CardContent className="p-0">
                    <div className="flex flex-col h-full">
                      {/* Document Preview Area */}
                      <div className="bg-white h-56 flex items-center justify-center border-b border-gray-100 group-hover:bg-red-50/10 transition-colors relative overflow-hidden">
                        {report.previewUrl ? (
                          <div className="w-full h-full relative">
                            <iframe
                              src={`${report.previewUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                              className="w-full h-full border-0 pointer-events-none"
                              scrolling="no"
                            />
                            <div className="absolute inset-0 bg-transparent z-10" />
                          </div>
                        ) : (
                          <div className="relative">
                            <div className="w-16 h-20 bg-white border-2 border-gray-300 rounded-md shadow-sm transform group-hover:scale-105 transition-transform duration-300 flex items-center justify-center">
                              <Microscope className="w-8 h-8 text-red-500/40" />
                            </div>
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-sm border border-white">
                              <CheckCircle className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="p-5 flex flex-col gap-3">
                        <div>
                          <Badge className="bg-red-500/10 text-red-600 border-red-500/20 mb-2 uppercase text-[10px] font-bold tracking-wider">
                            {report.category}
                          </Badge>
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold text-gray-900 leading-tight line-clamp-2 min-h-[2.5rem] flex-1">
                              {report.name}
                            </h3>
                            <Shield className="w-4 h-4 text-green-500 mt-1 shrink-0" />
                          </div>
                        </div>

                        {report.description && (
                          <p className="text-gray-500 text-xs line-clamp-2 min-h-[2rem]">
                            {report.description}
                          </p>
                        )}

                        <div className="flex gap-2 mt-2 pt-4 border-t border-gray-100">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-8 border-gray-300 hover:border-red-500 hover:text-red-600 font-bold flex-1"
                            onClick={async () => {
                              try {
                                const res = await getPublicReportDownloadUrl(report.id, 'inline');
                                if (res.success && res.data?.url) {
                                  window.open(res.data.url, '_blank');
                                } else {
                                  toast.error("Failed to get preview link");
                                }
                              } catch (e) {
                                toast.error("Error opening file");
                              }
                            }}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1.5" />
                            VIEW
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-8 border-gray-300 hover:border-red-500 hover:text-red-600 font-bold flex-1"
                            onClick={async () => {
                              try {
                                const res = await getPublicReportDownloadUrl(report.id, 'attachment');
                                if (res.success && res.data?.url) {
                                  window.open(res.data.url, '_self');
                                } else {
                                  toast.error("Failed to get download link");
                                }
                              } catch (e) {
                                toast.error("Error downloading file");
                              }
                            }}
                          >
                            <Download className="w-3.5 h-3.5 mr-1.5" />
                            DOWNLOAD
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Cart Sidebar */}
      <CartSidebar
        open={cartOpen}
        onOpenChange={setCartOpen}
        trigger={
          <div style={{ display: 'none' }}>
            <CartButton>Hidden Cart Trigger</CartButton>
          </div>
        }
      />

      {/* Bulk Quote Request Dialog */}
      {user?.customerId && (
        <BulkQuoteRequestDialog
          open={bulkQuoteOpen}
          onOpenChange={setBulkQuoteOpen}
          productId={productId}
          customerId={user.customerId}
          productName={product?.name || "Product"}
        />
      )}
    </div>
  );
}


