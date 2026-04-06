
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OrderDateFilter } from '@/components/orders/order-date-filter';
import { SendReportDialog } from '@/components/shared/send-report-dialog';
import {
    Plus,
    Search,
} from 'lucide-react';
import { api, Order } from '@/lib/api';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import logger from '@/lib/logger';
import { downloadOrdersExcel } from '@/lib/export-orders';

export default function LabelPrintedOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('LABEL_CREATED');
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
                dateFrom: dateRange.from?.toISOString(),
                dateTo: dateRange.to?.toISOString(),
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

    const handleCustomerTypeFilter = (value: string) => {
        setCustomerTypeFilter(value);
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
                    status: 'LABEL_CREATED',
                    customerId: customerFilter !== 'all' ? customerFilter : undefined,
                    customerType: customerTypeFilter !== 'all' ? customerTypeFilter : undefined,
                    dateFrom: dateRange.from?.toISOString(),
                    dateTo: dateRange.to?.toISOString(),
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

            const fileName = `label-printed-orders-all-${new Date().toISOString().split('T')[0]}.xlsx`;
            downloadOrdersExcel(all, fileName);
            toast.success(`Exported ${all.length} label printed orders to ${fileName}`);
        } catch (e) {
            logger.error('Export all failed:', { error: e });
            toast.error('Failed to export label printed orders');
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
                <div className="space-y-3 sm:space-y-6 px-2 sm:px-0">
                    {/* Header */}
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">Label Printed Orders</h1>
                            <p className="text-muted-foreground text-xs sm:text-sm lg:text-base">
                                Manage all label printed orders
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                            <Button onClick={() => setShowCreateDialog(true)} className="w-full sm:w-auto h-10 sm:h-9">
                                <Plus className="mr-2 h-4 w-4" />
                                Create Order
                            </Button>
                        </div>
                    </div>

                    {/* Filters */}
                    <Card className="overflow-hidden">
                        <CardHeader className="px-3 sm:px-6">
                            <CardTitle className="text-lg sm:text-xl">Filters</CardTitle>
                            <CardDescription>Search and filter label printed orders</CardDescription>
                        </CardHeader>
                        <CardContent className="px-3 sm:px-6">
                            <div className="flex flex-col space-y-4">
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <div className="flex-1">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Search orders by number, customer, or email..."
                                                value={searchTerm}
                                                onChange={(e) => handleSearch(e.target.value)}
                                                className="pl-10"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
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
                                        <SelectTrigger className="w-full sm:w-[200px] min-h-[40px]">
                                            <SelectValue placeholder="Filter by customer type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Customer</SelectItem>
                                            <SelectItem value="wholesale">Wholesale</SelectItem>
                                            <SelectItem value="enterprise">Enterprise</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Orders Table */}
                    <Card>
                        <CardHeader className="px-3 sm:px-6">
                            <CardTitle className="text-lg sm:text-xl">Label Printed Orders</CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 sm:px-6">
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
                        </CardContent>
                    </Card>

                    {/* Dialogs */}
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
                        title="Send Label Printed Orders Report"
                        description="Enter the email address where you want to receive the label printed orders report."
                    />
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
