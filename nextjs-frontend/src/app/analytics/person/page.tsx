'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { ProtectedRoute } from '@/contexts/auth-context';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import { OrderDateFilter } from '@/components/orders/order-date-filter';
import { EditOrderDialog } from '@/components/orders/edit-order-dialog';
import { api, formatCurrency, SalesPersonReportResponse, Order } from '@/lib/api';
import logger from '@/lib/logger';
import { toast } from 'sonner';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts';
import {
    DollarSign,
    ShoppingCart,
    Users,
    TrendingUp,
    Download,
    ArrowLeft,
    UserCircle,
    UserPlus,
    Repeat,
    Mail
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { SendReportDialog } from '@/components/shared/send-report-dialog';

function SalesPersonAnalyticsContent() {
    const searchParams = useSearchParams();
    const managerId = searchParams.get('managerId');
    const salesRepId = searchParams.get('salesRepId');

    const [range, setRange] = useState<string>('last_90_days');
    const [from, setFrom] = useState<Date | undefined>(() => {
        const d = new Date();
        d.setDate(d.getDate() - 89);
        return d;
    });
    const [to, setTo] = useState<Date | undefined>(new Date());
    const [salesChannelId, setSalesChannelId] = useState<string>('');

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<SalesPersonReportResponse | null>(null);
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const isMobile = useIsMobile();
    const [showEmailDialog, setShowEmailDialog] = useState(false);

    // Sales Log pagination
    const SALES_LOG_PAGE_SIZE = 10;
    const [salesLogPage, setSalesLogPage] = useState(1);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.getSalesPersonReport({
                managerId: managerId || undefined,
                salesRepId: salesRepId || undefined,
                range,
                from: from || undefined,
                to: to || undefined,
                salesChannelId: salesChannelId || undefined
            });

            if (res.success && res.data) {
                setData(res.data);
            } else {
                toast.error(res.error || 'Failed to fetch analytics data');
            }
        } catch (error) {
            logger.error('Error fetching analytics:', { error });
            toast.error('An error occurred while fetching analytics');
        } finally {
            setLoading(false);
        }
    };

    const handleEditOrder = async (orderId: string) => {
        try {
            const response = await api.getOrder(orderId);
            if (response.success && response.data) {
                setEditingOrder(response.data);
            }
        } catch (error) {
            logger.error('Failed to fetch order details:', { error });
            toast.error('Failed to load order details');
        }
    };

    useEffect(() => {
        fetchData();
    }, [managerId, salesRepId, range, from, to, salesChannelId]);

    const handleExport = () => {
        if (!data) return;

        const wb = XLSX.utils.book_new();

        // --- SHEET 1: PERFORMANCE OVERVIEW ---
        const overviewData = [
            ['SALES PERFORMANCE REPORT', ''],
            ['Generated on:', new Date().toLocaleString()],
            ['', ''],
            ['REPORT PARAMETERS', ''],
            ['Sales Person:', data.personName],
            ['Manager ID:', managerId || 'N/A'],
            ['Sales Rep ID:', salesRepId || 'N/A'],
            ['Date Range:', range === 'custom' && from && to
                ? `${from.toLocaleDateString()} - ${to.toLocaleDateString()}`
                : range.replace(/_/g, ' ').toUpperCase()],
            ['', ''],
            ['KEY PERFORMANCE INDICATORS', 'VALUE'],
            ['Total Revenue:', formatCurrency(data.totalRevenue)],
            ['Total Orders:', data.totalOrders],
            ['Average Order Value:', formatCurrency(data.totalOrders > 0 ? data.totalRevenue / data.totalOrders : 0)],
            ['First-time Customers:', data.firstTimeOrdersCount],
            ['Repeat Customers:', data.repeatOrdersCount],
            ['Customer Retention Rate:', data.totalOrders > 0 ? `${((data.repeatOrdersCount / data.totalOrders) * 100).toFixed(1)}%` : '0%'],
        ];

        const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);

        // Basic column widths
        wsOverview['!cols'] = [{ wch: 25 }, { wch: 35 }];

        XLSX.utils.book_append_sheet(wb, wsOverview, 'Summary Overview');

        // --- SHEET 2: DAILY TRENDS ---
        const dailyData = data.dailyBreakdown.map(d => ({
            'Date': new Date(d.date).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            }),
            'Revenue ($)': d.revenue,
            'Orders': d.orders
        }));

        const wsDaily = XLSX.utils.json_to_sheet(dailyData);
        wsDaily['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Trends');

        // --- SHEET 3: DETAILED SALES LOG ---
        const detailedData = data.detailedOrders.map(o => ({
            'Order Number': o.orderNumber,
            'Order ID': o.orderId,
            'Date': new Date(o.date).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            }),
            'Time': new Date(o.date).toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit'
            }),
            'Customer Name': o.customerName,
            'Customer Email': o.customerEmail,
            'Revenue ($)': o.revenue,
            'Status': o.status,
            'Purchase Type': o.type,
            'Sales Rep': o.salesRepName || 'N/A'
        }));

        const wsDetailed = XLSX.utils.json_to_sheet(detailedData);

        // Add column widths for readability
        wsDetailed['!cols'] = [
            { wch: 15 }, // Order Number
            { wch: 25 }, // Order ID
            { wch: 12 }, // Date
            { wch: 10 }, // Time
            { wch: 25 }, // Customer Name
            { wch: 30 }, // Customer Email
            { wch: 12 }, // Revenue
            { wch: 15 }, // Status
            { wch: 15 }, // Purchase Type
            { wch: 20 }  // Sales Rep
        ];

        XLSX.utils.book_append_sheet(wb, wsDetailed, 'Detailed Sales Log');

        // Finalize and Download
        const fileName = `Detailed_Performance_${data.personName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);

        toast.success(`Professional report exported: ${data.totalOrders} orders across ${data.dailyBreakdown.length} days`);
    };

    const handleSendEmailReport = async (email: string) => {
        return api.sendSalesEmailReport({
            email,
            managerId: managerId || undefined,
            salesRepId: salesRepId || undefined,
            range,
            from: from?.toISOString(),
            to: to?.toISOString(),
            salesChannelId: salesChannelId || undefined,
            usePSTFilter: true,
        });
    };

    const pieData = useMemo(() => {
        if (!data) return [];
        return [
            { name: 'First-time', value: data.firstTimeOrdersCount, color: '#10b981' }, // emerald-500
            { name: 'Repeat', value: data.repeatOrdersCount, color: '#3b82f6' } // blue-500
        ].filter(item => item.value > 0);
    }, [data]);

    // Paginate detailed orders
    const totalSalesLogPages = useMemo(() => {
        if (!data) return 1;
        return Math.max(1, Math.ceil(data.detailedOrders.length / SALES_LOG_PAGE_SIZE));
    }, [data]);

    const paginatedDetailedOrders = useMemo(() => {
        if (!data) return [];
        return data.detailedOrders.slice(
            (salesLogPage - 1) * SALES_LOG_PAGE_SIZE,
            salesLogPage * SALES_LOG_PAGE_SIZE
        );
    }, [data, salesLogPage]);

    // Reset page when data changes
    useEffect(() => {
        setSalesLogPage(1);
    }, [data]);

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <LoadingSpinner size={40} />
            </div>
        );
    }

    if (!data) return null;

    const firstTimeRate = data.totalOrders > 0
        ? Math.round((data.firstTimeOrdersCount / data.totalOrders) * 100)
        : 0;
    const repeatRate = data.totalOrders > 0
        ? Math.round((data.repeatOrdersCount / data.totalOrders) * 100)
        : 0;

    return (
        <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => window.history.back()} className="rounded-full">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <UserCircle className="h-6 w-6 text-primary" />
                            {data.personName} Analytics
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {managerId ? 'Sales Manager' : 'Sales Representative'} • Detailed Performance Report
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <OrderDateFilter
                        range={range}
                        setRange={setRange}
                        from={from}
                        setFrom={setFrom}
                        to={to}
                        setTo={setTo}
                        showSalesChannel={true}
                        salesChannelId={salesChannelId}
                        setSalesChannelId={setSalesChannelId}
                    />
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        {!isMobile && (
                            <Button variant="outline" onClick={handleExport} disabled={loading} className="flex-1 sm:flex-none shadow-sm h-9 sm:h-10 text-xs sm:text-sm">
                                <Download className="mr-2 h-4 w-4" />
                                Export
                            </Button>
                        )}
                        <Button variant={isMobile ? "default" : "outline"} onClick={() => setShowEmailDialog(true)} className="flex-1 sm:sm:flex-none h-9 sm:h-10 text-xs sm:text-sm">
                            <Mail className="h-4 w-4 mr-2" />
                            {isMobile ? "Email Report" : "Email"}
                        </Button>
                    </div>
                </div>
            </div>

            <SendReportDialog
                open={showEmailDialog}
                onOpenChange={setShowEmailDialog}
                onSend={handleSendEmailReport}
                title="Send Performance Report"
                description={`Enter your email to receive the performance report for ${data.personName} as an Excel file.`}
            />

            <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
                <Card className="py-0 sm:py-0 gap-0 border-none shadow-sm bg-gradient-to-br from-primary/5 to-primary/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 py-1 pb-0 sm:p-4 sm:py-2 sm:pb-0">
                        <CardTitle className="text-[10px] sm:text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                    </CardHeader>
                    <CardContent className="p-2 pt-0 pb-1 sm:p-4 sm:pt-0 sm:pb-2">
                        <div className="text-base sm:text-2xl font-bold truncate leading-tight">{formatCurrency(data.totalRevenue)}</div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                            Gross sales in range
                        </p>
                    </CardContent>
                </Card>
                <Card className="py-0 sm:py-0 gap-0 border-none shadow-sm bg-slate-50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 py-1 pb-0 sm:p-4 sm:py-2 sm:pb-0">
                        <CardTitle className="text-[10px] sm:text-sm font-medium">Total Orders</CardTitle>
                        <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-2 pt-0 pb-1 sm:p-4 sm:pt-0 sm:pb-2">
                        <div className="text-base sm:text-2xl font-bold truncate leading-tight">{data.totalOrders}</div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                            Successful purchases
                        </p>
                    </CardContent>
                </Card>
                <Card className="py-0 sm:py-0 gap-0 border-none shadow-sm bg-emerald-50/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 py-1 pb-0 sm:p-4 sm:py-2 sm:pb-0">
                        <CardTitle className="text-[10px] sm:text-sm font-medium">First-time</CardTitle>
                        <UserPlus className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent className="p-2 pt-0 pb-1 sm:p-4 sm:pt-0 sm:pb-2">
                        <div className="text-base sm:text-2xl font-bold truncate leading-tight text-emerald-700">{data.firstTimeOrdersCount}</div>
                        <div className="flex items-center gap-1.5 mt-0.5 sm:mt-1">
                            <Badge variant="outline" className="text-[8px] sm:text-[10px] px-1 py-0 bg-emerald-100 text-emerald-700 border-emerald-200">
                                {firstTimeRate}%
                            </Badge>
                            <span className="text-[8px] sm:text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">New</span>
                        </div>
                    </CardContent>
                </Card>
                <Card className="py-0 sm:py-0 gap-0 border-none shadow-sm bg-blue-50/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 py-1 pb-0 sm:p-4 sm:py-2 sm:pb-0">
                        <CardTitle className="text-[10px] sm:text-sm font-medium">Repeat</CardTitle>
                        <Repeat className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent className="p-2 pt-0 pb-1 sm:p-4 sm:pt-0 sm:pb-2">
                        <div className="text-base sm:text-2xl font-bold truncate leading-tight text-blue-700">{data.repeatOrdersCount}</div>
                        <div className="flex items-center gap-1.5 mt-0.5 sm:mt-1">
                            <Badge variant="outline" className="text-[8px] sm:text-[10px] px-1 py-0 bg-blue-100 text-blue-700 border-blue-200">
                                {repeatRate}%
                            </Badge>
                            <span className="text-[8px] sm:text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Repeat</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="analytics" className="w-full">
                <TabsList className="grid w-full max-w-[400px] grid-cols-2 mb-6">
                    <TabsTrigger value="analytics" className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Analytics & Charts
                    </TabsTrigger>
                    <TabsTrigger value="orders" className="flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4" />
                        Detailed Sales Log
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="analytics" className="space-y-6 mt-0">
                    <div className="grid gap-6 md:grid-cols-3">
                        <Card className="md:col-span-2 shadow-sm py-0 sm:py-0 gap-0">
                            <CardHeader className="flex flex-row items-center justify-between p-2 py-1.5 sm:p-4 sm:py-3">
                                <div>
                                    <CardTitle className="text-sm sm:text-base">Revenue Trend</CardTitle>
                                    <CardDescription className="text-[10px] sm:text-xs">Daily revenue performance</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1">
                                        <div className="h-3 w-3 rounded-full bg-primary" />
                                        <span className="text-xs text-muted-foreground font-medium">Revenue</span>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-2 pt-0 sm:p-4 sm:pt-0">
                                <div className="h-[300px] sm:h-[350px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={data.dailyBreakdown} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                            <XAxis
                                                dataKey="date"
                                                axisLine={false}
                                                tickLine={false}
                                                fontSize={12}
                                                tick={{ fill: '#888' }}
                                                tickFormatter={(val) => {
                                                    const d = new Date(val);
                                                    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                                                }}
                                                minTickGap={30}
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                fontSize={12}
                                                tick={{ fill: '#888' }}
                                                width={45}
                                                tickFormatter={(val) => `$${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val}`}
                                            />
                                            <Tooltip
                                                cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                                formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                                                labelFormatter={(label) => {
                                                    const d = new Date(label);
                                                    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
                                                }}
                                            />
                                            <Bar
                                                dataKey="revenue"
                                                fill="hsl(var(--primary))"
                                                radius={[6, 6, 0, 0]}
                                                barSize={data.dailyBreakdown.length > 30 ? undefined : 32}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm py-0 sm:py-0 gap-0">
                            <CardHeader className="p-2 py-1.5 sm:p-4 sm:py-3">
                                <CardTitle className="text-sm sm:text-base">Purchase Breakdown</CardTitle>
                                <CardDescription className="text-[10px] sm:text-xs">First-time vs. Repeat</CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col items-center justify-center p-2 pt-0 sm:p-4 sm:pt-0">
                                {data.totalOrders > 0 ? (
                                    <>
                                        <div className="h-[200px] sm:h-[250px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={pieData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={80}
                                                        paddingAngle={8}
                                                        dataKey="value"
                                                    >
                                                        {pieData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip />
                                                    <Legend verticalAlign="bottom" height={36} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="mt-2 sm:mt-4 w-full space-y-2 sm:space-y-3">
                                            <div className="flex items-center justify-between text-[11px] sm:text-sm">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-3 w-3 rounded-full bg-emerald-500" />
                                                    <span className="font-medium">First-time</span>
                                                </div>
                                                <span className="font-bold">{data.firstTimeOrdersCount} orders</span>
                                            </div>
                                            <div className="flex items-center justify-between text-sm">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-3 w-3 rounded-full bg-blue-500" />
                                                    <span className="font-medium">Repeat</span>
                                                </div>
                                                <span className="font-bold">{data.repeatOrdersCount} orders</span>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm italic text-center">
                                        No order data to display for this period
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="orders" className="mt-0">
                    <Card className="shadow-sm py-0 sm:py-0 gap-0">
                        <CardHeader className="p-2 py-1.5 sm:p-4 sm:py-3">
                            <CardTitle className="text-sm sm:text-base">Detailed Sales Log</CardTitle>
                            <CardDescription className="text-[10px] sm:text-xs">Orders attributed to this user</CardDescription>
                        </CardHeader>
                        <CardContent className="p-2 pt-0 sm:p-4 sm:pt-0">
                            <div className="rounded-lg border bg-white overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="font-bold">Order #</TableHead>
                                            <TableHead className="font-bold">Date</TableHead>
                                            <TableHead className="font-bold">Customer</TableHead>
                                            <TableHead className="font-bold">Revenue</TableHead>
                                            <TableHead className="font-bold">Status</TableHead>
                                            <TableHead className="font-bold text-center">Type</TableHead>
                                            <TableHead className="font-bold">Sales Rep</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-20">
                                                    <LoadingSpinner size={32} />
                                                </TableCell>
                                            </TableRow>
                                        ) : data.detailedOrders.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                                                    No attributed orders matching your filters were found
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            paginatedDetailedOrders.map((order) => (
                                                <TableRow
                                                    key={order.orderId}
                                                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                                                    onClick={() => handleEditOrder(order.orderId)}
                                                >
                                                    <TableCell className="font-bold text-primary">{order.orderNumber}</TableCell>
                                                    <TableCell className="whitespace-nowrap">
                                                        {new Date(order.date).toLocaleDateString(undefined, {
                                                            year: 'numeric',
                                                            month: 'short',
                                                            day: 'numeric'
                                                        })}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col min-w-[200px]">
                                                            <span className="font-semibold text-sm">{order.customerName}</span>
                                                            <span className="text-[11px] text-muted-foreground font-mono">{order.customerEmail}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-bold text-slate-900">
                                                        {formatCurrency(order.revenue)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant="secondary"
                                                            className={cn(
                                                                "uppercase text-[10px] font-bold tracking-wider rounded-sm px-1.5 py-0.5",
                                                                order.status === 'COMPLETED' ? "bg-green-50 text-green-700 border-green-100" :
                                                                    order.status === 'PENDING' ? "bg-yellow-50 text-yellow-700 border-yellow-100" :
                                                                        "bg-slate-100 text-slate-700"
                                                            )}
                                                        >
                                                            {order.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                "text-[10px] font-bold px-2 py-0.5 rounded-full border-none",
                                                                order.type === 'First-time'
                                                                    ? 'bg-emerald-100 text-emerald-800'
                                                                    : 'bg-blue-100 text-blue-800'
                                                            )}
                                                        >
                                                            {order.type}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-sm font-medium">{order.salesRepName || 'N/A'}</span>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            {totalSalesLogPages > 1 && (
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t">
                                    <div className="text-sm text-muted-foreground">
                                        Page {salesLogPage} of {totalSalesLogPages} ({data.detailedOrders.length} Orders)
                                    </div>
                                    <Pagination
                                        currentPage={salesLogPage}
                                        totalPages={totalSalesLogPages}
                                        onPageChange={setSalesLogPage}
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <EditOrderDialog
                order={editingOrder}
                open={!!editingOrder}
                onOpenChange={(open) => !open && setEditingOrder(null)}
                onSuccess={() => {
                    setEditingOrder(null);
                    fetchData();
                }}
            />
        </div>
    );
}

export default function SalesPersonAnalyticsPage() {
    return (
        <ProtectedRoute requiredRoles={['ADMIN', 'MANAGER', 'SALES_MANAGER', 'STAFF']}>
            <DashboardLayout>
                <div className="max-w-[1400px] mx-auto">
                    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><LoadingSpinner size={40} /></div>}>
                        <SalesPersonAnalyticsContent />
                    </Suspense>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
