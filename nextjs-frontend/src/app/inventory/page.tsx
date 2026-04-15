"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { Search, Package, Check, ChevronLeft, ChevronRight, ExternalLink, BarChart2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { api, resolveImageUrl } from "@/lib/api";
import logger from "@/lib/logger";
import { toast } from "sonner";

type FilterTab = "all" | "low-stock" | "out-of-stock";

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
}

interface EditedValues {
    [key: string]: {
        committed?: number;
        available?: number;
        onHand?: number;
    };
}

export default function InventoryPage() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
    const [inventoryData, setInventoryData] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [editedValues, setEditedValues] = useState<EditedValues>({});
    const [saving, setSaving] = useState<string | null>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const ITEMS_PER_PAGE = 10;

    // Total counts for badges (across all pages)
    const [totalCounts, setTotalCounts] = useState({
        all: 0,
        lowStock: 0,
        outOfStock: 0,
    });

    // Committed orders dialog state
    const [showCommittedDialog, setShowCommittedDialog] = useState(false);
    const [committedOrders, setCommittedOrders] = useState<any[]>([]);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [selectedVariantInfo, setSelectedVariantInfo] = useState<{ name: string; sku: string } | null>(null);

    // Fetch inventory data
    useEffect(() => {
        const fetchInventory = async () => {
            setLoading(true);
            try {
                const response = await api.getInventoryManagement({
                    search: searchQuery || undefined,
                    filter: activeFilter,
                    page: currentPage,
                    limit: ITEMS_PER_PAGE,
                });

                if (response.success && response.data) {
                    // Sanitize data: convert negative values to absolute values
                    const sanitizedData = response.data.map((item: InventoryItem) => ({
                        ...item,
                        committed: Math.max(0, Math.abs(item.committed || 0)),
                        available: Math.max(0, Math.abs(item.available || 0)),
                        onHand: Math.max(0, Math.abs(item.onHand || 0)),
                    }));

                    setInventoryData(sanitizedData);

                    // Update pagination info
                    if ((response as any).pagination) {
                        setTotalPages((response as any).pagination.pages);
                        setTotalItems((response as any).pagination.total);
                    }

                    // Update total counts for badges
                    if ((response as any).counts) {
                        setTotalCounts((response as any).counts);
                    }
                }
            } catch (error) {
                logger.error("Error fetching inventory:", { error });
            } finally {
                setLoading(false);
            }
        };

        // Debounce search - reduced to 150ms for faster response
        const timeoutId = setTimeout(() => {
            fetchInventory();
        }, 150);

        return () => clearTimeout(timeoutId);
    }, [searchQuery, activeFilter, currentPage]);

    // Reset to page 1 when search or filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, activeFilter]);

    const handleRowClick = (productId: string) => {
        router.push(`/inventory/${productId}`);
    };

    const handleValueChange = (itemId: string, field: 'committed' | 'available' | 'onHand', value: number) => {
        setEditedValues(prev => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                [field]: value,
            },
        }));
    };

    const hasChanges = (itemId: string) => {
        return editedValues[itemId] !== undefined;
    };

    const handleCancel = (itemId: string) => {
        setEditedValues(prev => {
            const newEdited = { ...prev };
            delete newEdited[itemId];
            return newEdited;
        });
    };

    const handleSave = async (item: InventoryItem) => {
        const changes = editedValues[item.id];
        if (!changes) return;

        setSaving(item.id);
        try {
            // Ensure all values are non-negative
            const newCommitted = Math.max(0, Math.abs(changes.committed ?? item.committed));
            const newAvailable = Math.max(0, Math.abs(changes.available ?? item.available));
            const newOnHand = Math.max(0, Math.abs(changes.onHand ?? item.onHand));

            // Call the backend API to update inventory
            const response = await api.updateVariantInventory(item.id, {
                onHand: newOnHand,
                committed: newCommitted,
                reason: "Manual adjustment from inventory management page",
            });

            if (response.success) {
                // Clear edited values for this item
                setEditedValues(prev => {
                    const newEdited = { ...prev };
                    delete newEdited[item.id];
                    return newEdited;
                });

                toast.success("Inventory updated successfully");

                // Refresh the data to get updated status and move items to correct tabs
                try {
                    const refreshResponse = await api.getInventoryManagement({
                        search: searchQuery || undefined,
                        filter: activeFilter,
                        page: currentPage,
                        limit: ITEMS_PER_PAGE,
                    });

                    if (refreshResponse.success && refreshResponse.data) {
                        // Sanitize data: convert negative values to absolute values
                        const sanitizedData = refreshResponse.data.map((item: InventoryItem) => ({
                            ...item,
                            committed: Math.max(0, Math.abs(item.committed || 0)),
                            available: Math.max(0, Math.abs(item.available || 0)),
                            onHand: Math.max(0, Math.abs(item.onHand || 0)),
                        }));

                        setInventoryData(sanitizedData);

                        // Update pagination info
                        if ((refreshResponse as any).pagination) {
                            setTotalPages((refreshResponse as any).pagination.pages);
                            setTotalItems((refreshResponse as any).pagination.total);
                        }

                        // Update total counts for badges
                        if ((refreshResponse as any).counts) {
                            setTotalCounts((refreshResponse as any).counts);
                        }
                    }
                } catch (refreshError) {
                    logger.error("Error refreshing inventory:", { error: refreshError });
                }
            } else {
                toast.error("Failed to update inventory");
            }
        } catch (error) {
            logger.error("Error saving inventory:", { error });
            toast.error("Failed to update inventory. Please try again.");
        } finally {
            setSaving(null);
        }
    };

    const getStockStatus = (available: number, threshold: number) => {
        if (available === 0) return { label: "Out of stock", variant: "destructive" as const };
        if (available <= threshold) return { label: "Low stock", variant: "secondary" as const };
        return { label: "In stock", variant: "default" as const };
    };

    const generateNumberOptions = (max: number = 1000) => {
        return Array.from({ length: max + 1 }, (_, i) => i);
    };

    const handleCommittedClick = async (item: InventoryItem) => {
        setLoadingOrders(true);
        setShowCommittedDialog(true);
        setSelectedVariantInfo({ name: `${item.productName} - ${item.variantName}`, sku: item.sku });
        try {
            const response = await api.getVariantCommittedOrders(item.id);
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

    const allCount = totalItems;
    const lowStockCount = inventoryData.filter(
        (i) => i.available > 0 && i.available <= i.lowStockThreshold
    ).length;
    const outOfStockCount = inventoryData.filter((i) => i.available === 0).length;

    return (
        <ProtectedRoute requiredRoles={['ADMIN', 'MANAGER', 'STAFF']}>
            <DashboardLayout>
                <div className="space-y-0">
                    {/* Dark hero strip */}
                    <div className="relative bg-[#070B14] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
                        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                        <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#4D7DF2]/8 rounded-full blur-[100px] pointer-events-none" />
                        <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
                            {/* Title row + stat chip */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                                <div>
                                    <h1 className="text-xl font-black text-white tracking-tight">Inventory</h1>
                                    <p className="text-xs text-gray-500 mt-0.5">Stock levels, variants, and reorder management</p>
                                </div>
                                <div className="flex items-center gap-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-2">
                                    <BarChart2 className="h-4 w-4 text-blue-400" />
                                    <div>
                                        <p className="text-[9px] text-gray-500 font-medium uppercase tracking-widest leading-none">Total SKUs</p>
                                        <p className="text-base font-black text-white tabular-nums leading-tight">{totalCounts.all.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Status pills + search row */}
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
                                    {[
                                        { key: 'all',          label: 'All',          count: totalCounts.all,        color: null },
                                        { key: 'low-stock',    label: 'Low Stock',    count: totalCounts.lowStock,   color: 'amber' },
                                        { key: 'out-of-stock', label: 'Out of Stock', count: totalCounts.outOfStock, color: 'red' },
                                    ].map((pill) => {
                                        const colorStyles: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
                                            amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', ring: 'ring-amber-500/30', dot: 'bg-amber-400' },
                                            red:   { bg: 'bg-red-500/15',   text: 'text-red-400',   ring: 'ring-red-500/30',   dot: 'bg-red-400' },
                                        };
                                        const c = pill.color ? colorStyles[pill.color] : null;
                                        const isActive = activeFilter === pill.key;
                                        return (
                                            <button
                                                key={pill.key}
                                                onClick={() => setActiveFilter(pill.key as FilterTab)}
                                                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                                    pill.key === 'all' && isActive ? 'bg-white/15 text-white ring-1 ring-white/20'
                                                    : isActive && c ? `${c.bg} ${c.text} ring-1 ${c.ring}`
                                                    : 'bg-white/[0.04] text-gray-500 hover:bg-white/[0.08] hover:text-gray-300'
                                                }`}
                                            >
                                                {c && <span className={`w-1.5 h-1.5 rounded-full ${isActive ? c.dot : 'bg-gray-600'}`} />}
                                                <span>{pill.label}</span>
                                                <span className={`text-[10px] font-black tabular-nums ${isActive && pill.key !== 'all' && c ? c.text : isActive ? 'text-white' : 'text-gray-600'}`}>{pill.count}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="relative w-full sm:w-72">
                                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
                                    <Input
                                        placeholder="Search items..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9 h-9 bg-white/[0.06] border-white/[0.08] text-white placeholder:text-gray-500 rounded-xl text-xs focus:bg-white/[0.08] focus:border-white/20"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Inventory Table */}
                    <div className="mt-4 bg-white rounded-2xl border border-gray-200/80 overflow-hidden">
                    <div className="overflow-x-auto">
                        <Table className="min-w-[800px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]"></TableHead>
                                    <TableHead>Product</TableHead>
                                    <TableHead>SKU</TableHead>
                                    <TableHead className="text-right">Committed</TableHead>
                                    <TableHead className="text-right">Available</TableHead>
                                    <TableHead className="text-right">On Hand</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-12">
                                            <div className="flex items-center justify-center">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : inventoryData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-12">
                                            <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                                            <p className="text-muted-foreground">No products found</p>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    inventoryData.map((item) => {
                                        const status = getStockStatus(item.available, item.lowStockThreshold);
                                        const currentCommitted = editedValues[item.id]?.committed ?? item.committed;
                                        const currentAvailable = editedValues[item.id]?.available ?? item.available;
                                        const currentOnHand = editedValues[item.id]?.onHand ?? item.onHand;

                                        return (
                                            <TableRow
                                                key={item.id}
                                                className="cursor-pointer hover:bg-muted/50"
                                                onClick={() => handleRowClick(item.id)}
                                            >
                                                <TableCell onClick={(e) => e.stopPropagation()}>
                                                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden">
                                                        {item.productImage ? (
                                                            <img
                                                                src={resolveImageUrl(item.productImage)}
                                                                alt={item.productName}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <Package className="h-5 w-5 text-muted-foreground" />
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div>
                                                        <div className="font-medium">{item.productName}</div>
                                                        {item.variantName && (
                                                            <div className="text-sm text-muted-foreground">{item.variantName}</div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">{item.sku}</TableCell>

                                                {/* Committed */}
                                                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                    <span
                                                        className="underline cursor-pointer hover:text-primary transition-colors"
                                                        onClick={() => handleCommittedClick(item)}
                                                    >
                                                        {currentCommitted}
                                                    </span>
                                                </TableCell>

                                                {/* Available */}
                                                <TableCell className="text-right">
                                                    <span className="underline cursor-pointer">
                                                        {currentAvailable}
                                                    </span>
                                                </TableCell>

                                                {/* On Hand Input */}
                                                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                    <div className="relative">
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            max="9999"
                                                            value={currentOnHand}
                                                            onChange={(e) => handleValueChange(item.id, 'onHand', parseInt(e.target.value) || 0)}
                                                            className="w-24 ml-auto text-right"
                                                        />
                                                        {editedValues[item.id]?.onHand !== undefined && (
                                                            <div className="absolute top-full right-0 mt-1 flex gap-1 z-10 bg-white border rounded-md shadow-lg p-1">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleCancel(item.id)}
                                                                    disabled={saving === item.id}
                                                                    className="h-7 px-2 text-xs"
                                                                >
                                                                    Cancel
                                                                </Button>
                                                                <Button
                                                                    variant="default"
                                                                    size="sm"
                                                                    onClick={() => handleSave(item)}
                                                                    disabled={saving === item.id}
                                                                    className="h-7 px-2 text-xs gap-1"
                                                                >
                                                                    <Check className="h-3 w-3" />
                                                                    {saving === item.id ? "Saving..." : "Save"}
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>

                                                <TableCell>
                                                    <Badge variant={status.variant}>{status.label}</Badge>
                                                </TableCell>

                                                {/* Actions Column */}
                                                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRowClick(item.id);
                                                        }}
                                                    >
                                                        Edit
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-4 border-t border-gray-200/80">
                            <div className="text-sm text-muted-foreground font-medium order-2 sm:order-1">
                                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} of {totalItems} products
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2 order-1 sm:order-2 w-full sm:w-auto justify-center overflow-x-auto pb-2 sm:pb-0">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="h-8 w-8 sm:w-auto sm:px-3 px-0"
                                >
                                    <ChevronLeft className="h-4 w-4 sm:mr-1" />
                                    <span className="hidden sm:inline">Previous</span>
                                </Button>
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                                        if (
                                            page === 1 ||
                                            page === totalPages ||
                                            (page >= currentPage - 1 && page <= currentPage + 1)
                                        ) {
                                            return (
                                                <Button
                                                    key={page}
                                                    variant={currentPage === page ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => setCurrentPage(page)}
                                                    className="h-8 w-8 sm:w-10 p-0"
                                                >
                                                    {page}
                                                </Button>
                                            );
                                        } else if (page === currentPage - 2 || page === currentPage + 2) {
                                            return <span key={page} className="px-1 text-muted-foreground">...</span>;
                                        }
                                        return null;
                                    })}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="h-8 w-8 sm:w-auto sm:px-3 px-0"
                                >
                                    <span className="hidden sm:inline">Next</span>
                                    <ChevronRight className="h-4 w-4 sm:ml-1" />
                                </Button>
                            </div>
                        </div>
                    )}
                    </div>{/* end bg-white card */}
                </div>

                {/* Committed Orders Dialog */}
                <Dialog open={showCommittedDialog} onOpenChange={setShowCommittedDialog}>
                    <DialogContent className="w-[98vw] sm:max-w-[1000px] max-h-[95vh] overflow-y-auto p-2 sm:p-6">
                        <DialogHeader className="p-2 sm:p-0">
                            <DialogTitle className="text-xl">Committed Orders</DialogTitle>
                            <DialogDescription className="text-sm">
                                Orders holding inventory for {selectedVariantInfo?.name} (SKU: {selectedVariantInfo?.sku})
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
                            <div className="rounded-xl border border-gray-200 overflow-hidden">
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
            </DashboardLayout >
        </ProtectedRoute >
    );
}
