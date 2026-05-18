"use client";

import { useAuth } from "@/contexts/auth-context";
import { useCart } from "@/contexts/cart-context";
import { useEffect, useMemo, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { resolveImageUrl } from "@/lib/api";
import { api, type Address } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Minus, Plus, X, Copy, Check, Tag, MapPin, Pencil, Loader2 } from "lucide-react";
import { Country, State } from "country-state-city";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Promotion } from "@/lib/api";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logger from '@/lib/logger';

export default function CheckoutItemsPage() {
  const { isAuthenticated, hasRole, user, isLoading: authLoading } = useAuth();
  const { items, subtotal, discount, total, loading: cartLoading, refresh, update, remove } = useCart();
  const router = useRouter();
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [billingId, setBillingId] = useState<string>("");
  const [shippingId, setShippingId] = useState<string>("");
  const [shippingRate, setShippingRate] = useState<{ finalRate: number; reason?: string } | null>(null);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [productTaxAmount, setProductTaxAmount] = useState<number>(0);
  const [countryTaxAmount, setCountryTaxAmount] = useState<number>(0);
  const [shippingComputed, setShippingComputed] = useState(false);
  const [taxComputed, setTaxComputed] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  // Coupons state
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [couponCode, setCouponCode] = useState<string>("");
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [couponLoading, setCouponLoading] = useState(false);
  const [selectedShippingRate, setSelectedShippingRate] = useState<any>(null);
  const selectedRateRef = useRef<any>(null);

  // Sync ref with state for use in focus listeners/async calls
  useEffect(() => {
    selectedRateRef.current = selectedShippingRate;
  }, [selectedShippingRate]);
  const [autoShippingRates, setAutoShippingRates] = useState<any[]>([]);
  const [shippingRatesLoading, setShippingRatesLoading] = useState(false);
  const [customRates, setCustomRates] = useState<any[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsError, setShowTermsError] = useState(false);
  const [couponCopied, setCouponCopied] = useState(false);

  const addressSectionRef = useRef<HTMLDivElement | null>(null);

  const handleScrollToAddress = () => {
    if (addressSectionRef.current) {
      addressSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      const el = document.getElementById("address-summary-section");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };


  // Auto-calculate shipping rates when addresses are available
  const calculateAutoShippingRates = async () => {
    if (!addresses.length || !shippingId || !items.length) return;

    const shippingAddress = addresses.find(a => a.id === shippingId);
    if (!shippingAddress) return;

    setShippingRatesLoading(true);
    try {
      logger.info('Calculating warehouse-based shipping rates for address:', { data: shippingAddress });

      // Use the new warehouse-based shipping calculation
      const itemsForShipping = items.map(item => ({
        variantId: item.variant?.id || '',
        quantity: item.quantity
      })).filter(item => item.variantId); // Filter out items without variant

      // Calculate weight (assuming 1 lb per item, convert to ounces)
      const weightOz = items.reduce((sum, item) => sum + (item.quantity * 16), 0);

      const response = await api.calculateCheckoutShippingRates({
        customerAddressId: shippingId,
        items: itemsForShipping,
        weightOz: weightOz,
        dimensions: {
          length: 10,
          width: 8,
          height: 6
        },
        shipFrom: {
          address_line1: "123 Warehouse St",
          city_locality: "Los Angeles",
          state_province: "CA",
          postal_code: "90210",
          country_code: "US"
        }
      });

      logger.info('Warehouse-based shipping response:', { data: response });

      if (!response.success) {
        logger.error('API Error:', { error: response.error, response });
        toast.error(response.error || 'Failed to calculate shipping rates');
        setAutoShippingRates([]);
        setSelectedShippingRate(null);
        setShippingRate(null);
        setShippingRatesLoading(false);
        return;
      }

      if (response.success && response.data) {
        const { warehouse, shippingRate, stockAvailable } = response.data;

        // Set the warehouse information
        logger.info('Selected warehouse:', { data: warehouse.name, distance: response.data.distance });

        // Set shipping rates
        if (shippingRate.allRates && shippingRate.allRates.length > 0) {
          setAutoShippingRates(shippingRate.allRates);
          setSelectedShippingRate(shippingRate.allRates[0]); // Select cheapest rate
        } else {
          // Fallback to single rate
          const fallbackRate = {
            rate: shippingRate.rate,
            carrier: shippingRate.carrier,
            service: shippingRate.service || 'ground',
            estimatedDays: shippingRate.estimatedDays,
            rateId: shippingRate.shipstationRateId || 'fallback'
          };
          setAutoShippingRates([fallbackRate]);
          setSelectedShippingRate(fallbackRate);
        }

        // Update shipping rate for order calculation
        setShippingRate({
          finalRate: shippingRate.rate,
          reason: `${shippingRate.carrier} from ${warehouse.name}`
        });

        if (!stockAvailable) {
          logger.warn('Some items may not be available in the selected warehouse');
        }
      } else {
        logger.error('Failed to calculate warehouse-based shipping rates:', { error: response.error });
        // Show error message instead of fallback
        setAutoShippingRates([]);
        setSelectedShippingRate(null);
        setShippingRate(null);
        toast.error('Unable to calculate shipping rates. Please try again or contact support.');
      }
    } catch (error) {
      logger.error('Error calculating warehouse-based shipping rates:', { error: error });
      // Show error message instead of fallback
      setAutoShippingRates([]);
      setSelectedShippingRate(null);
      setShippingRate(null);
      toast.error('Unable to calculate shipping rates. Please try again or contact support.');
    } finally {
      setShippingRatesLoading(false);
    }
  };


  function scrollItems(direction: 'left' | 'right') {
    const node = scrollerRef.current;
    if (!node) return;
    const scrollAmount = Math.min(360, node.clientWidth * 0.9);
    node.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
  }

  async function changeQuantity(variantId: string, nextQty: number) {
    if (nextQty < 1) return;
    await update(variantId, nextQty);
    await refresh();
  }

  async function removeItem(variantId: string) {
    await remove(variantId);
    await refresh();
  }

  const canCheckout = isAuthenticated && user?.role === 'CUSTOMER' && user.customerId && items.length > 0;

  // Refresh cart on page load to ensure pricing is up-to-date
  useEffect(() => {
    if (authLoading || cartLoading) return; // wait for hydration
    if (!isAuthenticated) {
      router.replace('/landing/products');
    } else if (canCheckout) {
      refresh();
    }
  }, [isAuthenticated, authLoading, cartLoading, canCheckout, refresh, router]);

  // Validate stock on mount
  useEffect(() => {
    if (!isAuthenticated || !user?.customerId) return;
    (async () => {
      try {
        const res = await api.validateCartStock();
        if (res.success && res.data && res.data.removedItems && res.data.removedItems.length > 0) {
          const removed = res.data.removedItems as Array<{ productName: string; variantName: string }>;
          const names = removed.map(i => `${i.productName}${i.variantName ? ` (${i.variantName})` : ''}`).join(', ');
          toast.warning(`Removed out-of-stock items: ${names}`);
          await refresh();
          if (items.length === 0) router.replace('/landing/products');
        }
      } catch (err) {
        logger.error('Failed to validate cart stock:', { error: err });
      }
    })();
  }, [isAuthenticated, user?.customerId]);

  // Load customer addresses
  useEffect(() => {
    (async () => {
      if (!canCheckout) return;
      const res = await api.getCustomer(user!.customerId!);
      if (res.success && res.data) {
        const list = res.data.addresses || [];
        setAddresses(list);

        // Prioritize sessionStorage over defaults
        const storedBillingId = typeof window !== 'undefined' ? sessionStorage.getItem('checkout_billingId') : null;
        const storedShippingId = typeof window !== 'undefined' ? sessionStorage.getItem('checkout_shippingId') : null;

        // Use stored IDs if they exist and are valid, otherwise fall back to default
        if (storedBillingId && storedBillingId !== 'new' && list.find(a => a.id === storedBillingId)) {
          setBillingId(storedBillingId);
        } else {
          const def = list.find(a => a.isDefault) || list[0];
          if (def) setBillingId(def.id);
        }

        if (storedShippingId && storedShippingId !== 'new' && list.find(a => a.id === storedShippingId)) {
          setShippingId(storedShippingId);
        } else {
          const def = list.find(a => a.isDefault) || list[0];
          if (def) setShippingId(def.id);
        }
      }
    })();
  }, [canCheckout, user]);

  // Disable auto shipping rates API for now
  // useEffect(() => {
  //   if (addresses.length > 0 && shippingId) {
  //     calculateAutoShippingRates();
  //   }
  // }, [addresses, shippingId, items]);

  // Calculate applicable shipping options based on subtotal (Refetched for freshness)
  const fetchTiers = async () => {
    try {
      // Always fetch fresh tiers from the API
      const res = await api.getPublicShippingTiers();
      const tiers = (res.success && res.data) ? res.data : [];

      // 2. Dynamic Tiers from DB
      const applicableTiers = tiers.filter((tier: any) => {
        const min = Number(tier.minSubtotal);
        const max = tier.maxSubtotal ? Number(tier.maxSubtotal) : Infinity;
        return subtotal >= min && subtotal < max;
      });

      let opts: any[] = [];

      if (applicableTiers.length > 0) {
        // Create a list of dynamic options
        const dynamicOpts = applicableTiers.map((tier: any) => ({
          serviceName: tier.name,
          serviceCode: tier.serviceName || `TIER_${tier.id}`,
          rate: Number(tier.shippingRate)
        }));

        // Merge: Dynamic tiers override base options
        dynamicOpts.forEach((dot: any) => {
          const idx = opts.findIndex(o => o.serviceCode === dot.serviceCode);
          if (idx > -1) {
            opts[idx] = dot;
          } else {
            opts.unshift(dot);
          }
        });
      }

      setCustomRates(opts);

      // Auto-select cheapest if available
      if (opts.length > 0) {
        // Use ref instead of captured state to avoid stale closure issues
        const prevSelection = selectedRateRef.current;
        const stillAvailable = prevSelection ? opts.find(o => o.serviceCode === prevSelection.serviceCode) : null;

        if (stillAvailable) {
          setSelectedShippingRate(stillAvailable);
          setShippingRate({ finalRate: stillAvailable.rate, reason: stillAvailable.serviceName });
        } else {
          const cheapest = opts.reduce((min, r) => (r.rate < min.rate ? r : min), opts[0]);
          setSelectedShippingRate(cheapest);
          setShippingRate({ finalRate: cheapest.rate, reason: cheapest.serviceName });
        }
        setShippingComputed(true);
      } else {
        setSelectedShippingRate(null);
        setShippingRate({ finalRate: 0, reason: 'No applicable shipping method' });
        setShippingComputed(true);
      }
    } catch (err) {
      logger.error('Error in shipping calculation:', { error: err });
    }
  };

  useEffect(() => {
    fetchTiers();

    // Re-verify when tab becomes active to catch admin changes
    const onFocus = () => fetchTiers();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [subtotal, user?.customerId]); // Re-run when subtotal or customer changes

  // Load active promotions for dropdown
  useEffect(() => {
    (async () => {
      try {
        if (!user?.customerId) {
          setPromotions([]);
          return;
        }
        const res = await api.getPromotions({ isActive: true });
        if (res.success && res.data) {
          const list = Array.isArray(res.data) ? res.data : (res.data as any).data || [];

          // Filter to only coupons that apply to current items and are valid for the user
          const orderItems = items.map(it => ({ variantId: it.variantId, quantity: it.quantity, unitPrice: Number(it.unitPrice || 0) }));

          const withDiscount = await Promise.all(list.map(async (p: Promotion) => {
            // Robust Filtering Logic
            const hasRestrictions = p.specificCustomers && p.specificCustomers.length > 0;
            const myId = user?.customerId;
            const isAssignedToMe = hasRestrictions && myId && p.specificCustomers!.some(sc => sc.customerId === myId);

            // Case A: Has Specific Customers List (Implicitly Private)
            if (hasRestrictions) {
              if (!isAssignedToMe) return null; // Not for me
            }
            // Case B: No List, but Marked Private
            else if (p.isForIndividualCustomer) {
              return null; // Private but list empty (or strictly private). Hide from general view.
            }
            // Case C: Public (No list, Not Private) -> Allowed

            try {
              const r = await api.calculatePromotionDiscount({
                promotionCode: p.code,
                orderItems,
                customerId: user?.customerId || undefined,
                subtotal,
                shippingAmount: 0
              });

              const d = r.success && r.data ? Number(r.data.discount || 0) : 0;
              // Only include coupons that actually provide a discount (validates eligibility)
              return d > 0 ? p : null;
            } catch { return null; }
          }));

          // Sort coupons: customer-specific first, then public
          const filteredCoupons = withDiscount.filter(Boolean) as Promotion[];
          const sorted = filteredCoupons.sort((a, b) => {
            const aIsCustomerSpecific = a.isForIndividualCustomer ? 1 : 0;
            const bIsCustomerSpecific = b.isForIndividualCustomer ? 1 : 0;
            return bIsCustomerSpecific - aIsCustomerSpecific;
          });

          setPromotions(sorted);
        }
      } catch (e) {
        logger.error('Error loading promotions:', { error: e });
        setPromotions([]);
      }
    })();
  }, [items, subtotal, user?.customerId]);

  // Compute tax when shipping address or cart changes (shipping via custom options)
  useEffect(() => {
    (async () => {
      // Keep current shipping selection; do not fetch shipping by API
      setTaxAmount(0);
      setProductTaxAmount(0);
      setCountryTaxAmount(0);
      setShippingComputed(true);
      setTaxComputed(false);
      if (!shippingId) return;
      const addr = addresses.find(a => a.id === shippingId);
      if (!addr) return;
      // Resolve ISO codes for country/state for backend lookups
      const countryCode = Country.getAllCountries().find(c => c.name === addr.country)?.isoCode || addr.country;
      const stateCode = countryCode ? (State.getStatesOfCountry(countryCode).find(s => s.name === addr.state)?.isoCode || addr.state) : addr.state;

      // Country/state tax rate
      const taxRes = await api.getApplicableTaxRate(countryCode, stateCode);
      const countryRate = taxRes.success && taxRes.data?.rate ? Number(taxRes.data.rate) : 0;
      const shippingFee = selectedShippingRate?.rate || shippingRate?.finalRate || 0;

      // Additional per-item product tax (variant-level taxPercentage) added on top of country tax
      const productTax = items.reduce((sum, it) => {
        const tp = Number((it.variant as any)?.taxPercentage || 0);
        const line = Number(it.unitPrice || 0) * it.quantity;
        return sum + (tp > 0 ? (line * (tp / 100)) : 0);
      }, 0);

      // Country tax computed on subtotal - discount + shipping
      const taxableBase = Math.max(0, subtotal - discountAmount) + shippingFee;
      const countryTax = (taxableBase) * (countryRate / 100);

      setProductTaxAmount(Number(productTax.toFixed(2)));
      setCountryTaxAmount(Number(countryTax.toFixed(2)));
      setTaxAmount(Number((countryTax + productTax).toFixed(2)));
      setTaxComputed(true);
    })();
  }, [shippingId, addresses, subtotal, discountAmount, selectedShippingRate, shippingRate?.finalRate]);

  // Calculate coupon discount when selection changes
  useEffect(() => {
    (async () => {
      if (!couponCode) {
        setDiscountAmount(0);
        return;
      }
      setCouponLoading(true);
      try {
        const orderItems = items.map(it => ({ variantId: it.variantId, quantity: it.quantity, unitPrice: Number(it.unitPrice || 0) }));
        const res = await api.calculatePromotionDiscount({
          promotionCode: couponCode,
          orderItems,
          customerId: user?.customerId || undefined,
          subtotal,
          shippingAmount: shippingRate?.finalRate ?? 0,
        });
        if (res.success && res.data) {
          const discount = Number((res.data.discount || 0).toFixed(2));
          setDiscountAmount(discount);
          logger.info('Coupon discount calculated:', { data: { couponCode, discount } });
        } else {
          logger.warn('Failed to calculate coupon discount:', { warning: res.error });
          setDiscountAmount(0);
          if (res.error) {
            toast.error(res.error);
          }
        }
      } catch (error) {
        logger.error('Error calculating coupon discount:', { error: error });
        setDiscountAmount(0);
      } finally {
        setCouponLoading(false);
      }
    })();
  }, [couponCode, items, subtotal, shippingRate?.finalRate, user?.customerId]);

  const finalTotal = useMemo(() => {
    const shippingCost = selectedShippingRate?.rate || shippingRate?.finalRate || 0;
    const result = Math.max(0, total - discountAmount) + shippingCost + taxAmount;
    logger.info('Checkout final total calculation:', {
      data: {
        cartTotal: total,
        discountAmount,
        selectedShippingRate: selectedShippingRate?.rate,
        shippingRate: shippingRate?.finalRate,
        taxAmount,
        finalTotal: result
      }
    });
    return result;
  }, [total, discountAmount, selectedShippingRate, shippingRate, taxAmount]);

  return (
    <div className="force-light min-h-screen bg-background text-foreground">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress bar - 4 steps (clickable back-only) */}
        <div className="mb-6">
          <div className="flex items-center">
            <div className="flex items-center flex-1">
              <button type="button" onClick={() => router.push('/landing/checkout')} className="flex items-center justify-center w-9 h-9 rounded-full font-semibold bg-primary text-white">
                1
              </button>
              <div className="h-1 flex-1 mx-2 rounded bg-primary" />
            </div>
            <div className="flex items-center flex-1">
              <button type="button" disabled className="flex items-center justify-center w-9 h-9 rounded-full font-semibold bg-primary text-white cursor-default">
                2
              </button>
              <div className="h-1 flex-1 mx-2 rounded bg-gray-200" />
            </div>
            <div className="flex items-center flex-1">
              <button type="button" disabled className="flex items-center justify-center w-9 h-9 rounded-full font-semibold bg-gray-200 text-gray-600 cursor-not-allowed">
                3
              </button>
              <div className="h-1 flex-1 mx-2 rounded bg-gray-200" />
            </div>
            <div className="flex items-center">
              <button type="button" disabled className="flex items-center justify-center w-9 h-9 rounded-full font-semibold bg-gray-200 text-gray-600 cursor-not-allowed">
                4
              </button>
            </div>
          </div>
          <div className="grid grid-cols-4 text-xs text-gray-600 mt-2">
            <button onClick={() => router.push('/landing/checkout')} className="text-left text-gray-700 hover:underline text-left">
              Address
            </button>
            <div className="text-center">Items</div>
            <div className="text-center opacity-60 cursor-not-allowed">Payment</div>
            <div className="text-right opacity-60 cursor-not-allowed">Summary</div>
          </div>
        </div>


        <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #e2e8f0;
            border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #cbd5e1;
          }
        `}</style>

        <h1 className="text-3xl sm:text-5xl font-black mb-10 tracking-tight text-primary uppercase italic">Secure Checkout</h1>
        <div className="grid lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold tracking-tight">Your items</h2>
              <div className="hidden sm:flex gap-2">
                <Button type="button" variant="outline" size="icon" className="border-gray-300" onClick={() => scrollItems('left')}><span className="sr-only">Prev</span>‹</Button>
                <Button type="button" variant="outline" size="icon" className="border-gray-300" onClick={() => scrollItems('right')}><span className="sr-only">Next</span>›</Button>
              </div>
            </div>

            <div className="relative">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10 sm:hidden">
                <Button type="button" variant="outline" size="icon" className="border-gray-300" onClick={() => scrollItems('left')}>‹</Button>
              </div>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10 sm:hidden">
                <Button type="button" variant="outline" size="icon" className="border-gray-300" onClick={() => scrollItems('right')}>›</Button>
              </div>

              <div ref={scrollerRef} className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {items.map(it => (
                  <Card key={it.variantId} className="border-gray-200 hover:shadow-sm transition-shadow min-w-[260px] max-w-[280px] snap-start">
                    <CardContent className="p-3">
                      <div className="space-y-3">
                        <div className="w-full aspect-square bg-gray-50 rounded-lg border overflow-hidden">
                          <img src={resolveImageUrl(it.variant?.product?.images?.[0]?.url || '/products/peptide-1.jpg')} alt={it.variant?.product?.name || 'Product'} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-black text-base leading-tight mb-1 break-words">{it.variant?.product?.name}</div>
                          <div className="text-sm text-gray-600 mb-2 break-words">{it.variant?.name}</div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Button type="button" variant="outline" size="icon" className="h-8 w-8 border-gray-300" onClick={() => changeQuantity(it.variantId, it.quantity - 1)}><Minus className="h-4 w-4" /></Button>
                              <div className="inline-flex items-center text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">{it.quantity}</div>
                              <Button type="button" variant="outline" size="icon" className="h-8 w-8 border-gray-300" onClick={() => changeQuantity(it.variantId, it.quantity + 1)}><Plus className="h-4 w-4" /></Button>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {(() => {
                                const customerType = (user as any)?.customer?.customerType as 'B2C' | 'B2B' | 'ENTERPRISE_1' | 'ENTERPRISE_2' | undefined;
                                const getPricingCustomerType = (type: typeof customerType) => {
                                  if (!type) return undefined;
                                  if (type === 'B2B') return 'B2C';
                                  if (type === 'ENTERPRISE_2') return 'ENTERPRISE_1';
                                  return type;
                                };
                                const pricingType = getPricingCustomerType(customerType);

                                let displayPrice = 0;
                                let regularPrice = Number(it.variant?.regularPrice || 0);
                                let isBulkPrice = false;

                                // PRIORITY 1: Use unitPrice from cart API (already calculated with latest pricing)
                                if (it.unitPrice != null && it.unitPrice > 0) {
                                  displayPrice = Number(it.unitPrice);

                                  // Check if this is a bulk price by comparing with regular price
                                  const bulkPrices = (it as any)?.variant?.bulkPrices;
                                  if (bulkPrices && Array.isArray(bulkPrices)) {
                                    const applicableBulk = bulkPrices.find((bp: any) => {
                                      const minQty = Number(bp.minQty);
                                      const maxQty = bp.maxQty ? Number(bp.maxQty) : Infinity;
                                      return it.quantity >= minQty && it.quantity <= maxQty;
                                    });
                                    if (applicableBulk) {
                                      isBulkPrice = true;
                                    }
                                  }
                                }
                                // PRIORITY 2: Fallback to client-side calculation (for guest carts)
                                else {
                                  // Check for bulk pricing first
                                  const bulkPrices = (it as any)?.variant?.bulkPrices;
                                  if (bulkPrices && Array.isArray(bulkPrices)) {
                                    const applicableBulk = bulkPrices.find((bp: any) => {
                                      const minQty = Number(bp.minQty);
                                      const maxQty = bp.maxQty ? Number(bp.maxQty) : Infinity;
                                      return it.quantity >= minQty && it.quantity <= maxQty;
                                    });

                                    if (applicableBulk) {
                                      displayPrice = Number(applicableBulk.price);
                                      isBulkPrice = true;
                                    }
                                  }

                                  // If no bulk price, check segment pricing for ALL customer types
                                  if (!isBulkPrice && pricingType && (it as any)?.variant?.segmentPrices) {
                                    const seg = (it as any)?.variant?.segmentPrices?.find?.((sp: any) => sp.customerType === pricingType);
                                    if (seg) {
                                      displayPrice = Number(seg.salePrice > 0 ? seg.salePrice : seg.regularPrice ?? 0);
                                    } else {
                                      // No segment price found, use variant's regular price
                                      displayPrice = Number(it.variant?.regularPrice ?? 0);
                                    }
                                  }
                                  // If no segment pricing, use variant's sale price or regular price
                                  else if (!isBulkPrice && (it as any)?.variant) {
                                    const salePrice = Number((it as any)?.variant?.salePrice ?? 0);
                                    const variantRegularPrice = Number((it as any)?.variant?.regularPrice ?? 0);
                                    displayPrice = salePrice > 0 ? salePrice : variantRegularPrice;
                                  }
                                }

                                return (
                                  <>
                                    <div className="flex items-center gap-2">
                                      <div className="flex flex-col items-end">
                                        <div className="text-base font-semibold whitespace-nowrap">${displayPrice.toFixed(2)}</div>
                                        {isBulkPrice && (
                                          <div className="text-xs text-gray-500 line-through">${regularPrice.toFixed(2)}</div>
                                        )}
                                      </div>
                                      {isBulkPrice && (
                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">
                                          Bulk
                                        </span>
                                      )}
                                      <Button type="button" variant="outline" size="icon" className="h-8 w-8 border-gray-300" onClick={() => removeItem(it.variantId)}><X className="h-4 w-4" /></Button>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className={`border rounded-[2rem] p-8 mt-8 transition-all duration-300 ${showTermsError ? 'border-destructive bg-destructive/5' : 'border-primary/10 bg-gray-50'}`}>
              <div className="flex items-start gap-4">
                <input
                  type="checkbox"
                  id="checkout-terms-checkbox"
                  checked={termsAccepted}
                  onChange={(e) => {
                    setTermsAccepted(e.target.checked);
                    if (e.target.checked) {
                      setShowTermsError(false);
                    }
                  }}
                  className="mt-1 h-6 w-6 rounded-lg border-primary/20 text-primary focus:ring-primary cursor-pointer flex-shrink-0"
                />
                <label htmlFor="checkout-terms-checkbox" className="flex-1 cursor-pointer">
                  <h3 className="text-primary font-black uppercase tracking-widest text-xs mb-3">Clinical Use Protocol</h3>
                  <div className="text-gray-600 text-sm leading-relaxed font-medium">
                    Products sold on this website are intended for <strong>PROFESSIONAL USE ONLY</strong> and are only to be sold to a licensed healthcare provider to be utilized at their discretion in accordance with applicable law. These products are not FDA approved and are not intended to diagnose, treat, cure or prevent any medical disease or condition. Any and all content provided on this website is strictly for informational and educational purposes and should not be interpreted as medical advice. Ascendra Bio does not take any responsibility for distribution or use of these products.
                  </div>
                </label>
              </div>
              {showTermsError && (
                <div className="mt-4 text-xs text-destructive font-black uppercase tracking-widest flex items-center gap-2">
                  <X className="h-4 w-4" />
                  Please affirm compliance with the professional use protocol.
                </div>
              )}
            </div>

            {/* Address Summary Cards (Repositioned) */}
            {(() => {
              const billingAddress = addresses.find(a => a.id === billingId);
              const shippingAddress = addresses.find(a => a.id === shippingId);
              const sameAddress = billingId && shippingId && billingId === shippingId;
              if (!billingAddress && !shippingAddress) return null;

              const AddressCard = ({ title, addr }: { title: string, addr: Address | null }) => {
                if (!addr) return null;
                return (
                  <div className="mt-4 border border-gray-200 rounded-lg bg-white p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-primary" />
                        <h2 className="text-xs font-black uppercase tracking-widest">{title}</h2>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs h-7 px-2"
                        onClick={() => router.push('/landing/checkout')}
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </Button>
                    </div>
                    <div className="text-sm text-gray-800">
                      <div className="font-medium text-black">
                        {[addr.firstName, addr.lastName].filter(Boolean).join(' ')}
                        {addr.company && <span className="text-gray-500 font-normal"> ({addr.company})</span>}
                      </div>
                      <div>{addr.address1}</div>
                      {addr.address2 && <div>{addr.address2}</div>}
                      <div>{[addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ')}</div>
                      <div>{addr.country}</div>
                      {addr.phone && <div className="text-gray-500 mt-0.5 flex items-center gap-1.5 break-all">
                        <span className="text-xs font-semibold py-0.5 px-1.5 bg-gray-100 rounded text-gray-600 uppercase">Phone</span> {addr.phone}
                      </div>}
                    </div>
                  </div>
                );
              };

              return (
                <div id="address-summary-section" ref={addressSectionRef} className="grid sm:grid-cols-2 gap-4 mt-4 scroll-mt-20">
                  <AddressCard title="Billing Address" addr={billingAddress || null} />
                  <AddressCard title="Shipping Address" addr={shippingAddress || null} />
                </div>
              );
            })()}


          </div>
          <div className="space-y-4 lg:sticky lg:top-24 self-start max-h-[calc(100vh-8rem)] overflow-y-auto pr-2 custom-scrollbar">
            <Card className="border-gray-200">
              <CardContent className="p-4 space-y-3">


                <div className="flex items-center justify-between"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>

                {discount.isEligible && (
                  <div className="flex items-center justify-between text-green-600">
                    <span>High-Value Discount ({discount.discountPercentage}%)</span>
                    <span>-${discount.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="space-y-2">
                  {promotions.length > 0 ? (
                    <Select value={couponCode} onValueChange={(v) => {
                      if (v === '__clear__') {
                        setCouponCode('');
                      } else {
                        setCouponCode(v);
                      }
                    }}>
                      <SelectTrigger className={`w-full ${couponCode && discountAmount > 0 ? "border-green-400 bg-green-50" : "border-gray-300"}`}>
                        <SelectValue placeholder={couponLoading ? 'Checking coupons…' : (couponCode || 'Select a coupon')} />
                      </SelectTrigger>
                      <SelectContent className="force-light">
                        {promotions.map((p) => {
                          return (
                            <SelectItem key={p.id} value={p.code}>
                              <div className="flex items-center gap-2">
                                <span>{p.code}</span>
                                <span className="text-gray-600 text-sm">—</span>
                                <span className="text-gray-700">{p.name}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                        {couponCode && (<SelectItem value="__clear__">✕ Remove coupon</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        id="coupon-code"
                        aria-label="Enter coupon code"
                        className={`flex-1 border rounded-md px-3 py-2 text-sm ${couponCode && discountAmount > 0 ? "border-green-400 bg-green-50" : "border-gray-300"}`}
                        placeholder="Enter coupon code"
                        value={couponCode}
                        maxLength={50}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      />
                      <Button type="button" variant="outline" onClick={() => setCouponCode(couponCode.trim().toUpperCase())}>Apply</Button>
                    </div>
                  )}
                  {couponLoading && (
                    <p className="text-xs text-gray-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Applying coupon…</p>
                  )}
                  {!couponLoading && couponCode && discountAmount > 0 && (
                    <div className="flex items-center justify-between rounded-md bg-green-50 border border-green-200 px-3 py-2">
                      <div className="flex items-center gap-2 text-green-700">
                        <Check className="w-4 h-4 shrink-0" />
                        <span className="text-sm font-medium">{couponCode}</span>
                        <span className="text-xs text-green-600">applied</span>
                      </div>
                      <span className="text-sm font-semibold text-green-700">-${discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {!couponLoading && couponCode && discountAmount === 0 && (
                    <p className="text-xs text-red-500">Coupon not applicable to current cart.</p>
                  )}
                </div>
                <div className="flex items-center justify-between text-gray-700"><span>State Tax</span><span>{taxComputed ? `$${countryTaxAmount.toFixed(2)}` : '—'}</span></div>
                <div className="flex items-center justify-between text-gray-700"><span>Product Tax</span><span>{taxComputed ? `$${productTaxAmount.toFixed(2)}` : '—'}</span></div>

                {/* Shipping moved below taxes */}
                <div className="flex items-center justify-between text-gray-700">
                  <span>Shipping</span>
                  <span>
                    {shippingRatesLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin inline" />
                    ) : selectedShippingRate ? (
                      `$${selectedShippingRate.rate.toFixed(2)}`
                    ) : shippingRate ? (
                      `$${(shippingRate.finalRate || 0).toFixed(2)}`
                    ) : (
                      customRates.length > 0 ? '$0.00' : '—'
                    )}
                  </span>
                </div>
                {!shippingRatesLoading && !selectedShippingRate && !shippingRate && billingId && shippingId && customRates.length === 0 && (
                  <p className="text-xs text-red-500">Couldn't calculate shipping — please try again or contact support.</p>
                )}

                {/* Shipping Rate Selection */}
                {customRates.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm text-gray-600">Shipping Options</Label>
                    <Select
                      value={selectedShippingRate?.serviceCode || ''}
                      onValueChange={(serviceCode) => {
                        const rate = customRates.find(r => r.serviceCode === serviceCode);
                        if (rate) {
                          setSelectedShippingRate(rate);
                          setShippingRate({ finalRate: rate.rate, reason: rate.serviceName });
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select shipping option" />
                      </SelectTrigger>
                      <SelectContent>
                        {customRates.map((rate, index) => (
                          <SelectItem key={index} value={rate.serviceCode || index.toString()}>
                            <div className="flex justify-between items-center w-full">
                              <span>{rate.serviceName}</span>
                              <span className="ml-2 font-medium">${rate.rate.toFixed(2)}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Separator className="my-2" />
                <div className="flex items-center justify-between font-bold text-lg"><span>Total</span><span>${finalTotal.toFixed(2)}</span></div>
                {error && <div className="text-sm text-red-600">{error}</div>}
                <Button
                  className="w-full hidden md:block"
                  disabled={!canCheckout || !billingId || !shippingId || (!shippingComputed && !selectedShippingRate)}
                  onClick={() => {
                    if (!termsAccepted) {
                      setShowTermsError(true);
                      window.scrollTo({
                        top: document.getElementById('checkout-terms-checkbox')?.offsetTop ? document.getElementById('checkout-terms-checkbox')!.offsetTop - 100 : 0,
                        behavior: 'smooth'
                      });
                      return;
                    }
                    router.push(`/landing/checkout/payment?orderTotal=${finalTotal.toFixed(2)}&billing=${billingId}&shipping=${shippingId}&shippingAmount=${(selectedShippingRate?.rate || shippingRate?.finalRate || 0).toFixed(2)}&serviceCode=${selectedShippingRate?.serviceCode || ''}&discountAmount=${discountAmount.toFixed(2)}&subtotal=${subtotal.toFixed(2)}&taxAmount=${taxAmount.toFixed(2)}${couponCode ? `&coupon=${encodeURIComponent(couponCode)}` : ''}`);
                  }}
                >
                  Continue to Payment
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full mt-2 hidden md:flex items-center gap-2 border-gray-300 text-gray-700 hover:bg-gray-50"
                  onClick={handleScrollToAddress}
                >
                  <MapPin className="h-4 w-4 text-red-500" />
                  View address details
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
        {/* Mobile sticky summary bar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-gray-600">Total</div>
            <div className="text-lg font-bold">${finalTotal.toFixed(2)}</div>
          </div>
          <Button
            className="flex-1"
            disabled={!canCheckout || !billingId || !shippingId || (!shippingComputed && !selectedShippingRate)}
            onClick={() => {
              if (!termsAccepted) {
                setShowTermsError(true);
                window.scrollTo({
                  top: document.getElementById('checkout-terms-checkbox')?.offsetTop ? document.getElementById('checkout-terms-checkbox')!.offsetTop - 100 : 0,
                  behavior: 'smooth'
                });
                return;
              }
              router.push(`/landing/checkout/payment?orderTotal=${finalTotal.toFixed(2)}&billing=${billingId}&shipping=${shippingId}&shippingAmount=${(selectedShippingRate?.rate || shippingRate?.finalRate || 0).toFixed(2)}&serviceCode=${selectedShippingRate?.serviceCode || ''}&discountAmount=${discountAmount.toFixed(2)}&subtotal=${subtotal.toFixed(2)}&taxAmount=${taxAmount.toFixed(2)}${couponCode ? `&coupon=${encodeURIComponent(couponCode)}` : ''}`);
            }}
          >
            Pay
          </Button>
        </div>
      </main>

    </div>
  );
}
