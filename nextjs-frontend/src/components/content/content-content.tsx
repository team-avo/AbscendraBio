"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    FileText,
    Image,
    Video,
    Upload,
    Eye,
    Edit,
    Trash2,
    Plus,
    MoreHorizontal,
    Search,
    Globe,
    Calendar,
    User
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

type UIRow = {
    id: string;
    title: string;
    slug: string;
    status: string;
    type: string;
    lastModified: string;
    author: string;
    views: number;
};


const StatusBadge = ({ status }: { status: string }) => {
    const variants: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
        Published: "default",
        Draft: "secondary",
        Archived: "outline",
    };

    return <Badge variant={variants[status]}>{status}</Badge>;
};

const TypeBadge = ({ type }: { type: string }) => {
    const variants: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
        "Static Page": "outline",
        "Blog Post": "default",
        "Legal Page": "secondary",
    };

    return <Badge variant={variants[type]}>{type}</Badge>;
};

const MediaIcon = ({ type }: { type: string }) => {
    switch (type) {
        case "image":
            return <Image className="h-4 w-4" />;
        case "video":
            return <Video className="h-4 w-4" />;
        case "document":
            return <FileText className="h-4 w-4" />;
        default:
            return <FileText className="h-4 w-4" />;
    }
};

export function ContentContent() {
    const [searchTerm, setSearchTerm] = useState("");
    const [rows, setRows] = useState<UIRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [totalPages, setTotalPages] = useState(0);
    const [publishedPages, setPublishedPages] = useState(0);
    const [totalViews, setTotalViews] = useState(0);
    const [mediaCount, setMediaCount] = useState(0);
    const [mediaTotalBytes, setMediaTotalBytes] = useState(0);
    const router = useRouter();
    const normalizedFilter = useMemo(() => searchTerm.trim(), [searchTerm]);
    const [mainMenuItems, setMainMenuItems] = useState<any[]>([]);
    const [footerMenuItems, setFooterMenuItems] = useState<any[]>([]);

    useEffect(() => {
        let isMounted = true;
        const fetchPages = async () => {
            setLoading(true);
            const resp = await api.getContentPages({ page: 1, limit: 50, search: normalizedFilter || undefined });
            if (!isMounted) return;
            if (resp.success && resp.data) {
                const list = (resp.data.pages || []).map((p) => {
                    const statusLabel =
                        p.status === "PUBLISHED" ? "Published" : p.status === "DRAFT" ? "Draft" : p.status === "ARCHIVED" ? "Archived" : p.status || "Draft";
                    const typeLabel =
                        p.pageType === "STATIC_PAGE"
                            ? "Static Page"
                            : p.pageType === "BLOG_POST"
                                ? "Blog Post"
                                : p.pageType === "LEGAL_PAGE"
                                    ? "Legal Page"
                                    : p.pageType === "LANDING_PAGE"
                                        ? "Landing Page"
                                        : p.pageType === "PRODUCT_PAGE"
                                            ? "Product Page"
                                            : "Custom Page";
                    const authorName = p.author ? `${p.author.firstName} ${p.author.lastName}`.trim() : "Admin";
                    const updated = p.updatedAt ? new Date(p.updatedAt).toISOString().slice(0, 10) : "";
                    return {
                        id: p.id,
                        title: p.title,
                        slug: `/${p.slug.replace(/^\//, "")}`,
                        status: statusLabel,
                        type: typeLabel,
                        lastModified: updated,
                        author: authorName,
                        views: p.views || 0,
                    } as UIRow;
                });
                setRows(list);
            } else {
                setRows([]);
            }
            setLoading(false);
        };
        fetchPages();
        const fetchStats = async () => {
            const s = await api.getContentStats();
            if (!isMounted) return;
            if (s.success && s.data) {
                setTotalPages(s.data.totalPages || 0);
                setPublishedPages(s.data.publishedPages || 0);
                setTotalViews(s.data.totalViews || 0);
                setMediaCount(s.data.mediaCount || 0);
                setMediaTotalBytes(s.data.mediaTotalBytes || 0);
            }
        };
        fetchStats();
        const fetchNav = async () => {
            const m = await api.getNavigationMenus();
            if (!isMounted) return;
            if (m.success && m.data) {
                const menus = m.data.menus || [];
                const main = menus.find((x: any) => x.location === 'main');
                const footer = menus.find((x: any) => x.location === 'footer');
                if (main) {
                    const r = await api.getNavigationItems(main.id);
                    if (r.success && r.data) setMainMenuItems((r.data.items || []).slice(0, 4));
                }
                if (footer) {
                    const r = await api.getNavigationItems(footer.id);
                    if (r.success && r.data) setFooterMenuItems((r.data.items || []).slice(0, 4));
                }
            }
        };
        fetchNav();
        return () => {
            isMounted = false;
        };
    }, [normalizedFilter]);

    const formatBytes = (bytes: number) => {
        if (!bytes) return "0 B";
        const units = ["B", "KB", "MB", "GB", "TB"]; let i = 0; let val = bytes;
        while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
        return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
    };

    const onCreatePage = () => router.push('/content/pages/new');
    const onEdit = (row: UIRow) => router.push(`/content/pages/${row.id}/edit`);
    const onPreview = (row: UIRow) => {
        const path = `/p/${row.slug.replace(/^\//, "")}`;
        window.open(`${window.location.origin}${path}?preview=1`, "_blank", "noopener,noreferrer");
    };
    const onViewLive = (row: UIRow) => {
        const path = `/p/${row.slug.replace(/^\//, "")}`;
        window.open(`${window.location.origin}${path}`, "_blank", "noopener,noreferrer");
    };
    const onDelete = async (row: UIRow) => {
        const resp = await api.deleteContentPage(row.id);
        if (resp.success) {
            setRows(prev => prev.filter(r => r.id !== row.id));
        }
    };

    return (
        <div className="space-y-0">
            {/* ════════ DARK HERO STRIP ════════ */}
            <div className="relative bg-[#070B14] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#4D7DF2]/8 rounded-full blur-[100px] pointer-events-none" />

                <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-xl font-black text-white tracking-tight">Content Management</h1>
                            <p className="text-xs text-gray-500 mt-0.5">Manage your website content, pages, and media assets</p>
                        </div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <div className="flex items-center gap-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-2">
                                <FileText className="h-4 w-4 text-[#4D7DF2]" />
                                <div>
                                    <p className="text-[9px] text-gray-500 font-medium uppercase tracking-widest leading-none">Pages</p>
                                    <p className="text-base font-black text-white tabular-nums leading-tight">{totalPages}</p>
                                </div>
                            </div>
                            <button onClick={onCreatePage} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-[#070B14] hover:bg-gray-100 text-xs font-black uppercase tracking-widest transition-colors">
                                <Plus className="h-3.5 w-3.5" />
                                Create Page
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-4">
            {/* Tabs */}
            <Tabs defaultValue="pages" className="space-y-6">
                <div className="w-full overflow-x-auto pb-2">
                    <TabsList>
                        <TabsTrigger value="pages">Pages</TabsTrigger>
                        <TabsTrigger value="media">Media Library</TabsTrigger>
                        <TabsTrigger value="menus">Navigation</TabsTrigger>
                        <TabsTrigger value="seo">SEO Settings</TabsTrigger>
                    </TabsList>
                </div>

                {/* Pages Tab */}
                <TabsContent value="pages" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <CardTitle>Website Pages</CardTitle>
                                    <CardDescription>
                                        Manage your website pages and content
                                    </CardDescription>
                                </div>
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                                    <div className="relative">
                                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search pages..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-8 w-full sm:w-64"
                                        />
                                    </div>
                                    <Select>
                                        <SelectTrigger className="w-full sm:w-32">
                                            <SelectValue placeholder="Filter" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Pages</SelectItem>
                                            <SelectItem value="published">Published</SelectItem>
                                            <SelectItem value="draft">Drafts</SelectItem>
                                            <SelectItem value="archived">Archived</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto -mx-6">
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
                                            <TableHead></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(loading ? [] : rows).map((page) => (
                                            <TableRow key={page.id}>
                                                <TableCell className="font-medium">{page.title}</TableCell>
                                                <TableCell>
                                                    <code className="text-sm bg-muted px-2 py-1 rounded">
                                                        {page.slug}
                                                    </code>
                                                </TableCell>
                                                <TableCell>
                                                    <TypeBadge type={page.type} />
                                                </TableCell>
                                                <TableCell>
                                                    <StatusBadge status={page.status} />
                                                </TableCell>
                                                <TableCell>{page.views.toLocaleString()}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-6 w-6">
                                                            <AvatarImage src="/avatars/01.png" />
                                                            <AvatarFallback>
                                                                {page.author.split(" ").map(n => n[0]).join("")}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <span className="text-sm">{page.author}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        <Calendar className="h-4 w-4" />
                                                        {page.lastModified}
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
                                                            <DropdownMenuItem onClick={() => onEdit(page)}>
                                                                <Edit className="h-4 w-4 mr-2" />
                                                                Edit Page
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => onPreview(page)}>
                                                                <Eye className="h-4 w-4 mr-2" />
                                                                Preview
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => onViewLive(page)}>
                                                                <Globe className="h-4 w-4 mr-2" />
                                                                View Live
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem className="text-red-600" onClick={() => onDelete(page)}>
                                                                <Trash2 className="h-4 w-4 mr-2" />
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
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Media Library Tab */}
                <TabsContent value="media" className="space-y-6">
                    <div className="grid gap-6">
                        {/* Media Gallery full width, navigates to Media page */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle>Media Library</CardTitle>
                                    <Button onClick={() => router.push('/content/media')}>
                                        <Upload className="h-4 w-4 mr-2" />
                                        Upload Files
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {/* Show a small preview of recent files; full management on Media page */}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Navigation Tab */}
                <TabsContent value="menus" className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>Main Navigation</CardTitle>
                                        <CardDescription>
                                            Configure your website's main navigation menu
                                        </CardDescription>
                                    </div>

                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    {(mainMenuItems || []).map((it: any) => (
                                        <div key={it.id} className="flex items-center justify-between p-3 border rounded-lg">
                                            <span className="truncate max-w-[240px]" title={it.title}>{it.title}</span>
                                            <span className="text-xs text-muted-foreground truncate max-w-[180px]" title={it.url || ''}>{it.url || ''}</span>
                                        </div>
                                    ))}
                                    {(!mainMenuItems || mainMenuItems.length === 0) && (
                                        <div className="text-sm text-muted-foreground">No items. Click Manage to add.</div>
                                    )}
                                </div>
                                <Button className="w-full" variant="secondary" onClick={() => router.push('/content/navigation')}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Menu Item
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>Footer Navigation</CardTitle>
                                        <CardDescription>
                                            Configure your website's footer links
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    {(footerMenuItems || []).map((it: any) => (
                                        <div key={it.id} className="flex items-center justify-between p-3 border rounded-lg">
                                            <span className="truncate max-w-[240px]" title={it.title}>{it.title}</span>
                                            <span className="text-xs text-muted-foreground truncate max-w-[180px]" title={it.url || ''}>{it.url || ''}</span>
                                        </div>
                                    ))}
                                    {(!footerMenuItems || footerMenuItems.length === 0) && (
                                        <div className="text-sm text-muted-foreground">No items. Click Manage to add.</div>
                                    )}
                                </div>
                                <Button className="w-full" variant="secondary" onClick={() => router.push('/content/navigation')}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Footer Link
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* SEO Settings Tab */}
                <TabsContent value="seo" className="space-y-6">
                    <SeoSettings />
                </TabsContent>
            </Tabs>
            </div>
        </div>
    );
}

