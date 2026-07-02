"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    AreaChart,
    Area
} from "recharts";
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    ShoppingCart,
    Users,
    Package,
    Download,
    Calendar,
    Target,
    Globe,
    Star,
    BarChart2
} from "lucide-react";
import { api, formatCurrency } from "@/lib/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPrimitive } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import type { Order } from "@/lib/api";
import { OrderDateFilter } from "@/components/orders/order-date-filter";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import logger from '@/lib/logger';
import { useIsMobile } from "@/hooks/use-is-mobile";
import { SendReportDialog } from "@/components/shared/send-report-dialog";
import { Mail } from "lucide-react";

const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return '';
    if (typeof dateStr !== 'string') return String(dateStr);

    // Handle hourly buckets or pre-formatted PST labels
    if (dateStr.includes('PST')) return dateStr;

    if (dateStr.includes('T')) {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    }

    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
    return dateStr;
};

export function AnalyticsContent() {
    const isMobile = useIsMobile();
    const [dateRange, setDateRange] = useState("last_30_days");
    const [customFrom, setCustomFrom] = useState<Date | null>(null);
    const [customTo, setCustomTo] = useState<Date | null>(null);
    const [salesChannelId, setSalesChannelId] = useState<string | undefined>(undefined);
    const [activeTab, setActiveTab] = useState("overview");
    const [showEmailDialog, setShowEmailDialog] = useState(false);

    const [loading, setLoading] = useState(false);
    const [metrics, setMetrics] = useState<any | null>(null);
    const [geoRows, setGeoRows] = useState<Array<{ region: string; orders: number; revenue: number; percentage: number }>>([]);
    const [geoPage, setGeoPage] = useState(1);
    const geoPageSize = 5;

    const escapeCsv = (value: any): string => {
        if (value === null || value === undefined) return "";
        const str = String(value);
        if (/[",\n]/.test(str)) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    };

    const buildCsv = (): string => {
        const lines: string[] = [];
        lines.push(`Section,Key,Value`);
        lines.push(["Key Metrics", "Total Revenue", formatCurrency(metrics?.totalRevenue || 0)].map(escapeCsv).join(","));
        lines.push(["Key Metrics", "Total Orders", metrics?.totalOrders ?? 0].map(escapeCsv).join(","));
        lines.push(["Key Metrics", "Total Customers", metrics?.totalCustomers ?? 0].map(escapeCsv).join(","));
        lines.push(["Key Metrics", "Active Products", metrics?.activeProducts ?? 0].map(escapeCsv).join(","));
        lines.push("");

        // Sales data
        lines.push("Sales Data,Month,Revenue,Orders");
        (metrics?.salesData || []).forEach((r: any) => {
            lines.push(["Sales Data", r.month, r.revenue, r.orders].map(escapeCsv).join(","));
        });
        lines.push("");

        // Customer segments
        lines.push("Customer Segments,Name,Revenue");
        ((metrics?.customerTypeData || [])
            .filter((c: any) => c.name !== 'ENTERPRISE') // Remove Enterprise
            .map((c: any) => ({
                name: c.name === 'B2C' || c.name === 'B2B' ? 'Wholesale' : c.name === 'ENTERPRISE_1' || c.name === 'ENTERPRISE_2' ? 'Enterprise' : c.name,
                revenue: c.revenue ?? c.value
            }))
        ).forEach((c: any) => {
            lines.push(["Customer Segments", c.name, c.revenue].map(escapeCsv).join(","));
        });
        lines.push("");

        // Top products
        lines.push("Top Products,Name,Sales,Revenue");
        (metrics?.topProducts || []).forEach((p: any) => {
            lines.push(["Top Products", p.name, p.sales, p.revenue].map(escapeCsv).join(","));
        });
        lines.push("");

        // Geography
        lines.push("Sales by Region,Region,Orders,Revenue,Share %");
        geoRows.forEach((g) => {
            lines.push(["Sales by Region", g.region, g.orders, g.revenue, g.percentage].map(escapeCsv).join(","));
        });

        return lines.join("\n");
    };

    const downloadCsv = () => {
        try {
            const csv = buildCsv();
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `analytics_${dateRange}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            logger.error("[Analytics] CSV export failed", { error: e });
        }
    };

    const handleSendEmailReport = async (email: string) => {
        let fromToSend = customFrom;
        let toToSend = customTo;

        if (dateRange === 'day' && customFrom) {
            fromToSend = customFrom;
            toToSend = customFrom;
        }

        return api.post('/analytics/email-report', {
            email,
            range: dateRange,
            from: fromToSend || undefined,
            to: toToSend || undefined,
            salesChannelId,
            usePSTFilter: true
        });
    };

    const loadAnalytics = async () => {
        setLoading(true);
        let rangeToSend = dateRange;
        let fromToSend = customFrom;
        let toToSend = customTo;

        if (dateRange === 'day' && customFrom) {
            rangeToSend = 'custom';
            fromToSend = customFrom;
            toToSend = customFrom;
        }

        try {
            const [res, geoRes] = await Promise.all([
                api.getDashboardAnalytics(
                    rangeToSend as any,
                    fromToSend || undefined,
                    toToSend || undefined,
                    salesChannelId,
                    true // usePSTFilter
                ),
                api.getSalesByRegion(
                    rangeToSend as any,
                    fromToSend || undefined,
                    toToSend || undefined,
                    undefined,
                    undefined,
                    salesChannelId
                )
            ]);

            if (res.success && res.data) {
                setMetrics(res.data);
            } else {
                setMetrics(null);
            }

            if (geoRes.success && geoRes.data) {
                const regions = geoRes.data as any[];
                const totalGeoRevenue = regions.reduce((sum, r) => sum + (r.revenue || 0), 0) || 1;
                const rows = regions.map(r => ({
                    ...r,
                    percentage: Number(((r.revenue / totalGeoRevenue) * 100).toFixed(1))
                }));
                setGeoRows(rows);
            } else {
                setGeoRows([]);
            }
        } catch (error) {
            setMetrics(null);
            setGeoRows([]);
        } finally {
            setLoading(false);
        }
    };

    // load on mount and when filters change
    useEffect(() => {
        loadAnalytics();
        setGeoPage(1); // Reset pagination on filter change
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateRange, customFrom, customTo, salesChannelId]);


    const salesDataFromApi = metrics?.salesData || [];

    const paginatedGeoRows = useMemo(() => {
        const start = (geoPage - 1) * geoPageSize;
        return geoRows.slice(start, start + geoPageSize);
    }, [geoRows, geoPage]);

    const totalGeoPages = Math.ceil(geoRows.length / geoPageSize);

    // Debug: Log sales data to console
    useEffect(() => {
        if (salesDataFromApi.length > 0) {
            logger.info('[Analytics] Sales Data:', { data: salesDataFromApi });
        }
    }, [salesDataFromApi]);

    // Transform customer type data - consolidate B2C+B2B as Wholesale, ENTERPRISE_1+ENTERPRISE_2 as Enterprise
    const rawCustomerData = metrics?.customerTypeData || [];
    const b2cData = rawCustomerData.find((c: any) => c.name === 'B2C');
    const b2bData = rawCustomerData.find((c: any) => c.name === 'B2B');
    const e1Data = rawCustomerData.find((c: any) => c.name === 'ENTERPRISE_1');
    const e2Data = rawCustomerData.find((c: any) => c.name === 'ENTERPRISE_2');

    const customerSegmentDataFromApi = [];
    if (b2cData || b2bData) {
        customerSegmentDataFromApi.push({
            name: 'Wholesale',
            value: (b2cData?.value || 0) + (b2bData?.value || 0),
            revenue: (b2cData?.revenue || 0) + (b2bData?.revenue || 0),
            color: '#3B82F6'
        });
    }
    if (e1Data || e2Data) {
        customerSegmentDataFromApi.push({
            name: 'Enterprise',
            value: (e1Data?.value || 0) + (e2Data?.value || 0),
            revenue: (e1Data?.revenue || 0) + (e2Data?.revenue || 0),
            color: '#F59E0B'
        });
    }

    const topProductsFromApi = metrics?.topProducts || [];

    return (
        <div className="space-y-0">
            <SendReportDialog
                open={showEmailDialog}
                onOpenChange={setShowEmailDialog}
                onSend={handleSendEmailReport}
                title="Send Analytics Report"
                description="Enter the email address where you want to receive the filtered analytics report."
            />
            {/* Dark hero strip */}
            <div className="relative bg-mist border border-line border-t-2 border-t-[#5A9ADA] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#5A9ADA]/8 rounded-full blur-[100px] pointer-events-none" />
                <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
                    {/* Title row + actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-500/15 text-blue-400 border border-blue-500/20">
                                    <BarChart2 className="h-3 w-3" /> Analytics
                                </span>
                            </div>
                            <h1 className="text-xl font-black text-[#043061] tracking-tight">Analytics</h1>
                            <p className="text-xs text-gray-500 mt-0.5">Sales performance and business intelligence</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <OrderDateFilter
                                range={dateRange}
                                setRange={setDateRange}
                                from={customFrom || undefined}
                                setFrom={(d) => setCustomFrom(d || null)}
                                to={customTo || undefined}
                                setTo={(d) => setCustomTo(d || null)}
                                salesChannelId={salesChannelId}
                                onSalesChannelChange={setSalesChannelId}
                            />
                            <Button
                                onClick={() => setShowEmailDialog(true)}
                                className="h-9 px-4 bg-white/[0.06] hover:bg-white/[0.10] text-white border border-white/[0.08] rounded-xl text-xs font-bold"
                                variant="ghost"
                            >
                                <Mail className="h-3.5 w-3.5 mr-1.5" />
                                {isMobile ? "Email Report" : "Email"}
                            </Button>
                            {!isMobile && (
                                <Button
                                    onClick={downloadCsv}
                                    className="h-9 px-4 bg-white/[0.06] hover:bg-white/[0.10] text-white border border-white/[0.08] rounded-xl text-xs font-bold"
                                    variant="ghost"
                                >
                                    <Download className="h-3.5 w-3.5 mr-1.5" />
                                    Export
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Sub-nav pills */}
                    <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
                        {[
                            { key: 'overview',   label: 'Overview' },
                            { key: 'sales',      label: 'Sales' },
                            { key: 'products',   label: 'Products' },
                            { key: 'customers',  label: 'Customers' },
                            { key: 'geography',  label: 'Geography' },
                        ].map((pill) => {
                            const isActive = activeTab === pill.key;
                            return (
                                <button
                                    key={pill.key}
                                    onClick={() => setActiveTab(pill.key)}
                                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                        isActive
                                            ? 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30'
                                            : 'bg-white/[0.04] text-gray-500 hover:bg-white/[0.08] hover:text-gray-300'
                                    }`}
                                >
                                    {pill.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Analytics Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6 mt-4">

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Revenue Chart */}
                        <Card className="col-span-1">
                            <CardHeader>
                                <CardTitle>Revenue Trend</CardTitle>
                                <CardDescription>Revenue on days with sales activity</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loading ? (
                                    <Skeleton className="w-full h-[300px]" />
                                ) : (
                                    <>
                                        {salesDataFromApi.length === 0 && (
                                            <div className="text-sm text-muted-foreground mb-2">No revenue data available for the selected period</div>
                                        )}
                                        {salesDataFromApi.length > 0 && (
                                            <div className="text-xs text-muted-foreground mb-2">
                                                Showing {salesDataFromApi.length} {
                                                    (activeTab === 'overview' && (dateRange === 'day' || (dateRange === 'custom' && customFrom && customTo && customFrom.toDateString() === customTo.toDateString())))
                                                        ? 'hours'
                                                        : 'days'
                                                } with sales
                                            </div>
                                        )}
                                        <ResponsiveContainer width="100%" height={300}>
                                            <LineChart data={salesDataFromApi}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis
                                                    dataKey="month"
                                                    tickFormatter={formatDateLabel}
                                                    tick={{ fontSize: 12 }}
                                                />
                                                <YAxis
                                                    tickFormatter={(value) => `$${Math.round(value)}`}
                                                    tick={{ fontSize: 12 }}
                                                />
                                                <Tooltip
                                                    formatter={(value) => [`$${Math.round(Number(value)).toLocaleString()}`, "Revenue"]}
                                                    contentStyle={{ background: 'var(--popover)', color: 'var(--popover-foreground)', border: '1px solid var(--border)' }}
                                                    labelStyle={{ color: 'var(--popover-foreground)' }}
                                                    itemStyle={{ color: 'var(--popover-foreground)' }}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="revenue"
                                                    stroke="#3b82f6"
                                                    strokeWidth={3}
                                                    dot={{ fill: '#3b82f6', r: 5 }}
                                                    activeDot={{ r: 7 }}
                                                    isAnimationActive={false}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {/* Customer Segments */}
                        <Card className="col-span-1">
                            <CardHeader>
                                <CardTitle>Customer Segments</CardTitle>
                                <CardDescription>Revenue by customer type</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loading ? (
                                    <div className="space-y-4">
                                        <Skeleton className="w-full h-[250px] rounded-full mx-auto max-w-[250px]" />
                                        <div className="space-y-2">
                                            <Skeleton className="h-4 w-full" />
                                            <Skeleton className="h-4 w-full" />
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <ResponsiveContainer width="100%" height={300}>
                                            <PieChart>
                                                <Pie
                                                    data={customerSegmentDataFromApi}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={100}
                                                    dataKey="revenue"
                                                >
                                                    {customerSegmentDataFromApi.map((entry: any, index: number) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    formatter={(value) => [`$${Number(value).toLocaleString()}`, "Revenue"]}
                                                    contentStyle={{ background: 'var(--popover)', color: 'var(--popover-foreground)', border: '1px solid var(--border)' }}
                                                    labelStyle={{ color: 'var(--popover-foreground)' }}
                                                    itemStyle={{ color: 'var(--popover-foreground)' }}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="flex flex-col gap-2 mt-4">
                                            {customerSegmentDataFromApi.map((item: any) => (
                                                <div key={item.name} className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className="w-3 h-3 rounded-full"
                                                            style={{ backgroundColor: item.color }}
                                                        />
                                                        <span className="text-sm">{item.name}</span>
                                                    </div>
                                                    <span className="text-sm font-medium">{item.revenue?.toLocaleString?.() || item.revenue}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Sales Tab */}
                <TabsContent value="sales" className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Daily Sales</CardTitle>
                                <CardDescription>
                                    {dateRange === 'day' || (dateRange === 'custom' && customFrom && customTo && customFrom.toDateString() === customTo.toDateString())
                                        ? 'Revenue and orders by hour'
                                        : 'Revenue and orders by day'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={salesDataFromApi}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="month" tickFormatter={formatDateLabel} />
                                        <YAxis />
                                        <Tooltip
                                            contentStyle={{ background: 'var(--popover)', color: 'var(--popover-foreground)', border: '1px solid var(--border)' }}
                                            labelStyle={{ color: 'var(--popover-foreground)' }}
                                            itemStyle={{ color: 'var(--popover-foreground)' }}
                                        />
                                        <Bar dataKey="revenue" fill="hsl(var(--primary))" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Sales Trends</CardTitle>
                                <CardDescription>
                                    {dateRange === 'day' || (dateRange === 'custom' && customFrom && customTo && customFrom.toDateString() === customTo.toDateString())
                                        ? 'Hourly comparison'
                                        : 'Daily comparison'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loading ? (
                                    <Skeleton className="w-full h-[300px]" />
                                ) : (
                                    <>
                                        {salesDataFromApi.length === 0 && (
                                            <div className="text-sm text-muted-foreground mb-2">No sales data available for the selected period</div>
                                        )}
                                        <ResponsiveContainer width="100%" height={300}>
                                            <LineChart data={salesDataFromApi}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="month" tickFormatter={formatDateLabel} />
                                                <YAxis
                                                    yAxisId="left"
                                                    tickFormatter={(value) => `$${Math.round(value)}`}
                                                    label={{ value: 'Revenue', angle: -90, position: 'insideLeft', offset: 10, style: { textAnchor: 'middle' } }}
                                                />
                                                <YAxis
                                                    yAxisId="right"
                                                    orientation="right"
                                                    tickFormatter={(value) => Math.round(value).toString()}
                                                    label={{ value: 'Orders', angle: 90, position: 'insideRight', offset: 10, style: { textAnchor: 'middle' } }}
                                                />
                                                <Tooltip
                                                    formatter={(value, name) => {
                                                        const roundedValue = Math.round(Number(value));
                                                        if (name === 'revenue') {
                                                            return [`$${roundedValue.toLocaleString()}`, 'Revenue'];
                                                        }
                                                        return [roundedValue, 'Orders'];
                                                    }}
                                                    contentStyle={{ background: 'var(--popover)', color: 'var(--popover-foreground)', border: '1px solid var(--border)' }}
                                                    labelStyle={{ color: 'var(--popover-foreground)' }}
                                                    itemStyle={{ color: 'var(--popover-foreground)' }}
                                                />
                                                <Line
                                                    yAxisId="left"
                                                    type="monotone"
                                                    dataKey="revenue"
                                                    stroke="#3b82f6"
                                                    strokeWidth={3}
                                                    name="revenue"
                                                />
                                                <Line
                                                    yAxisId="right"
                                                    type="monotone"
                                                    dataKey="orders"
                                                    stroke="#f59e0b"
                                                    strokeWidth={3}
                                                    name="orders"
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Products Tab */}
                <TabsContent value="products" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Top Products</CardTitle>
                            <CardDescription>Best performing products by sales and revenue</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0 sm:p-6">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="min-w-[150px]">Product</TableHead>
                                            <TableHead className="min-w-[80px]">Sales</TableHead>
                                            <TableHead className="min-w-[100px]">Revenue</TableHead>
                                            <TableHead className="min-w-[80px]">Trend</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            Array.from({ length: 5 }).map((_, i) => (
                                                <TableRow key={i}>
                                                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                                                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                                                </TableRow>
                                            ))
                                        ) : topProductsFromApi.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                                    No product performance data available
                                                </TableCell>
                                            </TableRow>
                                        ) : (topProductsFromApi || []).map((product: any, index: number) => (
                                            <TableRow key={product.id || index}>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                                            {index + 1}
                                                        </div>
                                                        <span className="truncate max-w-[200px] sm:max-w-none">{product.name}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{product.sales}</TableCell>
                                                <TableCell className="font-mono text-xs sm:text-sm">{formatCurrency(product.revenue || 0)}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        {(product.trend || 'up') === 'up' ? (
                                                            <TrendingUp className="h-4 w-4 text-green-500" />
                                                        ) : (
                                                            <TrendingDown className="h-4 w-4 text-red-500" />
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Customers Tab */}
                <TabsContent value="customers" className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-3">
                        <Card>
                            <CardHeader>
                                <CardTitle>Customer Acquisition</CardTitle>
                                <CardDescription>New orders over time</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loading ? (
                                    <Skeleton className="w-full h-[200px]" />
                                ) : (
                                    <ResponsiveContainer width="100%" height={200}>
                                        <LineChart data={salesDataFromApi}>
                                            <XAxis dataKey="month" tickFormatter={formatDateLabel} />
                                            <YAxis tickFormatter={(value) => Math.round(value).toString()} />
                                            <Tooltip
                                                formatter={(value) => [Math.round(Number(value)), 'Orders']}
                                                contentStyle={{ background: 'var(--popover)', color: 'var(--popover-foreground)', border: '1px solid var(--border)' }}
                                                labelStyle={{ color: 'var(--popover-foreground)' }}
                                                itemStyle={{ color: 'var(--popover-foreground)' }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="orders"
                                                stroke="#3b82f6"
                                                strokeWidth={3}
                                                dot={{ fill: '#3b82f6', r: 5 }}
                                                activeDot={{ r: 7 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Customer Lifetime Value</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {loading ? (
                                    <div className="text-center space-y-2">
                                        <Skeleton className="h-8 w-32 mx-auto" />
                                        <Skeleton className="h-4 w-24 mx-auto" />
                                        <Skeleton className="h-4 w-20 mx-auto" />
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <div className="text-3xl font-bold">{metrics ? formatCurrency(Number(metrics.customerLifetimeValue || 0)) : "$0.00"}</div>
                                        <p className="text-sm text-muted-foreground">Average CLV</p>
                                        <div className="flex items-center justify-center gap-1 mt-2">
                                            {(metrics?.clvChange ?? 0) >= 0 ? (
                                                <TrendingUp className="h-3 w-3 text-green-500" />
                                            ) : (
                                                <TrendingDown className="h-3 w-3 text-red-500" />
                                            )}
                                            <span className={(metrics?.clvChange ?? 0) >= 0 ? "text-sm text-green-600" : "text-sm text-red-600"}>
                                                {`${(metrics?.clvChange ?? 0) >= 0 ? "+" : ""}${(metrics?.clvChange ?? 0).toFixed(1)}%`}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Geography Tab */}
                <TabsContent value="geography" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Sales by Region</CardTitle>
                            <CardDescription>Geographic distribution of orders and revenue</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0 sm:p-6">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="min-w-[150px]">Region</TableHead>
                                            <TableHead className="min-w-[80px]">Orders</TableHead>
                                            <TableHead className="min-w-[120px]">Revenue</TableHead>
                                            <TableHead className="min-w-[80px]">Share</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            Array.from({ length: 5 }).map((_, i) => (
                                                <TableRow key={i}>
                                                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                </TableRow>
                                            ))
                                        ) : geoRows.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                                    No regional data available
                                                </TableCell>
                                            </TableRow>
                                        ) : paginatedGeoRows.map((region) => (
                                            <TableRow key={region.region}>
                                                <TableCell className="font-medium">{region.region}</TableCell>
                                                <TableCell>{region.orders}</TableCell>
                                                <TableCell className="font-mono text-xs sm:text-sm">{formatCurrency(region.revenue)}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-12 h-2 bg-secondary rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-primary rounded-full transition-all duration-500"
                                                                style={{ width: `${region.percentage}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-sm">{region.percentage}%</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {totalGeoPages > 1 && (
                                <div className="mt-4 pt-4 border-t">
                                    <Pagination
                                        currentPage={geoPage}
                                        totalPages={totalGeoPages}
                                        onPageChange={setGeoPage}
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
