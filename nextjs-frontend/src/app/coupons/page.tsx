'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { ProtectedRoute } from '@/contexts/auth-context';
import { CouponsTable } from '@/components/coupons/coupons-table';
import { CreateCouponDialog } from '@/components/coupons/create-coupon-dialog';
import { EditCouponDialog } from '@/components/coupons/edit-coupon-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Search,
  Tag,
  TrendingUp,
  Users,
  DollarSign,
  Percent
} from 'lucide-react';
import { api, Promotion } from '@/lib/api';
import logger from '@/lib/logger';
import { toast } from 'sonner';

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Promotion | null>(null);

  // Stats
  const [stats, setStats] = useState({
    totalCoupons: 0,
    activeCoupons: 0,
    totalUsage: 0,
    totalDiscount: 0,
  });

  useEffect(() => {
    fetchCoupons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, statusFilter, typeFilter, searchTerm]);

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const response = await api.getPromotions({
        page: currentPage,
        limit: 10,
        isActive: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        search: searchTerm || undefined,
      });

      logger.debug('Promotions API Response:', { response });

      if (response.success && response.data) {
        const promotions = Array.isArray(response.data) ? response.data : [];
        const pagination = (response as any).pagination || {};

        logger.debug('Promotions:', { promotions });
        logger.debug('Pagination:', { pagination });

        setCoupons(promotions);
        setTotalPages(pagination.pages || 1);
        setTotalItems(pagination.total || 0);

        // Fetch global stats from the new endpoint
        const statsRes = await api.getPromotionStats();
        if (statsRes.success && statsRes.data) {
          setStats({
            totalCoupons: statsRes.data.totalCoupons,
            activeCoupons: statsRes.data.activeCoupons,
            totalUsage: statsRes.data.totalUsage,
            totalDiscount: 0, // Simplified: no longer calculating this client-side for performance
          });
        }
      } else {
        logger.error('Failed to fetch promotions:', { error: response });
        toast.error(response.error || 'Failed to fetch coupons');
      }
    } catch (error) {
      logger.error('Failed to fetch coupons:', { error });
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCouponCreated = () => {
    setShowCreateDialog(false);
    fetchCoupons();
    toast.success('Coupon created successfully');
  };

  const handleCouponUpdated = () => {
    setEditingCoupon(null);
    fetchCoupons();
    toast.success('Coupon updated successfully');
  };

  const handleEditCoupon = async (coupon: Promotion) => {
    try {
      // Fetch full coupon data including volume tiers, product rules, etc.
      const response = await api.getPromotion(coupon.id);

      if (response.success && response.data) {
        setEditingCoupon(response.data);
      } else {
        toast.error('Failed to load coupon details');
      }
    } catch (error) {
      logger.error('Failed to fetch coupon details:', { error });
      toast.error('Failed to load coupon details');
    }
  };

  const handleDeleteCoupon = async (coupon: Promotion) => {
    if (!confirm(`Are you sure you want to delete the coupon "${coupon.code}"?`)) {
      return;
    }

    try {
      const response = await api.deletePromotion(coupon.id);
      if (response.success) {
        toast.success('Coupon deleted successfully');
        fetchCoupons();
      } else {
        toast.error(response.error || 'Failed to delete coupon');
      }
    } catch (error) {
      logger.error('Failed to delete coupon:', { error });
      toast.error('An unexpected error occurred');
    }
  };

  // Filtering is handled server-side via API params
  const filteredCoupons = coupons;

  return (
    <ProtectedRoute requiredRoles={['ADMIN', 'MANAGER', 'STAFF']}>
      <DashboardLayout>
        <div className="space-y-5 px-2 sm:px-0">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">Coupons & Discounts</h1>
              <p className="text-muted-foreground text-xs sm:text-sm lg:text-base">
                Manage promotional codes and discount campaigns.
              </p>
            </div>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="h-9 px-4 bg-[#1B2D4F] hover:bg-[#243d6b] text-white rounded-xl text-sm font-medium w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Coupon
            </Button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Total Coupons */}
            <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm px-5 py-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                <Tag className="h-5 w-5 text-slate-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Total Coupons</p>
                <p className="text-xl font-bold text-slate-900">{stats.totalCoupons}</p>
              </div>
            </div>

            {/* Active Coupons */}
            <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm px-5 py-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Active Coupons</p>
                <p className="text-xl font-bold text-emerald-600">{stats.activeCoupons}</p>
              </div>
            </div>

            {/* Total Usage — dark navy hero chip */}
            <div className="relative col-span-2 sm:col-span-1 flex items-center gap-3 bg-[#1B2D4F] rounded-2xl shadow-sm px-5 py-4 overflow-hidden">
              <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/5" />
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-300" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Total Usage</p>
                <p className="text-2xl font-bold text-white">{stats.totalUsage}</p>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search coupons..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                  <SelectItem value="FIXED_AMOUNT">Fixed Amount</SelectItem>
                  <SelectItem value="FREE_SHIPPING">Free Shipping</SelectItem>
                  <SelectItem value="BOGO">Buy One Get One</SelectItem>
                  <SelectItem value="VOLUME_DISCOUNT">Volume Discount</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                <Tag className="h-4 w-4 text-purple-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Coupons</h2>
                <p className="text-xs text-slate-500">{totalItems.toLocaleString()} coupons</p>
              </div>
            </div>
            <CouponsTable
              coupons={filteredCoupons}
              loading={loading}
              onEdit={handleEditCoupon}
              onDelete={handleDeleteCoupon}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>

          {/* Dialogs */}
          <CreateCouponDialog
            open={showCreateDialog}
            onOpenChange={setShowCreateDialog}
            onSuccess={handleCouponCreated}
          />

          <EditCouponDialog
            coupon={editingCoupon}
            open={!!editingCoupon}
            onOpenChange={(open) => !open && setEditingCoupon(null)}
            onSuccess={handleCouponUpdated}
          />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
