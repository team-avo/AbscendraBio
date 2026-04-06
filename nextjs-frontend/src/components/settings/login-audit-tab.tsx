"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    CheckCircle2,
    XCircle,
    Download,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    Monitor,
    Smartphone,
    Globe,
    Shield,
    AlertTriangle,
    Activity,
    Users,
    Wifi,
} from "lucide-react";
import { api } from "@/lib/api";
import { API_BASE_URL } from "@/lib/env";
import { getToken } from "@/lib/api-client";

// Map failure reasons to human-readable labels
const FAILURE_REASON_LABELS: Record<string, string> = {
    USER_NOT_FOUND: "User Not Found",
    INVALID_PASSWORD: "Invalid Password",
    ACCOUNT_INACTIVE: "Account Inactive",
    EMAIL_NOT_VERIFIED: "Email Not Verified",
    PENDING_APPROVAL: "Pending Approval",
    ROLE_MISMATCH: "Wrong Portal",
    NETWORK_ERROR: "Network Error",
    CLIENT_ERROR: "Client Error",
    TIMEOUT: "Timeout",
    OFFLINE: "Device Offline",
};

function parseUserAgent(ua: string | null): string {
    if (!ua) return "-";
    const browser =
        ua.includes("Firefox") ? "Firefox" :
            ua.includes("Edg/") ? "Edge" :
                ua.includes("OPR") ? "Opera" :
                    ua.includes("Chrome") && !ua.includes("Edg") ? "Chrome" :
                        ua.includes("Safari") && !ua.includes("Chrome") ? "Safari" : "Other";
    const os =
        ua.includes("Windows") ? "Win" :
            ua.includes("Mac OS") ? "Mac" :
                ua.includes("Android") ? "Android" :
                    ua.includes("iPhone") || ua.includes("iPad") ? "iOS" :
                        ua.includes("Linux") ? "Linux" : "";
    return `${browser}${os ? ` / ${os}` : ""}`;
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
}

