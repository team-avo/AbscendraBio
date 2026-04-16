"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { api, type Product, resolveImageUrl, getPublicReportsForProduct, getPublicReportDownloadUrl, type ThirdPartyReport } from "@/lib/api";
import { useCart } from "@/contexts/cart-context";
import { useAuth } from "@/contexts/auth-context";
import { ShieldCheck, Truck, Microscope, Award, Eye, ChevronLeft, ChevronRight, Minus, Plus, ShoppingCart, Check, Lock, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Barlow } from "next/font/google";
import { CartSidebar } from "@/components/cart/CartSidebar";
import { Button as CartButton } from "@/components/ui/button";
import { BulkQuoteRequestDialog } from "@/components/products/bulk-quote-request-dialog";
import { getPricingCustomerType } from "@/utils/pricingMapper";
import logger from '@/lib/logger';

const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"] });

export default function ProductDetailView({ productId, isModal = false }: { productId: string; isModal?: boolean }) {
  const { add, items, update } = useCart();
  const { user, isAuthenticated, openLoginModal } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [heroSrc, setHeroSrc] = useState("/products/peptide-1.jpg");
  const [customerType, setCustomerType] = useState<"B2C" | "B2B" | "ENTERPRISE_1" | "ENTERPRISE_2" | undefined>(undefined);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [cartOpen, setCartOpen] = useState(false);
  const [bulkQuoteOpen, setBulkQuoteOpen] = useState(false);
  const [reports, setReports] = useState<ThirdPartyReport[]>([]);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [addingToCart, setAddingToCart] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!productId) return;
      setLoading(true);
      setError(null);

      let customerTypeValue: "B2C" | "B2B" | "ENTERPRISE_1" | "ENTERPRISE_2" | undefined = undefined;
      if (user?.customer?.customerType) customerTypeValue = user.customer.customerType;
      else if (user?.role === 'CUSTOMER') customerTypeValue = 'B2C';

      const [productRes, favsRes] = await Promise.all([
        api.getStorefrontProduct(productId),
        user?.customerId
          ? api.getFavorites(user.customerId, { page: 1, limit: 100 })
          : Promise.resolve({ success: false, data: null })
      ]);

      if (!mounted) return;
      setCustomerType(customerTypeValue);

      if (productRes.success && productRes.data) {
        setProduct(productRes.data);
        const firstVariant = productRes.data.variants?.[0];
        const variantImg = (firstVariant as any)?.images?.[0]?.url;
        const productImg = (productRes.data as any)?.images?.[0]?.url;
        setHeroSrc(resolveImageUrl(variantImg || productImg || "/products/peptide-1.jpg"));
        setSelectedVariantId(firstVariant?.id || null);
      } else {
        setError(productRes.error || "Failed to load product");
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [productId, user]);

  useEffect(() => {
    if (!productId) return;
    (async () => {
      try {
        const res = await getPublicReportsForProduct(productId);
        if (res.success && res.data) setReports(res.data);
      } catch (e) { logger.error("Failed to fetch reports", { error: e }); }
    })();
  }, [productId]);

  const ui = useMemo(() => {
    const name = product?.name || "Product";
    const category = product?.categories?.[0]?.name || "Research Peptide";
    const variants = product?.variants || [];
    const selectedVariant = variants.find(v => v.id === selectedVariantId) || variants[0];
    const toPrice = (val: any) => val === null || val === undefined ? 0 : Number(val) || 0;

    let price = 0, originalPrice: number | null = null, isBulkPrice = false;

    const bulkPrices = (selectedVariant as any)?.bulkPrices as any[] | undefined;
    if (bulkPrices?.length) {
      const match = bulkPrices.find((bp: any) => {
        const min = Number(bp.minQty), max = bp.maxQty ? Number(bp.maxQty) : Infinity;
        return quantity >= min && quantity <= max;
      });
      if (match) { price = toPrice(match.price); originalPrice = toPrice(selectedVariant?.regularPrice); isBulkPrice = true; }
    }

    if (!isBulkPrice) {
      const pricingType = getPricingCustomerType(customerType);
      const segPrices = (selectedVariant as any)?.segmentPrices as any[] | undefined;
      const seg = segPrices && pricingType ? segPrices.find((sp: any) => sp.customerType === pricingType) : null;

      if (seg) {
        const segSale = toPrice(seg.salePrice), segReg = toPrice(seg.regularPrice);
        if (segSale > 0 && segSale < segReg) { price = segSale; originalPrice = segReg; }
        else { price = segReg; originalPrice = null; }
      } else {
        const varSale = toPrice(selectedVariant?.salePrice), varReg = toPrice(selectedVariant?.regularPrice);
        if (varSale > 0 && varSale < varReg) { price = varSale; originalPrice = varReg; }
        else { price = varReg; originalPrice = null; }
      }
    }

    const availableQty = (selectedVariant?.inventory || []).reduce((t, inv) =>
      t + Math.max(0, (inv.quantity || 0) - (inv.reservedQty || 0)), 0);
    const inStock = availableQty >= quantity || (selectedVariant?.inventory || []).some((inv: any) => inv.sellWhenOutOfStock);

    return { name, category, price: Number(price), originalPrice: originalPrice != null ? Number(originalPrice) : null, isBulkPrice, inStock, variants, currentVariantId: selectedVariant?.id as string | undefined, availableQty };
  }, [product, selectedVariantId, customerType, quantity]);

  useEffect(() => {
    const v = product?.variants?.find((x) => x.id === selectedVariantId);
    const variantImg = (v as any)?.images?.[0]?.url;
    const productImg = (product as any)?.images?.[0]?.url;
    setHeroSrc(resolveImageUrl(variantImg || productImg || "/products/peptide-1.jpg"));
    setCurrentImgIndex(0);
  }, [selectedVariantId, product]);

  const filteredReports = useMemo(() => reports.filter(r => {
    return r.products?.some(p => p.id === productId) || (selectedVariantId && r.variants?.some(v => v.id === selectedVariantId));
  }), [reports, selectedVariantId, productId]);

  // Gallery images
  const galleryImgs = useMemo(() => {
    const v = product?.variants?.find((x) => x.id === selectedVariantId) || product?.variants?.[0];
    const vImgs = (v as any)?.images?.length ? (v as any).images : null;
    const pImgs = (product as any)?.images?.length ? (product as any).images : null;
    const imgs = vImgs || pImgs || [];
    return imgs.length > 0 ? imgs : [{ url: heroSrc }];
  }, [product, selectedVariantId, heroSrc]);

  // Is this variant already in cart?
  const cartItem = ui.currentVariantId ? items.find(it => it.variantId === ui.currentVariantId) : undefined;
  const currentCartQty = cartItem?.quantity || 0;

  const handleAddToCart = async () => {
    if (!isAuthenticated) { openLoginModal('customer'); return; }
    if (!ui.currentVariantId) { toast.error('Please select a variant'); return; }
    setAddingToCart(true);
    try {
      await add(ui.currentVariantId, quantity, ui.price);
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 2000);
      toast.success('Added to cart');
    } catch (e: any) {
      toast.error(e.message || 'Failed to add to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleCartQtyChange = async (newQty: number) => {
    if (!ui.currentVariantId) return;
    try { await update(ui.currentVariantId, Math.max(0, newQty)); }
    catch (e: any) { toast.error(e.message || 'Failed to update'); }
  };

  // ── Gate product detail behind login on ALL viewports (mobile + desktop) ──
  if (!isAuthenticated) {
    return (
      <div className={`${isModal ? "bg-white w-full flex flex-col" : "force-light min-h-screen bg-white"} ${barlow.className}`}>
        <div className={isModal ? "p-4" : "max-w-3xl mx-auto px-4 sm:px-6 py-10"}>
          <div className="relative bg-[#070B14] rounded-2xl overflow-hidden">
            {/* Grid texture */}
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />
            {/* Blue glow */}
            <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#4D7DF2]/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[300px] h-[180px] bg-[#3A6FA0]/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10 px-6 py-12 sm:px-10 sm:py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.08] border border-white/[0.10] flex items-center justify-center mx-auto mb-6">
                <Lock className="w-7 h-7 text-white/80" />
              </div>
              <div className="flex items-center justify-center gap-3 mb-4">
                <span className="w-8 h-[1px] bg-[#4D7DF2]/50" />
                <span className="text-[10px] font-bold tracking-[0.4em] text-[#4D7DF2] uppercase">Verified Researchers Only</span>
                <span className="w-8 h-[1px] bg-[#4D7DF2]/50" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight max-w-lg mx-auto">
                Sign in to view this peptide
              </h1>
              <p className="mt-4 text-sm sm:text-base text-white/60 max-w-md mx-auto leading-relaxed">
                Product details, pricing, and Certificates of Analysis are available to verified researchers only.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => openLoginModal?.('customer')}
                  className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-[#070B14] rounded-xl px-6 py-3 text-sm font-bold transition-all shadow-lg"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In
                </button>
                <button
                  onClick={() => openLoginModal?.('customer')}
                  className="inline-flex items-center gap-2 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.12] text-white rounded-xl px-6 py-3 text-sm font-semibold transition-all"
                >
                  Create an Account
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${isModal ? "bg-white w-full h-[85vh] max-h-[800px] flex flex-col overflow-hidden" : "force-light min-h-screen bg-white"} ${barlow.className}`}>
      <main className={isModal ? "flex-1 flex flex-col min-h-0 w-full" : "max-w-4xl mx-auto px-6 py-12"}>

        {/* Loading */}
        {loading && (
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-[#4D7DF2] animate-spin" />
              <span className="text-xs text-gray-400 font-medium">Loading product…</span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex-1 flex items-center justify-center py-20">
            <p className="text-sm text-red-500 bg-red-50 px-4 py-2 rounded-xl border border-red-100">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* ── Header ── */}
            <div className="shrink-0 px-5 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">{ui.category}</span>
                  <h1 className="text-lg font-black text-[#070B14] tracking-tight leading-tight uppercase mt-0.5 pr-2">
                    {ui.name}
                  </h1>
                </div>
                <div className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${
                  ui.inStock
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                    : 'bg-red-50 border-red-100 text-red-500'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${ui.inStock ? 'bg-emerald-500' : 'bg-red-400'}`} />
                  {ui.inStock ? 'In Stock' : 'Out of Stock'}
                </div>
              </div>
            </div>

            {/* ── Scrollable Body ── */}
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              <div className="p-5 space-y-5">

                {/* Image */}
                <div className="relative bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 aspect-[4/3] flex items-center justify-center">
                  <img
                    src={heroSrc}
                    alt={ui.name}
                    className="object-contain w-full h-full p-6 transition-all duration-500"
                    onError={() => setHeroSrc(resolveImageUrl("/products/peptide-1.jpg"))}
                  />
                  {galleryImgs.length > 1 && (
                    <>
                      <button
                        onClick={() => { const i = (currentImgIndex - 1 + galleryImgs.length) % galleryImgs.length; setCurrentImgIndex(i); setHeroSrc(resolveImageUrl(galleryImgs[i].url)); }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/90 border border-gray-100 shadow-sm flex items-center justify-center hover:bg-white transition-colors"
                      >
                        <ChevronLeft className="w-3.5 h-3.5 text-gray-600" />
                      </button>
                      <button
                        onClick={() => { const i = (currentImgIndex + 1) % galleryImgs.length; setCurrentImgIndex(i); setHeroSrc(resolveImageUrl(galleryImgs[i].url)); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/90 border border-gray-100 shadow-sm flex items-center justify-center hover:bg-white transition-colors"
                      >
                        <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                      </button>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                        {galleryImgs.map((_: any, i: number) => (
                          <button key={i} onClick={() => { setCurrentImgIndex(i); setHeroSrc(resolveImageUrl(galleryImgs[i].url)); }}
                            className={`rounded-full transition-all ${i === currentImgIndex ? 'w-3 h-1.5 bg-[#4D7DF2]' : 'w-1.5 h-1.5 bg-gray-300'}`} />
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Description */}
                {product?.description && (
                  <p className="text-sm text-gray-500 leading-relaxed">{product.description}</p>
                )}

                {/* Variant picker */}
                {ui.variants.length > 1 && (
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Size / Configuration</label>
                    <div className="flex flex-wrap gap-2">
                      {ui.variants.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => setSelectedVariantId(v.id)}
                          className={`px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-wide transition-all ${
                            selectedVariantId === v.id
                              ? 'bg-[#070B14] border-[#070B14] text-white'
                              : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
                          }`}
                        >
                          {v.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trust specs */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { icon: ShieldCheck, label: '99%+ Purity', sub: 'HPLC verified', color: 'emerald' },
                    { icon: Truck, label: 'Cold Chain', sub: 'Priority shipping', color: 'blue' },
                    { icon: Microscope, label: 'GMP Facility', sub: 'USA certified', color: 'gray' },
                    { icon: Award, label: 'COA Included', sub: 'Every batch', color: 'dark' },
                  ].map(({ icon: Icon, label, sub, color }) => (
                    <div key={label} className={`p-3 rounded-xl flex items-center gap-2.5 ${
                      color === 'emerald' ? 'bg-emerald-50 border border-emerald-100' :
                      color === 'blue' ? 'bg-blue-50 border border-blue-100' :
                      color === 'dark' ? 'bg-[#070B14] border border-[#070B14]' :
                      'bg-gray-50 border border-gray-100'
                    }`}>
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${
                        color === 'emerald' ? 'text-emerald-600' :
                        color === 'blue' ? 'text-blue-500' :
                        color === 'dark' ? 'text-white/70' :
                        'text-gray-400'
                      }`} />
                      <div>
                        <p className={`text-[10px] font-black uppercase ${color === 'dark' ? 'text-white' : 'text-[#070B14]'}`}>{label}</p>
                        <p className={`text-[9px] ${color === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>{sub}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Lab reports */}
                {filteredReports.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Lab Reports (COA)</p>
                    <div className="space-y-1.5">
                      {filteredReports.slice(0, 3).map((r) => (
                        <div key={r.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100">
                          <div>
                            <p className="text-xs font-bold text-[#070B14] truncate max-w-[180px]">{r.name}</p>
                            <p className="text-[9px] text-gray-400">Certificate of Analysis</p>
                          </div>
                          <button
                            onClick={async () => {
                              const res = await getPublicReportDownloadUrl(r.id, 'inline');
                              if (res.success && res.data?.url) window.open(res.data.url, '_blank');
                            }}
                            className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-[#4D7DF2] hover:text-white text-gray-500 transition-all"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Sticky Footer ── */}
            <div className="shrink-0 px-5 py-4 border-t border-gray-100 bg-white space-y-3">

              {/* Price + Qty row */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-0.5">Price</p>
                  {isAuthenticated ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-[#070B14] tabular-nums">
                        ${(ui.price * quantity).toFixed(2)}
                      </span>
                      {ui.originalPrice && (
                        <span className="text-xs text-gray-300 line-through tabular-nums">
                          ${(ui.originalPrice * quantity).toFixed(2)}
                        </span>
                      )}
                      {ui.isBulkPrice && (
                        <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                          Bulk
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm font-bold text-gray-400">Sign in to see price</p>
                  )}
                </div>

                {/* Quantity stepper */}
                <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-0.5">
                  <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center hover:bg-gray-50 transition-colors">
                    <Minus className="w-3 h-3 text-gray-600" />
                  </button>
                  <span className="w-8 text-center text-sm font-black text-[#070B14]">{quantity}</span>
                  <button onClick={() => setQuantity(q => Math.min(q + 1, ui.availableQty || 999))} className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center hover:bg-gray-50 transition-colors">
                    <Plus className="w-3 h-3 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* CTA button — or qty controls if already in cart */}
              {currentCartQty > 0 ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 flex-1 bg-[#070B14] rounded-2xl p-1">
                    <button onClick={() => handleCartQtyChange(currentCartQty - 1)} className="flex-1 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                      <Minus className="w-3.5 h-3.5 text-white" />
                    </button>
                    <span className="flex-1 text-center text-sm font-black text-white">{currentCartQty} in cart</span>
                    <button onClick={() => handleCartQtyChange(currentCartQty + 1)} className="flex-1 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                      <Plus className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                </div>
              ) : (
                <Button
                  className={`w-full h-12 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all ${
                    justAdded
                      ? 'bg-emerald-500 hover:bg-emerald-500 text-white'
                      : 'bg-[#070B14] hover:bg-[#1a2540] text-white'
                  }`}
                  disabled={!ui.inStock || !ui.currentVariantId || addingToCart}
                  onClick={handleAddToCart}
                >
                  {addingToCart ? (
                    <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin" />Adding…</span>
                  ) : justAdded ? (
                    <span className="flex items-center gap-2"><Check className="w-4 h-4" />Added to Cart</span>
                  ) : !ui.inStock ? (
                    'Out of Stock'
                  ) : !isAuthenticated ? (
                    <span className="flex items-center gap-2"><ShoppingCart className="w-4 h-4" />Sign in to Buy</span>
                  ) : (
                    <span className="flex items-center gap-2"><ShoppingCart className="w-4 h-4" />Add to Cart</span>
                  )}
                </Button>
              )}
            </div>
          </>
        )}
      </main>

      <CartSidebar
        open={cartOpen}
        onOpenChange={setCartOpen}
        trigger={<div style={{ display: 'none' }}><CartButton>Cart</CartButton></div>}
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
