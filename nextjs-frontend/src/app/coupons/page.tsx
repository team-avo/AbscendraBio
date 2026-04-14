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
import {
  Plus,
  Search,
  TrendingUp,
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
        <div className="space-y-0">

          {/* ════════ DARK HERO STRIP ════════ */}
          <div className="relative bg-[#070B14] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#4D7DF2]/8 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
              {/* Top row */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-xl font-black text-white tracking-tight">Promotions</h1>
                  <p className="text-xs text-gray-500 mt-0.5">Manage discount codes and promotional campaigns</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-2">
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                    <div>
                      <p className="text-[9px] text-gray-500 font-medium uppercase tracking-widest leading-none">Total Usage</p>
                      <p className="text-base font-black text-white tabular-nums leading-tight">{stats.totalUsage.toLocaleString()}</p>
                    </div>
                  </div>
                  <Button onClick={() => setShowCreateDialog(true)} className="h-9 px-5 bg-white text-[#070B14] hover:bg-gray-100 rounded-xl text-xs font-black uppercase tracking-widest">
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Create Coupon
                  </Button>
                </div>
              </div>

              {/* Status + type pills */}
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
                {[
                  { sKey: 'all',      tKey: 'all',             label: 'All',           count: stats.totalCoupons,  color: null },
                  { sKey: 'active',   tKey: 'all',             label: 'Active',        count: stats.activeCoupons, color: 'emerald' },
                  { sKey: 'inactive', tKey: 'all',             label: 'Inactive',      count: stats.totalCoupons - stats.activeCoupons, color: 'red' },
                  { sKey: 'all',      tKey: 'PERCENTAGE',      label: '% Discount',    count: null, color: 'blue' },
                  { sKey: 'all',      tKey: 'FIXED_AMOUNT',    label: 'Fixed',         count: null, color: 'purple' },
                  { sKey: 'all',      tKey: 'VOLUME_DISCOUNT', label: 'Volume',        count: null, color: 'amber' },
                ].map((pill) => {
                  const colorStyles: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
                    emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', ring: 'ring-emerald-500/30', dot: 'bg-emerald-400' },
                    red:     { bg: 'bg-red-500/15',     text: 'text-red-400',     ring: 'ring-red-500/30',     dot: 'bg-red-400' },
                    blue:    { bg: 'bg-blue-500/15',    text: 'text-blue-400',    ring: 'ring-blue-500/30',    dot: 'bg-blue-400' },
                    purple:  { bg: 'bg-purple-500/15',  text: 'text-purple-400',  ring: 'ring-purple-500/30',  dot: 'bg-purple-400' },
                    amber:   { bg: 'bg-amber-500/15',   text: 'text-amber-400',   ring: 'ring-amber-500/30',   dot: 'bg-amber-400' },
                  };
                  const c = pill.color ? colorStyles[pill.color] : null;
                  const isAll = pill.sKey === 'all' && pill.tKey === 'all';
                  const isActive = isAll
                    ? statusFilter === 'all' && typeFilter === 'all'
                    : statusFilter === pill.sKey && typeFilter === pill.tKey;
                  return (
                    <button
                      key={`${pill.sKey}-${pill.tKey}`}
                      onClick={() => { setStatusFilter(pill.sKey); setTypeFilter(pill.tKey); setCurrentPage(1); }}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        isAll && isActive ? 'bg-white/15 text-white ring-1 ring-white/20'
                        : isActive && c ? `${c.bg} ${c.text} ring-1 ${c.ring}`
                        : 'bg-white/[0.04] text-gray-500 hover:bg-white/[0.08] hover:text-gray-300'
                      }`}
                    >
                      {c && <span className={`w-1.5 h-1.5 rounded-full ${isActive ? c.dot : 'bg-gray-600'}`} />}
                      <span>{pill.label}</span>
                      {pill.count !== null && (
                        <span className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-black tabular-nums ${
                          isAll && isActive ? 'bg-white/20 text-white'
                          : isActive && c ? `${c.bg} ${c.text}`
                          : 'bg-white/[0.06] text-gray-500'
                        }`}>
                          {(pill.count ?? 0).toLocaleString()}
                        </span>
                      )}
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
                  placeholder="Search coupons by code or description…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-9 bg-white border-gray-200 rounded-xl text-xs placeholder:text-gray-400"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 px-3 text-xs border-gray-200 rounded-xl bg-white w-auto min-w-[120px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-9 px-3 text-xs border-gray-200 rounded-xl bg-white w-auto min-w-[140px]">
                    <SelectValue placeholder="Type" />
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
          </div>

          {/* ════════ TABLE ════════ */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden mx-1 sm:mx-0">
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

          {/* ════════ DIALOGS ════════ */}
          <CreateCouponDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} onSuccess={handleCouponCreated} />
          <EditCouponDialog coupon={editingCoupon} open={!!editingCoupon} onOpenChange={(open) => !open && setEditingCoupon(null)} onSuccess={handleCouponUpdated} />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
