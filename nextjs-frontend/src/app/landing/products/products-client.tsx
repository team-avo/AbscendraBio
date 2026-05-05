'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, SlidersHorizontal, FlaskConical, ChevronDown, Check, Lock, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { motion, AnimatePresence } from 'motion/react'
import { Barlow } from 'next/font/google'
import { ProductCard } from '@/components/products/ProductCard'

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
import { api } from '@/lib/api'
import { toast } from 'sonner'

export default function ProductsClient({ products }: Props) {
  const { add, items, update } = useCart()
  const { user, openLoginModal, isAuthenticated } = useAuth()
  const router = useRouter()
  const [customerType, setCustomerType] = useState<'B2C' | 'B2B' | 'ENTERPRISE_1' | 'ENTERPRISE_2' | undefined>(undefined)
  const [favoriteIdsByProduct, setFavoriteIdsByProduct] = useState<Record<string, string>>({})
  const [filterOpen, setFilterOpen] = useState(false)

  // URL State Management
  const searchParams = useSearchParams()
  const q = searchParams.get('q') || ''
  const s = searchParams.get('sort') || 'featured'
  const c = searchParams.get('cat') || 'All'
  const st = searchParams.get('stock') === 'true'

  const [searchTerm, setSearchTerm] = useState(q)
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 200])
  const [maxPrice, setMaxPrice] = useState<number>(200)
  const [sortBy, setSortBy] = useState(s)
  const [inStockOnly, setInStockOnly] = useState(st)
  const [selectedCategory, setSelectedCategory] = useState<string>(c)

  // Sync internal state when URL changes
  useEffect(() => { setSearchTerm(q) }, [q])
  useEffect(() => { setSortBy(s) }, [s])
  useEffect(() => { setSelectedCategory(c) }, [c])
  useEffect(() => { setInStockOnly(st) }, [st])

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
        case 'price-low': return a.price - b.price
        case 'price-high': return b.price - a.price
        case 'name': return a.name.localeCompare(b.name)
        default: return (b.featured ? 1 : 0) - (a.featured ? 1 : 0)
      }
    })

  useEffect(() => {
    if (!products || products.length === 0) return
    const discoveredMax = Math.max(...products.map(p => Number(p.price || 0)))
    const rounded = Math.max(50, Math.ceil(discoveredMax / 10) * 10)
    setMaxPrice(rounded)
    setPriceRange(prev => {
      if (prev[0] === 0 && (prev[1] === 200 || prev[1] < rounded)) return [0, rounded]
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

  useEffect(() => {
    (async () => {
      if (user?.role === 'CUSTOMER' && user.customerId) {
        const res = await api.getFavorites(user.customerId, { page: 1, limit: 100 })
        if (res.success && res.data) {
          const map: Record<string, string> = {}
          for (const f of res.data.favorites) {
            if (f.product?.id) map[f.product.id] = f.id
          }
          setFavoriteIdsByProduct(map)
        }
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
        setFavoriteIdsByProduct(prev => { const { [id]: _, ...rest } = prev; return rest })
        toast.success('Removed from favorites')
      }
    } else {
      const res = await api.addFavorite(user.customerId, id)
      if (res.success && res.data && (res as any).data.id) {
        setFavoriteIdsByProduct(prev => ({ ...prev, [id]: (res as any).data.id as string }))
        toast.success('Added to favorites')
      } else if (!res.success && res.error?.toLowerCase().includes('already')) {
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

  const activeFilterCount = [
    inStockOnly,
    priceRange[0] > 0,
    priceRange[1] < maxPrice,
  ].filter(Boolean).length

  const clearAll = () => {
    setSearchTerm(''); setPriceRange([0, maxPrice]); setInStockOnly(false); setSelectedCategory('All')
    updateParams({ q: null, cat: null, sort: null, stock: null })
  }

  // ── Gate products behind login on ALL viewports (mobile + desktop) ──
  if (!isAuthenticated) {
    return (
      <div className={`${barlow.className} pt-6 pb-20`}>
        <div className="relative bg-[#070B14] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
          {/* Grid texture */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />
          {/* Blue glow */}
          <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#4D7DF2]/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[180px] bg-[#3A6FA0]/10 rounded-full blur-[100px] pointer-events-none" />

          <div className="relative z-10 px-6 py-14 sm:px-10 sm:py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.08] border border-white/[0.10] flex items-center justify-center mx-auto mb-6">
              <Lock className="w-7 h-7 text-white/80" />
            </div>
            <div className="flex items-center justify-center gap-3 mb-4">
              <span className="w-8 h-[1px] bg-[#4D7DF2]/50" />
              <span className="text-[10px] font-bold tracking-[0.4em] text-[#4D7DF2] uppercase">Verified Researchers Only</span>
              <span className="w-8 h-[1px] bg-[#4D7DF2]/50" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight max-w-xl mx-auto">
              Sign in to browse the full catalog
            </h1>
            <p className="mt-4 text-sm sm:text-base text-white/60 max-w-lg mx-auto leading-relaxed">
              Our research peptides are available exclusively to verified researchers. Sign in to your account or create one to view pricing, Certificates of Analysis, and place orders.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => openLoginModal?.()}
                className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-[#070B14] rounded-xl px-6 py-3 text-sm font-bold transition-all shadow-lg"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </button>
              <button
                onClick={() => openLoginModal?.()}
                className="inline-flex items-center gap-2 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.12] text-white rounded-xl px-6 py-3 text-sm font-semibold transition-all"
              >
                Create an Account
              </button>
            </div>
            <p className="mt-6 text-[11px] text-white/30 uppercase tracking-[0.25em]">
              Third-party tested · US-made · 24hr shipping
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`${barlow.className} pt-6`}>

      {/* ── Filter Bar ── */}
      <div className="mb-6 space-y-3">

        {/* Row 1: Search + Filters button (mobile only — desktop uses navbar) */}
        <div className="flex items-center gap-2 md:hidden">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
            <Input
              placeholder="Search products…"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); updateParams({ q: e.target.value }) }}
              className="pl-10 h-10 bg-white border-gray-200 rounded-2xl text-sm font-medium placeholder:text-gray-400 shadow-sm"
            />
          </div>
          <FiltersPopover
            priceRange={priceRange} maxPrice={maxPrice} inStockOnly={inStockOnly}
            activeFilterCount={activeFilterCount}
            onPriceChange={setPriceRange}
            onStockChange={(v) => { setInStockOnly(v); updateParams({ stock: v ? 'true' : null }) }}
            onClear={clearAll}
          />
        </div>

        {/* Row 2: Category pills + desktop Filters button */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => { setSelectedCategory(cat); updateParams({ cat }) }}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-200 shrink-0 ${
                selectedCategory === cat
                  ? 'bg-[#070B14] text-white'
                  : 'bg-white text-gray-400 hover:text-gray-700 border border-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}

          {/* Desktop filter button — right-aligned */}
          <div className="ml-auto shrink-0 hidden md:block">
            <FiltersPopover
              priceRange={priceRange} maxPrice={maxPrice} inStockOnly={inStockOnly}
              activeFilterCount={activeFilterCount}
              onPriceChange={setPriceRange}
              onStockChange={(v) => { setInStockOnly(v); updateParams({ stock: v ? 'true' : null }) }}
              onClear={clearAll}
            />
          </div>
        </div>
      </div>

      {/* ── Results Bar ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-[#4D7DF2]/10 flex items-center justify-center">
            <FlaskConical className="w-3 h-3 text-[#4D7DF2]" />
          </div>
          <span className="text-sm font-black text-[#070B14]">{filtered.length}</span>
          <span className="text-sm text-gray-400 font-medium">
            {filtered.length === 1 ? 'product' : 'products'}
            {(searchTerm || selectedCategory !== 'All' || inStockOnly) ? ' found' : ''}
          </span>
        </div>
        {(searchTerm || selectedCategory !== 'All' || inStockOnly) && (
          <button onClick={clearAll} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-[#070B14] transition-colors px-3 py-1.5 rounded-full hover:bg-gray-100">
            Clear filters
          </button>
        )}
      </div>

      {/* ── Products Grid ── */}
      <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
        <AnimatePresence mode="popLayout">
          {filtered.map((p, index) => (
            <ProductCard
              key={p.id}
              product={p}
              index={index}
              onQuickView={(id) => router.push(`/landing/products/${id}`)}
              isFavorite={!!favoriteIdsByProduct[String(p.id)]}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </AnimatePresence>
      </motion.div>

      {/* ── Empty State ── */}
      {filtered.length === 0 && (
        <div className="text-center py-24">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FlaskConical className="w-6 h-6 text-gray-300" />
          </div>
          <h3 className="text-base font-black text-[#070B14] mb-2">No products found</h3>
          <p className="text-sm text-gray-400 mb-6">Try adjusting your search or filters.</p>
          <Button
            onClick={clearAll}
            className="bg-[#070B14] hover:bg-[#1a2540] text-white border-0 rounded-2xl h-11 px-8 font-black uppercase tracking-widest text-[10px]"
          >
            Clear All Filters
          </Button>
        </div>
      )}
    </div>
  )
}

/* ─── Filters Popover ─── */
function FiltersPopover({
  priceRange, maxPrice, inStockOnly, activeFilterCount,
  onPriceChange, onStockChange, onClear
}: {
  priceRange: [number, number]
  maxPrice: number
  inStockOnly: boolean
  activeFilterCount: number
  onPriceChange: (v: [number, number]) => void
  onStockChange: (v: boolean) => void
  onClear: () => void
}) {

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
          activeFilterCount > 0
            ? 'bg-[#070B14] text-white border-[#070B14]'
            : 'bg-white text-gray-500 border-gray-200 hover:text-gray-800 hover:border-gray-300'
        }`}>
          <SlidersHorizontal className="w-3 h-3" />
          Filters
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[8px] font-black">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown className="w-3 h-3 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-72 p-5 rounded-2xl border border-gray-100 shadow-xl bg-white"
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-[#070B14]">Filters</h3>
            {activeFilterCount > 0 && (
              <button onClick={onClear} className="text-[10px] font-bold text-gray-400 hover:text-[#070B14] transition-colors">
                Reset all
              </button>
            )}
          </div>

          {/* Price range */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Price Range</label>
              <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
                ${priceRange[0]} – ${priceRange[1]}
              </span>
            </div>
            <Slider
              value={priceRange}
              onValueChange={(v) => onPriceChange(v as [number, number])}
              max={maxPrice}
              step={10}
              className="[&_[data-slot=slider-range]]:bg-[#4D7DF2] [&_[data-slot=slider-thumb]]:border-[#4D7DF2] [&_[data-slot=slider-thumb]]:bg-white"
            />
          </div>

          {/* In stock */}
          <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-100">
            <div>
              <p className="text-xs font-bold text-gray-800">In Stock Only</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Hide out-of-stock products</p>
            </div>
            <button
              onClick={() => onStockChange(!inStockOnly)}
              className={`w-9 h-5 rounded-full transition-all duration-200 relative ${inStockOnly ? 'bg-[#4D7DF2]' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${inStockOnly ? 'left-[18px]' : 'left-0.5'}`} />
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
