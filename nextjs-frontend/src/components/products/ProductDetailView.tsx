"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { api, type Product, resolveImageUrl, getPublicReportsForProduct, getPublicReportDownloadUrl, type ThirdPartyReport } from "@/lib/api";
import { useCart } from "@/contexts/cart-context";
import { useAuth } from "@/contexts/auth-context";
import { ShieldCheck, Truck, Microscope, Award, Eye, ChevronLeft, ChevronRight, Minus, Plus, ShoppingCart, Check, Lock, LogIn, FlaskConical, Dna, ArrowRight } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Barlow } from "next/font/google";
import { CartSidebar } from "@/components/cart/CartSidebar";
import { BULK_TIERS, bulkTierForQty, isRetailPricing, bulkTierRangeLabel } from "@/lib/bulkTiers";
import { Button as CartButton } from "@/components/ui/button";
import { BulkQuoteRequestDialog } from "@/components/products/bulk-quote-request-dialog";
import { getPricingCustomerType } from "@/utils/pricingMapper";
import logger from '@/lib/logger';

const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"] });

const SCIENTIFIC_PROFILES: Record<string, { overview: string; applications: string[]; mechanism: string }> = {
  "BPC-157": {
    overview: "BPC-157 is a 15-amino acid peptide derived from a protective gastric juice protein. It is among the most studied tissue-repair peptides due to its broad regenerative activity across multiple tissue types.",
    applications: ["Tendon and ligament repair research", "Gastrointestinal mucosal healing", "Angiogenesis and wound healing studies", "Nitric oxide pathway modulation"],
    mechanism: "Activates the FAK-paxillin pathway to accelerate fibroblast migration. Upregulates VEGF expression and promotes collagen synthesis without systemic GH axis involvement.",
  },
  "CJC-1295 + Ipamorelin": {
    overview: "A synergistic combination of CJC-1295 (GHRH analogue) and Ipamorelin (selective GHRP). Used in growth hormone secretagogue research for its clean, sustained GH pulse profile.",
    applications: ["Growth hormone stimulation studies", "Metabolic rate and body composition research", "Sleep architecture and recovery research", "Age-related GH decline models"],
    mechanism: "CJC-1295 extends GHRH receptor activation; Ipamorelin selectively stimulates pituitary GH release via ghrelin receptors without cortisol or prolactin elevation.",
  },
  "AOD-9604": {
    overview: "AOD-9604 is a modified fragment (176-191) of human growth hormone. It retains the lipolytic activity of hGH without binding to IGF-1 receptors, making it a clean research tool for adipose metabolism.",
    applications: ["Lipolysis and fat metabolism research", "Adipocyte differentiation studies", "Metabolic syndrome model research", "Non-diabetogenic GH fragment studies"],
    mechanism: "Stimulates lipolysis and inhibits lipogenesis via beta-3 adrenergic receptors. Does not bind GH receptor or stimulate IGF-1 secretion, isolating the fat-metabolism pathway.",
  },
  "Cerebrolysin": {
    overview: "Cerebrolysin is a neuropeptide complex containing BDNF, NGF, GDNF, and CNTF fragments. It is one of the most studied neuroprotective agents in models of Alzheimer's, TBI, and stroke.",
    applications: ["Neurodegenerative disease models (Alzheimer's, Parkinson's)", "Traumatic brain injury recovery research", "Ischemic stroke neuroprotection studies", "Cognitive function and neuroplasticity research"],
    mechanism: "Delivers neurotrophic factors across the blood-brain barrier. Reduces amyloid precursor protein processing and tau hyperphosphorylation while enhancing synaptic density and neurogenesis.",
  },
  "CJC-1295 (DAC)": {
    overview: "CJC-1295 with Drug Affinity Complex (DAC) modification binds to albumin in plasma, dramatically extending its half-life to 6-8 days. Used in long-duration GH stimulation research protocols.",
    applications: ["Extended GH pulse studies", "Long-duration anabolic signaling research", "Pituitary function and GHRH sensitivity studies", "Lean mass accretion models"],
    mechanism: "The DAC modification creates an albumin-reactive maleimidoproprionic acid group, enabling sustained GHRH receptor activation and prolonged downstream GH secretion.",
  },
  "Epithalon": {
    overview: "Epithalon (Ala-Glu-Asp-Gly) is a synthetic tetrapeptide based on Epithalamin. It is the leading research compound for telomerase activation and longevity-associated pineal gland function.",
    applications: ["Telomerase activation and telomere length research", "Pineal gland function and melatonin regulation", "Circadian rhythm modulation studies", "Aging biology and senescence models"],
    mechanism: "Activates telomerase enzyme to elongate telomeres in somatic cells. Regulates the pineal gland's synthesis of melatonin and modulates HPA axis function in aged subjects.",
  },
  "Cagrilintide": {
    overview: "Cagrilintide is a long-acting amylin analogue with a 7-day half-life. It is under active investigation as a combination partner with semaglutide (CagriSema) for its complementary satiety signaling.",
    applications: ["Amylin receptor agonism studies", "Appetite and satiety signaling research", "GLP-1 / amylin combination therapy models", "Insulin secretion modulation research"],
    mechanism: "Acts on amylin receptors (AMY1-3) in the area postrema to reduce food intake, slow gastric emptying, and suppress glucagon. Synergistic with GLP-1 agonists via distinct receptor pathways.",
  },
};

