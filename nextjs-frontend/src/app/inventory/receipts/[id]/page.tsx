"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProtectedRoute } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    ArrowLeft,
    Check,
    X,
    LinkIcon,
    Unlink,
    ExternalLink,
    Search,
} from "lucide-react";
import { api } from "@/lib/api";
import type {
    StockReceiptDetail,
    StockReceiptLine,
} from "@/lib/api-stock-receipts";
import logger from "@/lib/logger";
import { toast } from "sonner";

interface VariantOption {
    id: string;
    sku: string;
    name: string;
    productName: string;
}

function lineStatusBadge(line: StockReceiptLine) {
    if (line.appliedMovementId) {
        return (
            <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-200">
                Applied
            </Badge>
        );
    }
    switch (line.matchStatus) {
        case "AUTO_MATCHED":
            return (
                <Badge className="bg-blue-100 text-blue-900 hover:bg-blue-200">
                    Auto-matched
                </Badge>
            );
        case "MANUAL_MATCHED":
            return (
                <Badge className="bg-indigo-100 text-indigo-900 hover:bg-indigo-200">
                    Manually matched
                </Badge>
            );
        case "REJECTED":
            return <Badge variant="destructive">Rejected</Badge>;
        case "UNMATCHED":
        default:
            return (
                <Badge className="bg-red-100 text-red-900 hover:bg-red-200">
                    Unmatched
                </Badge>
            );
    }
}

