"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, type ProductVariant } from '@/lib/api';
import logger from '@/lib/logger';
import { useAuth } from '@/contexts/auth-context';
import { calculateHighValueDiscount, type DiscountInfo } from '@/utils/discount';
import { getPricingCustomerType } from '@/utils/pricingMapper';
import { bulkUnitPrice } from '@/lib/bulkTiers';

type GuestCartItem = { variantId: string; quantity: number; unitPrice?: number };
type CartItem = { id?: string; variantId: string; quantity: number; unitPrice?: number; variant?: ProductVariant & { product?: any } };

type CartContextValue = {
  items: CartItem[];
  subtotal: number;
  discount: DiscountInfo;
  total: number;
  loading: boolean;
  add: (variantId: string, quantity?: number, unitPrice?: number) => Promise<void>;
  update: (variantId: string, quantity: number) => Promise<void>;
  remove: (variantId: string) => Promise<void>;
  refresh: () => Promise<void>;
  clear: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);
const GUEST_CART_KEY = 'guest_cart_items_v1';

function readGuestCart(): GuestCartItem[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(GUEST_CART_KEY) || '[]'); } catch { return []; }
}
function writeGuestCart(items: GuestCartItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isCustomer = user?.role === 'CUSTOMER' && !!user.customerId;
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true); // true until first fetch completes

  const customerType = (user as any)?.customer?.customerType as 'B2C' | 'B2B' | 'ENTERPRISE_1' | 'ENTERPRISE_2' | undefined;
  const isB2B = customerType === 'B2B';

  // Compute subtotal from current customer tier pricing rules and bulk pricing
  const subtotal = useMemo(() => {
    // Map customer type to pricing tier (B2B->B2C, ENTERPRISE_2->ENTERPRISE_1)
    const pricingType = getPricingCustomerType(customerType);

    // Retail buyers (B2C / guest) get the public bulk-quantity discount; only
    // enterprise/wholesale accounts are excluded.
    const isWholesale = !!pricingType && pricingType !== 'B2C';

    return items.reduce((sum, it) => {
      let basePrice: number = 0;

      // PUBLIC RETAIL BULK TIER: recompute off the regular listed price using
      // the line's CURRENT quantity, so quantity changes in the cart re-band
      // correctly. Computed here (not from a stored unitPrice) for retail only.
      const regularPrice = Number((it as any)?.variant?.regularPrice ?? 0);
      if (!isWholesale && regularPrice > 0) {
        return sum + bulkUnitPrice(regularPrice, it.quantity) * it.quantity;
      }

      // PRIORITY 1: Use unitPrice from backend if available (it's already calculated with latest pricing)
      // The backend GET /cart endpoint now returns unitPrice calculated using:
      // 1. Bulk pricing (if quantity qualifies)
      // 2. Customer segment pricing (B2C, ENTERPRISE_1)
      // 3. Base variant pricing
      if (it.unitPrice != null && it.unitPrice > 0) {
        basePrice = Number(it.unitPrice);
        return sum + (basePrice * it.quantity);
      }

      // PRIORITY 2: Check for bulk pricing FIRST based on quantity (fallback for guest carts)
      if ((it as any)?.variant?.bulkPrices && Array.isArray((it as any).variant.bulkPrices)) {
        const bulkPrices = (it as any).variant.bulkPrices;
        // Find applicable bulk price tier
        const applicableBulk = bulkPrices.find((bp: any) => {
          const minQty = Number(bp.minQty);
          const maxQty = bp.maxQty ? Number(bp.maxQty) : Infinity;
          return it.quantity >= minQty && it.quantity <= maxQty;
        });

        if (applicableBulk) {
          basePrice = Number(applicableBulk.price);
          return sum + (basePrice * it.quantity);
        }
      }

      // PRIORITY 3: Check segment pricing for ALL customer types (including B2C)
      if (pricingType && (it as any)?.variant?.segmentPrices) {
        const seg = (it as any)?.variant?.segmentPrices?.find?.((sp: any) => sp.customerType === pricingType);
        if (seg) {
          // Check if salePrice > 0, otherwise use regularPrice
          basePrice = Number(seg.salePrice > 0 ? seg.salePrice : seg.regularPrice ?? 0);
        } else {
          // No segment price found, use variant's regular price
          basePrice = Number((it as any)?.variant?.regularPrice ?? 0);
        }
      }
      // PRIORITY 4: If no segment pricing and no customer type, use variant's sale price or regular price
      else if ((it as any)?.variant) {
        const salePrice = Number((it as any)?.variant?.salePrice ?? 0);
        const regularPrice = Number((it as any)?.variant?.regularPrice ?? 0);
        basePrice = salePrice > 0 ? salePrice : regularPrice;
      }

      return sum + (basePrice * it.quantity);
    }, 0);
  }, [items, customerType]);
  const discount = useMemo(() => calculateHighValueDiscount(subtotal, !!isB2B), [subtotal, isB2B]);

  const total = useMemo(() => discount.discountedTotal, [discount.discountedTotal]);

  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Cart Context Debug:', {
      user,
      customerType,
      isB2B,
      subtotal,
      discountAmount: discount.discountAmount,
      total
    });
  }

  const loadAuthCart = useCallback(async () => {
    setLoading(true);
    const res = await api.getCart();
    if (res.success && res.data) {
      setItems((res.data.items || []).map(it => ({ id: it.id, variantId: it.variant.id, quantity: it.quantity, unitPrice: Number(it.unitPrice), variant: it.variant })));
    } else {
      setItems([]);
    }
    setLoading(false);
  }, []);

  const loadGuestCart = useCallback(async () => {
    setLoading(true);
    try {
      const guest = readGuestCart();
      if (guest.length === 0) { setItems([]); return; }

      const variantIds = guest.map(g => g.variantId);
      const batchRes = await api.getVariantsBatch(variantIds).catch(() => ({ success: false, data: [] as any[] }));
      const variantMap = new Map((batchRes.success && batchRes.data ? batchRes.data : []).map((v: any) => [v.id, v]));

      setItems(guest.map(g => ({
        variantId: g.variantId,
        quantity: g.quantity,
        unitPrice: g.unitPrice,
        variant: variantMap.get(g.variantId) ?? undefined,
      })));
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (isCustomer) await loadAuthCart(); else await loadGuestCart();
  }, [isCustomer, loadAuthCart, loadGuestCart]);

  // Initial load and user change
  useEffect(() => { refresh(); }, [refresh]);

  // Merge guest cart after login
  useEffect(() => {
    (async () => {
      if (isCustomer) {
        const guest = readGuestCart();
        if (guest.length > 0) {
          await api.mergeGuestCart(guest);
          writeGuestCart([]);
          await loadAuthCart();
        }
      }
    })();
  }, [isCustomer, loadAuthCart]);

  const add = useCallback(async (variantId: string, quantity: number = 1, unitPrice?: number) => {
    try {
      if (isCustomer) {
        const result = await api.addToCart(variantId, quantity);
        if (!result.success) {
          throw new Error(result.error || 'Failed to add item to cart');
        }
        await loadAuthCart();
      } else {
        const guest = readGuestCart();
        const idx = guest.findIndex(g => g.variantId === variantId);
        if (idx >= 0) {
          guest[idx].quantity += quantity;
          // preserve existing unitPrice if present; otherwise set if provided
          if (guest[idx].unitPrice == null && unitPrice != null) guest[idx].unitPrice = unitPrice;
        } else {
          guest.push({ variantId, quantity, unitPrice });
        }
        writeGuestCart(guest);
        await loadGuestCart();
      }
    } catch (error: any) {
      // Re-throw the error so it can be caught by the calling function
      throw error;
    }
  }, [isCustomer, loadAuthCart, loadGuestCart]);

  const update = useCallback(async (variantId: string, quantity: number) => {
    try {
      if (isCustomer) {
        const item = items.find(it => it.variantId === variantId);
        if (!item?.id) return;
        const result = await api.updateCartItem(item.id, quantity);
        if (!result.success) {
          throw new Error(result.error || 'Failed to update item quantity');
        }
        await loadAuthCart();
      } else {
        const guest = readGuestCart();
        const idx = guest.findIndex(g => g.variantId === variantId);
        if (idx >= 0) {
          if (quantity <= 0) guest.splice(idx, 1); else guest[idx].quantity = quantity;
          writeGuestCart(guest);
          await loadGuestCart();
        }
      }
    } catch (error: any) {
      // Re-throw the error so it can be caught by the calling function
      throw error;
    }
  }, [isCustomer, items, loadAuthCart, loadGuestCart]);

  const remove = useCallback(async (variantId: string) => {
    try {
      if (isCustomer) {
        const item = items.find(it => it.variantId === variantId);
        if (!item?.id) return;
        await api.removeCartItem(item.id);
        await loadAuthCart();
      } else {
        const guest = readGuestCart().filter(g => g.variantId !== variantId);
        writeGuestCart(guest);
        await loadGuestCart();
      }
    } catch (error: any) {
      // Re-throw the error so it can be caught by the calling function
      throw error;
    }
  }, [isCustomer, items, loadAuthCart, loadGuestCart]);

  const clear = useCallback(async () => {
    if (isCustomer) {
      await api.clearCart();
      await loadAuthCart();
    } else {
      writeGuestCart([]);
      await loadGuestCart();
    }
  }, [isCustomer, loadAuthCart, loadGuestCart]);

  const value = useMemo(() => ({ items, subtotal, discount, total, loading, add, update, remove, refresh, clear }), [items, subtotal, discount, total, loading, add, update, remove, refresh, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}


