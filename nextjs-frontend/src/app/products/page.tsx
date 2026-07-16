'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useDebounce } from '@/hooks/use-debounce';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { ProtectedRoute } from '@/contexts/auth-context';
import { ProductsTable } from '@/components/products/products-table';
import { ProductReorderDialog } from '@/components/products/product-reorder-dialog';
import { PopularReorderDialog } from '@/components/products/PopularReorderDialog';
import { VariantManagementDialog } from '@/components/products/variant-management-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Package } from 'lucide-react';
import { api, Product } from '@/lib/api';
import logger from '@/lib/logger';
import { toast } from 'sonner';

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [reorderOpen, setReorderOpen] = useState(false);
  const [popularOpen, setPopularOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [variantsProduct, setVariantsProduct] = useState<Product | null>(null);
  const [statusStats, setStatusStats] = useState<{ active: number; draft: number; inactive: number; archived: number } | null>(null);

  // Typing fired one request per keystroke, and responses arrive out of order —
  // measured on prod, "SS-31" fired 5 requests and the one that painted the table
  // was "SS-". Whichever prefix lost the race won the screen, so a mistyped
  // character (which matches nothing) could leave 0 results showing under a
  // perfectly good search term. Debounce collapses the requests; the seq guard
  // below makes sure a straggler can never overwrite a newer response.
  const debouncedSearch = useDebounce(searchTerm, 300);
  const latestRequest = useRef(0);

  const ITEMS_PER_PAGE = 10;

  const fetchProducts = async () => {
    const seq = ++latestRequest.current;
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        search: debouncedSearch || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        sortBy: 'displayOrder',
        sortOrder: 'asc' as const,
      };

      const response = await api.getProducts(params);

      // A slower earlier request must never overwrite a newer one's results.
      if (seq !== latestRequest.current) return;

      if (response.success && response.data) {
        setProducts(response.data.products || []);
        setTotalProducts(response.data.pagination.total);
        setTotalPages(response.data.pagination.pages);
        // Capture status counts if provided by backend
        const statsBlock: any = (response.data as any).stats;
        if (statsBlock) {
          setStatusStats(statsBlock);
        }
      }
    } catch (error) {
      if (seq !== latestRequest.current) return;
      logger.error('Failed to fetch products:', { error });
      toast.error('Failed to load products');
    } finally {
      if (seq === latestRequest.current) setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [currentPage, debouncedSearch, statusFilter, categoryFilter]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await api.getDistinctCategories();
        if (res?.success) {
          const list = (res as any)?.data?.categories ?? (res as any)?.categories ?? [];
          setCategories(Array.isArray(list) ? list : []);
        }
      } catch (e) {
        // ignore; filter will still show fallback
      }
    };
    loadCategories();
  }, []);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleCategoryFilter = (value: string) => {
    setCategoryFilter(value);
    setCurrentPage(1);
  };

  const handleEditProduct = (product: Product) => {
    router.push(`/products/edit/${product.id}`);
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      const response = await api.deleteProduct(productId);
      if (response.success) {
        fetchProducts();
        toast.success('Product deleted successfully');
      }
    } catch (error) {
      logger.error('Failed to delete product:', { error });
      toast.error('Failed to delete product');
    }
  };

  const handleManageVariants = (product: Product) => {
    setVariantsProduct(product);
  };

  const handleVariantsUpdated = () => {
    setVariantsProduct(null);
    fetchProducts();
    toast.success('Product variants updated successfully');
  };

  // Calculate stats
  const stats = {
    total: totalProducts,
    active: statusStats?.active ?? products.filter(p => p.status === 'ACTIVE').length,
    draft: statusStats?.draft ?? products.filter(p => p.status === 'DRAFT').length,
    inactive: statusStats?.inactive ?? products.filter(p => p.status === 'INACTIVE').length,
    archived: statusStats?.archived ?? products.filter(p => p.status === 'ARCHIVED').length,
  };

  return (
    <ProtectedRoute requiredRoles={['ADMIN', 'MANAGER', 'STAFF']}>
      <DashboardLayout>
        <div className="space-y-0">

          {/* ════════ DARK HERO STRIP ════════ */}
          <div className="relative bg-mist border border-line border-t-2 border-t-[#5A9ADA] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#5A9ADA]/8 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
              {/* Top row */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-xl font-black text-[#043061] tracking-tight">Products</h1>
                  <p className="text-xs text-gray-500 mt-0.5">Manage your product catalog and variants</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5 bg-white border border-line rounded-xl px-4 py-2">
                    <Package className="h-4 w-4 text-[#5A9ADA]" />
                    <div>
                      <p className="text-[9px] text-gray-500 font-medium uppercase tracking-widest leading-none">Total</p>
                      <p className="text-base font-black text-[#043061] tabular-nums leading-tight">{stats.total.toLocaleString()}</p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => setReorderOpen(true)} className="h-9 px-4 border-white/10 bg-white/[0.06] text-gray-300 hover:bg-white/[0.12] hover:text-white rounded-xl text-xs font-bold">
                    Sort Order
                  </Button>
                  <Button variant="outline" onClick={() => setPopularOpen(true)} className="h-9 px-4 border-white/10 bg-white/[0.06] text-gray-300 hover:bg-white/[0.12] hover:text-white rounded-xl text-xs font-bold">
                    Popular
                  </Button>
                  <Button onClick={() => router.push('/products/create')} className="h-9 px-5 bg-[#043061] text-white hover:bg-[#0b4f96] rounded-xl text-xs font-black uppercase tracking-widest">
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Product
                  </Button>
                </div>
              </div>

              {/* Status pills */}
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
                {[
                  { key: 'all',      label: 'All',      count: stats.total,    color: null },
                  { key: 'ACTIVE',   label: 'Active',   count: stats.active,   color: 'emerald' },
                  { key: 'DRAFT',    label: 'Draft',    count: stats.draft,    color: 'amber' },
                  { key: 'INACTIVE', label: 'Inactive', count: stats.inactive, color: 'gray' },
                  { key: 'ARCHIVED', label: 'Archived', count: stats.archived, color: 'red' },
                ].map((pill) => {
                  const colorStyles: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
                    emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', ring: 'ring-emerald-500/30', dot: 'bg-emerald-400' },
                    amber:   { bg: 'bg-amber-500/15',   text: 'text-amber-400',   ring: 'ring-amber-500/30',   dot: 'bg-amber-400' },
                    gray:    { bg: 'bg-gray-500/15',    text: 'text-gray-300',    ring: 'ring-gray-500/30',    dot: 'bg-gray-400' },
                    red:     { bg: 'bg-red-500/15',     text: 'text-red-400',     ring: 'ring-red-500/30',     dot: 'bg-red-400' },
                  };
                  const c = pill.color ? colorStyles[pill.color] : null;
                  const isAll = pill.key === 'all';
                  const isActive = isAll ? statusFilter === 'all' : statusFilter === pill.key;
                  return (
                    <button
                      key={pill.key}
                      onClick={() => { handleStatusFilter(pill.key); }}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        isAll && isActive ? 'bg-[#043061] text-white ring-1 ring-[#043061]/20'
                        : isActive && c ? `${c.bg} ${c.text} ring-1 ${c.ring}`
                        : 'bg-white/[0.04] text-gray-500 hover:bg-white/[0.08] hover:text-gray-300'
                      }`}
                    >
                      {c && <span className={`w-1.5 h-1.5 rounded-full ${isActive ? c.dot : 'bg-gray-600'}`} />}
                      <span>{pill.label}</span>
                      <span className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-black tabular-nums ${
                        isAll && isActive ? 'bg-white/20 text-white'
                        : isActive && c ? `${c.bg} ${c.text}`
                        : 'bg-white/[0.06] text-gray-500'
                      }`}>
                        {(pill.count ?? 0).toLocaleString()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ════════ COMPACT FILTER ROW ════════ */}
          <div className="px-1 sm:px-0 py-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 sm:max-w-sm">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="Search products by name or description…"
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10 h-9 bg-white border-gray-200 rounded-xl text-xs placeholder:text-gray-400"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={statusFilter} onValueChange={handleStatusFilter}>
                  <SelectTrigger className="h-9 px-3 text-xs border-gray-200 rounded-xl bg-white w-auto min-w-[130px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={handleCategoryFilter}>
                  <SelectTrigger className="h-9 px-3 text-xs border-gray-200 rounded-xl bg-white w-auto min-w-[140px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => router.push('/products/bulk-upload')} className="h-9 px-4 border-gray-200 rounded-xl text-xs">
                  Export/Import
                </Button>
              </div>
            </div>
          </div>

          {/* ════════ DIALOGS (keep outside table) ════════ */}
          {reorderOpen && <ProductReorderDialog open={reorderOpen} onOpenChange={setReorderOpen} />}
          {popularOpen && <PopularReorderDialog open={popularOpen} onOpenChange={setPopularOpen} />}

          {/* ════════ TABLE ════════ */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden mx-1 sm:mx-0">
            <ProductsTable
              products={products}
              loading={loading}
              onEdit={handleEditProduct}
              onDelete={handleDeleteProduct}
              onManageVariants={handleManageVariants}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>

          {/* ════════ DIALOGS ════════ */}
          <VariantManagementDialog
            product={variantsProduct}
            open={!!variantsProduct}
            onOpenChange={(open) => !open && setVariantsProduct(null)}
            onSuccess={handleVariantsUpdated}
          />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
