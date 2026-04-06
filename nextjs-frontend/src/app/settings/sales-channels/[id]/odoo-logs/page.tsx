"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    ArrowLeft,
    Download,
    CheckCircle,
    X,
    AlertCircle,
    RefreshCw,
    Search,
    Clock,
    Package,
    FileText,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    Filter,
    Trash2,
    Eye,
    Activity,
    TrendingUp,
    TrendingDown,
    Calendar,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ProtectedRoute } from "@/contexts/auth-context";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { API_BASE_URL } from "@/lib/env";
import logger from '@/lib/logger';

interface OdooSyncLog {
    id: string;
    triggerType: string;
    triggerReason: string | null;
    variantId: string | null;
    variantSku: string | null;
    productId: string | null;
    productName: string | null;
    orderId: string | null;
    httpMethod: string | null;
    endpoint: string | null;
    statusCode: number | null;
    requestPayload: any;
    responsePayload: any;
    status: "SUCCESS" | "FAILED" | "PENDING";
    errorMessage: string | null;
    duration: number | null;
    initiatedBy: string | null;
    salesChannelId: string | null;
    createdAt: string;
    variant?: {
        id: string;
        sku: string;
        name: string;
        product?: {
            id: string;
            name: string;
        };
    };
    order?: {
        id: string;
        orderNumber: string;
    };
    salesChannel?: {
        id: string;
        companyName: string;
    };
}

interface LogStats {
    period: string;
    total: number;
    success: number;
    failed: number;
    successRate: string;
    byTrigger: Array<{ type: string; count: number }>;
    recentErrors: Array<{
        id: string;
        triggerType: string;
        variantSku: string;
        errorMessage: string;
        createdAt: string;
    }>;
}

const TRIGGER_TYPES = [
    { value: "all", label: "All Triggers" },
    { value: "MANUAL_FULL", label: "Manual Full Sync" },
    { value: "MANUAL_SINGLE", label: "Manual Single" },
    { value: "ORDER_CREATED", label: "Order Created" },
    { value: "ORDER_SHIPPED", label: "Order Shipped" },
    { value: "ORDER_CANCELLED", label: "Order Cancelled" },
    { value: "INVENTORY_ADJUSTMENT", label: "Inventory Adjustment" },
    { value: "INVENTORY_ADJUSTMENT_MANUAL", label: "Inventory Manual" },
    { value: "INVENTORY_ADJUSTMENT_API", label: "Inventory API" },
    { value: "PRICE_UPDATE", label: "Price Update" },
    { value: "PRODUCT_CREATED", label: "Product Created" },
    { value: "PRODUCT_UPDATED", label: "Product Updated" },
    { value: "SCHEDULED_SYNC", label: "Scheduled Sync" },
    { value: "TEST", label: "Test (Legacy)" },
    { value: "TEST_CONNECTION", label: "Test Connection" },
];

const STATUS_OPTIONS = [
    { value: "all", label: "All Status" },
    { value: "SUCCESS", label: "Success" },
    { value: "FAILED", label: "Failed" },
    { value: "PENDING", label: "Pending" },
];

function formatTriggerType(type: string): string {
    return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
}

function formatDuration(ms: number | null): string {
    if (ms === null) return "-";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}

