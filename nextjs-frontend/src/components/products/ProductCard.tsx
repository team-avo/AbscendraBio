"use client";

import { useState } from 'react';
import { motion } from 'motion/react';
import { Heart, ShoppingCart, Check, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

function ProductCardImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [imgSrc, setImgSrc] = useState(resolveImageUrl(src));
  return (
    <img
      src={imgSrc || resolveImageUrl('/peptide-vial-bpc157.png')}
      alt={alt}
      className={className}
      onError={() => setImgSrc(resolveImageUrl('/peptide-vial-bpc157.png'))}
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
  const { add, items } = useCart();
  
  const [addingId, setAddingId] = useState<string | number | null>(null);
  const [justAdded, setJustAdded] = useState(false);

  // Pricing Logic
  const customerType = (user?.customer?.customerType || (user?.role === 'CUSTOMER' ? 'B2C' : undefined)) as CustomerType | undefined;
  const pricing = priceForCustomerType(product, customerType);

  // Cart Logic
  const variantId = product._firstVariantId || (product.variants && product.variants[0]?.id);
  const currentQty = variantId ? (items.find(it => it.variantId === variantId)?.quantity || 0) : 0;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      toast.info('Please sign in to shop');
      openLoginModal('customer');
      return;
    }
    if (!variantId) {
      toast.error('Product variation not found');
      return;
    }

    setAddingId(product.id);
    try {
      await add(variantId, 1, pricing.price);
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1200);
    } catch (error: any) {
      toast.error(error.message || 'Failed to add to cart');
    } finally {
      setAddingId(null);
    }
  };

  // Generate a pseudo-scientific serial ID based on product ID
  const serialId = `REF-${String(product.id).slice(0, 4).toUpperCase()}-${(index + 101).toString()}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.6, delay: index * 0.04, ease: [0.23, 1, 0.32, 1] }}
      className={`h-full ${className}`}
    >
      <Card 
        className="group relative bg-white border border-gray-100/50 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_32px_64px_rgba(27,45,79,0.12)] transition-all duration-700 rounded-[2rem] cursor-pointer h-full flex flex-col group/card overflow-hidden"
        onClick={() => onQuickView(product.id)}
      >
        {/* Subtle Background Grain/Texture (Optional via CSS) */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />

        <CardContent className="p-2 flex flex-col h-full relative z-10">
          {/* ──── SPECIMEN CONTAINER (COMPACT) ──── */}
          <div className="relative aspect-square overflow-hidden rounded-[1.2rem] bg-gray-50/50 border border-white/80 isolate shadow-inner">
            <ProductCardImage
              src={product.image || (product.images && product.images[0]?.url)}
              alt={product.name}
              className="object-cover w-full h-full group-hover/card:scale-105 transition-transform duration-[1.5s] ease-out mix-blend-multiply"
            />
            
            {/* Frosted Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-primary/5 opacity-40 mix-blend-overlay" />
            
            {/* Floating 'Lab Tag' Price */}
            <div className="absolute top-3 right-3 z-20">
              <div className="bg-primary/90 text-white backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-white/20 shadow-xl transform-gpu group-hover/card:-translate-y-0.5 transition-transform duration-500">
                {isAuthenticated ? (
                  <div className="flex flex-col items-end leading-none">
                    <span className="text-[10px] font-black tracking-tighter">
                      ${pricing.price.toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <span className="text-[7px] font-black uppercase tracking-widest opacity-90">Locked</span>
                )}
              </div>
            </div>

            {/* Purity Badge (Smaller) */}
            <div className="absolute bottom-3 right-3 z-20 opacity-0 group-hover/card:opacity-100 translate-y-1 group-hover/card:translate-y-0 transition-all duration-500">
               <div className="bg-emerald-500/10 backdrop-blur-md border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <div className="w-0.5 h-0.5 rounded-full bg-emerald-500" />
                  <span className="text-[7px] font-bold uppercase tracking-widest text-emerald-600">99%+ pure</span>
               </div>
            </div>

            {/* Out of Stock Overlay */}
            {product.inStock === false && (
              <div className="absolute inset-0 bg-primary/20 backdrop-blur-[1px] flex items-center justify-center z-30">
                <span className="text-[7px] font-black uppercase tracking-widest text-white border border-white/20 px-3 py-1.5 rounded-lg bg-primary/40 backdrop-blur-md">Depleted</span>
              </div>
            )}
          </div>

          {/* ──── TECHNICAL DATA AREA ──── */}
          <div className="px-1.5 pt-3 mb-1 flex flex-col flex-1 relative">
             {/* Vertical Serial ID (Monospace) - Even smaller */}
             <div className="absolute -right-0.5 top-4 rotate-90 origin-right translate-x-1 pointer-events-none opacity-20">
               <span className="text-[6px] font-medium font-mono text-primary uppercase tracking-[0.3em] whitespace-nowrap">{serialId}</span>
             </div>

            <div className="flex-1 space-y-1.5 pr-6">
              <span className="text-[7px] font-black uppercase tracking-widest text-primary/30 leading-none block">{product.category || 'High Purity Specimen'}</span>
              <h3 className={`text-sm font-extrabold text-primary leading-tight tracking-tight line-clamp-2 uppercase ${barlow.className}`}>
                {product.name}
              </h3>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                 <div className="flex items-center gap-1 bg-emerald-500/5 px-1.5 py-0.5 rounded-md border border-emerald-500/10">
                    <div className="w-0.5 h-0.5 rounded-full bg-emerald-500" />
                    <span className="text-[6px] font-black uppercase tracking-widest text-emerald-600">Verified</span>
                 </div>
              </div>
              
              <Button
                size="icon"
                disabled={product.inStock === false || addingId === product.id}
                className={`w-9 h-9 rounded-xl transition-all duration-500 shrink-0 transform-gpu active:scale-90 ${
                  currentQty > 0 || justAdded
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                    : 'bg-primary text-white shadow-xl shadow-primary/10 hover:bg-primary/90 hover:-translate-y-0.5'
                }`}
                onClick={handleAddToCart}
              >
                {addingId === product.id ? (
                  <span className="animate-spin w-3 h-3 border-2 border-white/20 border-t-white rounded-full" />
                ) : justAdded || currentQty > 0 ? (
                  <Check className="w-4 h-4 stroke-[3px]" />
                ) : (
                  <ShoppingCart className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
