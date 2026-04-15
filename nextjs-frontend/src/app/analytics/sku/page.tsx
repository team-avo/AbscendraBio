"use client";

import { useEffect, useState, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Search, ArrowUpDown, Calendar, TrendingUp, TrendingDown, BarChart2 } from "lucide-react";
import { api } from "@/lib/api";
import logger from "@/lib/logger";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SkuPerformance {
    id: string;
    sku: string;
    name: string;
    productName: string;
    totalSold: number;
    startDate: string;
    endDate: string;
}

interface SkuComparisonData {
    variantId: string;
    sku: string;
    name: string;
    productName: string;
    totalOutflow: number;
    period: string;
    comparison: {
        current: {
            label: string;
            total: number;
            daily: Array<{ date: string; value: number }>;
        };
        previous: {
            label: string;
            total: number;
            daily: Array<{ date: string; value: number }>;
        };
    };
}

interface SkuPerformanceHistory {
    summary: {
        totalUnits: number;
        startDate: string;
        endDate: string;
        label: string;
    };
    weeks: Array<{
        label: string;
        total: number;
        delta: number | null;
    }>;
}

export default function SkuAnalyticsPage() {
    const [data, setData] = useState<SkuPerformance[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [sortConfig, setSortConfig] = useState<{ key: keyof SkuPerformance; direction: 'asc' | 'desc' } | null>(null);

    const [range, setRange] = useState("6_months");
    const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
    const [customTo, setCustomTo] = useState<Date | undefined>(undefined);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedSku, setSelectedSku] = useState<SkuPerformance | null>(null);
    const [comparisonData, setComparisonData] = useState<SkuComparisonData | null>(null);
    const [comparisonPeriod, setComparisonPeriod] = useState<"week" | "month">("week");
    const [comparisonLoading, setComparisonLoading] = useState(false);
    const [historyData, setHistoryData] = useState<SkuPerformanceHistory | null>(null);
    const [historyLoading, setHistoryLoading] = useState(false);

    const SKU_PAGE_SIZE = 10;
    const [skuPage, setSkuPage] = useState(1);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const response = await api.getSkuPerformanceAnalytics(
                    range as any,
                    range === "custom" ? customFrom : undefined,
                    range === "custom" ? customTo : undefined,
                    undefined
                );
                if (response.success && response.data) {
                    setData(response.data);
                } else {
                    toast.error(response.error || "Failed to fetch SKU performance data");
                }
            } catch (error) {
                logger.error("Error fetching SKU performance:", { error });
                toast.error("An error occurred while fetching SKU performance data");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [range, customFrom, customTo]);

    useEffect(() => {
        if (dialogOpen && selectedSku) {
            const fetchComparison = async () => {
                try {
                    setComparisonLoading(true);
                    const response = await api.getSkuComparison(selectedSku.id, comparisonPeriod);
                    if (response.success && response.data) {
                        setComparisonData(response.data);
                    } else {
                        toast.error(response.error || "Failed to fetch comparison data");
                    }
                } catch (error) {
                    logger.error("Error fetching comparison:", { error });
                    toast.error("An error occurred while fetching comparison data");
                } finally {
                    setComparisonLoading(false);
                }
            };

            fetchComparison();

            const fetchHistory = async () => {
                try {
                    setHistoryLoading(true);
                    const response = await api.getSkuPerformanceHistory(selectedSku.id, comparisonPeriod);
                    if (response.success && response.data) {
                        setHistoryData(response.data);
                    } else {
                        toast.error(response.error || "Failed to fetch performance history");
                    }
                } catch (error) {
                    logger.error("Error fetching history:", { error });
                    toast.error("An error occurred while fetching performance history");
                } finally {
                    setHistoryLoading(false);
                }
            };

            fetchHistory();
        }
    }, [dialogOpen, selectedSku, comparisonPeriod]);

    const handleRowClick = (sku: SkuPerformance) => {
        setSelectedSku(sku);
        setDialogOpen(true);
    };

    const filteredData = useMemo(() => {
        let result = data.filter(item =>
            item.sku.toLowerCase().includes(search.toLowerCase()) ||
            item.name.toLowerCase().includes(search.toLowerCase()) ||
            item.productName.toLowerCase().includes(search.toLowerCase())
        );

        if (sortConfig) {
            result.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    return sortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
                }

                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
                }

                return 0;
            });
        }

        return result;
    }, [data, search, sortConfig]);

    const totalSkuPages = useMemo(
        () => Math.max(1, Math.ceil(filteredData.length / SKU_PAGE_SIZE)),
        [filteredData.length]
    );
    const paginatedSkus = useMemo(
        () => filteredData.slice((skuPage - 1) * SKU_PAGE_SIZE, skuPage * SKU_PAGE_SIZE),
        [filteredData, skuPage]
    );

    useEffect(() => { setSkuPage(1); }, [search, data, sortConfig]);

    const handleSort = (key: keyof SkuPerformance) => {
        setSortConfig(prev => {
            if (prev?.key === key) {
                return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'desc' };
        });
    };

    const getRangeLabel = () => {
        switch (range) {
            case "7_days": return "Last 7 Days";
            case "1_month": return "Last Month";
            case "3_months": return "Last 3 Months";
            case "6_months": return "Last 6 Months";
            case "12_months": return "Last 12 Months";
            case "all_time": return "All Time";
            case "custom": return "Custom Range";
            default: return "Last 6 Months";
        }
    };

    const getTimeSpan = () => {
        if (range === "all_time") return "All Time";
        if (data.length > 0 && data[0].startDate && data[0].endDate) {
            const start = new Date(data[0].startDate);
            const end = new Date(data[0].endDate);
            return `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`;
        }
        return getRangeLabel();
    };

    const chartData = useMemo(() => {
        if (!comparisonData) return [];

        const { current, previous } = comparisonData.comparison;
        const maxLength = Math.max(current.daily.length, previous.daily.length);

        return Array.from({ length: maxLength }, (_, i) => {
            const currentItem = current.daily[i];
            const previousItem = previous.daily[i];

            let xAxisLabel = '';
            if (currentItem) {
                const d = new Date(currentItem.date);
                xAxisLabel = comparisonPeriod === 'week' ? format(d, 'EEE') : format(d, 'MMM d');
            } else if (previousItem) {
                const d = new Date(previousItem.date);
                xAxisLabel = comparisonPeriod === 'week' ? format(d, 'EEE') : format(d, 'MMM d');
            }

            return {
                index: i,
                xAxisLabel,
                current: currentItem?.value || 0,
                previous: previousItem?.value || 0,
                currentDate: currentItem ? format(new Date(currentItem.date), 'MMM d, yyyy') : null,
                previousDate: previousItem ? format(new Date(previousItem.date), 'MMM d, yyyy') : null
            };
        });
    }, [comparisonData, comparisonPeriod]);

    const calculateChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
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
                                <h1 className="text-xl font-black text-white tracking-tight">SKU Analytics</h1>
                                <p className="text-xs text-gray-500 mt-0.5">Track product sales by SKU variant over time.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Product Outflow table */}
                <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-blue-50">
                                <BarChart2 className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800">Product Outflow</p>
                                <p className="text-xs text-slate-500">
                                    Showing {filteredData.length} SKU{filteredData.length !== 1 ? 's' : ''} for {getTimeSpan().toLowerCase()}.
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                            <div className="relative w-full lg:w-64">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search SKU or Product..."
                                    className="pl-8 w-full"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
                                <Select value={range} onValueChange={setRange}>
                                    <SelectTrigger className="w-full sm:w-40 lg:w-48">
                                        <SelectValue placeholder="Period" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="7_days">Last 7 Days</SelectItem>
                                        <SelectItem value="1_month">Last Month</SelectItem>
                                        <SelectItem value="3_months">Last 3 Months</SelectItem>
                                        <SelectItem value="6_months">Last 6 Months</SelectItem>
                                        <SelectItem value="12_months">Last 12 Months</SelectItem>
                                        <SelectItem value="all_time">All Time</SelectItem>
                                        <SelectItem value="custom">Custom Range</SelectItem>
                                    </SelectContent>
                                </Select>
                                {range === "custom" && (
                                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full sm:w-32 justify-start text-xs font-normal">
                                                    <Calendar className="mr-2 h-3.5 w-3.5" />
                                                    {customFrom ? format(customFrom, "MMM d, yyyy") : "From"}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <CalendarComponent mode="single" selected={customFrom} onSelect={setCustomFrom} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full sm:w-32 justify-start text-xs font-normal">
                                                    <Calendar className="mr-2 h-3.5 w-3.5" />
                                                    {customTo ? format(customTo, "MMM d, yyyy") : "To"}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <CalendarComponent mode="single" selected={customTo} onSelect={setCustomTo} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <Table className="min-w-[700px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('sku')}>
                                        SKU <ArrowUpDown className="inline h-3 w-3 ml-1" />
                                    </TableHead>
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('name')}>
                                        Variant Name <ArrowUpDown className="inline h-3 w-3 ml-1" />
                                    </TableHead>
                                    <TableHead className="text-center">Time Span</TableHead>
                                    <TableHead className="cursor-pointer text-center" onClick={() => handleSort('totalSold')}>
                                        Total Outflow <ArrowUpDown className="inline h-3 w-3 ml-1" />
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                                            <TableCell className="text-center"><Skeleton className="h-4 w-32 mx-auto" /></TableCell>
                                            <TableCell className="text-center"><Skeleton className="h-4 w-10 mx-auto" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : filteredData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">
                                            No results found for this period.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedSkus.map((item) => (
                                        <TableRow
                                            key={item.id}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => handleRowClick(item)}
                                        >
                                            <TableCell className="font-mono text-xs font-semibold">{item.sku}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{item.name}</span>
                                                    <span className="text-xs text-muted-foreground">{item.productName}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center text-sm text-muted-foreground">{getTimeSpan()}</TableCell>
                                            <TableCell className="text-center font-bold text-lg">{item.totalSold}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    {totalSkuPages > 1 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t">
                            <div className="text-sm text-muted-foreground">
                                Page {skuPage} of {totalSkuPages} ({filteredData.length} SKUs)
                            </div>
                            <Pagination currentPage={skuPage} totalPages={totalSkuPages} onPageChange={setSkuPage} />
                        </div>
                    )}
                </div>

                {/* SKU Detail Dialog */}
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogContent className="max-w-4xl w-[98vw] sm:w-full max-h-[95vh] overflow-y-auto p-2 sm:p-6">
                        <DialogHeader>
                            <DialogTitle className="flex items-center justify-between">
                                <div className="pr-4 min-w-0 w-full flex flex-col items-start text-left">
                                    <div className="flex flex-wrap items-start sm:items-center gap-x-2 gap-y-1 min-w-0">
                                        <span className="font-mono text-[10px] sm:text-sm text-muted-foreground break-all">{selectedSku?.sku}</span>
                                        <span className="hidden sm:inline text-muted-foreground self-center">•</span>
                                        <span className="text-sm sm:text-lg lg:text-xl font-bold break-words">{selectedSku?.name}</span>
                                    </div>
                                    <div className="text-[10px] sm:text-sm text-muted-foreground font-normal mt-1 break-words text-left">{selectedSku?.productName}</div>
                                </div>
                            </DialogTitle>
                        </DialogHeader>

                        {comparisonLoading ? (
                            <div className="space-y-6">
                                <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-4">
                                    <Skeleton className="h-8 w-24 mb-2" />
                                    <Skeleton className="h-4 w-32" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-4"><Skeleton className="h-16 w-full" /></div>
                                    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-4"><Skeleton className="h-16 w-full" /></div>
                                </div>
                                <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-4"><Skeleton className="h-[300px] w-full" /></div>
                            </div>
                        ) : comparisonData ? (
                            <div className="space-y-5">
                                {/* Total Outflow */}
                                <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm px-5 py-4">
                                    <p className="text-xs text-slate-500 font-medium mb-1">Total Outflow (All Time)</p>
                                    <div className="text-2xl sm:text-3xl font-bold">{comparisonData.totalOutflow}</div>
                                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Total units sold</p>
                                </div>

                                {/* Period Selector */}
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 px-1">
                                    <label className="text-xs sm:text-sm font-medium">Compare by:</label>
                                    <Select value={comparisonPeriod} onValueChange={(v) => setComparisonPeriod(v as "week" | "month")}>
                                        <SelectTrigger className="w-full sm:w-32 h-8 sm:h-10 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="week">Week</SelectItem>
                                            <SelectItem value="month">Month</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Comparison chips */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm px-5 py-4">
                                        <p className="text-xs text-slate-500 font-medium mb-1">{comparisonData.comparison.current.label}</p>
                                        <div className="text-xl sm:text-2xl font-bold">{comparisonData.comparison.current.total}</div>
                                        <div className="flex items-center gap-2 mt-2">
                                            {(() => {
                                                const change = calculateChange(
                                                    comparisonData.comparison.current.total,
                                                    comparisonData.comparison.previous.total
                                                );
                                                return (
                                                    <>
                                                        {change > 0 ? (
                                                            <TrendingUp className="h-4 w-4 text-green-600" />
                                                        ) : change < 0 ? (
                                                            <TrendingDown className="h-4 w-4 text-red-600" />
                                                        ) : null}
                                                        <span className={`text-[10px] sm:text-xs font-medium whitespace-nowrap ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                                                            {change > 0 ? '+' : ''}{change.toFixed(1)}% vs {comparisonData.comparison.previous.label.toLowerCase()}
                                                        </span>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm px-5 py-4">
                                        <p className="text-xs text-slate-500 font-medium mb-1">{comparisonData.comparison.previous.label}</p>
                                        <div className="text-xl sm:text-2xl font-bold">{comparisonData.comparison.previous.total}</div>
                                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Units sold</p>
                                    </div>
                                </div>

                                {/* Performance Table */}
                                <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                                    <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-blue-50">
                                            <BarChart2 className="h-4 w-4 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800">
                                                {comparisonPeriod === 'week' ? 'Weekly' : 'Monthly'} Performance
                                            </p>
                                            {historyData && (
                                                <p className="text-xs font-semibold text-blue-600">{historyData.summary.label}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="p-1 sm:p-4">
                                        <div className="rounded-xl border border-gray-200 overflow-hidden">
                                            <Table className="min-w-[300px]">
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Timespan</TableHead>
                                                        <TableHead className="text-center">Total</TableHead>
                                                        <TableHead className="text-center">Delta</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {historyLoading ? (
                                                        Array.from({ length: 5 }).map((_, i) => (
                                                            <TableRow key={i}>
                                                                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                                                                <TableCell className="text-center"><Skeleton className="h-4 w-10 mx-auto" /></TableCell>
                                                                <TableCell className="text-center"><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                                                            </TableRow>
                                                        ))
                                                    ) : historyData?.weeks.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={3} className="h-24 text-center">No historical data found.</TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        historyData?.weeks.map((week, idx) => (
                                                            <TableRow key={idx}>
                                                                <TableCell className="font-medium">{week.label}</TableCell>
                                                                <TableCell className="text-center font-bold">{week.total}</TableCell>
                                                                <TableCell className="text-center">
                                                                    {week.delta !== null ? (
                                                                        <div className="flex items-center justify-center gap-1">
                                                                            {week.delta > 0 ? (
                                                                                <TrendingUp className="h-3 w-3 text-green-600" />
                                                                            ) : week.delta < 0 ? (
                                                                                <TrendingDown className="h-3 w-3 text-red-600" />
                                                                            ) : null}
                                                                            <span className={`text-[11px] sm:text-xs font-semibold whitespace-nowrap ${week.delta > 0 ? 'text-green-600' : week.delta < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                                                                                {week.delta > 0 ? '+' : ''}{week.delta.toFixed(1)}%
                                                                            </span>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-xs text-muted-foreground">-</span>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                </div>

                                {/* Sales Trend Chart */}
                                <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                                    <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-emerald-50">
                                            <BarChart2 className="h-4 w-4 text-emerald-600" />
                                        </div>
                                        <p className="text-sm font-semibold text-slate-800">Sales Trend</p>
                                    </div>
                                    <div className="p-4 sm:p-6">
                                        <div className="h-[200px] sm:h-[300px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={chartData}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                    <XAxis dataKey="xAxisLabel" fontSize={10} tickLine={false} axisLine={false} />
                                                    <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                                                    <Tooltip
                                                        content={({ active, payload, label }) => {
                                                            if (active && payload && payload.length) {
                                                                const data = payload[0].payload;
                                                                return (
                                                                    <div className="bg-background border p-3 shadow-lg rounded-lg text-xs min-w-[150px]">
                                                                        <p className="font-bold mb-2 border-b pb-1">{label}</p>
                                                                        <div className="space-y-3">
                                                                            <div className="flex flex-col">
                                                                                <span className="text-blue-600 font-semibold">{comparisonData.comparison.current.label}</span>
                                                                                <span className="text-lg font-bold">{data.current} units</span>
                                                                                {data.currentDate && <span className="text-[10px] text-muted-foreground">{data.currentDate}</span>}
                                                                            </div>
                                                                            <div className="flex flex-col">
                                                                                <span className="text-slate-500 font-semibold">{comparisonData.comparison.previous.label}</span>
                                                                                <span className="text-lg font-bold">{data.previous} units</span>
                                                                                {data.previousDate && <span className="text-[10px] text-muted-foreground">{data.previousDate}</span>}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        }}
                                                    />
                                                    <Legend iconType="circle" />
                                                    <Line
                                                        type="monotone"
                                                        dataKey="current"
                                                        stroke="#2563eb"
                                                        name={comparisonData.comparison.current.label}
                                                        strokeWidth={3}
                                                        dot={false}
                                                        activeDot={{ r: 6, strokeWidth: 0 }}
                                                    />
                                                    <Line
                                                        type="monotone"
                                                        dataKey="previous"
                                                        stroke="#94a3b8"
                                                        name={comparisonData.comparison.previous.label}
                                                        strokeWidth={2}
                                                        strokeDasharray="5 5"
                                                        dot={false}
                                                        activeDot={{ r: 4, strokeWidth: 0 }}
                                                    />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    );
}
