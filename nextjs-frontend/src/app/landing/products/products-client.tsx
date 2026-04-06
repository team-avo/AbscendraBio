'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Star, ShoppingCart, Eye, Heart, Grid3X3, List, SlidersHorizontal, Check, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'

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
  const { user } = useAuth()
  const router = useRouter()
  const [addingId, setAddingId] = useState<string | number | null>(null)
  const [customerType, setCustomerType] = useState<'B2C' | 'B2B' | 'ENTERPRISE_1' | 'ENTERPRISE_2' | undefined>(undefined)
  const [favoriteIdsByProduct, setFavoriteIdsByProduct] = useState<Record<string, string>>({})
  const [loadingFavorites, setLoadingFavorites] = useState<boolean>(false)

  // Set customer type based on user's customer information
  useEffect(() => {
    if (user?.customer?.customerType) {
      setCustomerType(user.customer.customerType)
    } else if (user?.role === 'CUSTOMER') {
      // Default to B2C if no customer type is set
      setCustomerType('B2C')
    }
  }, [user])
  function ProductCardImage({ src, alt, sizes, className }: { src: string; alt: string; sizes: string; className?: string }) {
    const [imgSrc, setImgSrc] = useState(resolveImageUrl(src))
    return (
      <img
        src={imgSrc || resolveImageUrl('/peptide-vial-bpc157.png')}
        alt={alt}
        className={className}
        onError={() => setImgSrc(resolveImageUrl('/peptide-vial-bpc157.png'))}
      />
    )
  }

  // Simple add-to-cart animation state per product card (success check)
  const [justAdded, setJustAdded] = useState<Record<string | number, boolean>>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 200])
  const [maxPrice, setMaxPrice] = useState<number>(200)
  const [sortBy, setSortBy] = useState('featured')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showFilters, setShowFilters] = useState(false)
  const [inStockOnly, setInStockOnly] = useState(false)



  const filtered = products
    .filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.fullName.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesPrice = p.price >= priceRange[0] && p.price <= priceRange[1]
      const matchesStock = !inStockOnly || p.inStock
      return matchesSearch && matchesPrice && matchesStock
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

  async function toggleFavorite(productId: string) {
    if (!user || user.role !== 'CUSTOMER' || !user.customerId) {
      toast.info('Please sign in as a customer to use favorites')
      return
    }
    const existingFavoriteId = favoriteIdsByProduct[productId]
    if (existingFavoriteId) {
      const res = await api.removeFavorite(user.customerId, existingFavoriteId)
      if (res.success) {
        setFavoriteIdsByProduct(prev => {
          const { [productId]: _, ...rest } = prev
          return rest
        })
        toast.success('Removed from favorites')
      }
    } else {
      const res = await api.addFavorite(user.customerId, productId)
      if (res.success && res.data && (res as any).data.id) {
        const favId = (res as any).data.id as string
        setFavoriteIdsByProduct(prev => ({ ...prev, [productId]: favId }))
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

  function priceForCustomerType(p: Product): { price: number; original?: number | null } {
    // Get the first variant (assuming single variant for now)
    const variant = p._variantsPricing?.[0]

    // FALLBACK: If no active variant exists (all variants inactive), use product-level pricing
    if (!variant) {
      // Use product's sale price if available, otherwise regular price
      return {
        price: p.price || 0,
        original: null // No strikethrough
      }
    }

    // If customer has a specific type and variant has segment prices, use those
    if (customerType && variant.segmentPrices) {
      let targetType = customerType;
      // Map B2B -> B2C and ENTERPRISE_2 -> ENTERPRISE_1 for pricing
      if (targetType === 'B2B') targetType = 'B2C';
      if (targetType === 'ENTERPRISE_2') targetType = 'ENTERPRISE_1';

      const seg = variant.segmentPrices.find((sp: any) => sp.customerType === targetType)
      if (seg) {
        // Use segment sale price if available, but return null for original to avoid strikethrough
        const price = seg.salePrice && seg.salePrice > 0 ? seg.salePrice : seg.regularPrice
        return { price, original: null }
      }
    }

    // Default: use variant's regular price (ignore variant salePrice as requested)
    // and set original to null to avoid strikethrough ("splash") pricing
    return { price: variant.regularPrice, original: null }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Search + Controls */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between mb-6">
          <div className="relative flex-1 w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder="Search peptides..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-gray-300 focus:border-red-500 focus:ring-red-500"
            />
          </div>
          <div className="flex items-center gap-3 overflow-x-auto md:overflow-visible w-full md:w-auto pb-1">
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="shrink-0 border-gray-300 hover:border-red-500">
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              Filters
            </Button>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v)}>
              <SelectTrigger className="w-40 sm:w-48 border-gray-300 shrink-0">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="featured">Featured</SelectItem>
                <SelectItem value="name">Name A-Z</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1 border border-gray-300 rounded-lg p-1 shrink-0">
              <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('grid')} className={`${viewMode === 'grid' ? 'bg-red-500 hover:bg-red-600 text-white' : ''}`}>
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('list')} className={`${viewMode === 'list' ? 'bg-red-500 hover:bg-red-600 text-white' : ''}`}>
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {showFilters && (
          <Card className="mb-6 border-gray-200">
            <CardContent className="p-6">
              <div className="grid md:grid-cols-4 gap-6">


                <div>
                  <h3 className="font-semibold text-black mb-3">Price Range</h3>
                  <div className="space-y-3">
                    <Slider value={priceRange} onValueChange={(v) => setPriceRange(v as any)} max={maxPrice} step={10} />
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>${priceRange[0]}</span>
                      <span>${priceRange[1]}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-black mb-3">Availability</h3>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="inStock" checked={inStockOnly} onCheckedChange={(v) => setInStockOnly(Boolean(v))} />
                    <label htmlFor="inStock" className="text-sm text-gray-700">In Stock Only</label>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-black mb-3">Quick Actions</h3>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setSearchTerm(''); setPriceRange([0, 200]); setInStockOnly(false); }}
                      className="w-full border-gray-300 hover:border-red-500"
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex items-center justify-between mb-6">
        <p className="text-gray-600">Showing {filtered.length} of {products.length} products</p>
      </div>

      <div className={viewMode === 'grid' ? 'grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6' : 'space-y-4'}>
        {filtered.map((p) => {
          const detailsHref = `/landing/products/${(p as any).seoSlug || p.id}`
          return (
            <Card key={p.id} className={`group hover:shadow-lg transition-all duration-300 border-gray-200 h-full ${viewMode === 'list' ? 'flex' : ''} cursor-pointer`}
              onClick={() => router.push(detailsHref)}
            >
              <CardContent className={`p-0 ${viewMode === 'list' ? 'flex w-full' : 'flex flex-col h-full'}`}>
                <div className={`relative overflow-hidden ${viewMode === 'list' ? 'w-28 h-28 xs:w-36 xs:h-36 sm:w-44 sm:h-44 md:w-48 md:h-48 flex-shrink-0' : 'aspect-square'} bg-gradient-to-br from-gray-50 to-gray-100 rounded-t-lg ${viewMode === 'list' ? 'rounded-l-lg rounded-tr-none' : ''}`}>
                  {/* Mobile: full-image tap to open details */}
                  <Link href={detailsHref} className="absolute inset-0 md:hidden z-10" aria-label="Open details" onClick={(e) => e.stopPropagation()} />
                  <ProductCardImage
                    src={p.image}
                    alt={p.name}
                    sizes={viewMode === 'list' ? '(max-width: 1024px) 100vw, 25vw' : '(max-width: 1024px) 100vw, 20vw'}
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-1.5 left-1.5 space-y-2 z-20">
                    {/* <Badge className="bg-[#f1ebda] text-[#C24C42] border-2 border-[#2B3B4C] shadow-[2px_2px_0px_#C24C42] font-black uppercase tracking-tighter rounded-sm [text-shadow:0.5px_0.5px_0px_#2B3B4C, -0.5px_-0.5px_0px_#2B3B4C]">Presidents Day Sale</Badge> */}
                    {p.featured && (<Badge className="bg-red-500/90 text-white border-0">Featured</Badge>)}
                  </div>
                  <div className="absolute top-1.5 right-1.5">
                    <Badge className={`${p.inStock ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'} border-0`}>{p.inStock ? 'In Stock' : 'Out of Stock'}</Badge>
                  </div>
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center space-x-3">
                    <Link href={detailsHref} onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" className="bg-white text-black hover:bg-gray-100" aria-label="View details" onClick={(e) => e.stopPropagation()}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      className="bg-white text-black hover:bg-gray-100"
                      aria-label={favoriteIdsByProduct[String(p.id)] ? 'Remove from favorites' : 'Add to favorites'}
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(String(p.id)); }}
                      disabled={loadingFavorites}
                    >
                      <Heart className={`w-4 h-4 ${favoriteIdsByProduct[String(p.id)] ? 'fill-red-500 text-red-500' : ''}`} />
                    </Button>
                  </div>
                </div>

                <div className={`p-4 flex-1 flex flex-col ${viewMode === 'list' ? 'justify-between' : ''}`}>
                  <div>
                    <div className="flex items-center justify-end mb-2">
                      <span className="text-xs text-green-600 font-semibold">{p.purity} Pure</span>
                    </div>
                    <h3 className="font-bold text-black text-lg mb-1">
                      <Link href={`/landing/products/${(p as any).seoSlug || p.id}`} className="hover:text-red-600 transition-colors">{p.name}</Link>
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">{p.fullName}</p>
                    <p className="text-sm text-gray-700 mb-3 line-clamp-2">{p.description}</p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {p.concentrations.map(c => (<Badge key={c} variant="outline" className="text-xs border-gray-300">{c}</Badge>))}
                    </div>
                  </div>
                  <div className="space-y-3 mt-auto">
                    {user && (
                      <div className="flex items-center space-x-2">
                        {(() => {
                          const pr = priceForCustomerType(p); return (
                            <>
                              <span className="text-2xl font-bold text-black">${Number(pr.price).toFixed(2)}</span>
                              {pr.original != null && (<span className="text-lg text-gray-500 line-through">${Number(pr.original).toFixed(2)}</span>)}
                            </>
                          )
                        })()}
                      </div>
                    )}
                    <div className="flex space-x-2 items-stretch">
                      {(() => {
                        const variantId = p._firstVariantId as string | undefined
                        const currentQty = variantId ? (items.find(it => it.variantId === variantId)?.quantity || 0) : 0
                        if (currentQty > 0) {
                          return (
                            <div className="flex flex-1 items-center justify-between border border-gray-300 rounded-lg overflow-hidden">
                              <button
                                className="px-3 py-2 bg-gray-50 hover:bg-gray-100 disabled:opacity-50"
                                onClick={async () => { if (!variantId) return; await update(variantId, Math.max(0, currentQty - 1)); }}
                                disabled={!p.inStock || !variantId}
                                aria-label="Decrease quantity"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <div className="px-3 py-2 font-semibold min-w-[2rem] text-center">{currentQty}</div>
                              <button
                                className="px-3 py-2 bg-gray-50 hover:bg-gray-100 disabled:opacity-50"
                                onClick={async () => { if (!variantId) return; await update(variantId, currentQty + 1); }}
                                disabled={!p.inStock || !variantId}
                                aria-label="Increase quantity"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          )
                        }
                        return (
                          <Button
                            className={`flex-1 bg-gradient-to-r ${justAdded[p.id] ? 'from-green-500 to-green-600' : 'from-red-500 to-red-600'} hover:opacity-90 text-white border-0`}
                            disabled={!user || !p.inStock || !p._firstVariantId || addingId === p.id}
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!user) { toast.info('Please sign in to add items'); return }
                              if (!p._firstVariantId) return
                              setAddingId(p.id)
                              const pr = priceForCustomerType(p)
                              try {
                                await add(p._firstVariantId, 1, pr.price)
                                setJustAdded(prev => ({ ...prev, [p.id]: true }))
                                setTimeout(() => setJustAdded(prev => ({ ...prev, [p.id]: false })), 1200)
                              } catch (error: any) {
                                toast.error(error.message || 'Failed to add to cart');
                              } finally {
                                setAddingId(null)
                              }
                            }}
                          >
                            {justAdded[p.id] ? <Check className="w-4 h-4 mr-2" /> : <ShoppingCart className="w-4 h-4 mr-2" />}
                            {user ? (p.inStock ? (justAdded[p.id] ? 'Added' : addingId === p.id ? 'Adding...' : 'Add to Cart') : 'Out of Stock') : 'Sign in to buy'}
                          </Button>
                        )
                      })()}
                      <Link href={detailsHref} onClick={(e) => e.stopPropagation()}>
                        <Button variant="outline" className="border-gray-300 min-w-[84px]" onClick={(e) => e.stopPropagation()}>View</Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-black mb-2">No products found</h3>
          <p className="text-gray-600 mb-4">Try adjusting your search criteria or filters.</p>
          <Button onClick={() => { setSearchTerm(''); setPriceRange([0, 200]); setInStockOnly(false); }} className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white border-0">Clear All Filters</Button>
        </div>
      )}
    </div>
  )
}


