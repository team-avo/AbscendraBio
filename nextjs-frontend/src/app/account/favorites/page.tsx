"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ProtectedRoute, useAuth } from "@/contexts/auth-context";
import { api, type Product, resolveImageUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

type FavoriteRecord = { id: string; product: Product & { images?: { url: string; altText?: string }[]; variants?: { id: string; name: string; regularPrice: number; salePrice?: number }[] } };

export default function AccountFavoritesPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [favorites, setFavorites] = useState<FavoriteRecord[]>([]);

  useEffect(() => {
    (async () => {
      if (!user?.customerId) return;
      setLoading(true);
      const res = await api.getFavorites(user.customerId, { page: 1, limit: 100 });
      if (res.success && res.data) {
        setFavorites(res.data.favorites as any);
      }
      setLoading(false);
    })();
  }, [user?.customerId]);

  async function removeFavorite(favoriteId: string) {
    if (!user?.customerId) return;
    const res = await api.removeFavorite(user.customerId, favoriteId);
    if (res.success) {
      setFavorites(prev => prev.filter(f => f.id !== favoriteId));
      toast.success('Removed from favorites');
    }
  }

  return (
    <ProtectedRoute requiredRoles={["CUSTOMER"]}>
      <div className="space-y-6">
        {/* Dark Hero Strip */}
        <div className="relative bg-[#070B14] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
          {/* Grid texture */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          {/* Blue glow */}
          <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#4D7DF2]/8 rounded-full blur-[100px] pointer-events-none" />
          <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">MY FAVORITES</h1>
                <p className="text-xs text-white/40 mt-1">Your saved products</p>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/landing/products" className="inline-flex items-center gap-1.5 bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-2 text-xs font-medium text-white/70 hover:bg-white/[0.10] hover:text-white transition-all">
                  Explore Products
                </Link>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-600">Loading favorites...</div>
        ) : favorites.length === 0 ? (
          <div className="py-16 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-gray-700 mb-4"><Heart className="w-4 h-4" /> No favorites yet</div>
            <p className="text-gray-600 mb-6">Browse products and tap the heart to save them here.</p>
            <Link href="/landing/products" className="inline-flex items-center bg-[#1B2D4F] text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-[#243d6b] transition-all">
              Explore Products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {favorites.map(({ id, product }) => {
              const img = product.images && product.images[0]?.url ? resolveImageUrl(product.images[0].url) : resolveImageUrl("/products/peptide-1.jpg");
              const v = (product.variants || [])[0];
              const price = v ? (v.salePrice ?? v.regularPrice) : 0;
              const original = v?.salePrice ? v.regularPrice : null;
              return (
                <div key={id} className="group rounded-xl border border-gray-200 bg-white hover:shadow-lg transition-all duration-300 overflow-hidden">
                  <div className="relative aspect-square bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
                    <Link href={`/landing/products/${product.id}`} className="absolute inset-0 z-10" aria-label={product.name} />
                    <Image src={img} alt={product.name} fill sizes="(max-width: 1024px) 100vw, 20vw" className="object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute top-3 right-3 flex gap-2 z-20">
                      <Button size="icon" variant="secondary" className="rounded-full" aria-label="Remove from favorites" onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeFavorite(id); }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-black line-clamp-1">{product.name}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-black">${Number(price).toFixed(2)}</span>
                      {original != null && (<span className="text-sm text-gray-500 line-through">${Number(original).toFixed(2)}</span>)}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Link href={`/landing/products/${product.id}`} className="flex-1 inline-flex items-center justify-center bg-[#1B2D4F] hover:bg-[#243d6b] text-white rounded-xl px-3 py-2 text-sm font-semibold transition-all">View</Link>
                      <button className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-all" onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeFavorite(id); }}>Remove</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ProtectedRoute >
  );
}


