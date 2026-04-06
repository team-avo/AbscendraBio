'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { ProtectedRoute } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tag, Plus, Search } from 'lucide-react';
import { api } from '@/lib/api';
import logger from '@/lib/logger';
import { toast } from 'sonner';
import { CategoriesTable } from '@/components/products/categories/categories-table';
import { CreateCategoryDialog } from '@/components/products/categories/create-category-dialog';
import { EditCategoryDialog } from '@/components/products/categories/edit-category-dialog';

interface Category {
  id: string;
  name: string;
  product: {
    name: string;
    status: string;
  };
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const ITEMS_PER_PAGE = 10;

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        search: searchTerm || undefined,
      };

      const response = await api.getCategories(params);

      if (response.success && response.data) {
        setCategories(response.data.categories || []);
        setTotalItems(response.data.pagination.total);
        setTotalPages(response.data.pagination.pages);
      } else {
        // Handle API error
        toast.error(response.error || 'Failed to load categories');
        setCategories([]);
        setTotalItems(0);
        setTotalPages(0);
      }
    } catch (error) {
      logger.error('Failed to fetch categories:', { error });
      toast.error('Failed to load categories');
      setCategories([]);
      setTotalItems(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [currentPage, searchTerm]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleCategoryCreated = () => {
    setShowCreateDialog(false);
    fetchCategories();
    toast.success('Category created successfully');
  };

  const handleCategoryUpdated = () => {
    setEditingCategory(null);
    fetchCategories();
    toast.success('Category updated successfully');
  };

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      const response = await api.deleteCategory(categoryId);
      if (response.success) {
        fetchCategories();
        toast.success('Category deleted successfully');
      } else {
        toast.error(response.error || 'Failed to delete category');
      }
    } catch (error) {
      logger.error('Failed to delete category:', { error });
      toast.error('Failed to delete category');
    }
  };

  return (
    <ProtectedRoute requiredRoles={['ADMIN', 'MANAGER', 'STAFF']} requiredPermissions={[{ module: 'PRODUCTS', action: 'READ' }]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Categories</h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Manage product categories and classifications
              </p>
            </div>
            <Button onClick={() => setShowCreateDialog(true)} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add Category
            </Button>
          </div>

          {/* Stats Card */}
          <Card className="py-0.5 gap-0 sm:py-3 sm:gap-1 max-w-xs">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-3 sm:pb-1">
              <CardTitle className="text-[10px] sm:text-xs font-medium">Total Categories</CardTitle>
              <Tag className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-2 pt-0 sm:p-3 sm:pt-0">
              <div className="text-base sm:text-lg lg:text-2xl font-bold">{totalItems}</div>
            </CardContent>
          </Card>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Search categories</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="w-full">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by category name..."
                      className="pl-10 w-full"
                      value={searchTerm}
                      onChange={(e) => handleSearch(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Categories Table */}
          <CategoriesTable
            categories={categories}
            loading={loading}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            onEditCategory={setEditingCategory}
            onDeleteCategory={handleDeleteCategory}
          />

          {/* Dialogs */}
          {showCreateDialog && (
            <CreateCategoryDialog
              open={showCreateDialog}
              onClose={() => setShowCreateDialog(false)}
              onSuccess={handleCategoryCreated}
            />
          )}

          {editingCategory && (
            <EditCategoryDialog
              category={editingCategory}
              open={true}
              onClose={() => setEditingCategory(null)}
              onSuccess={handleCategoryUpdated}
            />
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}