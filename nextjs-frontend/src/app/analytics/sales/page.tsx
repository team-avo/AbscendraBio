"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { getPaymentMethodDisplay } from "@/lib/payment-utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPrimitive } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Download, Eye, Mail, FileSpreadsheet, DollarSign, ShoppingCart, Target, TrendingUp, TrendingDown, BarChart2, MapPin, ClipboardList, LineChart as LineChartIcon } from "lucide-react";
import { api, formatCurrency, Order } from "@/lib/api";
import logger from "@/lib/logger";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EditOrderDialog } from "@/components/orders/edit-order-dialog";
import { OrderDateFilter } from "@/components/orders/order-date-filter";
import { SendReportDialog } from "@/components/shared/send-report-dialog";
import { SalesLogs } from "./sales-logs";
import { IndependentSalesRepsReport } from "./independent-sales-reps-report";
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { Skeleton } from "@/components/ui/skeleton";

const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return '';
    if (typeof dateStr !== 'string') return String(dateStr);

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

const BREAKDOWN_PAGE_SIZE = 10;

export default function SalesReportsPage() {
    const isMobile = useIsMobile();
    const [range, setRange] = useState("last_30_days");
    const [from, setFrom] = useState<Date | null>(null);
    const [to, setTo] = useState<Date | null>(null);
    const [salesChannelId, setSalesChannelId] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>({ totalRevenue: 0, totalOrders: 0, daily: [] });
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showEmailDialog, setShowEmailDialog] = useState(false);

    const [breakdownPage, setBreakdownPage] = useState(1);

    const dailyItems = useMemo(() => {
        const items = [...(data.daily || [])];
        return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [data.daily]);
    const totalBreakdownPages = useMemo(
        () => Math.max(1, Math.ceil(dailyItems.length / BREAKDOWN_PAGE_SIZE)),
        [dailyItems.length]
    );
    const paginatedDaily = useMemo(
        () => dailyItems.slice((breakdownPage - 1) * BREAKDOWN_PAGE_SIZE, breakdownPage * BREAKDOWN_PAGE_SIZE),
        [dailyItems, breakdownPage]
    );

    useEffect(() => { setBreakdownPage(1); }, [data]);

    const [showDayDetailsDialog, setShowDayDetailsDialog] = useState(false);
    const [dayOrders, setDayOrders] = useState<Order[]>([]);
    const [dayDetailsLoading, setDayDetailsLoading] = useState(false);
    const [selectedDayDate, setSelectedDayDate] = useState<string>("");

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                let rangeToSend = range;
                let fromToSend = from;
                let toToSend = to;

                if (range === 'day') {
                    rangeToSend = 'custom';
                    fromToSend = from || new Date();
                    toToSend = fromToSend;
                } else if (range === 'custom' && from) {
                    fromToSend = from;
                    toToSend = to || from;
                }

                const requestDetailed = range === 'day';
                const res = await api.getSalesReports(
                    rangeToSend as any,
                    fromToSend || undefined,
                    toToSend || undefined,
                    requestDetailed,
                    salesChannelId,
                    true
                );
                logger.debug("[SalesReports] API response:", { response: res });
                if (res.success && res.data) {
                    setData(res.data);
                } else {
                    toast.error(res.error || "Failed to load sales reports");
                    setData({ totalRevenue: 0, totalOrders: 0, daily: [] });
                }
            } catch (e: any) {
                logger.error("[SalesReports] API error:", { error: e });
                toast.error(e?.message || "Failed to load sales reports");
                setData({ totalRevenue: 0, totalOrders: 0, daily: [] });
            } finally {
                setLoading(false);
            }
        })();
    }, [range, from, to, salesChannelId]);

    const [selectedState, setSelectedState] = useState<string>("ALL");
    const [selectedCity, setSelectedCity] = useState<string>("ALL");
    const [regionData, setRegionData] = useState<any[]>([]);
    const [regionLoading, setRegionLoading] = useState(false);
    const [filters, setFilters] = useState<{ states: string[], citiesByState: Record<string, string[]> }>({ states: [], citiesByState: {} });

    useEffect(() => {
        (async () => {
            try {
                const res = await api.getSalesRegionFilters();
                if (res.success && res.data) {
                    setFilters(res.data);
                }
            } catch (e) {
                logger.error("Failed to fetch region filters", { error: e });
            }
        })();
    }, []);

    useEffect(() => {
        (async () => {
            try {
                setRegionLoading(true);
                let rangeToSend = range;
                let fromToSend = from;
                let toToSend = to;

                if (range === 'day') {
                    rangeToSend = 'custom';
                    fromToSend = from || new Date();
                    toToSend = fromToSend;
                } else if (range === 'custom' && from) {
                    fromToSend = from;
                    toToSend = to || from;
                }

                const stateParam = selectedState !== "ALL" ? selectedState : undefined;
                const cityParam = selectedCity !== "ALL" ? selectedCity : undefined;

                const res = await api.getSalesByRegion(
                    rangeToSend as any,
                    fromToSend || undefined,
                    toToSend || undefined,
                    stateParam,
                    cityParam,
                    salesChannelId
                );
                if (res.success && res.data) {
                    setRegionData(res.data);
                } else {
                    setRegionData([]);
                }
            } catch (e: any) {
                logger.error("Region fetch error:", { error: e });
                setRegionData([]);
            } finally {
                setRegionLoading(false);
            }
        })();
    }, [range, from, to, selectedState, selectedCity, salesChannelId]);

    const handleExportAll = async () => {
        let page = 1;
        const limit = 100;
        let pages = 1;
        const all: Order[] = [];

        let fromToSend = from;
        let toToSend = to;

        if (range === 'day' || (range === 'custom' && from)) {
            fromToSend = from || new Date();
            toToSend = (range === 'custom' && to) ? to : fromToSend;
        }

        try {
            setLoading(true);

            const summaryData = (data.daily || []).map((d: any) => ({
                'Date': d.date,
                'Revenue ($)': Number(d.revenue || 0).toFixed(2),
                'Orders Count': d.orders || 0
            }));

            do {
                const res: any = await api.getOrders({
                    page,
                    limit,
                    dateFrom: fromToSend?.toISOString(),
                    dateTo: toToSend?.toISOString(),
                    salesChannelId: salesChannelId,
                    usePSTFilter: true,
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

            const filteredAll = all.filter(o => o.status !== 'CANCELLED' && o.status !== 'REFUNDED');

            const detailedData = filteredAll.map(order => ({
                'Order ID': order.orderNumber || order.id,
                'Customer Name': order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : 'Guest',
                'Customer Email': order.customer?.email || 'N/A',
                'Status': order.status,
                'Total Amount': `$${Number(order.totalAmount || 0).toFixed(2)}`,
                'Payment Method': getPaymentMethodDisplay(order),
                'Created Date': order.createdAt ? format(new Date(order.createdAt), 'MMM d, yyyy, hh:mm a') : '',
                'Updated Date': order.updatedAt ? format(new Date(order.updatedAt), 'MMM d, yyyy, hh:mm a') : '',
            }));

            const wb = XLSX.utils.book_new();
            const wsSummary = XLSX.utils.json_to_sheet(summaryData);
            XLSX.utils.book_append_sheet(wb, wsSummary, 'Sales Summary');
            const wsDetailed = XLSX.utils.json_to_sheet(detailedData);
            XLSX.utils.book_append_sheet(wb, wsDetailed, 'Order Details');

            const fileName = `sales-analytics-export-${range}-${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, fileName);
            toast.success(`Exported ${summaryData.length} summary rows and ${filteredAll.length} detailed orders`);
        } catch (e) {
            logger.error('Export all failed:', { error: e });
            toast.error('Failed to export data');
        } finally {
            setLoading(false);
        }
    };

    const handleSendEmailReport = async (email: string) => {
        let rangeToSend = range;
        let fromToSend = from;
        let toToSend = to;

        if (range === 'day' || (range === 'custom' && from)) {
            if (range === 'day') rangeToSend = 'custom';
            fromToSend = from || new Date();
            toToSend = (range === 'custom' && to) ? to : fromToSend;
        }

        return api.sendSalesEmailReport({
            email,
            range: rangeToSend,
            from: fromToSend?.toISOString(),
            to: toToSend?.toISOString(),
            usePSTFilter: true,
        });
    };

    const handleRowClick = async (orderId: string) => {
        if (!orderId) return;
        try {
            setLoading(true);
            const res = await api.getOrder(orderId);
            if (res.success && res.data) {
                setEditingOrder(res.data);
                setShowEditDialog(true);
            } else {
                toast.error("Failed to load order details");
            }
        } catch (error) {
            logger.error("Failed to load order:", { error });
            toast.error("Failed to load order details");
        } finally {
            setLoading(false);
        }
    };

    const handleDayClick = async (dateStr: string) => {
        if (!dateStr || range === 'day') return;

        setSelectedDayDate(dateStr);
        setDayDetailsLoading(true);
        setShowDayDetailsDialog(true);
        setDayOrders([]);

        try {
            const res = await api.getOrders({
                dateFrom: dateStr,
                dateTo: dateStr,
                usePSTFilter: true,
                salesChannelId: salesChannelId,
                excludeFailedPayments: true,
                limit: 100
            });

            if (res.success && res.data && res.data.orders) {
                const filteredOrders = (res.data.orders as Order[]).filter(
                    (o) => o.status !== 'CANCELLED' && o.status !== 'REFUNDED'
                );
                setDayOrders(filteredOrders);
            } else {
                toast.error("Failed to load orders for this day");
            }
        } catch (e) {
            logger.error("Failed to fetch day orders:", { error: e });
            toast.error("Failed to load orders");
        } finally {
            setDayDetailsLoading(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-0">
                {/* ════════ DARK HERO STRIP ════════ */}
                <div className="relative bg-[#070B14] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
                  <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                  <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#4D7DF2]/8 rounded-full blur-[100px] pointer-events-none" />
                  <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <h1 className="text-xl font-black text-white tracking-tight">Sales Reports</h1>
                        <p className="text-xs text-gray-500 mt-0.5">Revenue and order trends</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <OrderDateFilter
                          range={range}
                          setRange={setRange}
                          from={from || undefined}
                          setFrom={(d) => setFrom(d || null)}
                          to={to || undefined}
                          setTo={(d) => setTo(d || null)}
                          salesChannelId={salesChannelId}
                          onSalesChannelChange={setSalesChannelId}
                        />
                        <div className="flex items-center gap-2">
                          {!isMobile && (
                            <button onClick={handleExportAll} className="flex items-center gap-1.5 h-9 px-3 bg-white text-[#070B14] rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-100 transition-colors">
                              <FileSpreadsheet className="h-3.5 w-3.5" />
                              Export
                            </button>
                          )}
                          <button onClick={() => setShowEmailDialog(true)} className="flex items-center gap-1.5 h-9 px-3 bg-white/[0.06] border border-white/[0.08] rounded-xl text-xs font-bold text-gray-300 hover:bg-white/[0.12] hover:text-white transition-colors">
                            <Mail className="h-3.5 w-3.5" />
                            Email
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <Tabs defaultValue="overview" className="space-y-5">
                    <div className="w-full overflow-x-auto scrollbar-hide">
                        <TabsList className="flex items-center justify-start w-max h-auto p-1 bg-muted gap-1 min-h-[40px]">
                            <TabsTrigger value="overview" className="whitespace-nowrap py-2 px-4 text-xs sm:text-sm">Overview</TabsTrigger>
                            <TabsTrigger value="regional" className="whitespace-nowrap py-2 px-4 text-xs sm:text-sm">Regional Sales</TabsTrigger>
                            <TabsTrigger value="logs" className="whitespace-nowrap py-2 px-4 text-xs sm:text-sm">Sales Logs</TabsTrigger>
                            <TabsTrigger value="independent-reps" className="whitespace-nowrap py-2 px-4 text-xs sm:text-sm">Independent Sales Rep Report</TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="overview" className="space-y-5">
                        {/* Stat chips */}
                        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                            <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-200/80 shadow-sm px-5 py-4">
                                <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-emerald-50 shrink-0">
                                    <DollarSign className="h-5 w-5 text-emerald-600" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs text-slate-500 font-medium">Total Revenue</p>
                                    {loading ? (
                                        <Skeleton className="h-7 w-24 mt-1" />
                                    ) : (
                                        <p className="text-xl font-bold text-slate-800 truncate">{formatCurrency(data.totalRevenue || 0)}</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-200/80 shadow-sm px-5 py-4">
                                <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-blue-50 shrink-0">
                                    <ShoppingCart className="h-5 w-5 text-blue-600" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs text-slate-500 font-medium">Total Orders</p>
                                    {loading ? (
                                        <Skeleton className="h-7 w-16 mt-1" />
                                    ) : (
                                        <p className="text-xl font-bold text-slate-800 truncate">{(data.totalOrders || 0).toLocaleString()}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Revenue Trend chart */}
                        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-blue-50">
                                    <LineChartIcon className="h-4 w-4 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">Revenue Trend</p>
                                    <p className="text-xs text-slate-500">Daily revenue</p>
                                </div>
                            </div>
                            <div className="p-4 sm:p-6">
                                {loading ? (
                                    <Skeleton className="w-full h-[320px]" />
                                ) : (
                                    <>
                                        {((data.chartData || data.daily) || []).length === 0 && (
                                            <div className="text-sm text-muted-foreground mb-2">No revenue data available</div>
                                        )}
                                        {((data.chartData || data.daily) || []).length > 0 && (
                                            <div className="text-xs text-muted-foreground mb-2">
                                                Showing {((data.chartData || data.daily) || []).length} data points
                                            </div>
                                        )}
                                        <ResponsiveContainer width="100%" height={320}>
                                            <LineChart data={data.chartData || data.daily || []}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="date" tickFormatter={formatDateLabel} tick={{ fontSize: 12 }} />
                                                <YAxis tickFormatter={(value) => `$${Math.round(value)}`} tick={{ fontSize: 12 }} />
                                                <Tooltip
                                                    labelFormatter={formatDateLabel}
                                                    formatter={(value) => [`$${Math.round(Number(value)).toLocaleString()}`, 'Revenue']}
                                                    contentStyle={{ background: 'var(--popover)', color: 'var(--popover-foreground)', border: '1px solid var(--border)' }}
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
                            </div>
                        </div>

                        {/* Orders per Day chart */}
                        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-violet-50">
                                    <BarChart2 className="h-4 w-4 text-violet-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">Orders per Day</p>
                                    <p className="text-xs text-slate-500">Daily order count</p>
                                </div>
                            </div>
                            <div className="p-4 sm:p-6">
                                {loading ? (
                                    <Skeleton className="w-full h-[320px]" />
                                ) : (
                                    <ResponsiveContainer width="100%" height={320}>
                                        <BarChart data={data.chartData || data.daily || []}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="date" tickFormatter={formatDateLabel} />
                                            <YAxis />
                                            <Tooltip
                                                labelFormatter={formatDateLabel}
                                                contentStyle={{ background: 'var(--popover)', color: 'var(--popover-foreground)', border: '1px solid var(--border)' }}
                                            />
                                            <Bar dataKey="orders" fill="hsl(var(--primary))" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>

                        {/* Daily Breakdown table */}
                        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-amber-50">
                                    <ClipboardList className="h-4 w-4 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">Daily Breakdown</p>
                                    <p className="text-xs text-slate-500">{data.detailed ? 'Individual orders' : 'Aggregated by time period'}</p>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <Table className="min-w-[700px]">
                                    <TableHeader>
                                        <TableRow>
                                            {data.detailed ? (
                                                <>
                                                    <TableHead>Order Number</TableHead>
                                                    <TableHead>Customer</TableHead>
                                                    <TableHead>Date/Time</TableHead>
                                                    <TableHead>Revenue</TableHead>
                                                </>
                                            ) : (
                                                <>
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>Revenue</TableHead>
                                                    <TableHead>Orders</TableHead>
                                                </>
                                            )}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            Array.from({ length: 5 }).map((_, i) => (
                                                <TableRow key={i}>
                                                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                                    {data.detailed && <Skeleton className="h-4 w-24" />}
                                                </TableRow>
                                            ))
                                        ) : data.detailed ? (
                                            paginatedDaily.map((d: any) => (
                                                <TableRow
                                                    key={d.orderId}
                                                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                                                    onClick={() => handleRowClick(d.orderId)}
                                                >
                                                    <TableCell className="whitespace-nowrap font-medium">{d.orderNumber}</TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{d.customerName}</span>
                                                            <span className="text-xs text-muted-foreground">{d.customerEmail}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="whitespace-nowrap">{formatDateLabel(d.date)}</TableCell>
                                                    <TableCell>{formatCurrency(d.revenue)}</TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            paginatedDaily.map((d: any) => (
                                                <TableRow
                                                    key={d.date}
                                                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                                                    onClick={() => handleDayClick(d.date)}
                                                >
                                                    <TableCell className="whitespace-nowrap">{formatDateLabel(d.date)}</TableCell>
                                                    <TableCell>{formatCurrency(d.revenue)}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            {d.orders}
                                                            <Eye className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                                {totalBreakdownPages > 1 && (
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t">
                                        <div className="text-sm text-muted-foreground">
                                            Page {breakdownPage} of {totalBreakdownPages} ({dailyItems.length} entries)
                                        </div>
                                        <Pagination
                                            currentPage={breakdownPage}
                                            totalPages={totalBreakdownPages}
                                            onPageChange={setBreakdownPage}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="regional" className="space-y-5">
                        {/* Filter bar */}
                        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-4 space-y-3">
                            <div className="grid grid-cols-2 sm:flex sm:flex-row gap-3">
                                <div className="w-full sm:w-[200px]">
                                    <Select value={selectedState} onValueChange={(v) => { setSelectedState(v); setSelectedCity("ALL"); }}>
                                        <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
                                        <SelectContent className="max-h-[300px]">
                                            <SelectItem value="ALL">All States</SelectItem>
                                            {filters.states.map((s) => (
                                                <SelectItem key={s} value={s}>{s}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-full sm:w-[200px]">
                                    <Select value={selectedCity} onValueChange={setSelectedCity} disabled={selectedState === "ALL"}>
                                        <SelectTrigger><SelectValue placeholder="City" /></SelectTrigger>
                                        <SelectContent className="max-h-[300px]">
                                            <SelectItem value="ALL">All Cities</SelectItem>
                                            {selectedState !== "ALL" && (filters.citiesByState[selectedState] || []).map((c) => (
                                                <SelectItem key={c} value={c}>{c}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-5 lg:grid-cols-2">
                            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-blue-50">
                                        <MapPin className="h-4 w-4 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">Regional Distribution</p>
                                        <p className="text-xs text-slate-500">Sales by {selectedState === 'ALL' ? 'State' : 'City'}</p>
                                    </div>
                                </div>
                                <div className="p-4 sm:p-6">
                                    {regionLoading ? (
                                        <Skeleton className="w-full h-[300px]" />
                                    ) : (
                                        <div className="h-[300px]">
                                            {regionData.length === 0 ? (
                                                <div className="flex h-full items-center justify-center text-muted-foreground">No data found</div>
                                            ) : (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart layout="vertical" data={regionData.slice(0, 10)}>
                                                        <CartesianGrid strokeDasharray="3 3" />
                                                        <XAxis type="number" />
                                                        <YAxis type="category" dataKey="region" width={100} tick={{ fontSize: 10 }} />
                                                        <Tooltip formatter={(val: number) => [val, 'Orders']} />
                                                        <Bar dataKey="orders" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-emerald-50">
                                        <ClipboardList className="h-4 w-4 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">Details</p>
                                        <p className="text-xs text-slate-500">Top regions by revenue</p>
                                    </div>
                                </div>
                                <div className="h-[300px] overflow-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Region</TableHead>
                                                <TableHead>Orders</TableHead>
                                                <TableHead>Revenue</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {regionLoading ? (
                                                Array.from({ length: 5 }).map((_, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                                                    </TableRow>
                                                ))
                                            ) : regionData.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={3} className="text-center text-muted-foreground">No regional data found</TableCell>
                                                </TableRow>
                                            ) : (
                                                regionData.map((r, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell>{r.region}</TableCell>
                                                        <TableCell>{r.orders}</TableCell>
                                                        <TableCell>{formatCurrency(r.revenue)}</TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="logs">
                        <SalesLogs salesChannelId={salesChannelId} />
                    </TabsContent>

                    <TabsContent value="independent-reps">
                        <IndependentSalesRepsReport
                            range={range}
                            from={from}
                            to={to}
                            salesChannelId={salesChannelId}
                            onOrderClick={handleRowClick}
                        />
                    </TabsContent>
                </Tabs>

                <EditOrderDialog
                    open={showEditDialog}
                    onOpenChange={setShowEditDialog}
                    order={editingOrder}
                    onSuccess={() => {}}
                />

                <Dialog open={showDayDetailsDialog} onOpenChange={setShowDayDetailsDialog}>
                    <DialogContent className="w-[95vw] sm:max-w-[1400px] max-h-[90vh] flex flex-col">
                        <DialogHeader>
                            <DialogTitle className="flex flex-col gap-1">
                                <span>Orders for {(() => {
                                    const parts = selectedDayDate.split('-');
                                    if (parts.length === 3) {
                                        return format(new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])), 'dd MMM yyyy');
                                    }
                                    return selectedDayDate;
                                })()}</span>
                                <span className="text-sm font-normal text-muted-foreground">
                                    {(() => {
                                        const parts = selectedDayDate.split('-');
                                        if (parts.length === 3) {
                                            const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                                            const prev = new Date(d); prev.setDate(prev.getDate() - 1);
                                            return `(${format(prev, 'dd MMM')} 4:30 PM - ${format(d, 'dd MMM')} 4:30 PM PST)`;
                                        }
                                        return '';
                                    })()}
                                </span>
                            </DialogTitle>
                        </DialogHeader>
                        <div className="flex-1 overflow-auto mt-4">
                            {dayDetailsLoading ? (
                                <div className="flex items-center justify-center p-8">Loading orders...</div>
                            ) : dayOrders.length === 0 ? (
                                <div className="flex items-center justify-center p-8 text-muted-foreground">No orders found for this day.</div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Order #</TableHead>
                                            <TableHead>Customer</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Total</TableHead>
                                            <TableHead>Created At</TableHead>
                                            <TableHead>Payment Method</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {dayOrders.map((order) => (
                                            <TableRow key={order.id}>
                                                <TableCell className="font-medium">
                                                    <span
                                                        className="text-primary hover:underline cursor-pointer"
                                                        onClick={() => handleRowClick(order.id)}
                                                    >
                                                        {order.orderNumber}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span>{order.shippingAddress?.firstName} {order.shippingAddress?.lastName}</span>
                                                        <span className="text-xs text-muted-foreground">{order.customer?.email}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{order.status}</TableCell>
                                                <TableCell>{formatCurrency(Number(order.totalAmount))}</TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                    {order.createdAt ? format(new Date(order.createdAt), 'dd MMM yyyy, hh:mm a') : 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="whitespace-nowrap">
                                                        {getPaymentMethodDisplay(order)}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                    <TableFooter>
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-right font-bold">Total</TableCell>
                                            <TableCell className="font-bold">
                                                {formatCurrency(dayOrders.reduce((acc, order) => acc + Number(order.totalAmount || 0), 0))}
                                            </TableCell>
                                            <TableCell colSpan={2} />
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>

                <SendReportDialog
                    open={showEmailDialog}
                    onOpenChange={setShowEmailDialog}
                    onSend={handleSendEmailReport}
                    title="Send Sales Report"
                    description="Enter the email address where you want to receive the filtered sales report."
                />
            </div>
        </DashboardLayout>
    );
}
