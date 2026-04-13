'use client';

import React, { Suspense } from 'react';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { useAuth } from '@/contexts/auth-context';
import { OrdersTable } from '@/components/orders/orders-table';
import { CreateOrderDialog } from '@/components/orders/create-order-dialog';
import { EditOrderDialog } from '@/components/orders/edit-order-dialog';
import { OrderStatusDialog } from '@/components/orders/order-status-dialog';
import { ViewOrderDetails } from '@/components/orders/view-order-details';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
// Card components no longer used in main layout (kept for potential future use)
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { OrderDateFilter } from '@/components/orders/order-date-filter';
import { SendReportDialog } from '@/components/shared/send-report-dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  Plus,
  Check,
  ChevronsUpDown,
  FileSpreadsheet,
  Search,
  ShoppingCart,
  Clock,
  Truck,
  CheckCircle,
  XCircle,
  DollarSign,
  Package
} from 'lucide-react';
import { api, Order } from '@/lib/api';
import logger from '@/lib/logger';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { downloadOrdersExcel } from '@/lib/export-orders';

function OrdersPageContent() {
  const { isLoading, isAuthenticated, hasRole } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<string>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [dateRangeType, setDateRangeType] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [statusStats, setStatusStats] = useState<{
    pending: number;
    processing: number;
    labelCreated: number;
    shipped: number;
    delivered: number;
    cancelled: number;
    refunded: number;
    onHold: number;
  } | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [statusOrder, setStatusOrder] = useState<Order | null>(null);
  const [showViewDetails, setShowViewDetails] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [salesChannels, setSalesChannels] = useState<any[]>([]);
  const [salesChannelFilter, setSalesChannelFilter] = useState<string>('all');
  const [salesReps, setSalesReps] = useState<any[]>([]);
  const [salesRepFilter, setSalesRepFilter] = useState<string>('all');
  const [salesRepPopoverOpen, setSalesRepPopoverOpen] = useState(false);
  const searchParams = useSearchParams();

  const ITEMS_PER_PAGE = 10;

  // Ensure first client render matches SSR output to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check for orderId parameter to auto-open order details dialog
  useEffect(() => {
    const orderId = searchParams.get('orderId');
    if (orderId) {
      setSelectedOrderId(orderId);
      setShowViewDetails(true);
      // Clean up URL parameter
      const url = new URL(window.location.href);
      url.searchParams.delete('orderId');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      let dateFromStr: string | undefined;
      let dateToStr: string | undefined;

      if (dateRange.from) {
        const fromDate = dateRange.from;
        dateFromStr = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}-${String(fromDate.getDate()).padStart(2, '0')}`;
        const toDate = dateRange.to || dateRange.from;
        dateToStr = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, '0')}-${String(toDate.getDate()).padStart(2, '0')}`;
      }

      const params = {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        search: searchTerm || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        customerId: customerFilter !== 'all' ? customerFilter : undefined,
        salesRepId: salesRepFilter !== 'all' ? salesRepFilter : undefined,
        customerType: customerTypeFilter !== 'all' ? customerTypeFilter : undefined,
        paymentMethod: paymentMethodFilter !== 'all' ? paymentMethodFilter : undefined,
        dateFrom: dateFromStr,
        dateTo: dateToStr,
        salesChannelId: salesChannelFilter !== 'all' ? salesChannelFilter : undefined,
        usePSTFilter: true, // Legacy flag, now default behavior
        excludeFailedPayments: true,
      };

      const response = await api.getOrders(params);

      if (response.success && response.data) {
        setOrders(response.data.orders || []);
        setTotalOrders(response.data.pagination.total);
        setTotalPages(response.data.pagination.pages);
        const statsBlock: any = (response.data as any).stats;
        if (statsBlock) setStatusStats(statsBlock);
      }
    } catch (error) {
      logger.error('Failed to fetch orders:', { error });
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesChannels = async () => {
    try {
      const response = await api.get('/sales-channels');
      if (response.success) {
        setSalesChannels(response.data || []);
      }
    } catch (error) {
      logger.error('Failed to fetch sales channels:', { error });
    }
  };

  const fetchSalesReps = async () => {
    try {
      const response = await api.get('/sales-managers/available/sales-reps');
      if (response.success) {
        setSalesReps(response.data || []);
        return;
      }
    } catch (error) {
      // Fall through to alternative endpoint
    }

    try {
      const response = await api.get('/sales-reps');
      if (response.success) {
        setSalesReps(response.data || []);
      }
    } catch (error) {
      logger.error('Failed to fetch sales reps:', { error });
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchSalesChannels();
    fetchSalesReps();
  }, [currentPage, searchTerm, statusFilter, customerFilter, salesRepFilter, customerTypeFilter, paymentMethodFilter, dateRange, salesChannelFilter]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleCustomerFilter = (value: string) => {
    setCustomerFilter(value);
    setCurrentPage(1);
  };

  const handleSalesRepFilter = (value: string) => {
    setSalesRepFilter(value);
    setCurrentPage(1);
  };

  const handleCustomerTypeFilter = (value: string) => {
    setCustomerTypeFilter(value);
    setCurrentPage(1);
  };

  const handlePaymentMethodFilter = (value: string) => {
    setPaymentMethodFilter(value);
    setCurrentPage(1);
  };

  const handleDateRangeChange = (range: { from: Date | undefined; to: Date | undefined }) => {
    setDateRange(range);
    setCurrentPage(1);
  };

  const handleDateRangeTypeChange = (type: string) => {
    setDateRangeType(type);
    setCurrentPage(1);
  };

  const handleFromDateChange = (date: Date | undefined) => {
    setDateRange(prev => ({ ...prev, from: date }));
    setCurrentPage(1);
  };

  const handleToDateChange = (date: Date | undefined) => {
    setDateRange(prev => ({ ...prev, to: date }));
    setCurrentPage(1);
  };

  const handleOrderCreated = () => {
    setShowCreateDialog(false);
    fetchOrders();
    toast.success('Order created successfully');
  };

  const handleOrderUpdated = () => {
    setEditingOrder(null);
    fetchOrders();
    toast.success('Order updated successfully');
  };

  const handleEditOrder = async (order: Order) => {
    try {
      // Fetch full order data including all details
      const response = await api.getOrder(order.id);

      if (response.success && response.data) {
        setEditingOrder(response.data);
      } else {
        toast.error('Failed to load order details');
      }
    } catch (error) {
      logger.error('Failed to fetch order details:', { error });
      toast.error('Failed to load order details');
    }
  };

  const handleStatusUpdated = () => {
    setStatusOrder(null);
    fetchOrders();
    toast.success('Order status updated successfully');
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      const response = await api.hardDeleteOrder(orderId);
      if (response.success) {
        fetchOrders();
        toast.success('Order deleted successfully');
      }
    } catch (error) {
      logger.error('Failed to delete order:', { error });
      toast.error('Failed to delete order');
    }
  };

  const handleUpdateStatus = (order: Order) => {
    setStatusOrder(order);
  };

  const handleViewDetails = (orderId: string) => {
    logger.debug('handleViewDetails called with orderId:', { orderId });
    setSelectedOrderId(orderId);
    setShowViewDetails(true);
  };

  const handleExportAll = async () => {
    let page = 1;
    const limit = 100;
    let pages = 1;
    const all: Order[] = [];

    let dateFromStr: string | undefined;
    let dateToStr: string | undefined;

    if (dateRange.from) {
      dateFromStr = `${dateRange.from.getFullYear()}-${String(dateRange.from.getMonth() + 1).padStart(2, '0')}-${String(dateRange.from.getDate()).padStart(2, '0')}`;
      const toDate = dateRange.to || dateRange.from;
      dateToStr = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, '0')}-${String(toDate.getDate()).padStart(2, '0')}`;
    }

    try {
      do {
        const res: any = await api.getOrders({
          page,
          limit,
          search: searchTerm || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          customerId: customerFilter !== 'all' ? customerFilter : undefined,
          salesRepId: salesRepFilter !== 'all' ? salesRepFilter : undefined,
          customerType: customerTypeFilter !== 'all' ? customerTypeFilter : undefined,
          paymentMethod: paymentMethodFilter !== 'all' ? paymentMethodFilter : undefined,
          dateFrom: dateFromStr,
          dateTo: dateToStr,
          salesChannelId: salesChannelFilter !== 'all' ? salesChannelFilter : undefined,
          usePSTFilter: true,
          excludeFailedPayments: true,
        });

        if (res?.success && res?.data) {
          all.push(...(res.data.orders || []));
          const pagination = res.data.pagination || {};
          pages = pagination.pages || 1;
        } else {
          break;
        }
        page += 1;
      } while (page <= pages);

      const fileName = `orders-all-${new Date().toISOString().split('T')[0]}.xlsx`;
      downloadOrdersExcel(all, fileName);
      toast.success(`Exported ${all.length} orders to ${fileName}`);
    } catch (e) {
      logger.error('Export all failed:', { error: e });
      toast.error('Failed to export all orders');
      throw e; // Propagate error so OrdersTable can handle it
    }
  };

  const handleSendEmailReport = async (email: string) => {
    let dateFromStr: string | undefined;
    let dateToStr: string | undefined;

    if (dateRange.from) {
      dateFromStr = `${dateRange.from.getFullYear()}-${String(dateRange.from.getMonth() + 1).padStart(2, '0')}-${String(dateRange.from.getDate()).padStart(2, '0')}`;
      const toDate = dateRange.to || dateRange.from;
      dateToStr = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, '0')}-${String(toDate.getDate()).padStart(2, '0')}`;
    }

    return api.sendOrdersEmailReport({
      email,
      dateFrom: dateFromStr,
      dateTo: dateToStr,
      usePSTFilter: true, // Legacy flag, now default behavior
      filters: {
        search: searchTerm || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        customerId: customerFilter !== 'all' ? customerFilter : undefined,
        salesRepId: salesRepFilter !== 'all' ? salesRepFilter : undefined,
        customerType: customerTypeFilter !== 'all' ? customerTypeFilter : undefined,
        paymentMethod: paymentMethodFilter !== 'all' ? paymentMethodFilter : undefined,
        salesChannelId: salesChannelFilter !== 'all' ? salesChannelFilter : undefined,
      }
    });
  };

  useEffect(() => {
    const view = searchParams?.get('view');
    if (view) {
      setSelectedOrderId(view);
      setShowViewDetails(true);
    }
  }, [searchParams]);

  // Calculate stats
  const stats = {
    total: totalOrders,
    pending: statusStats?.pending ?? orders.filter(o => o.status === 'PENDING').length,
    processing: statusStats?.processing ?? orders.filter(o => o.status === 'PROCESSING').length,
    shipped: statusStats?.shipped ?? orders.filter(o => o.status === 'SHIPPED').length,
    delivered: statusStats?.delivered ?? orders.filter(o => o.status === 'DELIVERED').length,
    cancelled: statusStats?.cancelled ?? orders.filter(o => o.status === 'CANCELLED').length,
    refunded: statusStats?.refunded ?? orders.filter(o => o.status === 'REFUNDED').length,
    onHold: statusStats?.onHold ?? orders.filter(o => o.status === 'ON_HOLD').length,
    labelCreated: statusStats?.labelCreated ?? orders.filter(o => o.status === 'LABEL_CREATED').length,
    totalRevenue: (statusStats as any)?.revenue ?? orders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0),
  };

  if (!mounted || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  if (!isAuthenticated || !hasRole(['ADMIN', 'MANAGER', 'STAFF', 'SALES_REP', 'SALES_MANAGER'])) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-5 px-2 sm:px-0">

        {/* ── Page header ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Orders</h1>
            <p className="text-sm text-slate-500 mt-0.5">Manage and track your fulfillment pipeline</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={salesChannelFilter} onValueChange={(val) => { setSalesChannelFilter(val); setCurrentPage(1); }}>
              <SelectTrigger className="w-[180px] h-9 text-sm border-slate-200 rounded-xl">
                <SelectValue placeholder="Filter by source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Orders</SelectItem>
                <SelectItem value="research">Ascendra Bio orders</SelectItem>
                <SelectItem value="channels">All Sales Channels</SelectItem>
                {salesChannels.length > 0 && <SelectSeparator />}
                {salesChannels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.id}>{channel.companyName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="h-9 px-4 bg-[#1B2D4F] hover:bg-[#243d6b] text-white rounded-xl text-sm font-medium"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Create Order
            </Button>
          </div>
        </div>

        {/* ── Stats grid (2 × 4 bento) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

          {/* Row 1 */}
          <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 px-5 py-4 shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <ShoppingCart className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Total Orders</p>
              <p className="text-2xl font-bold text-slate-900 leading-tight">{(stats.total ?? 0).toLocaleString()}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 px-5 py-4 shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Pending</p>
              <p className="text-2xl font-bold text-amber-600 leading-tight">{(stats.pending ?? 0).toLocaleString()}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 px-5 py-4 shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <Package className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Processing</p>
              <p className="text-2xl font-bold text-blue-600 leading-tight">{(stats.processing ?? 0).toLocaleString()}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 px-5 py-4 shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-cyan-50 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="h-5 w-5 text-cyan-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Label Printed</p>
              <p className="text-2xl font-bold text-cyan-600 leading-tight">{(stats.labelCreated ?? 0).toLocaleString()}</p>
            </div>
          </div>

          {/* Row 2 */}
          <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 px-5 py-4 shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
              <Truck className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Shipped</p>
              <p className="text-2xl font-bold text-purple-600 leading-tight">{(stats.shipped ?? 0).toLocaleString()}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 px-5 py-4 shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Delivered</p>
              <p className="text-2xl font-bold text-emerald-600 leading-tight">{(stats.delivered ?? 0).toLocaleString()}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 px-5 py-4 shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <XCircle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Cancelled</p>
              <p className="text-2xl font-bold text-red-600 leading-tight">{(stats.cancelled ?? 0).toLocaleString()}</p>
            </div>
          </div>

          {/* Revenue — dark navy hero */}
          <div className="flex items-center gap-3 bg-[#1B2D4F] rounded-2xl px-5 py-4 shadow-sm relative overflow-hidden">
            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/5" />
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500/40 to-transparent" />
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 relative z-10">
              <DollarSign className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="relative z-10 min-w-0">
              <p className="text-xs text-slate-400 font-medium">Total Revenue</p>
              <p className="text-2xl font-bold text-white leading-tight truncate" title={`$${Number(stats.totalRevenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
                ${Number(stats.totalRevenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

        </div>

        {/* ── Filters bar ── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by order ID, customer or product…"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 h-10 bg-slate-50 border-slate-200 rounded-xl text-sm placeholder:text-slate-400"
            />
          </div>

          {/* Filter pills row */}
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={statusFilter} onValueChange={handleStatusFilter}>
              <SelectTrigger className="h-9 px-3 text-sm border-slate-200 rounded-xl bg-slate-50 w-auto min-w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="PROCESSING">Processing</SelectItem>
                <SelectItem value="LABEL_CREATED">Label Printed</SelectItem>
                <SelectItem value="SHIPPED">Shipped</SelectItem>
                <SelectItem value="DELIVERED">Delivered</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                <SelectItem value="REFUNDED">Refunded</SelectItem>
                <SelectItem value="ON_HOLD">On Hold</SelectItem>
              </SelectContent>
            </Select>

            <OrderDateFilter
              range={dateRangeType}
              setRange={handleDateRangeTypeChange}
              from={dateRange.from}
              setFrom={handleFromDateChange}
              to={dateRange.to}
              setTo={handleToDateChange}
              className=""
            />

            <Select value={customerTypeFilter} onValueChange={handleCustomerTypeFilter}>
              <SelectTrigger className="h-9 px-3 text-sm border-slate-200 rounded-xl bg-slate-50 w-auto min-w-[140px]">
                <SelectValue placeholder="Customer type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customer</SelectItem>
                <SelectItem value="wholesale">Wholesale</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>

            <Select value={paymentMethodFilter} onValueChange={handlePaymentMethodFilter}>
              <SelectTrigger className="h-9 px-3 text-sm border-slate-200 rounded-xl bg-slate-50 w-auto min-w-[170px]">
                <SelectValue placeholder="Payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payment Methods</SelectItem>
                <SelectItem value="ZELLE">Zelle</SelectItem>
                <SelectItem value="BANK_WIRE">Bank Wire</SelectItem>
                <SelectItem value="AUTHORIZE_NET">Authorize.Net</SelectItem>
              </SelectContent>
            </Select>

            <Popover open={salesRepPopoverOpen} onOpenChange={setSalesRepPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="h-9 px-3 text-sm border-slate-200 rounded-xl bg-slate-50 justify-between font-normal text-slate-700 min-w-[130px]"
                >
                  <span className="truncate">
                    {salesRepFilter === 'all'
                      ? 'All Reps'
                      : (() => {
                          const rep = salesReps.find((r: any) => r?.id === salesRepFilter);
                          const user = rep?.user;
                          const name = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '';
                          return name || user?.email || salesRepFilter;
                        })()}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="p-0 z-50 w-[var(--radix-popover-trigger-width)]"
                side="bottom"
                align="start"
                sideOffset={4}
              >
                <Command shouldFilter={true} className="w-full">
                  <CommandInput placeholder="Search sales rep..." />
                  <CommandList className="max-h-[300px] w-full overflow-y-auto overflow-x-hidden pointer-events-auto">
                    <CommandEmpty>No sales rep found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="all reps"
                        onSelect={() => {
                          handleSalesRepFilter('all');
                          setSalesRepPopoverOpen(false);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", salesRepFilter === 'all' ? "opacity-100" : "opacity-0")} />
                        All Reps
                      </CommandItem>
                      {salesReps.map((rep: any) => {
                        const user = rep?.user;
                        const name = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '';
                        const label = name || user?.email || rep.id;
                        return (
                          <CommandItem
                            key={rep.id}
                            value={`${label} ${user?.email || ''}`}
                            onSelect={() => {
                              handleSalesRepFilter(rep.id);
                              setSalesRepPopoverOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", rep.id === salesRepFilter ? "opacity-100" : "opacity-0")} />
                            {label}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* ── Orders table ── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-[#1B2D4F]/8 flex items-center justify-center">
                <ShoppingCart className="h-4 w-4 text-[#1B2D4F]" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Orders List</h2>
                <p className="text-xs text-slate-400">{totalOrders.toLocaleString()} total orders</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <OrdersTable
              orders={orders}
              loading={loading}
              onEdit={handleEditOrder}
              onDelete={handleDeleteOrder}
              onUpdateStatus={handleUpdateStatus}
              onViewDetails={handleViewDetails}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              onRefresh={fetchOrders}
              totalOrders={totalOrders}
              onExportAll={handleExportAll}
              onEmailReport={() => setShowEmailDialog(true)}
            />
          </div>
        </div>

        {/* Dialogs */}
        < CreateOrderDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={handleOrderCreated}
        />

        <EditOrderDialog
          order={editingOrder}
          open={!!editingOrder}
          onOpenChange={(open) => !open && setEditingOrder(null)}
          onSuccess={handleOrderUpdated}
          onDelete={handleDeleteOrder}
          onCommentAdded={fetchOrders}
        />

        <OrderStatusDialog
          order={statusOrder}
          open={!!statusOrder}
          onOpenChange={(open) => !open && setStatusOrder(null)}
          onSuccess={handleStatusUpdated}
        />

        <ViewOrderDetails
          open={showViewDetails}
          onOpenChange={setShowViewDetails}
          orderId={selectedOrderId}
          onCommentAdded={fetchOrders}
        />

        <SendReportDialog
          open={showEmailDialog}
          onOpenChange={setShowEmailDialog}
          onSend={handleSendEmailReport}
          title="Send Orders Report"
          description="Enter the email address where you want to receive the filtered orders report."
        />
      </div >
    </DashboardLayout >
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><LoadingSpinner size={32} /></div>}>
      <OrdersPageContent />
    </Suspense>
  );
}