export default function OdooSyncLogsPage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const salesChannelId = params.id as string;

    const [logs, setLogs] = useState<OdooSyncLog[]>([]);
    const [stats, setStats] = useState<LogStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 25,
        total: 0,
        pages: 0,
    });

    // Filters
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [triggerFilter, setTriggerFilter] = useState("all");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    // Detail modal
    const [selectedLog, setSelectedLog] = useState<OdooSyncLog | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams();
            queryParams.append("page", String(pagination.page));
            queryParams.append("limit", String(pagination.limit));
            if (salesChannelId && salesChannelId !== "new") {
                queryParams.append("salesChannelId", salesChannelId);
            }
            if (search) queryParams.append("search", search);
            if (statusFilter !== "all") queryParams.append("status", statusFilter);
            if (triggerFilter !== "all") queryParams.append("triggerType", triggerFilter);
            if (startDate) queryParams.append("startDate", startDate);
            if (endDate) queryParams.append("endDate", endDate);

            const res = await api.get<any>(`/odoo/config/logs?${queryParams.toString()}`);

            if (res.success) {
                setLogs((res as any).logs || []);
                setPagination((prev) => ({
                    ...prev,
                    total: (res as any).pagination?.total || 0,
                    pages: (res as any).pagination?.pages || 0,
                }));
            } else {
                toast.error("Failed to load logs");
            }
        } catch (error) {
            logger.error("Failed to fetch logs:", { error: error });
            toast.error("Failed to load sync logs");
        } finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.limit, salesChannelId, search, statusFilter, triggerFilter, startDate, endDate]);

    const fetchStats = useCallback(async () => {
        setStatsLoading(true);
        try {
            const params = new URLSearchParams();
            if (salesChannelId && salesChannelId !== "new") {
                params.append("salesChannelId", salesChannelId);
            }
            params.append("days", "7");

            const res = await api.get<any>(`/odoo/config/logs/stats?${params.toString()}`);

            if (res.success) {
                setStats((res as any).stats || null);
            }
        } catch (error) {
            logger.error("Failed to fetch stats:", { error: error });
        } finally {
            setStatsLoading(false);
        }
    }, [salesChannelId]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const handleExport = async () => {
        try {
            const queryParams = new URLSearchParams();
            if (salesChannelId && salesChannelId !== "new") {
                queryParams.append("salesChannelId", salesChannelId);
            }
            if (statusFilter !== "all") queryParams.append("status", statusFilter);
            if (triggerFilter !== "all") queryParams.append("triggerType", triggerFilter);
            if (startDate) queryParams.append("startDate", startDate);
            if (endDate) queryParams.append("endDate", endDate);

            // Open export URL in new tab (will trigger download)
            const baseUrl = API_BASE_URL.replace(/\/api$/, "");
            window.open(`${baseUrl}/odoo/config/logs/export?${queryParams.toString()}`, "_blank");
            toast.success("Export started");
        } catch (error) {
            toast.error("Failed to export logs");
        }
    };

    const handleCleanup = async () => {
        if (!confirm("Are you sure you want to delete logs older than 90 days?")) return;

        try {
            const res = await api.delete<any>("/odoo/config/logs/cleanup?daysToKeep=90");
            if ((res as any).success) {
                toast.success(`Cleaned up ${(res as any).deletedCount || 0} old log entries`);
                fetchLogs();
                fetchStats();
            } else {
                toast.error("Failed to cleanup logs");
            }
        } catch (error) {
            toast.error("Failed to cleanup logs");
        }
    };

    const viewLogDetail = async (logId: string) => {
        try {
            const res = await api.get<any>(`/odoo/config/logs/${logId}`);
            if (res.success && (res as any).log) {
                setSelectedLog((res as any).log);
                setDetailOpen(true);
            }
        } catch (error) {
            toast.error("Failed to load log details");
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPagination((prev) => ({ ...prev, page: 1 }));
        fetchLogs();
    };

    const clearFilters = () => {
        setSearch("");
        setStatusFilter("all");
        setTriggerFilter("all");
        setStartDate("");
        setEndDate("");
        setPagination((prev) => ({ ...prev, page: 1 }));
    };

    return (
        <ProtectedRoute requiredPermissions={[{ module: "settings", action: "READ" }]}>
            <DashboardLayout>
                <div className="flex flex-col gap-6 p-4 md:p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push(`/settings/sales-channels/${salesChannelId}?tab=integrations`)}
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back to Integration
                            </Button>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={handleExport}>
                                <Download className="h-4 w-4 mr-2" />
                                Export CSV
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleCleanup}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Cleanup Old
                            </Button>
                            <Button size="sm" onClick={() => { fetchLogs(); fetchStats(); }}>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Refresh
                            </Button>
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <h1 className="text-2xl font-bold">Odoo Sync Logs</h1>
                        <p className="text-muted-foreground">
                            View all API calls and sync operations with Odoo
                        </p>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Total Syncs (7d)</p>
                                        {statsLoading ? (
                                            <Skeleton className="h-8 w-16 mt-1" />
                                        ) : (
                                            <p className="text-2xl font-bold">{stats?.total || 0}</p>
                                        )}
                                    </div>
                                    <Activity className="h-8 w-8 text-muted-foreground" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Success Rate</p>
                                        {statsLoading ? (
                                            <Skeleton className="h-8 w-16 mt-1" />
                                        ) : (
                                            <p className="text-2xl font-bold text-green-600">
                                                {stats?.successRate || 0}%
                                            </p>
                                        )}
                                    </div>
                                    <TrendingUp className="h-8 w-8 text-green-600" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Successful</p>
                                        {statsLoading ? (
                                            <Skeleton className="h-8 w-16 mt-1" />
                                        ) : (
                                            <p className="text-2xl font-bold text-green-600">
                                                {stats?.success || 0}
                                            </p>
                                        )}
                                    </div>
                                    <CheckCircle className="h-8 w-8 text-green-600" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Failed</p>
                                        {statsLoading ? (
                                            <Skeleton className="h-8 w-16 mt-1" />
                                        ) : (
                                            <p className="text-2xl font-bold text-red-600">
                                                {stats?.failed || 0}
                                            </p>
                                        )}
                                    </div>
                                    <AlertCircle className="h-8 w-8 text-red-600" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Filters */}
                    <Card>
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Filter className="h-4 w-4" />
                                Filters
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
                                <div className="flex-1 min-w-[200px]">
                                    <Label className="sr-only">Search</Label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search SKU, product, error..."
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            className="pl-9"
                                        />
                                    </div>
                                </div>
                                <div className="w-[150px]">
                                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {STATUS_OPTIONS.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-[180px]">
                                    <Select value={triggerFilter} onValueChange={setTriggerFilter}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {TRIGGER_TYPES.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-[150px]">
                                    <Input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        placeholder="Start date"
                                    />
                                </div>
                                <div className="w-[150px]">
                                    <Input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        placeholder="End date"
                                    />
                                </div>
                                <Button type="submit">
                                    <Search className="h-4 w-4 mr-2" />
                                    Search
                                </Button>
                                <Button type="button" variant="ghost" onClick={clearFilters}>
                                    Clear
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Logs Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span>Sync Log History</span>
                                <Badge variant="secondary">
                                    {pagination.total} logs
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="space-y-3">
                                    {[...Array(5)].map((_, i) => (
                                        <Skeleton key={i} className="h-12 w-full" />
                                    ))}
                                </div>
                            ) : logs.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p>No sync logs found</p>
                                    <p className="text-sm">Logs will appear here once syncs are executed</p>
                                </div>
                            ) : (
                                <>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Timestamp</TableHead>
                                                <TableHead>Trigger</TableHead>
                                                <TableHead>SKU / Product</TableHead>
                                                <TableHead>Endpoint</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Duration</TableHead>
                                                <TableHead className="w-[80px]">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {logs.map((log) => (
                                                <TableRow key={log.id}>
                                                    <TableCell className="text-sm">
                                                        <div className="flex items-center gap-2">
                                                            <Clock className="h-3 w-3 text-muted-foreground" />
                                                            {formatDate(log.createdAt)}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div>
                                                            <Badge variant="outline" className="text-xs">
                                                                {formatTriggerType(log.triggerType)}
                                                            </Badge>
                                                            {log.triggerReason && (
                                                                <p className="text-xs text-muted-foreground mt-1 truncate max-w-[200px]">
                                                                    {log.triggerReason}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div>
                                                            {log.variantSku && (
                                                                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                                                    {log.variantSku}
                                                                </code>
                                                            )}
                                                            {(log.productName || log.variant?.product?.name) && (
                                                                <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[150px]">
                                                                    {log.productName || log.variant?.product?.name}
                                                                </p>
                                                            )}
                                                            {log.order && (
                                                                <p className="text-xs text-blue-600 mt-0.5">
                                                                    Order #{log.order.orderNumber}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-xs">
                                                            {log.httpMethod && (
                                                                <Badge
                                                                    variant="secondary"
                                                                    className={`mr-1 ${log.httpMethod === "POST" ? "bg-blue-100 text-blue-700" :
                                                                        log.httpMethod === "GET" ? "bg-green-100 text-green-700" :
                                                                            log.httpMethod === "PUT" ? "bg-yellow-100 text-yellow-700" :
                                                                                log.httpMethod === "DELETE" ? "bg-red-100 text-red-700" : ""
                                                                        }`}
                                                                >
                                                                    {log.httpMethod}
                                                                </Badge>
                                                            )}
                                                            {log.endpoint && (
                                                                <span className="text-muted-foreground truncate">
                                                                    {log.endpoint}
                                                                </span>
                                                            )}
                                                            {log.statusCode && (
                                                                <span className={`ml-2 ${log.statusCode >= 200 && log.statusCode < 300 ? "text-green-600" :
                                                                    log.statusCode >= 400 ? "text-red-600" : "text-yellow-600"
                                                                    }`}>
                                                                    ({log.statusCode})
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant={
                                                                log.status === "SUCCESS"
                                                                    ? "default"
                                                                    : log.status === "FAILED"
                                                                        ? "destructive"
                                                                        : "secondary"
                                                            }
                                                            className={
                                                                log.status === "SUCCESS"
                                                                    ? "bg-green-100 text-green-800"
                                                                    : ""
                                                            }
                                                        >
                                                            {log.status === "SUCCESS" && <CheckCircle className="h-3 w-3 mr-1" />}
                                                            {log.status === "FAILED" && <X className="h-3 w-3 mr-1" />}
                                                            {log.status}
                                                        </Badge>
                                                        {log.errorMessage && (
                                                            <p className="text-xs text-red-600 mt-1 truncate max-w-[150px]">
                                                                {log.errorMessage}
                                                            </p>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {formatDuration(log.duration)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => viewLogDetail(log.id)}
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>

                                    {/* Pagination */}
                                    <div className="flex items-center justify-between mt-4">
                                        <p className="text-sm text-muted-foreground">
                                            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                                            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                                            {pagination.total} entries
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                                                disabled={pagination.page <= 1}
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <span className="text-sm">
                                                Page {pagination.page} of {pagination.pages}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                                                disabled={pagination.page >= pagination.pages}
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Log Detail Modal */}
                    <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <FileText className="h-5 w-5" />
                                    Sync Log Details
                                </DialogTitle>
                                <DialogDescription>
                                    Complete request and response data
                                </DialogDescription>
                            </DialogHeader>

                            {selectedLog && (
                                <div className="space-y-6">
                                    {/* Overview */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label className="text-xs text-muted-foreground">Timestamp</Label>
                                            <p className="font-medium">{formatDate(selectedLog.createdAt)}</p>
                                        </div>
                                        <div>
                                            <Label className="text-xs text-muted-foreground">Status</Label>
                                            <p>
                                                <Badge
                                                    variant={selectedLog.status === "SUCCESS" ? "default" : "destructive"}
                                                    className={selectedLog.status === "SUCCESS" ? "bg-green-100 text-green-800" : ""}
                                                >
                                                    {selectedLog.status}
                                                </Badge>
                                            </p>
                                        </div>
                                        <div>
                                            <Label className="text-xs text-muted-foreground">Trigger Type</Label>
                                            <p className="font-medium">{formatTriggerType(selectedLog.triggerType)}</p>
                                        </div>
                                        <div>
                                            <Label className="text-xs text-muted-foreground">Duration</Label>
                                            <p className="font-medium">{formatDuration(selectedLog.duration)}</p>
                                        </div>
                                        {selectedLog.triggerReason && (
                                            <div className="col-span-2">
                                                <Label className="text-xs text-muted-foreground">Reason</Label>
                                                <p className="font-medium">{selectedLog.triggerReason}</p>
                                            </div>
                                        )}
                                    </div>

                                    <Separator />

                                    {/* Entity Info */}
                                    <div>
                                        <h4 className="font-semibold mb-3">Related Entities</h4>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            {selectedLog.variantSku && (
                                                <div>
                                                    <Label className="text-xs text-muted-foreground">SKU</Label>
                                                    <p><code className="bg-muted px-1.5 py-0.5 rounded">{selectedLog.variantSku}</code></p>
                                                </div>
                                            )}
                                            {(selectedLog.productName || selectedLog.variant?.product?.name) && (
                                                <div>
                                                    <Label className="text-xs text-muted-foreground">Product</Label>
                                                    <p>{selectedLog.productName || selectedLog.variant?.product?.name}</p>
                                                </div>
                                            )}
                                            {selectedLog.order && (
                                                <div>
                                                    <Label className="text-xs text-muted-foreground">Order</Label>
                                                    <p>#{selectedLog.order.orderNumber}</p>
                                                </div>
                                            )}
                                            {selectedLog.salesChannel && (
                                                <div>
                                                    <Label className="text-xs text-muted-foreground">Sales Channel</Label>
                                                    <p>{selectedLog.salesChannel.companyName}</p>
                                                </div>
                                            )}
                                            {selectedLog.initiatedBy && (
                                                <div>
                                                    <Label className="text-xs text-muted-foreground">Initiated By</Label>
                                                    <p>{selectedLog.initiatedBy}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <Separator />

                                    {/* API Details */}
                                    <div>
                                        <h4 className="font-semibold mb-3">API Call</h4>
                                        <div className="flex items-center gap-2 mb-3">
                                            {selectedLog.httpMethod && (
                                                <Badge variant="secondary">{selectedLog.httpMethod}</Badge>
                                            )}
                                            {selectedLog.endpoint && (
                                                <code className="text-sm bg-muted px-2 py-1 rounded flex-1">{selectedLog.endpoint}</code>
                                            )}
                                            {selectedLog.statusCode && (
                                                <Badge
                                                    variant={selectedLog.statusCode >= 200 && selectedLog.statusCode < 300 ? "default" : "destructive"}
                                                    className={selectedLog.statusCode >= 200 && selectedLog.statusCode < 300 ? "bg-green-100 text-green-800" : ""}
                                                >
                                                    {selectedLog.statusCode}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    {/* Error Message */}
                                    {selectedLog.errorMessage && (
                                        <>
                                            <Separator />
                                            <div>
                                                <h4 className="font-semibold mb-2 text-red-600">Error</h4>
                                                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                                                    <pre className="text-sm text-red-700 whitespace-pre-wrap">{selectedLog.errorMessage}</pre>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* Request Payload */}
                                    {selectedLog.requestPayload && (
                                        <>
                                            <Separator />
                                            <div>
                                                <h4 className="font-semibold mb-2">Request Payload</h4>
                                                <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto max-h-[200px]">
                                                    {JSON.stringify(selectedLog.requestPayload, null, 2)}
                                                </pre>
                                            </div>
                                        </>
                                    )}

                                    {/* Response Payload */}
                                    {selectedLog.responsePayload && (
                                        <>
                                            <Separator />
                                            <div>
                                                <h4 className="font-semibold mb-2">Response Payload</h4>
                                                <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto max-h-[200px]">
                                                    {JSON.stringify(selectedLog.responsePayload, null, 2)}
                                                </pre>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </DialogContent>
                    </Dialog>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
