"use client";

import React, { ReactNode } from "react";
import Link from "next/link";
import { X, ShoppingBag, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/contexts/cart-context";
import { resolveImageUrl } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { AuthModal } from "@/components/auth/AuthModal";
import { formatCurrency, formatDiscountPercentage } from "@/utils/discount";
import { toast } from "sonner";
import { getPricingCustomerType } from "@/utils/pricingMapper";
import { Barlow } from "next/font/google";

const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"] });

interface CartSidebarProps {
  trigger: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CartSidebar({ trigger, open, onOpenChange }: CartSidebarProps) {
  const { items, subtotal, discount, total, loading, update, remove } = useCart();
  const { user, isAuthenticated } = useAuth();
  const customerType = (user as any)?.customer?.customerType as 'B2C' | 'B2B' | 'ENTERPRISE_1' | 'ENTERPRISE_2' | undefined;
  const router = useRouter();
  const [authOpen, setAuthOpen] = React.useState(false);

  const getItemPrice = (it: any) => {
    // PRIORITY 1: Use unitPrice from backend (already calculated with correct pricing tier)
    if (it.unitPrice != null && Number(it.unitPrice) > 0) {
      const price = Number(it.unitPrice);
      const regularPrice = Number(it.variant?.regularPrice || 0);
      return { price, isBulkPrice: false, regularPrice, savings: regularPrice - price };
    }

    const pricingType = getPricingCustomerType(customerType);
    let price = 0;
    let isBulkPrice = false;

    if (it?.variant?.bulkPrices && Array.isArray(it.variant.bulkPrices)) {
      const applicableBulk = it.variant.bulkPrices.find((bp: any) => {
        const minQty = Number(bp.minQty);
        const maxQty = bp.maxQty ? Number(bp.maxQty) : Infinity;
        return it.quantity >= minQty && it.quantity <= maxQty;
      });
      if (applicableBulk) { price = Number(applicableBulk.price); isBulkPrice = true; }
    }

    if (!isBulkPrice && pricingType && it?.variant?.segmentPrices) {
      const seg = it?.variant?.segmentPrices?.find?.((sp: any) => sp.customerType === pricingType);
      if (seg) price = Number(seg.salePrice > 0 ? seg.salePrice : seg.regularPrice ?? 0);
      else price = Number(it.variant?.regularPrice ?? 0);
    } else if (!isBulkPrice && it?.variant) {
      const salePrice = Number(it?.variant?.salePrice ?? 0);
      const variantRegularPrice = Number(it?.variant?.regularPrice ?? 0);
      price = salePrice > 0 ? salePrice : variantRegularPrice;
    }

    const regularPrice = Number(it.variant?.regularPrice || 0);
    const savings = regularPrice - price;
    return { price, isBulkPrice, regularPrice, savings };
  };

  const getStock = (it: any) => {
    const canSellOutOfStock = it?.variant?.inventory?.some((inv: any) => inv.sellWhenOutOfStock) || false;
    const totalAvailable = it?.variant?.inventory?.reduce((sum: number, inv: any) => {
      return sum + Math.max(0, (inv.quantity || 0) - (inv.reservedQty || 0));
    }, 0) || 0;
    return { canSellOutOfStock, totalAvailable, isOutOfStock: totalAvailable < it.quantity && !canSellOutOfStock };
  };

  const hasOutOfStockItems = items.some(it => getStock(it).isOutOfStock);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className={`force-light p-0 rounded-3xl overflow-hidden max-h-[85vh] flex flex-col w-full max-w-md border-0 shadow-2xl gap-0 ${barlow.className}`}>
        <DialogTitle className="sr-only">Your Cart</DialogTitle>
        <DialogDescription className="sr-only">Review items in your cart</DialogDescription>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#070B14] flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-black text-[#070B14]">Your Cart</h2>
              <p className="text-[10px] text-gray-400 font-medium">{items.reduce((s, it) => s + it.quantity, 0)} {items.reduce((s, it) => s + it.quantity, 0) === 1 ? 'item' : 'items'}</p>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-[#4D7DF2] animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                <ShoppingBag className="w-7 h-7 text-gray-300" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-gray-700">Your cart is empty</p>
                <p className="text-xs text-gray-400 mt-1">Add some products to get started</p>
              </div>
            </div>
          ) : (
            items.map((it) => {
              const { price, isBulkPrice, savings } = getItemPrice(it);
              const { totalAvailable, canSellOutOfStock, isOutOfStock } = getStock(it);

              return (
                <div key={it.variantId} className="flex gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                  {/* Image */}
                  <div className="w-16 h-16 rounded-xl bg-white border border-gray-100 overflow-hidden shrink-0">
                    <img
                      src={resolveImageUrl(it.variant?.product?.images?.[0]?.url || '/products/peptide-1.jpg')}
                      alt={it.variant?.product?.name || 'Product'}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-[#070B14] line-clamp-1 uppercase tracking-tight">
                      {it.variant?.product?.name ?? 'Product'}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{it.variant?.name}</p>

                    <div className="flex items-center justify-between mt-2">
                      {/* Qty stepper */}
                      <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-0.5">
                        <button
                          onClick={async () => {
                            try { await update(it.variantId, Math.max(0, it.quantity - 1)) }
                            catch (e: any) { toast.error(e.message || 'Failed to update') }
                          }}
                          className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
                        >
                          <Minus className="w-3 h-3 text-gray-600" />
                        </button>
                        <span className="w-6 text-center text-xs font-black text-[#070B14]">{it.quantity}</span>
                        <button
                          onClick={async () => {
                            try { await update(it.variantId, it.quantity + 1) }
                            catch (e: any) { toast.error(e.message || 'Failed to update') }
                          }}
                          className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
                        >
                          <Plus className="w-3 h-3 text-gray-600" />
                        </button>
                      </div>

                      {/* Price + remove */}
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-black text-[#070B14]">${price.toFixed(2)}</p>
                          {isBulkPrice && savings > 0 && (
                            <p className="text-[9px] text-emerald-600 font-bold">Bulk price</p>
                          )}
                        </div>
                        <button
                          onClick={() => remove(it.variantId)}
                          className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {isOutOfStock && (
                      <p className="text-[9px] font-bold text-red-500 mt-1.5 uppercase tracking-widest">
                        Only {totalAvailable} available
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-gray-100 px-6 py-5 space-y-3 bg-white">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 font-medium">Subtotal</span>
              <span className="font-black text-[#070B14]">{formatCurrency(subtotal)}</span>
            </div>

            {discount.isEligible && discount.discountAmount > 0 && (
              <>
                <div className="flex items-center justify-between text-sm text-emerald-600">
                  <span className="font-medium">Discount ({formatDiscountPercentage(discount.discountPercentage)})</span>
                  <span className="font-bold">-{formatCurrency(discount.discountAmount)}</span>
                </div>
                <Separator className="bg-gray-100" />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-[#070B14]">Total</span>
                  <span className="text-lg font-black text-[#070B14]">{formatCurrency(total)}</span>
                </div>
              </>
            )}

            {hasOutOfStockItems && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs font-medium text-red-600">
                Some items in your cart are out of stock. Please adjust quantities.
              </div>
            )}

            <Button
              className="w-full h-12 rounded-2xl bg-[#070B14] hover:bg-[#1a2540] text-white font-black uppercase tracking-widest text-[10px] shadow-lg transition-all duration-300"
              disabled={items.length === 0 || hasOutOfStockItems}
              onClick={() => {
                if (!isAuthenticated) { setAuthOpen(true); return; }
                router.push('/landing/checkout');
              }}
            >
              {discount.isEligible
                ? `Checkout — ${formatCurrency(total)}`
                : `Checkout — ${formatCurrency(subtotal)}`}
            </Button>

            <Link href="/landing/products" className="block">
              <Button variant="ghost" className="w-full h-10 rounded-2xl text-gray-400 hover:text-gray-600 text-xs font-bold">
                Continue Shopping
              </Button>
            </Link>
          </div>
        )}
      </DialogContent>
      <AuthModal isOpen={authOpen} onOpenChange={setAuthOpen} />
    </Dialog>
  );
}
