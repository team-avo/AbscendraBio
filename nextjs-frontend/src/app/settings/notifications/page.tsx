"use client";

import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProtectedRoute } from "@/contexts/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { api, formatDate } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import { Bell, RefreshCw, Filter, Download, Play, Pause } from "lucide-react";

type NotificationItem = { id: string; type: string; title: string; description?: string; createdAt: string; target?: string };

export default function NotificationsSettingsPage() {
  const [all, setAll] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [limit, setLimit] = useState(50);

  const load = async () => {
    setLoading(true);
    const res = await api.getNotifications({ limit });
    if (res.success && res.data) setAll(res.data.notifications || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [limit]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [autoRefresh, limit]);

  const filtered = useMemo(() => {
    return all
      .filter(n => (filter === "all" ? true :
        filter === "orders" ? (n.type === "order" || n.title.toLowerCase().includes("order")) :
        filter === "shipments" ? (n.type === "shipment" || n.title.toLowerCase().includes("shipment") || ["shipped","delivered"].some(k => n.description?.toLowerCase().includes(k))) :
        filter === "payments" ? (n.title.toLowerCase().includes("payment")) :
        filter === "inventory" ? (n.title.toLowerCase().includes("stock") || n.title.toLowerCase().includes("batch")) :
        true))
      .filter(n => !search || (n.title + " " + (n.description || "")).toLowerCase().includes(search.toLowerCase()));
  }, [all, filter, search]);

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-0">
          {/* ════════ DARK HERO STRIP ════════ */}
          <div className="relative bg-[#070B14] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#4D7DF2]/8 rounded-full blur-[100px] pointer-events-none" />
            <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-xl font-black text-white tracking-tight">Notifications</h1>
                  <p className="text-xs text-gray-500 mt-0.5">Manage and view system notifications</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={load} disabled={loading} className="flex items-center gap-1.5 h-9 px-3 bg-white/[0.06] border border-white/[0.08] rounded-xl text-xs font-bold text-gray-300 hover:bg-white/[0.12] hover:text-white transition-colors disabled:opacity-50">
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                  <button onClick={() => {
                    const csv = ['Title,Description,Type,Date', ...filtered.map(n => `"${(n.title||'').replace(/"/g,'""')}","${(n.description||'').replace(/"/g,'""')}",${n.type},${new Date(n.createdAt).toISOString()}`)].join('\n');
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'notifications.csv';
                    a.click();
                    URL.revokeObjectURL(url);
                  }} className="flex items-center gap-1.5 h-9 px-3 bg-white text-[#070B14] rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-100 transition-colors">
                    <Download className="h-3.5 w-3.5" />
                    Export CSV
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label>Filter</Label>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="orders">Orders</SelectItem>
                  <SelectItem value="shipments">Shipments</SelectItem>
                  <SelectItem value="payments">Payments</SelectItem>
                  <SelectItem value="inventory">Inventory</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label>Search</Label>
              <Input placeholder="Search notifications..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {/* Legend and load more */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500"></span> Orders</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-500"></span> Info</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500"></span> Success</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-500"></span> Warnings</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground"></span> Other</span>
            </div>
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap text-xs sm:text-sm">Items</Label>
              <Select value={String(limit)} onValueChange={(v) => setLimit(parseInt(v, 10))}>
                <SelectTrigger className="w-24">
                  <SelectValue placeholder="50" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Notifications</CardTitle>
              <CardDescription>Latest activity across your store</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[60vh] pr-3">
                <div className="space-y-2">
                  {filtered.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">No notifications</p>
                  )}
                  {filtered.map((n) => (
                    <div key={n.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/40">
                      <div className={`h-2 w-2 rounded-full mt-2 ${n.type === 'order' ? 'bg-blue-500' : n.type === 'warning' ? 'bg-yellow-500' : n.type === 'success' ? 'bg-green-500' : n.type === 'info' ? 'bg-sky-500' : 'bg-muted-foreground'}`}></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                          <p className="text-sm font-medium truncate">{n.title}</p>
                          <span className="text-xs text-muted-foreground">{formatDate(n.createdAt)}</span>
                        </div>
                        {n.description && <p className="text-xs text-muted-foreground break-words mt-1">{n.description}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {n.target && (
                          <Button variant="outline" size="sm" onClick={() => window.location.href = n.target!}>Open</Button>
                        )}
                        {/* <Button variant="outline" size="sm" onClick={() => {
                          navigator.clipboard.writeText(window.location.origin + (n.target || '/'));
                        }}>Copy link</Button> */}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}


