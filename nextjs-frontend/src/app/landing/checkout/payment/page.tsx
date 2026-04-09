"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { useCart } from "@/contexts/cart-context";
import { api, type Address } from "@/lib/api";
import { LottiePlayer } from "@/components/ui/lottie-player";
import { CreditCard, Smartphone, Building2, CheckCircle, MapPin, Pencil } from "lucide-react";
import { CardPaymentDialog } from "@/components/payments/card-payment-dialog";
import logger from '@/lib/logger';

function PaymentPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { items, clear, refresh } = useCart();
  const isCustomerRole = !!(user && user.role === 'CUSTOMER');

  const orderIdParam = (params.get('orderId') || '').trim() || null;
  const billing = params.get("billing") || "";
  const shipping = params.get("shipping") || "";
  const shippingAmountParam = parseFloat(params.get("shippingAmount") || "0");
  const taxAmountParam = parseFloat(params.get("taxAmount") || "0");
  const discountAmountParam = parseFloat(params.get("discountAmount") || "0");
  const couponCode = params.get("coupon") || "";

  // Fresh cart data state - this will override URL params
  const [cartData, setCartData] = useState<any>(null);
  const [cartLoading, setCartLoading] = useState(true);

  // Computed values from fresh cart data or URL params (fallback)
  const subtotal = Math.round((cartData?.subtotal ?? parseFloat(params.get("subtotal") || "0")) * 100) / 100;
  const shippingAmount = Math.round((cartData?.shippingAmount ?? shippingAmountParam) * 100) / 100;
  const taxAmount = Math.round((cartData?.taxAmount ?? taxAmountParam) * 100) / 100;
  const discountAmount = Math.round((cartData?.discountAmount ?? discountAmountParam) * 100) / 100;
  const orderTotal = Math.round((cartData?.orderTotal ?? parseFloat(params.get("orderTotal") || "0")) * 100) / 100;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const COOLDOWN_STORAGE_KEY = 'authorize_net_card_retry_cooldown_until';
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [nowTs, setNowTs] = useState<number>(0);

  // Set nowTs after mount to avoid hydration mismatch
  useEffect(() => {
    setNowTs(Date.now());
  }, []);

  // Payment method selection
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");
  const [showPaymentInstructions, setShowPaymentInstructions] = useState(false);
  const [paymentInstructions, setPaymentInstructions] = useState<any>(null);

  // Custom card dialog state
  const [showCardDialog, setShowCardDialog] = useState(false);
  const [billingAddressData, setBillingAddressData] = useState<any>(null);
  const [shippingAddressData, setShippingAddressData] = useState<any>(null);

  // Manual payment states
  const [showManualConfirm, setShowManualConfirm] = useState(false);
  const [manualPaymentLoading, setManualPaymentLoading] = useState(false);

  // Terms acceptance checkbox
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [showTermsError, setShowTermsError] = useState(false);

  // Address validation - using URL parameters
  const [addressesLoaded, setAddressesLoaded] = useState(false);
  const [hasBilling, setHasBilling] = useState(false);
  const [hasShipping, setHasShipping] = useState(false);

  // Result modal state
  const [resultOpen, setResultOpen] = useState(false);
  const [resultSuccess, setResultSuccess] = useState<boolean | null>(null);
  const [resultMessage, setResultMessage] = useState<string>("");
  const [isManualResult, setIsManualResult] = useState(false);
  const [manualCountdown, setManualCountdown] = useState<number | null>(null);
  const navigateAfterMs = 1800;

  // Out-of-stock validation state
  const [outOfStockItems, setOutOfStockItems] = useState<Array<{ productName: string; variantName: string }>>([]);
  const [showOutOfStockDialog, setShowOutOfStockDialog] = useState(false);

  // Address summary state
  const [billingAddr, setBillingAddr] = useState<Address | null>(null);
  const [shippingAddr, setShippingAddr] = useState<Address | null>(null);

  const successAnim = "/Sucess-message.json";
  const failureAnim = "/Failed-message.json";

  // Load addresses for summary display
  useEffect(() => {
    if (!user?.customerId || (!billing && !shipping)) return;
    (async () => {
      try {
        const res = await api.getCustomer(user.customerId!);
        if (res.success && res.data) {
          const list: Address[] = (res.data as any).addresses || [];
          if (billing) setBillingAddr(list.find(a => a.id === billing) || null);
          if (shipping) setShippingAddr(list.find(a => a.id === shipping) || null);
        }
      } catch (err) {
        logger.error('Failed to load addresses for summary:', { error: err });
      }
    })();
  }, [user?.customerId, billing, shipping]);

  // Validate addresses from URL parameters
  useEffect(() => {
    if (billing && shipping) {
      setHasBilling(true);
      setHasShipping(true);
      setAddressesLoaded(true);
    } else {
      // If no addresses in URL, redirect to checkout
      if (!orderIdParam) {
        router.push('/landing/checkout');
      }
    }
  }, [billing, shipping, router, orderIdParam]);

  // Load persisted card retry cooldown (set after a failed card payment)
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(COOLDOWN_STORAGE_KEY);
      const parsed = saved ? Number(saved) : NaN;
      if (!Number.isNaN(parsed) && parsed > Date.now()) {
        setCooldownUntil(parsed);
      } else if (!Number.isNaN(parsed)) {
        window.localStorage.removeItem(COOLDOWN_STORAGE_KEY);
        setCooldownUntil(null);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    if (!cooldownUntil) return;
    if (cooldownUntil <= Date.now()) return;

    setNowTs(Date.now());
    const id = window.setInterval(() => {
      setNowTs(Date.now());
    }, 1000);

    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  const remainingMs = cooldownUntil ? Math.max(0, cooldownUntil - nowTs) : 0;
  const cooldownActive = Boolean(cooldownUntil && remainingMs > 0);

  const formatRemaining = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  // Fetch fresh cart data on page load to ensure pricing is up-to-date
  const serviceCode = params.get("serviceCode") || "";

  const fetchCartPricing = async () => {
    if (!user?.customerId || orderIdParam) {
      // Skip if no user or if we already have an orderId
      setCartLoading(false);
      return;
    }

    try {
      setCartLoading(true);
      const [cartResponse, tiersRes] = await Promise.all([
        api.getCart(),
        api.getPublicShippingTiers()
      ]);

      if (!cartResponse.success || !cartResponse.data?.items?.length) {
        // Cart is empty, keep URL params
        setCartLoading(false);
        return;
      }

      // Calculate fresh subtotal from cart's pricing
      const cartItems = cartResponse.data.items;
      const rawSubtotal = cartItems.reduce(
        (sum, item) => sum + (parseFloat(String(item.unitPrice || '0')) * item.quantity),
        0
      );
      const calculatedSubtotal = Number(rawSubtotal.toFixed(2));

      // Get customer data for high-value discount calculation
      const customerData = await api.getCustomer(user.customerId);
      const isB2B = customerData.success && customerData.data && customerData.data.customerType === 'B2B';
      const highValueDiscount = isB2B && calculatedSubtotal >= 5000 ? calculatedSubtotal * 0.10 : 0;
      const calculatedDiscount = Math.round(highValueDiscount * 100) / 100;

      // Use coupon discount from URL if available, otherwise use high-value discount
      const finalDiscount = discountAmountParam > 0 ? discountAmountParam : calculatedDiscount;

      // RE-CALCULATE SHIPPING from fresh tiers
      let freshShippingAmount = 0; // Default to 0 instead of stale param
      if (tiersRes.success && tiersRes.data) {
        const tiers = tiersRes.data;
        // Find the tier that matches the serviceCode and current subtotal
        let matchedTier = tiers.find((t: any) =>
          (t.serviceName === serviceCode || `TIER_${t.id}` === serviceCode) &&
          calculatedSubtotal >= Number(t.minSubtotal) &&
          (t.maxSubtotal === null || calculatedSubtotal < Number(t.maxSubtotal))
        );

        // If precisely matched tier is not found (deleted or out of range), pick the cheapest for this range
        if (!matchedTier) {
          const applicableTiers = tiers.filter((t: any) =>
            calculatedSubtotal >= Number(t.minSubtotal) &&
            (t.maxSubtotal === null || calculatedSubtotal < Number(t.maxSubtotal))
          );
          if (applicableTiers.length > 0) {
            matchedTier = applicableTiers.reduce((min: any, t: any) =>
              (Number(t.shippingRate) < Number(min.shippingRate) ? t : min),
              applicableTiers[0]
            );
          }
        }

        if (matchedTier) {
          freshShippingAmount = Number(matchedTier.shippingRate);
        } else {
          // Absolute fallback if no tiers exist for this range
          freshShippingAmount = 0;
        }
      }

      // Calculate order total
      const calculatedOrderTotal = Number((calculatedSubtotal + freshShippingAmount + taxAmountParam - finalDiscount).toFixed(2));

      // Update cart data state
      setCartData({
        items: cartItems,
        subtotal: calculatedSubtotal,
        shippingAmount: freshShippingAmount,
        taxAmount: taxAmountParam,
        discountAmount: finalDiscount,
        orderTotal: calculatedOrderTotal
      });
    } catch (err) {
      logger.error('Failed to fetch cart pricing:', { error: err });
      // Continue with URL params on error
    } finally {
      setCartLoading(false);
    }
  };

  useEffect(() => {
    fetchCartPricing();
  }, [user?.customerId, orderIdParam, shippingAmountParam, taxAmountParam, discountAmountParam, serviceCode]);

  // Validate stock on mount
  useEffect(() => {
    if (!user?.customerId || orderIdParam) return;
    (async () => {
      try {
        const res = await api.validateCartStock();
        if (res.success && res.data && res.data.removedItems && res.data.removedItems.length > 0) {
          setOutOfStockItems(res.data.removedItems.map((item: any) => ({
            productName: item.productName,
            variantName: item.variantName,
          })));
          setShowOutOfStockDialog(true);
          // Don't refresh here — wait for user to close the dialog
        }
      } catch (err) {
        logger.error('Failed to validate cart stock:', { error: err });
      }
    })();
  }, [user?.customerId, orderIdParam]);

  // Load billing and shipping address data for credit card payment
  useEffect(() => {
    const loadAddressData = async () => {
      if (user?.customerId && (billing || shipping)) {
        try {
          const customerRes = await api.getCustomer(user.customerId);
          if (customerRes.success && customerRes.data) {
            const addresses = customerRes.data.addresses || [];
            const customerMobile = customerRes.data.mobile;

            if (billing) {
              const billingAddr = addresses.find((a: any) => a.id === billing);
              if (billingAddr) {
                setBillingAddressData({
                  firstName: billingAddr.firstName || user.firstName || "",
                  lastName: billingAddr.lastName || user.lastName || "",
                  company: billingAddr.company || '',
                  addressLine1: billingAddr.address1,
                  addressLine2: billingAddr.address2,
                  city: billingAddr.city,
                  state: billingAddr.state,
                  postalCode: billingAddr.postalCode,
                  country: billingAddr.country || 'US',
                  phoneNumber: billingAddr.phone || customerMobile || ''
                });
              }
            }

            if (shipping) {
              const shippingAddr = addresses.find((a: any) => a.id === shipping);
              if (shippingAddr) {
                setShippingAddressData({
                  firstName: shippingAddr.firstName || user.firstName || "",
                  lastName: shippingAddr.lastName || user.lastName || "",
                  company: shippingAddr.company || '',
                  addressLine1: shippingAddr.address1,
                  addressLine2: shippingAddr.address2,
                  city: shippingAddr.city,
                  state: shippingAddr.state,
                  postalCode: shippingAddr.postalCode,
                  country: shippingAddr.country || 'US',
                  phoneNumber: shippingAddr.phone || customerMobile || ''
                });
              }
            }
          }
        } catch (err) {
          logger.error('Failed to load address data:', { error: err });
        }
      }
    };

    if (showCardDialog && user?.customerId) {
      loadAddressData();
    }
  }, [showCardDialog, billing, shipping, user]);

  // Handle payment method selection
  async function handlePaymentMethodSelect(method: string) {
    // Check if terms are accepted
    if (!termsAccepted) {
      setShowTermsError(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (method === 'credit-card' && cooldownActive) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSelectedPaymentMethod(method);
    setError(null);
    setShowTermsError(false);

    // Re-fetch cart pricing before opening payment dialog to ensure latest pricing
    if (method === 'credit-card') {
      // Fetch fresh cart data before proceeding
      if (!orderIdParam && user?.customerId) {
        try {
          const cartResponse = await api.getCart();
          if (!cartResponse.success || !cartResponse.data?.items?.length) {
            setError('Cart is empty');
            return;
          }

          // Recalculate pricing from fresh cart data
          const cartItems = cartResponse.data.items;
          const calculatedSubtotal = cartItems.reduce(
            (sum, item) => sum + (parseFloat(String(item.unitPrice || '0')) * item.quantity),
            0
          );

          const customerData = await api.getCustomer(user.customerId);
          const isB2B = customerData.success && customerData.data && customerData.data.customerType === 'B2B';
          const highValueDiscount = isB2B && calculatedSubtotal >= 5000 ? calculatedSubtotal * 0.10 : 0;
          const calculatedDiscount = Math.round(highValueDiscount * 100) / 100;
          const finalDiscount = discountAmountParam > 0 ? discountAmountParam : calculatedDiscount;
          const calculatedOrderTotal = calculatedSubtotal + shippingAmountParam + taxAmountParam - finalDiscount;

          // Update cart data state with fresh values
          setCartData({
            items: cartItems,
            subtotal: calculatedSubtotal,
            shippingAmount: shippingAmountParam,
            taxAmount: taxAmountParam,
            discountAmount: finalDiscount,
            orderTotal: calculatedOrderTotal
          });
        } catch (err) {
          logger.error('Failed to refresh cart before payment:', { error: err });
          setError('Failed to fetch latest pricing. Please try again.');
          return;
        }
      }
      if (!orderIdParam && items.length === 0) {
        setError('Cart is empty');
        return;
      }
      // Validate stock one last time before opening the credit card dialog
      try {
        const res = await api.validateCartStock();
        if (res.success && res.data && res.data.removedItems && res.data.removedItems.length > 0) {
          setOutOfStockItems(res.data.removedItems.map((item: any) => ({
            productName: item.productName,
            variantName: item.variantName,
          })));
          setShowOutOfStockDialog(true);
          return; // Stop here, don't open the card dialog
        }
      } catch (err) {
        logger.error('Failed to validate cart stock before payment:', { error: err });
      }

      // Open custom card payment dialog
      setShowCardDialog(true);
    } else if (method === 'zelle') {
      setPaymentInstructions({
        type: 'zelle',
        title: 'Zelle Payment Instructions',
        email: 'accounting@centreresearch.org',
        message: 'Order processing will commence only upon receipt of the payment confirmation email.'
      });
      setShowPaymentInstructions(true);
    } else if (method === 'wire') {
      setPaymentInstructions({
        type: 'wire',
        title: 'Wire Transfer Instructions',
        company: 'Ascendra Bio Inc',
        address: '383 Madison Avenue, New York, NY 10179',
        accountNumber: '716397685',
        routingNumber: '021000021',
        email: 'accounting@centreresearch.org',
        message: 'Once wire is confirmed, please screenshot confirmation and send to accounting@centreresearch.org'
      });
      setShowPaymentInstructions(true);
    }
  }

  // Handle successful card payment
  const handleCardPaymentSuccess = async (transactionId: string) => {
    try {
      // Clear cart on success
      try { await clear(); } catch { }

      setShowCardDialog(false);
      setResultSuccess(true);
      setResultMessage('Payment successful. Your order is now processing.');
      setResultOpen(true);

      // Redirect to orders after a short delay
      setTimeout(() => router.push('/account/orders'), navigateAfterMs);
    } catch (e: any) {
      setError(e.message || 'Failed to complete payment');
      setShowCardDialog(false);
    }
  };

  // Handle manual payment confirmation
  async function handleManualPayment() {
    if (manualPaymentLoading || !user?.customerId) return;

    // Validate payment method is selected
    if (!selectedPaymentMethod) {
      setError('Please select a payment method');
      return;
    }

    setManualPaymentLoading(true);
    setError(null);

    try {
      if (!billing || !shipping) {
        throw new Error('Missing billing/shipping addresses');
      }

      let orderIdToUse: string | null = orderIdParam;
      if (!orderIdToUse) {
        // Always fetch fresh cart data to get the latest pricing (including bulk discounts)
        const cartResponse = await api.getCart();
        if (!cartResponse.success || !cartResponse.data?.items?.length) {
          throw new Error('Cart is empty');
        }

        // The cart now returns items with unitPrice calculated based on:
        // 1. Bulk pricing (if quantity qualifies)
        // 2. Customer segment pricing (B2C, ENTERPRISE_1)
        // 3. Base variant pricing
        // This ensures backward compatibility with updated cart endpoints
        const cartItems = cartResponse.data.items.map((item: any) => ({
          variantId: String(item.variantId ?? item.variant?.id),
          quantity: Number(item.quantity),
          unitPrice: String(parseFloat(String(item.unitPrice || '0')))
        }));

        // Calculate subtotal from cart's pricing
        const subtotal = cartItems.reduce((sum, item) => sum + (parseFloat(item.unitPrice) * item.quantity), 0);
        const customerData = await api.getCustomer(user.customerId);
        const isB2B = customerData.success && customerData.data && customerData.data.customerType === 'B2B';
        const highValueDiscount = isB2B && subtotal >= 5000 ? subtotal * 0.10 : 0;
        const calculatedDiscount = Math.round(highValueDiscount * 100) / 100;

        // Use coupon discount from URL if available, otherwise use high-value discount
        const finalDiscount = discountAmount > 0 ? discountAmount : calculatedDiscount;

        // Map payment method to PaymentType enum
        const paymentTypeMap: { [key: string]: string } = {
          'zelle': 'ZELLE',
          'wire': 'BANK_WIRE',
          'credit-card': 'AUTHORIZE_NET'
        };

        const mappedPaymentType = paymentTypeMap[selectedPaymentMethod];
        logger.info('Creating order with payment type:', {
          data: {
            selectedPaymentMethod,
            mappedPaymentType,
            paymentTypeMap,
            discountAmount,
            finalDiscount
          }
        });

        const orderData = {
          customerId: user.customerId,
          billingAddressId: billing,
          shippingAddressId: shipping,
          items: cartItems,
          discountAmount: String(finalDiscount),
          shippingAmount: String(shippingAmount),
          taxAmount: String(taxAmount),
          selectedPaymentType: (mappedPaymentType as "ZELLE" | "BANK_WIRE" | "AUTHORIZE_NET") || null,
          // Enable warehouse selection/reservation for manual payments so inventory is committed
          skipWarehouse: false,
          // Include coupon code if provided
          couponCode: couponCode || undefined,
        };
        const orderResponse = await api.createOrder(orderData);
        if (!orderResponse.success || !orderResponse.data?.id) {
          throw new Error(orderResponse.error || 'Failed to create order');
        }
        orderIdToUse = orderResponse.data.id;
      }

      try { await clear(); } catch { }

      setShowPaymentInstructions(false);
      setIsManualResult(true);
      setResultSuccess(true);
      setResultMessage('Your order has been placed successfully. Please share your payment details with Ascendra Bio for confirmation.');
      setResultOpen(true);
      setManualCountdown(10);
    } catch (err: any) {
      setError(err.message || 'Failed to process manual payment');
    } finally {
      setManualPaymentLoading(false);
    }
  }

  // Countdown and auto-redirect for manual payment success
  useEffect(() => {
    if (!isManualResult || !resultOpen || !resultSuccess) return;
    if (manualCountdown === null) return;
    if (manualCountdown <= 0) {
      router.push('/account/orders');
      return;
    }
    const timer = setTimeout(() => {
      setManualCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [isManualResult, resultOpen, resultSuccess, manualCountdown, router]);

  return (
    <div className="force-light min-h-screen bg-background text-foreground">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center">
            <div className="flex items-center flex-1">
              <button onClick={() => router.push(`/landing/checkout`)} className="flex items-center justify-center w-9 h-9 rounded-full font-semibold bg-red-500 text-white">1</button>
              <div className="h-1 flex-1 mx-2 rounded bg-red-500" />
            </div>
            <div className="flex items-center flex-1">
              <button onClick={() => router.push(`/landing/checkout/items?billing=${billing}&shipping=${shipping}&orderTotal=${orderTotal || 0}`)} className="flex items-center justify-center w-9 h-9 rounded-full font-semibold bg-red-500 text-white">2</button>
              <div className="h-1 flex-1 mx-2 rounded bg-red-500" />
            </div>
            <div className="flex items-center flex-1">
              <div className="flex items-center justify-center w-9 h-9 rounded-full font-semibold bg-red-500 text-white">3</div>
              <div className="h-1 flex-1 mx-2 rounded bg-gray-200" />
            </div>
            <div className="flex items-center">
              <div className="flex items-center justify-center w-9 h-9 rounded-full font-semibold bg-gray-200 text-gray-600">4</div>
            </div>
          </div>
          <div className="grid grid-cols-4 text-xs text-gray-600 mt-2">
            <button onClick={() => router.push('/landing/checkout')} className="text-left text-gray-700 hover:underline">Address</button>
            <button onClick={() => router.push(`/landing/checkout/items?billing=${billing}&shipping=${shipping}&orderTotal=${orderTotal || 0}`)} className="text-center text-gray-700 hover:underline">Checkout</button>
            <div className="text-center">Payment</div>
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

        <h1 className="text-3xl sm:text-4xl font-black mb-8">Payment</h1>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 max-w-6xl mx-auto">
          {/* Order Summary */}
          <div className="xl:col-span-2 relative">
            <div className="sticky top-6 space-y-4 max-h-[calc(100vh-4rem)] overflow-y-auto pr-2 custom-scrollbar">
              <Card className="border-gray-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold">Order Summary</CardTitle>

                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">${(subtotal || orderTotal - shippingAmount - taxAmount + discountAmount).toFixed(2)}</span>
                  </div>

                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Discount</span>
                      <span className="font-medium text-green-600">-${discountAmount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Shipping</span>
                    <span className="font-medium">
                      {shippingAmount > 0 ? `$${shippingAmount.toFixed(2)}` : '$0.00'}
                    </span>
                  </div>

                  {selectedPaymentMethod === 'credit-card' && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Credit card fee (3%)</span>
                      <span className="font-medium">
                        ${(Math.round(orderTotal * 3) / 100).toFixed(2)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax</span>
                    <span className="font-medium">${taxAmount.toFixed(2)}</span>
                  </div>

                  <Separator />

                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>${
                      (
                        selectedPaymentMethod === 'credit-card'
                          ? (Math.round(orderTotal * 103) / 100)
                          : orderTotal
                      ).toFixed(2)
                    }</span>
                  </div>

                  {selectedPaymentMethod && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-blue-800">
                        <CheckCircle className="h-4 w-4" />
                        <span>
                          {selectedPaymentMethod === 'credit-card' && 'Authorize.Net selected'}
                          {selectedPaymentMethod === 'zelle' && 'Zelle payment selected'}
                          {selectedPaymentMethod === 'wire' && 'Wire transfer selected'}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Address Summary Cards (Repositioned) */}
              {(billingAddr || shippingAddr) && (
                <div className="mt-6 space-y-4">
                  {(() => {
                    const AddressCard = ({ title, addr }: { title: string, addr: Address | null }) => {
                      if (!addr) return null;
                      return (
                        <div className="border border-gray-200 rounded-lg bg-white p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-5 w-5 text-red-500" />
                              <h2 className="text-base font-semibold">{title}</h2>
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
                      <>
                        <AddressCard title="Billing Address" addr={billingAddr} />
                        <AddressCard title="Shipping Address" addr={shippingAddr} />
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="xl:col-span-3">
            <Card className="border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold">Select Payment Method</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                    <p>{error}</p>
                    {error === 'Cart is empty' && (
                      <div className="mt-2 text-xs text-red-500">
                        Looks like there were changes to your cart,{' '}
                        <button
                          onClick={() => router.push('/landing/products')}
                          className="font-bold underline hover:text-red-700 transition-colors"
                        >
                          click here to build your cart again
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {cooldownActive && selectedPaymentMethod === 'credit-card' && (
                  <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                    <p>
                      Please wait <span className="font-bold">{formatRemaining(remainingMs)}</span> before retrying card payment to avoid a duplicate transaction.
                    </p>
                  </div>
                )}



                <RadioGroup value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod} className="space-y-3">
                  {/* Authorize.Net Option */}
                  <div className="flex items-center space-x-3 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-all duration-200">
                    <RadioGroupItem value="credit-card" id="credit-card" className="h-4 w-4" />
                    <Label htmlFor="credit-card" className="flex items-center space-x-3 cursor-pointer flex-1">
                      <CreditCard className="h-5 w-5 text-blue-600" />
                      <div className="flex-1">
                        <div className="font-semibold">Authorize.Net <span className="text-xs font-normal text-gray-500">(adds 3% card fee)</span></div>
                        <div className="text-sm text-gray-600">Pay securely with your credit or debit card</div>
                      </div>
                    </Label>
                  </div>

                  {/* Zelle Option */}
                  <div className="flex items-center space-x-3 p-4 border-2 border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 cursor-pointer transition-all duration-200">
                    <RadioGroupItem value="zelle" id="zelle" className="h-4 w-4" />
                    <Label htmlFor="zelle" className="flex items-center space-x-3 cursor-pointer flex-1">
                      <Smartphone className="h-5 w-5 text-green-600" />
                      <div className="flex-1">
                        <div className="font-semibold">Zelle</div>
                        <div className="text-sm text-gray-600">Send payment via Zelle</div>
                      </div>
                    </Label>
                  </div>

                  {/* Wire Transfer Option */}
                  <div className="flex items-center space-x-3 p-4 border-2 border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 cursor-pointer transition-all duration-200">
                    <RadioGroupItem value="wire" id="wire" className="h-4 w-4" />
                    <Label htmlFor="wire" className="flex items-center space-x-3 cursor-pointer flex-1">
                      <Building2 className="h-5 w-5 text-purple-600" />
                      <div className="flex-1">
                        <div className="font-semibold">Wire Transfer</div>
                        <div className="text-sm text-gray-600">You will receive wire instructions on the next page</div>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>

                {/* Continue Button */}
                <Button
                  className="w-full h-10 text-base font-semibold"
                  onClick={() => handlePaymentMethodSelect(selectedPaymentMethod)}
                  disabled={!selectedPaymentMethod || loading || isLoading || cartLoading || !isCustomerRole || !orderTotal || (addressesLoaded && (!hasBilling || !hasShipping)) || (selectedPaymentMethod === 'credit-card' && cooldownActive)}
                >
                  {loading || cartLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="animate-spin inline-block h-4 w-4 rounded-full border-2 border-current border-r-transparent" />
                      {cartLoading ? 'Loading cart...' : 'Processing...'}
                    </span>
                  ) : selectedPaymentMethod === 'credit-card' && cooldownActive ? (
                    `Retry in ${formatRemaining(remainingMs)}`
                  ) : (
                    'Continue'
                  )}
                </Button>
                {selectedPaymentMethod === 'zelle' && (
                  <div className="mt-6 space-y-3">
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                      <div className="font-semibold uppercase tracking-wide">
                        Payment Instructions :
                      </div>
                      <ol className="list-decimal list-inside space-y-2">
                        <li>
                          Please remit Zelle payments to <strong>accounting@centreresearch.org</strong>. Include your order number in the memo field. We will receive email confirmation from Zelle upon successful transmission.
                        </li>
                        <li>
                          Kindly forward a screenshot of the payment confirmation to <strong>accounting@centreresearch.org</strong> for cross-verification.
                        </li>
                      </ol>
                    </div>
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                      <strong>Important Notice:</strong>
                      <br />
                      Order processing will commence only upon receipt of the payment confirmation email.
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Result Modal */}
      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>
              {resultSuccess ? (isManualResult ? 'Order Placed Successfully' : 'Payment Successful') : 'Payment Failed'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-2">
            <div className="w-28 h-28">
              <LottiePlayer
                src={resultSuccess ? successAnim : failureAnim}
                loop={false}
                autoplay
                style={{ width: '112px', height: '112px' }}
              />
            </div>
            <h3 className="text-lg font-semibold">
              {resultSuccess ? (isManualResult ? 'Order Placed Successfully' : 'Payment Successful') : 'Payment Failed'}
            </h3>
            <p className="text-sm text-muted-foreground">{resultMessage}</p>
            {resultSuccess && isManualResult && manualCountdown !== null && (
              <p className="text-xs text-gray-500 mt-1">Navigating to your orders in {manualCountdown}s…</p>
            )}
            {resultSuccess ? (
              <Button className="mt-2" onClick={() => router.push('/account/orders')}>View Orders</Button>
            ) : (
              <Button className="mt-2" variant="secondary" onClick={() => setResultOpen(false)}>Try Again</Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Instructions Dialog */}
      <Dialog open={showPaymentInstructions} onOpenChange={setShowPaymentInstructions}>
        <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{paymentInstructions?.title}</DialogTitle>
            <DialogDescription>
              Follow the instructions below to complete your payment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                <p>{error}</p>
                {error === 'Cart is empty' && (
                  <div className="mt-2 text-xs text-red-500">
                    Looks like there were changes to your cart,{' '}
                    <button
                      onClick={() => window.location.href = '/landing/products'}
                      className="font-bold underline hover:text-red-700 transition-colors"
                    >
                      click here to build your cart again
                    </button>
                  </div>
                )}
              </div>
            )}
            {paymentInstructions?.type === 'zelle' && (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Smartphone className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-green-800">Zelle Payment</h4>
                      <p className="text-sm text-green-700 mt-1">
                        Send payment to: <strong>{paymentInstructions.email}</strong>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Zelle QR Code - Final Refined Display */}
                <div className="flex flex-col items-center justify-center py-12 my-6 bg-white border border-gray-100 rounded-2xl shadow-inner overflow-hidden">
                  <div className="relative w-80 h-80 sm:w-[440px] sm:h-[440px] overflow-hidden rounded-xl">
                    <Image
                      src="/Zelle-payment-qr.png"
                      alt="Zelle Payment QR Code"
                      fill
                      className="object-contain"
                      priority
                    />
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <div className="text-sm text-blue-900 font-semibold">
                    Payment Instructions :
                  </div>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
                    <li>
                      Please remit Zelle payments to <strong>accounting@centreresearch.org</strong>. Include your order number in the memo field. We will receive email confirmation from Zelle upon successful transmission.
                    </li>
                    <li>
                      Kindly forward a screenshot of the payment confirmation to <strong>accounting@centreresearch.org</strong> for cross-verification.
                    </li>
                  </ol>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
                  <strong>Important Notice:</strong>
                  <br />
                  {paymentInstructions.message}
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm font-semibold text-gray-700">Order Total: ${orderTotal.toFixed(2)}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    After confirming, you will receive order confirmation via email.
                  </p>
                </div>
              </div>
            )}

            {paymentInstructions?.type === 'wire' && (
              <div className="space-y-3">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-medium text-purple-800 mb-3">Wire Transfer Details</h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>Company:</strong> {paymentInstructions.company}</p>
                    <p><strong>Address:</strong> {paymentInstructions.address}</p>
                    <p><strong>Account Number:</strong> {paymentInstructions.accountNumber}</p>
                    <p><strong>Routing Number:</strong> {paymentInstructions.routingNumber}</p>
                  </div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Wire Instructions:</strong>
                    <br />
                    {paymentInstructions.message}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm font-semibold text-gray-700">Order Total: ${orderTotal.toFixed(2)}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    After confirming, you will receive order confirmation via email.
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPaymentInstructions(false)}>
              Cancel
            </Button>
            <Button onClick={handleManualPayment} disabled={manualPaymentLoading}>
              {manualPaymentLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="animate-spin inline-block h-4 w-4 rounded-full border-2 border-current border-r-transparent" />
                  Processing...
                </span>
              ) : (
                'Confirm Order'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Card Payment Dialog */}
      <CardPaymentDialog
        open={showCardDialog}
        onClose={() => setShowCardDialog(false)}
        onSuccess={handleCardPaymentSuccess}
        amount={selectedPaymentMethod === 'credit-card' ? (Math.round(orderTotal * 103) / 100) : orderTotal}
        billingAddress={billingAddressData}
        shippingAddress={shippingAddressData}
        orderId={orderIdParam || undefined}
        shippingAmount={shippingAmount}
        paymentFeePct={selectedPaymentMethod === 'credit-card' ? 3 : 0}
        discountAmount={discountAmount}
        subtotal={subtotal}
        taxAmount={taxAmount}
      />

      {/* Out of Stock Dialog */}
      <Dialog open={showOutOfStockDialog} onOpenChange={() => { /* prevent closing by clicking outside */ }}>
        <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-red-600">Out of Stock</DialogTitle>
            <DialogDescription>
              Sorry, the item has ran out of stock, please try again later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 my-2">
            {outOfStockItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 bg-red-50 rounded border border-red-100">
                <span className="text-sm font-medium text-gray-800">{item.productName}</span>
                {item.variantName && (
                  <span className="text-xs text-gray-500">({item.variantName})</span>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={async () => {
              setShowOutOfStockDialog(false);
              await refresh();
              // After refresh, if items are empty, redirect
              if (items.length === 0) {
                router.replace('/landing/products');
              }
            }}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-red-500 rounded-full"></div></div>}>
      <PaymentPageContent />
    </Suspense>
  );
}
