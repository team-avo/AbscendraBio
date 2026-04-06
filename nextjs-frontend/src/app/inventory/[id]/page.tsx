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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
                <div className="space-y-6 max-w-5xl">
                    {/* Header */}
                    <div className="flex flex-row items-start gap-4 pb-6 border-b">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push("/inventory")}
                            className="flex-shrink-0 -ml-2"
                        >
                            <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                        </Button>

                        <div className="flex flex-row items-start gap-4 w-full text-left">
                            {product.productImage && (
                                <div className="h-16 w-16 sm:h-24 sm:w-24 rounded-lg border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                                    <img
                                        src={resolveImageUrl(product.productImage)}
                                        alt={product.productName}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            )}

                            <div className="flex-1 space-y-0.5 sm:space-y-1">
                                <h1 className="text-lg sm:text-2xl font-bold tracking-tight">{product.productName}</h1>
                                {product.variantName && (
                                    <p className="text-sm sm:text-lg text-muted-foreground">{product.variantName}</p>
                                )}
                                <p className="text-[10px] sm:text-sm text-muted-foreground">Inventory details and settings</p>
                            </div>
                        </div>
                    </div>

                    {/* Inventory Section with Pricing */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Inventory</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Inventory Numbers */}
                            <div className="grid grid-cols-3 gap-2 sm:gap-6">
                                <div className="space-y-1 text-left">
                                    <p className="text-[10px] sm:text-sm text-muted-foreground font-medium">Committed</p>
                                    <p
                                        className="text-2xl sm:text-4xl font-bold underline cursor-pointer hover:text-primary transition-colors"
                                        onClick={handleCommittedClick}
                                    >
                                        {product.committed}
                                    </p>
                                    <p className="text-[8px] sm:text-xs text-muted-foreground leading-tight">In orders</p>
                                </div>
                                <div className="space-y-1 text-left">
                                    <p className="text-[10px] sm:text-sm text-muted-foreground font-medium">Available</p>
                                    <p className="text-2xl sm:text-4xl font-bold">{product.available}</p>
                                    <p className="text-[8px] sm:text-xs text-muted-foreground leading-tight">Ready to sell</p>
                                </div>
                                <div className="space-y-1 text-left">
                                    <p className="text-[10px] sm:text-sm text-muted-foreground font-medium">On Hand</p>
                                    <p className="text-2xl sm:text-4xl font-bold">{product.onHand}</p>
                                    <p className="text-[8px] sm:text-xs text-muted-foreground leading-tight">Total stock</p>
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                                <div className="space-y-0.5 text-left">
                                    <p className="text-[10px] sm:text-sm font-medium text-muted-foreground">Regular Price</p>
                                    <p className="text-sm sm:text-lg font-semibold">${product.regularPrice.toFixed(2)}</p>
                                </div>
                                <div className="space-y-0.5 text-left">
                                    <p className="text-[10px] sm:text-sm font-medium text-muted-foreground">SKU</p>
                                    <p className="text-sm sm:text-lg font-medium font-mono truncate">{product.sku}</p>
                                </div>
                            </div>

                            {/* Barcode - Collapsible */}
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    {!showBarcodeSection ? (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setShowBarcodeSection(true)}
                                            className="gap-2"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Add Barcode
                                        </Button>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="text-sm font-medium">Barcode (Optional)</label>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setShowBarcodeSection(false)}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <div className="flex gap-2">
                                                <Input
                                                    value={detailsEdited.barcode ?? product.barcode ?? ""}
                                                    placeholder="Enter barcode"
                                                    onChange={(e) => handleDetailChange('barcode', e.target.value)}
                                                    className="bg-background"
                                                />
                                                {detailsEdited.barcode !== undefined && (
                                                    <Button size="sm" onClick={handleDetailsSave} disabled={savingDetails}>
                                                        Save
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Sell When Out of Stock */}
                            <div className="space-y-4 pt-4 border-t">
                                <div className="flex flex-col space-y-4 p-4 rounded-lg bg-muted/30">
                                    <div className="flex items-start space-x-3">
                                        <Checkbox
                                            id="sell-out-of-stock"
                                            checked={detailsEdited.sellWhenOutOfStock ?? product.sellWhenOutOfStock ?? false}
                                            onCheckedChange={(checked) => handleDetailChange('sellWhenOutOfStock', checked)}
                                            className="mt-1"
                                        />
                                        <div className="flex-1">
                                            <label
                                                htmlFor="sell-out-of-stock"
                                                className="text-sm font-medium leading-none cursor-pointer"
                                            >
                                                Continue selling when out of stock
                                            </label>
                                            <p className="text-sm text-muted-foreground mt-1.5">
                                                Allow customers to purchase this product even when inventory is 0.
                                            </p>
                                        </div>
                                    </div>
                                    {detailsEdited.sellWhenOutOfStock !== undefined && (
                                        <div className="flex justify-end">
                                            <Button size="sm" onClick={handleDetailsSave} disabled={savingDetails}>
                                                Save Changes
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Stock Status Alerts */}
                            {product.available === 0 && (
                                <div className="flex items-start gap-3 p-4 border border-red-200 bg-red-50 rounded-lg">
                                    <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-semibold text-red-900">Out of Stock</p>
                                        <p className="text-xs text-red-700 mt-1">
                                            This product is currently unavailable. Consider restocking soon or enable "Continue selling when out of stock" if you accept backorders.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {product.available > 0 && product.available <= product.lowStockThreshold && (
                                <div className="flex items-start gap-3 p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
                                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-semibold text-yellow-900">Low Stock Warning</p>
                                        <p className="text-xs text-yellow-700 mt-1">
                                            Only {product.available} units remaining. Consider restocking to avoid running out.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Location Inventory Breakdown - Editable */}
                    {product.locationInventory && product.locationInventory.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Inventory by Location</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-md border overflow-x-auto">
                                    <Table className="min-w-[600px]">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Location</TableHead>
                                                <TableHead className="text-right">Committed</TableHead>
                                                <TableHead className="text-right">Available</TableHead>
                                                <TableHead className="text-right">On Hand</TableHead>
                                                <TableHead className="text-right"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {product.locationInventory.map((location) => {
                                                const currentCommitted = editedValues[location.locationId]?.committed ?? location.committed;
                                                const currentOnHand = editedValues[location.locationId]?.onHand ?? location.onHand;
                                                const currentAvailable = Math.max(0, currentOnHand - currentCommitted);

                                                return (
                                                    <TableRow key={location.locationId}>
                                                        <TableCell>
                                                            <div>
                                                                <div className="font-medium">{location.locationName}</div>
                                                                {(location.locationCity || location.locationState) && (
                                                                    <div className="text-sm text-muted-foreground">
                                                                        {[location.locationCity, location.locationState]
                                                                            .filter(Boolean)
                                                                            .join(", ")}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </TableCell>

                                                        {/* Committed */}
                                                        <TableCell className="text-right">
                                                            <span
                                                                className="underline cursor-pointer hover:text-primary transition-colors"
                                                                onClick={handleCommittedClick}
                                                            >
                                                                {currentCommitted}
                                                            </span>
                                                        </TableCell>

                                                        {/* Available (calculated) */}
                                                        <TableCell className="text-right">
                                                            <span className="underline cursor-pointer font-medium">
                                                                {currentAvailable}
                                                            </span>
                                                        </TableCell>

                                                        {/* On Hand Input */}
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

                                                        {/* Save/Cancel Buttons */}
                                                        <TableCell className="text-right">
                                                            {hasLocationChanges(location.locationId) && (
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => handleLocationCancel(location.locationId)}
                                                                        disabled={saving === location.locationId}
                                                                    >
                                                                        Cancel
                                                                    </Button>
                                                                    <Button
                                                                        variant="default"
                                                                        size="sm"
                                                                        onClick={() => handleLocationSave(location)}
                                                                        disabled={saving === location.locationId}
                                                                        className="gap-1"
                                                                    >
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
                            </CardContent>
                        </Card>
                    )}

                    {/* Committed Orders Dialog */}
                    <Dialog open={showCommittedDialog} onOpenChange={setShowCommittedDialog}>
                        <DialogContent className="w-[98vw] sm:max-w-[1000px] max-h-[95vh] overflow-y-auto p-2 sm:p-6">
                            <DialogHeader className="p-2 sm:p-0">
                                <DialogTitle className="text-xl">Committed Orders</DialogTitle>
                                <DialogDescription className="text-sm">
                                    Orders holding inventory for {product?.productName} - {product?.variantName}
                                </DialogDescription>
                            </DialogHeader>

                            {loadingOrders ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                                </div>
                            ) : committedOrders.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
                                    <p>No committed orders found</p>
                                </div>
                            ) : (
                                <div className="rounded-md border overflow-x-auto">
                                    <Table className="min-w-[800px]">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="px-4 py-3">Order Number</TableHead>
                                                <TableHead className="px-4 py-3">Customer</TableHead>
                                                <TableHead className="px-4 py-3 text-center">Status</TableHead>
                                                <TableHead className="px-4 py-3 text-right">Quantity</TableHead>
                                                <TableHead className="px-4 py-3">Date</TableHead>
                                                <TableHead className="px-4 py-3 text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {committedOrders.map((order) => (
                                                <TableRow key={order.id} className="hover:bg-muted/50">
                                                    <TableCell className="font-medium px-4 py-3">{order.orderNumber}</TableCell>
                                                    <TableCell className="px-4 py-3">
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-sm">{order.customerName}</span>
                                                            <span className="text-xs text-muted-foreground">{order.customerEmail}</span>
                                                        </div>
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
                                                    <TableCell className="text-right font-bold px-4 py-3">{order.quantity}</TableCell>
                                                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                                                    <TableCell className="text-right px-4 py-3">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => router.push(`/orders/${order.id}`)}
                                                            className="h-8 group"
                                                        >
                                                            <span className="hidden sm:inline mr-1">View</span>
                                                            <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
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