export function LoginAuditTab() {
    // Summary state
    const [summary, setSummary] = useState<any>(null);
    const [summaryLoading, setSummaryLoading] = useState(true);

    // Table state
    const [items, setItems] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit] = useState(25);
    const [totalPages, setTotalPages] = useState(1);
    const [tableLoading, setTableLoading] = useState(true);

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [portalFilter, setPortalFilter] = useState<string>("");
    const [sourceFilter, setSourceFilter] = useState<string>("");
    const [emailSearch, setEmailSearch] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    // Detail dialog
    const [detailRow, setDetailRow] = useState<any>(null);

    const fetchSummary = useCallback(async () => {
        setSummaryLoading(true);
        try {
            const params: Record<string, string> = {};
            if (dateFrom) params.from = new Date(dateFrom).toISOString();
            if (dateTo) params.to = new Date(dateTo + "T23:59:59").toISOString();
            const res = await api.getLoginAuditSummary(params);
            if (res.success) setSummary(res.data);
        } catch {
            // silently ignore
        } finally {
            setSummaryLoading(false);
        }
    }, [dateFrom, dateTo]);

    const fetchLogs = useCallback(async () => {
        setTableLoading(true);
        try {
            const params: Record<string, any> = { page, limit };
            if (statusFilter) params.status = statusFilter;
            if (portalFilter) params.portal = portalFilter;
            if (sourceFilter) params.source = sourceFilter;
            if (emailSearch.trim()) params.email = emailSearch.trim();
            if (dateFrom) params.from = new Date(dateFrom).toISOString();
            if (dateTo) params.to = new Date(dateTo + "T23:59:59").toISOString();
            const res = await api.getLoginAuditLogs(params);
            if (res.success && res.data) {
                setItems(res.data.items || []);
                setTotal(res.data.total || 0);
                setTotalPages(res.data.totalPages || 1);
            }
        } catch {
            // silently ignore
        } finally {
            setTableLoading(false);
        }
    }, [page, limit, statusFilter, portalFilter, sourceFilter, emailSearch, dateFrom, dateTo]);

    useEffect(() => { fetchSummary(); }, [fetchSummary]);
    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const handleRefresh = () => {
        fetchSummary();
        fetchLogs();
    };

    const handleExport = () => {
        const params = new URLSearchParams();
        if (statusFilter) params.set("status", statusFilter);
        if (portalFilter) params.set("portal", portalFilter);
        if (sourceFilter) params.set("source", sourceFilter);
        if (emailSearch.trim()) params.set("email", emailSearch.trim());
        if (dateFrom) params.set("from", new Date(dateFrom).toISOString());
        if (dateTo) params.set("to", new Date(dateTo + "T23:59:59").toISOString());
        const qs = params.toString();
        const token = getToken();
        const url = `${API_BASE_URL}/login-audit-logs/export${qs ? `?${qs}` : ""}`;
        // Open in new tab with auth header via a temporary fetch + blob download
        fetch(url, { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.blob())
            .then((blob) => {
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `login-audit-${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(a.href);
            })
            .catch(() => { });
    };

    const handleFilterReset = () => {
        setStatusFilter("");
        setPortalFilter("");
        setSourceFilter("");
        setEmailSearch("");
        setDateFrom("");
        setDateTo("");
        setPage(1);
    };

    // Debounce email search
    useEffect(() => {
        const timeout = setTimeout(() => {
            setPage(1);
        }, 400);
        return () => clearTimeout(timeout);
    }, [emailSearch]);

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <Card className="shadow-sm border-muted-foreground/10">
                    <CardHeader className="pb-2 p-4">
                        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                            <Activity className="h-3.5 w-3.5" />
                            Total Attempts
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold">
                            {summaryLoading ? "..." : (summary?.totalAttempts ?? 0).toLocaleString()}
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-muted-foreground/10">
                    <CardHeader className="pb-2 p-4">
                        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            Successful
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold text-emerald-600">
                            {summaryLoading ? "..." : (summary?.successCount ?? 0).toLocaleString()}
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-muted-foreground/10">
                    <CardHeader className="pb-2 p-4">
                        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                            <XCircle className="h-3.5 w-3.5 text-red-500" />
                            Failed
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold text-red-600">
                            {summaryLoading ? "..." : (summary?.failedCount ?? 0).toLocaleString()}
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-muted-foreground/10">
                    <CardHeader className="pb-2 p-4">
                        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                            <Shield className="h-3.5 w-3.5 text-blue-500" />
                            Success Rate
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold">
                            {summaryLoading ? "..." : `${summary?.successRate ?? 0}%`}
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-muted-foreground/10">
                    <CardHeader className="pb-2 p-4">
                        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                            <Wifi className="h-3.5 w-3.5 text-amber-500" />
                            Client Errors
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold text-amber-600">
                            {summaryLoading ? "..." : (summary?.clientReportedErrors ?? 0).toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Top Failure Reasons (compact) */}
            {summary?.topFailureReasons?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-muted-foreground self-center mr-1">Top failure reasons:</span>
                    {summary.topFailureReasons.slice(0, 5).map((r: any) => (
                        <Badge key={r.reason} variant="outline" className="text-xs font-normal">
                            {FAILURE_REASON_LABELS[r.reason] || r.reason}: {r.count}
                        </Badge>
                    ))}
                </div>
            )}

            {/* Filters */}
            <Card className="shadow-sm border-muted-foreground/10">
                <CardContent className="p-4">
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="w-full sm:w-48">
                            <label className="text-xs text-muted-foreground mb-1 block">Email</label>
                            <Input
                                placeholder="Search by email..."
                                value={emailSearch}
                                onChange={(e) => setEmailSearch(e.target.value)}
                                className="h-9 text-sm"
                            />
                        </div>
                        <div className="w-full sm:w-32">
                            <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === "ALL" ? "" : v); setPage(1); }}>
                                <SelectTrigger className="h-9 text-sm">
                                    <SelectValue placeholder="All" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All</SelectItem>
                                    <SelectItem value="SUCCESS">Success</SelectItem>
                                    <SelectItem value="FAILED">Failed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-full sm:w-32">
                            <label className="text-xs text-muted-foreground mb-1 block">Portal</label>
                            <Select value={portalFilter} onValueChange={(v) => { setPortalFilter(v === "ALL" ? "" : v); setPage(1); }}>
                                <SelectTrigger className="h-9 text-sm">
                                    <SelectValue placeholder="All" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="customer">Customer</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-full sm:w-32">
                            <label className="text-xs text-muted-foreground mb-1 block">Source</label>
                            <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v === "ALL" ? "" : v); setPage(1); }}>
                                <SelectTrigger className="h-9 text-sm">
                                    <SelectValue placeholder="All" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All</SelectItem>
                                    <SelectItem value="server">Server</SelectItem>
                                    <SelectItem value="client">Client</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-full sm:w-36">
                            <label className="text-xs text-muted-foreground mb-1 block">From</label>
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                                className="h-9 text-sm"
                            />
                        </div>
                        <div className="w-full sm:w-36">
                            <label className="text-xs text-muted-foreground mb-1 block">To</label>
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                                className="h-9 text-sm"
                            />
                        </div>
                        <div className="flex gap-2 ml-auto">
                            <Button variant="outline" size="sm" className="h-9" onClick={handleFilterReset}>
                                Clear
                            </Button>
                            <Button variant="outline" size="sm" className="h-9" onClick={handleRefresh}>
                                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                                Refresh
                            </Button>
                            <Button variant="outline" size="sm" className="h-9" onClick={handleExport}>
                                <Download className="h-3.5 w-3.5 mr-1.5" />
                                CSV
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card className="shadow-sm border-muted-foreground/10">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-xs">Timestamp</TableHead>
                                    <TableHead className="text-xs">Email</TableHead>
                                    <TableHead className="text-xs">Status</TableHead>
                                    <TableHead className="text-xs">Reason</TableHead>
                                    <TableHead className="text-xs">Portal</TableHead>
                                    <TableHead className="text-xs">Source</TableHead>
                                    <TableHead className="text-xs">IP</TableHead>
                                    <TableHead className="text-xs">Device</TableHead>
                                    <TableHead className="text-xs">User</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tableLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                                            Loading...
                                        </TableCell>
                                    </TableRow>
                                ) : items.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                                            No login attempts found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    items.map((row) => (
                                        <TableRow
                                            key={row.id}
                                            className="cursor-pointer hover:bg-muted/40 transition-colors"
                                            onClick={() => setDetailRow(row)}
                                        >
                                            <TableCell className="text-xs whitespace-nowrap">
                                                {formatDate(row.createdAt)}
                                            </TableCell>
                                            <TableCell className="text-xs font-medium max-w-[180px] truncate">
                                                {row.email}
                                            </TableCell>
                                            <TableCell>
                                                {row.status === "SUCCESS" ? (
                                                    <Badge variant="default" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px]">
                                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                                        Success
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="destructive" className="text-[10px]">
                                                        <XCircle className="h-3 w-3 mr-1" />
                                                        Failed
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {row.failureReason ? (
                                                    <span className="flex items-center gap-1">
                                                        {row.failureReason === "NETWORK_ERROR" || row.failureReason === "TIMEOUT" || row.failureReason === "OFFLINE" ? (
                                                            <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" />
                                                        ) : null}
                                                        {FAILURE_REASON_LABELS[row.failureReason] || row.failureReason}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[10px] capitalize">
                                                    {row.portal}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {row.source === "client" ? (
                                                    <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">
                                                        <Smartphone className="h-2.5 w-2.5 mr-0.5" />
                                                        Client
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-[10px]">
                                                        <Monitor className="h-2.5 w-2.5 mr-0.5" />
                                                        Server
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                                                {row.ipAddress || "-"}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                                                {parseUserAgent(row.userAgent)}
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {row.user ? (
                                                    <span className="flex items-center gap-1">
                                                        <Users className="h-3 w-3 text-muted-foreground" />
                                                        {row.user.firstName} {row.user.lastName}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t">
                            <p className="text-xs text-muted-foreground">
                                Showing {(page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total}
                            </p>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page <= 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum: number;
                                    if (totalPages <= 5) {
                                        pageNum = i + 1;
                                    } else if (page <= 3) {
                                        pageNum = i + 1;
                                    } else if (page >= totalPages - 2) {
                                        pageNum = totalPages - 4 + i;
                                    } else {
                                        pageNum = page - 2 + i;
                                    }
                                    return (
                                        <Button
                                            key={pageNum}
                                            variant={pageNum === page ? "default" : "outline"}
                                            size="sm"
                                            className="h-8 w-8 p-0 text-xs"
                                            onClick={() => setPage(pageNum)}
                                        >
                                            {pageNum}
                                        </Button>
                                    );
                                })}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Detail Dialog */}
            <Dialog open={!!detailRow} onOpenChange={(open) => { if (!open) setDetailRow(null); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {detailRow?.status === "SUCCESS" ? (
                                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            ) : (
                                <XCircle className="h-5 w-5 text-red-500" />
                            )}
                            Login Attempt Detail
                        </DialogTitle>
                    </DialogHeader>
                    {detailRow && (
                        <div className="space-y-3 text-sm">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <span className="text-xs text-muted-foreground block">Email</span>
                                    <span className="font-medium">{detailRow.email}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground block">Timestamp</span>
                                    <span>{formatDate(detailRow.createdAt)}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground block">Status</span>
                                    {detailRow.status === "SUCCESS" ? (
                                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Success</Badge>
                                    ) : (
                                        <Badge variant="destructive">Failed</Badge>
                                    )}
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground block">Portal</span>
                                    <Badge variant="outline" className="capitalize">{detailRow.portal}</Badge>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground block">Source</span>
                                    <Badge variant="outline" className="capitalize">{detailRow.source}</Badge>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground block">IP Address</span>
                                    <span>{detailRow.ipAddress || "-"}</span>
                                </div>
                            </div>

                            {detailRow.failureReason && (
                                <div>
                                    <span className="text-xs text-muted-foreground block">Failure Reason</span>
                                    <span className="font-medium text-red-600">
                                        {FAILURE_REASON_LABELS[detailRow.failureReason] || detailRow.failureReason}
                                    </span>
                                </div>
                            )}

                            {detailRow.failureDetail && (
                                <div>
                                    <span className="text-xs text-muted-foreground block">Detail</span>
                                    <span className="text-xs">{detailRow.failureDetail}</span>
                                </div>
                            )}

                            {detailRow.user && (
                                <div>
                                    <span className="text-xs text-muted-foreground block">User</span>
                                    <span>{detailRow.user.firstName} {detailRow.user.lastName} ({detailRow.user.role})</span>
                                </div>
                            )}

                            <div>
                                <span className="text-xs text-muted-foreground block">User Agent</span>
                                <span className="text-xs break-all text-muted-foreground">{detailRow.userAgent || "-"}</span>
                            </div>

                            {detailRow.deviceInfo && typeof detailRow.deviceInfo === "object" && (
                                <div>
                                    <span className="text-xs text-muted-foreground block mb-1">Device Info</span>
                                    <div className="bg-muted/50 rounded-md p-3 text-xs font-mono space-y-1">
                                        {Object.entries(detailRow.deviceInfo).map(([k, v]) => (
                                            <div key={k} className="flex justify-between">
                                                <span className="text-muted-foreground">{k}:</span>
                                                <span>{String(v)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
