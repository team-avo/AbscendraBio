"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StockAlerts } from "./stock-alerts";
import { SalesRepDashboard } from "./sales-rep-dashboard";
import { useAuth } from "@/contexts/auth-context";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    ResponsiveContainer,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    AreaChart,
    Area,
    ComposedChart
} from "recharts";
import { ChartContainer, ChartTooltip as RechartsTooltipWrapper, ChartTooltipContent } from "@/components/ui/chart";
import {
    TrendingUp,
    TrendingDown,
    ShoppingCart,
    ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api, formatCurrency, formatCompactCurrency } from "@/lib/api";
import { CreateCustomerDialog } from "@/components/customers/create-customer-dialog";
import { CreateOrderDialog } from "@/components/orders/create-order-dialog";
import { SendReportDialog } from "@/components/shared/send-report-dialog";
import { Mail } from "lucide-react";
import logger from '@/lib/logger';
import { useIsMobile } from "@/hooks/use-is-mobile";

// Types for dashboard data
interface DashboardData {
    totalRevenue: number;
    revenueChange: number;
    totalOrders: number;
    orderChange: number;
    totalCustomers: number;
    customerChange: number;
    activeProducts: number;
    productChange: number;
    recentOrders: Array<{
        id: string;
        customer: string;
        email: string;
        amount: number;
        status: string;
        date: string;
    }>;
    topProducts: Array<{
        id: string;
        name: string;
        sales: number;
        revenue: number;
        stock: number;
        trend: string;
    }>;
    customerTypeData: Array<{
        name: string;
        value: number;
        count?: number;
        color: string;
    }>;
    salesData: Array<{
        month: string;
        revenue: number;
        orders: number;
    }>;
}

const StatusBadge = ({ status }: { status: string }) => {
    const variants: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
        completed: "default",
        processing: "secondary",
        shipped: "outline",
        pending: "destructive",
        delivered: "default",
        cancelled: "destructive",
        refunded: "destructive",
        on_hold: "secondary"
    };

    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
};

