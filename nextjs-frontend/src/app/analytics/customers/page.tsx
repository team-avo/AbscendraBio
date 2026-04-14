"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPrimitive } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Download, Users, ExternalLink, Calendar as CalendarIcon, Mail, Package, PieChart as PieChartIcon, List, TrendingUp } from "lucide-react";
import { api, formatCurrency, Order } from "@/lib/api";
import logger from "@/lib/logger";
import { OrderDateFilter } from "@/components/orders/order-date-filter";
import { EditOrderDialog } from "@/components/orders/edit-order-dialog";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { SendReportDialog } from "@/components/shared/send-report-dialog";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

export default function CustomerInsightsPage() {
  const [range, setRange] = useState("last_30_days");
  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);
  const [salesChannelId, setSalesChannelId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>({ segments: [], topCustomers: [] });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedFreqCustomerId, setSelectedFreqCustomerId] = useState<string | null>(null);
  const [customerSummary, setCustomerSummary] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const isMobile = useIsMobile();
  const [showEmailDialog, setShowEmailDialog] = useState(false);

  const [activeMainTab, setActiveMainTab] = useState("overview");
  const [freqData, setFreqData] = useState<any[]>([]);
  const [freqLoading, setFreqLoading] = useState(false);
  const [freqSearch, setFreqSearch] = useState("");
  const [debouncedFreqSearch, setDebouncedFreqSearch] = useState("");
  const [freqTab, setFreqTab] = useState("1");
  const [plusFilter, setPlusFilter] = useState("ALL");
  const [freqPage, setFreqPage] = useState(1);
  const [freqTotalPages, setFreqTotalPages] = useState(1);
  const [freqMetrics, setFreqMetrics] = useState({
    total: 0,
    activeInPeriod: 0,
    neverOrdered: 0,
    singleOrder: 0,
    repeatOrder: 0
  });

  const fetchCustomerSummary = async (customerId: string) => {
    try {
      setSummaryLoading(true);
      const res = await api.getCustomerSummary(customerId, range, from, to, salesChannelId);
      if (res.success) setCustomerSummary(res.data);
    } catch (e) {
      logger.error("Failed to fetch customer summary", { error: e });
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleEditOrder = async (orderId: string) => {
    try {
      const res = await api.getOrder(orderId);
      if (res.success && res.data) {
        setEditingOrder(res.data);
      } else {
        toast.error("Failed to load order details");
      }
    } catch (error) {
      logger.error("Error fetching order details:", { error });
      toast.error("Failed to load order details");
    }
  };

  const handleOrderUpdated = () => {
    setEditingOrder(null);
    if (selectedCustomerId) fetchCustomerSummary(selectedCustomerId);
    if (selectedFreqCustomerId) fetchCustomerSummary(selectedFreqCustomerId);
    toast.success("Order updated successfully");
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      const res = await api.hardDeleteOrder(orderId);
      if (res.success) {
        setEditingOrder(null);
        if (selectedCustomerId) fetchCustomerSummary(selectedCustomerId);
        if (selectedFreqCustomerId) fetchCustomerSummary(selectedFreqCustomerId);
        toast.success("Order deleted successfully");
      }
    } catch (error) {
      logger.error("Failed to delete order:", { error });
      toast.error("Failed to delete order");
    }
  };

  useEffect(() => {
    const fetchId = selectedCustomerId || selectedFreqCustomerId;
    if (fetchId) {
      fetchCustomerSummary(fetchId);
    } else {
      setCustomerSummary(null);
    }
  }, [selectedCustomerId, selectedFreqCustomerId, range, from, to, salesChannelId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

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

        const res = await api.getCustomerInsights(
          rangeToSend as any,
          fromToSend || undefined,
          toToSend || undefined,
          debouncedSearch || undefined,
          undefined,
          salesChannelId,
          currentPage,
          itemsPerPage
        );
        logger.debug("[CustomerInsights] API response:", { response: res });
        if (res.success && res.data) setData(res.data);
        else {
          toast.error(res.error || "Failed to load customer insights");
          setData({ segments: [], topCustomers: [] });
        }
      } catch (e: any) {
        logger.error("[CustomerInsights] API error:", { error: e });
        toast.error(e?.message || "Failed to load customer insights");
        setData({ segments: [], topCustomers: [] });
      } finally {
        setLoading(false);
      }
    })();
  }, [range, from, to, debouncedSearch, salesChannelId, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [range, from, to, salesChannelId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFreqSearch(freqSearch);
      setFreqPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [freqSearch]);

  useEffect(() => {
    if (activeMainTab !== "order_frequency") return;
    (async () => {
      try {
        setFreqLoading(true);
        let rangeToSend = range;
        let fromToSend = from;
        let toToSend = to;

        if (range === 'day' && from) {
          rangeToSend = 'custom';
          fromToSend = from;
          toToSend = from;
        }

        const res = await api.getCustomerOrderFrequency(
          debouncedFreqSearch,
          salesChannelId,
          rangeToSend as any,
          fromToSend || undefined,
          toToSend || undefined,
          freqTab,
          plusFilter,
          freqPage,
          itemsPerPage
        );
        if (res.success && res.data) {
          setFreqData(res.data);
          if (res.pagination) setFreqTotalPages(res.pagination.totalPages ?? 1);
          if (res.metrics) setFreqMetrics(res.metrics);
        } else {
          toast.error(res.error || "Failed to load order frequency data");
          setFreqData([]);
        }
      } catch (e: any) {
        toast.error(e?.message || "Failed to load order frequency data");
        setFreqData([]);
      } finally {
        setFreqLoading(false);
      }
    })();
  }, [activeMainTab, debouncedFreqSearch, salesChannelId, range, from, to, freqTab, plusFilter, freqPage]);

  useEffect(() => { setFreqPage(1); }, [freqTab, plusFilter, range, from, to, salesChannelId]);

  const segmentChart = useMemo(() => {
    const total = (data.segments || []).reduce((s: number, x: any) => s + x._count?.id || 0, 0) || 1;
    const palette = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

    const aggregated: Record<string, number> = { 'Wholesale': 0, 'Enterprise': 0 };

    (data.segments || []).forEach((s: any) => {
      const count = s._count?.id || 0;
      if (s.customerType === 'B2C' || s.customerType === 'B2B') {
        aggregated['Wholesale'] += count;
      } else if (s.customerType === 'ENTERPRISE_1' || s.customerType === 'ENTERPRISE_2') {
        aggregated['Enterprise'] += count;
      } else if (s.customerType !== 'ENTERPRISE') {
        const name = s.customerType.replace('_', ' ');
        if (!aggregated[name]) aggregated[name] = 0;
        aggregated[name] += count;
      }
    });

    return Object.entries(aggregated)
      .filter(([_, value]) => value > 0)
      .map(([name, value], idx) => ({ name, value, color: palette[idx % palette.length] }));
  }, [data]);

  const csv = useMemo(() => {
    const header = "name,email,sales_rep,orders,revenue,customerType,since";
    const rows = (data.topCustomers || [])
      .filter((c: any) => c.customerType !== 'ENTERPRISE')
      .map((c: any) => {
        let displayType = c.customerType;
        if (c.customerType === 'B2C' || c.customerType === 'B2B') displayType = 'Wholesale';
        else if (c.customerType === 'ENTERPRISE_1' || c.customerType === 'ENTERPRISE_2') displayType = 'Enterprise';
        const salesRep = c.salesRep ? `${c.salesRep.name} (${c.salesRep.email})` : 'N/A';
        return `${c.name},${c.email},"${salesRep}",${c.orders},${c.revenue},${displayType},${c.since}`;
      });
    return [header, ...rows].join("\n");
  }, [data]);

  const downloadCsv = () => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customer_insights_${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendEmailReport = async (email: string) => {
    return api.sendCustomersEmailReport({ email, type: 'insights' });
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
                <h1 className="text-xl font-black text-white tracking-tight">Customer Insights</h1>
                <p className="text-xs text-gray-500 mt-0.5">Segments, value, and top customers</p>
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
                  onSalesChannelChange={(id) => setSalesChannelId(id)}
                />
                <div className="flex items-center gap-2">
                  {!isMobile && (
                    <button onClick={downloadCsv} disabled={loading || (data.topCustomers || []).length === 0} className="flex items-center gap-1.5 h-9 px-3 bg-white text-[#070B14] rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-100 transition-colors disabled:opacity-50">
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
          title="Send Customer Insights Report"
          description="Enter your email to receive the customer insights report as an Excel file."
        />

        <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="space-y-5">
          <div className="overflow-x-auto pb-1 scrollbar-hide flex w-full">
            <TabsList className="bg-muted/50 p-1 w-full max-w-sm grid grid-cols-2">
              <TabsTrigger value="overview" className="text-sm font-semibold">Top Customers</TabsTrigger>
              <TabsTrigger value="order_frequency" className="text-sm font-semibold">Customer Orders</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-0 outline-none space-y-5">
            {/* Top Customers table */}
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-blue-50">
                    <Users className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Top Customers</p>
                    <p className="text-xs text-slate-500">By revenue</p>
                  </div>
                </div>
                <div className="relative w-full sm:w-72">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search name or email..."
                    className="w-full pl-9 pr-4 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all h-9 sm:h-10"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      ×
                    </button>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table className="min-w-[800px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Sales Rep</TableHead>
                      <TableHead>Customer Type</TableHead>
                      <TableHead>Orders</TableHead>
                      <TableHead>Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 10 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        </TableRow>
                      ))
                    ) : (
                      (data.topCustomers || []).map((c: any, idx: number) => {
                        let displayType = c.customerType;
                        if (c.customerType === 'B2C' || c.customerType === 'B2B') displayType = 'Wholesale';
                        else if (c.customerType === 'ENTERPRISE_1' || c.customerType === 'ENTERPRISE_2') displayType = 'Enterprise';
                        return (
                          <TableRow
                            key={c.id || idx}
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => setSelectedCustomerId(c.id)}
                          >
                            <TableCell>{((currentPage - 1) * itemsPerPage) + idx + 1}</TableCell>
                            <TableCell className="font-medium text-primary hover:underline">{c.name}</TableCell>
                            <TableCell className="truncate max-w-[180px]" title={c.email}>{c.email}</TableCell>
                            <TableCell>
                              {c.salesRep ? (
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">{c.salesRep.name}</span>
                                  <span className="text-[10px] text-muted-foreground truncate max-w-[150px]" title={c.salesRep.email}>{c.salesRep.email}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Unassigned</span>
                              )}
                            </TableCell>
                            <TableCell>{displayType}</TableCell>
                            <TableCell>{c.orders}</TableCell>
                            <TableCell>{formatCurrency(c.revenue)}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              {(() => {
                if ((data.pagination?.totalPages || 0) <= 1) return null;
                return (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t">
                    <div className="text-sm text-muted-foreground">Page {currentPage} of {data.pagination?.totalPages}</div>
                    <Pagination currentPage={currentPage} totalPages={data.pagination?.totalPages || 1} onPageChange={setCurrentPage} />
                  </div>
                );
              })()}
            </div>

            {/* Customer Segments */}
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-violet-50">
                  <PieChartIcon className="h-4 w-4 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Customer Segments</p>
                  <p className="text-xs text-slate-500">Distribution by type</p>
                </div>
              </div>
              <div className="p-4 sm:p-6">
                <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-8">
                  <div className="flex-1 w-full flex items-center justify-center">
                    {loading ? (
                      <div className="flex items-center justify-center h-[250px] sm:h-[300px]">
                        <Skeleton className="w-[180px] h-[180px] sm:w-[220px] sm:h-[220px] rounded-full" />
                      </div>
                    ) : (
                      <div className="h-[250px] sm:h-[300px] w-full max-w-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={segmentChart} cx="50%" cy="50%" innerRadius={80} outerRadius={110} dataKey="value">
                              {segmentChart.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={entry.color} className="hover:opacity-80 transition-opacity" />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ background: 'var(--popover)', color: 'var(--popover-foreground)', border: '1px solid var(--border)', borderRadius: '12px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 w-full grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3 sm:gap-4">
                    {loading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex flex-col p-3 sm:p-4 rounded-2xl bg-muted/30 border border-border/50">
                          <Skeleton className="h-4 w-16 mb-2" />
                          <Skeleton className="h-8 w-12" />
                        </div>
                      ))
                    ) : segmentChart.map((s: any) => (
                      <div key={s.name} className="flex flex-col p-3 sm:p-4 rounded-2xl bg-muted/30 border border-border/50 transition-all hover:bg-muted/50">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                          <span className="text-xs sm:text-sm font-bold truncate">{s.name}</span>
                        </div>
                        <div className="flex items-end justify-between">
                          <span className="text-xl sm:text-2xl font-black text-primary">{s.value}</span>
                          <span className="text-[10px] font-bold text-muted-foreground">Customers</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="order_frequency" className="mt-0 outline-none space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-lg font-semibold tracking-tight">Metrics Overview</h2>
              <OrderDateFilter
                range={range}
                setRange={setRange}
                from={from || undefined}
                setFrom={(d) => setFrom(d || null)}
                to={to || undefined}
                setTo={(d) => setTo(d || null)}
                salesChannelId={salesChannelId}
                onSalesChannelChange={(id) => setSalesChannelId(id)}
              />
            </div>

            {/* Stat chips */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-200/80 shadow-sm px-5 py-4">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-blue-50 shrink-0">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 font-medium">Total Customers</p>
                  {freqLoading ? (
                    <div className="space-y-1 mt-1"><Skeleton className="h-6 w-16" /><Skeleton className="h-3 w-28" /></div>
                  ) : (
                    <>
                      <p className="text-xl font-bold text-slate-800 truncate">
                        {(range === "all" || range === "all_time") ? freqMetrics.total.toLocaleString() : freqMetrics.activeInPeriod.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-slate-500">{(range === "all" || range === "all_time") ? "All time records" : "Active in period"}</p>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-200/80 shadow-sm px-5 py-4">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-slate-100 shrink-0">
                  <Users className="h-5 w-5 text-slate-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 font-medium">Never Ordered</p>
                  {freqLoading ? (
                    <div className="space-y-1 mt-1"><Skeleton className="h-6 w-16" /><Skeleton className="h-3 w-28" /></div>
                  ) : (
                    <>
                      <p className="text-xl font-bold text-slate-800 truncate">{freqMetrics.neverOrdered.toLocaleString()}</p>
                      <p className="text-[10px] text-slate-500">{range === "all" || range === "all_time" ? "0 total orders" : "0 orders in period"}</p>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-200/80 shadow-sm px-5 py-4">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-amber-50 shrink-0">
                  <Users className="h-5 w-5 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 font-medium">Single Order</p>
                  {freqLoading ? (
                    <div className="space-y-1 mt-1"><Skeleton className="h-6 w-16" /><Skeleton className="h-3 w-28" /></div>
                  ) : (
                    <>
                      <p className="text-xl font-bold text-slate-800 truncate">{freqMetrics.singleOrder.toLocaleString()}</p>
                      <p className="text-[10px] text-slate-500">{range === "all" || range === "all_time" ? "Exactly 1 order" : "1 order in period"}</p>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-200/80 shadow-sm px-5 py-4">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-emerald-50 shrink-0">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 font-medium">Repeat Customers</p>
                  {freqLoading ? (
                    <div className="space-y-1 mt-1"><Skeleton className="h-6 w-16" /><Skeleton className="h-3 w-28" /></div>
                  ) : (
                    <>
                      <p className="text-xl font-bold text-slate-800 truncate">{freqMetrics.repeatOrder.toLocaleString()}</p>
                      <p className="text-[10px] text-slate-500">{range === "all" || range === "all_time" ? "2+ orders" : "2+ orders in period"}</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Customer Orders table */}
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-blue-50">
                      <List className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Customer Orders</p>
                      <p className="text-xs text-slate-500">Grouped by total orders</p>
                    </div>
                  </div>
                  <div className="relative w-full sm:w-72">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search name or email..."
                      className="w-full pl-9 pr-4 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all h-9 sm:h-10"
                      value={freqSearch}
                      onChange={(e) => setFreqSearch(e.target.value)}
                    />
                    {freqSearch && (
                      <button onClick={() => setFreqSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">×</button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 sm:gap-4">
                  <Tabs value={freqTab} onValueChange={(v) => { setFreqTab(v); setFreqPage(1); }} className="w-full md:w-auto">
                    <div className="overflow-x-auto pb-1.5 -mx-1 px-1 sm:mx-0 sm:px-0 sm:pb-0 scrollbar-hide">
                      <TabsList className="bg-muted/50 p-1 flex w-full min-w-max sm:inline-flex sm:w-auto sm:min-w-0">
                        <TabsTrigger value="0" className="flex-1 text-xs sm:text-sm px-3 sm:px-5 py-1.5">0 Orders</TabsTrigger>
                        <TabsTrigger value="1" className="flex-1 text-xs sm:text-sm px-3 sm:px-5 py-1.5">1 Order</TabsTrigger>
                        <TabsTrigger value="repeat" className="flex-1 text-xs sm:text-sm px-3 sm:px-5 py-1.5">Repeated Orders</TabsTrigger>
                      </TabsList>
                    </div>
                  </Tabs>

                  {freqTab === "repeat" && (
                    <Select value={plusFilter} onValueChange={(v) => { setPlusFilter(v); setFreqPage(1); }}>
                      <SelectTrigger className="w-full md:w-[240px] h-9 sm:h-10 text-xs sm:text-sm font-medium">
                        <SelectValue placeholder="Filter by exact count" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL" className="text-xs sm:text-sm">All Repeat (2+ Orders)</SelectItem>
                        {Array.from({ length: 19 }).map((_, i) => {
                          const val = i + 2;
                          return (
                            <SelectItem key={val} value={val.toString()} className="text-xs sm:text-sm">{val}+ Orders</SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table className="min-w-[800px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Sales Rep</TableHead>
                      <TableHead>Customer Type</TableHead>
                      <TableHead>Orders</TableHead>
                      <TableHead>Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {freqLoading ? (
                      Array.from({ length: 10 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        </TableRow>
                      ))
                    ) : (() => {
                      if (freqData.length === 0) {
                        return (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              No customers found in this category.
                            </TableCell>
                          </TableRow>
                        );
                      }

                      return freqData.map((c: any, idx: number) => {
                        let displayType = c.customerType;
                        if (c.customerType === 'B2C' || c.customerType === 'B2B') displayType = 'Wholesale';
                        else if (c.customerType === 'ENTERPRISE_1' || c.customerType === 'ENTERPRISE_2') displayType = 'Enterprise';
                        return (
                          <TableRow
                            key={c.id || idx}
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => setSelectedFreqCustomerId(c.id)}
                          >
                            <TableCell>{((freqPage - 1) * itemsPerPage) + idx + 1}</TableCell>
                            <TableCell className="font-medium text-primary hover:underline">{c.name}</TableCell>
                            <TableCell className="truncate max-w-[180px]" title={c.email}>{c.email}</TableCell>
                            <TableCell>
                              {c.salesRep ? (
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">{c.salesRep.name}</span>
                                  <span className="text-[10px] text-muted-foreground truncate max-w-[150px]" title={c.salesRep.email}>{c.salesRep.email}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Unassigned</span>
                              )}
                            </TableCell>
                            <TableCell>{displayType}</TableCell>
                            <TableCell>{c.orders}</TableCell>
                            <TableCell>{formatCurrency(c.revenue)}</TableCell>
                          </TableRow>
                        );
                      });
                    })()}
                  </TableBody>
                </Table>
              </div>
              {(() => {
                if (freqTotalPages <= 1) return null;
                return (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t">
                    <div className="text-sm text-muted-foreground">Page {freqPage} of {freqTotalPages}</div>
                    <Pagination currentPage={freqPage} totalPages={freqTotalPages} onPageChange={setFreqPage} />
                  </div>
                );
              })()}
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={!!selectedCustomerId} onOpenChange={(open) => !open && setSelectedCustomerId(null)}>
          <DialogContent className={cn("flex flex-col bg-background text-foreground", "w-[98vw] sm:w-[95vw] lg:w-[1000px] xl:w-[1200px] lg:max-w-none xl:max-w-none max-h-[96vh] overflow-y-auto p-4 sm:p-6 rounded-2xl sm:rounded-3xl border-border/40 shadow-2xl")}>
            <DialogHeader className="px-2 pt-2 sm:px-0 sm:pt-0">
              <DialogTitle className={cn("text-xl sm:text-2xl font-bold break-words text-left", summaryLoading && "sr-only")}>
                {summaryLoading ? "Loading Profile..." : `Customer Profile: ${customerSummary?.customer?.firstName} ${customerSummary?.customer?.lastName}`}
              </DialogTitle>
              {!summaryLoading && (
                <DialogDescription className="text-sm sm:text-base text-muted-foreground text-left mt-1">
                  <span className="break-all">{customerSummary?.customer?.email}</span>
                  <span className="mx-2 hidden sm:inline">•</span>
                  <span className="sm:inline block">
                    {customerSummary?.customer?.customerType === 'B2C' || customerSummary?.customer?.customerType === 'B2B' ? 'Wholesale' : 'Enterprise'}
                  </span>
                  {customerSummary?.customer?.salesRep && (
                    <span className="block mt-1.5 text-[10px] sm:text-sm font-medium text-primary break-words">
                      Assigned to: {customerSummary.customer.salesRep.name} ({customerSummary.customer.salesRep.email})
                    </span>
                  )}
                </DialogDescription>
              )}
            </DialogHeader>

            {summaryLoading ? (
              <div className="p-6 space-y-6">
                <div className="space-y-2"><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-48" /></div>
                <div className="grid grid-cols-3 gap-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
                <div className="grid grid-cols-2 gap-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>
              </div>
            ) : (
              <Tabs defaultValue="products" className="mt-6 sm:mt-8 flex flex-col h-full">
                <div className="w-full mb-6 sm:mb-8 px-1">
                  <div className="overflow-x-auto pb-1 scrollbar-hide">
                    <TabsList className="flex w-max min-w-full sm:grid sm:w-full sm:grid-cols-3 h-10 sm:h-11 bg-muted/50 p-1 gap-1 sm:gap-0">
                      <TabsTrigger value="products" className="text-xs sm:text-sm font-semibold h-full px-4 sm:px-0">Products</TabsTrigger>
                      <TabsTrigger value="orders" className="text-xs sm:text-sm font-semibold h-full px-4 sm:px-0">Orders</TabsTrigger>
                      <TabsTrigger value="growth" className="text-xs sm:text-sm font-semibold h-full px-4 sm:px-0">Growth</TabsTrigger>
                    </TabsList>
                  </div>
                </div>

                <TabsContent value="products" className="mt-0 outline-none flex-1 px-1">
                  <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2">
                    {(customerSummary?.topProducts || []).map((p: any, i: number) => (
                      <div key={i} className="flex items-center p-3 sm:p-4 rounded-2xl bg-muted/20 hover:bg-muted/40 transition-all border border-border/40 group shadow-sm gap-3 sm:gap-4 overflow-hidden">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-muted/50 shrink-0 border border-border/20">
                          {p.image ? (
                            <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground/40"><Users className="w-6 h-6 sm:w-8 sm:h-8" /></div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-bold text-foreground/90 group-hover:text-primary transition-colors leading-tight mb-1 truncate" title={p.name}>{p.name}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">{p.quantity} units</p>
                        </div>
                        <div className="text-right shrink-0 pl-1">
                          <span className="text-lg sm:text-xl font-black text-primary tracking-tight whitespace-nowrap">{formatCurrency(p.revenue)}</span>
                        </div>
                      </div>
                    ))}
                    {(customerSummary?.topProducts || []).length === 0 && (
                      <div className="col-span-full text-center py-12 sm:py-20 bg-muted/10 rounded-2xl sm:rounded-3xl border-2 border-dashed border-muted">
                        <p className="text-sm sm:text-base text-muted-foreground font-semibold">No history found.</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="orders" className="mt-0 outline-none flex-1 px-1">
                  <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2">
                    {(customerSummary?.recentOrders || []).map((o: any) => (
                      <div key={o.id} className="flex flex-col border rounded-2xl sm:rounded-3xl p-4 sm:p-6 hover:border-primary/40 transition-all bg-card/60 shadow-sm hover:shadow-xl group relative overflow-hidden">
                        <div className="flex flex-col xs:flex-row items-start justify-between gap-3 mb-4">
                          <div className="space-y-1 sm:space-y-1.5 min-w-0 flex-1">
                            <span className="font-mono text-[10px] sm:text-xs font-bold bg-muted/80 text-muted-foreground px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg group-hover:text-primary group-hover:bg-primary/5 transition-colors block w-fit truncate">#{o.orderNumber}</span>
                            <p className="text-[10px] sm:text-xs text-muted-foreground font-semibold pl-1 uppercase tracking-wider">{new Date(o.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
                          </div>
                          <div className="text-left xs:text-right flex flex-col items-start xs:items-end shrink-0">
                            <p className="text-lg sm:text-2xl font-black text-primary leading-none mb-2 whitespace-nowrap">{formatCurrency(o.totalAmount)}</p>
                            <span className="capitalize border px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-primary/5 border-primary/20 text-primary font-bold text-[9px] sm:text-[10px] tracking-wider inline-block">
                              {o.status.toLowerCase()}
                            </span>
                          </div>
                        </div>
                        <div className="mt-auto pt-4 sm:pt-5 border-t border-dashed border-border/80 flex flex-col items-stretch gap-4">
                          <div className="flex-1">
                            <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/60 mb-2 sm:mb-3">Composition</p>
                            <div className="flex flex-wrap gap-1.5 sm:gap-2">
                              {o.items.map((it: any, j: number) => (
                                <span key={j} className="text-[10px] sm:text-[11px] bg-secondary/50 text-secondary-foreground px-2 sm:px-3 py-1 sm:py-2 rounded-lg sm:rounded-xl font-bold border border-border/20 shadow-sm backdrop-blur-sm">
                                  {it.quantity}x {it.name}
                                </span>
                              ))}
                            </div>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => handleEditOrder(o.id)} className="w-full rounded-xl border-primary/20 hover:border-primary/50 hover:bg-primary/5 font-bold shadow-sm transition-all group/btn h-8 px-3 text-[10px] sm:text-[11px]">
                            <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1.5 text-primary group-hover/btn:scale-110 transition-transform" />
                            View Order
                          </Button>
                        </div>
                      </div>
                    ))}
                    {(customerSummary?.recentOrders || []).length === 0 && (
                      <div className="col-span-full text-center py-12 sm:py-20 bg-muted/10 rounded-2xl sm:rounded-3xl border-2 border-dashed border-muted">
                        <p className="text-sm sm:text-base text-muted-foreground font-semibold">No recent orders found.</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="growth" className="mt-0 outline-none flex-1 px-1">
                  <div className="border-none shadow-none bg-muted/5 rounded-2xl sm:rounded-3xl p-3 sm:p-6">
                    <p className="text-base sm:text-lg font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                      Monthly Revenue Growth
                      <span className="text-[10px] w-fit font-medium text-muted-foreground bg-background px-3 py-1 rounded-full border border-border/50">Last 12 Months</span>
                    </p>
                    <div className="h-[250px] sm:h-[350px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={customerSummary?.monthlyGrowth || []} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorRevenueCustomer" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} dy={10} interval={0} angle={0} textAnchor={'middle'} height={30} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v.toLocaleString()}`} width={50} />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-background border border-border/20 p-3 rounded-xl shadow-xl backdrop-blur-md">
                                    <div className="flex flex-col gap-1">
                                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">{payload[0].payload.month}</p>
                                      <div className="flex flex-col">
                                        <p className="text-base sm:text-lg font-black text-primary tracking-tight">{formatCurrency(payload[0].value as number)}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                          <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                                          <p className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">{payload[0].payload.orders} Orders</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenueCustomer)" animationDuration={1500} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

        {/* Dedicated Dialog for Customer Orders Tab */}
        <Dialog open={!!selectedFreqCustomerId} onOpenChange={(open) => !open && setSelectedFreqCustomerId(null)}>
          <DialogContent className={cn("flex flex-col bg-background text-foreground", "w-[98vw] sm:w-[95vw] lg:w-[1000px] xl:w-[1200px] lg:max-w-none xl:max-w-none max-h-[96vh] overflow-y-auto p-4 sm:p-6 rounded-2xl sm:rounded-3xl border-border/40 shadow-2xl")}>
            <DialogHeader className="px-2 pt-2 sm:px-0 sm:pt-0 pb-4 border-b border-border/40">
              <DialogTitle className={cn("text-lg sm:text-2xl font-black tracking-tight flex items-center gap-3", summaryLoading && "sr-only")}>
                {summaryLoading ? "Loading Profile..." : (
                  <>
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex flex-col text-left">
                      <span>Customer Profile: {customerSummary?.customer?.firstName} {customerSummary?.customer?.lastName}</span>
                    </div>
                  </>
                )}
              </DialogTitle>
              {!summaryLoading && (
                <div className="mt-4 flex flex-col gap-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center flex-wrap gap-2 sm:gap-4 text-sm font-medium text-muted-foreground mt-2">
                    <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-lg w-fit">
                      <Mail className="w-4 h-4 shrink-0 text-primary/60" />
                      <span className="truncate max-w-[200px] sm:max-w-none">{customerSummary?.customer?.email}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-lg w-fit border border-emerald-500/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {customerSummary?.customer?.customerType === 'B2C' || customerSummary?.customer?.customerType === 'B2B' ? 'Wholesale' : 'Enterprise'}
                    </div>
                    {customerSummary?.customer?.salesRep ? (
                      <div className="flex items-center gap-2 text-xs sm:text-sm bg-primary/5 border border-primary/10 px-3 py-1.5 rounded-lg w-fit">
                        <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider mr-1">Assigned:</span>
                        <span className="font-semibold text-foreground/90">{customerSummary.customer.salesRep.name}</span>
                        <span className="text-muted-foreground font-normal hidden lg:inline-block ml-1">({customerSummary.customer.salesRep.email})</span>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground/60 italic font-medium px-1">Unassigned Representative</div>
                    )}
                  </div>
                </div>
              )}
            </DialogHeader>

            {summaryLoading ? (
              <div className="p-4 sm:p-6 space-y-6">
                <div className="space-y-4"><Skeleton className="h-20 w-full rounded-2xl" /><Skeleton className="h-20 w-full rounded-2xl" /><Skeleton className="h-20 w-full rounded-2xl" /></div>
              </div>
            ) : (
              <Tabs defaultValue="orders" className="mt-6 flex flex-col h-full gap-4">
                <div className="w-full px-1">
                  <div className="overflow-x-auto pb-1 scrollbar-hide">
                    <TabsList className="flex w-max min-w-full sm:grid sm:w-full sm:grid-cols-2 h-10 sm:h-11 bg-muted/50 p-1 gap-1 sm:gap-0">
                      <TabsTrigger value="orders" className="text-xs sm:text-sm font-semibold h-full px-4 sm:px-0">Orders</TabsTrigger>
                      <TabsTrigger value="products" className="text-xs sm:text-sm font-semibold h-full px-4 sm:px-0">Products</TabsTrigger>
                    </TabsList>
                  </div>
                </div>

                <TabsContent value="orders" className="mt-0 outline-none">
                  <div className="flex flex-col">
                    <h3 className="text-sm font-black uppercase tracking-[0.15em] text-muted-foreground/50 mb-4 px-1 flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-primary/40" />
                      Orders List
                    </h3>
                    <div className="overflow-hidden border border-border/40 rounded-2xl bg-card/30">
                      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-primary/10 scrollbar-track-transparent">
                        <Table>
                          <TableHeader className="bg-muted/30">
                            <TableRow className="hover:bg-transparent border-border/40">
                              <TableHead className="w-[120px] text-[10px] font-black uppercase tracking-wider h-10">Order #</TableHead>
                              <TableHead className="w-[140px] text-[10px] font-black uppercase tracking-wider h-10">Date</TableHead>
                              <TableHead className="min-w-[200px] text-[10px] font-black uppercase tracking-wider h-10">Composition</TableHead>
                              <TableHead className="text-right w-[100px] text-[10px] font-black uppercase tracking-wider h-10">Total</TableHead>
                              <TableHead className="w-[100px] text-[10px] font-black uppercase tracking-wider h-10">Status</TableHead>
                              <TableHead className="w-[80px] text-right h-10"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(customerSummary?.recentOrders || []).map((o: any) => (
                              <TableRow key={o.id} className="group hover:bg-primary/5 transition-colors border-border/40">
                                <TableCell className="py-3">
                                  <button onClick={() => handleEditOrder(o.id)} className="font-mono text-[11px] font-bold bg-muted/60 text-muted-foreground px-2 py-0.5 rounded hover:text-primary hover:bg-primary/5 transition-colors cursor-pointer">
                                    #{o.orderNumber}
                                  </button>
                                </TableCell>
                                <TableCell className="py-3">
                                  <span className="text-[11px] text-muted-foreground font-semibold">{new Date(o.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                                </TableCell>
                                <TableCell className="py-3">
                                  <div className="flex flex-wrap gap-1">
                                    {o.items.map((it: any, j: number) => (
                                      <span key={j} className="text-[10px] bg-secondary/30 text-secondary-foreground px-1.5 py-0.5 rounded font-bold border border-border/10 whitespace-nowrap">
                                        {it.quantity}x {it.name}
                                      </span>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right py-3">
                                  <span className="text-xs sm:text-sm font-black text-primary">{formatCurrency(o.totalAmount)}</span>
                                </TableCell>
                                <TableCell className="py-3">
                                  <span className="capitalize border px-2 py-0.5 rounded-full bg-primary/5 border-primary/20 text-primary font-bold text-[9px] tracking-wider inline-block">{o.status.toLowerCase()}</span>
                                </TableCell>
                                <TableCell className="text-right py-3">
                                  <Button variant="ghost" size="icon" onClick={() => handleEditOrder(o.id)} className="w-8 h-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-all">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {(customerSummary?.recentOrders || []).length === 0 && (
                          <div className="flex flex-col items-center justify-center py-20 bg-muted/5">
                            <CalendarIcon className="w-12 h-12 text-muted/20 mb-3" />
                            <p className="text-sm text-muted-foreground font-semibold">No orders found in this period.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="products" className="mt-0 outline-none">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.15em] text-muted-foreground/50 mb-4 px-1 flex items-center gap-2">
                      <Package className="w-4 h-4 text-primary/40" />
                      Top Ordered Products
                    </h3>
                    <div className="flex flex-col gap-3">
                      {(customerSummary?.topProducts || []).map((p: any, i: number) => (
                        <div key={i} className="flex items-center p-3 sm:p-4 rounded-2xl bg-muted/20 hover:bg-muted/40 transition-all border border-border/40 group shadow-sm gap-3 sm:gap-4 overflow-hidden relative">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20 group-hover:bg-primary transition-colors" />
                          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden bg-background shrink-0 border border-border/50 shadow-sm p-1">
                            {p.image ? (
                              <img src={p.image} alt={p.name} className="w-full h-full object-cover rounded-lg" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground/40 bg-muted/30 rounded-lg"><Package className="w-6 h-6" /></div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] sm:text-sm font-bold text-foreground/90 group-hover:text-primary transition-colors leading-tight mb-1" title={p.name}>{p.name}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] sm:text-xs font-black bg-secondary/50 text-secondary-foreground border border-border/50 px-2 py-0.5 rounded-md">{p.quantity} units</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0 pl-1">
                            <span className="text-base sm:text-lg font-black text-primary tracking-tight whitespace-nowrap">{formatCurrency(p.revenue)}</span>
                          </div>
                        </div>
                      ))}
                      {(customerSummary?.topProducts || []).length === 0 && (
                        <div className="text-center py-10 bg-muted/10 rounded-2xl border-2 border-dashed border-muted">
                          <p className="text-sm text-muted-foreground font-semibold">No product history found.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

        <EditOrderDialog
          order={editingOrder}
          open={!!editingOrder}
          onOpenChange={(open) => !open && setEditingOrder(null)}
          onSuccess={handleOrderUpdated}
          onDelete={handleDeleteOrder}
        />
      </div>
    </DashboardLayout>
  );
}
