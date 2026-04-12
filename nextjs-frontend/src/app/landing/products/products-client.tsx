'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Star, ShoppingCart, Eye, Heart, Grid3X3, List, SlidersHorizontal, Check, Minus, Plus, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { motion, AnimatePresence } from 'motion/react'
import { Barlow } from 'next/font/google'
import ProductDetailView from '@/components/products/ProductDetailView'
import { ProductCard } from '@/components/products/ProductCard'
import { priceForCustomerType } from '@/lib/pricing'

const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800', '900'] });

type Product = {
  id: string | number
  name: string
  fullName: string
  category: string
  price: number
  originalPrice: number | null
  rating: number
  reviews: number
  image: string
  inStock: boolean
  featured: boolean
  purity: string
  concentrations: string[]
  description: string
  _firstVariantId?: string
  _firstVariantName?: string
  _variantsPricing?: Array<{ id: string; name: string; regularPrice: number; salePrice?: number; segmentPrices?: Array<{ customerType: 'B2C' | 'B2B' | 'ENTERPRISE_1' | 'ENTERPRISE_2'; regularPrice: number; salePrice?: number }> }>
}

type Props = { products: Product[] }

import { useCart } from '@/contexts/cart-context'
import { useAuth } from '@/contexts/auth-context'
import { api, resolveImageUrl } from '@/lib/api'
import { toast } from 'sonner'
import { getPricingCustomerType } from '@/utils/pricingMapper'

