'use client';

import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { EditOrderDialog } from '@/components/orders/edit-order-dialog';
import { ProtectedRoute } from '@/contexts/auth-context';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, formatCurrency } from '@/lib/api';
import logger from '@/lib/logger';
import {
  Award,
  DollarSign,
  Users,
  Calendar as CalendarIcon,
  ShoppingCart,
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { toast } from 'sonner';

type RangeKey = 'day' | '7d' | '30d' | '90d' | '365d' | 'custom' | 'all';
type SortMetric = 'revenue' | 'orders' | 'assignedReps' | 'activeReps';

interface SalesManagerMetrics {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  assignedReps: number;
  activeReps: number;
  personalRevenue: number;
  personalOrders: number;
  personalAverageOrderValue: number;
  personalAssignedCustomers: number;
  personalActiveCustomers: number;
}

interface SalesManagerPerformance {
  salesManagerId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    isActive: boolean;
  };
  metrics: SalesManagerMetrics;
  monthlyPerformance: Array<{ month: string; revenue: number; orders: number }>;
  reps: Array<{
    id: string;
    name: string;
    email: string;
    revenue: number;
    orders: number;
  }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    totalAmount: number;
    status: string;
    createdAt: string;
    repName: string;
    customerName?: string;
  }>;
}

interface SalesManagerPerformanceResponse {
  range: string;
  rangeDays: number;
  generatedAt: string;
  period?: {
    from: string;
    to: string;
  };
  totals: {
    totalRevenue: number;
    totalOrders: number;
    averageConversion: number;
    managersActive: number;
  };
  managers: SalesManagerPerformance[];
}

const RANGE_OPTIONS: Array<{ label: string; value: RangeKey }> = [
  { label: '1 Day', value: 'day' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'Last 12 months', value: '365d' },
  { label: 'All Time', value: 'all' },
  { label: 'Custom range', value: 'custom' },
];

const METRIC_OPTIONS: Array<{ value: SortMetric; label: string }> = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'orders', label: 'Orders' },
  { value: 'assignedReps', label: 'Assigned Reps' },
  { value: 'activeReps', label: 'Active Reps' },
];