const RELATED_PRODUCTS: Record<string, string[]> = {
  "BPC-157": ["CJC-1295 + Ipamorelin", "Epithalon", "AOD-9604"],
  "CJC-1295 + Ipamorelin": ["CJC-1295 (DAC)", "AOD-9604", "Epithalon"],
  "AOD-9604": ["CJC-1295 + Ipamorelin", "Cagrilintide", "BPC-157"],
  "Cerebrolysin": ["BPC-157", "Epithalon", "CJC-1295 + Ipamorelin"],
  "CJC-1295 (DAC)": ["CJC-1295 + Ipamorelin", "Epithalon", "AOD-9604"],
  "Epithalon": ["CJC-1295 + Ipamorelin", "BPC-157", "Cerebrolysin"],
  "Cagrilintide": ["AOD-9604", "CJC-1295 + Ipamorelin", "BPC-157"],
};

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
  const [relatedProducts, setRelatedProducts] = useState<Array<{ id: string; name: string; images?: any[] }>>([]);
  const [sciProfileOpen, setSciProfileOpen] = useState(false);

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
        const prod = productRes.data;
        setProduct(prod);
        const firstVariant = prod.variants?.[0];
        const variantImg = (firstVariant as any)?.images?.[0]?.url;
        const productImg = (prod as any)?.images?.[0]?.url;
        setHeroSrc(resolveImageUrl(variantImg || productImg || "/products/peptide-1.jpg"));
        setSelectedVariantId(firstVariant?.id || null);

        // Load related products
        const relatedNames = RELATED_PRODUCTS[prod.name] || [];
        if (relatedNames.length > 0) {
          try {
            const allRes = await api.getStorefrontProducts({ limit: 20 });
            if (allRes.success && allRes.data) {
              const all = allRes.data.products || [];
              const matched = all.filter((p: any) => relatedNames.includes(p.name));
              setRelatedProducts(matched.slice(0, 3));
            }
          } catch (e) { logger.error("Failed to load related products", { error: e }); }
        }
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
      if (isRetailPricing(pricingType)) {
        // Public retail bulk-quantity discount: off the regular listed price,
        // banded by the selected quantity. Separate from wholesale pricing.
        const varReg = toPrice(selectedVariant?.regularPrice);
        const tier = bulkTierForQty(quantity);
        price = varReg * (1 - tier.discount);
        originalPrice = tier.discount > 0 ? varReg : null;
        isBulkPrice = tier.discount > 0;
      } else {
        // Enterprise/wholesale segment pricing (unchanged).
        const segPrices = (selectedVariant as any)?.segmentPrices as any[] | undefined;
        const seg = segPrices ? segPrices.find((sp: any) => sp.customerType === pricingType) : null;
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
          <div className="relative bg-[#043061] rounded-2xl overflow-hidden">
            {/* Grid texture */}
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />
            {/* Blue glow */}
            <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#5A9ADA]/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[300px] h-[180px] bg-[#5A9ADA]/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10 px-6 py-12 sm:px-10 sm:py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.08] border border-white/[0.10] flex items-center justify-center mx-auto mb-6">
                <Lock className="w-7 h-7 text-white/80" />
              </div>
              <div className="flex items-center justify-center gap-3 mb-4">
                <span className="w-8 h-[1px] bg-[#5A9ADA]/50" />
                <span className="text-[10px] font-bold tracking-[0.4em] text-[#5A9ADA] uppercase">Verified Researchers Only</span>
                <span className="w-8 h-[1px] bg-[#5A9ADA]/50" />
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
                  className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-[#043061] rounded-xl px-6 py-3 text-sm font-bold transition-all shadow-lg"
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
      <main className={isModal ? "flex-1 flex flex-col min-h-0 w-full" : "max-w-6xl mx-auto px-4 sm:px-6 py-10"}>

        {/* Loading */}
        {loading && (
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-[#5A9ADA] animate-spin" />
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

        {!loading && !error && (() => {
          const header = (
            <div className="shrink-0 px-5 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">{ui.category}</span>
                  <h1 className="text-lg font-black text-[#043061] tracking-tight leading-tight uppercase mt-0.5 pr-2">
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
          );

          const imageBlock = (
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
                        className={`rounded-full transition-all ${i === currentImgIndex ? 'w-3 h-1.5 bg-[#5A9ADA]' : 'w-1.5 h-1.5 bg-gray-300'}`} />
                    ))}
                  </div>
                </>
              )}
            </div>
          );

          const descriptionBlock = product?.description ? (
            <p className="text-sm text-gray-500 leading-relaxed">{product.description}</p>
          ) : null;

          const variantPicker = ui.variants.length > 1 ? (
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Size / Configuration</label>
              <div className="flex flex-wrap gap-2">
                {ui.variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariantId(v.id)}
                    className={`px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-wide transition-all ${
                      selectedVariantId === v.id
                        ? 'bg-[#043061] border-[#043061] text-white'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
                    }`}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null;

          // Unified feature cards: one base color, steel-blue icons, soft blue-tint hover
          const featureCards = (
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: ShieldCheck, label: '99%+ Purity', sub: 'HPLC verified' },
                { icon: Truck, label: 'Cold Chain', sub: 'Priority shipping' },
                { icon: Microscope, label: 'GMP Facility', sub: 'USA certified' },
                { icon: Award, label: 'COA Included', sub: 'Every batch' },
              ].map(({ icon: Icon, label, sub }) => (
                <div key={label} className="p-3 rounded-xl flex items-center gap-2.5 bg-slate-50 border border-slate-100 transition-colors hover:bg-[#043061]/[0.04] hover:border-[#043061]/20">
                  <Icon className="w-3.5 h-3.5 shrink-0 text-[#5A9ADA]" />
                  <div>
                    <p className="text-[10px] font-black uppercase text-[#043061]">{label}</p>
                    <p className="text-[9px] text-gray-400">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          );

          const labReportsBlock = filteredReports.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Lab Reports (COA)</p>
              <div className="space-y-1.5">
                {filteredReports.slice(0, 3).map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100">
                    <div>
                      <p className="text-xs font-bold text-[#043061] truncate max-w-[180px]">{r.name}</p>
                      <p className="text-[9px] text-gray-400">Certificate of Analysis</p>
                    </div>
                    <button
                      onClick={async () => {
                        const res = await getPublicReportDownloadUrl(r.id, 'inline');
                        if (res.success && res.data?.url) window.open(res.data.url, '_blank');
                      }}
                      className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-[#5A9ADA] hover:text-white text-gray-500 transition-all"
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null;

          const sciProfileBlock = (product?.name && SCIENTIFIC_PROFILES[product.name]) ? (() => {
            const profile = SCIENTIFIC_PROFILES[product.name];
            return (
              <div className="rounded-2xl border border-gray-100 overflow-hidden">
                <button
                  onClick={() => setSciProfileOpen(o => !o)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-[#F9FBFF] hover:bg-[#F0F5FF] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FlaskConical className="w-3.5 h-3.5 text-[#5A9ADA]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#043061]">Scientific Profile</span>
                  </div>
                  <span className="text-[10px] text-gray-400">{sciProfileOpen ? '▲' : '▼'}</span>
                </button>
                {sciProfileOpen && (
                  <div className="px-4 py-4 space-y-3 bg-white">
                    <p className="text-xs text-gray-600 leading-relaxed">{profile.overview}</p>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Mechanism</p>
                      <p className="text-xs text-gray-500 leading-relaxed">{profile.mechanism}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Research Applications</p>
                      <ul className="space-y-1">
                        {profile.applications.map((app, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-gray-500">
                            <span className="text-[#5A9ADA] mt-0.5 shrink-0">·</span>
                            {app}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })() : null;

          const relatedBlock = relatedProducts.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Dna className="w-3 h-3 text-gray-400" />
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Frequently Paired With</p>
              </div>
              <div className="grid gap-2">
                {relatedProducts.map((rp) => {
                  const img = (rp as any).images?.[0]?.url;
                  return (
                    <Link
                      key={rp.id}
                      href={`/landing/products/${rp.id}`}
                      className="flex items-center gap-3 p-3 bg-[#F9FBFF] hover:bg-[#F0F5FF] rounded-xl border border-gray-100 transition-colors group"
                    >
                      {img && (
                        <div className="w-8 h-8 rounded-lg overflow-hidden bg-white border border-gray-100 shrink-0">
                          <img src={resolveImageUrl(img)} alt={rp.name} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <span className="text-xs font-bold text-[#043061] flex-1 truncate">{rp.name}</span>
                      <ArrowRight className="w-3 h-3 text-gray-300 group-hover:text-[#5A9ADA] transition-colors shrink-0" />
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null;

          const pricingBlock = (
            <div className="space-y-3">
              {/* Price + Qty row */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-0.5">Price</p>
                  {isAuthenticated ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-[#043061] tabular-nums">
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
                  <span className="w-8 text-center text-sm font-black text-[#043061]">{quantity}</span>
                  <button onClick={() => setQuantity(q => Math.min(q + 1, ui.availableQty || 999))} className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center hover:bg-gray-50 transition-colors">
                    <Plus className="w-3 h-3 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Public bulk-quantity discount tiers (per item, off list price) */}
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Buy more, save more · per item</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {BULK_TIERS.map((t) => {
                    const active = quantity >= t.min && (t.max == null || quantity <= t.max);
                    return (
                      <div
                        key={t.min}
                        className={`rounded-lg px-2 py-1.5 text-center border ${active ? "border-emerald-300 bg-emerald-50" : "border-gray-200 bg-white"}`}
                      >
                        <div className="text-[11px] font-black text-[#043061] tabular-nums">{bulkTierRangeLabel(t)}</div>
                        <div className={`text-[10px] font-bold ${t.discount > 0 ? "text-emerald-600" : "text-gray-400"}`}>
                          {t.discount > 0 ? `${Math.round(t.discount * 100)}% off` : "Regular"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CTA button — or qty controls if already in cart */}
              {currentCartQty > 0 ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 flex-1 bg-[#043061] rounded-2xl p-1">
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
                      : 'bg-[#043061] hover:bg-[#0b4f96] text-white'
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
          );

          // MODAL (quick view): keep the compact stacked layout with a sticky footer.
          if (isModal) {
            return (
              <>
                {header}
                <div className="flex-1 overflow-y-auto scrollbar-hide">
                  <div className="p-5 space-y-5">
                    {imageBlock}
                    {descriptionBlock}
                    {variantPicker}
                    {featureCards}
                    {labReportsBlock}
                    {sciProfileBlock}
                    {relatedBlock}
                  </div>
                </div>
                <div className="shrink-0 px-5 py-4 border-t border-gray-100 bg-white">
                  {pricingBlock}
                </div>
              </>
            );
          }

          // FULL PAGE: peptide image on the left; containers then pricing on the right.
          return (
            <>
              {header}
              <div className="px-5 py-6 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-8 items-start">
                <div className="lg:sticky lg:top-24">
                  {imageBlock}
                </div>
                <div className="space-y-5">
                  {variantPicker}
                  {featureCards}
                  <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                    {pricingBlock}
                  </div>
                </div>
              </div>
              <div className="px-5 pb-10 space-y-5 max-w-3xl">
                {descriptionBlock}
                {labReportsBlock}
                {sciProfileBlock}
                {relatedBlock}
              </div>
            </>
          );
        })()}
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
