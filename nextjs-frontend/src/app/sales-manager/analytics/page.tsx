'use client';

import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { ProtectedRoute } from '@/contexts/auth-context';
import { api, formatCurrency, type SalesRepPerformance, type SalesRepPerformanceResponse } from '@/lib/api';
import logger from '@/lib/logger';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    ResponsiveContainer,
    Area,
    AreaChart,
    CartesianGrid,
    Tooltip,
    XAxis,
    YAxis,
    BarChart,
    Bar,
    Legend,
} from 'recharts';
import {
    Award,
    DollarSign,
    Users,
    Calendar as CalendarIcon,
    Package,
    TrendingUp,
    ShoppingCart,
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { getPaymentMethodDisplay } from "@/lib/payment-utils";
import { SimpleOrderDetailsDialog } from '@/components/orders/simple-order-details-dialog';

type RangeKey = 'day' | '7d' | '14d' | '30d' | '90d' | '365d' | 'custom';
type SortMetric = 'revenue' | 'orders' | 'assignedCustomers' | 'activeCustomers';

const RANGE_OPTIONS: Array<{ label: string; value: RangeKey }> = [
    { label: '1 Day', value: 'day' },
    { label: 'Last 7 days', value: '7d' },
    { label: 'Last 14 days', value: '14d' },
    { label: 'Last 30 days', value: '30d' },
    { label: 'Last 90 days', value: '90d' },
    { label: 'Last 12 months', value: '365d' },
    { label: 'Custom range', value: 'custom' },
];

const METRIC_OPTIONS: Array<{
    value: SortMetric;
    label: string;
    highLabel: string;
    lowLabel: string;
    getValue: (rep: SalesRepPerformance) => number;
}> = [
        {
            value: 'revenue',
            label: 'Revenue',
            highLabel: 'High revenue',
            lowLabel: 'Low revenue',
            getValue: (rep) => rep.metrics.totalRevenue ?? 0,
        },
        {
            value: 'orders',
            label: 'Orders',
            highLabel: 'High orders',
            lowLabel: 'Low orders',
            getValue: (rep) => rep.metrics.totalOrders ?? 0,
        },
        {
            value: 'assignedCustomers',
            label: 'Assigned Customers',
            highLabel: 'High assigned customers',
            lowLabel: 'Low assigned customers',
            getValue: (rep) => rep.metrics.assignedCustomers ?? 0,
        },
        {
            value: 'activeCustomers',
            label: 'Active Customers',
            highLabel: 'High active customers',
            lowLabel: 'Low active customers',
            getValue: (rep) => rep.metrics.activeCustomers ?? 0,
        },
    ];

export default function SalesManagerAnalyticsPage() {
    const [range, setRange] = useState<RangeKey>('90d');
    const [customFrom, setCustomFrom] = useState<Date | null>(null);
    const [customTo, setCustomTo] = useState<Date | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<SalesRepPerformanceResponse | null>(null);
    const [selectedRepId, setSelectedRepId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [sortMetric, setSortMetric] = useState<SortMetric>('revenue');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [orderDialogOpen, setOrderDialogOpen] = useState(false);

    const loadData = async (
        selectedRange: RangeKey,
        from?: Date | null,
        to?: Date | null
    ) => {
        try {
            setLoading(true);
            setError(null);

            let rangeToSend: any = selectedRange;
            let fromToSend = from;
            let toToSend = to;

            if (selectedRange === 'day' && from) {
                rangeToSend = 'custom';
                fromToSend = new Date(from);
                fromToSend.setHours(0, 0, 0, 0);
                toToSend = new Date(from);
                toToSend.setHours(23, 59, 59, 999);
            }

            const response = await api.getSalesRepPerformance(
                rangeToSend,
                fromToSend ?? undefined,
                toToSend ?? undefined
            );

            if (!response.success || !response.data) {
                throw new Error(response.error || 'Unable to load sales team analytics.');
            }
            const result = response.data;
            setData(result);

        } catch (err: any) {
            logger.error('Unable to load sales team analytics:', { error: err });
            setError(err?.message || 'Unable to load sales team analytics.');
            setData(null);
            toast.error('Failed to load analytics');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (range === 'custom') {
            if (!customFrom || !customTo) return;
            loadData(range, customFrom, customTo);
        } else if (range === 'day') {
            if (!customFrom) return;
            loadData(range, customFrom);
        } else {
            loadData(range);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [range, customFrom, customTo]);

    const currentMetricOption =
        METRIC_OPTIONS.find((option) => option.value === sortMetric) ??
        METRIC_OPTIONS[0];

    const filteredSortedReps = useMemo(() => {
        if (!data) return [];
        const query = searchQuery.trim().toLowerCase();
        const filtered = data.reps.filter((rep) => {
            if (!query) return true;
            const name = `${rep.user.firstName ?? ''} ${rep.user.lastName ?? ''}`
                .trim()
                .toLowerCase();
            const email = (rep.user.email ?? '').toLowerCase();
            return name.includes(query) || email.includes(query);
        });

        const sorter = currentMetricOption.getValue;
        return filtered.sort((a, b) => {
            const aValue = sorter(a);
            const bValue = sorter(b);
            if (sortDirection === 'desc') {
                return bValue - aValue;
            }
            return aValue - bValue;
        });
    }, [data, searchQuery, currentMetricOption, sortDirection]);

    // Auto-select first rep from filtered/sorted list
    useEffect(() => {
        if (filteredSortedReps.length > 0) {
            // If no rep is selected, or the selected rep is not in the filtered list, select the first one
            if (!selectedRepId || !filteredSortedReps.find(r => r.salesRepId === selectedRepId)) {
                setSelectedRepId(filteredSortedReps[0].salesRepId);
            }
        } else {
            setSelectedRepId(null);
        }
    }, [filteredSortedReps, selectedRepId]);

    const selectedRep: SalesRepPerformance | null = useMemo(() => {
        if (!data || !selectedRepId) return null;
        return data.reps.find((rep) => rep.salesRepId === selectedRepId) ?? null;
    }, [data, selectedRepId]);

    // Aggregate monthly performance for All Reps
    const aggregateMonthlyPerformance = useMemo(() => {
        if (!data || !data.reps) return [];
        const monthlyData: Record<string, { month: string; revenue: number; orders: number }> = {};

        data.reps.forEach(rep => {
            rep.monthlyPerformance?.forEach(m => {
                if (!monthlyData[m.month]) {
                    monthlyData[m.month] = { month: m.month, revenue: 0, orders: 0 };
                }
                monthlyData[m.month].revenue += m.revenue;
                monthlyData[m.month].orders += m.orders;
            });
        });

        return Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
    }, [data]);

    const handleRetry = () => {
        if (range === 'custom') {
            if (!customFrom || !customTo) return;
            loadData(range, customFrom, customTo);
        } else if (range === 'day') {
            if (!customFrom) return;
            loadData(range, customFrom);
        } else {
            loadData(range);
        }
    };

    const disableRefresh =
        loading || (range === 'custom' && (!customFrom || !customTo)) || (range === 'day' && !customFrom);

    return (
        <ProtectedRoute requiredRoles={['SALES_MANAGER', 'ADMIN']}>
            <DashboardLayout>
                <div className="space-y-6 pb-10">
                    {/* Header */}
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                                Team Performance Analytics
                            </h1>
                            <p className="text-sm text-muted-foreground md:text-base">
                                Comprehensive view of your sales team's performance, revenue trends, and customer engagement.
                            </p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Select
                                value={range}
                                onValueChange={(value) => setRange(value as RangeKey)}
                            >
                                <SelectTrigger className="w-full sm:w-40">
                                    <SelectValue placeholder="Select range" />
                                </SelectTrigger>
                                <SelectContent>
                                    {RANGE_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {range === 'day' && (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-full justify-start sm:w-44 text-left font-normal"
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {customFrom ? customFrom.toLocaleDateString() : 'Select date'}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <CalendarPicker
                                            mode="single"
                                            selected={customFrom ?? undefined}
                                            onSelect={(date) => setCustomFrom(date ?? null)}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            )}
                            {range === 'custom' && (
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="w-full justify-start sm:w-44">
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {customFrom ? customFrom.toLocaleDateString() : 'From date'}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="p-0" align="start">
                                            <CalendarPicker
                                                mode="single"
                                                selected={customFrom ?? undefined}
                                                onSelect={(date) => setCustomFrom(date ?? null)}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="w-full justify-start sm:w-44">
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {customTo ? customTo.toLocaleDateString() : 'To date'}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="p-0" align="start">
                                            <CalendarPicker
                                                mode="single"
                                                selected={customTo ?? undefined}
                                                onSelect={(date) => setCustomTo(date ?? null)}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            )}
                            <Button
                                variant="outline"
                                onClick={handleRetry}
                                disabled={disableRefresh}
                            >
                                Refresh
                            </Button>
                        </div>
                    </div>

                    {loading ? (
                        <Card>
                            <CardContent className="flex items-center justify-center py-16">
                                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                                    <LoadingSpinner size={24} />
                                    <span className="text-sm">Loading performance data…</span>
                                </div>
                            </CardContent>
                        </Card>
                    ) : error ? (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-red-600">Failed to load analytics</CardTitle>
                                <CardDescription>{error}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button onClick={handleRetry}>Try again</Button>
                            </CardContent>
                        </Card>
                    ) : !data || data.reps.length === 0 ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>No sales representatives found</CardTitle>
                                <CardDescription>
                                    You don't have any assigned sales representatives with data for this period.
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    ) : (
                        <>
                            {/* Team Overview Cards */}
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Team Total Revenue</CardTitle>
                                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">
                                            {formatCurrency(data.totals.totalRevenue)}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Across {data.reps.length} sales rep{data.reps.length !== 1 ? 's' : ''}
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{Math.round(data.totals.totalOrders)}</div>
                                        <p className="text-xs text-muted-foreground">
                                            {data.totals.averageConversion.toFixed(1)}% conversion rate
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Active Reps</CardTitle>
                                        <Award className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{data.totals.repsActive}</div>
                                        <p className="text-xs text-muted-foreground">
                                            With active customers
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card className={cn(selectedRep ? 'border-primary/50 bg-primary/5' : '')}>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Selected Rep</CardTitle>
                                        <Users className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-lg font-bold truncate">
                                            {selectedRep ? `${selectedRep.user.firstName} ${selectedRep.user.lastName}` : 'Team Overview'}
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {selectedRep ? formatCurrency(selectedRep.metrics.totalRevenue) : 'Select a rep below'}
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Sales Reps Performance Table - MOVED UP */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Sales Representatives Overview</CardTitle>
                                    <CardDescription>
                                        Detailed performance metrics for each member of your team. Click a row to view customer details.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="overflow-x-auto">
                                    <div className="flex flex-col gap-3 pb-4 md:flex-row md:items-center md:justify-between">
                                        <Input
                                            placeholder="Search your team..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full md:max-w-sm"
                                        />
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                            <Select
                                                value={sortMetric}
                                                onValueChange={(value) => setSortMetric(value as SortMetric)}
                                            >
                                                <SelectTrigger className="w-full sm:w-48">
                                                    <SelectValue placeholder="Sort metric" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {METRIC_OPTIONS.map((option) => (
                                                        <SelectItem key={option.value} value={option.value}>
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Select
                                                value={sortDirection}
                                                onValueChange={(value) =>
                                                    setSortDirection(value as 'asc' | 'desc')
                                                }
                                            >
                                                <SelectTrigger className="w-full sm:w-48">
                                                    <SelectValue placeholder="Sort order" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="desc">
                                                        {currentMetricOption.highLabel}
                                                    </SelectItem>
                                                    <SelectItem value="asc">
                                                        {currentMetricOption.lowLabel}
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Sales Rep</TableHead>
                                                <TableHead className="hidden xl:table-cell">Status</TableHead>
                                                <TableHead>Revenue</TableHead>
                                                <TableHead>Orders</TableHead>
                                                <TableHead>Avg. Order</TableHead>
                                                <TableHead>Customers</TableHead>
                                                <TableHead>Active</TableHead>
                                                <TableHead className="hidden xl:table-cell">Conversion</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredSortedReps.length === 0 ? (
                                                <TableRow>
                                                    <TableCell
                                                        colSpan={8}
                                                        className="py-10 text-center text-sm text-muted-foreground"
                                                    >
                                                        No sales reps match your current filters.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                filteredSortedReps.map((rep) => (
                                                    <TableRow
                                                        key={rep.salesRepId}
                                                        className={cn(
                                                            'cursor-pointer hover:bg-muted/50 transition-colors',
                                                            selectedRepId === rep.salesRepId && 'bg-primary/10 border-l-4 border-primary'
                                                        )}
                                                        onClick={() => setSelectedRepId(rep.salesRepId)}
                                                    >
                                                        <TableCell>
                                                            <div className="flex flex-col">
                                                                <span className={cn('font-medium', selectedRepId === rep.salesRepId && 'text-primary')}>
                                                                    {rep.user.firstName} {rep.user.lastName}
                                                                </span>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {rep.user.email}
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="hidden xl:table-cell">
                                                            <Badge variant={rep.user.isActive ? 'outline' : 'destructive'}>
                                                                {rep.user.isActive ? 'Active' : 'Inactive'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="font-medium">
                                                            {formatCurrency(rep.metrics.totalRevenue)}
                                                        </TableCell>
                                                        <TableCell>{Math.round(rep.metrics.totalOrders)}</TableCell>
                                                        <TableCell>
                                                            {formatCurrency(rep.metrics.averageOrderValue)}
                                                        </TableCell>
                                                        <TableCell>{Math.round(rep.metrics.assignedCustomers)}</TableCell>
                                                        <TableCell>
                                                            <Badge variant="secondary">
                                                                {Math.round(rep.metrics.activeCustomers)}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="hidden xl:table-cell">
                                                            <div className="flex items-center gap-2">
                                                                <div className="text-sm">
                                                                    {rep.metrics.conversionRate.toFixed(1)}%
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>

                            {/* Main Analytics Section */}
                            <div className="grid gap-6 xl:grid-cols-3">
                                {/* Revenue Trend Chart */}
                                <Card className="xl:col-span-2">
                                    <CardHeader>
                                        <CardTitle>Revenue Trend</CardTitle>
                                        <CardDescription>
                                            {selectedRep
                                                ? `Monthly performance for ${selectedRep.user.firstName} ${selectedRep.user.lastName}`
                                                : `Aggregate team performance (${data.reps.length} reps)`
                                            }
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="h-[350px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={selectedRep ? selectedRep.monthlyPerformance : aggregateMonthlyPerformance}>
                                                    <defs>
                                                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                                                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                    <XAxis
                                                        dataKey="month"
                                                        tickFormatter={(value) => {
                                                            if (!value) return '';
                                                            const [year, month] = value.split('-');
                                                            return `${month}/${year.slice(2)}`;
                                                        }}
                                                        fontSize={12}
                                                        tickLine={false}
                                                        axisLine={false}
                                                    />
                                                    <YAxis
                                                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                                                        fontSize={12}
                                                        tickLine={false}
                                                        axisLine={false}
                                                    />
                                                    <Tooltip
                                                        formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                                                        labelFormatter={(label) => `Month: ${label}`}
                                                    />
                                                    <Area
                                                        type="monotone"
                                                        dataKey="revenue"
                                                        stroke="hsl(var(--primary))"
                                                        fillOpacity={1}
                                                        fill="url(#colorRevenue)"
                                                    />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Top Customers Panel */}
                                <div className="xl:col-span-1">
                                    {selectedRep ? (
                                        <Card className="h-full flex flex-col">
                                            <CardHeader>
                                                <CardTitle>Top Customers</CardTitle>
                                                <CardDescription>
                                                    Highest revenue for {selectedRep.user.firstName}
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="flex-1 overflow-hidden">
                                                <div className="h-[350px] overflow-y-auto pr-2 space-y-3">
                                                    {selectedRep.topCustomers.length === 0 ? (
                                                        <div className="h-full flex flex-col items-center justify-center text-sm text-muted-foreground p-4">
                                                            <Users className="h-8 w-8 mb-2 opacity-20" />
                                                            <p>No customer orders found</p>
                                                        </div>
                                                    ) : (
                                                        selectedRep.topCustomers.map((customer, index) => (
                                                            <div
                                                                key={customer.id}
                                                                className="flex items-start justify-between border-b pb-3 last:border-0"
                                                            >
                                                                <div className="flex-1 min-w-0 mr-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <Badge variant="outline" className="text-xs">
                                                                            #{index + 1}
                                                                        </Badge>
                                                                        <span className="font-medium text-sm truncate" title={customer.name}>
                                                                            {customer.name}
                                                                        </span>
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground truncate mt-1" title={customer.email}>
                                                                        {customer.email}
                                                                    </div>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <Badge variant="secondary" className="text-xs">
                                                                            {customer.orders} order{customer.orders !== 1 ? 's' : ''}
                                                                        </Badge>
                                                                        {customer.lastOrderDate && (
                                                                            <span className="text-xs text-muted-foreground">
                                                                                Last: {new Date(customer.lastOrderDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="text-right flex-shrink-0">
                                                                    <div className="font-bold text-sm text-primary">
                                                                        {formatCurrency(customer.revenue)}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ) : (
                                        <Card className="h-full flex items-center justify-center bg-muted/20">
                                            <CardContent className="text-center p-6">
                                                <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                                <h3 className="text-lg font-semibold mb-2">Select a Sales Rep</h3>
                                                <p className="text-muted-foreground text-sm">
                                                    Click on any sales representative in the table above to view their detailed customer analytics and revenue breakdown.
                                                </p>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            </div>

                            {/* Orders Breakdown Chart (for selected rep) */}
                            {selectedRep && selectedRep.monthlyPerformance.length > 0 && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Orders & Revenue Breakdown</CardTitle>
                                        <CardDescription>
                                            Monthly orders and revenue for {selectedRep.user.firstName} {selectedRep.user.lastName}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="h-[300px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={selectedRep.monthlyPerformance}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                    <XAxis
                                                        dataKey="month"
                                                        tickFormatter={(value) => {
                                                            if (!value) return '';
                                                            const [year, month] = value.split('-');
                                                            return `${month}/${year.slice(2)}`;
                                                        }}
                                                        fontSize={12}
                                                        tickLine={false}
                                                        axisLine={false}
                                                    />
                                                    <YAxis
                                                        yAxisId="left"
                                                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                                                        fontSize={12}
                                                        tickLine={false}
                                                        axisLine={false}
                                                    />
                                                    <YAxis
                                                        yAxisId="right"
                                                        orientation="right"
                                                        fontSize={12}
                                                        tickLine={false}
                                                        axisLine={false}
                                                        tickFormatter={(value) => Math.round(value).toString()}
                                                    />
                                                    <Tooltip
                                                        formatter={(value: number, name: string) => {
                                                            if (name === 'Revenue') return [formatCurrency(value), 'Revenue'];
                                                            return [Math.round(value), 'Orders'];
                                                        }}
                                                        labelFormatter={(label) => `Month: ${label}`}
                                                    />
                                                    <Legend />
                                                    <Bar yAxisId="left" dataKey="revenue" fill="hsl(var(--primary))" name="Revenue" />
                                                    <Bar yAxisId="right" dataKey="orders" fill="hsl(var(--chart-2))" name="Orders" />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Recent Orders for Selected Rep */}
                            {selectedRep && selectedRep.recentOrders && selectedRep.recentOrders.length > 0 && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Recent Orders</CardTitle>
                                        <CardDescription>
                                            Latest orders from {selectedRep.user.firstName}'s customers
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Order #</TableHead>
                                                    <TableHead>Customer</TableHead>
                                                    <TableHead>Amount</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>Payment</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {selectedRep.recentOrders.map((order) => (
                                                    <TableRow
                                                        key={order.id}
                                                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                                                        onClick={() => {
                                                            setSelectedOrder(order);
                                                            setOrderDialogOpen(true);
                                                        }}
                                                    >
                                                        <TableCell className="font-medium">
                                                            {order.orderNumber}
                                                        </TableCell>
                                                        <TableCell>{order.customerName}</TableCell>
                                                        <TableCell>{formatCurrency(order.totalAmount)}</TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline">{order.status}</Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            {new Date(order.createdAt).toLocaleDateString()}
                                                        </TableCell>
                                                        <Badge variant="outline" className="whitespace-nowrap">
                                                            {getPaymentMethodDisplay(order as any)}
                                                        </Badge>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            )}
                        </>
                    )}
                </div>
            </DashboardLayout>

            {/* Order Details Dialog */}
            <SimpleOrderDetailsDialog
                order={selectedOrder}
                open={orderDialogOpen}
                onClose={() => {
                    setOrderDialogOpen(false);
                    setSelectedOrder(null);
                }}
            />
        </ProtectedRoute>
    );
}