export default function SalesManagerAnalyticsPage() {
  const [range, setRange] = useState<RangeKey>('90d');
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SalesManagerPerformanceResponse | null>(null);
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isOrderLoading, setIsOrderLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortMetric, setSortMetric] = useState<SortMetric>('revenue');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Order History pagination
  const [orderPage, setOrderPage] = useState(1);
  const ORDER_PAGE_SIZE = 10;

  const loadData = async (
    selectedRange: RangeKey,
    from?: Date | null,
    to?: Date | null
  ) => {
    try {
      setLoading(true);
      setError(null);

      let rangeToSend: string = selectedRange;
      let fromToSend = from;
      let toToSend = to;

      if (selectedRange === 'day' && from) {
        rangeToSend = 'custom';
        fromToSend = new Date(from);
        fromToSend.setHours(0, 0, 0, 0);
        toToSend = new Date(from);
        toToSend.setHours(23, 59, 59, 999);
      }

      const params = new URLSearchParams();
      params.append('range', rangeToSend);
      if (fromToSend) {
        const yyyy = fromToSend.getFullYear();
        const mm = String(fromToSend.getMonth() + 1).padStart(2, '0');
        const dd = String(fromToSend.getDate()).padStart(2, '0');
        params.append('from', `${yyyy}-${mm}-${dd}`);
      }
      if (toToSend) {
        const yyyy = toToSend.getFullYear();
        const mm = String(toToSend.getMonth() + 1).padStart(2, '0');
        const dd = String(toToSend.getDate()).padStart(2, '0');
        params.append('to', `${yyyy}-${mm}-${dd}`);
      }
      params.append('usePSTFilter', 'true');

      const response = await api.get(`/analytics/sales-managers?${params.toString()}`);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Unable to load analytics.');
      }

      setData(response.data);
    } catch (err: any) {
      logger.error('Failed to load analytics:', { error: err });
      setError(err?.message || 'Unable to load analytics.');
      setData(null);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (range === 'custom') {
      if (!customFrom || !customTo) return;
      loadData(range, customFrom, customTo);
    } else if (range === 'day') {
      if (!customFrom) return;
      loadData(range, customFrom);
    } else {
      loadData(range);
    }
    setCurrentPage(1);
  }, [range, customFrom, customTo, searchQuery]);

  const filteredSortedManagers = useMemo(() => {
    if (!data) return [];
    const query = searchQuery.trim().toLowerCase();
    const filtered = data.managers.filter((m) => {
      const name = `${m.user.firstName} ${m.user.lastName}`.toLowerCase();
      const email = m.user.email.toLowerCase();
      return !query || name.includes(query) || email.includes(query);
    });

    return filtered.sort((a, b) => {
      let valA = 0, valB = 0;
      switch (sortMetric) {
        case 'revenue': valA = a.metrics.totalRevenue; valB = b.metrics.totalRevenue; break;
        case 'orders': valA = a.metrics.totalOrders; valB = b.metrics.totalOrders; break;
        case 'assignedReps': valA = a.metrics.assignedReps; valB = b.metrics.assignedReps; break;
        case 'activeReps': valA = a.metrics.activeReps; valB = b.metrics.activeReps; break;
      }
      return sortDirection === 'desc' ? valB - valA : valA - valB;
    });
  }, [data, searchQuery, sortMetric, sortDirection]);

  const paginatedManagers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredSortedManagers.slice(startIndex, startIndex + pageSize);
  }, [filteredSortedManagers, currentPage]);

  const totalPages = Math.ceil(filteredSortedManagers.length / pageSize);

  useEffect(() => {
    if (filteredSortedManagers.length > 0 && !selectedManagerId) {
      setSelectedManagerId(filteredSortedManagers[0].salesManagerId);
    }
  }, [filteredSortedManagers, selectedManagerId]);

  const selectedManager = useMemo(() => {
    return data?.managers.find(m => m.salesManagerId === selectedManagerId) || null;
  }, [data, selectedManagerId]);

  // Paginate order history for the selected manager
  const totalOrderPages = useMemo(() => {
    if (!selectedManager?.recentOrders) return 1;
    return Math.max(1, Math.ceil(selectedManager.recentOrders.length / ORDER_PAGE_SIZE));
  }, [selectedManager]);

  const paginatedOrders = useMemo(() => {
    if (!selectedManager?.recentOrders) return [];
    return selectedManager.recentOrders.slice(
      (orderPage - 1) * ORDER_PAGE_SIZE,
      orderPage * ORDER_PAGE_SIZE
    );
  }, [selectedManager, orderPage]);

  // Reset order page when selected manager changes
  useEffect(() => {
    setOrderPage(1);
  }, [selectedManagerId]);

  const handleRetry = () => {
    if (range === 'custom') {
      if (customFrom && customTo) loadData(range, customFrom, customTo);
    } else if (range === 'day') {
      if (customFrom) loadData(range, customFrom);
    } else {
      loadData(range);
    }
  };

  const handleOrderClick = async (orderId: string) => {
    setIsOrderLoading(true);
    // Optimistically set the selected order to show the dialog opening (optional, but good UX if we had partial data to show)
    // Here we'll just wait for the full data to ensure editing works correctly.
    // If we wanted to show partial data, we could find it in recentOrders and set it first.

    try {
      const response = await api.getOrder(orderId);
      if (response.success && response.data) {
        setSelectedOrder(response.data);
      } else {
        toast.error('Failed to load order details');
      }
    } catch (error) {
      logger.error('Error fetching order:', { error });
      toast.error('Error fetching order details');
    } finally {
      setIsOrderLoading(false);
    }
  };

  return (
    <ProtectedRoute requiredRoles={['ADMIN', 'MANAGER', 'SALES_MANAGER', 'STAFF']}>
      <DashboardLayout>
        <div className="space-y-0">
          {/* ════════ DARK HERO STRIP ════════ */}
          <div className="relative bg-[#070B14] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#4D7DF2]/8 rounded-full blur-[100px] pointer-events-none" />
            <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-xl font-black text-white tracking-tight">Sales Manager Performance</h1>
                  <p className="text-xs text-gray-500 mt-0.5">Comprehensive view of your sales managers, their teams, and direct assignments.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
                    <SelectTrigger className="w-full sm:w-40 h-9 sm:h-10">
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      {RANGE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  {range === 'day' && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full sm:w-44 text-left font-normal h-9 sm:h-10">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {customFrom ? customFrom.toLocaleDateString() : 'Select date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarPicker mode="single" selected={customFrom || undefined} onSelect={(d) => setCustomFrom(d || null)} initialFocus />
                      </PopoverContent>
                    </Popover>
                  )}

                  {range === 'custom' && (
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full sm:w-40 justify-start h-9 sm:h-10 text-xs sm:text-sm">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {customFrom ? customFrom.toLocaleDateString() : 'From date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarPicker mode="single" selected={customFrom || undefined} onSelect={(d) => setCustomFrom(d || null)} />
                        </PopoverContent>
                      </Popover>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full sm:w-40 justify-start h-9 sm:h-10 text-xs sm:text-sm">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {customTo ? customTo.toLocaleDateString() : 'To date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarPicker mode="single" selected={customTo || undefined} onSelect={(d) => setCustomTo(d || null)} />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRetry}
                      disabled={loading || (range === 'day' && !customFrom) || (range === 'custom' && (!customFrom || !customTo))}
                      className="flex items-center gap-1.5 h-9 px-3 bg-white/[0.06] border border-white/[0.08] rounded-xl text-xs font-bold text-gray-300 hover:bg-white/[0.12] hover:text-white transition-colors disabled:opacity-50"
                    >
                      Refresh
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5 mt-5">
          {loading && !data ? (
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <LoadingSpinner size={24} />
                  <span className="text-sm">Loading performance data…</span>
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                <p className="font-semibold text-red-600">Failed to load analytics</p>
              </div>
              <div className="px-6 py-4 space-y-3">
                <p className="text-sm text-muted-foreground">{error}</p>
                <button
                  onClick={handleRetry}
                  className="h-9 px-4 bg-[#1B2D4F] hover:bg-[#243d6b] text-white rounded-xl text-sm font-medium"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : !data || data.managers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                <p className="font-semibold">No sales managers found</p>
              </div>
              <div className="px-6 py-4">
                <p className="text-sm text-muted-foreground">
                  Add sales managers and assign teams to start tracking performance.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Summary stat chips */}
              <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
                <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-200/80 shadow-sm px-5 py-4">
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 shrink-0">
                    <DollarSign className="h-4 w-4 text-slate-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Global Revenue</p>
                    <p className="text-base sm:text-2xl font-bold truncate leading-tight">
                      {formatCurrency(data.totals.totalRevenue)}
                    </p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                      Total from all manager-led teams
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-200/80 shadow-sm px-5 py-4">
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 shrink-0">
                    <ShoppingCart className="h-4 w-4 text-slate-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Total Orders</p>
                    <p className="text-base sm:text-2xl font-bold truncate leading-tight">{data.totals.totalOrders}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                      Across all segments
                    </p>
                  </div>
                </div>

                <div className={cn(
                  "flex items-center gap-3 bg-white rounded-2xl border shadow-sm px-5 py-4 col-span-2 lg:col-span-1",
                  selectedManager ? 'border-primary/20 bg-primary/5' : 'border-gray-200/80'
                )}>
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 shrink-0">
                    <Users className="h-4 w-4 text-slate-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Selected Manager</p>
                    <p className="text-base sm:text-2xl font-bold truncate leading-tight">
                      {selectedManager ? selectedManager.user.firstName : 'None'}
                    </p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                      {selectedManager ? `${selectedManager.metrics.assignedReps} Reps | ${formatCurrency(selectedManager.metrics.totalRevenue)} Rev` : 'Select a manager below'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Top Performer banner */}
              {filteredSortedManagers[0] && (
                <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden group hover:shadow-md transition-all">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 shrink-0">
                      <Award className="h-4 w-4 sm:h-5 sm:w-5 text-primary transition-transform group-hover:scale-110" />
                    </div>
                    <div>
                      <p className="text-sm sm:text-base font-bold text-primary">Top Performing Manager</p>
                      <p className="text-xs sm:text-sm text-foreground/70">
                        {filteredSortedManagers[0].user.firstName} {filteredSortedManagers[0].user.lastName}'s team generated{' '}
                        <span className="text-primary font-bold">{formatCurrency(filteredSortedManagers[0].metrics.totalRevenue)}</span> from{' '}
                        <span className="text-primary font-bold">{filteredSortedManagers[0].metrics.totalOrders}</span> orders.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Manager Selection Table */}
              <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 shrink-0">
                    <Users className="h-4 w-4 text-slate-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Sales Managers</p>
                    <p className="text-xs text-muted-foreground">Compare performance across your managerial team.</p>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="relative w-full lg:max-w-md">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search managers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 w-full h-10 rounded-xl"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full lg:w-auto">
                      <Select value={sortMetric} onValueChange={(v) => setSortMetric(v as SortMetric)}>
                        <SelectTrigger className="w-full lg:w-48 h-10 rounded-xl">
                          <SelectValue placeholder="Sort metric" />
                        </SelectTrigger>
                        <SelectContent>
                          {METRIC_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={sortDirection} onValueChange={(v) => setSortDirection(v as 'asc' | 'desc')}>
                        <SelectTrigger className="w-full lg:w-48 h-10 rounded-xl">
                          <SelectValue placeholder="Sort order" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="desc">High to Low</SelectItem>
                          <SelectItem value="asc">Low to High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="rounded-xl border overflow-x-auto bg-muted/5">
                    <Table className="min-w-[900px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Manager</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Team Revenue</TableHead>
                          <TableHead>Team Orders</TableHead>
                          <TableHead>Active Reps</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSortedManagers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                              No managers match your current filters.
                            </TableCell>
                          </TableRow>
                        ) : (
                          paginatedManagers.map((m) => (
                            <TableRow
                              key={m.salesManagerId}
                              className={cn(
                                "cursor-pointer hover:bg-muted/50 transition-colors",
                                selectedManagerId === m.salesManagerId ? "bg-muted border-l-2 border-primary" : ""
                              )}
                              onClick={() => {
                                if (selectedManagerId === m.salesManagerId) {
                                  window.location.href = `/analytics/person?managerId=${m.salesManagerId}`;
                                } else {
                                  setSelectedManagerId(m.salesManagerId);
                                }
                              }}
                            >
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-medium">{m.user.firstName} {m.user.lastName}</span>
                                  <span className="text-xs text-muted-foreground">{m.user.email}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={m.user.isActive ? "outline" : "destructive"}>
                                  {m.user.isActive ? "Active" : "Inactive"}
                                </Badge>
                              </TableCell>
                              <TableCell>{formatCurrency(m.metrics.totalRevenue)}</TableCell>
                              <TableCell>{m.metrics.totalOrders}</TableCell>
                              <TableCell>
                                {m.metrics.activeReps}/{m.metrics.assignedReps}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t">
                      <div className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages} ({filteredSortedManagers.length} Managers)
                      </div>
                      <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                      />
                    </div>
                  )}
                </div>
              </div>

              {selectedManager && (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 shrink-0">
                        <ShoppingCart className="h-4 w-4 text-slate-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">Order History</p>
                        <p className="text-xs text-muted-foreground">
                          All orders associated with {selectedManager.user.firstName} {selectedManager.user.lastName} (Direct &amp; Team) for the selected period.
                        </p>
                      </div>
                    </div>

                    <div className="p-6 space-y-4">
                      <div className="rounded-xl border overflow-x-auto bg-muted/5">
                        <Table className="min-w-[900px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Order #</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Customer</TableHead>
                              <TableHead>Rep</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedOrders.length > 0 ? (
                              paginatedOrders.map((order) => (
                                <TableRow
                                  key={order.orderNumber}
                                  className={cn(
                                    "cursor-pointer hover:bg-muted/50 transition-colors",
                                    isOrderLoading && selectedOrder?.id === order.id ? "opacity-50 pointer-events-none" : ""
                                  )}
                                  onClick={() => handleOrderClick(order.id)}
                                >
                                  <TableCell className="font-medium text-primary">
                                    {order.orderNumber}
                                    {isOrderLoading && selectedOrder?.id === order.id && (
                                      <LoadingSpinner size={12} className="ml-2 inline" />
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {new Date(order.createdAt).toLocaleDateString()}
                                  </TableCell>
                                  <TableCell>
                                    {order.customerName || (order as any).customer?.firstName || 'Unknown'}
                                  </TableCell>
                                  <TableCell>
                                    {order.repName || '-'}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="uppercase text-[10px]">
                                      {order.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {formatCurrency(order.totalAmount)}
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                                  No orders found for this period.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                      {totalOrderPages > 1 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t">
                          <div className="text-sm text-muted-foreground">
                            Page {orderPage} of {totalOrderPages} ({selectedManager.recentOrders?.length || 0} Orders)
                          </div>
                          <Pagination
                            currentPage={orderPage}
                            totalPages={totalOrderPages}
                            onPageChange={setOrderPage}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <EditOrderDialog
                order={selectedOrder}
                open={!!selectedOrder}
                onOpenChange={(open) => !open && setSelectedOrder(null)}
                onSuccess={() => {
                  // Reload data to reflect any changes
                  if (range === 'custom' && customFrom && customTo) {
                    loadData(range, customFrom, customTo);
                  } else if (range === 'day' && customFrom) {
                    loadData(range, customFrom);
                  } else {
                    loadData(range);
                  }
                  setSelectedOrder(null);
                }}
              />
            </>
          )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
