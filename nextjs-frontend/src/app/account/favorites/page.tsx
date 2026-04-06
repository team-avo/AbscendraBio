"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ProtectedRoute, useAuth } from "@/contexts/auth-context";
import { api, type Product, resolveImageUrl } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
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
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">My Favorites</h1>
          <p className="text-sm text-gray-600">Quick access to your saved products</p>
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-600">Loading favorites...</div>
        ) : favorites.length === 0 ? (
          <div className="py-16 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-gray-700 mb-4"><Heart className="w-4 h-4" /> No favorites yet</div>
            <p className="text-gray-600 mb-6">Browse products and tap the heart to save them here.</p>
            <Button asChild className="bg-gradient-to-r from-red-500 to-red-600 text-white border-0">
              <Link href="/landing/products">Explore Products</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {favorites.map(({ id, product }) => {
              const img = product.images && product.images[0]?.url ? resolveImageUrl(product.images[0].url) : resolveImageUrl("/products/peptide-1.jpg");
              const v = (product.variants || [])[0];
              const price = v ? (v.salePrice ?? v.regularPrice) : 0;
              const original = v?.salePrice ? v.regularPrice : null;
              return (
                <Card key={id} className="group hover:shadow-lg transition-all duration-300 border-gray-200">
                  <CardContent className="p-0">
                    <div className="relative aspect-square bg-gradient-to-br from-gray-50 to-gray-100 rounded-t-lg overflow-hidden">
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
                        <Button asChild className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white border-0">
                          <Link href={`/landing/products/${product.id}`}>View</Link>
                        </Button>
                        <Button variant="outline" className="border-gray-300" onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeFavorite(id); }}>Remove</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </ProtectedRoute >
  );
}


