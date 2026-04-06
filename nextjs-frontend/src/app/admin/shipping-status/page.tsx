"use client";

import React, { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProtectedRoute } from "@/contexts/auth-context";
import { api } from "@/lib/api";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import {
    FileJson,
    Package,
    RefreshCw,
    Clock,
    CheckCircle2,
    Truck
} from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import logger from "@/lib/logger";

export default function ShippingStatusPage() {
    const [data, setData] = useState<any[]>([]);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [isSyncing, setIsSyncing] = useState(false);

    const fetchData = async (pageNum = page) => {
        setLoading(true);
        try {
            const res = await api.getShippingSyncStatus({ page: pageNum, limit: 20 });
            if (res.success && res.data) {
                setData(res.data.data || []);
                if (res.data.pagination) {
                    setTotalPages(res.data.pagination.totalPages || 1);
                    setTotalRecords(res.data.pagination.total || 0);
                }
            } else {
                toast.error("Failed to load tracking data");
            }
        } catch (err) {
            console.error("Failed to fetch shipping status", err);
            toast.error("An error occurred while loading tracking data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [page]);

    const handleManualSync = async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        const id = toast.loading("Starting batch sync...");
        try {
            const res = await api.syncShipmentTrackingSyncAll();
            if (res.success) {
                toast.success(`Sync complete: ${res.data?.updated || 0} orders updated`, { id });
                fetchData(1);
                setPage(1);
            } else {
                toast.error("Sync failed: " + res.error, { id });
            }
        } catch (err) {
            logger.error("Manual sync error", { err });
            toast.error("An error occurred during sync", { id });
        } finally {
            setIsSyncing(false);
        }
    };

    const getStatusColor = (status: string) => {
        const s = status?.toUpperCase();
        if (s === "DELIVERED") return "default";
        if (s === "SHIPPED") return "secondary";
        if (s === "LABEL_CREATED") return "outline";
        return "secondary";
    };

    return (
        <ProtectedRoute requiredRoles={["ADMIN", "SUPER_ADMIN", "STAFF"]}>
            <DashboardLayout>
                <div className="space-y-6 px-4 md:px-0">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Shipping Sync Monitor</h1>
                            <p className="text-muted-foreground text-sm mt-1">
                                Real-time tracking status from ShipStation for all active orders.
                            </p>
                        </div>
                        <Button
                            onClick={handleManualSync}
                            disabled={isSyncing || loading}
                            className="w-full md:w-auto gap-2"
                        >
                            {isSyncing ? <LoadingSpinner size={16} /> : <RefreshCw className="h-4 w-4" />}
                            {isSyncing ? "Syncing..." : "Trigger Batch Sync"}
                        </Button>
                    </div>

                    <Card className="border-border shadow-sm">
                        <CardHeader className="pb-3 border-b">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg font-semibold">Synced Records</CardTitle>
                                    <CardDescription>
                                        Historical log of the latest tracking status syncs.
                                    </CardDescription>
                                </div>
                                <div className="text-right">
                                    <Badge variant="outline" className="font-mono">
                                        Total: {totalRecords}
                                    </Badge>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="relative overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow>
                                            <TableHead className="w-[180px] font-semibold">Order Number</TableHead>
                                            <TableHead className="font-semibold">Label ID</TableHead>
                                            <TableHead className="font-semibold">Status</TableHead>
                                            <TableHead className="font-semibold text-center">Detail Code</TableHead>
                                            <TableHead className="font-semibold">Last Updated</TableHead>
                                            <TableHead className="text-right font-semibold">Raw Data</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-48 text-center">
                                                    <div className="flex flex-col items-center justify-center gap-3">
                                                        <LoadingSpinner size={32} />
                                                        <p className="text-sm font-medium text-muted-foreground">Loading sync history...</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : data.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic">
                                                    No sync records found.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            data.map((item) => (
                                                <TableRow key={item.id} className="hover:bg-muted/20 transition-colors">
                                                    <TableCell className="font-medium">
                                                        <Link
                                                            href={`/orders/${item.orderId}`}
                                                            className="inline-flex items-center gap-2 text-primary hover:underline group"
                                                        >
                                                            <Package className="h-4 w-4 opacity-70 group-hover:opacity-100" />
                                                            {item.order?.orderNumber || "N/A"}
                                                        </Link>
                                                    </TableCell>
                                                    <TableCell>
                                                        <code className="text-[11px] font-mono bg-muted px-2 py-0.5 rounded border border-border/50">
                                                            {item.labelId}
                                                        </code>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={getStatusColor(item.shipmentStatus)} className="gap-1.5 px-2">
                                                            {item.shipmentStatus === 'DELIVERED' ? (
                                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                            ) : (
                                                                <Truck className="h-3.5 w-3.5" />
                                                            )}
                                                            {item.shipmentStatus || 'UNKNOWN'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {item.statusDetailCode ? (
                                                            <span className="text-xs font-mono font-semibold bg-muted/50 px-1.5 py-0.5 rounded text-muted-foreground">
                                                                {item.statusDetailCode}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground/30">—</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">
                                                        <div className="flex flex-col">
                                                            <span className="flex items-center gap-1.5 font-medium text-foreground">
                                                                <Clock className="h-3.5 w-3.5 opacity-50" />
                                                                {format(new Date(item.updatedAt), "MMM d, yyyy")}
                                                            </span>
                                                            <span className="ml-[20px] opacity-70">
                                                                {format(new Date(item.updatedAt), "HH:mm:ss")}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Dialog>
                                                            <DialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary">
                                                                    <FileJson className="h-4 w-4" />
                                                                </Button>
                                                            </DialogTrigger>
                                                            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
                                                                <DialogHeader className="pb-4 border-b">
                                                                    <DialogTitle className="flex items-center gap-2 text-xl">
                                                                        <FileJson className="h-6 w-6 text-primary" />
                                                                        Tracking JSON Response
                                                                    </DialogTitle>
                                                                    <CardDescription>
                                                                        Raw payload returned by ShipStation API for label {item.labelId}
                                                                    </CardDescription>
                                                                </DialogHeader>
                                                                <div className="flex-1 overflow-auto mt-4 rounded-xl bg-[#0f1115] border border-border p-5">
                                                                    <pre className="text-[12px] leading-relaxed text-blue-300/90 font-mono scrollbar-thin scrollbar-thumb-muted-foreground/30">
                                                                        {JSON.stringify(item.rawData, null, 2)}
                                                                    </pre>
                                                                </div>
                                                            </DialogContent>
                                                        </Dialog>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination Controls */}
                            {!loading && totalPages > 1 && (
                                <div className="p-4 border-t flex justify-center bg-muted/5">
                                    <Pagination
                                        currentPage={page}
                                        totalPages={totalPages}
                                        onPageChange={setPage}
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
