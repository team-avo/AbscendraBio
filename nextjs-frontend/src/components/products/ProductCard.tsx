"use client";

import { useState } from 'react';
import { motion } from 'motion/react';
import { ShoppingCart, Minus, Plus, FlaskConical } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { useCart } from '@/contexts/cart-context';
import { resolveImageUrl } from '@/lib/api';
import { priceForCustomerType, CustomerType } from '@/lib/pricing';
import { toast } from 'sonner';
import { Barlow } from 'next/font/google';

const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800', '900'] });

interface ProductCardProps {
  product: any;
  index?: number;
  onQuickView: (id: string | number) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string | number) => void;
  className?: string;
}

function ProductCardImage({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = src ? resolveImageUrl(src) : null;

  if (!resolvedSrc || failed) {
    return (
      <div className={`${className} flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100`}>
        <FlaskConical className="w-10 h-10 text-slate-200" strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

export function ProductCard({
  product,
  index = 0,
  onQuickView,
  isFavorite = false,
  onToggleFavorite,
  className = ""
}: ProductCardProps) {
  const { isAuthenticated, user, openLoginModal } = useAuth();
  const { add, items, update } = useCart();

  const [addingToCart, setAddingToCart] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  // Pricing
  const customerType = (user?.customer?.customerType || (user?.role === 'CUSTOMER' ? 'B2C' : undefined)) as CustomerType | undefined;
  const pricing = priceForCustomerType(product, customerType);

  // Cart qty for this variant
  const variantId = product._firstVariantId || (product.variants && product.variants[0]?.id);
  const cartItem = variantId ? items.find(it => it.variantId === variantId) : undefined;
  const currentQty = cartItem?.quantity || 0;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      toast.info('Sign in to add items to your cart');
      openLoginModal('customer');
      return;
    }
    if (!variantId) {
      toast.error('Product variation not found');
      return;
    }
    setAddingToCart(true);
    try {
      await add(variantId, 1, pricing.price);
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1000);
    } catch (error: any) {
      toast.error(error.message || 'Failed to add to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleQtyChange = async (e: React.MouseEvent, newQty: number) => {
    e.stopPropagation();
    if (!variantId) return;
    try {
      await update(variantId, Math.max(0, newQty));
    } catch (error: any) {
      toast.error(error.message || 'Failed to update quantity');
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5, delay: index * 0.04, ease: [0.23, 1, 0.32, 1] }}
      className={`h-full ${className}`}
    >
      <Card
        className="group relative bg-white border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.04)] hover:shadow-[0_16px_48px_rgba(7,11,20,0.1)] transition-all duration-500 rounded-[1.75rem] cursor-pointer h-full flex flex-col overflow-hidden"
        onClick={() => onQuickView(product.id)}
      >
        <CardContent className="p-2 flex flex-col h-full">

          {/* ── Image ── */}
          <div className="relative aspect-square overflow-hidden rounded-[1.25rem] bg-gray-50 border border-white/80 isolate">
            <ProductCardImage
              src={product.image || (product.images && product.images[0]?.url)}
              alt={product.name}
              className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-[1.2s] ease-out mix-blend-multiply"
            />

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-[#070B14]/5 opacity-50" />

            {/* Price badge */}
            <div className="absolute top-2.5 right-2.5 z-20">
              <div className="bg-[#070B14]/90 text-white backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 shadow-lg min-w-[52px] flex items-center justify-center">
                {isAuthenticated ? (
                  <span className="text-[11px] font-black tabular-nums leading-none">${pricing.price.toFixed(2)}</span>
                ) : (
                  <span className="text-[8px] font-black uppercase tracking-wider opacity-60 leading-none">Login</span>
                )}
              </div>
            </div>

            {/* Purity badge — shows on hover */}
            <div className="absolute bottom-2.5 right-2.5 z-20 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-400">
              <div className="bg-emerald-500/10 backdrop-blur-md border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                <div className="w-1 h-1 rounded-full bg-emerald-500" />
                <span className="text-[7px] font-bold uppercase tracking-widest text-emerald-600">99%+ pure</span>
              </div>
            </div>

            {/* Out of stock overlay */}
            {product.inStock === false && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center z-30">
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 border border-gray-200 px-3 py-1.5 rounded-full bg-white/80">
                  Out of Stock
                </span>
              </div>
            )}
          </div>

          {/* ── Info ── */}
          <div className="px-2 pt-3 pb-1 flex flex-col flex-1">
            <span className="text-[8px] font-bold uppercase tracking-widest text-gray-400 leading-none block mb-1">
              {product.category || 'Research Peptide'}
            </span>
            <h3 className={`text-[13px] font-extrabold text-[#070B14] leading-tight tracking-tight line-clamp-2 uppercase flex-1 ${barlow.className}`}>
              {product.name}
            </h3>

            <div className="mt-3 flex items-center justify-between">
              {/* Verified badge */}
              <div className="flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                <div className="w-1 h-1 rounded-full bg-emerald-500" />
                <span className="text-[7px] font-black uppercase tracking-widest text-emerald-600">Verified</span>
              </div>

              {/* Cart controls */}
              {currentQty > 0 ? (
                /* ── Quantity stepper ── */
                <div
                  className="flex items-center gap-0.5 bg-[#070B14] rounded-xl p-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={(e) => handleQtyChange(e, currentQty - 1)}
                    className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                  >
                    <Minus className="w-3 h-3 text-white" />
                  </button>
                  <span className="w-6 text-center text-[11px] font-black text-white">{currentQty}</span>
                  <button
                    onClick={(e) => handleQtyChange(e, currentQty + 1)}
                    className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                  >
                    <Plus className="w-3 h-3 text-white" />
                  </button>
                </div>
              ) : (
                /* ── Add to cart ── */
                <button
                  disabled={product.inStock === false || addingToCart}
                  onClick={handleAddToCart}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 shrink-0 active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed
                    ${justAdded
                      ? 'bg-emerald-500 shadow-lg shadow-emerald-500/20'
                      : 'bg-[#070B14] hover:bg-[#1a2540] shadow-md hover:shadow-lg hover:-translate-y-0.5'
                    }`}
                >
                  {addingToCart ? (
                    <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <ShoppingCart className="w-3.5 h-3.5 text-white" />
                  )}
                </button>
              )}
            </div>
          </div>

        </CardContent>
      </Card>
    </motion.div>
  );
}