export function DashboardContent() {
    const router = useRouter();
    const { user } = useAuth();
    const isMobile = useIsMobile();
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCreateCustomerDialog, setShowCreateCustomerDialog] = useState(false);
    const [showCreateOrderDialog, setShowCreateOrderDialog] = useState(false);
    const [showEmailDialog, setShowEmailDialog] = useState(false);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                setLoading(true);

                // Let backend handle PST cutoff
                const now = new Date();
                const toDate = new Date(now);
                const fromDate = new Date(now);
                fromDate.setDate(fromDate.getDate() - 30);

                const response = await api.getDashboardAnalytics(
                    'custom',
                    fromDate,
                    toDate,
                    undefined,
                    true // usePSTFilter legacy flag
                );

                if (response.success && response.data) {
                    // Transform customer type data to consolidate types
                    const transformedData = {
                        ...response.data,
                        customerTypeData: (() => {
                            const data = response.data.customerTypeData || [];
                            // Group B2C + B2B as "Wholesale"
                            const b2cData = data.find((item: any) => item.name === 'B2C') as any;
                            const b2bData = data.find((item: any) => item.name === 'B2B') as any;
                            const wholesaleValue = (b2cData?.value || 0) + (b2bData?.value || 0);
                            const wholesaleCount = (b2cData?.count || 0) + (b2bData?.count || 0);

                            // Group ENTERPRISE_1 + ENTERPRISE_2 as "Enterprise"
                            const e1Data = data.find((item: any) => item.name === 'ENTERPRISE_1') as any;
                            const e2Data = data.find((item: any) => item.name === 'ENTERPRISE_2') as any;
                            const enterpriseValue = (e1Data?.value || 0) + (e2Data?.value || 0);
                            const enterpriseCount = (e1Data?.count || 0) + (e2Data?.count || 0);

                            const result = [];
                            if (wholesaleValue > 0) {
                                result.push({ name: 'Wholesale', value: wholesaleValue, count: wholesaleCount, color: '#3B82F6' });
                            }
                            if (enterpriseValue > 0) {
                                result.push({ name: 'Enterprise', value: enterpriseValue, count: enterpriseCount, color: '#F59E0B' });
                            }
                            return result;
                        })()
                    };
                    setDashboardData(transformedData);
                } else {
                    setError(response.error || 'Failed to fetch dashboard data');
                }
            } catch (err) {
                setError('Failed to fetch dashboard data');
                logger.error('Dashboard data fetch error:', { error: err });
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    const handleAddProduct = () => {
        router.push('/products/create');
    };

    const handleAddCustomer = () => {
        setShowCreateCustomerDialog(true);
    };

    const handleCreateOrder = () => {
        setShowCreateOrderDialog(true);
    };

    // Normalize and aggregate to month-wise data (always last 6 months, unique month labels)
    const normalizedSalesData = useMemo(() => {
        const src = dashboardData?.salesData || [];
        // Map any YYYY-MM-DD to month short name, keep revenue/orders
        const monthAgg = new Map<string, { month: string; revenue: number; orders: number }>();
        for (const d of src) {
            let label = d.month;
            if (typeof label === 'string' && /\d{4}-\d{2}-\d{2}/.test(label)) {
                const dt = new Date(label);
                label = dt.toLocaleString('en-US', { month: 'short' });
            }
            const prev = monthAgg.get(label) || { month: label, revenue: 0, orders: 0 };
            prev.revenue += Number(d.revenue || 0);
            prev.orders += Number(d.orders || 0);
            monthAgg.set(label, prev);
        }
        // Build last 6 months in order, using real calendar
        const months: string[] = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push(dt.toLocaleString('en-US', { month: 'short' }));
        }
        const result = months.map(m => monthAgg.get(m) || { month: m, revenue: 0, orders: 0 });
        return result;
    }, [dashboardData?.salesData]);

    const handleDownloadReport = () => {
        const rows = (dashboardData?.salesData || []).map(d => `${d.month},${d.revenue},${d.orders}`);
        const csv = ["DATE,REVENUE,ORDERS", ...rows].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'revenue_overview.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleSendEmailReport = async (email: string) => {
        // Let backend handle PST cutoff
        const now = new Date();
        const toDate = new Date(now);
        const fromDate = new Date(now);
        fromDate.setDate(fromDate.getDate() - 30);

        return api.sendSalesEmailReport({
            email,
            range: 'custom',
            from: fromDate.toISOString(),
            to: toDate.toISOString(),
            usePSTFilter: true, // Legacy flag, now default behavior
        });
    };

    const handleViewReports = () => {
        router.push('/analytics');
    };

    const handleViewStore = () => {
        router.push('/landing');
    };

    const handleCustomerCreated = () => {
        setShowCreateCustomerDialog(false);
        // Refresh dashboard data by calling the fetch function
        const refreshData = async () => {
            try {
                setLoading(true);
                // Let backend handle PST cutoff
                const now = new Date();
                const toDate = new Date(now);
                const fromDate = new Date(now);
                fromDate.setDate(fromDate.getDate() - 30);

                const response = await api.getDashboardAnalytics('custom', fromDate, toDate, undefined, true);

                if (response.success && response.data) {
                    // Transform customer type data to consolidate types
                    const transformedData = {
                        ...response.data,
                        customerTypeData: (() => {
                            const data = response.data.customerTypeData || [];
                            const b2cData = data.find((item: any) => item.name === 'B2C');
                            const b2bData = data.find((item: any) => item.name === 'B2B');
                            const wholesaleValue = (b2cData?.value || 0) + (b2bData?.value || 0);
                            const e1Data = data.find((item: any) => item.name === 'ENTERPRISE_1');
                            const e2Data = data.find((item: any) => item.name === 'ENTERPRISE_2');
                            const enterpriseValue = (e1Data?.value || 0) + (e2Data?.value || 0);
                            const result = [];
                            if (wholesaleValue > 0) result.push({ name: 'Wholesale', value: wholesaleValue, color: '#3B82F6' });
                            if (enterpriseValue > 0) result.push({ name: 'Enterprise', value: enterpriseValue, color: '#F59E0B' });
                            return result;
                        })()
                    };
                    setDashboardData(transformedData);
                } else {
                    setError(response.error || 'Failed to fetch dashboard data');
                }
            } catch (err) {
                setError('Failed to fetch dashboard data');
                logger.error('Dashboard data fetch error:', { error: err });
            } finally {
                setLoading(false);
            }
        };
        refreshData();
    };

    const handleOrderCreated = () => {
        setShowCreateOrderDialog(false);
        // Refresh dashboard data by calling the fetch function
        const refreshData = async () => {
            try {
                setLoading(true);
                // Let backend handle PST cutoff
                const now = new Date();
                const toDate = new Date(now);
                const fromDate = new Date(now);
                fromDate.setDate(fromDate.getDate() - 30);

                const response = await api.getDashboardAnalytics('custom', fromDate, toDate, undefined, true);

                if (response.success && response.data) {
                    // Transform customer type data to consolidate types
                    const transformedData = {
                        ...response.data,
                        customerTypeData: (() => {
                            const data = response.data.customerTypeData || [];
                            const b2cData = data.find((item: any) => item.name === 'B2C');
                            const b2bData = data.find((item: any) => item.name === 'B2B');
                            const wholesaleValue = (b2cData?.value || 0) + (b2bData?.value || 0);
                            const e1Data = data.find((item: any) => item.name === 'ENTERPRISE_1');
                            const e2Data = data.find((item: any) => item.name === 'ENTERPRISE_2');
                            const enterpriseValue = (e1Data?.value || 0) + (e2Data?.value || 0);
                            const result = [];
                            if (wholesaleValue > 0) result.push({ name: 'Wholesale', value: wholesaleValue, color: '#3B82F6' });
                            if (enterpriseValue > 0) result.push({ name: 'Enterprise', value: enterpriseValue, color: '#F59E0B' });
                            return result;
                        })()
                    };
                    setDashboardData(transformedData);
                } else {
                    setError(response.error || 'Failed to fetch dashboard data');
                }
            } catch (err) {
                setError('Failed to fetch dashboard data');
                logger.error('Dashboard data fetch error:', { error: err });
            } finally {
                setLoading(false);
            }
        };
        refreshData();
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                        <p className="text-muted-foreground">
                            Loading dashboard data...
                        </p>
                    </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[...Array(4)].map((_, i) => (
                        <Card key={i}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                                <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
                            </CardHeader>
                            <CardContent>
                                <div className="h-8 w-32 bg-gray-200 rounded animate-pulse mb-2"></div>
                                <div className="h-3 w-40 bg-gray-200 rounded animate-pulse"></div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    if (error || !dashboardData) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                        <p className="text-muted-foreground">
                            Error loading dashboard data
                        </p>
                    </div>
                </div>
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-red-600">{error || 'Failed to load dashboard data'}</p>
                        <Button
                            onClick={() => window.location.reload()}
                            className="mt-4"
                        >
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Show sales rep dashboard for sales rep users
    if (user?.role === 'SALES_REP') {
        return <SalesRepDashboard />;
    }

    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    const formattedDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    const getOrderStatusClasses = (status: string) => {
        switch (status) {
            case 'pending':
                return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'processing':
                return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'shipped':
                return 'bg-indigo-50 text-indigo-700 border-indigo-200';
            case 'delivered':
            case 'completed':
                return 'bg-green-50 text-green-700 border-green-200';
            case 'cancelled':
            case 'refunded':
                return 'bg-red-50 text-red-700 border-red-200';
            default:
                return 'bg-slate-50 text-slate-700 border-slate-200';
        }
    };

    return (
        <div className="space-y-4">

            {/* ── GREETING HERO ────────────────────────────────── */}
            <div className="relative bg-[#070B14] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
                {/* Grid texture */}
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                {/* Blue glow */}
                <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#4D7DF2]/8 rounded-full blur-[100px] pointer-events-none" />
                <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-xl font-black text-white tracking-tight">
                                {greeting}{user?.firstName ? `, ${user.firstName}` : ''}!
                            </h1>
                            <p className="text-xs text-white/40 mt-0.5">{formattedDate}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                className="inline-flex items-center gap-1.5 bg-white/[0.06] border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/[0.10] hover:text-white transition-all"
                                onClick={handleViewStore}
                            >
                                View Store
                            </button>
                            <button
                                className="inline-flex items-center gap-1.5 bg-white/[0.06] border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/[0.10] hover:text-white transition-all"
                                onClick={handleAddCustomer}
                            >
                                + Customer
                            </button>
                            <button
                                className="inline-flex items-center gap-1.5 bg-[#3A6FA0] hover:bg-[#2d5a87] rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition-all"
                                onClick={handleCreateOrder}
                            >
                                + New Order
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── BENTO ROW 1 ──────────────────────────────────── */}
            <div className="grid grid-cols-12 gap-4">

                {/* Revenue Hero — dark tile, col-span-5 */}
                <div className="col-span-12 md:col-span-5 bg-[#1B2D4F] rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[220px]">
                    {/* Decorative blobs */}
                    <div className="absolute -top-10 -right-10 w-44 h-44 bg-[#3A6FA0]/20 rounded-full blur-2xl pointer-events-none" />
                    <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full pointer-events-none" />

                    <div className="relative z-10">
                        <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">Total Revenue</p>
                        <p className="text-5xl font-extrabold text-white mt-3 tracking-tight leading-none">
                            {formatCompactCurrency(dashboardData.totalRevenue)}
                        </p>
                        <div className={cn(
                            "flex items-center gap-1.5 mt-3 text-sm font-medium",
                            dashboardData.revenueChange >= 0 ? "text-emerald-400" : "text-red-400"
                        )}>
                            {dashboardData.revenueChange >= 0
                                ? <TrendingUp className="h-4 w-4" />
                                : <TrendingDown className="h-4 w-4" />}
                            <span>{dashboardData.revenueChange >= 0 ? "+" : ""}{dashboardData.revenueChange}% vs last month</span>
                        </div>
                    </div>

                    {/* Mini sparkline */}
                    <div className="relative z-10 h-16 mt-4 -mx-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={normalizedSalesData} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="heroSparkGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#3A6FA0" stopOpacity={0.5} />
                                        <stop offset="100%" stopColor="#3A6FA0" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Area type="monotone" dataKey="revenue" stroke="#3A6FA0" strokeWidth={2} fill="url(#heroSparkGrad)" dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Right side — 3 mini stats + chart, col-span-7 */}
                <div className="col-span-12 md:col-span-7 flex flex-col gap-4">

                    {/* Three mini stat tiles */}
                    <div className="grid grid-cols-3 gap-4">
                        {/* Orders */}
                        <div className="bg-white rounded-2xl border border-slate-100 p-4 hover:shadow-sm transition-shadow">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Orders</p>
                            <p className="text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">{dashboardData.totalOrders.toLocaleString()}</p>
                            <div className={cn("flex items-center gap-1 mt-2 text-xs font-semibold", dashboardData.orderChange >= 0 ? "text-emerald-500" : "text-red-500")}>
                                {dashboardData.orderChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                <span>{dashboardData.orderChange >= 0 ? "+" : ""}{dashboardData.orderChange}%</span>
                            </div>
                        </div>

                        {/* Customers */}
                        <div className="bg-white rounded-2xl border border-slate-100 p-4 hover:shadow-sm transition-shadow">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customers</p>
                            <p className="text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">{dashboardData.totalCustomers.toLocaleString()}</p>
                            <div className={cn("flex items-center gap-1 mt-2 text-xs font-semibold", dashboardData.customerChange >= 0 ? "text-emerald-500" : "text-red-500")}>
                                {dashboardData.customerChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                <span>{dashboardData.customerChange >= 0 ? "+" : ""}{dashboardData.customerChange}%</span>
                            </div>
                        </div>

                        {/* Products */}
                        <div className="bg-white rounded-2xl border border-slate-100 p-4 hover:shadow-sm transition-shadow">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Products</p>
                            <p className="text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">{dashboardData.activeProducts.toLocaleString()}</p>
                            <div className={cn("flex items-center gap-1 mt-2 text-xs font-semibold", dashboardData.productChange >= 0 ? "text-emerald-500" : "text-red-500")}>
                                {dashboardData.productChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                <span>{dashboardData.productChange >= 0 ? "+" : ""}{dashboardData.productChange}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Revenue Trend chart tile */}
                    <div className="flex-1 bg-white rounded-2xl border border-slate-100 p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-800">Revenue Trend</h3>
                                <p className="text-xs text-slate-400">Last 6 months</p>
                            </div>
                            <Button size="sm" variant="ghost" onClick={handleDownloadReport} className="text-xs h-7 text-slate-400 hover:text-slate-700 hover:bg-slate-50 px-2">
                                Export ↓
                            </Button>
                        </div>
                        <div className="h-[110px]">
                            <ChartContainer
                                id="trend-chart"
                                config={{ revenue: { label: "Revenue", color: "#1B2D4F" }, orders: { label: "Orders", color: "#3A6FA0" } }}
                                className="h-full w-full"
                            >
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={normalizedSalesData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                        <YAxis yAxisId="revenue" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => formatCompactCurrency(v)} />
                                        <YAxis yAxisId="orders" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
                                        <RechartsTooltipWrapper content={<ChartTooltipContent />} />
                                        <Bar yAxisId="revenue" dataKey="revenue" fill="#1B2D4F" radius={[3, 3, 0, 0]} maxBarSize={32} name="Revenue" />
                                        <Line yAxisId="orders" dataKey="orders" stroke="#3A6FA0" strokeWidth={2} dot={{ fill: '#3A6FA0', r: 2.5 }} name="Orders" />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </ChartContainer>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── BENTO ROW 2 ──────────────────────────────────── */}
            <div className="grid grid-cols-12 gap-4">

                {/* Customer Breakdown — col-span-4 */}
                <div className="col-span-12 md:col-span-4 bg-white rounded-2xl border border-slate-100 p-5">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-sm font-semibold text-slate-800">Customers</h3>
                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">{dashboardData.totalCustomers} total</span>
                    </div>
                    <div className="space-y-4">
                        {dashboardData.customerTypeData.length > 0 ? (
                            dashboardData.customerTypeData.map((item) => (
                                <div key={item.name}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                                            <span className="text-xs text-slate-600 font-medium">{item.name}</span>
                                        </div>
                                        <span className="text-xs font-bold text-slate-800">{item.value}%</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full"
                                            style={{ width: `${item.value}%`, backgroundColor: item.color }}
                                        />
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-slate-400 text-center py-8">No customer data yet</p>
                        )}
                    </div>
                    <button
                        onClick={() => router.push('/analytics/customers')}
                        className="mt-5 text-xs text-[#3A6FA0] hover:text-[#1B2D4F] font-semibold transition-colors"
                    >
                        View insights →
                    </button>
                </div>

                {/* Recent Orders — col-span-8 */}
                <div className="col-span-12 md:col-span-8 bg-white rounded-2xl border border-slate-100 p-5">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-sm font-semibold text-slate-800">Recent Orders</h3>
                        <button
                            onClick={() => router.push('/orders')}
                            className="text-xs text-[#3A6FA0] hover:text-[#1B2D4F] font-semibold transition-colors"
                        >
                            View all →
                        </button>
                    </div>

                    {dashboardData.recentOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
                                <ShoppingCart className="h-5 w-5 text-slate-300" />
                            </div>
                            <p className="text-sm font-medium text-slate-400">No orders yet</p>
                            <p className="text-xs text-slate-300 mt-1">Orders will appear here once placed</p>
                            <Button size="sm" className="mt-4 text-xs h-8 bg-[#1B2D4F] hover:bg-[#16243f] text-white rounded-lg" onClick={handleCreateOrder}>
                                Create first order
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {dashboardData.recentOrders.map((order) => (
                                <div key={order.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer">
                                    <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#1B2D4F] to-[#3A6FA0] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                        {order.customer?.[0]?.toUpperCase() ?? '?'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-800 truncate">{order.customer}</p>
                                        <p className="text-xs text-slate-400">#{order.id.slice(-8).toUpperCase()}</p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-sm font-bold text-slate-900">{formatCurrency(order.amount)}</p>
                                        <span className={cn(
                                            "text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize",
                                            order.status === 'delivered' || order.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                                            order.status === 'shipped' ? 'bg-indigo-50 text-indigo-600' :
                                            order.status === 'processing' ? 'bg-blue-50 text-blue-600' :
                                            order.status === 'pending' ? 'bg-amber-50 text-amber-600' :
                                            order.status === 'cancelled' ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-500'
                                        )}>
                                            {order.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── STOCK ALERTS ─────────────────────────────────── */}
            <StockAlerts />

            {/* ── DIALOGS ──────────────────────────────────────── */}
            <CreateCustomerDialog
                open={showCreateCustomerDialog}
                onOpenChange={setShowCreateCustomerDialog}
                onSuccess={handleCustomerCreated}
            />
            <CreateOrderDialog
                open={showCreateOrderDialog}
                onOpenChange={setShowCreateOrderDialog}
                onSuccess={handleOrderCreated}
            />
            <SendReportDialog
                open={showEmailDialog}
                onOpenChange={setShowEmailDialog}
                onSend={handleSendEmailReport}
            />
        </div>
    );
}
