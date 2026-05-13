"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Settings, Mail, RefreshCcw, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import type {
    PendingReceiptStatus,
    StockReceiptListItem,
} from "@/lib/api-stock-receipts";
import logger from "@/lib/logger";
import { toast } from "sonner";

type FilterTab = "ALL" | PendingReceiptStatus;

const TABS: { key: FilterTab; label: string }[] = [
    { key: "PENDING", label: "Pending" },
    { key: "PARTIAL", label: "Partial" },
    { key: "APPROVED", label: "Approved" },
    { key: "REJECTED", label: "Rejected" },
    { key: "ALL", label: "All" },
];

function statusBadge(status: PendingReceiptStatus) {
    switch (status) {
        case "PENDING":
            return <Badge variant="secondary">Pending review</Badge>;
        case "PARTIAL":
            return (
                <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-200">
                    Partial
                </Badge>
            );
        case "APPROVED":
            return (
                <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-200">
                    Approved
                </Badge>
            );
        case "REJECTED":
            return <Badge variant="destructive">Rejected</Badge>;
        default:
            return <Badge variant="outline">{status}</Badge>;
    }
}

export default function StockReceiptsListPage() {
    const router = useRouter();
    const [items, setItems] = useState<StockReceiptListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<FilterTab>("PENDING");
    const [pendingCount, setPendingCount] = useState(0);

    const fetchData = useCallback(async () => {
        try {
            const resp = await api.listStockReceipts({
                status: filter === "ALL" ? undefined : filter,
                limit: 50,
            });
            if (resp.success && Array.isArray(resp.data)) {
                setItems(resp.data);
                if (typeof (resp as any).pendingCount === "number") {
                    setPendingCount((resp as any).pendingCount);
                }
            } else {
                toast.error(resp.error || "Failed to load stock receipts");
            }
        } catch (err) {
            logger.error("Error loading stock receipts:", { err });
            toast.error("Network error loading stock receipts");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [filter]);

    useEffect(() => {
        setLoading(true);
        fetchData();
    }, [fetchData]);

    return (
        <ProtectedRoute requiredRoles={["ADMIN", "MANAGER", "STAFF"]}>
            <DashboardLayout>
                <div className="space-y-6">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <Mail className="h-6 w-6 text-blue-600" />
                                Supplier Stock Receipts
                            </h1>
                            <p className="text-sm text-muted-foreground mt-1">
                                Order-confirmation emails parsed by the Gmail cron. Review and
                                approve to add stock to inventory.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setRefreshing(true);
                                    fetchData();
                                }}
                                disabled={refreshing}
                            >
                                <RefreshCcw
                                    className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
                                />
                                Refresh
                            </Button>
                            <Link href="/inventory/receipts/settings">
                                <Button variant="outline" size="sm">
                                    <Settings className="h-4 w-4 mr-2" />
                                    Settings
                                </Button>
                            </Link>
                        </div>
                    </div>

                    {pendingCount > 0 && filter !== "PENDING" && (
                        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
                            <AlertCircle className="h-4 w-4" />
                            <span>
                                <strong>{pendingCount}</strong> receipt
                                {pendingCount === 1 ? "" : "s"} pending review.
                            </span>
                            <Button
                                variant="link"
                                size="sm"
                                className="px-1 h-auto text-amber-900 underline"
                                onClick={() => setFilter("PENDING")}
                            >
                                Show pending
                            </Button>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2 border-b">
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
                                    {tab.key === "PENDING" && pendingCount > 0 && (
                                        <Badge variant="secondary" className="ml-2">
                                            {pendingCount}
                                        </Badge>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="rounded-lg border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Supplier</TableHead>
                                    <TableHead>Order #</TableHead>
                                    <TableHead>Received</TableHead>
                                    <TableHead className="text-center">Lines</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-12">
                                            Loading…
                                        </TableCell>
                                    </TableRow>
                                ) : items.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-12">
                                            No receipts in this view.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    items.map((r) => (
                                        <TableRow
                                            key={r.id}
                                            className="cursor-pointer hover:bg-muted/30"
                                            onClick={() => router.push(`/inventory/receipts/${r.id}`)}
                                        >
                                            <TableCell>
                                                <div className="font-medium">{r.source.name}</div>
                                                <div className="text-xs text-muted-foreground">{r.source.senderEmail}</div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-mono text-sm">
                                                    {r.orderNumber ? `#${r.orderNumber}` : "—"}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {new Date(r.receivedAt).toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-center text-sm">
                                                <span className="font-medium">{r.matchedCount}</span>
                                                <span className="text-muted-foreground">/{r.lineCount}</span>
                                            </TableCell>
                                            <TableCell>{statusBadge(r.status)}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); router.push(`/inventory/receipts/${r.id}`); }}>
                                                    Review
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
