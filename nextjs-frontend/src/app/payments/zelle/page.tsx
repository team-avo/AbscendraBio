"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProtectedRoute } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    DollarSign,
    RefreshCcw,
    AlertCircle,
    CheckCircle2,
    Link2,
    EyeOff,
    Search,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api";
import type { ZellePayment, ZellePaymentStatus } from "@/lib/api-zelle-payments";
import { toast } from "sonner";
import logger from "@/lib/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterTab = "ALL" | ZellePaymentStatus;

const TABS: { key: FilterTab; label: string }[] = [
    { key: "UNMATCHED", label: "Unmatched" },
    { key: "MATCHED", label: "Needs review" },
    { key: "CONFIRMED", label: "Confirmed" },
    { key: "MANUALLY_MATCHED", label: "Manual" },
    { key: "IGNORED", label: "Ignored" },
    { key: "ALL", label: "All" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: ZellePaymentStatus, confidence?: string | null) {
    switch (status) {
        case "UNMATCHED":
            return <Badge variant="destructive">Unmatched</Badge>;
        case "MATCHED":
            return (
                <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-200">
                    {confidence === "HIGH" ? "Auto-match (high)" : "Needs review"}
                </Badge>
            );
        case "CONFIRMED":
            return (
                <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-200">
                    Confirmed
                </Badge>
            );
        case "MANUALLY_MATCHED":
            return (
                <Badge className="bg-blue-100 text-blue-900 hover:bg-blue-200">
                    Manually matched
                </Badge>
            );
        case "IGNORED":
            return <Badge variant="secondary">Ignored</Badge>;
        default:
            return <Badge variant="outline">{status}</Badge>;
    }
}

function formatAmount(amount: string) {
    return `$${parseFloat(amount).toFixed(2)}`;
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

// ─── Link-to-order dialog ─────────────────────────────────────────────────────

interface LinkDialogProps {
    payment: ZellePayment;
    open: boolean;
    onClose: () => void;
    onLinked: (updated: ZellePayment) => void;
}

function LinkOrderDialog({ payment, open, onClose, onLinked }: LinkDialogProps) {
    const [search, setSearch] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [linking, setLinking] = useState(false);
    const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const doSearch = useCallback(async (q: string) => {
        if (!q.trim()) { setResults([]); return; }
        setSearching(true);
        try {
            const resp = await (api as any).getOrders({ search: q, limit: 10, paymentMethod: "ZELLE" });
            if (resp.success && resp.data?.orders) {
                setResults(resp.data.orders);
            } else {
                setResults([]);
            }
        } catch {
            setResults([]);
        } finally {
            setSearching(false);
        }
    }, []);

    useEffect(() => {
        if (searchRef.current) clearTimeout(searchRef.current);
        searchRef.current = setTimeout(() => doSearch(search), 350);
        return () => { if (searchRef.current) clearTimeout(searchRef.current); };
    }, [search, doSearch]);

    async function handleLink(orderId: string) {
        setLinking(true);
        try {
            const resp = await (api as any).linkZellePaymentToOrder(payment.id, orderId);
            if (resp.success) {
                toast.success("Payment linked and confirmed");
                onLinked(resp.data);
                onClose();
            } else {
                toast.error(resp.error || "Failed to link payment");
            }
        } catch (err) {
            logger.error("Link error", { err });
            toast.error("Network error");
        } finally {
            setLinking(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Link to Order</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <p className="text-sm text-muted-foreground">
                        Linking payment of{" "}
                        <strong>{formatAmount(payment.parsedAmount)}</strong> from{" "}
                        <strong>{payment.parsedSenderName}</strong> to an order. This will
                        create a completed Zelle payment record on the order.
                    </p>

                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by order # or customer name…"
                            className="pl-9"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                        />
                    </div>

                    {searching && (
                        <p className="text-sm text-muted-foreground text-center py-2">Searching…</p>
                    )}

                    {!searching && results.length === 0 && search.trim() && (
                        <p className="text-sm text-muted-foreground text-center py-2">
                            No orders found for "{search}"
                        </p>
                    )}

                    {results.length > 0 && (
                        <div className="rounded-md border divide-y max-h-64 overflow-y-auto">
                            {results.map((order) => (
                                <div
                                    key={order.id}
                                    className="flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 cursor-pointer"
                                    onClick={() => !linking && handleLink(order.id)}
                                >
                                    <div>
                                        <p className="text-sm font-medium">#{order.orderNumber}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {order.customer?.firstName} {order.customer?.lastName} ·{" "}
                                            {order.customer?.email}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-medium">
                                            {formatAmount(order.totalAmount)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">{order.status}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={linking}>
                        Cancel
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ZellePaymentsPage() {
    const [items, setItems] = useState<ZellePayment[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<FilterTab>("UNMATCHED");
    const [pendingReviewCount, setPendingReviewCount] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    // Action states
    const [actioning, setActioning] = useState<string | null>(null);
    const [linkTarget, setLinkTarget] = useState<ZellePayment | null>(null);

    const fetchData = useCallback(async (p = page) => {
        try {
            const resp = await (api as any).listZellePayments({
                status: filter === "ALL" ? undefined : filter,
                page: p,
                limit: 25,
            });
            if (resp.success && Array.isArray(resp.data)) {
                setItems(resp.data);
                if (resp.pagination) {
                    setTotalPages(resp.pagination.totalPages ?? 1);
                    setTotal(resp.pagination.total ?? 0);
                }
                if (typeof resp.pendingReviewCount === "number") {
                    setPendingReviewCount(resp.pendingReviewCount);
                }
            } else {
                toast.error(resp.error || "Failed to load Zelle payments");
            }
        } catch (err) {
            logger.error("Error loading Zelle payments:", { err });
            toast.error("Network error loading Zelle payments");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [filter, page]);

    useEffect(() => {
        setLoading(true);
        setPage(1);
        fetchData(1);
    }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!loading) fetchData(page);
    }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

    function updateItem(updated: ZellePayment) {
        setItems((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    }

    async function handleConfirm(payment: ZellePayment) {
        setActioning(payment.id);
        try {
            const resp = await (api as any).confirmZellePayment(payment.id);
            if (resp.success) {
                toast.success(`Payment of ${formatAmount(payment.parsedAmount)} confirmed`);
                updateItem(resp.data);
            } else {
                toast.error(resp.error || "Failed to confirm payment");
            }
        } catch (err) {
            logger.error("Confirm error", { err });
            toast.error("Network error");
        } finally {
            setActioning(null);
        }
    }

    async function handleIgnore(payment: ZellePayment) {
        setActioning(payment.id);
        try {
            const resp = await (api as any).ignoreZellePayment(payment.id);
            if (resp.success) {
                toast.success("Payment marked as ignored");
                updateItem(resp.data);
            } else {
                toast.error(resp.error || "Failed to ignore payment");
            }
        } catch (err) {
            logger.error("Ignore error", { err });
            toast.error("Network error");
        } finally {
            setActioning(null);
        }
    }

    async function handleUnignore(payment: ZellePayment) {
        setActioning(payment.id);
        try {
            const resp = await (api as any).unignoreZellePayment(payment.id);
            if (resp.success) {
                toast.success("Payment moved back to Unmatched");
                updateItem(resp.data);
            } else {
                toast.error(resp.error || "Failed to un-ignore payment");
            }
        } catch (err) {
            logger.error("Unignore error", { err });
            toast.error("Network error");
        } finally {
            setActioning(null);
        }
    }

    const isActioning = (id: string) => actioning === id;

    return (
        <ProtectedRoute requiredRoles={["ADMIN", "MANAGER", "STAFF"]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <DollarSign className="h-6 w-6 text-violet-600" />
                                Zelle Payments
                            </h1>
                            <p className="text-sm text-muted-foreground mt-1">
                                Auto-detected from billing@ascendrabio.com · polled every 5 min
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setRefreshing(true); fetchData(page); }}
                            disabled={refreshing}
                        >
                            <RefreshCcw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                    </div>

                    {/* Pending-review banner */}
                    {pendingReviewCount > 0 && !["UNMATCHED", "MATCHED"].includes(filter) && (
                        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>
                                <strong>{pendingReviewCount}</strong> payment
                                {pendingReviewCount === 1 ? "" : "s"} need your review.
                            </span>
                            <Button
                                variant="link"
                                size="sm"
                                className="px-1 h-auto text-amber-900 underline"
                                onClick={() => setFilter("UNMATCHED")}
                            >
                                View unmatched
                            </Button>
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="flex flex-wrap gap-0 border-b">
                        {TABS.map((tab) => {
                            const active = filter === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setFilter(tab.key)}
                                    className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                                        active
                                            ? "border-primary text-foreground"
                                            : "border-transparent text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    {tab.label}
                                    {(tab.key === "UNMATCHED" || tab.key === "MATCHED") &&
                                        pendingReviewCount > 0 && (
                                            <Badge variant="secondary" className="ml-1.5">
                                                {pendingReviewCount}
                                            </Badge>
                                        )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Table */}
                    <div className="rounded-lg border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Received</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Sender name</TableHead>
                                    <TableHead>Memo</TableHead>
                                    <TableHead>Linked order</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={7}
                                            className="text-center text-sm text-muted-foreground py-12"
                                        >
                                            Loading…
                                        </TableCell>
                                    </TableRow>
                                ) : items.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={7}
                                            className="text-center text-sm text-muted-foreground py-12"
                                        >
                                            No Zelle payments in this view.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    items.map((payment) => (
                                        <TableRow key={payment.id}>
                                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                                {formatDate(payment.receivedAt)}
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-semibold text-emerald-700">
                                                    {formatAmount(payment.parsedAmount)}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <p className="font-medium">{payment.parsedSenderName}</p>
                                                <p
                                                    className="text-xs text-muted-foreground truncate max-w-[200px]"
                                                    title={payment.rawSubject}
                                                >
                                                    {payment.rawSubject}
                                                </p>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {payment.parsedMemo || (
                                                    <span className="italic">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {payment.order ? (
                                                    <div>
                                                        <p className="font-mono text-sm font-medium">
                                                            #{payment.order.orderNumber}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {payment.order.customer?.firstName}{" "}
                                                            {payment.order.customer?.lastName}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm italic text-muted-foreground">
                                                        Not linked
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {statusBadge(payment.status, payment.matchConfidence)}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center justify-end gap-1">
                                                    {/* Confirm button — for MATCHED payments */}
                                                    {payment.status === "MATCHED" && (
                                                        <Button
                                                            size="sm"
                                                            variant="default"
                                                            className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700"
                                                            disabled={isActioning(payment.id)}
                                                            onClick={() => handleConfirm(payment)}
                                                        >
                                                            <CheckCircle2 className="h-3 w-3 mr-1" />
                                                            Confirm
                                                        </Button>
                                                    )}

                                                    {/* Link to order — for UNMATCHED and MATCHED */}
                                                    {["UNMATCHED", "MATCHED"].includes(payment.status) && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 px-2 text-xs"
                                                            disabled={isActioning(payment.id)}
                                                            onClick={() => setLinkTarget(payment)}
                                                        >
                                                            <Link2 className="h-3 w-3 mr-1" />
                                                            Link order
                                                        </Button>
                                                    )}

                                                    {/* Ignore — for UNMATCHED and MATCHED */}
                                                    {["UNMATCHED", "MATCHED"].includes(payment.status) && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                                            disabled={isActioning(payment.id)}
                                                            onClick={() => handleIgnore(payment)}
                                                        >
                                                            <EyeOff className="h-3 w-3 mr-1" />
                                                            Ignore
                                                        </Button>
                                                    )}

                                                    {/* Un-ignore */}
                                                    {payment.status === "IGNORED" && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 px-2 text-xs"
                                                            disabled={isActioning(payment.id)}
                                                            onClick={() => handleUnignore(payment)}
                                                        >
                                                            Restore
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>{total} total</span>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2"
                                    disabled={page <= 1}
                                    onClick={() => setPage((p) => p - 1)}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="px-2">
                                    {page} / {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2"
                                    disabled={page >= totalPages}
                                    onClick={() => setPage((p) => p + 1)}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Link-to-order dialog */}
                {linkTarget && (
                    <LinkOrderDialog
                        payment={linkTarget}
                        open={true}
                        onClose={() => setLinkTarget(null)}
                        onLinked={(updated) => {
                            updateItem(updated);
                            setLinkTarget(null);
                        }}
                    />
                )}
            </DashboardLayout>
        </ProtectedRoute>
    );
}