export default function StockReceiptDetailPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const id = params?.id;

    const [receipt, setReceipt] = useState<StockReceiptDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [searchOpenFor, setSearchOpenFor] = useState<string | null>(null);
    const [confirmReject, setConfirmReject] = useState(false);

    const fetchReceipt = useCallback(async () => {
        if (!id) return;
        try {
            const resp = await api.getStockReceipt(id);
            if (resp.success && resp.data) {
                setReceipt(resp.data);
            } else {
                toast.error(resp.error || "Failed to load receipt");
                router.push("/inventory/receipts");
            }
        } catch (err) {
            logger.error("Error loading receipt:", { err });
            toast.error("Network error loading receipt");
        } finally {
            setLoading(false);
        }
    }, [id, router]);

    useEffect(() => {
        fetchReceipt();
    }, [fetchReceipt]);

    const matchableLines = receipt
        ? receipt.lines.filter(
              (l) => l.matchStatus === "AUTO_MATCHED" || l.matchStatus === "MANUAL_MATCHED",
          ).length
        : 0;
    const unmatchedCount = receipt
        ? receipt.lines.filter((l) => l.matchStatus === "UNMATCHED").length
        : 0;
    const appliedCount = receipt
        ? receipt.lines.filter((l) => l.appliedMovementId).length
        : 0;

    const canApprove =
        receipt &&
        receipt.status !== "APPROVED" &&
        receipt.status !== "REJECTED" &&
        matchableLines > 0 &&
        appliedCount < matchableLines;

    async function handleMapLine(lineId: string, variant: VariantOption) {
        try {
            const resp = await api.mapStockReceiptLine(id!, lineId, {
                variantId: variant.id,
                rememberMapping: true,
            });
            if (resp.success) {
                toast.success(`Mapped to ${variant.sku}`);
                setSearchOpenFor(null);
                await fetchReceipt();
            } else {
                toast.error(resp.error || "Failed to map line");
            }
        } catch (err) {
            logger.error("Map line error:", { err });
            toast.error("Network error mapping line");
        }
    }

    async function handleUnlinkLine(lineId: string) {
        try {
            const resp = await api.unlinkStockReceiptLine(id!, lineId);
            if (resp.success) {
                toast.success("Line unlinked");
                await fetchReceipt();
            } else {
                toast.error(resp.error || "Failed to unlink line");
            }
        } catch (err) {
            logger.error("Unlink line error:", { err });
            toast.error("Network error unlinking line");
        }
    }

    async function handleApprove() {
        if (!receipt) return;
        setBusy(true);
        try {
            const resp = await api.approveStockReceipt(receipt.id);
            if (resp.success && resp.data) {
                toast.success(
                    `Applied ${resp.data.appliedLines} line${resp.data.appliedLines === 1 ? "" : "s"} — status: ${resp.data.status}`,
                );
                await fetchReceipt();
            } else {
                toast.error(resp.error || "Failed to approve receipt");
            }
        } catch (err) {
            logger.error("Approve error:", { err });
            toast.error("Network error approving receipt");
        } finally {
            setBusy(false);
        }
    }

    async function handleReject() {
        if (!receipt) return;
        setBusy(true);
        try {
            const resp = await api.rejectStockReceipt(receipt.id);
            if (resp.success) {
                toast.success("Receipt rejected");
                setConfirmReject(false);
                await fetchReceipt();
            } else {
                toast.error(resp.error || "Failed to reject receipt");
            }
        } catch (err) {
            logger.error("Reject error:", { err });
            toast.error("Network error rejecting receipt");
        } finally {
            setBusy(false);
        }
    }

    if (loading) {
        return (
            <ProtectedRoute requiredRoles={["ADMIN", "MANAGER", "STAFF"]}>
                <DashboardLayout>
                    <p className="text-sm text-muted-foreground">Loading…</p>
                </DashboardLayout>
            </ProtectedRoute>
        );
    }

    if (!receipt) {
        return (
            <ProtectedRoute requiredRoles={["ADMIN", "MANAGER", "STAFF"]}>
                <DashboardLayout>
                    <p className="text-sm text-muted-foreground">Receipt not found.</p>
                </DashboardLayout>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute requiredRoles={["ADMIN", "MANAGER", "STAFF"]}>
            <DashboardLayout>
                <div className="space-y-6 pb-24">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Link href="/inventory/receipts">
                                <Button variant="ghost" size="sm">
                                    <ArrowLeft className="h-4 w-4 mr-1" />
                                    Back
                                </Button>
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold">
                                    {receipt.source.name}
                                    {receipt.orderNumber && (
                                        <span className="font-mono text-muted-foreground ml-2">
                                            #{receipt.orderNumber}
                                        </span>
                                    )}
                                </h1>
                                <p className="text-sm text-muted-foreground">
                                    {receipt.rawSubject}
                                </p>
                            </div>
                        </div>
                        {receipt.gmailThreadId && (
                            <a
                                href={`https://mail.google.com/mail/u/0/#all/${receipt.gmailThreadId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center text-sm text-blue-600 hover:underline"
                            >
                                View original
                                <ExternalLink className="h-3.5 w-3.5 ml-1" />
                            </a>
                        )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div className="rounded-lg border bg-card p-3">
                            <p className="text-xs text-muted-foreground">From</p>
                            <p className="font-medium truncate">{receipt.source.senderEmail}</p>
                        </div>
                        <div className="rounded-lg border bg-card p-3">
                            <p className="text-xs text-muted-foreground">Received</p>
                            <p className="font-medium">{new Date(receipt.receivedAt).toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg border bg-card p-3">
                            <p className="text-xs text-muted-foreground">Default location</p>
                            <p className="font-medium">{receipt.source.location?.name || "—"}</p>
                        </div>
                        <div className="rounded-lg border bg-card p-3">
                            <p className="text-xs text-muted-foreground">Status</p>
                            <p className="font-medium">{receipt.status}</p>
                        </div>
                    </div>

                    <div className="rounded-lg border bg-card overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Product from email</TableHead>
                                    <TableHead className="text-center">Qty</TableHead>
                                    <TableHead>Matched variant</TableHead>
                                    <TableHead className="text-right">Effective qty</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {receipt.lines.map((line) => (
                                    <TableRow key={line.id}>
                                        <TableCell className="font-medium">
                                            {line.supplierProductName}
                                        </TableCell>
                                        <TableCell className="text-center font-mono">
                                            ×{line.parsedQuantity}
                                        </TableCell>
                                        <TableCell>
                                            {line.variant ? (
                                                <div>
                                                    <div className="font-medium">{line.variant.product.name}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {line.variant.name} · {line.variant.sku}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground italic">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {line.effectiveQuantity ?? "—"}
                                        </TableCell>
                                        <TableCell>{lineStatusBadge(line)}</TableCell>
                                        <TableCell className="text-right">
                                            {line.appliedMovementId ? (
                                                <span className="text-xs text-muted-foreground">
                                                    <Check className="h-3.5 w-3.5 inline mr-1" />
                                                    Applied
                                                </span>
                                            ) : line.matchedVariantId ? (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleUnlinkLine(line.id)}
                                                >
                                                    <Unlink className="h-3.5 w-3.5 mr-1" />
                                                    Unlink
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setSearchOpenFor(line.id)}
                                                >
                                                    <LinkIcon className="h-3.5 w-3.5 mr-1" />
                                                    Map…
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Sticky footer */}
                    <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur px-6 py-3 flex items-center justify-between z-10">
                        <div className="text-sm">
                            <span className="font-semibold">{matchableLines}</span>{" "}
                            <span className="text-muted-foreground">of {receipt.lines.length} matched</span>
                            {unmatchedCount > 0 && (
                                <span className="ml-3 text-amber-700">
                                    · {unmatchedCount} still unmatched
                                </span>
                            )}
                            {appliedCount > 0 && (
                                <span className="ml-3 text-emerald-700">
                                    · {appliedCount} already applied
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {receipt.status !== "REJECTED" && receipt.status !== "APPROVED" && (
                                <Button
                                    variant="outline"
                                    onClick={() => setConfirmReject(true)}
                                    disabled={busy}
                                >
                                    <X className="h-4 w-4 mr-1" />
                                    Reject
                                </Button>
                            )}
                            {canApprove && (
                                <Button onClick={handleApprove} disabled={busy}>
                                    <Check className="h-4 w-4 mr-1" />
                                    Approve {matchableLines - appliedCount} matched line
                                    {matchableLines - appliedCount === 1 ? "" : "s"}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                <VariantSearchDialog
                    open={searchOpenFor !== null}
                    onClose={() => setSearchOpenFor(null)}
                    onPick={(v) => searchOpenFor && handleMapLine(searchOpenFor, v)}
                    initialQuery={
                        searchOpenFor
                            ? receipt.lines.find((l) => l.id === searchOpenFor)?.supplierProductName ||
                              ""
                            : ""
                    }
                />

                <Dialog open={confirmReject} onOpenChange={setConfirmReject}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Reject this receipt?</DialogTitle>
                            <DialogDescription>
                                No inventory changes will be made. The original supplier email will
                                remain in Gmail.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setConfirmReject(false)}>
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={handleReject} disabled={busy}>
                                Reject
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </DashboardLayout>
        </ProtectedRoute>
    );
}

function VariantSearchDialog({
    open,
    onClose,
    onPick,
    initialQuery,
}: {
    open: boolean;
    onClose: () => void;
    onPick: (v: VariantOption) => void;
    initialQuery: string;
}) {
    const [query, setQuery] = useState(initialQuery);
    const [results, setResults] = useState<VariantOption[]>([]);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (open) setQuery(initialQuery);
    }, [open, initialQuery]);

    useEffect(() => {
        if (!open) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            try {
                const resp = await api.getProducts({ search: query, limit: 20 });
                if (resp.success && resp.data) {
                    const out: VariantOption[] = [];
                    for (const product of (resp.data as any).products || []) {
                        for (const variant of product.variants || []) {
                            out.push({
                                id: variant.id,
                                sku: variant.sku,
                                name: variant.name,
                                productName: product.name,
                            });
                        }
                    }
                    setResults(out);
                }
            } catch (err) {
                logger.error("Variant search error:", { err });
            } finally {
                setLoading(false);
            }
        }, 200);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query, open]);

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Map to a product variant</DialogTitle>
                    <DialogDescription>
                        Pick the variant this supplier line corresponds to. This mapping is
                        remembered for future emails.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="relative">
                        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search by product name or SKU…"
                            className="pl-9"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="max-h-72 overflow-y-auto rounded-md border">
                        {loading ? (
                            <p className="p-4 text-sm text-muted-foreground">Searching…</p>
                        ) : results.length === 0 ? (
                            <p className="p-4 text-sm text-muted-foreground">No matches.</p>
                        ) : (
                            <ul>
                                {results.map((v) => (
                                    <li key={v.id}>
                                        <button
                                            className="w-full text-left px-3 py-2 hover:bg-muted/50 border-b last:border-b-0"
                                            onClick={() => onPick(v)}
                                        >
                                            <div className="font-medium">{v.productName}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {v.name} · <span className="font-mono">{v.sku}</span>
                                            </div>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