function SeoSettings() {
    const [loading, setLoading] = useState(false);
    const [siteName, setSiteName] = useState("");
    const [defaultTitle, setDefaultTitle] = useState("");
    const [defaultDescription, setDefaultDescription] = useState("");
    const [defaultKeywords, setDefaultKeywords] = useState("");
    const [defaultOgImageUrl, setDefaultOgImageUrl] = useState("");
    const [allowIndexing, setAllowIndexing] = useState(true);
    const [ga, setGa] = useState("");
    const [gtm, setGtm] = useState("");
    const [fbp, setFbp] = useState("");
    const [headTags, setHeadTags] = useState("");
    const [uploadingOg, setUploadingOg] = useState(false);
    const ogFileInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        (async () => {
            const r = await api.getSiteSeo();
            if (r.success && r.data) {
                setSiteName(r.data.siteName || "");
                setDefaultTitle(r.data.defaultTitle || "");
                setDefaultDescription(r.data.defaultDescription || "");
                setDefaultKeywords(r.data.defaultKeywords || "");
                setDefaultOgImageUrl(r.data.defaultOgImageUrl || "");
                setAllowIndexing(r.data.allowIndexing ?? true);
                setGa(r.data.googleAnalyticsId || "");
                setGtm(r.data.googleTagManagerId || "");
                setFbp(r.data.facebookPixelId || "");
                setHeadTags(r.data.additionalHeadTags || "");
            }
        })();
    }, []);

    const saveGlobal = async () => {
        setLoading(true);
        const r = await api.updateSiteSeo({
            siteName,
            defaultTitle,
            defaultDescription,
            defaultKeywords,
            defaultOgImageUrl,
            allowIndexing,
        });
        setLoading(false);
        return r.success;
    };

    const saveAnalytics = async () => {
        setLoading(true);
        const r = await api.updateSiteSeo({
            googleAnalyticsId: ga,
            googleTagManagerId: gtm,
            facebookPixelId: fbp,
            additionalHeadTags: headTags,
        });
        setLoading(false);
        return r.success;
    };

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>Global SEO Settings</CardTitle>
                    <CardDescription>
                        Configure default SEO settings for your website
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="site-name">Site Name</Label>
                        <Input id="site-name" value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="Ascendra Bio" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="site-title">Site Title</Label>
                        <Input id="site-title" value={defaultTitle} onChange={(e) => setDefaultTitle(e.target.value)} placeholder="Ascendra Bio - Premium Peptides" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="site-description">Site Description</Label>
                        <Textarea id="site-description" rows={3} value={defaultDescription} onChange={(e) => setDefaultDescription(e.target.value)} placeholder="High-quality peptides for research and development..." />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="keywords">Keywords</Label>
                        <Input id="keywords" value={defaultKeywords} onChange={(e) => setDefaultKeywords(e.target.value)} placeholder="peptides, research, biotech, laboratory, synthesis" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="og-image">Open Graph Image</Label>
                        <div className="flex gap-2">
                            <Input id="og-image" value={defaultOgImageUrl} onChange={(e) => setDefaultOgImageUrl(e.target.value)} placeholder="URL to default OG image" />
                            <input
                                ref={ogFileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    setUploadingOg(true);
                                    try {
                                        const up = await api.uploadFile(file);
                                        if (up.success && up.data?.url) {
                                            setDefaultOgImageUrl(up.data.url);
                                        }
                                    } finally {
                                        setUploadingOg(false);
                                        if (ogFileInputRef.current) ogFileInputRef.current.value = "";
                                    }
                                }}
                            />
                            <Button variant="outline" disabled={uploadingOg} onClick={() => ogFileInputRef.current?.click()}>
                                <Upload className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch id="search-engine-indexing" checked={allowIndexing} onCheckedChange={setAllowIndexing} />
                        <Label htmlFor="search-engine-indexing">Allow search engine indexing</Label>
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={saveGlobal} disabled={loading}>Save SEO</Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Analytics & Tracking</CardTitle>
                    <CardDescription>
                        Configure tracking codes and analytics
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="google-analytics">Google Analytics ID</Label>
                        <Input id="google-analytics" value={ga} onChange={(e) => setGa(e.target.value)} placeholder="GA-XXXXXXXXX-X" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="gtm">Google Tag Manager ID</Label>
                        <Input id="gtm" value={gtm} onChange={(e) => setGtm(e.target.value)} placeholder="GTM-XXXXXXX" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="facebook-pixel">Facebook Pixel ID</Label>
                        <Input id="facebook-pixel" value={fbp} onChange={(e) => setFbp(e.target.value)} placeholder="Facebook Pixel ID" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="custom-head">Custom Head Code</Label>
                        <Textarea id="custom-head" rows={3} value={headTags} onChange={(e) => setHeadTags(e.target.value)} placeholder="Additional head tags..." />
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={saveAnalytics} disabled={loading}>Save Analytics</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
