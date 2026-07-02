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

  const pipelineSteps = [
    { key: 'PENDING', label: 'Pending', count: stats.pending ?? 0, color: 'amber' },
    { key: 'PROCESSING', label: 'Processing', count: stats.processing ?? 0, color: 'blue' },
    { key: 'LABEL_CREATED', label: 'Label Printed', count: stats.labelCreated ?? 0, color: 'cyan' },
    { key: 'SHIPPED', label: 'Shipped', count: stats.shipped ?? 0, color: 'purple' },
    { key: 'DELIVERED', label: 'Delivered', count: stats.delivered ?? 0, color: 'emerald' },
    { key: 'CANCELLED', label: 'Cancelled', count: stats.cancelled ?? 0, color: 'red' },
  ];

  const colorMap: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
    amber:   { bg: 'bg-amber-500/15',   text: 'text-amber-400',   ring: 'ring-amber-500/30',   dot: 'bg-amber-400' },
    blue:    { bg: 'bg-blue-500/15',     text: 'text-blue-400',    ring: 'ring-blue-500/30',    dot: 'bg-blue-400' },
    cyan:    { bg: 'bg-cyan-500/15',     text: 'text-cyan-400',    ring: 'ring-cyan-500/30',    dot: 'bg-cyan-400' },
    purple:  { bg: 'bg-purple-500/15',   text: 'text-purple-400',  ring: 'ring-purple-500/30',  dot: 'bg-purple-400' },
    emerald: { bg: 'bg-emerald-500/15',  text: 'text-emerald-400', ring: 'ring-emerald-500/30', dot: 'bg-emerald-400' },
    red:     { bg: 'bg-red-500/15',      text: 'text-red-400',     ring: 'ring-red-500/30',     dot: 'bg-red-400' },
  };

  return (
    <DashboardLayout>
      <div className="space-y-0">

        {/* ════════ DARK HERO STRIP ════════ */}
        <div className="relative bg-mist border border-line border-t-2 border-t-[#5A9ADA] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
          {/* Texture + glow */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#5A9ADA]/8 rounded-full blur-[100px] pointer-events-none" />

          <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
            {/* Top row: title + revenue + create */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-xl font-black text-[#043061] tracking-tight">Orders</h1>
                <p className="text-xs text-gray-500 mt-0.5">Fulfillment pipeline &amp; order management</p>
              </div>
              <div className="flex items-center gap-4">
                {/* Revenue chip */}
                <div className="flex items-center gap-2.5 bg-white border border-line rounded-xl px-4 py-2">
                  <DollarSign className="h-4 w-4 text-emerald-400" />
                  <div>
                    <p className="text-[9px] text-gray-500 font-medium uppercase tracking-widest leading-none">Revenue</p>
                    <p className="text-base font-black text-[#043061] tabular-nums leading-tight">
                      ${Number(stats.totalRevenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
                <Select value={salesChannelFilter} onValueChange={(val) => { setSalesChannelFilter(val); setCurrentPage(1); }}>
                  <SelectTrigger className="h-9 w-[160px] text-xs border-white/10 bg-white/[0.06] text-gray-300 rounded-xl">
                    <SelectValue placeholder="All Orders" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Orders</SelectItem>
                    <SelectItem value="research">Ascendra Bio</SelectItem>
                    <SelectItem value="channels">All Channels</SelectItem>
                    {salesChannels.length > 0 && <SelectSeparator />}
                    {salesChannels.map((ch) => (
                      <SelectItem key={ch.id} value={ch.id}>{ch.companyName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => setShowCreateDialog(true)} className="h-9 px-5 bg-[#043061] text-white hover:bg-[#0b4f96] rounded-xl text-xs font-black uppercase tracking-widest">
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> New Order
                </Button>
              </div>
            </div>

            {/* Pipeline status pills */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
              {/* "All" pill */}
              <button
                onClick={() => { handleStatusFilter('all'); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  statusFilter === 'all'
                    ? 'bg-[#043061] text-white ring-1 ring-[#043061]/20'
                    : 'bg-white/[0.04] text-gray-500 hover:bg-white/[0.08] hover:text-gray-300'
                }`}
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                <span>All</span>
                <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-black tabular-nums ${statusFilter === 'all' ? 'bg-white/20 text-white' : 'bg-white/[0.06] text-gray-500'}`}>
                  {(stats.total ?? 0).toLocaleString()}
                </span>
              </button>

              {/* Connector line */}
              <div className="w-4 h-px bg-white/10 shrink-0 hidden sm:block" />

              {pipelineSteps.map((step, i) => {
                const c = colorMap[step.color];
                const isActive = statusFilter === step.key;
                return (
                  <React.Fragment key={step.key}>
                    <button
                      onClick={() => handleStatusFilter(isActive ? 'all' : step.key)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        isActive
                          ? `${c.bg} ${c.text} ring-1 ${c.ring}`
                          : 'bg-white/[0.04] text-gray-500 hover:bg-white/[0.08] hover:text-gray-300'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? c.dot : 'bg-gray-600'}`} />
                      <span>{step.label}</span>
                      <span className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-black tabular-nums ${isActive ? `${c.bg} ${c.text}` : 'bg-white/[0.06] text-gray-500'}`}>
                        {step.count}
                      </span>
                    </button>
                    {i < pipelineSteps.length - 1 && (
                      <div className="w-3 h-px bg-white/10 shrink-0 hidden sm:block" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

        {/* ════════ COMPACT FILTER ROW ════════ */}
        <div className="px-1 sm:px-0 py-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Search */}
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                placeholder="Search orders, customers, products…"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 h-9 bg-white border-gray-200 rounded-xl text-xs placeholder:text-gray-400"
              />
            </div>

            {/* Filter dropdowns */}
            <div className="flex flex-wrap gap-2 items-center">
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
                <SelectTrigger className="h-9 px-3 text-xs border-gray-200 rounded-xl bg-white w-auto min-w-[120px]">
                  <SelectValue placeholder="Customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  <SelectItem value="wholesale">Wholesale</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>

              <Select value={paymentMethodFilter} onValueChange={handlePaymentMethodFilter}>
                <SelectTrigger className="h-9 px-3 text-xs border-gray-200 rounded-xl bg-white w-auto min-w-[140px]">
                  <SelectValue placeholder="Payment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payments</SelectItem>
                  <SelectItem value="ZELLE">Zelle</SelectItem>
                  <SelectItem value="BANK_WIRE">Bank Wire</SelectItem>
                  <SelectItem value="AUTHORIZE_NET">Authorize.Net</SelectItem>
                </SelectContent>
              </Select>

              <Popover open={salesRepPopoverOpen} onOpenChange={setSalesRepPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="h-9 px-3 text-xs border-gray-200 rounded-xl bg-white justify-between font-normal min-w-[120px]">
                    <span className="truncate">
                      {salesRepFilter === 'all'
                        ? 'All Reps'
                        : (() => {
                            const rep = salesReps.find((r: any) => r?.id === salesRepFilter);
                            const user = rep?.user;
                            return user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user?.email : salesRepFilter;
                          })()}
                    </span>
                    <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 z-50 w-[var(--radix-popover-trigger-width)]" side="bottom" align="start" sideOffset={4}>
                  <Command shouldFilter={true} className="w-full">
                    <CommandInput placeholder="Search sales rep..." />
                    <CommandList className="max-h-[300px] w-full overflow-y-auto overflow-x-hidden pointer-events-auto">
                      <CommandEmpty>No sales rep found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem value="all reps" onSelect={() => { handleSalesRepFilter('all'); setSalesRepPopoverOpen(false); }}>
                          <Check className={cn("mr-2 h-4 w-4", salesRepFilter === 'all' ? "opacity-100" : "opacity-0")} />
                          All Reps
                        </CommandItem>
                        {salesReps.map((rep: any) => {
                          const user = rep?.user;
                          const name = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '';
                          const label = name || user?.email || rep.id;
                          return (
                            <CommandItem key={rep.id} value={`${label} ${user?.email || ''}`} onSelect={() => { handleSalesRepFilter(rep.id); setSalesRepPopoverOpen(false); }}>
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
        </div>

        {/* ════════ ORDERS TABLE ════════ */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden mx-1 sm:mx-0">
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
