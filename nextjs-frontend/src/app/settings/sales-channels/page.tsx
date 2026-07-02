"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Settings, RefreshCw, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ProtectedRoute } from "@/contexts/auth-context";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import logger from '@/lib/logger';

export default function SalesChannelsPage() {
    const router = useRouter();
    const [channels, setChannels] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchChannels = async () => {
        setLoading(true);
        try {
            const res = await api.get("/sales-channels");
            if (res.success) {
                setChannels(res.data);
            } else {
                toast.error("Failed to load sales channels");
            }
        } catch (e) {
            logger.error("Failed to load sales channels", { error: e });
            toast.error("Failed to load sales channels");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchChannels();
    }, []);

    const getStatusBadge = (status: string) => {
        if (status === "ACTIVE") {
            return (
                <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                    Active
                </Badge>
            );
        }
        return <Badge variant="secondary">Paused</Badge>;
    };

    const getTypeLabel = (type: string) => {
        // Map backend enums to UI labels if needed, or just capitalize
        if (type === "OWN") return "Own Ecommerce";
        if (type === "PARTNER") return "Channel Partner";
        return type;
    };

    const getFulfillmentLabel = (model: string) => {
        if (model === "OWN_ECOMMERCE") return "Own Ecommerce";
        if (model === "DROPSHIP") return "Dropship";
        return model;
    };

    const handleDeleteClick = (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent row click navigation
        setSelectedChannelId(id);
        setConfirmDeleteOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedChannelId) return;

        try {
            setIsDeleting(true);
            toast.loading("Deleting channel...");
            const res = await api.delete(`/sales-channels/${selectedChannelId}`);
            if (res.success) {
                toast.success("Channel deleted successfully");
                fetchChannels();
            } else {
                toast.error(res.error || "Failed to delete channel");
            }
        } catch (e: any) {
            toast.error("Error: " + e.message);
        } finally {
            setIsDeleting(false);
            setConfirmDeleteOpen(false);
            setSelectedChannelId(null);
        }
    };

    return (
        <ProtectedRoute requiredPermissions={[{ module: 'settings', action: 'READ' }]}>
            <DashboardLayout>
                <div className="space-y-0">

                    {/* ════════ DARK HERO STRIP ════════ */}
                    <div className="relative bg-mist border border-line border-t-2 border-t-[#5A9ADA] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
                        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                        <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#5A9ADA]/8 rounded-full blur-[100px] pointer-events-none" />

                        <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div>
                                    <h1 className="text-xl font-black text-[#043061] tracking-tight">Sales Channels</h1>
                                    <p className="text-xs text-gray-500 mt-0.5">Manage external sales channels and partners</p>
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <div className="flex items-center gap-2.5 bg-white border border-line rounded-xl px-4 py-2">
                                        <Settings className="h-4 w-4 text-[#5A9ADA]" />
                                        <div>
                                            <p className="text-[9px] text-gray-500 font-medium uppercase tracking-widest leading-none">Channels</p>
                                            <p className="text-base font-black text-[#043061] tabular-nums leading-tight">{channels.length}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => router.push("/settings/sales-channels/new")}
                                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#043061] text-white hover:bg-[#0b4f96] text-xs font-black uppercase tracking-widest transition-colors"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        Add Channel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ════════ TABLE ════════ */}
                    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden mx-1 sm:mx-0 mt-4">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="min-w-[180px]">Company Name</TableHead>
                                        <TableHead className="min-w-[140px]">Channel Type</TableHead>
                                        <TableHead className="min-w-[160px]">Contact Info</TableHead>
                                        <TableHead className="min-w-[140px]">Fulfillment</TableHead>
                                        <TableHead className="min-w-[100px]">Status</TableHead>
                                        <TableHead className="text-right min-w-[180px]">Manage</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-12">
                                                <div className="flex flex-col items-center justify-center gap-2">
                                                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                                                    <span className="text-muted-foreground">Loading channels...</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : channels.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                                No channels found. Click "Add Channel" to create your first partner connection.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        channels.map((channel) => (
                                            <TableRow
                                                key={channel.id}
                                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                                onClick={() => router.push(`/settings/sales-channels/${channel.id}`)}
                                            >
                                                <TableCell className="font-medium">
                                                    {channel.companyName}
                                                    {channel.isDefault && <Badge variant="outline" className="ml-2 text-[10px]">Default</Badge>}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="font-normal text-xs">
                                                        {getTypeLabel(channel.type)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col text-xs sm:text-sm">
                                                        <span className="font-medium">{channel.contactPerson}</span>
                                                        <span className="text-xs text-muted-foreground">{channel.contactNumber}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs sm:text-sm">
                                                    {getFulfillmentLabel(channel.fulfillmentModel)}
                                                </TableCell>
                                                <TableCell>
                                                    {getStatusBadge(channel.status)}
                                                </TableCell>
                                                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3 sm:py-2"
                                                            onClick={() => router.push(`/settings/sales-channels/${channel.id}`)}
                                                        >
                                                            <Settings className="h-4 w-4 sm:mr-2" />
                                                            <span className="hidden sm:inline">Configure</span>
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3 sm:py-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                            onClick={(e) => handleDeleteClick(channel.id, e)}
                                                        >
                                                            <Trash2 className="h-4 w-4 sm:mr-2" />
                                                            <span className="hidden sm:inline">Delete</span>
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    <ConfirmationDialog
                        open={confirmDeleteOpen}
                        onOpenChange={setConfirmDeleteOpen}
                        onConfirm={handleConfirmDelete}
                        title="Delete Sales Channel"
                        description="Are you sure you want to delete this sales channel? This will remove all associated pricing but keep existing orders. This action cannot be undone."
                        confirmText="Delete Channel"
                        cancelText="Cancel"
                        variant="destructive"
                        isLoading={isDeleting}
                    />
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
