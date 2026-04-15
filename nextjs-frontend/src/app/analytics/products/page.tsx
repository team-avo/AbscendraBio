"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPrimitive } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Download, Package, Mail, BarChart2, PieChart as PieChartIcon, List } from "lucide-react";
import { api, formatCurrency, resolveImageUrl } from "@/lib/api";
import logger from "@/lib/logger";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { SendReportDialog } from "@/components/shared/send-report-dialog";
import { OrderDateFilter } from "@/components/orders/order-date-filter";
import Image from "next/image";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProductPerformancePage() {
  const [range, setRange] = useState("last_30_days");
  const [from, setFrom] = useState<Date | undefined>(undefined);
  const [to, setTo] = useState<Date | undefined>(undefined);
  const [salesChannelId, setSalesChannelId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>({ top: [] });
  const isMobile = useIsMobile();
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [rankingTab, setRankingTab] = useState("revenue");

  const PRODUCTS_PAGE_SIZE = 10;

  const [revenuePage, setRevenuePage] = useState(1);
  const [unitsPage, setUnitsPage] = useState(1);

  const sortedByRevenue = useMemo(
    () => [...(data.top || [])].sort((a: any, b: any) => (Number(b.revenue) || 0) - (Number(a.revenue) || 0)),
    [data.top]
  );
  const sortedByUnits = useMemo(
    () => [...(data.top || [])].sort((a: any, b: any) => (Number(b.sales) || 0) - (Number(a.sales) || 0)),
    [data.top]
  );

  const totalRevenuePages = useMemo(
    () => Math.max(1, Math.ceil(sortedByRevenue.length / PRODUCTS_PAGE_SIZE)),
    [sortedByRevenue.length]
  );
  const paginatedRevenue = useMemo(
    () => sortedByRevenue.slice((revenuePage - 1) * PRODUCTS_PAGE_SIZE, revenuePage * PRODUCTS_PAGE_SIZE),
    [sortedByRevenue, revenuePage]
  );

  const totalUnitsPages = useMemo(
    () => Math.max(1, Math.ceil(sortedByUnits.length / PRODUCTS_PAGE_SIZE)),
    [sortedByUnits.length]
  );
  const paginatedUnits = useMemo(
    () => sortedByUnits.slice((unitsPage - 1) * PRODUCTS_PAGE_SIZE, unitsPage * PRODUCTS_PAGE_SIZE),
    [sortedByUnits, unitsPage]
  );

  useEffect(() => { setRevenuePage(1); setUnitsPage(1); }, [data]);
  useEffect(() => { if (rankingTab === 'revenue') setRevenuePage(1); else setUnitsPage(1); }, [rankingTab]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        let rangeToSend = range;
        let fromToSend = from;
        let toToSend = to;

        if (range === 'day' && from) {
          rangeToSend = 'custom';
          fromToSend = from;
          toToSend = from;
        }

        const res = await api.getProductPerformance(
          rangeToSend as any,
          fromToSend || undefined,
          toToSend || undefined,
          salesChannelId
        );
        logger.debug("[ProductPerformance] API response:", { response: res });
        if (res.success && res.data) setData(res.data);
        else {
          toast.error(res.error || "Failed to load product performance");
          setData({ top: [] });
        }
      } catch (e: any) {
        logger.error("[ProductPerformance] API error:", { error: e });
        toast.error(e?.message || "Failed to load product performance");
        setData({ top: [] });
      } finally {
        setLoading(false);
      }
    })();
  }, [range, from, to, salesChannelId]);

  const top10 = (data.top || []).slice(0, 10);
  const colors = [
    "#2563eb", "#7c3aed", "#16a34a", "#dc2626", "#f59e0b",
    "#0ea5e9", "#14b8a6", "#ef4444", "#8b5cf6", "#10b981",
  ];

  const revenueByProduct = top10.map((d: any) => ({ name: d.name, revenue: d.revenue }));
  const salesByProduct = top10.map((d: any) => ({ name: d.name, sales: d.sales }));
  const revenueTotal = top10.reduce((s: number, d: any) => s + (Number(d.revenue) || 0), 0) || 1;
  const revenueShare = top10.map((d: any) => ({ name: d.name, value: Number(d.revenue) || 0 }));

  const csv = useMemo(() => {
    const header = "product,variant,revenue,sales,stock";
    const rows = (data.top || []).map((d: any) => `${d.name},${d.variantName || ''},${d.revenue},${d.sales},${d.stock}`);
    return [header, ...rows].join("\n");
  }, [data]);

  const downloadCsv = () => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `product_performance_${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendEmailReport = async (email: string) => {
    return api.sendSalesEmailReport({
      email,
      range: range === 'day' ? 'custom' : range,
      from: from?.toISOString(),
      to: to?.toISOString(),
      salesChannelId,
      usePSTFilter: true,
    });
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
                <h1 className="text-xl font-black text-white tracking-tight">Product Performance</h1>
                <p className="text-xs text-gray-500 mt-0.5">Best performing products by sales and revenue</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <OrderDateFilter
                  range={range}
                  setRange={setRange}
                  from={from}
                  setFrom={setFrom}
                  to={to}
                  setTo={setTo}
                  salesChannelId={salesChannelId}
                  onSalesChannelChange={setSalesChannelId}
                />
                <div className="flex items-center gap-2">
                  {!isMobile && (
                    <button onClick={downloadCsv} disabled={loading || (data.top || []).length === 0} className="flex items-center gap-1.5 h-9 px-3 bg-white text-[#070B14] rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-100 transition-colors disabled:opacity-50">
                      <Download className="h-3.5 w-3.5" />
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

        <SendReportDialog
          open={showEmailDialog}
          onOpenChange={setShowEmailDialog}
          onSend={handleSendEmailReport}
          title="Send Product Performance Report"
          description="Enter your email to receive the product performance report as an Excel file."
        />

        {/* Charts row */}
        <div className="grid gap-5 grid-cols-1 lg:grid-cols-3">
          <div className="col-span-1 lg:col-span-2 bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-blue-50">
                <BarChart2 className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Revenue by Product</p>
                <p className="text-xs text-slate-500">Top {top10.length} products by revenue</p>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              <div className="h-[280px]">
                {loading ? (
                  <Skeleton className="w-full h-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueByProduct} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="name"
                        tickFormatter={(v) => (v?.length > 10 ? v.slice(0, 10) + "…" : v)}
                        tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                        axisLine={{ stroke: 'var(--border)' }}
                        tickLine={{ stroke: 'var(--border)' }}
                      />
                      <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} tickLine={{ stroke: 'var(--border)' }} />
                      <Tooltip
                        formatter={(v) => [formatCurrency(Number(v) || 0), "Revenue"]}
                        contentStyle={{ background: 'var(--popover)', color: 'var(--popover-foreground)', border: '1px solid var(--border)' }}
                        labelStyle={{ color: 'var(--popover-foreground)' }}
                        itemStyle={{ color: 'var(--popover-foreground)' }}
                      />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-violet-50">
                <PieChartIcon className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Revenue Share</p>
                <p className="text-xs text-slate-500">Top products share of total</p>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              <div className="h-[280px]">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <Skeleton className="w-[180px] h-[180px] rounded-full" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={revenueShare} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}>
                        {revenueShare.map((entry: any, idx: number) => (
                          <Cell key={`cell-${idx}`} fill={colors[idx % colors.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v, n) => [formatCurrency(Number(v) || 0), n as string]}
                        contentStyle={{ background: 'var(--popover)', color: 'var(--popover-foreground)', border: '1px solid var(--border)' }}
                        labelStyle={{ color: 'var(--popover-foreground)' }}
                        itemStyle={{ color: 'var(--popover-foreground)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Units Sold chart */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-emerald-50">
              <Package className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Units Sold by Product</p>
              <p className="text-xs text-slate-500">Top {top10.length} products by units</p>
            </div>
          </div>
          <div className="p-4 sm:p-6">
            <div className="h-[260px]">
              {loading ? (
                <Skeleton className="w-full h-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesByProduct} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="name"
                      tickFormatter={(v) => (v?.length > 16 ? v.slice(0, 16) + "…" : v)}
                      tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                      axisLine={{ stroke: 'var(--border)' }}
                      tickLine={{ stroke: 'var(--border)' }}
                    />
                    <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} tickLine={{ stroke: 'var(--border)' }} />
                    <Tooltip
                      contentStyle={{ background: 'var(--popover)', color: 'var(--popover-foreground)', border: '1px solid var(--border)' }}
                      labelStyle={{ color: 'var(--popover-foreground)' }}
                      itemStyle={{ color: 'var(--popover-foreground)' }}
                    />
                    <Bar dataKey="sales" fill="hsl(var(--secondary))" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Top Products table */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-amber-50">
              <List className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Top Products</p>
              <p className="text-xs text-slate-500">View products ranked by revenue or units sold</p>
            </div>
          </div>
          <div className="p-4 sm:p-6 overflow-x-auto">
            <Tabs value={rankingTab} onValueChange={setRankingTab} className="w-full">
              <div className="w-full overflow-x-auto scrollbar-hide">
                <TabsList className="flex items-center justify-start w-max h-auto p-1 bg-muted gap-1 min-h-[40px] mb-4">
                  <TabsTrigger value="revenue" className="whitespace-nowrap py-2 px-4 text-xs sm:text-sm">Ranked by Revenue</TabsTrigger>
                  <TabsTrigger value="units" className="whitespace-nowrap py-2 px-4 text-xs sm:text-sm">Ranked by Units Sold</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="revenue" className="mt-0">
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <Table className="min-w-[800px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Variant</TableHead>
                        <TableHead>Revenue</TableHead>
                        <TableHead>Sales</TableHead>
                        <TableHead>Stock</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        Array.from({ length: 10 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          </TableRow>
                        ))
                      ) : (data.top || []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center">
                            No results found for this period.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedRevenue.map((row: any, idx: number) => (
                          <TableRow key={`${row.variantId}-${idx}`}>
                            <TableCell>{(revenuePage - 1) * PRODUCTS_PAGE_SIZE + idx + 1}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {row.image ? (
                                  <Image src={resolveImageUrl(row.image)} alt="" width={28} height={28} className="rounded" />
                                ) : (
                                  <Package className="h-5 w-5 text-muted-foreground" />
                                )}
                                <div className="truncate max-w-[260px]" title={row.name}>{row.name}</div>
                              </div>
                            </TableCell>
                            <TableCell className="truncate max-w-[220px]" title={row.variantName || ''}>{row.variantName || '-'}</TableCell>
                            <TableCell>{formatCurrency(row.revenue)}</TableCell>
                            <TableCell>{row.sales}</TableCell>
                            <TableCell>{row.stock}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  {totalRevenuePages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t">
                      <div className="text-sm text-muted-foreground">
                        Page {revenuePage} of {totalRevenuePages} ({sortedByRevenue.length} products)
                      </div>
                      <Pagination
                        currentPage={revenuePage}
                        totalPages={totalRevenuePages}
                        onPageChange={setRevenuePage}
                      />
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="units" className="mt-0">
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <Table className="min-w-[800px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Variant</TableHead>
                        <TableHead>Units Sold</TableHead>
                        <TableHead>Revenue</TableHead>
                        <TableHead>Stock</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        Array.from({ length: 10 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          </TableRow>
                        ))
                      ) : (data.top || []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center">
                            No results found for this period.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedUnits.map((row: any, idx: number) => (
                          <TableRow key={`${row.variantId}-${idx}`}>
                            <TableCell>{(unitsPage - 1) * PRODUCTS_PAGE_SIZE + idx + 1}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {row.image ? (
                                  <Image src={resolveImageUrl(row.image)} alt="" width={28} height={28} className="rounded" />
                                ) : (
                                  <Package className="h-5 w-5 text-muted-foreground" />
                                )}
                                <div className="truncate max-w-[260px]" title={row.name}>{row.name}</div>
                              </div>
                            </TableCell>
                            <TableCell className="truncate max-w-[220px]" title={row.variantName || ''}>{row.variantName || '-'}</TableCell>
                            <TableCell>{row.sales}</TableCell>
                            <TableCell>{formatCurrency(row.revenue)}</TableCell>
                            <TableCell>{row.stock}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  {totalUnitsPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t">
                      <div className="text-sm text-muted-foreground">
                        Page {unitsPage} of {totalUnitsPages} ({sortedByUnits.length} products)
                      </div>
                      <Pagination
                        currentPage={unitsPage}
                        totalPages={totalUnitsPages}
                        onPageChange={setUnitsPage}
                      />
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