export default function ProductsClient({ products }: Props) {
  const { add, items, update } = useCart()
  const { user, openLoginModal, isAuthenticated } = useAuth()
  const router = useRouter()
  const [quickViewId, setQuickViewId] = useState<string | number | null>(null)
  const [customerType, setCustomerType] = useState<'B2C' | 'B2B' | 'ENTERPRISE_1' | 'ENTERPRISE_2' | undefined>(undefined)
  const [favoriteIdsByProduct, setFavoriteIdsByProduct] = useState<Record<string, string>>({})
  const [loadingFavorites, setLoadingFavorites] = useState<boolean>(false)

  // URL State Management
  const searchParams = useSearchParams()
  const q = searchParams.get('q') || ''
  const s = searchParams.get('sort') || 'featured'
  const c = searchParams.get('cat') || 'All'
  const st = searchParams.get('stock') === 'true'

  // Local state for UI only (search/sort will be URL-driven)
  const [searchTerm, setSearchTerm] = useState(q)
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 200])
  const [maxPrice, setMaxPrice] = useState<number>(200)
  const [sortBy, setSortBy] = useState(s)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showFilters, setShowFilters] = useState(searchParams.get('filters') === 'open')
  const [inStockOnly, setInStockOnly] = useState(st)
  const [selectedCategory, setSelectedCategory] = useState<string>(c)

  // Sync internal state when URL changes
  useEffect(() => { setSearchTerm(q) }, [q])
  useEffect(() => { setSortBy(s) }, [s])
  useEffect(() => { setSelectedCategory(c) }, [c])
  useEffect(() => { setInStockOnly(st) }, [st])
  useEffect(() => { 
    if (searchParams.get('filters') === 'open') setShowFilters(true)
    else setShowFilters(false)
  }, [searchParams])

  // Helper to update URL params
  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, val]) => {
      if (val === null || val === 'All' || val === 'featured' || val === '' || val === 'false') {
        params.delete(key)
      } else {
        params.set(key, val)
      }
    })
    router.replace(`/landing/products?${params.toString()}`, { scroll: false })
  }

  // Derive unique categories for Pill navigation
  const categories = useMemo(() => {
    const set = new Set(products.map(p => p.category).filter(Boolean))
    return ['All', ...Array.from(set)]
  }, [products])



  const filtered = products
    .filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.fullName.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesPrice = p.price >= priceRange[0] && p.price <= priceRange[1]
      const matchesStock = !inStockOnly || p.inStock
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory
      return matchesSearch && matchesPrice && matchesStock && matchesCategory
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return a.price - b.price
        case 'price-high':
          return b.price - a.price
        case 'rating':
          return b.rating - a.rating
        case 'name':
          return a.name.localeCompare(b.name)
        default:
          return (b.featured ? 1 : 0) - (a.featured ? 1 : 0)
      }
    })

  // Set dynamic max price and widen initial range to include all products
  useEffect(() => {
    if (!products || products.length === 0) return
    const discoveredMax = Math.max(...products.map(p => Number(p.price || 0)))
    const rounded = Math.max(50, Math.ceil(discoveredMax / 10) * 10)
    setMaxPrice(rounded)
    setPriceRange(prev => {
      // If user hasn't moved the slider (still default), expand to full
      if (prev[0] === 0 && (prev[1] === 200 || prev[1] < rounded)) {
        return [0, rounded]
      }
      // Otherwise, keep their chosen range but cap to new max
      return [prev[0], Math.max(prev[1], rounded)]
    })
  }, [products])

  useEffect(() => {
    (async () => {
      if (user?.role === 'CUSTOMER' && user.customerId) {
        const res = await api.getCustomer(user.customerId)
        if (res.success && res.data) setCustomerType(res.data.customerType as any)
      } else {
        setCustomerType(undefined)
      }
    })()
  }, [user])

  // Load favorites for logged-in customer
  useEffect(() => {
    (async () => {
      if (user?.role === 'CUSTOMER' && user.customerId) {
        setLoadingFavorites(true)
        const res = await api.getFavorites(user.customerId, { page: 1, limit: 100 })
        if (res.success && res.data) {
          const map: Record<string, string> = {}
          for (const f of res.data.favorites) {
            if (f.product?.id) map[f.product.id] = f.id
          }
          setFavoriteIdsByProduct(map)
        }
        setLoadingFavorites(false)
      } else {
        setFavoriteIdsByProduct({})
      }
    })()
  }, [user])

  async function toggleFavorite(productId: string | number) {
    const id = String(productId);
    if (!user || user.role !== 'CUSTOMER' || !user.customerId) {
      toast.info('Please sign in as a customer to use favorites')
      return
    }
    const existingFavoriteId = favoriteIdsByProduct[id]
    if (existingFavoriteId) {
      const res = await api.removeFavorite(user.customerId, existingFavoriteId)
      if (res.success) {
        setFavoriteIdsByProduct(prev => {
          const { [id]: _, ...rest } = prev
          return rest
        })
        toast.success('Removed from favorites')
      }
    } else {
      const res = await api.addFavorite(user.customerId, id)
      if (res.success && res.data && (res as any).data.id) {
        const favId = (res as any).data.id as string
        setFavoriteIdsByProduct(prev => ({ ...prev, [id]: favId }))
        toast.success('Added to favorites')
      } else if (!res.success && res.error?.toLowerCase().includes('already')) {
        // In case of race/duplicate
        const refetch = await api.getFavorites(user.customerId, { page: 1, limit: 100 })
        if (refetch.success && refetch.data) {
          const map: Record<string, string> = {}
          for (const f of refetch.data.favorites) {
            if (f.product?.id) map[f.product.id] = f.id
          }
          setFavoriteIdsByProduct(map)
        }
      }
    }
  }

  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12 ${barlow.className}`}>
      {/* ───── STICKY GLASSMORPHIC CONTROL CENTER ───── */}
      <div className="sticky top-24 z-40 transform-gpu md:hidden">
        <div className="bg-white/40 backdrop-blur-2xl border border-white/40 shadow-[0_20px_50px_rgba(27,45,79,0.05)] rounded-[2.5rem] p-2 sm:p-3 transition-all duration-500">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            {/* Search + Category Pills Container */}
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full flex-1">
              <div className="relative w-full sm:max-w-xs lg:max-w-md group md:hidden">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-primary/30 group-hover:text-primary transition-colors w-4 h-4" />
                <Input
                  placeholder="Catalog Identification..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    updateParams({ q: e.target.value })
                  }}
                  className="pl-12 h-14 bg-white/50 border-white/20 rounded-3xl focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all font-medium text-primary placeholder:text-primary/30"
                />
              </div>

              {/* Category Pills (Mobile Only - Desktop in Navbar) */}
              <div className="md:hidden flex items-center gap-2 overflow-x-auto scrollbar-none pb-1 w-full sm:w-auto px-1">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat)
                      updateParams({ cat: cat })
                    }}
                    className={`whitespace-nowrap px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 ${
                      selectedCategory === cat
                        ? 'bg-primary text-white shadow-xl shadow-primary/20 scale-[1.02]'
                        : 'bg-white/50 text-primary/40 hover:text-primary hover:bg-white border border-white/50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            {/* View Mode + Sort + Deep Filters have been migrated to the GlobalHeader discovery bar. */}

            {/* Background Filter Logic moved outside mobile-only container for global access */}

          </div>
        </div>
      </div>

      {/* Background Filter Logic (Global Access) */}
      <Sheet open={showFilters} onOpenChange={(open) => {
        setShowFilters(open)
        updateParams({ filters: open ? 'open' : null })
      }}>
        <SheetContent side="right" className="w-[300px] sm:w-[400px] rounded-l-[3rem] border-0 shadow-2xl">
          <SheetHeader className="pb-8 pt-4">
            <SheetTitle className="text-3xl font-black tracking-tighter text-[#1B2D4F]">REFINE STORE</SheetTitle>
          </SheetHeader>
          <div className="space-y-12">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <label className="text-sm font-black uppercase tracking-widest text-[#1B2D4F]">Price Limit</label>
                <span className="text-xs font-bold bg-[#1B2D4F]/5 text-[#1B2D4F] px-2 py-1 rounded-lg">${priceRange[0]} - ${priceRange[1]}</span>
              </div>
              <Slider value={priceRange} onValueChange={(v) => setPriceRange(v as any)} max={maxPrice} step={10} className="[&_[data-slot=slider-range]]:bg-[#1B2D4F] [&_[data-slot=slider-thumb]]:border-[#1B2D4F]" />
            </div>

            <div className="space-y-4">
              <label className="text-sm font-black uppercase tracking-widest text-[#1B2D4F]">Availability</label>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="text-sm font-bold text-gray-700">In Stock ONLY</span>
                <Checkbox id="inStockDrawer" checked={inStockOnly} onCheckedChange={(v) => {
                  const val = Boolean(v)
                  setInStockOnly(val)
                  updateParams({ stock: val ? 'true' : null })
                }} className="border-[#1B2D4F]/20 data-[state=checked]:bg-[#1B2D4F]" />
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => { 
                setSearchTerm(''); 
                setPriceRange([0, maxPrice]); 
                setInStockOnly(false); 
                setSelectedCategory('All'); 
                updateParams({ q: null, cat: null, sort: null, stock: null })
              }}
              className="w-full h-14 border-primary/10 rounded-2xl hover:bg-secondary/30 font-bold"
            >
              Reset All
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex items-center justify-between px-2">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-ring/60">Results ({filtered.length})</h2>
        <div className="h-[1px] flex-1 mx-6 bg-gradient-to-r from-primary/10 to-transparent"></div>
      </div>

      <motion.div 
        layout
        className={viewMode === 'grid' 
          ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6' 
          : 'space-y-6'
        }
      >
        <AnimatePresence mode="popLayout">
          {filtered.map((p, index) => (
            <ProductCard
              key={p.id}
              product={p}
              index={index}
              onQuickView={setQuickViewId}
              isFavorite={!!favoriteIdsByProduct[String(p.id)]}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </AnimatePresence>
      </motion.div>


      {quickViewId && (
        <Dialog open={!!quickViewId} onOpenChange={(open) => !open && setQuickViewId(null)}>
          <DialogContent className="max-w-xl w-full p-0 overflow-hidden max-h-[90vh] rounded-3xl">
            <DialogTitle className="sr-only">Product Quick View</DialogTitle>
            <DialogDescription className="sr-only">View product details and purchase</DialogDescription>
            <ProductDetailView productId={String(quickViewId)} isModal={true} />
          </DialogContent>
        </Dialog>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-black mb-2">No products found</h3>
          <p className="text-gray-600 mb-4">Try adjusting your search criteria or filters.</p>
          <Button 
            onClick={() => { setSearchTerm(''); setPriceRange([0, maxPrice]); setInStockOnly(false); setSelectedCategory('All'); }} 
            className="bg-[#1B2D4F] hover:bg-[#3A6FA0] text-white border-0 rounded-2xl h-12 px-8 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-[#1B2D4F]/10"
          >
            Clear All Filters
          </Button>
        </div>
      )}
    </div>
  )
}


