'use client';

export const dynamic = "force-dynamic";

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { ProtectedRoute } from '@/contexts/auth-context';
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
    TrendingUp,
    Download,
    ArrowLeft,
    UserCircle,
    UserPlus,
    Repeat,
    Mail,
    BarChart2,
    PieChart as PieChartIcon,
    List,
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
        wsOverview['!cols'] = [{ wch: 25 }, { wch: 35 }];
        XLSX.utils.book_append_sheet(wb, wsOverview, 'Summary Overview');

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
        wsDetailed['!cols'] = [
            { wch: 15 },
            { wch: 25 },
            { wch: 12 },
            { wch: 10 },
            { wch: 25 },
            { wch: 30 },
            { wch: 12 },
            { wch: 15 },
            { wch: 15 },
            { wch: 20 }
        ];
        XLSX.utils.book_append_sheet(wb, wsDetailed, 'Detailed Sales Log');

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
            { name: 'First-time', value: data.firstTimeOrdersCount, color: '#10b981' },
            { name: 'Repeat', value: data.repeatOrdersCount, color: '#3b82f6' }
        ].filter(item => item.value > 0);
    }, [data]);

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
        <div className="space-y-0">
            {/* ════════ DARK HERO STRIP ════════ */}
            <div className="relative bg-mist border border-line border-t-2 border-t-[#5A9ADA] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#5A9ADA]/8 rounded-full blur-[100px] pointer-events-none" />
                <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="icon" onClick={() => window.history.back()} className="rounded-full text-white hover:bg-white/10">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <div>
                                <h1 className="text-xl font-black text-[#043061] tracking-tight flex items-center gap-2">
                                    <UserCircle className="h-5 w-5 text-[#5A9ADA]" />
                                    {data.personName} Analytics
                                </h1>
                                <p className="text-xs text-gray-500 mt-0.5">
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
                            {!isMobile && (
                                <button onClick={handleExport} disabled={loading} className="flex items-center gap-1.5 h-9 px-3 bg-[#043061] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-100 transition-colors disabled:opacity-50">
                                    <Download className="h-3.5 w-3.5" />
                                    Export
                                </button>
                            )}
                            <button onClick={() => setShowEmailDialog(true)} className="flex items-center gap-1.5 h-9 px-3 bg-white border border-line rounded-xl text-xs font-bold text-gray-300 hover:bg-white/[0.12] hover:text-white transition-colors">
                                <Mail className="h-3.5 w-3.5" />
                                {isMobile ? "Email Report" : "Email"}
                            </button>
                        </div>
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

            {/* Stat chips */}
            <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
                <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl border border-gray-200/80 shadow-sm p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] sm:text-sm font-medium text-slate-600">Total Revenue</span>
                        <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                    </div>
                    <div className="text-base sm:text-2xl font-bold truncate leading-tight">{formatCurrency(data.totalRevenue)}</div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">Gross sales in range</p>
                </div>

                <div className="bg-slate-50 rounded-2xl border border-gray-200/80 shadow-sm p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] sm:text-sm font-medium text-slate-600">Total Orders</span>
                        <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                    </div>
                    <div className="text-base sm:text-2xl font-bold truncate leading-tight">{data.totalOrders}</div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">Successful purchases</p>
                </div>

                <div className="bg-emerald-50/50 rounded-2xl border border-gray-200/80 shadow-sm p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] sm:text-sm font-medium text-slate-600">First-time</span>
                        <UserPlus className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-600" />
                    </div>
                    <div className="text-base sm:text-2xl font-bold truncate leading-tight text-emerald-700">{data.firstTimeOrdersCount}</div>
                    <div className="flex items-center gap-1.5 mt-0.5 sm:mt-1">
                        <Badge variant="outline" className="text-[8px] sm:text-[10px] px-1 py-0 bg-emerald-100 text-emerald-700 border-emerald-200">
                            {firstTimeRate}%
                        </Badge>
                        <span className="text-[8px] sm:text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">New</span>
                    </div>
                </div>

                <div className="bg-blue-50/50 rounded-2xl border border-gray-200/80 shadow-sm p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] sm:text-sm font-medium text-slate-600">Repeat</span>
                        <Repeat className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                    </div>
                    <div className="text-base sm:text-2xl font-bold truncate leading-tight text-blue-700">{data.repeatOrdersCount}</div>
                    <div className="flex items-center gap-1.5 mt-0.5 sm:mt-1">
                        <Badge variant="outline" className="text-[8px] sm:text-[10px] px-1 py-0 bg-blue-100 text-blue-700 border-blue-200">
                            {repeatRate}%
                        </Badge>
                        <span className="text-[8px] sm:text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Repeat</span>
                    </div>
                </div>
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

                <TabsContent value="analytics" className="space-y-5 mt-0">
                    <div className="grid gap-5 md:grid-cols-3">
                        {/* Revenue Trend chart */}
                        <div className="md:col-span-2 bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-slate-100 rounded-lg">
                                        <BarChart2 className="h-4 w-4 text-slate-600" />
                                    </div>
                                    <div>
                                        <span className="text-sm sm:text-base font-semibold text-slate-800">Revenue Trend</span>
                                        <p className="text-[10px] sm:text-xs text-muted-foreground">Daily revenue performance</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="h-3 w-3 rounded-full bg-primary" />
                                    <span className="text-xs text-muted-foreground font-medium">Revenue</span>
                                </div>
                            </div>
                            <div className="p-2 sm:p-4">
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
                            </div>
                        </div>

                        {/* Purchase Breakdown chart */}
                        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                                <div className="p-1.5 bg-slate-100 rounded-lg">
                                    <PieChartIcon className="h-4 w-4 text-slate-600" />
                                </div>
                                <div>
                                    <span className="text-sm sm:text-base font-semibold text-slate-800">Purchase Breakdown</span>
                                    <p className="text-[10px] sm:text-xs text-muted-foreground">First-time vs. Repeat</p>
                                </div>
                            </div>
                            <div className="p-2 sm:p-4 flex flex-col items-center justify-center">
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
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="orders" className="mt-0">
                    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                            <div className="p-1.5 bg-slate-100 rounded-lg">
                                <List className="h-4 w-4 text-slate-600" />
                            </div>
                            <div>
                                <span className="text-sm sm:text-base font-semibold text-slate-800">Detailed Sales Log</span>
                                <p className="text-[10px] sm:text-xs text-muted-foreground">Orders attributed to this user</p>
                            </div>
                        </div>
                        <div className="p-2 sm:p-4">
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
                        </div>
                    </div>
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
