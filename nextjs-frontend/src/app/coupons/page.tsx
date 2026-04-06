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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  }, [currentPage, statusFilter, typeFilter]);

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const response = await api.getPromotions({
        page: currentPage,
        limit: 10,
        isActive: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
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

  const filteredCoupons = coupons.filter(coupon => {
    const matchesSearch = searchTerm === '' ||
      coupon.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      coupon.name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = typeFilter === '' || typeFilter === 'all' || coupon.type === typeFilter;

    return matchesSearch && matchesType;
  });

  return (
    <ProtectedRoute requiredRoles={['ADMIN', 'MANAGER', 'STAFF']}>
      <DashboardLayout>
        <div className="space-y-3 sm:space-y-4 lg:space-y-6 px-2 sm:px-0">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">Coupons & Discounts</h1>
              <p className="text-muted-foreground text-xs sm:text-sm lg:text-base">
                Manage promotional codes and discount campaigns.
              </p>
            </div>
            <Button onClick={() => setShowCreateDialog(true)} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Create Coupon
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 w-full">
            <Card className="py-0 sm:py-0 gap-0">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 py-1 pb-0 sm:p-4 sm:py-2 sm:pb-0">
                <CardTitle className="text-[10px] sm:text-sm font-medium">Total Coupons</CardTitle>
                <Tag className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-2 pt-0 pb-1 sm:p-4 sm:pt-0 sm:pb-2">
                <div className="text-base sm:text-2xl font-bold truncate leading-tight">{stats.totalCoupons}</div>
              </CardContent>
            </Card>
            <Card className="py-0 sm:py-0 gap-0">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 py-1 pb-0 sm:p-4 sm:py-2 sm:pb-0">
                <CardTitle className="text-[10px] sm:text-sm font-medium">Active Coupons</CardTitle>
                <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
              </CardHeader>
              <CardContent className="p-2 pt-0 pb-1 sm:p-4 sm:pt-0 sm:pb-2">
                <div className="text-base sm:text-2xl font-bold truncate leading-tight text-green-600">{stats.activeCoupons}</div>
              </CardContent>
            </Card>
            <Card className="py-0 sm:py-0 gap-0 col-span-2 md:col-span-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 py-1 pb-0 sm:p-4 sm:py-2 sm:pb-0">
                <CardTitle className="text-[10px] sm:text-sm font-medium">Total Usage</CardTitle>
                <Users className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-2 pt-0 pb-1 sm:p-4 sm:pt-0 sm:pb-2">
                <div className="text-base sm:text-2xl font-bold truncate leading-tight">{stats.totalUsage}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>
                Filter and search through your coupons.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search coupons..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
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
            </CardContent>
          </Card>

          {/* Coupons Table */}
          <Card>
            <CardHeader>
              <CardTitle>Coupons</CardTitle>
              <CardDescription>
                A list of all your promotional codes and their performance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CouponsTable
                coupons={filteredCoupons}
                loading={loading}
                onEdit={handleEditCoupon}
                onDelete={handleDeleteCoupon}
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </CardContent>
          </Card>

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
