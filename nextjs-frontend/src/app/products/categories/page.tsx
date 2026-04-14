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
        <div className="space-y-0">

          {/* ════════ DARK HERO STRIP ════════ */}
          <div className="relative bg-[#070B14] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#4D7DF2]/8 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
              {/* Top row */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-xl font-black text-white tracking-tight">Categories</h1>
                  <p className="text-xs text-gray-500 mt-0.5">Manage product categories</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-2">
                    <Tag className="h-4 w-4 text-[#4D7DF2]" />
                    <div>
                      <p className="text-[9px] text-gray-500 font-medium uppercase tracking-widest leading-none">Total</p>
                      <p className="text-base font-black text-white tabular-nums leading-tight">{totalItems.toLocaleString()}</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setShowCreateDialog(true)}
                    className="h-9 px-5 bg-white text-[#070B14] hover:bg-gray-100 rounded-xl text-xs font-black uppercase tracking-widest"
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Create Category
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* ════════ COMPACT FILTER ROW ════════ */}
          <div className="px-1 sm:px-0 py-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                placeholder="Search by category name..."
                className="pl-10 h-9 bg-white border-gray-200 rounded-xl text-xs placeholder:text-gray-400"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
          </div>

          {/* ════════ TABLE ════════ */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden mx-1 sm:mx-0">
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
