"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Download, Upload, RefreshCw, FileSpreadsheet, Save, Search, AlertCircle } from "lucide-react";
import { api, getToken } from "@/lib/api";
import { toast } from "sonner";
import { ProtectedRoute } from "@/contexts/auth-context";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Pagination } from "@/components/ui/pagination";
import { API_BASE_URL } from "@/lib/env";

import logger from '@/lib/logger';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export default function ChannelPricingPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    // State
    const [channel, setChannel] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [showPreview, setShowPreview] = useState(false);
    const [originalUpdates, setOriginalUpdates] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchChannelInfo();
    }, [id]);

    const fetchChannelInfo = async () => {
        try {
            const res = await api.get(`/sales-channels/${id}`);
            if (res.success) {
                setChannel(res.data);
            } else {
                toast.error("Failed to load channel information");
                router.push("/settings/sales-channels");
            }
        } catch (e) {
            toast.error("Failed to load channel information");
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadTemplate = async () => {
        setDownloading(true);
        try {
            const token = getToken();
            const headers: HeadersInit = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch(`${API_BASE_URL}/sales-channels/${id}/price-list/template`, {
                headers,
                credentials: 'include',
            });

            if (!res.ok) throw new Error("Download failed");

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `price-list-${channel?.companyName?.replace(/\s+/g, '-').toLowerCase() || 'channel'}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            toast.success("Price list template downloaded");
        } catch (e) {
            logger.error("Failed to download template", { error: e });
            toast.error("Failed to download template. Please try again.");
        } finally {
            setDownloading(false);
        }
    };

    const handleUploadPriceList = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const data = new FormData();
        data.append("file", file);

        try {
            // First do a dry run
            const res: any = await api.postFormData(`/sales-channels/${id}/price-list/upload?dryRun=true`, data);
            if (res.success) {
                if (res.preview && res.preview.length > 0) {
                    setPreviewData(res.preview);
                    // Store the raw SKU/Price pairs for final submission
                    setOriginalUpdates(res.preview.map((p: any) => ({ sku: p.sku, price: p.channelPrice })));
                    setShowPreview(true);
                } else {
                    toast.error("No valid prices found in the file.");
                }

                if (res.errors && res.errors.length > 0) {
                    logger.warn("Parsing warnings:", { warning: res.errors });
                }
            } else {
                toast.error(res.error || "Upload failed during parsing");
            }
        } catch (e) {
            toast.error("Upload failed");
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    };

    const handleConfirmImport = async () => {
        if (originalUpdates.length === 0) return;

        setSaving(true);
        try {
            const res = await api.post(`/sales-channels/${id}/price-list/upload`, {
                updates: originalUpdates
            });

            if (res.success) {
                toast.success(res.message || "Prices imported successfully");
                setShowPreview(false);
                // Navigate back to channel details page as requested
                router.push(`/settings/sales-channels/${id}`);
            } else {
                toast.error(res.error || "Import failed");
            }
        } catch (e) {
            toast.error("Import failed");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex h-[50vh] items-center justify-center flex-col gap-4">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-muted-foreground">Loading channel info...</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <ProtectedRoute requiredPermissions={[{ module: 'settings', action: 'UPDATE' }]}>
            <DashboardLayout>
                <div className="space-y-6 max-w-4xl mx-auto pb-20">
                    {/* Header */}
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" onClick={() => router.push(`/settings/sales-channels/${id}`)}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Bulk Pricing Operations</h1>
                            <p className="text-muted-foreground">
                                Import/Export price lists for <span className="font-semibold text-foreground">{channel?.companyName}</span>
                            </p>
                        </div>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Bulk Actions</CardTitle>
                            <CardDescription>
                                Manage large price lists efficiently using Excel.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            {/* Download */}
                            <div className="flex flex-col md:flex-row gap-6 md:items-start">
                                <div className="flex-shrink-0 mt-1">
                                    <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                                        1
                                    </div>
                                </div>
                                <div className="space-y-3 flex-1">
                                    <h3 className="text-lg font-medium">Download Current Price List</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Get an Excel file (.xlsx) containing all active SKUs. The file includes:
                                        <ul className="list-disc list-inside mt-2 ml-1 text-xs sm:text-sm font-mono bg-muted/50 p-3 rounded-md">
                                            <li>SKU (Do not modify)</li>
                                            <li>Product Name</li>
                                            <li>Channel Price</li>
                                        </ul>
                                    </p>
                                    <Button
                                        variant="outline"
                                        onClick={handleDownloadTemplate}
                                        disabled={downloading}
                                        className="mt-2"
                                    >
                                        {downloading ? (
                                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Download className="mr-2 h-4 w-4" />
                                        )}
                                        {downloading ? "Generating..." : "Download SKU List"}
                                    </Button>
                                    <p className="text-xs text-muted-foreground italic">
                                        Includes current channel prices.
                                    </p>
                                </div>
                            </div>

                            <Separator />

                            {/* Upload */}
                            <div className="flex flex-col md:flex-row gap-6 md:items-start">
                                <div className="flex-shrink-0 mt-1">
                                    <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 font-bold">
                                        2
                                    </div>
                                </div>
                                <div className="space-y-3 flex-1">
                                    <h3 className="text-lg font-medium">Upload Updated Price List</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Upload your edited Excel file here. The system will match prices by SKU.
                                    </p>

                                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:bg-muted/50 transition-colors relative">
                                        <div className="flex flex-col items-center gap-2">
                                            <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
                                            {uploading ? (
                                                <div className="space-y-2">
                                                    <p className="text-sm font-medium">Processing file...</p>
                                                    <RefreshCw className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                                                </div>
                                            ) : (
                                                <>
                                                    <p className="text-sm font-medium">
                                                        Click to select or drag file here
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Supports .xlsx, .xls
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                        <Input
                                            type="file"
                                            accept=".xlsx, .xls"
                                            onChange={handleUploadPriceList}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                            disabled={uploading}
                                        />
                                    </div>

                                    <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-md border border-yellow-200 dark:border-yellow-900/20">
                                        <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-1">Important Rules</h4>
                                        <ul className="text-xs text-yellow-700 dark:text-yellow-300 list-disc list-inside space-y-1">
                                            <li>Do not change SKU codes. Unmatched SKUs will be ignored.</li>
                                            <li>Leave price blank or 0 to remove a channel price or keep existing.</li>
                                            <li>Ensure the file format remains .xlsx.</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Preview Dialog */}
                <Dialog open={showPreview} onOpenChange={setShowPreview}>
                    <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                        <DialogHeader>
                            <DialogTitle>Review Price Changes</DialogTitle>
                            <DialogDescription>
                                We found {previewData.length} items to update. Please review before saving.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex-1 overflow-auto border rounded-md my-4">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50 sticky top-0 z-10">
                                        <TableHead>SKU</TableHead>
                                        <TableHead>Product / Variant</TableHead>
                                        <TableHead className="text-right">New Price</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {previewData.map((item, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                                            <TableCell className="text-xs">{item.name}</TableCell>

                                            <TableCell className="text-right text-xs font-bold text-green-600">
                                                ${item.channelPrice?.toFixed(2)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowPreview(false)} disabled={saving}>
                                Cancel
                            </Button>
                            <Button onClick={handleConfirmImport} disabled={saving}>
                                {saving ? (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        Importing...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Save Changes
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
