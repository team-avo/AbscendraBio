"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth, ProtectedRoute } from "@/contexts/auth-context";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart3 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { RichTextEditor } from "@/components/settings/rich-text-editor";
import { Plus, Edit3, Search, Globe, Calendar, Eye, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";

type PageRow = {
  id: string;
  title: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | "SCHEDULED";
  pageType: "STATIC_PAGE" | "BLOG_POST" | "LEGAL_PAGE" | "LANDING_PAGE" | "PRODUCT_PAGE" | "CUSTOM_PAGE";
  views: number;
  author?: { id: string; firstName: string; lastName: string } | null;
  updatedAt?: string;
  createdAt?: string;
  publishedAt?: string | null;
};

const statusToBadge = (s: string) => {
  const map: Record<string, "default" | "secondary" | "outline"> = {
    PUBLISHED: "default",
    DRAFT: "secondary",
    ARCHIVED: "outline",
    SCHEDULED: "default",
  };
  return map[s] ?? "secondary";
};

const typeLabel = (t: PageRow["pageType"]) => {
  switch (t) {
    case "STATIC_PAGE":
      return "Static Page";
    case "BLOG_POST":
      return "Blog Post";
    case "LEGAL_PAGE":
      return "Legal Page";
    case "LANDING_PAGE":
      return "Landing Page";
    case "PRODUCT_PAGE":
      return "Product Page";
    default:
      return "Custom Page";
  }
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-/]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\//, "")
    .replace(/\/+/, "/");
}

