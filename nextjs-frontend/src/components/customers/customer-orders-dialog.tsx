'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Pagination } from '@/components/ui/pagination';
import { Calendar as CalendarPrimitive } from '@/components/ui/calendar';
import { Package, Calendar, DollarSign, Eye, Download, CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EditOrderDialog } from '@/components/orders/edit-order-dialog';
import { Customer, Order, api } from '@/lib/api';
import logger from '@/lib/logger';
import { toast } from 'sonner';

interface CustomerOrdersDialogProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OrderStatusBadge = ({ status }: { status: string }) => {
  const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    PENDING: { label: 'Pending', variant: 'secondary' },
    CONFIRMED: { label: 'Confirmed', variant: 'default' },
    PROCESSING: { label: 'Processing', variant: 'default' },
    LABEL_CREATED: { label: 'Label Created', variant: 'default' },
    SHIPPED: { label: 'Shipped', variant: 'default' },
    DELIVERED: { label: 'Delivered', variant: 'default' },
    CANCELLED: { label: 'Cancelled', variant: 'destructive' },
    RETURNED: { label: 'Returned', variant: 'outline' },
    REFUNDED: { label: 'Refunded', variant: 'outline' },
    ON_HOLD: { label: 'On Hold', variant: 'secondary' },
  };

  const config = statusMap[status] || { label: status, variant: 'outline' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

const PaymentStatusBadge = ({ status }: { status: string }) => {
  const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    PENDING: { label: 'Pending', variant: 'secondary' },
    PAID: { label: 'Paid', variant: 'default' },
    FAILED: { label: 'Failed', variant: 'destructive' },
    REFUNDED: { label: 'Refunded', variant: 'outline' },
    PARTIAL: { label: 'Partial', variant: 'outline' },
  };

  const config = statusMap[status] || { label: status, variant: 'outline' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

// PST date formatter for display and CSV export
function formatToPST(dateVal?: string | Date | null) {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    };
    const formatter = new Intl.DateTimeFormat('en-CA', options);
    return formatter.format(d).replace(', ', ' ') + ' PST';
  } catch {
    return '';
  }
}

