"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
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
    Area
} from "recharts";
import { ChartContainer, ChartTooltip as RechartsTooltipWrapper, ChartTooltipContent } from "@/components/ui/chart";
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    ShoppingCart,
    Users,
    Package,
    Eye,
    MoreHorizontal,
    ArrowUpRight,
    ArrowDownRight
} from "lucide-react";
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

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Welcome Section */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
                    <p className="text-muted-foreground text-sm sm:text-base">
                        Welcome back! Here&apos;s what&apos;s happening with your store today.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <Button variant={isMobile ? "default" : "outline"} className="w-full sm:w-auto" onClick={() => setShowEmailDialog(true)}>
                        <Mail className="h-4 w-4 mr-2" /> Email Report
                    </Button>
                    {!isMobile && (
                        <Button variant="outline" className="w-full sm:w-auto" onClick={handleDownloadReport}>
                            Download Report
                        </Button>
                    )}
                    <Button variant="outline" onClick={handleViewStore} className="w-full sm:w-auto">
                        <Eye className="h-4 w-4 mr-2" />
                        View Store
                    </Button>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4">
                <Card className="py-2 gap-0 sm:py-2.5 sm:gap-1">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 py-1 pb-0 sm:p-4 sm:pb-1">
                        <CardTitle className="text-[10px] sm:text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-2 pt-0 pb-1 sm:p-4 sm:pt-0">
                        <div className="text-base sm:text-2xl font-bold truncate leading-tight">{formatCompactCurrency(dashboardData.totalRevenue)}</div>
                        <div className="flex flex-wrap items-center text-[10px] sm:text-xs text-muted-foreground sm:mt-1">
                            {dashboardData.revenueChange >= 0 ? (
                                <TrendingUp className="h-3 w-3 mr-1 text-green-500 shrink-0" />
                            ) : (
                                <TrendingDown className="h-3 w-3 mr-1 text-red-500 shrink-0" />
                            )}
                            <span className="hidden sm:inline break-words">{dashboardData.revenueChange >= 0 ? '+' : ''}{dashboardData.revenueChange}% from last month</span>
                            <span className="sm:hidden break-words">{dashboardData.revenueChange >= 0 ? '+' : ''}{dashboardData.revenueChange}%</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="py-2 gap-0 sm:py-2.5 sm:gap-1">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 py-1 pb-0 sm:p-4 sm:pb-1">
                        <CardTitle className="text-[10px] sm:text-sm font-medium">Orders</CardTitle>
                        <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-2 pt-0 pb-1 sm:p-4 sm:pt-0">
                        <div className="text-base sm:text-2xl font-bold truncate leading-tight">+{dashboardData.totalOrders.toLocaleString()}</div>
                        <div className="flex flex-wrap items-center text-[10px] sm:text-xs text-muted-foreground sm:mt-1">
                            {dashboardData.orderChange >= 0 ? (
                                <TrendingUp className="h-3 w-3 mr-1 text-green-500 shrink-0" />
                            ) : (
                                <TrendingDown className="h-3 w-3 mr-1 text-red-500 shrink-0" />
                            )}
                            <span className="hidden sm:inline break-words">{dashboardData.orderChange >= 0 ? '+' : ''}{dashboardData.orderChange}% from last month</span>
                            <span className="sm:hidden break-words">{dashboardData.orderChange >= 0 ? '+' : ''}{dashboardData.orderChange}%</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="py-2 gap-0 sm:py-2.5 sm:gap-1">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 py-1 pb-0 sm:p-4 sm:pb-1">
                        <CardTitle className="text-[10px] sm:text-sm font-medium">Customers</CardTitle>
                        <Users className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-2 pt-0 pb-1 sm:p-4 sm:pt-0">
                        <div className="text-base sm:text-2xl font-bold truncate leading-tight">+{dashboardData.totalCustomers.toLocaleString()}</div>
                        <div className="flex flex-wrap items-center text-[10px] sm:text-xs text-muted-foreground sm:mt-1">
                            {dashboardData.customerChange >= 0 ? (
                                <TrendingUp className="h-3 w-3 mr-1 text-green-500 shrink-0" />
                            ) : (
                                <TrendingDown className="h-3 w-3 mr-1 text-red-500 shrink-0" />
                            )}
                            <span className="hidden sm:inline break-words">{dashboardData.customerChange >= 0 ? '+' : ''}{dashboardData.customerChange}% from last month</span>
                            <span className="sm:hidden break-words">{dashboardData.customerChange >= 0 ? '+' : ''}{dashboardData.customerChange}%</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="py-2 gap-0 sm:py-2.5 sm:gap-1">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 py-1 pb-0 sm:p-4 sm:pb-1">
                        <CardTitle className="text-[10px] sm:text-sm font-medium">Active Products</CardTitle>
                        <Package className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-2 pt-0 pb-1 sm:p-4 sm:pt-0">
                        <div className="text-base sm:text-2xl font-bold truncate leading-tight">{dashboardData.activeProducts.toLocaleString()}</div>
                        <div className="flex flex-wrap items-center text-[10px] sm:text-xs text-muted-foreground sm:mt-1">
                            {dashboardData.productChange >= 0 ? (
                                <TrendingUp className="h-3 w-3 mr-1 text-green-500 shrink-0" />
                            ) : (
                                <TrendingDown className="h-3 w-3 mr-1 text-red-500 shrink-0" />
                            )}
                            <span className="hidden sm:inline break-words">{dashboardData.productChange >= 0 ? '+' : ''}{dashboardData.productChange}% from last month</span>
                            <span className="sm:hidden break-words">{dashboardData.productChange >= 0 ? '+' : ''}{dashboardData.productChange}%</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts and Tables */}
            <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-7">
                {/* Revenue Chart */}
                <Card className="col-span-1 md:col-span-4">
                    <CardHeader>
                        <CardTitle>Revenue Overview</CardTitle>
                        <CardDescription>
                            Monthly revenue and order trends
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer id="revenue-overview" config={{ revenue: { label: "Revenue", color: "hsl(var(--primary))" }, orders: { label: "Orders", color: "hsl(var(--secondary))" } }} className="aspect-auto h-[250px] sm:h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={normalizedSalesData} margin={{ top: 20, right: 10, left: 10, bottom: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                    <YAxis yAxisId="revenue" tick={{ fontSize: 12 }} width={55} tickFormatter={(value) => formatCompactCurrency(value)} />
                                    <YAxis yAxisId="orders" orientation="right" tick={{ fontSize: 12 }} width={35} hide />
                                    <RechartsTooltipWrapper content={
                                        <ChartTooltipContent
                                            formatter={(value, name) => (
                                                <div className="flex flex-1 justify-between items-center leading-none gap-4">
                                                    <span className="text-muted-foreground">{name}</span>
                                                    <span className="text-foreground font-mono font-medium tabular-nums">
                                                        {name === "Revenue" ? formatCompactCurrency(Number(value)) : value.toLocaleString()}
                                                    </span>
                                                </div>
                                            )}
                                        />
                                    } />
                                    <Area
                                        type="monotone"
                                        dataKey="revenue"
                                        yAxisId="revenue"
                                        stroke="hsl(var(--primary))"
                                        fill="hsl(var(--primary))"
                                        fillOpacity={0.2}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="orders"
                                        yAxisId="orders"
                                        stroke="hsl(var(--secondary))"
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </CardContent>
                </Card>

                {/* Customer Distribution */}
                <Card className="col-span-1 md:col-span-3">
                    <CardHeader>
                        <CardTitle>Customer Distribution</CardTitle>
                        <CardDescription>
                            Breakdown by customer type
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer id="customer-distribution" config={{}} className="aspect-auto h-[250px] sm:h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={dashboardData.customerTypeData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={85}
                                        dataKey="value"
                                        label={false}
                                    >
                                        {dashboardData.customerTypeData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltipWrapper
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-sm font-medium">{data.name}</span>
                                                            <span className="text-sm text-muted-foreground">
                                                                {data.count || 0} customers ({data.value}%)
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                        <div className="flex flex-col gap-2 mt-4">
                            {dashboardData.customerTypeData.map((item) => (
                                <div key={item.name} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: item.color }}
                                        />
                                        <span className="text-sm">{item.name}</span>
                                    </div>
                                    <span className="text-sm font-medium">{item.value}%</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tables Section */}
            <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
                {/* Top Products */}
                <Card>
                    <CardHeader>
                        <CardTitle>Top Products</CardTitle>
                        <CardDescription>
                            Best performing products this month
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {dashboardData.topProducts.map((product) => (
                                <div key={product.id} className="flex items-center gap-3 sm:gap-4 overflow-hidden w-full">
                                    <Avatar className="h-10 w-10 sm:h-12 sm:w-12 shrink-0">
                                        <AvatarFallback>{product.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 space-y-1 min-w-0 w-full overflow-hidden">
                                        <div className="flex items-center justify-between gap-2 w-full">
                                            <p className="text-sm font-medium truncate">{product.name}</p>
                                            {product.trend === "up" ? (
                                                <ArrowUpRight className="h-4 w-4 text-green-500 flex-shrink-0" />
                                            ) : (
                                                <ArrowDownRight className="h-4 w-4 text-red-500 flex-shrink-0" />
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                                            <span>{product.sales} sales</span>
                                            <span>{formatCurrency(product.revenue)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground">Stock:</span>
                                            <div className="flex-1">
                                                <Progress value={(product.stock / 100) * 100} className="h-1" />
                                            </div>
                                            <span className="text-xs text-muted-foreground">{product.stock}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Recent Orders */}
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Orders</CardTitle>
                        <CardDescription>
                            Latest orders from your customers
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto -mx-2 px-2">
                            <Table className="min-w-[500px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs sm:text-sm">Order</TableHead>
                                        <TableHead className="text-xs sm:text-sm">Customer</TableHead>
                                        <TableHead className="text-xs sm:text-sm">Amount</TableHead>
                                        <TableHead className="text-xs sm:text-sm">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {dashboardData.recentOrders.map((order) => (
                                        <TableRow key={order.id}>
                                            <TableCell className="font-medium text-xs sm:text-sm">{order.id}</TableCell>
                                            <TableCell>
                                                <div className="min-w-0">
                                                    <div className="font-medium text-xs sm:text-sm truncate">{order.customer}</div>
                                                    <div className="text-xs text-muted-foreground truncate">{order.email}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs sm:text-sm">{formatCurrency(order.amount)}</TableCell>
                                            <TableCell>
                                                <StatusBadge status={order.status} />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Actions and Alerts */}
            <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                        <CardDescription>
                            Common tasks and shortcuts to help you manage your store
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 sm:gap-4 grid-cols-2">
                            <Button
                                variant="outline"
                                className="h-16 sm:h-20 flex-col gap-2"
                                onClick={handleAddProduct}
                            >
                                <Package className="h-5 w-5 sm:h-6 sm:w-6" />
                                <span className="text-sm sm:text-base">Add Product</span>
                            </Button>
                            <Button
                                variant="outline"
                                className="h-16 sm:h-20 flex-col gap-2"
                                onClick={handleAddCustomer}
                            >
                                <Users className="h-5 w-5 sm:h-6 sm:w-6" />
                                <span className="text-sm sm:text-base">Add Customer</span>
                            </Button>
                            <Button
                                variant="outline"
                                className="h-16 sm:h-20 flex-col gap-2"
                                onClick={handleCreateOrder}
                            >
                                <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" />
                                <span className="text-sm sm:text-base">Create Order</span>
                            </Button>
                            <Button
                                variant="outline"
                                className="h-16 sm:h-20 flex-col gap-2"
                                onClick={handleViewReports}
                            >
                                <MoreHorizontal className="h-5 w-5 sm:h-6 sm:w-6" />
                                <span className="text-sm sm:text-base">View Reports</span>
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Stock Alerts */}
                <StockAlerts />
            </div>

            {/* Dialogs */}
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
                title="Send Dashboard Report"
                description="Enter the email address where you want to receive the 30-day performance report."
            />
        </div>
    );
}
