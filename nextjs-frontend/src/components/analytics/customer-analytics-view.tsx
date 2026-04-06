"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Users, ExternalLink } from "lucide-react";
import { api, formatCurrency, Order } from "@/lib/api";
import { OrderDateFilter } from "@/components/orders/order-date-filter";
import { EditOrderDialog } from "@/components/orders/edit-order-dialog";
import { cn } from "@/lib/utils";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import logger from "@/lib/logger";

interface CustomerAnalyticsViewProps {
    managerId?: string;
    isSalesManagerView?: boolean;
}

export function CustomerAnalyticsView({ managerId, isSalesManagerView = false }: CustomerAnalyticsViewProps) {
    const [range, setRange] = useState("last_30_days");
    const [from, setFrom] = useState<Date | null>(null);
    const [to, setTo] = useState<Date | null>(null);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>({ segments: [], topCustomers: [] });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [customerSummary, setCustomerSummary] = useState<any>(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    const fetchCustomerSummary = async (customerId: string) => {
        try {
            setSummaryLoading(true);
            const res = await api.getCustomerSummary(customerId);
            if (res.success) setCustomerSummary(res.data);
        } catch (e) {
            logger.error("Failed to fetch customer summary", { error: e, customerId });
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
            logger.error("Error fetching order details", { error, orderId });
            toast.error("Failed to load order details");
        }
    };

    const handleOrderUpdated = () => {
        setEditingOrder(null);
        if (selectedCustomerId) {
            fetchCustomerSummary(selectedCustomerId);
        }
        toast.success("Order updated successfully");
    };

    const handleDeleteOrder = async (orderId: string) => {
        try {
            const res = await api.hardDeleteOrder(orderId);
            if (res.success) {
                setEditingOrder(null);
                if (selectedCustomerId) {
                    fetchCustomerSummary(selectedCustomerId);
                }
                toast.success("Order deleted successfully");
            }
        } catch (error) {
            logger.error("Failed to delete order", { error, orderId });
            toast.error("Failed to delete order");
        }
    };

    useEffect(() => {
        if (selectedCustomerId) {
            fetchCustomerSummary(selectedCustomerId);
        }
    }, [selectedCustomerId]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setCurrentPage(1); // Reset to first page on search
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
                }

                const res = await api.getCustomerInsights(
                    rangeToSend as any,
                    fromToSend || undefined,
                    toToSend || undefined,
                    debouncedSearch || undefined,
                    managerId
                );
                if (res.success && res.data) setData(res.data);
                else {
                    toast.error(res.error || "Failed to load customer insights");
                    setData({ segments: [], topCustomers: [] });
                }
            } catch (e: any) {
                logger.error("[CustomerInsights] API error", { error: e });
                toast.error(e?.message || "Failed to load customer insights");
                setData({ segments: [], topCustomers: [] });
            } finally {
                setLoading(false);
            }
        })();
    }, [range, from, to, debouncedSearch, managerId]);

    const segmentChart = useMemo(() => {
        const total = (data.segments || []).reduce((s: number, x: any) => s + x._count?.id || 0, 0) || 1;
        const palette = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

        const aggregated: Record<string, number> = {
            'Wholesale': 0,
            'Enterprise': 0
        };

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
            .map(([name, value], idx) => ({
                name,
                value,
                color: palette[idx % palette.length]
            }));
    }, [data]);

    const csv = useMemo(() => {
        const header = "name,email,sales_rep,orders,revenue,customerType,since";
        const rows = (data.topCustomers || [])
            .filter((c: any) => c.customerType !== 'ENTERPRISE')
            .map((c: any) => {
                let displayType = c.customerType;
                if (c.customerType === 'B2C' || c.customerType === 'B2B') {
                    displayType = 'Wholesale';
                } else if (c.customerType === 'ENTERPRISE_1' || c.customerType === 'ENTERPRISE_2') {
                    displayType = 'Enterprise';
                }
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

    return (
        <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">{isSalesManagerView ? "Assigned Customer Analytics" : "Customer Insights"}</h2>
                    <p className="text-muted-foreground text-sm">Segments, value, and top customers</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <OrderDateFilter
                        range={range}
                        setRange={setRange}
                        from={from || undefined}
                        setFrom={(d) => setFrom(d || null)}
                        to={to || undefined}
                        setTo={(d) => setTo(d || null)}
                    />
                    <Button variant="outline" onClick={downloadCsv} className="w-full sm:w-auto">
                        <Download className="h-4 w-4 mr-2" /> Export
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
                <Card className="md:col-span-2 overflow-hidden">
                    <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <CardTitle>Top Customers</CardTitle>
                            <CardDescription>By revenue</CardDescription>
                        </div>
                        <div className="relative w-full sm:w-72">
                            <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search name or email..."
                                className="w-full pl-9 pr-4 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                        <Table className="min-w-[700px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>#</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Sales Rep</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Orders</TableHead>
                                    <TableHead>Revenue</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(() => {
                                    const filteredCustomers = (data.topCustomers || []).filter((c: any) => c.customerType !== 'ENTERPRISE');
                                    const startIndex = (currentPage - 1) * itemsPerPage;
                                    const paginatedCustomers = filteredCustomers.slice(startIndex, startIndex + itemsPerPage);

                                    if (loading) {
                                        return Array.from({ length: 5 }).map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell colSpan={6} className="h-12 animate-pulse bg-muted/20" />
                                            </TableRow>
                                        ));
                                    }

                                    if (paginatedCustomers.length === 0) {
                                        return (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                                    No customers found
                                                </TableCell>
                                            </TableRow>
                                        );
                                    }

                                    return paginatedCustomers.map((c: any, idx: number) => {
                                        let displayType = c.customerType;
                                        if (c.customerType === 'B2C' || c.customerType === 'B2B') {
                                            displayType = 'Wholesale';
                                        } else if (c.customerType === 'ENTERPRISE_1' || c.customerType === 'ENTERPRISE_2') {
                                            displayType = 'Enterprise';
                                        }
                                        return (
                                            <TableRow
                                                key={c.id || idx}
                                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                                onClick={() => setSelectedCustomerId(c.id)}
                                            >
                                                <TableCell>{startIndex + idx + 1}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-primary hover:underline">{c.name}</span>
                                                        <span className="text-xs text-muted-foreground truncate max-w-[150px]">{c.email}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {c.salesRep ? (
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-medium">{c.salesRep.name}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] text-muted-foreground italic">Unassigned</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>{displayType}</TableCell>
                                                <TableCell>{c.orders}</TableCell>
                                                <TableCell className="font-bold">{formatCurrency(c.revenue)}</TableCell>
                                            </TableRow>
                                        );
                                    });
                                })()}
                            </TableBody>
                        </Table>
                        {(() => {
                            const filteredCustomers = (data.topCustomers || []).filter((c: any) => c.customerType !== 'ENTERPRISE');
                            const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);

                            if (totalPages <= 1) return null;

                            return (
                                <div className="flex items-center justify-between mt-4">
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                                        Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredCustomers.length)} of {filteredCustomers.length}
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 w-8 p-0"
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                        >
                                            &lt;
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 w-8 p-0"
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                        >
                                            &gt;
                                        </Button>
                                    </div>
                                </div>
                            );
                        })()}
                    </CardContent>
                </Card>

                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle>Segments</CardTitle>
                        <CardDescription>By customer type</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col items-center gap-6">
                            <div className="w-full">
                                <ResponsiveContainer width="100%" height={200}>
                                    <PieChart>
                                        <Pie data={segmentChart} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value">
                                            {segmentChart.map((entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ background: 'var(--popover)', color: 'var(--popover-foreground)', border: '1px solid var(--border)', borderRadius: '12px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="w-full space-y-2">
                                {segmentChart.map((s: any) => (
                                    <div key={s.name} className="flex items-center justify-between p-2 rounded-xl bg-muted/20 border border-border/50">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                            <span className="text-xs font-bold">{s.name}</span>
                                        </div>
                                        <span className="text-sm font-black text-primary">{s.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={!!selectedCustomerId} onOpenChange={(open) => !open && setSelectedCustomerId(null)}>
                <DialogContent className={cn("flex flex-col bg-background text-foreground", "w-[95vw] sm:w-auto sm:max-w-[1000px] max-h-[90vh] overflow-y-auto rounded-3xl")}>
                    <DialogHeader>
                        <DialogTitle className={cn("text-xl", summaryLoading && "sr-only")}>
                            {summaryLoading ? "Loading Profile..." : `Customer Profile: ${customerSummary?.customer?.firstName} ${customerSummary?.customer?.lastName}`}
                        </DialogTitle>
                        {!summaryLoading && (
                            <DialogDescription className="text-sm text-muted-foreground">
                                {customerSummary?.customer?.email} • {customerSummary?.customer?.customerType === 'B2C' || customerSummary?.customer?.customerType === 'B2B' ? 'Wholesale' : 'Enterprise'}
                                {customerSummary?.customer?.salesRep && (
                                    <span className="block mt-1 text-xs font-medium text-primary">
                                        Assigned to: {customerSummary.customer.salesRep.name}
                                    </span>
                                )}
                            </DialogDescription>
                        )}
                    </DialogHeader>

                    {summaryLoading ? (
                        <div className="flex items-center justify-center p-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : (
                        <Tabs defaultValue="products" className="mt-4 flex flex-col h-full">
                            <TabsList className="grid w-full grid-cols-3 h-10 bg-muted/50 p-1 mb-6">
                                <TabsTrigger value="products" className="text-xs font-bold">Products</TabsTrigger>
                                <TabsTrigger value="orders" className="text-xs font-bold">Orders</TabsTrigger>
                                <TabsTrigger value="growth" className="text-xs font-bold">Growth</TabsTrigger>
                            </TabsList>

                            <TabsContent value="products" className="mt-0 outline-none flex-1">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {(customerSummary?.topProducts || []).map((p: any, i: number) => (
                                        <div key={i} className="flex items-center p-3 rounded-2xl bg-muted/20 border border-border/50 gap-3">
                                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted/50 shrink-0">
                                                {p.image ? (
                                                    <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground/20">
                                                        <Users className="w-6 h-6" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-bold truncate">{p.name}</p>
                                                <p className="text-[10px] text-muted-foreground">{p.quantity} units</p>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-sm font-black text-primary">{formatCurrency(p.revenue)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </TabsContent>

                            <TabsContent value="orders" className="mt-0 outline-none flex-1">
                                <div className="space-y-3">
                                    {(customerSummary?.recentOrders || []).map((o: any) => (
                                        <div key={o.id} className="flex items-center justify-between p-4 border rounded-2xl bg-card/60 shadow-sm">
                                            <div className="space-y-1">
                                                <span className="font-mono text-[10px] font-bold bg-muted px-2 py-0.5 rounded text-muted-foreground">#{o.orderNumber}</span>
                                                <p className="text-[10px] text-muted-foreground uppercase font-bold">{new Date(o.createdAt).toLocaleDateString()}</p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <p className="text-sm font-black text-primary">{formatCurrency(o.totalAmount)}</p>
                                                    <span className="text-[9px] uppercase font-black text-muted-foreground">{o.status}</span>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleEditOrder(o.id)}
                                                    className="h-8 w-8 p-0"
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </TabsContent>

                            <TabsContent value="growth" className="mt-0 outline-none flex-1">
                                <div className="h-[300px] w-full bg-muted/10 rounded-2xl p-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={customerSummary?.monthlyGrowth || []}>
                                            <defs>
                                                <linearGradient id="colorRevenueCustomerView" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                                            <XAxis dataKey="month" fontSize={10} tickLine={false} axisLine={false} />
                                            <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                                            <Tooltip />
                                            <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#colorRevenueCustomerView)" strokeWidth={2} />
                                        </AreaChart>
                                    </ResponsiveContainer>
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
    );
}
