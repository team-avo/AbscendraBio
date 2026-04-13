
'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { ProtectedRoute } from '@/contexts/auth-context';
import { OrdersTable } from '@/components/orders/orders-table';
import { CreateOrderDialog } from '@/components/orders/create-order-dialog';
import { EditOrderDialog } from '@/components/orders/edit-order-dialog';
import { OrderStatusDialog } from '@/components/orders/order-status-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { OrderDateFilter } from '@/components/orders/order-date-filter';
import { SendReportDialog } from '@/components/shared/send-report-dialog';
import {
  Plus,
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
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import logger from '@/lib/logger';
import { downloadOrdersExcel } from '@/lib/export-orders';

export default function PendingOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [dateRangeType, setDateRangeType] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [statusOrder, setStatusOrder] = useState<Order | null>(null);

  const ITEMS_PER_PAGE = 10;

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        search: searchTerm || undefined,
        status: statusFilter,
        customerId: customerFilter !== 'all' ? customerFilter : undefined,
        customerType: customerTypeFilter !== 'all' ? customerTypeFilter : undefined,
        dateFrom: dateRange.from?.toISOString().split('T')[0],
        dateTo: dateRange.to?.toISOString().split('T')[0],
        excludeFailedPayments: true,
      };

      const response = await api.getOrders(params);

      if (response.success && response.data) {
        setOrders(response.data.orders || []);
        setTotalOrders(response.data.pagination.total);
        setTotalPages(response.data.pagination.pages);
      }
    } catch (error) {
      logger.error('Failed to fetch orders:', { error });
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [currentPage, searchTerm, statusFilter, customerFilter, customerTypeFilter, dateRange]);

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

  const handleCustomerTypeFilter = (value: string) => {
    setCustomerTypeFilter(value);
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
      const response = await api.getOrder(order.id);

      if (response.success) {
        setEditingOrder((response.data as any) || null);
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

  const handleExportAll = async () => {
    let page = 1;
    const limit = 100;
    let pages = 1;
    const all: Order[] = [];
    try {
      do {
        const res: any = await api.getOrders({
          page,
          limit,
          search: searchTerm || undefined,
          status: 'PENDING',
          customerId: customerFilter !== 'all' ? customerFilter : undefined,
          customerType: customerTypeFilter !== 'all' ? customerTypeFilter : undefined,
          dateFrom: dateRange.from?.toISOString().split('T')[0],
          dateTo: dateRange.to?.toISOString().split('T')[0],
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

      const fileName = `pending-orders-all-${new Date().toISOString().split('T')[0]}.xlsx`;
      downloadOrdersExcel(all, fileName);
      toast.success(`Exported ${all.length} pending orders to ${fileName}`);
    } catch (e) {
      logger.error('Export all failed:', { error: e });
      toast.error('Failed to export pending orders');
      throw e;
    }
  };

  const handleSendEmailReport = async (email: string) => {
    return api.sendOrdersEmailReport({
      email,
      filters: {
        status: statusFilter,
        search: searchTerm || undefined,
        customerType: customerTypeFilter !== 'all' ? customerTypeFilter : undefined,
      }
    });
  };

  return (
    <ProtectedRoute requiredRoles={['ADMIN', 'MANAGER', 'STAFF', 'SALES_REP', 'SALES_MANAGER']}>
      <DashboardLayout>
        <div className="space-y-5 px-2 sm:px-0">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Pending Orders</h1>
              <p className="text-sm text-slate-500 mt-0.5">Orders awaiting confirmation and fulfillment</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-amber-50 text-amber-700 border-amber-200">
                <Clock className="h-3 w-3" />
                Pending
              </span>
              <Button onClick={() => setShowCreateDialog(true)} className="h-9 px-4 bg-[#1B2D4F] hover:bg-[#243d6b] text-white rounded-xl text-sm font-medium">
                <Plus className="mr-2 h-4 w-4" />
                Create Order
              </Button>
            </div>
          </div>

          {/* Filter bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search orders by number, customer, or email..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 h-10 bg-slate-50 border-slate-200 rounded-xl text-sm placeholder:text-slate-400"
              />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <OrderDateFilter
                range={dateRangeType}
                setRange={handleDateRangeTypeChange}
                from={dateRange.from}
                setFrom={handleFromDateChange}
                to={dateRange.to}
                setTo={handleToDateChange}
                className="w-full sm:w-auto"
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
            </div>
          </div>

          {/* Table card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-amber-50">
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Pending Orders</h2>
                <p className="text-xs text-slate-400">{totalOrders.toLocaleString()} orders</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <OrdersTable
                orders={orders}
                loading={loading}
                onEdit={handleEditOrder}
                onDelete={handleDeleteOrder}
                onUpdateStatus={handleUpdateStatus}
                onRefresh={fetchOrders}
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalOrders={totalOrders}
                onExportAll={handleExportAll}
                onEmailReport={() => setShowEmailDialog(true)}
              />
            </div>
          </div>

          <CreateOrderDialog
            open={showCreateDialog}
            onOpenChange={setShowCreateDialog}
            onSuccess={handleOrderCreated}
          />

          <EditOrderDialog
            order={editingOrder}
            open={!!editingOrder}
            onOpenChange={(open) => !open && setEditingOrder(null)}
            onSuccess={handleOrderUpdated}
          />

          <OrderStatusDialog
            order={statusOrder}
            open={!!statusOrder}
            onOpenChange={(open) => !open && setStatusOrder(null)}
            onSuccess={handleStatusUpdated}
          />

          <SendReportDialog
            open={showEmailDialog}
            onOpenChange={setShowEmailDialog}
            onSend={handleSendEmailReport}
            title="Send Pending Orders Report"
            description="Enter the email address where you want to receive the pending orders report."
          />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
} 