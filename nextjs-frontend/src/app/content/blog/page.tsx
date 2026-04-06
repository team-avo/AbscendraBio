"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProtectedRoute } from "@/contexts/auth-context";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit3, Search, Calendar, MoreHorizontal, Eye, Globe } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";

type BlogRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  views: number;
  updatedAt?: string;
};

export default function BlogManagerPage() {
  const [rows, setRows] = useState<BlogRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const normalizedSearch = useMemo(() => search.trim(), [search]);

  const load = async () => {
    setLoading(true);
    const resp = await api.getContentPages({ page: 1, limit: 50, search: normalizedSearch || undefined, type: 'BLOG_POST', status: (statusFilter as any) || undefined });
    setLoading(false);
    if (resp.success && resp.data) {
      setRows((resp.data.pages || []).map((p: any) => ({ id: p.id, title: p.title, slug: p.slug, status: p.status, views: p.views || 0, updatedAt: p.updatedAt })));
    } else {
      setRows([]);
    }
  };
  const onPreview = (row: BlogRow) => {
    const path = `/p/${row.slug.replace(/^\//, "")}`;
    const url = `${window.location.origin}${path}?preview=1`;
    window.open(url, "_blank", "noopener,noreferrer");
  };
  const onViewLive = (row: BlogRow) => {
    const path = `/p/${row.slug.replace(/^\//, "")}`;
    const url = `${window.location.origin}${path}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  useEffect(() => { load(); }, [normalizedSearch, statusFilter]);

  return (
    <ProtectedRoute requiredRoles={["ADMIN", "MANAGER", "STAFF"]}>
      <DashboardLayout>
        <div className="space-y-6 px-2 sm:px-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Blog</h1>
              <p className="text-sm sm:text-base text-muted-foreground">Manage blog posts</p>
            </div>
            <Button onClick={() => router.push('/content/blog/new')} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" /> New Post
            </Button>
          </div>

          <Tabs defaultValue="posts" className="space-y-6">
            <div className="w-full overflow-x-auto pb-2">
              <TabsList>
                <TabsTrigger value="posts">Posts</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="posts">
              <Card>
                <CardHeader>
                  <CardTitle>Posts</CardTitle>
                  <CardDescription>Search, filter and edit posts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-center">
                    <div className="relative w-full sm:w-auto">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search posts..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-full sm:w-72" />
                    </div>
                    <Select value={statusFilter || undefined} onValueChange={(v) => setStatusFilter(v === 'ALL_STATUS' ? '' : v)}>
                      <SelectTrigger className="w-full sm:w-40">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL_STATUS">All Status</SelectItem>
                        <SelectItem value="PUBLISHED">Published</SelectItem>
                        <SelectItem value="DRAFT">Draft</SelectItem>
                        <SelectItem value="ARCHIVED">Archived</SelectItem>
                        <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="overflow-x-auto -mx-6 sm:mx-0">
                    <Table className="min-w-[700px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>URL</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Views</TableHead>
                          <TableHead>Last Modified</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(loading ? [] : rows).map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.title}</TableCell>
                            <TableCell>
                              <code className="text-sm bg-muted px-2 py-1 rounded">/{p.slug}</code>
                            </TableCell>
                            <TableCell>
                              <Badge>{p.status}</Badge>
                            </TableCell>
                            <TableCell>{p.views.toLocaleString()}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {p.updatedAt ? new Date(p.updatedAt).toISOString().slice(0, 10) : ""}
                              </div>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => router.push(`/content/pages/${p.id}/edit`)}>
                                    <Edit3 className="h-4 w-4 mr-2" />
                                    Edit Post
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => onPreview(p)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    Preview Post
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem disabled={p.status !== 'PUBLISHED'} onClick={() => onViewLive(p)}>
                                    <Globe className="h-4 w-4 mr-2" />
                                    View Live
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Blog Analytics</CardTitle>
                  <CardDescription>Views over time and top posts</CardDescription>
                </CardHeader>
                <CardContent>
                  <BlogAnalyticsPanel />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function BlogAnalyticsPanel() {
  const [range, setRange] = useState<number>(30);
  const [series, setSeries] = useState<Array<{ day: string; views: number }>>([]);
  const [topPages, setTopPages] = useState<Array<{ id: string; title: string; slug: string; views: number }>>([]);
  const [posts, setPosts] = useState<Array<{ id: string; title: string; slug: string }>>([]);
  const [selected, setSelected] = useState<string>('ALL');
  const [hover, setHover] = useState<{ x: number; y: number; day: string; views: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [analytics, list] = await Promise.all([
        api.getPageAnalytics({ rangeDays: range, type: 'BLOG_POST' as any }),
        api.getContentPages({ page: 1, limit: 200, type: 'BLOG_POST' as any }),
      ]);
      if (mounted && analytics.success && (analytics as any).data) {
        const d: any = (analytics as any).data;
        setSeries(d.series || []);
        setTopPages((d.topPages || []).map((p: any) => ({ id: p.id, title: p.title, slug: p.slug, views: p.views })));
      }
      if (mounted && list.success && (list as any).data) {
        const arr = ((list as any).data.pages || []).map((p: any) => ({ id: p.id, title: p.title, slug: p.slug }));
        setPosts(arr);
      }
    })();
    return () => { mounted = false; };
  }, [range]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (selected !== 'ALL') {
        const resp = await api.getPageAnalyticsById(selected, { rangeDays: range });
        if (mounted && resp.success && (resp as any).data) {
          const d: any = (resp as any).data;
          setSeries(d.series || []);
        }
      }
    })();
    return () => { mounted = false; };
  }, [selected, range]);

  const total = series.reduce((s, p) => s + p.views, 0);
  const maxViews = Math.max(1, ...series.map(s => s.views));
  const width = 680;
  const height = 220;
  const margin = { top: 10, right: 10, bottom: 24, left: 36 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const barW = series.length ? Math.max(2, innerW / series.length - 2) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white rounded-xl border p-3 sm:p-4"><div className="text-[10px] sm:text-xs text-muted-foreground">Total views</div><div className="text-base sm:text-2xl font-bold">{total.toLocaleString()}</div></div>
        <div className="bg-white rounded-xl border p-3 sm:p-4"><div className="text-[10px] sm:text-xs text-muted-foreground">Average per day</div><div className="text-base sm:text-2xl font-bold">{Math.round(total / Math.max(1, series.length))}</div></div>
        <div className="bg-white rounded-xl border p-3 sm:p-4 col-span-2 md:col-span-1"><div className="text-[10px] sm:text-xs text-muted-foreground">Top post (range)</div><div className="text-xs sm:text-sm font-semibold truncate">{topPages[0]?.title || '—'}</div></div>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1 sm:gap-2">
          <span className="text-xs sm:text-sm text-muted-foreground">Range</span>
          <Select value={String(range)} onValueChange={(v) => setRange(parseInt(v, 10))}>
            <SelectTrigger className="w-full sm:w-[120px]"><SelectValue placeholder="Range" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1 sm:gap-2">
          <span className="text-xs sm:text-sm text-muted-foreground">Post</span>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-full sm:w-[240px]"><SelectValue placeholder="Select post" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              {posts.map((p) => (<SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-xl border p-4">
          <h4 className="font-semibold mb-3">Views over time</h4>
          <div className="overflow-x-auto">
            <svg width={width} height={height} className="bg-transparent">
              <g transform={`translate(${margin.left},${margin.top})`}>
                {Array.from({ length: 5 }).map((_, i) => {
                  const y = innerH - (innerH * i) / 4;
                  return <line key={i} x1={0} y1={y} x2={innerW} y2={y} stroke="#e5e7eb" strokeDasharray="4 4" />;
                })}
                {series.map((p, idx) => {
                  const h = maxViews ? (p.views / maxViews) * (innerH - 2) : 0;
                  const x = idx * (innerW / Math.max(1, series.length));
                  const y = innerH - h;
                  return (
                    <rect key={p.day} x={x + 2} y={y} width={barW} height={h} rx={3} className="fill-red-500/80 hover:fill-red-600 cursor-pointer" onMouseMove={(e) => setHover({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, day: p.day, views: p.views })} onMouseLeave={() => setHover(null)} />
                  );
                })}
                <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#d1d5db" />
                <line x1={0} y1={0} x2={0} y2={innerH} stroke="#d1d5db" />
                {Array.from({ length: 5 }).map((_, i) => {
                  const value = Math.round((maxViews * i) / 4);
                  const y = innerH - (innerH * i) / 4;
                  return (<text key={i} x={-8} y={y} textAnchor="end" alignmentBaseline="middle" className="fill-gray-500 text-[10px]">{value}</text>);
                })}
              </g>
            </svg>
            {hover && (
              <div className="pointer-events-none absolute mt-2 rounded-md border bg-white px-2 py-1 text-xs shadow" style={{ transform: `translate(${Math.min(hover.x, width - 120)}px, -${height - Math.min(hover.y, height - 40)}px)` }}>
                <div className="font-semibold">{hover.day}</div>
                <div className="text-muted-foreground">{hover.views.toLocaleString()} views</div>
              </div>
            )}
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <h4 className="font-semibold mb-3">Top posts</h4>
          <div className="space-y-3">
            {topPages.slice(0, 10).map((p, i) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <div className="truncate"><span className="mr-2 text-gray-400">{i + 1}.</span><span className="font-medium">{p.title}</span></div>
                <div className="text-right font-semibold">{p.views.toLocaleString()}</div>
              </div>
            ))}
            {topPages.length === 0 && (<div className="text-sm text-muted-foreground">No data for this range.</div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

