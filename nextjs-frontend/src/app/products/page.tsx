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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
        <div className="space-y-4 sm:space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Products</h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                Manage your product catalog and variants
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                <Button onClick={() => router.push('/products/create')} className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Product
                </Button>
                <Button variant="outline" onClick={() => router.push('/products/bulk-upload')} className="w-full sm:w-auto">
                  Export/Import
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                <Button variant="outline" onClick={() => setReorderOpen(true)} className="w-full sm:w-auto">
                  Sort Order
                </Button>
                <Button variant="outline" onClick={() => setPopularOpen(true)} className="w-full sm:w-auto">
                  Popular
                </Button>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 w-full">
            <Card className="py-0.5 gap-0 sm:py-3 sm:gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-3 sm:pb-1">
                <CardTitle className="text-[10px] sm:text-xs font-medium">Total Products</CardTitle>
                <Package className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-2 pt-0 sm:p-3 sm:pt-0">
                <div className="text-base sm:text-lg lg:text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>

            {reorderOpen && (
              <ProductReorderDialog open={reorderOpen} onOpenChange={setReorderOpen} />
            )}
            {popularOpen && (
              <PopularReorderDialog open={popularOpen} onOpenChange={setPopularOpen} />
            )}
            <Card className="py-0.5 gap-0 sm:py-3 sm:gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-3 sm:pb-1">
                <CardTitle className="text-[10px] sm:text-xs font-medium">Active</CardTitle>
                <PackageCheck className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
              </CardHeader>
              <CardContent className="p-2 pt-0 sm:p-3 sm:pt-0">
                <div className="text-base sm:text-lg lg:text-2xl font-bold text-green-600">{stats.active}</div>
              </CardContent>
            </Card>
            <Card className="py-0.5 gap-0 sm:py-3 sm:gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-3 sm:pb-1">
                <CardTitle className="text-[10px] sm:text-xs font-medium">Draft</CardTitle>
                <Package2 className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-600" />
              </CardHeader>
              <CardContent className="p-2 pt-0 sm:p-3 sm:pt-0">
                <div className="text-base sm:text-lg lg:text-2xl font-bold text-yellow-600">{stats.draft}</div>
              </CardContent>
            </Card>
            <Card className="py-0.5 gap-0 sm:py-3 sm:gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-3 sm:pb-1">
                <CardTitle className="text-[10px] sm:text-xs font-medium">Inactive</CardTitle>
                <Package className="h-3 w-3 sm:h-4 sm:w-4 text-gray-600" />
              </CardHeader>
              <CardContent className="p-2 pt-0 sm:p-3 sm:pt-0">
                <div className="text-base sm:text-lg lg:text-2xl font-bold text-gray-600">{stats.inactive}</div>
              </CardContent>
            </Card>
            <Card className="py-0.5 gap-0 sm:py-3 sm:gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-3 sm:pb-1">
                <CardTitle className="text-[10px] sm:text-xs font-medium">Archived</CardTitle>
                <Archive className="h-3 w-3 sm:h-4 sm:w-4 text-red-600" />
              </CardHeader>
              <CardContent className="p-2 pt-0 sm:p-3 sm:pt-0">
                <div className="text-base sm:text-lg lg:text-2xl font-bold text-red-600">{stats.archived}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Search and filter products</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search products by name or description..."
                      value={searchTerm}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
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
            </CardContent>
          </Card>

          {/* Products Table */}
          <Card>
            <CardHeader>
              <CardTitle>Products List</CardTitle>
              <CardDescription>
                {loading ? 'Loading...' : `Showing ${products.length} of ${totalProducts} products`}
              </CardDescription>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

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
