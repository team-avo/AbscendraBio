'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Download, DollarSign, ShoppingCart, Mail } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, getYear, getMonth } from 'date-fns';
import { api, formatCurrency, Order } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import * as XLSX from 'xlsx';
import { getPaymentMethodDisplay } from "@/lib/payment-utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import logger from '@/lib/logger';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { SendReportDialog } from '@/components/shared/send-report-dialog';

const LOGS_PAGE_SIZE = 10;

interface SalesLogsProps {
    salesChannelId?: string;
}

export function SalesLogs({ salesChannelId }: SalesLogsProps) {
    const isMobile = useIsMobile();
    const [activeTab, setActiveTab] = useState("daily");
    const [showEmailDialog, setShowEmailDialog] = useState(false);
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<{ totalRevenue: number; totalOrders: number; daily: any[] }>({
        totalRevenue: 0,
        totalOrders: 0,
        daily: []
    });

    const [month, setMonth] = useState<Date>(new Date());

    // Pagination state
    const [logsPage, setLogsPage] = useState(1);

    const logItems = useMemo(() => {
        const items = [...(data.daily || [])];
        return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [data.daily]);
    const totalLogsPages = useMemo(
        () => Math.max(1, Math.ceil(logItems.length / LOGS_PAGE_SIZE)),
        [logItems.length]
    );
    const paginatedLogs = useMemo(
        () => logItems.slice((logsPage - 1) * LOGS_PAGE_SIZE, logsPage * LOGS_PAGE_SIZE),
        [logItems, logsPage]
    );

    // Reset page when data or tab changes
    useEffect(() => { setLogsPage(1); }, [data, activeTab]);

    const fetchLogs = async () => {
        if (!date && activeTab === 'daily') return;

        setLoading(true);
        try {
            let from: Date | undefined;
            let to: Date | undefined;
            let range: any = 'custom';

            if (activeTab === 'daily') {
                from = date;
                to = date;
            } else if (activeTab === 'weekly') {
                if (date) {
                    from = startOfWeek(date, { weekStartsOn: 1 }); // Monday start
                    to = endOfWeek(date, { weekStartsOn: 1 });
                }
            } else if (activeTab === 'monthly') {
                if (month) {
                    from = startOfMonth(month);
                    to = endOfMonth(month);
                }
            }

            if (!from || !to) return;

            // Ensure we ask for detailed reports
            const res = await api.getSalesReports(
                range,
                from,
                to,
                true, // detailed
                salesChannelId,
                true // usePSTFilter
            );

            if (res.success && res.data) {
                setData(res.data);
            } else {
                toast.error("Failed to load sales logs");
                setData({ totalRevenue: 0, totalOrders: 0, daily: [] });
            }
        } catch (error) {
            logger.error("Sales logs error:", { error: error });
            toast.error("Error loading sales logs");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [activeTab, date, month, salesChannelId]);

    const handleExport = () => {
        try {
            const exportData = data.daily.map(item => ({
                'Date/Time': format(new Date(item.date), 'MMM d, yyyy HH:mm'),
                'Order #': item.orderNumber,
                'Customer': item.customerName,
                'Email': item.customerEmail,
                'Status': item.status,
                'Payment Method': item.paymentMethod,
                'Revenue': Number(item.revenue || 0).toFixed(2)
            }));

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(exportData);
            XLSX.utils.book_append_sheet(wb, ws, 'Sales Log');

            let filename = `sales-log-${activeTab}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
            XLSX.writeFile(wb, filename);
            toast.success("Export successful");
        } catch (e) {
            logger.error("Export failed:", { error: e });
            toast.error("Export failed");
        }
    };

    const handleSendEmailReport = async (email: string) => {
        let from: Date | undefined;
        let to: Date | undefined;
        let range: any = 'custom';

        if (activeTab === 'daily') {
            from = date;
            to = date;
        } else if (activeTab === 'weekly') {
            if (date) {
                from = startOfWeek(date, { weekStartsOn: 1 });
                to = endOfWeek(date, { weekStartsOn: 1 });
            }
        } else if (activeTab === 'monthly') {
            if (month) {
                from = startOfMonth(month);
                to = endOfMonth(month);
            }
        }

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
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <CardTitle>Sales Logs</CardTitle>
                            <CardDescription>Detailed transaction logs for reconciliation</CardDescription>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            {!isMobile && (
                                <Button variant="outline" size="sm" onClick={handleExport} disabled={data.daily.length === 0} className="flex-1 sm:flex-none">
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
                    title="Send Sales Log Report"
                    description={`Enter your email to receive the ${activeTab} sales log report as an Excel file.`}
                />
                <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                        <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
                            <div className="w-full lg:w-auto overflow-x-auto scrollbar-hide">
                                <TabsList className="flex items-center justify-start w-max h-auto p-1 bg-muted gap-1 min-h-[40px]">
                                    <TabsTrigger value="daily" className="whitespace-nowrap py-2 px-4 text-xs sm:text-sm">Daily Log</TabsTrigger>
                                    <TabsTrigger value="weekly" className="whitespace-nowrap py-2 px-4 text-xs sm:text-sm">Weekly</TabsTrigger>
                                    <TabsTrigger value="monthly" className="whitespace-nowrap py-2 px-4 text-xs sm:text-sm">Monthly</TabsTrigger>
                                </TabsList>
                            </div>

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
                                {activeTab === 'daily' && (
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {date ? format(date, "PPP") : <span>Pick a date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="end">
                                            <Calendar
                                                mode="single"
                                                selected={date}
                                                onSelect={setDate}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                )}

                                {activeTab === 'weekly' && (
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {date ? (
                                                    `${format(startOfWeek(date, { weekStartsOn: 1 }), "MMM d")} - ${format(endOfWeek(date, { weekStartsOn: 1 }), "MMM d, yyyy")}`
                                                ) : <span>Pick a week</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="end">
                                            <Calendar
                                                mode="single"
                                                selected={date}
                                                onSelect={setDate}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                )}

                                {activeTab === 'monthly' && (
                                    <div className="flex items-center gap-2">
                                        <Select
                                            value={month.getMonth().toString()}
                                            onValueChange={(val) => {
                                                const newDate = new Date(month);
                                                newDate.setMonth(parseInt(val));
                                                setMonth(newDate);
                                            }}
                                        >
                                            <SelectTrigger className="w-[140px]">
                                                <SelectValue placeholder="Month" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Array.from({ length: 12 }).map((_, i) => (
                                                    <SelectItem key={i} value={i.toString()}>
                                                        {format(new Date(2000, i, 1), 'MMMM')}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Select
                                            value={month.getFullYear().toString()}
                                            onValueChange={(val) => {
                                                const newDate = new Date(month);
                                                newDate.setFullYear(parseInt(val));
                                                setMonth(newDate);
                                            }}
                                        >
                                            <SelectTrigger className="w-[100px]">
                                                <SelectValue placeholder="Year" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Array.from({ length: 5 }).map((_, i) => {
                                                    const y = new Date().getFullYear() - i;
                                                    return <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-4">
                            <Card className="p-0 gap-0 shadow-sm border-border/50">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-3 sm:pb-0.5">
                                    <CardTitle className="text-[10px] sm:text-sm font-medium">Total Revenue</CardTitle>
                                    <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent className="p-2 pt-0.5 pb-2 sm:p-3 sm:pt-1 sm:pb-3">
                                    <div className="text-base sm:text-xl font-bold truncate leading-tight">{formatCurrency(data.totalRevenue)}</div>
                                </CardContent>
                            </Card>
                            <Card className="p-0 gap-0 shadow-sm border-border/50">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-3 sm:pb-0.5">
                                    <CardTitle className="text-[10px] sm:text-sm font-medium">Total Orders</CardTitle>
                                    <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent className="p-2 pt-0.5 pb-2 sm:p-3 sm:pt-1 sm:pb-3">
                                    <div className="text-base sm:text-xl font-bold truncate leading-tight">{data.totalOrders}</div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="rounded-md border overflow-x-auto">
                            <Table className="min-w-[700px] sm:min-w-full">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date/Time</TableHead>
                                        <TableHead>Order #</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Payment</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                            </TableRow>
                                        ))
                                    ) : data.daily.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-24 text-center">
                                                No orders found for this period.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paginatedLogs.map((item: any) => (
                                            <TableRow key={item.orderId}>
                                                <TableCell className="font-medium">
                                                    {format(new Date(item.date), 'MMM d, HH:mm')}
                                                </TableCell>
                                                <TableCell>{item.orderNumber}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span>{item.customerName}</span>
                                                        <span className="text-xs text-muted-foreground">{item.customerEmail}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="capitalize">{item.status?.toLowerCase()}</TableCell>
                                                <TableCell>{item.paymentMethod}</TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {formatCurrency(item.revenue)}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                            {totalLogsPages > 1 && (
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t">
                                    <div className="text-sm text-muted-foreground">
                                        Page {logsPage} of {totalLogsPages} ({logItems.length} orders)
                                    </div>
                                    <Pagination
                                        currentPage={logsPage}
                                        totalPages={totalLogsPages}
                                        onPageChange={setLogsPage}
                                    />
                                </div>
                            )}
                        </div>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