export default function PagesManagerPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [rows, setRows] = useState<PageRow[]>([]);
  const router = useRouter();

  // Form state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [pageType, setPageType] = useState<PageRow["pageType"]>("STATIC_PAGE");
  const [status, setStatus] = useState<PageRow["status"]>("DRAFT");
  const [isPublic, setIsPublic] = useState(true);
  const [allowComments, setAllowComments] = useState(false);
  const [excerpt, setExcerpt] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [metaKeywords, setMetaKeywords] = useState("");
  const [ogImage, setOgImage] = useState("");
  const [content, setContent] = useState<string>("");

  // Delete confirmation dialog state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PageRow | null>(null);
  // Status update dialog state
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<PageRow | null>(null);
  const [statusValue, setStatusValue] = useState<PageRow["status"]>("DRAFT");

  const normalizedSearch = useMemo(() => search.trim(), [search]);

  // legacy form state kept in case of future inline editing

  const loadPages = async () => {
    setLoading(true);
    const resp = await api.getContentPages({
      page: 1,
      limit: 50,
      search: normalizedSearch || undefined,
      status: (statusFilter as any) || undefined,
      type: (typeFilter as any) || undefined,
    });
    if (resp.success && resp.data) {
      const normalized = (resp.data.pages || []).map((p: any): PageRow => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        status: ((p.status || "DRAFT") as unknown) as PageRow["status"],
        pageType: ((p.pageType || "STATIC_PAGE") as unknown) as PageRow["pageType"],
        views: p.views || 0,
        author: p.author || null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        publishedAt: p.publishedAt ?? null,
      }));
      const filtered = (typeFilter ? normalized : normalized.filter((r) => r.pageType !== "BLOG_POST"));
      setRows(filtered);
    } else {
      setRows([]);
      if (resp.error) toast.error(resp.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedSearch, statusFilter, typeFilter]);

  useEffect(() => {
    const s = slugify(title);
    setSlug(s);
  }, [title]);

  const onCreate = () => {
    router.push('/content/pages/new');
  };

  const onEdit = (row: PageRow) => {
    router.push(`/content/pages/${row.id}/edit`);
  };

  const onPreview = (row: PageRow) => {
    const path = `/p/${row.slug.replace(/^\//, "")}`;
    const url = `${window.location.origin}${path}?preview=1`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const onViewLive = (row: PageRow) => {
    const path = `/p/${row.slug.replace(/^\//, "")}`;
    const url = `${window.location.origin}${path}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const confirmDelete = (row: PageRow) => {
    setDeleteTarget(row);
    setDeleteOpen(true);
  };

  const onDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    const resp = await api.deleteContentPage(deleteTarget.id);
    setLoading(false);
    if (!resp.success) {
      toast.error(resp.error || "Failed to delete page");
      return;
    }
    toast.success("Page deleted");
    setDeleteOpen(false);
    setDeleteTarget(null);
    loadPages();
  };

  const openStatusDialog = (row: PageRow) => {
    setStatusTarget(row);
    setStatusValue(row.status);
    setStatusOpen(true);
  };

  const onStatusSave = async () => {
    if (!statusTarget) return;
    if (!statusValue || statusValue === statusTarget.status) {
      setStatusOpen(false);
      return;
    }
    setLoading(true);
    const resp = await api.updateContentPage(statusTarget.id, { status: statusValue });
    setLoading(false);
    if (!resp.success) {
      toast.error(resp.error || "Failed to update status");
      return;
    }
    toast.success("Status updated");
    setStatusOpen(false);
    setStatusTarget(null);
    await loadPages();
  };

  // submit handled on dedicated pages now

  return (
    <ProtectedRoute requiredRoles={["ADMIN", "MANAGER", "STAFF"]}>
      <DashboardLayout>
        <div className="space-y-5 px-2 sm:px-0">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Pages</h1>
              <p className="text-sm sm:text-base text-muted-foreground">Create and manage website pages</p>
            </div>
            <Button
              onClick={onCreate}
              className="h-9 px-4 bg-[#1B2D4F] hover:bg-[#243d6b] text-white rounded-xl text-sm font-medium w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" /> New Page
            </Button>
          </div>

          <Tabs defaultValue="pages" className="space-y-5">
            <div className="w-full overflow-x-auto pb-2">
              <TabsList>
                <TabsTrigger value="pages">Pages</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="pages">
              {/* Filter bar */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-3 mb-4">
                <div className="flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-center">
                  <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search title or slug..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 w-full sm:w-72"
                    />
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
                  <Select value={typeFilter || undefined} onValueChange={(v) => setTypeFilter(v === 'ALL_TYPES' ? '' : v)}>
                    <SelectTrigger className="w-full sm:w-44">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL_TYPES">All Types</SelectItem>
                      <SelectItem value="STATIC_PAGE">Static Page</SelectItem>
                      <SelectItem value="BLOG_POST">Blog Post</SelectItem>
                      <SelectItem value="LEGAL_PAGE">Legal Page</SelectItem>
                      <SelectItem value="LANDING_PAGE">Landing Page</SelectItem>
                      <SelectItem value="PRODUCT_PAGE">Product Page</SelectItem>
                      <SelectItem value="CUSTOM_PAGE">Custom Page</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Table card */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                  <Globe className="h-5 w-5 text-slate-500" />
                  <div>
                    <div className="font-semibold text-slate-900">All Pages</div>
                    <div className="text-xs text-muted-foreground">Search, filter and edit pages</div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table className="min-w-[800px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>URL</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Views</TableHead>
                        <TableHead>Author</TableHead>
                        <TableHead>Last Modified</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(loading ? [] : rows).map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.title}</TableCell>
                          <TableCell>
                            <code className="text-sm bg-muted px-2 py-1 rounded">/{p.slug.replace(/^\//, "")}</code>
                          </TableCell>
                          <TableCell>{typeLabel(p.pageType)}</TableCell>
                          <TableCell>
                            <Badge variant={statusToBadge(p.status)}>
                              {p.status === "PUBLISHED"
                                ? "Published"
                                : p.status === "DRAFT"
                                  ? "Draft"
                                  : p.status === "ARCHIVED"
                                    ? "Archived"
                                    : "Scheduled"}
                            </Badge>
                          </TableCell>
                          <TableCell>{(p.views || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            {p.author ? `${p.author.firstName} ${p.author.lastName}` : "—"}
                          </TableCell>
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
                                <DropdownMenuItem onClick={() => onEdit(p)}>
                                  <Edit3 className="h-4 w-4 mr-2" />
                                  Edit Page
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onPreview(p)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Preview Page
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openStatusDialog(p)}>
                                  <Edit3 className="h-4 w-4 mr-2" />
                                  Change Status
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem disabled={p.status !== "PUBLISHED"} onClick={() => onViewLive(p)}>
                                  <Globe className="h-4 w-4 mr-2" />
                                  View Live
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onSelect={(e) => {
                                    e.preventDefault();
                                    confirmDelete(p);
                                  }}
                                >
                                  Delete Page
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="analytics">
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                  <BarChart3 className="h-5 w-5 text-slate-500" />
                  <div>
                    <div className="font-semibold text-slate-900">Page Analytics</div>
                    <div className="text-xs text-muted-foreground">Views over time and top pages</div>
                  </div>
                </div>
                <div className="p-6">
                  <AnalyticsPanel typeFilter={typeFilter} />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Creation and editing moved to dedicated pages */}

          {/* Delete confirmation dialog */}
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this page?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. The page "{deleteTarget?.title}" will be permanently deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDeleteConfirmed} className="bg-red-600 hover:bg-red-700">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Status update dialog */}
          <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Change Page Status</DialogTitle>
                <DialogDescription>
                  Update the publication status for "{statusTarget?.title}".
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">Current status:</div>
                {statusTarget && (
                  <Badge variant={statusToBadge(statusTarget.status)}>{statusTarget.status}</Badge>
                )}
                <div className="pt-2">
                  <Select value={statusValue} onValueChange={(v) => setStatusValue(v as PageRow["status"])}>
                    <SelectTrigger className="w-[240px]">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="PUBLISHED">Published</SelectItem>
                      <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                      <SelectItem value="ARCHIVED">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStatusOpen(false)}>Cancel</Button>
                <Button onClick={onStatusSave} disabled={!statusTarget || statusValue === statusTarget?.status}>
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}


function AnalyticsPanel({ typeFilter }: { typeFilter: string }) {
  const [range, setRange] = useState<number>(30);
  const [type, setType] = useState<string>((typeFilter || 'ALL'));
  const [series, setSeries] = useState<Array<{ day: string; views: number }>>([]);
  const [topPages, setTopPages] = useState<Array<{ id: string; title: string; slug: string; pageType: string; views: number }>>([]);
  const [pages, setPages] = useState<Array<{ id: string; title: string; slug: string }>>([]);
  const [selectedPage, setSelectedPage] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number; day: string; views: number } | null>(null);

  // Load summary analytics and page options
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const [analytics, list] = await Promise.all([
        api.getPageAnalytics({ rangeDays: range, type: (type || 'ALL') as any }),
        api.getContentPages({ page: 1, limit: 200, type: (type === 'ALL' ? undefined : (type as any)) }),
      ]);
      setLoading(false);
      if (mounted && analytics.success && (analytics as any).data) {
        const d: any = (analytics as any).data;
        setSeries(d.series || []);
        setTopPages(d.topPages || []);
      }
      if (mounted && list.success && (list as any).data) {
        const arr = ((list as any).data.pages || []).map((p: any) => ({ id: p.id, title: p.title, slug: p.slug }));
        setPages(arr);
        if (arr.length === 0) setSelectedPage('ALL');
      }
    })();
    return () => { mounted = false; };
  }, [range, type]);

  // Load specific page series when a page is selected
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (selectedPage && selectedPage !== 'ALL') {
        const resp = await api.getPageAnalyticsById(selectedPage, { rangeDays: range });
        if (mounted && resp.success && (resp as any).data) {
          const d: any = (resp as any).data;
          setSeries(d.series || []);
        }
      }
    })();
    return () => { mounted = false; };
  }, [selectedPage, range]);

  const total = series.reduce((s, p) => s + p.views, 0);
  const maxViews = Math.max(1, ...series.map(s => s.views));

  // SVG chart sizes
  const width = 680;
  const height = 220;
  const margin = { top: 10, right: 10, bottom: 24, left: 36 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const barW = series.length ? Math.max(2, innerW / series.length - 2) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white rounded-xl border p-3 sm:p-4">
          <div className="text-[10px] sm:text-xs text-muted-foreground">Total views</div>
          <div className="text-lg sm:text-2xl font-bold">{total.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl border p-3 sm:p-4">
          <div className="text-[10px] sm:text-xs text-muted-foreground">Average per day</div>
          <div className="text-lg sm:text-2xl font-bold">{Math.round(total / Math.max(1, series.length))}</div>
        </div>
        <div className="bg-white rounded-xl border p-3 sm:p-4 col-span-2 md:col-span-1">
          <div className="text-[10px] sm:text-xs text-muted-foreground">Top page (range)</div>
          <div className="text-xs sm:text-sm font-semibold truncate">{topPages[0]?.title || '—'}</div>
        </div>
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
          <span className="text-xs sm:text-sm text-muted-foreground">Type</span>
          <Select value={type} onValueChange={(v) => { setType(v); setSelectedPage('ALL'); }}>
            <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="STATIC_PAGE">Pages</SelectItem>
              <SelectItem value="BLOG_POST">Blog</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1 sm:gap-2">
          <span className="text-xs sm:text-sm text-muted-foreground">Page</span>
          <Select value={selectedPage} onValueChange={setSelectedPage}>
            <SelectTrigger className="w-full sm:w-[240px]"><SelectValue placeholder="Select page" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              {pages.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
              ))}
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
                {/* Y grid */}
                {Array.from({ length: 5 }).map((_, i) => {
                  const y = innerH - (innerH * i) / 4;
                  return <line key={i} x1={0} y1={y} x2={innerW} y2={y} stroke="#e5e7eb" strokeDasharray="4 4" />;
                })}
                {/* Bars */}
                {series.map((p, idx) => {
                  const h = maxViews ? (p.views / maxViews) * (innerH - 2) : 0;
                  const x = idx * (innerW / Math.max(1, series.length));
                  const y = innerH - h;
                  return (
                    <rect
                      key={p.day}
                      x={x + 2}
                      y={y}
                      width={barW}
                      height={h}
                      rx={3}
                      className="fill-red-500/80 hover:fill-red-600 cursor-pointer"
                      onMouseMove={(e) => setHover({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, day: p.day, views: p.views })}
                      onMouseLeave={() => setHover(null)}
                    />
                  );
                })}
                {/* Axes */}
                <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#d1d5db" />
                <line x1={0} y1={0} x2={0} y2={innerH} stroke="#d1d5db" />
                {/* Y labels */}
                {Array.from({ length: 5 }).map((_, i) => {
                  const value = Math.round((maxViews * i) / 4);
                  const y = innerH - (innerH * i) / 4;
                  return (
                    <text key={i} x={-8} y={y} textAnchor="end" alignmentBaseline="middle" className="fill-gray-500 text-[10px]">
                      {value}
                    </text>
                  );
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
          <h4 className="font-semibold mb-3">Top pages</h4>
          <div className="space-y-3">
            {topPages.slice(0, 10).map((p, i) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <div className="truncate"><span className="mr-2 text-gray-400">{i + 1}.</span><span className="font-medium">{p.title}</span></div>
                <div className="text-right font-semibold">{p.views.toLocaleString()}</div>
              </div>
            ))}
            {(!topPages || topPages.length === 0) && (
              <div className="text-sm text-muted-foreground">No data for this range.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
