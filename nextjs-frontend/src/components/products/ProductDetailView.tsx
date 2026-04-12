"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { api, type Product, resolveImageUrl, getPublicReportsForProduct, getPublicReportDownloadUrl, type ThirdPartyReport } from "@/lib/api";
import { useCart } from "@/contexts/cart-context";
import { useAuth } from "@/contexts/auth-context";
import { CheckCircle, ChevronRight, Zap, Microscope, Shield, Truck, Award, Eye, Download, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { Barlow } from "next/font/google";
import { CartSidebar } from "@/components/cart/CartSidebar";
import { Button as CartButton } from "@/components/ui/button";
import { BulkQuoteRequestDialog } from "@/components/products/bulk-quote-request-dialog";
import { getPricingCustomerType } from "@/utils/pricingMapper";
import logger from '@/lib/logger';

const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"] });

export default function ProductDetailView({ productId, isModal = false }: { productId: string; isModal?: boolean }) {
  const { add } = useCart();
  const { user, isAuthenticated, openLoginModal } = useAuth();

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
  const [currentImgIndex, setCurrentImgIndex] = useState(0);


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
    const category = product?.categories && product.categories.length > 0 ? product.categories[0].name : "Assayed Research Peptides";
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
    setCurrentImgIndex(0);
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
    <div className={`relative ${isModal ? "bg-white text-primary w-full h-[85vh] max-h-[800px] flex flex-col overflow-hidden" : "force-light min-h-screen bg-[#FDFDFD] text-primary"} ${barlow.className}`}>
      <main className={isModal ? "flex-1 flex flex-col min-h-0 w-full max-w-lg mx-auto" : "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 p-12"}>
        {loading && (
          <div className="py-32 flex flex-col items-center justify-center gap-4 text-primary/30">
             <div className="w-10 h-10 rounded-full border-2 border-primary/10 border-t-primary animate-spin" />
             <span className="text-xs font-black uppercase tracking-widest">Accessing Bio-Catalog...</span>
          </div>
        )}
        {error && !loading && (
          <div className="py-32 text-center">
             <div className="inline-block px-6 py-3 rounded-2xl bg-red-50 text-red-600 text-xs font-black uppercase tracking-widest border border-red-100">
                Sequence Error: {error}
             </div>
          </div>
        )}
        {!loading && !error && (
          <>
          {/* ────── FIXED HEADER LAYER ──── */}
          <div className="flex-shrink-0 p-5 border-b border-gray-100 bg-white/50 backdrop-blur-md z-30">
             <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                   <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/30">{ui.category}</span>
                      <div className="w-0.5 h-0.5 rounded-full bg-primary/10" />
                      <span className="text-[10px] font-mono text-primary/20">SEQ-{(Math.random() * 1000).toFixed(0)}</span>
                   </div>
                   <h1 className="text-xl font-black text-primary tracking-tighter leading-tight uppercase">
                     {ui.name}
                   </h1>
                </div>
                
                <div className="flex items-center gap-1.5 bg-emerald-500/5 border border-emerald-500/10 px-3 py-1.5 rounded-full">
                   <div className={`w-1.5 h-1.5 rounded-full ${ui.inStock ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                   <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                     {ui.inStock ? 'In-Stock' : 'Depleted'}
                   </span>
                </div>
             </div>
          </div>

          {/* ──── SCROLLABLE CORE BODY ──── */}
          <div className="flex-1 overflow-y-auto p-5 space-y-8 scrollbar-hide">
            {/* Image Visualizer Stake */}
            <div className="relative group bg-gray-50/50 rounded-[1.2rem] border border-gray-100 overflow-hidden isolate aspect-[4/3] flex items-center justify-center">
              <img
                src={heroSrc}
                alt={ui.name}
                className="object-contain w-full h-full p-4 transition-all duration-[1s]"
                onError={() => setHeroSrc(resolveImageUrl("/products/peptide-1.jpg"))}
              />
              
              {/* Arrow Navigation (Stacked Style) */}
              {(() => {
                const variant = (product?.variants || []).find((v) => v.id === selectedVariantId) || (product?.variants || [])[0];
                const gallery = (((variant as any)?.images) && (variant as any).images.length > 0)
                  ? (variant as any).images
                  : (((product as any)?.images) || []);
                const imgs = (gallery && gallery.length > 0) ? gallery : [{ url: heroSrc } as any];
                
                if (imgs.length <= 1) return null;

                return (
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-2 pointer-events-none">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const nextIdx = (currentImgIndex - 1 + imgs.length) % imgs.length;
                        setCurrentImgIndex(nextIdx);
                        setHeroSrc(resolveImageUrl(imgs[nextIdx].url));
                      }}
                      className="w-7 h-7 rounded-full bg-white/80 backdrop-blur-md border border-gray-100 flex items-center justify-center text-primary/60 hover:text-primary transition-all pointer-events-auto shadow-sm"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const nextIdx = (currentImgIndex + 1) % imgs.length;
                        setCurrentImgIndex(nextIdx);
                        setHeroSrc(resolveImageUrl(imgs[nextIdx].url));
                      }}
                      className="w-7 h-7 rounded-full bg-white/80 backdrop-blur-md border border-gray-100 flex items-center justify-center text-primary/60 hover:text-primary transition-all pointer-events-auto shadow-sm"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })()}

              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                 {(() => {
                   const variant = (product?.variants || []).find((v) => v.id === selectedVariantId) || (product?.variants || [])[0];
                   const imgs = (((variant as any)?.images) && (variant as any).images.length > 0) ? (variant as any).images : (((product as any)?.images) || []);
                   if (imgs.length <= 1) return null;
                   return imgs.map((_: any, i: number) => (
                     <div key={i} className={`h-0.5 rounded-full transition-all ${i === currentImgIndex ? 'w-3 bg-primary' : 'w-1 bg-primary/10'}`} />
                   ));
                 })()}
              </div>
            </div>

            {/* Content Stack */}
            <div className="space-y-6 pb-4">
              {product?.description && (
                <p className="text-sm text-primary/50 leading-relaxed font-medium">
                  {product.description}
                </p>
              )}

              {/* VARIANT SELECTION */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/30 block">Vial Configuration</label>
                <div className="flex flex-wrap gap-2">
                  {(ui.variants || []).map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariantId(v.id)}
                      className={`px-4 py-2 rounded-xl border transition-all text-left ${
                        selectedVariantId === v.id
                          ? 'bg-primary border-primary text-white shadow-md shadow-primary/10'
                          : 'bg-white border-gray-100 text-primary/60 text-xs uppercase font-black hover:border-primary/20'
                      }`}
                    >
                      <span className="text-xs font-black uppercase">{v.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* SPECS RAIL */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100/50 flex items-center gap-3">
                   <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
                   <div className="flex flex-col leading-tight">
                      <span className="text-[10px] font-black uppercase text-emerald-800">Assay Verified</span>
                      <span className="text-[8px] font-bold text-emerald-600/40 uppercase">99%+ Pure</span>
                   </div>
                </div>
                <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/5 flex items-center gap-3">
                   <Truck className="w-4 h-4 text-primary/60 shrink-0" />
                   <div className="flex flex-col leading-tight">
                      <span className="text-[10px] font-black uppercase text-primary">Cold-Chain</span>
                      <span className="text-[8px] font-bold text-primary/30 uppercase">Priority</span>
                   </div>
                </div>
                <div className="p-3.5 rounded-xl bg-gray-50/80 border border-gray-100 flex items-center gap-3">
                   <Microscope className="w-4 h-4 text-primary/40 shrink-0" />
                   <div className="flex flex-col leading-tight">
                      <span className="text-[10px] font-black uppercase text-primary">GMP USA</span>
                      <span className="text-[8px] font-bold text-primary/30 uppercase">Facility</span>
                   </div>
                </div>
                <div className="p-3.5 rounded-xl bg-primary text-white flex items-center gap-3">
                   <Award className="w-4 h-4 text-white/80 shrink-0" />
                   <div className="flex flex-col leading-tight">
                      <span className="text-[10px] font-black uppercase text-white">Compliance</span>
                      <span className="text-[8px] font-bold text-white/40 uppercase">Regulatory</span>
                   </div>
                </div>
              </div>

              {/* MINI AUTHORIZATION */}
              <div className="p-3.5 rounded-lg bg-gray-950 text-white/40 flex items-center gap-3">
                 <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                 <p className="text-[10px] font-medium leading-tight">
                    Professional clinical use only. Verification required for inventory access.
                 </p>
              </div>

              {/* COA RECORDS */}
              {filteredReports.length > 0 && (
                <div className="space-y-3">
                   <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary/20">Lab Records</span>
                      <div className="h-px flex-1 bg-gray-100" />
                   </div>
                   <div className="grid grid-cols-1 gap-2">
                      {filteredReports.slice(0, 3).map((r) => (
                        <div key={r.id} className="p-3 rounded-xl bg-white border border-gray-100 flex items-center justify-between group">
                           <div className="flex flex-col gap-0.5">
                              <span className="text-[8px] font-black uppercase text-primary/20">Biospecimen CoA</span>
                              <span className="text-xs font-black text-primary truncate max-w-[140px]">{r.name}</span>
                           </div>
                           <button 
                            onClick={async () => {
                              const res = await getPublicReportDownloadUrl(r.id, 'inline');
                              if (res.success && res.data?.url) window.open(res.data.url, '_blank');
                            }}
                            className="w-7 h-7 rounded-lg bg-primary/5 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-all shadow-sm"
                           >
                              <Eye className="w-3.5 h-3.5" />
                           </button>
                        </div>
                      ))}
                   </div>
                </div>
              )}
            </div>
          </div>

          {/* ──── STICKY ACTION FOOTER ──── */}
          <div className="flex-shrink-0 p-5 border-t border-gray-100 bg-white/80 backdrop-blur-xl z-30">
             <div className="space-y-4">
               <div className="flex items-end justify-between">
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/30 leading-none">Price Execution</span>
                     <div className="mt-1 flex items-baseline gap-2">
                        {isAuthenticated ? (
                          <>
                            <span className="text-2xl font-black text-primary tracking-tighter tabular-nums">
                              ${(ui.price * (Number(vialAmount) || 1) * quantity).toFixed(2)}
                            </span>
                            {ui.originalPrice && (
                              <span className="text-xs text-primary/20 line-through tabular-nums font-bold">
                                ${(ui.originalPrice * (Number(vialAmount) || 1) * quantity).toFixed(2)}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs font-black uppercase text-primary/40 italic">Unauthorized</span>
                        )}
                     </div>
                  </div>

                  <div className="flex items-center bg-gray-50 border border-gray-100 rounded-lg p-0.5">
                     <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-8 h-8 flex items-center justify-center rounded-md bg-white text-xs font-bold shadow-xs hover:bg-gray-50">-</button>
                     <input 
                        type="number" 
                        value={quantity} 
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-10 text-center font-black text-xs text-primary bg-transparent focus:outline-none" 
                     />
                     <button onClick={() => setQuantity(q => Math.min(q + 1, ui.availableQuantity || 999))} className="w-8 h-8 flex items-center justify-center rounded-md bg-white text-xs font-bold shadow-xs hover:bg-gray-50">+</button>
                  </div>
               </div>

               <Button
                  size="sm"
                  className="w-full h-12 text-xs font-black uppercase tracking-[0.2em] rounded-xl bg-primary text-white shadow-xl shadow-primary/10 transition-all hover:-translate-y-0.5 active:scale-95"
                  disabled={!ui.inStock || !ui.currentVariantId}
                  onClick={() => {
                    if (!isAuthenticated) return openLoginModal('customer');
                    add(ui.currentVariantId!, (typeof vialAmount === 'number' ? vialAmount : 1) * quantity, ui.price)
                      .then(() => { toast.success(`Inventory Updated`); setCartOpen(true); });
                  }}
               >
                 {ui.inStock ? 'Initialize Sequence' : 'Access Restricted'}
               </Button>
             </div>
          </div>
          </>
        )}
      </main>

      <CartSidebar
        open={cartOpen}
        onOpenChange={setCartOpen}
        trigger={
          <div style={{ display: 'none' }}>
            <CartButton>Hidden Cart Trigger</CartButton>
          </div>
        }
      />

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
