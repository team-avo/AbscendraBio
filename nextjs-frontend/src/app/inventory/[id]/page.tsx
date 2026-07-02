"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProtectedRoute } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, AlertTriangle, Package, Check, Plus, X, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "@/components/ui/select";
import { api, resolveImageUrl } from "@/lib/api";
import logger from "@/lib/logger";
import { toast } from "sonner";

interface LocationInventory {
    locationId: string;
    locationName: string;
    locationCity: string | null;
    locationState: string | null;
    committed: number;
    available: number;
    onHand: number;
    lowStockAlert: number;
    barcode: string;
    sellWhenOutOfStock: boolean;
}

interface InventoryItem {
    id: string;
    productId: string;
    productName: string;
    productImage: string | null;
    variantName: string;
    sku: string;
    committed: number;
    available: number;
    onHand: number;
    lowStockThreshold: number;
    barcode: string;
    sellWhenOutOfStock: boolean;
    price: number;
    regularPrice: number;
    salePrice: number | null;
    locationInventory: LocationInventory[];
}

interface EditedLocationValues {
    [locationId: string]: {
        committed?: number;
        onHand?: number;
        barcode?: string;
        sellWhenOutOfStock?: boolean;
    };
}

export default function InventoryDetailPage() {
    const params = useParams();
    const id = params?.id as string;
    const router = useRouter();
    const [product, setProduct] = useState<InventoryItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [editedValues, setEditedValues] = useState<EditedLocationValues>({});
    const [saving, setSaving] = useState<string | null>(null);
    const [showBarcodeSection, setShowBarcodeSection] = useState(false);
    const [showSellOutOfStockSection, setShowSellOutOfStockSection] = useState(false);
    const [detailsEdited, setDetailsEdited] = useState<{
        barcode?: string;
        sellWhenOutOfStock?: boolean;
    }>({});
    const [savingDetails, setSavingDetails] = useState(false);
    const [showCommittedDialog, setShowCommittedDialog] = useState(false);
    const [committedOrders, setCommittedOrders] = useState<any[]>([]);
    const [loadingOrders, setLoadingOrders] = useState(false);

    useEffect(() => {
        if (!id) return;

        const fetchProduct = async () => {
            setLoading(true);
            try {
                const response = await api.getVariantInventoryDetails(id);

                if (response.success && response.data) {
                    setProduct(response.data);
                    // Auto-expand sections if data exists
                    if (response.data.barcode) {
                        setShowBarcodeSection(true);
                    }
                    if (response.data.sellWhenOutOfStock) {
                        setShowSellOutOfStockSection(true);
                    }
                }
            } catch (error) {
                logger.error("Error fetching product:", { error });
            } finally {
                setLoading(false);
            }
        };

        fetchProduct();
    }, [id]);

    const generateNumberOptions = (max: number = 1000) => {
        return Array.from({ length: max + 1 }, (_, i) => i);
    };

    const handleLocationChange = (locationId: string, field: 'committed' | 'onHand' | 'barcode' | 'sellWhenOutOfStock', value: any) => {
        setEditedValues(prev => ({
            ...prev,
            [locationId]: {
                ...prev[locationId],
                [field]: value,
            },
        }));
    };

    const hasLocationChanges = (locationId: string) => {
        return editedValues[locationId] !== undefined;
    };

    const handleLocationCancel = (locationId: string) => {
        setEditedValues(prev => {
            const newEdited = { ...prev };
            delete newEdited[locationId];
            return newEdited;
        });
    };

    const handleLocationSave = async (location: LocationInventory) => {
        const changes = editedValues[location.locationId];
        if (!changes) return;

        setSaving(location.locationId);
        try {
            const newCommitted = Math.max(0, Math.abs(changes.committed ?? location.committed));
            const newOnHand = Math.max(0, Math.abs(changes.onHand ?? location.onHand));
            const newBarcode = changes.barcode ?? location.barcode;
            const newSellWhenOutOfStock = changes.sellWhenOutOfStock ?? location.sellWhenOutOfStock;

            // Call backend API to update location-specific inventory
            const response = await api.updateLocationInventory(id, location.locationId, {
                onHand: newOnHand,
                committed: newCommitted,
                barcode: newBarcode,
                sellWhenOutOfStock: newSellWhenOutOfStock,
                reason: "Manual location adjustment from details page",
            });

            if (response.success) {
                // Clear edited values
                setEditedValues(prev => {
                    const newEdited = { ...prev };
                    delete newEdited[location.locationId];
                    return newEdited;
                });

                toast.success("Location inventory updated successfully");

                // Refresh data to update status and tabs
                const refreshResponse = await api.getVariantInventoryDetails(id as string);
                if (refreshResponse.success && refreshResponse.data) {
                    setProduct(refreshResponse.data);
                }
            } else {
                toast.error("Failed to update location inventory");
            }
        } catch (error) {
            logger.error("Error saving location inventory:", { error });
            toast.error("Error saving location inventory");
        } finally {
            setSaving(null);
        }
    };

    const handleDetailChange = (field: 'barcode' | 'sellWhenOutOfStock', value: any) => {
        setDetailsEdited(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleDetailsSave = async () => {
        if (!id) return;
        setSavingDetails(true);
        try {
            const response = await api.updateVariantInventory(id as string, {
                barcode: detailsEdited.barcode,
                sellWhenOutOfStock: detailsEdited.sellWhenOutOfStock,
                reason: "Updated variant settings"
            });

            if (response.success) {
                toast.success("Settings updated successfully");
                setDetailsEdited({});
                // Refresh product data
                const refreshResponse = await api.getVariantInventoryDetails(id as string);
                if (refreshResponse.success && refreshResponse.data) {
                    setProduct(refreshResponse.data);
                }
            } else {
                toast.error("Failed to update settings");
            }
        } catch (error) {
            logger.error("Error updating settings:", { error });
            toast.error("Error updating settings");
        } finally {
            setSavingDetails(false);
        }
    };

    const handleCommittedClick = async () => {
        if (!id) return;
        setLoadingOrders(true);
        setShowCommittedDialog(true);
        try {
            const response = await api.getVariantCommittedOrders(id);
            if (response.success && response.data) {
                setCommittedOrders(response.data);
            }
        } catch (error) {
            logger.error("Error fetching committed orders:", { error });
            toast.error("Failed to load committed orders");
        } finally {
            setLoadingOrders(false);
        }
    };

    if (loading) {
        return (
            <ProtectedRoute requiredRoles={['ADMIN', 'MANAGER', 'STAFF']}>
                <DashboardLayout>
                    <div className="p-6">
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
                        </div>
                    </div>
                </DashboardLayout>
            </ProtectedRoute>
        );
    }

    if (!product) {
        return (
            <ProtectedRoute requiredRoles={['ADMIN', 'MANAGER', 'STAFF']}>
                <DashboardLayout>
                    <div className="p-6">
                        <div className="text-center py-12">
                            <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">Product not found</p>
                            <Button className="mt-4" onClick={() => router.push("/inventory")}>
                                Back to Inventory
                            </Button>
                        </div>
                    </div>
                </DashboardLayout>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute requiredRoles={['ADMIN', 'MANAGER', 'STAFF']}>
            <DashboardLayout>
                <div className="space-y-0">
                    {/* ════════ DARK HERO STRIP ════════ */}
                    <div className="relative bg-mist border border-line border-t-2 border-t-[#5A9ADA] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
                        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                        <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#5A9ADA]/8 rounded-full blur-[100px] pointer-events-none" />
                        <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    {product.productImage && (
                                        <div className="h-14 w-14 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center overflow-hidden flex-shrink-0">
                                            <img src={resolveImageUrl(product.productImage)} alt={product.productName} className="w-full h-full object-cover" />
                                        </div>
                                    )}
                                    <div>
                                        <button onClick={() => router.push("/inventory")} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 transition-colors text-xs mb-1.5">
                                            <ArrowLeft className="h-3.5 w-3.5" />
                                            Back to Inventory
                                        </button>
                                        <h1 className="text-xl font-black text-[#043061] tracking-tight">{product.productName}</h1>
                                        {product.variantName && (
                                            <p className="text-xs text-gray-400 mt-0.5">{product.variantName}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <div className="flex items-center gap-2.5 bg-white border border-line rounded-xl px-4 py-2">
                                        <div>
                                            <p className="text-[9px] text-gray-500 font-medium uppercase tracking-widest leading-none">Committed</p>
                                            <p className="text-base font-black text-[#043061] tabular-nums leading-tight cursor-pointer hover:text-[#5A9ADA] transition-colors" onClick={handleCommittedClick}>{product.committed}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2.5 bg-white border border-line rounded-xl px-4 py-2">
                                        <div>
                                            <p className="text-[9px] text-gray-500 font-medium uppercase tracking-widest leading-none">Available</p>
                                            <p className="text-base font-black text-[#043061] tabular-nums leading-tight">{product.available}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2.5 bg-white border border-line rounded-xl px-4 py-2">
                                        <Package className="h-4 w-4 text-[#5A9ADA]" />
                                        <div>
                                            <p className="text-[9px] text-gray-500 font-medium uppercase tracking-widest leading-none">On Hand</p>
                                            <p className="text-base font-black text-[#043061] tabular-nums leading-tight">{product.onHand}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ════════ INVENTORY CARD ════════ */}
                    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm mt-4 mx-1 sm:mx-0">
                        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
                            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-blue-50">
                                <Package className="h-4 w-4 text-blue-500" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold text-slate-800">Inventory</h2>
                                <p className="text-xs text-slate-400">Stock levels and pricing</p>
                            </div>
                        </div>
                        <div className="p-6 space-y-6">
                            {/* Stock Alert Banners */}
                            {product.available === 0 && (
                                <div className="flex items-start gap-3 p-4 border border-red-200 bg-red-50 rounded-xl">
                                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-semibold text-red-900">Out of Stock</p>
                                        <p className="text-xs text-red-700 mt-0.5">Consider restocking or enable "Continue selling when out of stock" for backorders.</p>
                                    </div>
                                </div>
                            )}
                            {product.available > 0 && product.available <= product.lowStockThreshold && (
                                <div className="flex items-start gap-3 p-4 border border-amber-200 bg-amber-50 rounded-xl">
                                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-semibold text-amber-900">Low Stock Warning</p>
                                        <p className="text-xs text-amber-700 mt-0.5">Only {product.available} units remaining. Consider restocking soon.</p>
                                    </div>
                                </div>
                            )}

                            {/* Inventory Numbers */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-left">
                                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest leading-none mb-2">Committed</p>
                                    <p className="text-3xl font-black text-gray-800 tabular-nums underline cursor-pointer hover:text-[#043061] transition-colors" onClick={handleCommittedClick}>{product.committed}</p>
                                    <p className="text-xs text-gray-400 mt-1">In orders</p>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-left">
                                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest leading-none mb-2">Available</p>
                                    <p className="text-3xl font-black text-gray-800 tabular-nums">{product.available}</p>
                                    <p className="text-xs text-gray-400 mt-1">Ready to sell</p>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-left">
                                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest leading-none mb-2">On Hand</p>
                                    <p className="text-3xl font-black text-gray-800 tabular-nums">{product.onHand}</p>
                                    <p className="text-xs text-gray-400 mt-1">Total stock</p>
                                </div>
                            </div>

                            {/* Price + SKU */}
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                                <div>
                                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest leading-none mb-1.5">Regular Price</p>
                                    <p className="text-lg font-black text-gray-800">${product.regularPrice.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest leading-none mb-1.5">SKU</p>
                                    <p className="text-sm font-bold font-mono text-gray-700 truncate">{product.sku}</p>
                                </div>
                            </div>

                            {/* Barcode */}
                            <div className="pt-4 border-t border-gray-100">
                                {!showBarcodeSection ? (
                                    <button
                                        onClick={() => setShowBarcodeSection(true)}
                                        className="flex items-center gap-1.5 h-8 px-3 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        Add Barcode
                                    </button>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-widest">Barcode (Optional)</label>
                                            <button onClick={() => setShowBarcodeSection(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                        <div className="flex gap-2">
                                            <Input
                                                value={detailsEdited.barcode ?? product.barcode ?? ""}
                                                placeholder="Enter barcode"
                                                onChange={(e) => handleDetailChange('barcode', e.target.value)}
                                                className="bg-background"
                                            />
                                            {detailsEdited.barcode !== undefined && (
                                                <Button size="sm" onClick={handleDetailsSave} disabled={savingDetails} className="bg-[#043061] hover:bg-[#0b4f96] text-white rounded-xl">
                                                    {savingDetails ? 'Saving...' : 'Save'}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Sell When Out of Stock */}
                            <div className="pt-4 border-t border-gray-100">
                                <div className="flex flex-col space-y-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                                    <div className="flex items-start space-x-3">
                                        <Checkbox
                                            id="sell-out-of-stock"
                                            checked={detailsEdited.sellWhenOutOfStock ?? product.sellWhenOutOfStock ?? false}
                                            onCheckedChange={(checked) => handleDetailChange('sellWhenOutOfStock', checked)}
                                            className="mt-0.5"
                                        />
                                        <div className="flex-1">
                                            <label htmlFor="sell-out-of-stock" className="text-sm font-semibold text-gray-800 cursor-pointer">
                                                Continue selling when out of stock
                                            </label>
                                            <p className="text-xs text-gray-500 mt-1">
                                                Allow customers to purchase this product even when inventory is 0.
                                            </p>
                                        </div>
                                    </div>
                                    {detailsEdited.sellWhenOutOfStock !== undefined && (
                                        <div className="flex justify-end">
                                            <Button size="sm" onClick={handleDetailsSave} disabled={savingDetails} className="bg-[#043061] hover:bg-[#0b4f96] text-white rounded-xl">
                                                {savingDetails ? 'Saving...' : 'Save Changes'}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ════════ INVENTORY BY LOCATION ════════ */}
                    {product.locationInventory && product.locationInventory.length > 0 && (
                        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm mt-4 mx-1 sm:mx-0">
                            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
                                <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-slate-100">
                                    <Package className="h-4 w-4 text-slate-600" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-semibold text-slate-800">Inventory by Location</h2>
                                    <p className="text-xs text-slate-400">Edit on-hand quantities per warehouse</p>
                                </div>
                            </div>
                            <div className="p-5">
                                <div className="rounded-xl border border-gray-200 overflow-x-auto">
                                    <Table className="min-w-[600px]">
                                        <TableHeader>
                                            <TableRow className="bg-gray-50/80">
                                                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</TableHead>
                                                <TableHead className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Committed</TableHead>
                                                <TableHead className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Available</TableHead>
                                                <TableHead className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">On Hand</TableHead>
                                                <TableHead className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {product.locationInventory.map((location) => {
                                                const currentCommitted = editedValues[location.locationId]?.committed ?? location.committed;
                                                const currentOnHand = editedValues[location.locationId]?.onHand ?? location.onHand;
                                                const currentAvailable = Math.max(0, currentOnHand - currentCommitted);

                                                return (
                                                    <TableRow key={location.locationId} className="hover:bg-gray-50/60">
                                                        <TableCell>
                                                            <div className="font-semibold text-sm text-gray-800">{location.locationName}</div>
                                                            {(location.locationCity || location.locationState) && (
                                                                <div className="text-xs text-gray-400 mt-0.5">
                                                                    {[location.locationCity, location.locationState].filter(Boolean).join(", ")}
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <span className="text-sm font-bold text-gray-700 underline cursor-pointer hover:text-[#043061] transition-colors" onClick={handleCommittedClick}>
                                                                {currentCommitted}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <span className="text-sm font-bold text-gray-700">{currentAvailable}</span>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                max="9999"
                                                                value={currentOnHand}
                                                                onChange={(e) => handleLocationChange(location.locationId, 'onHand', parseInt(e.target.value) || 0)}
                                                                className="w-24 ml-auto text-right"
                                                            />
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {hasLocationChanges(location.locationId) && (
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <Button variant="outline" size="sm" onClick={() => handleLocationCancel(location.locationId)} disabled={saving === location.locationId} className="rounded-xl">
                                                                        Cancel
                                                                    </Button>
                                                                    <Button size="sm" onClick={() => handleLocationSave(location)} disabled={saving === location.locationId} className="gap-1 bg-[#043061] hover:bg-[#0b4f96] text-white rounded-xl">
                                                                        <Check className="h-3 w-3" />
                                                                        {saving === location.locationId ? "Saving..." : "Save"}
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Committed Orders Dialog */}
                    <Dialog open={showCommittedDialog} onOpenChange={setShowCommittedDialog}>
                        <DialogContent className="w-[98vw] sm:max-w-[1000px] max-h-[95vh] overflow-y-auto p-5">
                            <DialogHeader>
                                <DialogTitle className="text-lg font-black text-gray-900">Committed Orders</DialogTitle>
                                <DialogDescription className="text-xs text-gray-400">
                                    Orders holding inventory for {product?.productName} — {product?.variantName}
                                </DialogDescription>
                            </DialogHeader>

                            {loadingOrders ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                                </div>
                            ) : committedOrders.length === 0 ? (
                                <div className="text-center py-12">
                                    <Package className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                                    <p className="text-sm text-gray-400">No committed orders found</p>
                                </div>
                            ) : (
                                <div className="rounded-xl border border-gray-200 overflow-x-auto">
                                    <Table className="min-w-[800px]">
                                        <TableHeader>
                                            <TableRow className="bg-gray-50/80">
                                                <TableHead className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Order #</TableHead>
                                                <TableHead className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</TableHead>
                                                <TableHead className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</TableHead>
                                                <TableHead className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty</TableHead>
                                                <TableHead className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</TableHead>
                                                <TableHead className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {committedOrders.map((order) => (
                                                <TableRow key={order.id} className="hover:bg-gray-50/60">
                                                    <TableCell className="font-bold px-4 py-3 text-gray-800">{order.orderNumber}</TableCell>
                                                    <TableCell className="px-4 py-3">
                                                        <div className="font-semibold text-sm text-gray-800">{order.customerName}</div>
                                                        <div className="text-xs text-gray-400">{order.customerEmail}</div>
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3 text-center">
                                                        <Badge
                                                            variant="secondary"
                                                            className={`text-[10px] uppercase font-bold px-2 py-0.5 whitespace-nowrap ${order.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                                                order.status === 'PROCESSING' ? 'bg-blue-100 text-blue-800' :
                                                                    order.status === 'LABEL_CREATED' ? 'bg-purple-100 text-purple-800' :
                                                                        order.status === 'ON_HOLD' ? 'bg-orange-100 text-orange-800' :
                                                                            'bg-gray-100 text-gray-800'
                                                                }`}
                                                        >
                                                            {order.status.replace('_', ' ')}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-black px-4 py-3 text-gray-800">{order.quantity}</TableCell>
                                                    <TableCell className="px-4 py-3 whitespace-nowrap text-xs text-gray-400">{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                                                    <TableCell className="text-right px-4 py-3">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => router.push(`/orders/${order.id}`)}
                                                            className="h-8 group"
                                                        >
                                                            <span className="hidden sm:inline mr-1 text-xs font-semibold">View</span>
                                                            <ExternalLink className="h-3.5 w-3.5 text-gray-400 group-hover:text-[#043061] transition-colors" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </DialogContent>
                    </Dialog>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
