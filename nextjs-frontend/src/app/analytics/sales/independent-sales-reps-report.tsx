'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Download, DollarSign, ShoppingCart, Target, Mail } from "lucide-react";
import { api, formatCurrency, SalesRepPerformance, SalesRepPerformanceResponse } from "@/lib/api";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getPaymentMethodDisplay } from "@/lib/payment-utils";
import logger from '@/lib/logger';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { SendReportDialog } from '@/components/shared/send-report-dialog';

interface IndependentSalesRepsReportProps {
    range: string;
    from: Date | null;
    to: Date | null;
    salesChannelId?: string;
    onOrderClick: (orderId: string) => void;
}

const REPS_PAGE_SIZE = 10;
const ORDERS_PAGE_SIZE = 10;

export function IndependentSalesRepsReport({ range, from, to, salesChannelId, onOrderClick }: IndependentSalesRepsReportProps) {
    const isMobile = useIsMobile();
    const [loading, setLoading] = useState(false);
    const [showEmailDialog, setShowEmailDialog] = useState(false);
    const [data, setData] = useState<SalesRepPerformanceResponse | null>(null);
    const [selectedRep, setSelectedRep] = useState<SalesRepPerformance | null>(null);

    // Pagination for reps table
    const [repsPage, setRepsPage] = useState(1);
    const repsItems = useMemo(() => data?.reps || [], [data?.reps]);
    const totalRepsPages = useMemo(
        () => Math.max(1, Math.ceil(repsItems.length / REPS_PAGE_SIZE)),
        [repsItems.length]
    );
    const paginatedReps = useMemo(
        () => repsItems.slice((repsPage - 1) * REPS_PAGE_SIZE, repsPage * REPS_PAGE_SIZE),
        [repsItems, repsPage]
    );

    // Pagination for selected rep's orders table
    const [ordersPage, setOrdersPage] = useState(1);
    const orderItems = useMemo(() => {
        const items = [...(selectedRep?.recentOrders || [])];
        return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [selectedRep?.recentOrders]);
    const totalOrdersPages = useMemo(
        () => Math.max(1, Math.ceil(orderItems.length / ORDERS_PAGE_SIZE)),
        [orderItems.length]
    );
    const paginatedOrders = useMemo(
        () => orderItems.slice((ordersPage - 1) * ORDERS_PAGE_SIZE, ordersPage * ORDERS_PAGE_SIZE),
        [orderItems, ordersPage]
    );

    // Reset pages when data changes
    useEffect(() => { setRepsPage(1); }, [data]);
    useEffect(() => { setOrdersPage(1); }, [selectedRep]);

    const fetchPerformance = async () => {
        setLoading(true);
        try {
            const res = await api.getSalesRepPerformance(
                range as any,
                from || undefined,
                to || undefined,
                true // independent
            );

            if (res.success && res.data) {
                setData(res.data);
                if (res.data.reps && res.data.reps.length > 0) {
                    setSelectedRep(res.data.reps[0]);
                } else {
                    setSelectedRep(null);
                }
            } else {
                toast.error(res.error || "Failed to load performance data");
            }
        } catch (error) {
            logger.error("Performance fetch error:", { error: error });
            toast.error("Error loading performance data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPerformance();
    }, [range, from, to]);

    const handleExport = () => {
        if (!data || !data.reps) return;

        try {
            const exportData = data.reps.map(rep => ({
                'Rep Name': `${rep.user.firstName} ${rep.user.lastName}`,
                'Email': rep.user.email,
                'Revenue': Number(rep.metrics.totalRevenue || 0).toFixed(2),
                'Orders': rep.metrics.totalOrders || 0,
                'Avg Order Value': Number(rep.metrics.averageOrderValue || 0).toFixed(2),
                'Customers': rep.metrics.assignedCustomers || 0,
                'Active Customers': rep.metrics.activeCustomers || 0
            }));

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(exportData);
            XLSX.utils.book_append_sheet(wb, ws, 'Independent Reps');

            const filename = `independent-reps-performance-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
            XLSX.writeFile(wb, filename);
            toast.success("Export successful");
        } catch (e) {
            logger.error("Export failed:", { error: e });
            toast.error("Export failed");
        }
    };

    const handleSendEmailReport = async (email: string) => {
        return api.sendSalesEmailReport({
            email,
            range,
            from: from?.toISOString(),
            to: to?.toISOString(),
            usePSTFilter: true,
        });
    };

    return (
        <div className="space-y-4">
            <div className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-4">
                <Card className="p-0 gap-0 shadow-sm border-border/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-3 sm:pb-0.5">
                        <CardTitle className="text-[10px] sm:text-sm font-medium">Rep Revenue</CardTitle>
                        <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-2 pt-0.5 pb-2 sm:p-3 sm:pt-1 sm:pb-3">
                        {loading ? <Skeleton className="h-7 sm:h-8 w-24" /> : <div className="text-base sm:text-xl font-bold truncate leading-tight">{formatCurrency(data?.totals.totalRevenue || 0)}</div>}
                    </CardContent>
                </Card>
                <Card className="p-0 gap-0 shadow-sm border-border/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-3 sm:pb-0.5">
                        <CardTitle className="text-[10px] sm:text-sm font-medium">Total Orders</CardTitle>
                        <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-2 pt-0.5 pb-2 sm:p-3 sm:pt-1 sm:pb-3">
                        {loading ? <Skeleton className="h-7 sm:h-8 w-16" /> : <div className="text-base sm:text-xl font-bold truncate leading-tight">{data?.totals.totalOrders || 0}</div>}
                    </CardContent>
                </Card>
                <Card className="p-0 gap-0 shadow-sm border-border/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-3 sm:pb-0.5">
                        <CardTitle className="text-[10px] sm:text-sm font-medium">Active Reps</CardTitle>
                        <Target className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-2 pt-0.5 pb-2 sm:p-3 sm:pt-1 sm:pb-3">
                        {loading ? <Skeleton className="h-7 sm:h-8 w-12" /> : <div className="text-base sm:text-xl font-bold truncate leading-tight">{data?.totals.repsActive || 0}</div>}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <CardTitle>Independent Sales Reps</CardTitle>
                            <CardDescription>Performance of sales reps not linked to any manager</CardDescription>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            {!isMobile && (
                                <Button variant="outline" size="sm" onClick={handleExport} disabled={!data || data.reps.length === 0} className="flex-1 sm:flex-none">
                                    <Download className="h-4 w-4 mr-2" />
                                    Export
                                </Button>
                            )}
                            <Button variant={isMobile ? "default" : "outline"} size="sm" onClick={() => setShowEmailDialog(true)} className="flex-1 sm:flex-none">
                                <Mail className="h-4 w-4 mr-2" />
                                {isMobile ? "Email Report" : "Email"}
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <SendReportDialog
                    open={showEmailDialog}
                    onOpenChange={setShowEmailDialog}
                    onSend={handleSendEmailReport}
                    title="Send Independent Reps Report"
                    description="Enter your email to receive the independent sales reps performance report as an Excel file."
                />
                <CardContent>
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                        <Table className="min-w-[700px] sm:min-w-full">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Sales Representative</TableHead>
                                    <TableHead className="text-right">Revenue</TableHead>
                                    <TableHead className="text-right">Orders</TableHead>
                                    <TableHead className="text-right">AOV</TableHead>
                                    <TableHead className="text-right">Customers</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : !data || data.reps.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            No performance data found for independent reps.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedReps.map((rep) => (
                                        <TableRow
                                            key={rep.salesRepId}
                                            className={cn(
                                                "group cursor-pointer hover:bg-muted/50 transition-colors border-l-4 border-transparent",
                                                selectedRep?.salesRepId === rep.salesRepId ? "bg-primary/10 border-l-primary" : ""
                                            )}
                                            onClick={() => setSelectedRep(rep)}
                                        >
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className={cn("font-medium", selectedRep?.salesRepId === rep.salesRepId ? "text-primary" : "")}>
                                                        {rep.user.firstName} {rep.user.lastName}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">{rep.user.email}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">{formatCurrency(rep.metrics.totalRevenue)}</TableCell>
                                            <TableCell className="text-right">{rep.metrics.totalOrders}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(rep.metrics.averageOrderValue)}</TableCell>
                                            <TableCell className="text-right">{rep.metrics.assignedCustomers}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                        {totalRepsPages > 1 && (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t">
                                <div className="text-sm text-muted-foreground">
                                    Page {repsPage} of {totalRepsPages} ({repsItems.length} reps)
                                </div>
                                <Pagination
                                    currentPage={repsPage}
                                    totalPages={totalRepsPages}
                                    onPageChange={setRepsPage}
                                />
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {selectedRep && (
                <Card>
                    <CardHeader>
                        <CardTitle>Sales Log: {selectedRep.user.firstName} {selectedRep.user.lastName}</CardTitle>
                        <CardDescription>Recent orders for the selected period</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-xl border border-gray-200 overflow-hidden">
                            <Table className="min-w-[700px] sm:min-w-full">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[50px]">S.No</TableHead>
                                        <TableHead>Order #</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Payment</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {!selectedRep.recentOrders || selectedRep.recentOrders.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                                No orders found for this rep in the selected period.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paginatedOrders.map((order, index) => (
                                            <TableRow key={order.id}>
                                                <TableCell className="font-medium">{(ordersPage - 1) * ORDERS_PAGE_SIZE + index + 1}</TableCell>
                                                <TableCell>
                                                    <Button variant="link" className="p-0 h-auto" onClick={() => onOrderClick(order.id)}>
                                                        {order.orderNumber}
                                                    </Button>
                                                </TableCell>
                                                <TableCell>{order.customerName}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="capitalize">
                                                        {order.status.toLowerCase()}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>{getPaymentMethodDisplay(order as any)}</TableCell>
                                                <TableCell>{format(new Date(order.createdAt), 'MMM d, yyyy')}</TableCell>
                                                <TableCell className="text-right font-medium">{formatCurrency(order.totalAmount)}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                                {selectedRep.recentOrders && selectedRep.recentOrders.length > 0 && (
                                    <TableFooter>
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-right font-bold">Total</TableCell>
                                            <TableCell className="text-right font-bold">
                                                {formatCurrency(selectedRep.metrics.totalRevenue)}
                                            </TableCell>
                                        </TableRow>
                                    </TableFooter>
                                )}
                            </Table>
                            {totalOrdersPages > 1 && (
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t">
                                    <div className="text-sm text-muted-foreground">
                                        Page {ordersPage} of {totalOrdersPages} ({orderItems.length} orders)
                                    </div>
                                    <Pagination
                                        currentPage={ordersPage}
                                        totalPages={totalOrdersPages}
                                        onPageChange={setOrdersPage}
                                    />
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