// Helper to format a Date to YYYY-MM-DD for API
function toISODateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function CustomerOrdersDialog({ customer, open, onOpenChange }: CustomerOrdersDialogProps) {
  // Pagination state
  const [orders, setOrders] = useState<Order[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{
    total: number;
    pages: number;
    page: number;
    limit: number;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    total: number;
    revenue: number;
    delivered: number;
    pending: number;
    processing: number;
    shipped: number;
    cancelled: number;
  } | null>(null);

  // Separate state for the "Recent Orders Details" section (top 5 overall)
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);

  // Date filter state
  const [dateRangeType, setDateRangeType] = useState('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  // Edit order dialog state
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  // Compute date strings from the filter state
  const getDateParams = useCallback(() => {
    let dateFromStr: string | undefined;
    let dateToStr: string | undefined;
    if (dateFrom) {
      dateFromStr = toISODateStr(dateFrom);
      const toDate = dateTo || dateFrom;
      dateToStr = toISODateStr(toDate);
    }
    return { dateFromStr, dateToStr };
  }, [dateFrom, dateTo]);

  const fetchOrders = useCallback(async (targetPage: number = 1) => {
    if (!customer) return;
    setLoading(true);
    setError(null);
    setPage(targetPage);

    const { dateFromStr, dateToStr } = getDateParams();

    try {
      const response = await api.getOrders({
        customerId: customer.id,
        page: targetPage,
        limit: 15,
        dateFrom: dateFromStr,
        dateTo: dateToStr,
        usePSTFilter: true,
      });

      if (response.success && response.data) {
        setOrders(response.data.orders || []);
        // Always set pagination from the response
        if (response.data.pagination) {
          setPagination({
            total: response.data.pagination.total,
            pages: response.data.pagination.pages,
            page: response.data.pagination.page,
            limit: response.data.pagination.limit,
          });
        }

        // Always update stats from the response (they correspond to the entire filtered set)
        const s = (response.data as any).stats;
        setStats({
          total: response.data.pagination?.total || 0,
          revenue: s?.revenue || 0,
          delivered: s?.delivered || 0,
          pending: s?.pending || 0,
          processing: s?.processing || 0,
          shipped: s?.shipped || 0,
          cancelled: s?.cancelled || 0,
        });

        // For page 1, also update the "Recent Orders Details" overall top 5
        if (targetPage === 1) {
          setRecentOrders((response.data.orders || []).slice(0, 5));
        }
      } else {
        setError(response.error || 'Failed to fetch orders');
      }
    } catch (err) {
      logger.error('Error fetching customer orders:', { error: err });
      setError('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, [customer, getDateParams]);

  useEffect(() => {
    if (customer && open) {
      fetchOrders(1);
    }
  }, [customer, open, fetchOrders]);

  // Reset filter when dialog opens for a new customer
  useEffect(() => {
    if (open) {
      setDateRangeType('all');
      setDateFrom(undefined);
      setDateTo(undefined);
    }
  }, [open, customer?.id]);

  const handleRangeChange = (value: string) => {
    setDateRangeType(value);
    setPage(1); // Reset page on filter change
    const now = new Date();

    if (value === 'day') {
      const d = dateFrom || new Date();
      setDateFrom(d);
      setDateTo(d);
    } else if (value === 'last_7_days') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      setDateFrom(d);
      setDateTo(now);
    } else if (value === 'last_14_days') {
      const d = new Date();
      d.setDate(d.getDate() - 13);
      setDateFrom(d);
      setDateTo(now);
    } else if (value === 'last_30_days') {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      setDateFrom(d);
      setDateTo(now);
    } else if (value === 'last_60_days') {
      const d = new Date();
      d.setDate(d.getDate() - 59);
      setDateFrom(d);
      setDateTo(now);
    } else if (value === 'last_90_days') {
      const d = new Date();
      d.setDate(d.getDate() - 89);
      setDateFrom(d);
      setDateTo(now);
    } else if (value === 'last_year') {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 1);
      setDateFrom(d);
      setDateTo(now);
    } else if (value === 'all') {
      setDateFrom(undefined);
      setDateTo(undefined);
    }
  };

  const handleDaySelect = (d: Date | undefined) => {
    if (d) {
      setDateFrom(d);
      setDateTo(d);
    } else {
      setDateFrom(undefined);
      setDateTo(undefined);
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const formatDate = (dateString: string) => {
    return formatToPST(dateString);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const handleViewOrder = async (orderId: string) => {
    try {
      const response = await api.getOrder(orderId);
      if (response.success && response.data) {
        setEditingOrder(response.data);
      } else {
        toast.error('Failed to load order details');
      }
    } catch (err) {
      logger.error('Failed to fetch order details:', { error: err });
      toast.error('Failed to load order details');
    }
  };

  // CSV Export
  const handleExportCSV = async () => {
    if (!customer) return;
    setExporting(true);
    try {
      const { dateFromStr, dateToStr } = getDateParams();

      // Fetch all pages of orders for export
      let page = 1;
      const limit = 500;
      let pages = 1;
      const allOrders: Order[] = [];

      do {
        const res: any = await api.getOrders({
          customerId: customer.id,
          page,
          limit,
          dateFrom: dateFromStr,
          dateTo: dateToStr,
          usePSTFilter: true,
        });

        if (res?.success && res?.data) {
          allOrders.push(...(res.data.orders || []));
          pages = res.data.pagination?.pages || 1;
        } else {
          break;
        }
        page += 1;
      } while (page <= pages);

      if (allOrders.length === 0) {
        toast.error('No orders to export');
        return;
      }

      // Build CSV data
      const headers = [
        'S.No',
        'Order ID',
        'Created Date (PST)',
        'Status',
        'Payment Status',
        'Payment Method',
        'Subtotal',
        'Discount',
        'Shipping',
        'Tax',
        'Total Amount',
        'Items Count',
        'Customer Name',
        'Customer Email',
        'Shipping City',
        'Shipping State',
        'Shipping Country',
        'Notes',
      ];

      const rows = allOrders.map((order, idx) => {
        const paymentStatus = order.payments && order.payments.length > 0 ? order.payments[0].status : 'PENDING';
        const paymentMethod = (order as any).selectedPaymentType ||
          (order.payments && order.payments.length > 0 ? (order.payments[0] as any).paymentMethod || '' : '');
        return [
          idx + 1,
          order.orderNumber || order.id,
          formatToPST(order.createdAt),
          order.status,
          paymentStatus,
          paymentMethod,
          `$${Number(order.subtotal || 0).toFixed(2)}`,
          `$${Number(order.discountAmount || 0).toFixed(2)}`,
          `$${Number(order.shippingAmount || 0).toFixed(2)}`,
          `$${Number(order.taxAmount || 0).toFixed(2)}`,
          `$${Number(order.totalAmount || 0).toFixed(2)}`,
          order.items?.length || order._count?.items || 0,
          order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : `${customer.firstName} ${customer.lastName}`,
          order.customer?.email || customer.email,
          order.shippingAddress?.city || '',
          order.shippingAddress?.state || '',
          order.shippingAddress?.country || '',
          order.notes && Array.isArray(order.notes) && order.notes.length > 0 ? order.notes[0].note : '',
        ];
      });

      // Create CSV string
      const escapeCSV = (val: any) => {
        const str = String(val ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csvContent = [
        headers.map(escapeCSV).join(','),
        ...rows.map(row => row.map(escapeCSV).join(',')),
      ].join('\n');

      // Trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filterSuffix = dateRangeType === 'all' ? 'all-time' : dateRangeType;
      link.href = url;
      link.download = `${customer.firstName}-${customer.lastName}-orders-${filterSuffix}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${allOrders.length} orders to CSV`);
    } catch (err) {
      logger.error('Export CSV failed:', { error: err });
      toast.error('Failed to export orders');
    } finally {
      setExporting(false);
    }
  };

  if (!customer) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="!w-[94vw] !max-w-[94vw] sm:!w-[96vw] sm:!max-w-[96vw] !h-[92vh] sm:!h-[96vh] !max-h-[96vh] overflow-hidden bg-background text-foreground flex flex-col p-3 sm:p-4 md:p-6">
          {/* Header row: avatar+title on left, filter+export on right */}
          <div className="flex-shrink-0 flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              {/* Left: avatar + title */}
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <Avatar className="h-8 w-8 sm:h-10 sm:w-10 shrink-0">
                  <AvatarImage src={`/avatars/${customer.id}.jpg`} />
                  <AvatarFallback className="text-xs sm:text-sm">
                    {getInitials(customer.firstName, customer.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <DialogTitle className="text-sm sm:text-lg font-semibold truncate leading-none">
                    {customer.firstName} {customer.lastName}&apos;s Orders
                  </DialogTitle>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">
                    {stats?.total || orders.length} order{(stats?.total || orders.length) !== 1 ? 's' : ''} found
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Content area */}
          {loading ? (
            <div className="flex items-center justify-center py-8 flex-1">
              <LoadingSpinner size={32} />
              <span className="ml-2 text-sm">Loading orders...</span>
            </div>
          ) : (
            <ScrollArea className="flex-1 min-h-0 -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6">
              <div className="space-y-3">
                {/* Orders Summary Cards — 2 per row on mobile, 4 on tablet, 7 on desktop */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 sm:gap-2">
                  <div className="text-center p-1.5 sm:p-2 md:p-3 border rounded-lg overflow-hidden">
                    <div className="text-sm sm:text-lg lg:text-2xl font-bold text-primary truncate">
                      {stats?.total || orders.length}
                    </div>
                    <div className="text-[8px] sm:text-[10px] text-muted-foreground leading-tight">Total Orders</div>
                  </div>
                  <div className="text-center p-1.5 sm:p-2 md:p-3 border rounded-lg overflow-hidden">
                    <div className="text-[10px] sm:text-base lg:text-xl font-bold text-green-600 truncate" title={formatCurrency(stats?.revenue || 0)}>
                      {formatCurrency(stats?.revenue || orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0))}
                    </div>
                    <div className="text-[8px] sm:text-[10px] text-muted-foreground leading-tight">Total Spent</div>
                  </div>
                  <div className="text-center p-1.5 sm:p-2 md:p-3 border rounded-lg overflow-hidden">
                    <div className="text-sm sm:text-lg lg:text-2xl font-bold text-yellow-600 truncate">
                      {stats?.pending ?? 0}
                    </div>
                    <div className="text-[8px] sm:text-[10px] text-muted-foreground leading-tight">Pending</div>
                  </div>
                  <div className="text-center p-1.5 sm:p-2 md:p-3 border rounded-lg overflow-hidden">
                    <div className="text-sm sm:text-lg lg:text-2xl font-bold text-blue-600 truncate">
                      {stats?.processing ?? 0}
                    </div>
                    <div className="text-[8px] sm:text-[10px] text-muted-foreground leading-tight">Processing</div>
                  </div>
                  <div className="text-center p-1.5 sm:p-2 md:p-3 border rounded-lg overflow-hidden">
                    <div className="text-sm sm:text-lg lg:text-2xl font-bold text-purple-600 truncate">
                      {stats?.shipped ?? 0}
                    </div>
                    <div className="text-[8px] sm:text-[10px] text-muted-foreground leading-tight">Shipped</div>
                  </div>
                  <div className="text-center p-1.5 sm:p-2 md:p-3 border rounded-lg overflow-hidden">
                    <div className="text-sm sm:text-lg lg:text-2xl font-bold text-emerald-600 truncate">
                      {stats?.delivered ?? 0}
                    </div>
                    <div className="text-[8px] sm:text-[10px] text-muted-foreground leading-tight">Delivered</div>
                  </div>
                  <div className="text-center p-1.5 sm:p-2 md:p-3 border rounded-lg overflow-hidden">
                    <div className="text-sm sm:text-lg lg:text-2xl font-bold text-red-600 truncate">
                      {stats?.cancelled ?? 0}
                    </div>
                    <div className="text-[8px] sm:text-[10px] text-muted-foreground leading-tight">Cancelled</div>
                  </div>
                </div>

                {/* Filters and Export - Moved below metrics cards */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2 px-1">
                  {/* Custom date pickers (inline) */}
                  {(dateRangeType === 'day' || dateRangeType === 'custom') && (
                    <div className="flex items-center gap-2">
                      {dateRangeType === 'day' ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-[150px] h-10 justify-start text-left font-normal text-sm">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {dateFrom ? dateFrom.toLocaleDateString() : 'Select date'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="end">
                            <CalendarPrimitive mode="single" selected={dateFrom} onSelect={handleDaySelect} initialFocus />
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-[130px] h-10 justify-start text-sm">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateFrom ? dateFrom.toLocaleDateString() : 'From'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                              <CalendarPrimitive mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
                            </PopoverContent>
                          </Popover>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-[130px] h-10 justify-start text-sm">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateTo ? dateTo.toLocaleDateString() : 'To'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                              <CalendarPrimitive mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
                            </PopoverContent>
                          </Popover>
                        </>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Select value={dateRangeType} onValueChange={handleRangeChange}>
                      <SelectTrigger className="w-[140px] sm:w-[160px] h-10 text-sm font-medium">
                        <SelectValue placeholder="Date Range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="day">1 Day</SelectItem>
                        <SelectItem value="last_7_days">Last 7 days</SelectItem>
                        <SelectItem value="last_14_days">Last 14 days</SelectItem>
                        <SelectItem value="last_30_days">Last 30 days</SelectItem>
                        <SelectItem value="last_60_days">Last 60 days</SelectItem>
                        <SelectItem value="last_90_days">Last 90 days</SelectItem>
                        <SelectItem value="last_year">Last year</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="default"
                      onClick={handleExportCSV}
                      disabled={exporting || loading || (stats?.total || 0) === 0}
                      className="h-10 text-sm px-4 font-medium"
                    >
                      {exporting ? (
                        <>
                          <LoadingSpinner size={16} className="mr-2" />
                          <span>Exporting...</span>
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          <span>Export CSV</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {orders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border rounded-lg bg-muted/10">
                    <Package className="h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium text-foreground">No orders found</p>
                    <p className="text-sm max-w-[300px] text-center">
                      {dateRangeType === 'all'
                        ? "This customer hasn't placed any orders yet."
                        : `No orders found for the selected range (${dateRangeType.replace(/_/g, ' ')}).`}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Mobile card list (< sm) */}
                    <div className="sm:hidden space-y-2">
                      {orders.map((order, index) => (
                        <div key={order.id} className="border rounded-lg p-2.5">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs text-muted-foreground">#{(page - 1) * 15 + index + 1}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewOrder(order.id)}
                              className="h-6 px-2 text-[10px]"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground truncate mb-1">
                            {order.orderNumber || order.id}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                            <OrderStatusBadge status={order.status} />
                            <PaymentStatusBadge status={order.payments?.[0]?.status || 'PENDING'} />
                            <span className="font-semibold text-xs">{formatCurrency(order.totalAmount || 0)}</span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>{formatDate(order.createdAt)}</span>
                            <span>{order._count?.items || order.items?.length || 0} items</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop/tablet table (>= sm) */}
                    <div className="hidden sm:block border rounded-lg">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr className="border-b">
                              <th className="text-left font-medium text-muted-foreground px-2 md:px-3 py-2 w-[40px]">S.No</th>
                              <th className="text-left font-medium text-muted-foreground px-2 md:px-3 py-2 min-w-[120px]">Order ID</th>
                              <th className="text-left font-medium text-muted-foreground px-2 md:px-3 py-2 min-w-[170px]">Date (PST)</th>
                              <th className="text-left font-medium text-muted-foreground px-2 md:px-3 py-2">Status</th>
                              <th className="text-left font-medium text-muted-foreground px-2 md:px-3 py-2">Payment</th>
                              <th className="text-left font-medium text-muted-foreground px-2 md:px-3 py-2">Amount</th>
                              <th className="text-left font-medium text-muted-foreground px-2 md:px-3 py-2">Items</th>
                              <th className="text-right font-medium text-muted-foreground px-2 md:px-3 py-2">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orders.map((order, index) => (
                              <tr key={order.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                                <td className="px-2 md:px-3 py-2 text-muted-foreground text-xs">
                                  {(page - 1) * 15 + index + 1}
                                </td>
                                <td className="px-2 md:px-3 py-2 font-mono text-xs break-all">
                                  {order.orderNumber || order.id}
                                </td>
                                <td className="px-2 md:px-3 py-2 text-xs whitespace-nowrap">
                                  {formatDate(order.createdAt)}
                                </td>
                                <td className="px-2 md:px-3 py-2">
                                  <OrderStatusBadge status={order.status} />
                                </td>
                                <td className="px-2 md:px-3 py-2">
                                  <PaymentStatusBadge status={order.payments?.[0]?.status || 'PENDING'} />
                                </td>
                                <td className="px-2 md:px-3 py-2 font-medium text-xs whitespace-nowrap">
                                  {formatCurrency(order.totalAmount || 0)}
                                </td>
                                <td className="px-2 md:px-3 py-2 text-xs">
                                  {order._count?.items || order.items?.length || 0}
                                </td>
                                <td className="px-2 md:px-3 py-2 text-right">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleViewOrder(order.id)}
                                    className="h-7 px-2 text-xs"
                                  >
                                    <Eye className="h-3.5 w-3.5 mr-1" />
                                    View
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Pagination Controls - Outside so they show on all devices */}
                    {pagination && pagination.pages > 1 && (
                      <div className="py-4 border rounded-lg bg-muted/5 shadow-sm">
                        <Pagination
                          currentPage={page}
                          totalPages={pagination.pages}
                          onPageChange={fetchOrders}
                        />
                        <div className="mt-2 text-center text-[10px] text-muted-foreground">
                          Showing {orders.length} of {pagination.total} orders
                        </div>
                      </div>
                    )}

                    {/* Recent Orders Details (Fixed Top 5) */}
                    <div className="border rounded-lg">
                      <div className="px-3 sm:px-4 py-2 sm:py-3 border-b bg-muted/30">
                        <h3 className="text-sm sm:text-base font-semibold flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Recent Orders Details
                        </h3>
                      </div>
                      <div className="divide-y">
                        {recentOrders.map((order) => (
                          <div key={order.id} className="p-2.5 sm:p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 mb-1.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-xs sm:text-sm font-medium">
                                  Order #{order.orderNumber || order.id.slice(-8)}
                                </span>
                                <OrderStatusBadge status={order.status} />
                                <PaymentStatusBadge status={order.payments?.[0]?.status || 'PENDING'} />
                              </div>
                              <div className="text-[10px] sm:text-xs text-muted-foreground">
                                {formatDate(order.createdAt)}
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-[10px] sm:text-xs">
                              <div>
                                <span className="text-muted-foreground">Amount: </span>
                                <span className="font-medium">{formatCurrency(order.totalAmount || 0)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Items: </span>
                                <span>{order._count?.items || order.items?.length || 0} item{(order._count?.items || order.items?.length || 0) !== 1 ? 's' : ''}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Shipping: </span>
                                <span>{order.shippingAddress?.city || 'N/A'}</span>
                              </div>
                            </div>
                            {order.notes && Array.isArray(order.notes) && order.notes.length > 0 && (
                              <div className="mt-1 text-[10px] sm:text-xs text-muted-foreground">
                                <span className="font-medium">Notes:</span> {order.notes[0]?.note || 'N/A'}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Order Dialog */}
      <EditOrderDialog
        order={editingOrder}
        open={!!editingOrder}
        onOpenChange={(isOpen) => { if (!isOpen) setEditingOrder(null); }}
        onSuccess={() => {
          setEditingOrder(null);
          fetchOrders();
        }}
      />
    </>
  );
}
