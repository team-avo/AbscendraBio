'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { ProtectedRoute } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
        <div className="space-y-5 px-2 sm:px-0">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Categories</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Manage product categories and classifications
              </p>
            </div>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="h-9 px-4 bg-[#1B2D4F] hover:bg-[#243d6b] text-white rounded-xl text-sm font-medium w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Category
            </Button>
          </div>

          {/* Single stat chip */}
          <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm px-5 py-4 w-fit">
            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <Tag className="h-5 w-5 text-slate-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Total Categories</p>
              <p className="text-xl font-bold text-slate-900">{totalItems}</p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by category name..."
                className="pl-10 w-full"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Categories Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-slate-100">
                <Tag className="h-4 w-4 text-slate-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Categories List</h2>
                <p className="text-xs text-slate-400">{totalItems} categories</p>
              </div>
            </div>
            <CategoriesTable
              categories={categories}
              loading={loading}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              onEditCategory={setEditingCategory}
              onDeleteCategory={handleDeleteCategory}
            />
          </div>

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
