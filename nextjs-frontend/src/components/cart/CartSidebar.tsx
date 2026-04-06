"use client";

import React, { ReactNode, useState } from "react";
import { Copy, Check, Tag } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/contexts/cart-context";
import { resolveImageUrl } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { AuthModal } from "@/components/auth/AuthModal";
import { formatCurrency, formatDiscountPercentage } from "@/utils/discount";
import { toast } from "sonner";
import { getPricingCustomerType } from "@/utils/pricingMapper";
import logger from '@/lib/logger';

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
  const [couponCopied, setCouponCopied] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        {trigger}
      </SheetTrigger>
      <SheetContent side="right" className="force-light w-[100vw] max-w-full sm:max-w-md md:max-w-lg lg:max-w-xl p-0 h-dvh overflow-hidden bg-background text-foreground">
        <div className="flex h-full flex-col">
          <div className="px-4 py-3 border-b">
            <SheetHeader>
              <SheetTitle>Cart</SheetTitle>
            </SheetHeader>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Items</span>
              <span>{items.length}</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-transparent" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-10">Your cart is empty.</div>
            ) : (
              <div className="space-y-3">
                {items.map((it) => (
                  <div key={it.variantId} className="flex items-center gap-3 p-3 border rounded-md">
                    <div className="w-14 h-14 bg-gray-50 rounded border overflow-hidden">
                      <img src={resolveImageUrl(it.variant?.product?.images?.[0]?.url || '/products/peptide-1.jpg')} alt={it.variant?.product?.name || 'Product'} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm line-clamp-1">{it.variant?.product?.name ?? 'Product'}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">{it.variant?.name}</div>
                      <div className="text-xs text-muted-foreground">SKU: {it.variant?.sku}</div>
                      <div className="text-sm font-semibold mt-1">
                        {(() => {
                          logger.info("=== CART ITEM PRICING DEBUG ===");
                          logger.info("User:", { data: user });
                          logger.info("Customer Type:", { data: customerType });
                          logger.info("Item:", { data: it });
                          logger.info("Variant:", { data: it.variant });
                          logger.info("Segment Prices:", { data: (it as any)?.variant?.segmentPrices });

                          let price = 0;
                          let regularPrice = Number(it.variant?.regularPrice || 0);
                          let isBulkPrice = false;

                          // Map customer type to pricing tier (B2B->B2C, ENTERPRISE_2->ENTERPRISE_1)
                          const pricingType = getPricingCustomerType(customerType);
                          logger.info("Pricing Type (mapped):", { data: pricingType });

                          // Check for bulk pricing first
                          if ((it as any)?.variant?.bulkPrices && Array.isArray((it as any).variant.bulkPrices)) {
                            const bulkPrices = (it as any).variant.bulkPrices;
                            const applicableBulk = bulkPrices.find((bp: any) => {
                              const minQty = Number(bp.minQty);
                              const maxQty = bp.maxQty ? Number(bp.maxQty) : Infinity;
                              return it.quantity >= minQty && it.quantity <= maxQty;
                            });

                            if (applicableBulk) {
                              price = Number(applicableBulk.price);
                              isBulkPrice = true;
                              logger.info("Using BULK price:", { data: price });
                            }
                          }

                          // CRITICAL: Check segment pricing for ALL customer types (including B2C)
                          if (!isBulkPrice && pricingType && (it as any)?.variant?.segmentPrices) {
                            logger.info("Checking segment prices for type:", { data: pricingType });
                            const seg = (it as any)?.variant?.segmentPrices?.find?.((sp: any) => sp.customerType === pricingType);
                            logger.info("Found segment price:", { data: seg });
                            if (seg) {
                              price = Number(seg.salePrice > 0 ? seg.salePrice : seg.regularPrice ?? 0);
                              logger.info("Using SEGMENT price:", { data: price, salePrice: seg.salePrice, regularPrice: seg.regularPrice });
                            } else {
                              // No segment price found, use variant's regular price
                              price = Number(it.variant?.regularPrice ?? 0);
                              logger.info("No segment price found, using variant regular price:", { data: price });
                            }
                          }
                          // If no segment pricing and no customer type, use variant's sale price or regular price
                          else if (!isBulkPrice && (it as any)?.variant) {
                            const salePrice = Number((it as any)?.variant?.salePrice ?? 0);
                            const variantRegularPrice = Number((it as any)?.variant?.regularPrice ?? 0);
                            price = salePrice > 0 ? salePrice : variantRegularPrice;
                            logger.info("Using VARIANT price (no segment):", { data: price, salePrice, regularPrice: variantRegularPrice });
                          }
                          // Fallback: if no variant data, use stored unitPrice (should rarely happen)
                          else if (!isBulkPrice && it.unitPrice) {
                            price = Number(it.unitPrice);
                            logger.info("Using STORED unitPrice (fallback):", { data: price });
                          }

                          logger.info("FINAL PRICE:", { data: price });
                          logger.info("=== END DEBUG ===");

                          const savings = regularPrice - price;
                          const savingsPercent = regularPrice > 0 ? ((savings / regularPrice) * 100).toFixed(0) : 0;

                          return (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span>${price.toFixed(2)}</span>
                                {isBulkPrice && (
                                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">
                                    Bulk Price
                                  </span>
                                )}
                              </div>
                              {isBulkPrice && savings > 0 && (
                                <div className="text-xs text-green-600">
                                  Save ${savings.toFixed(2)} ({savingsPercent}%)
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            await update(it.variantId, Math.max(0, it.quantity - 1));
                          } catch (error: any) {
                            toast.error(error.message || 'Failed to update quantity');
                          }
                        }}
                      >-</Button>
                      <input
                        type="number"
                        min="1"
                        max={(() => {
                          const canSellOutOfStock = (it as any)?.variant?.inventory?.some((inv: any) => inv.sellWhenOutOfStock) || false;
                          if (canSellOutOfStock) return 9999; // No limit if backorders allowed

                          const totalAvailable = (it as any)?.variant?.inventory?.reduce((sum: number, inv: any) => {
                            const available = Math.max(0, (inv.quantity || 0) - (inv.reservedQty || 0));
                            return sum + available;
                          }, 0) || 0;
                          return totalAvailable > 0 ? totalAvailable : 9999;
                        })()}
                        value={it.quantity}
                        onChange={async (e) => {
                          const newQuantity = parseInt(e.target.value) || 1;
                          const canSellOutOfStock = (it as any)?.variant?.inventory?.some((inv: any) => inv.sellWhenOutOfStock) || false;

                          let finalQuantity = newQuantity;
                          if (!canSellOutOfStock) {
                            const maxAvailable = (it as any)?.variant?.inventory?.reduce((sum: number, inv: any) => {
                              const available = Math.max(0, (inv.quantity || 0) - (inv.reservedQty || 0));
                              return sum + available;
                            }, 0) || 0;

                            if (maxAvailable > 0) {
                              finalQuantity = Math.max(1, Math.min(newQuantity, maxAvailable));
                            }
                          }

                          try {
                            await update(it.variantId, finalQuantity);
                          } catch (error: any) {
                            toast.error(error.message || 'Failed to update quantity');
                          }
                        }}
                        className="w-12 h-8 text-center text-sm border border-gray-300 rounded focus:border-red-500 focus:outline-none"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            await update(it.variantId, it.quantity + 1);
                          } catch (error: any) {
                            toast.error(error.message || 'Failed to update quantity');
                          }
                        }}
                      >+</Button>
                    </div>
                    {/* Show stock info and out-of-stock warning */}
                    {(it as any)?.variant?.inventory && (() => {
                      logger.info("=== INVENTORY DEBUG ===");
                      logger.info("Variant ID:", { data: it.variantId });
                      logger.info("Inventory Data:", { data: (it as any).variant.inventory });

                      const totalAvailable = (it as any).variant.inventory.reduce((sum: number, inv: any) => {
                        const available = Math.max(0, (inv.quantity || 0) - (inv.reservedQty || 0));
                        logger.info("Inventory Location:", {
                          data: {
                            locationId: inv.locationId,
                            quantity: inv.quantity,
                            reservedQty: inv.reservedQty,
                            available: available,
                            sellWhenOutOfStock: inv.sellWhenOutOfStock
                          }
                        });
                        return sum + available;
                      }, 0);

                      const canSellOutOfStock = (it as any).variant.inventory.some((inv: any) => inv.sellWhenOutOfStock);
                      const isOutOfStock = totalAvailable < it.quantity && !canSellOutOfStock;

                      logger.info("Total Available:", { data: totalAvailable });
                      logger.info("Requested Quantity:", { data: it.quantity });
                      logger.info("Can Sell Out Of Stock:", { data: canSellOutOfStock });
                      logger.info("Is Out Of Stock:", { data: isOutOfStock });
                      logger.info("=== END INVENTORY DEBUG ===");

                      return (
                        <div className="text-xs mt-1">
                          {isOutOfStock ? (
                            <div className="text-red-600 font-semibold">
                              ⚠️ Out of Stock (Available: {totalAvailable})
                            </div>
                          ) : totalAvailable > 0 ? (
                            <div className="text-gray-500">
                              {totalAvailable} left in stock
                            </div>
                          ) : null}
                        </div>
                      );
                    })()}
                    <Button variant="ghost" size="sm" onClick={() => remove(it.variantId)}>Remove</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="border-t p-4 space-y-3">


            <div className="flex items-center justify-between text-sm font-medium">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>



            {discount.isEligible && (
              <>
                <div className="flex items-center justify-between text-sm text-green-600">
                  <span>High-Value Discount ({formatDiscountPercentage(discount.discountPercentage)})</span>
                  <span>-{formatCurrency(discount.discountAmount)}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </>
            )}

            {/* Out of stock warning */}
            {(() => {
              const hasOutOfStockItems = items.some(it => {
                const totalAvailable = (it as any)?.variant?.inventory?.reduce((sum: number, inv: any) => {
                  const available = Math.max(0, (inv.quantity || 0) - (inv.reservedQty || 0));
                  return sum + available;
                }, 0) || 0;
                const canSellOutOfStock = (it as any)?.variant?.inventory?.some((inv: any) => inv.sellWhenOutOfStock) || false;
                return totalAvailable < it.quantity && !canSellOutOfStock;
              });

              if (hasOutOfStockItems) {
                return (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                    ⚠️ Some items are out of stock. Please remove them or reduce quantities to proceed.
                  </div>
                );
              }
              return null;
            })()}

            <Button
              className="w-full"
              disabled={
                items.length === 0 ||
                items.some(it => {
                  const totalAvailable = (it as any)?.variant?.inventory?.reduce((sum: number, inv: any) => {
                    const available = Math.max(0, (inv.quantity || 0) - (inv.reservedQty || 0));
                    return sum + available;
                  }, 0) || 0;
                  const canSellOutOfStock = (it as any)?.variant?.inventory?.some((inv: any) => inv.sellWhenOutOfStock) || false;
                  return totalAvailable < it.quantity && !canSellOutOfStock;
                })
              }
              onClick={() => {
                if (!isAuthenticated) { setAuthOpen(true); return; }
                router.push('/landing/checkout');
              }}
            >
              {discount.isEligible ? `Checkout - ${formatCurrency(total)}` : `Checkout - ${formatCurrency(subtotal)}`}
            </Button>
            <Link href="/landing/products" className="block">
              <Button variant="outline" className="w-full">Continue Shopping</Button>
            </Link>
          </div>
        </div>
      </SheetContent>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </Sheet>
  );
}


