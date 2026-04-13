'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { ProtectedRoute } from '@/contexts/auth-context';
import { ProductsTable } from '@/components/products/products-table';
import { ProductReorderDialog } from '@/components/products/product-reorder-dialog';
import { PopularReorderDialog } from '@/components/products/PopularReorderDialog';
import { VariantManagementDialog } from '@/components/products/variant-management-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Package, Package2, PackageCheck, Archive } from 'lucide-react';
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

  const ITEMS_PER_PAGE = 10;

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        search: searchTerm || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        sortBy: 'displayOrder',
        sortOrder: 'asc' as const,
      };

      const response = await api.getProducts(params);

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
      logger.error('Failed to fetch products:', { error });
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [currentPage, searchTerm, statusFilter, categoryFilter]);

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
        <div className="space-y-5 px-2 sm:px-0">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Products</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Manage your product catalog and variants
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => router.push('/products/create')}
                className="h-9 px-4 bg-[#1B2D4F] hover:bg-[#243d6b] text-white rounded-xl text-sm font-medium"
              >
                <Plus className="mr-2 h-4 w-4" /> Add Product
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/products/bulk-upload')}
                className="h-9 px-4 rounded-xl text-sm"
              >
                Export/Import
              </Button>
              <Button
                variant="outline"
                onClick={() => setReorderOpen(true)}
                className="h-9 px-4 rounded-xl text-sm"
              >
                Sort Order
              </Button>
              <Button
                variant="outline"
                onClick={() => setPopularOpen(true)}
                className="h-9 px-4 rounded-xl text-sm"
              >
                Popular
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Total Products */}
            <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm px-5 py-4">
              <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                <Package className="h-5 w-5 text-slate-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Total Products</p>
                <p className="text-xl font-bold text-slate-900">{stats.total}</p>
              </div>
            </div>

            {/* Active */}
            <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm px-5 py-4">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <PackageCheck className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Active</p>
                <p className="text-xl font-bold text-emerald-600">{stats.active}</p>
              </div>
            </div>

            {/* Draft */}
            <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm px-5 py-4">
              <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                <Package2 className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Draft</p>
                <p className="text-xl font-bold text-amber-600">{stats.draft}</p>
              </div>
            </div>

            {/* Inactive */}
            <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm px-5 py-4">
              <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                <Package className="h-5 w-5 text-slate-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Inactive</p>
                <p className="text-xl font-bold text-slate-600">{stats.inactive}</p>
              </div>
            </div>

            {/* Archived — dark navy hero chip */}
            <div className="relative flex items-center gap-3 bg-[#1B2D4F] rounded-2xl shadow-sm px-5 py-4 overflow-hidden">
              <div className="absolute -top-4 -right-4 h-20 w-20 rounded-full bg-white/5" />
              <div className="absolute -bottom-6 -left-2 h-16 w-16 rounded-full bg-white/5" />
              <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 relative">
                <Archive className="h-5 w-5 text-red-400" />
              </div>
              <div className="relative">
                <p className="text-xs text-slate-400 font-medium">Archived</p>
                <p className="text-2xl font-bold text-white">{stats.archived}</p>
              </div>
            </div>
          </div>

          {/* Dialogs (moved outside stats grid) */}
          {reorderOpen && (
            <ProductReorderDialog open={reorderOpen} onOpenChange={setReorderOpen} />
          )}
          {popularOpen && (
            <PopularReorderDialog open={popularOpen} onOpenChange={setPopularOpen} />
          )}

          {/* Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search products by name or description..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={statusFilter} onValueChange={handleStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
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
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Products Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-slate-100">
                <Package2 className="h-4 w-4 text-slate-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Products List</h2>
                <p className="text-xs text-slate-400">
                  {loading ? 'Loading...' : `Showing ${products.length} of ${totalProducts} products`}
                </p>
              </div>
            </div>
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

          {/* Dialogs */}
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
