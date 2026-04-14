"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Truck,
    Package,
    MapPin,
    Clock,
    DollarSign,
    Settings,
    Plus,
    Edit,
    Trash2,
    MoreHorizontal,
    Calendar,
    TrendingUp,
    AlertTriangle,
    Loader2
} from "lucide-react";
import { ShippingZoneDialog } from "./shipping-zone-dialog";
import { ShippingRateDialog } from "./shipping-rate-dialog";
import { CarrierDialog } from "./carrier-dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { usePermissions } from "@/contexts/auth-context";
import logger from '@/lib/logger';

// Types
interface ShippingZone {
    id: string;
    name: string;
    countries: string[];
    createdAt: string;
    updatedAt: string;
    rates?: ShippingRate[];
}

interface ShippingRate {
    id: string;
    zoneId: string;
    name: string;
    rate: number | string; // Backend returns Decimal as string
    minWeight?: number | string;
    maxWeight?: number | string;
    minPrice?: number | string;
    maxPrice?: number | string;
    freeShippingThreshold?: number | string;
    estimatedDays?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    zone?: ShippingZone;
}

interface Carrier {
    id: string;
    name: string;
    code: string;
    apiKey?: string;
    apiSecret?: string;
    isActive: boolean;
    services: string[];
    trackingUrl?: string;
    createdAt: string;
    updatedAt: string;
}

interface Shipment {
    id: string;
    orderId: string;
    carrier: string;
    trackingNumber?: string;
    trackingUrl?: string;
    status: string;
    shippedAt?: string;
    deliveredAt?: string;
    createdAt: string;
    updatedAt: string;
    order?: {
        orderNumber: string;
        customer: {
            firstName: string;
            lastName: string;
            email: string;
        };
    };
}



// Helper function to format decimal values from backend
const formatDecimal = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined) return '0.00';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? '0.00' : num.toFixed(2);
};

export function ShippingContent() {
    // Permissions
    const { canCreate, canUpdate, canDelete } = usePermissions();

    // State for data
    const [shippingZones, setShippingZones] = useState<ShippingZone[]>([]);
    const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
    const [carriers, setCarriers] = useState<Carrier[]>([]);
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [ordersForMetrics, setOrdersForMetrics] = useState<any[]>([]);

    // State for loading
    const [isLoading, setIsLoading] = useState(true);

    // State for dialogs
    const [showZoneDialog, setShowZoneDialog] = useState(false);
    const [showRateDialog, setShowRateDialog] = useState(false);
    const [showCarrierDialog, setShowCarrierDialog] = useState(false);
    const [editingZone, setEditingZone] = useState<ShippingZone | null>(null);
    const [editingRate, setEditingRate] = useState<ShippingRate | null>(null);
    const [editingCarrier, setEditingCarrier] = useState<Carrier | null>(null);

    // State for confirmation dialogs
    const [showDeleteZoneConfirm, setShowDeleteZoneConfirm] = useState(false);
    const [showDeleteRateConfirm, setShowDeleteRateConfirm] = useState(false);
    const [zoneToDelete, setZoneToDelete] = useState<ShippingZone | null>(null);
    const [rateToDelete, setRateToDelete] = useState<any>(null);

    // Load initial data
    useEffect(() => {
        loadAllData();
    }, []);

    const loadAllData = async () => {
        setIsLoading(true);
        try {
            // Load data sequentially to avoid issues
            await loadShippingZones();
            await loadShippingRates();
            await loadCarriers();
            await loadShipments();
            await loadRecentOrdersForMetrics();
        } catch (error) {
            logger.error("Error loading shipping data:", { error: error });
            toast.error("Failed to load shipping data");
        } finally {
            setIsLoading(false);
        }
    };

    const loadShippingZones = async () => {
        try {
            const response = await api.get("/shipping/zones");
            if (response.success && response.data) {
                setShippingZones(response.data || []);
            } else {
                logger.error("Failed to load shipping zones:", { error: response.error });
                setShippingZones([]);
            }
        } catch (error) {
            logger.error("Error loading shipping zones:", { error: error });
            setShippingZones([]);
        }
    };

    const loadShippingRates = async () => {
        try {
            const response = await api.get("/shipping/rates");
            if (response.success && response.data) {
                setShippingRates(response.data || []);
            } else {
                logger.error("Failed to load shipping rates:", { error: response.error });
                setShippingRates([]);
            }
        } catch (error) {
            logger.error("Error loading shipping rates:", { error: error });
            setShippingRates([]);
        }
    };

    const loadCarriers = async () => {
        try {
            const response = await api.get("/shipping/carriers");
            if (response.success && response.data) {
                setCarriers(response.data || []);
            } else {
                logger.error("Failed to load carriers:", { error: response.error });
                setCarriers([]);
            }
        } catch (error) {
            logger.error("Error loading carriers:", { error: error });
            setCarriers([]);
        }
    };

    const loadShipments = async () => {
        try {
            const response = await api.get("/shipping?limit=100");
            if (response.success && response.data) {
                setShipments(response.data.shipments || []);
            } else {
                logger.error("Failed to load shipments:", { error: response.error });
                setShipments([]);
            }
        } catch (error) {
            logger.error("Error loading shipments:", { error: error });
            setShipments([]);
        }
    };

    const loadRecentOrdersForMetrics = async () => {
        try {
            const res = await api.getOrders({ page: 1, limit: 200 });
            if (res.success && res.data?.orders) {
                setOrdersForMetrics(res.data.orders);
            } else {
                setOrdersForMetrics([]);
            }
        } catch (e) {
            logger.error("Error loading orders for shipping metrics:", { error: e });
            setOrdersForMetrics([]);
        }
    };

    // Zone handlers
    const handleCreateZone = async (data: {
        name: string;
        countries: string[];
        rates?: {
            name: string;
            rate: number;
            estimatedDays?: string;
            freeShippingThreshold?: number;
        }[];
    }) => {
        try {
            const response = await api.post("/shipping/zones", data);
            if (response.success) {
                toast.success("Shipping zone created successfully");
                await loadShippingZones();
                await loadShippingRates(); // Refresh rates if any were created
            } else {
                toast.error(response.error || "Failed to create shipping zone");
            }
        } catch (error) {
            logger.error("[Shipping] Error creating shipping zone:", { error: error });
            toast.error("Failed to create shipping zone");
        }
    };

    const handleUpdateZone = async (data: { name: string; countries: string[] }) => {
        if (!editingZone) return;
        try {
            const response = await api.updateShippingZone(editingZone.id, data);
            if (response.success) {
                toast.success("Shipping zone updated successfully");
                await loadShippingZones();
                setEditingZone(null);
            } else {
                toast.error(response.error || "Failed to update shipping zone");
            }
        } catch (error) {
            logger.error("Error updating shipping zone:", { error: error });
            toast.error("Failed to update shipping zone");
        }
    };

    const confirmDeleteZone = (zone: ShippingZone) => {
        setZoneToDelete(zone);
        setShowDeleteZoneConfirm(true);
    };

    const handleDeleteZone = async () => {
        if (!zoneToDelete) return;

        try {
            const response = await api.deleteShippingZone(zoneToDelete.id);
            if (response.success) {
                toast.success("Shipping zone deleted successfully");
                await loadShippingZones();
                await loadShippingRates(); // Refresh rates as they might be affected
            } else {
                toast.error(response.error || "Failed to delete shipping zone");
            }
        } catch (error) {
            logger.error("Error deleting shipping zone:", { error: error });
            toast.error("Failed to delete shipping zone");
        } finally {
            setShowDeleteZoneConfirm(false);
            setZoneToDelete(null);
        }
    };

    // Rate handlers
    const handleCreateRate = async (data: any) => {
        try {
            const response = await api.createShippingRate(data);
            if (response.success) {
                toast.success("Shipping rate created successfully");
                await loadShippingRates();
            } else {
                toast.error(response.error || "Failed to create shipping rate");
            }
        } catch (error) {
            logger.error("Error creating shipping rate:", { error: error });
            toast.error("Failed to create shipping rate");
        }
    };

    const handleUpdateRate = async (data: any) => {
        if (!editingRate) return;
        try {
            const response = await api.updateShippingRate(editingRate.id, data);
            if (response.success) {
                toast.success("Shipping rate updated successfully");
                await loadShippingRates();
                setEditingRate(null);
            } else {
                toast.error(response.error || "Failed to update shipping rate");
            }
        } catch (error) {
            logger.error("Error updating shipping rate:", { error: error });
            toast.error("Failed to update shipping rate");
        }
    };

    const confirmDeleteRate = (rate: any) => {
        setRateToDelete(rate);
        setShowDeleteRateConfirm(true);
    };

    const handleDeleteRate = async () => {
        if (!rateToDelete) return;

        try {
            const response = await api.deleteShippingRate(rateToDelete.id);
            if (response.success) {
                toast.success("Shipping rate deleted successfully");
                await loadShippingRates();
            } else {
                toast.error(response.error || "Failed to delete shipping rate");
            }
        } catch (error) {
            logger.error("Error deleting shipping rate:", { error: error });
            toast.error("Failed to delete shipping rate");
        } finally {
            setShowDeleteRateConfirm(false);
            setRateToDelete(null);
        }
    };

    // Carrier handlers
    const handleCreateCarrier = async (data: any) => {
        try {
            const response = await api.createCarrier(data);
            if (response.success) {
                toast.success("Carrier created successfully");
                await loadCarriers();
            } else {
                toast.error(response.error || "Failed to create carrier");
            }
        } catch (error) {
            logger.error("Error creating carrier:", { error: error });
            toast.error("Failed to create carrier");
        }
    };

    const handleUpdateCarrier = async (data: any) => {
        if (!editingCarrier) return;
        try {
            const response = await api.updateCarrier(editingCarrier.id, data);
            if (response.success) {
                toast.success("Carrier updated successfully");
                await loadCarriers();
                setEditingCarrier(null);
            } else {
                toast.error(response.error || "Failed to update carrier");
            }
        } catch (error) {
            logger.error("Error updating carrier:", { error: error });
            toast.error("Failed to update carrier");
        }
    };

    const handleDeleteCarrier = async (carrierId: string) => {
        try {
            const response = await api.deleteCarrier(carrierId);
            if (response.success) {
                toast.success("Carrier deleted successfully");
                await loadCarriers();
            } else {
                toast.error(response.error || "Failed to delete carrier");
            }
        } catch (error) {
            logger.error("Error deleting carrier:", { error: error });
            toast.error("Failed to delete carrier");
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-0">
            {/* ════════ DARK HERO STRIP ════════ */}
            <div className="relative bg-[#070B14] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#4D7DF2]/8 rounded-full blur-[100px] pointer-events-none" />

                <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-xl font-black text-white tracking-tight">Shipping</h1>
                            <p className="text-xs text-gray-500 mt-0.5">Manage shipping zones, carriers, and track deliveries</p>
                        </div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <button onClick={loadAllData} disabled={isLoading} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-xs font-bold text-gray-300 hover:bg-white/10 transition-colors disabled:opacity-40">
                                <Loader2 className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                                {isLoading ? 'Loading...' : 'Refresh'}
                            </button>
                            {canCreate('shipping') && (
                                <button onClick={() => setShowZoneDialog(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-[#070B14] hover:bg-gray-100 text-xs font-black uppercase tracking-widest transition-colors">
                                    <Plus className="h-3.5 w-3.5" />
                                    Add Zone
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-4">
            {/* Tabs */}
            <Tabs defaultValue="zones" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="zones">Shipping Zones</TabsTrigger>
                    <TabsTrigger value="carriers">Carriers</TabsTrigger>
                    <TabsTrigger value="shipments">Recent Shipments</TabsTrigger>
                    {/* <TabsTrigger value="settings">Settings</TabsTrigger> */}
                </TabsList>

                {/* Shipping Zones Tab */}
                <TabsContent value="zones" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Shipping Zones</CardTitle>
                            <CardDescription>
                                Configure shipping rates and delivery times for different regions
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                            <Table className="min-w-[900px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Zone Name</TableHead>
                                        <TableHead>Countries</TableHead>
                                        <TableHead>Rates</TableHead>
                                        <TableHead>Created</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center">
                                                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                                                Loading shipping zones...
                                            </TableCell>
                                        </TableRow>
                                    ) : shippingZones.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center text-gray-500">
                                                No shipping zones found. Create your first shipping zone to get started.
                                            </TableCell>
                                        </TableRow>
                                    ) : shippingZones.map((zone) => (
                                        <TableRow key={zone.id}>
                                            <TableCell className="font-medium">{zone.name}</TableCell>
                                            <TableCell>
                                                <div className="text-sm text-muted-foreground">
                                                    {zone.countries.slice(0, 3).join(", ")}
                                                    {zone.countries.length > 3 && ` +${zone.countries.length - 3} more`}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm text-muted-foreground">
                                                    {zone.rates?.length || 0} rate(s)
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm text-muted-foreground">
                                                    {new Date(zone.createdAt).toLocaleDateString()}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        {canUpdate('shipping') && (
                                                            <DropdownMenuItem onClick={() => {
                                                                setEditingZone(zone);
                                                                setShowZoneDialog(true);
                                                            }}>
                                                                <Edit className="h-4 w-4 mr-2" />
                                                                Edit Zone
                                                            </DropdownMenuItem>
                                                        )}
                                                        {canCreate('shipping') && (
                                                            <DropdownMenuItem onClick={() => {
                                                                setEditingRate(null);
                                                                setShowRateDialog(true);
                                                            }}>
                                                                <Settings className="h-4 w-4 mr-2" />
                                                                Add Rate
                                                            </DropdownMenuItem>
                                                        )}
                                                        {(canUpdate('shipping') || canDelete('shipping')) && (
                                                            <DropdownMenuSeparator />
                                                        )}
                                                        {canDelete('shipping') && (
                                                            <DropdownMenuItem
                                                                className="text-red-600"
                                                                onClick={() => confirmDeleteZone(zone)}
                                                            >
                                                                <Trash2 className="h-4 w-4 mr-2" />
                                                                Delete Zone
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Shipping Rates Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Shipping Rates</CardTitle>
                            <CardDescription>
                                All configured shipping rates across zones
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                            <Table className="min-w-[1000px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Rate Name</TableHead>
                                        <TableHead>Zone</TableHead>
                                        <TableHead>Rate</TableHead>
                                        <TableHead>Estimated Days</TableHead>
                                        <TableHead>Free Shipping</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center">
                                                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                                                Loading shipping rates...
                                            </TableCell>
                                        </TableRow>
                                    ) : shippingRates.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center text-gray-500">
                                                No shipping rates found. Create shipping zones with rates to get started.
                                            </TableCell>
                                        </TableRow>
                                    ) : shippingRates.map((rate) => (
                                        <TableRow key={rate.id}>
                                            <TableCell className="font-medium">{rate.name}</TableCell>
                                            <TableCell>
                                                <div className="text-sm text-muted-foreground">
                                                    {rate.zone?.name || 'Unknown Zone'}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium">
                                                    ${formatDecimal(rate.rate)}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm text-muted-foreground">
                                                    {rate.estimatedDays || 'Not specified'}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm text-muted-foreground">
                                                    {rate.freeShippingThreshold
                                                        ? `$${formatDecimal(rate.freeShippingThreshold)}+`
                                                        : 'Not available'
                                                    }
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={rate.isActive ? "default" : "secondary"}>
                                                    {rate.isActive ? "Active" : "Inactive"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        {canUpdate('shipping') && (
                                                            <DropdownMenuItem onClick={() => {
                                                                setEditingRate(rate);
                                                                setShowRateDialog(true);
                                                            }}>
                                                                <Edit className="h-4 w-4 mr-2" />
                                                                Edit Rate
                                                            </DropdownMenuItem>
                                                        )}
                                                        {canDelete('shipping') && (
                                                            <>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    className="text-red-600"
                                                                    onClick={() => confirmDeleteRate(rate)}
                                                                >
                                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                                    Delete Rate
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Carriers Tab */}
                <TabsContent value="carriers" className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Carriers List */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Shipping Carriers</CardTitle>
                                <CardDescription>
                                    Manage your shipping carrier integrations
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {isLoading ? (
                                    <div className="flex items-center justify-center p-8">
                                        <Loader2 className="h-6 w-6 animate-spin mr-2" />
                                        Loading carriers...
                                    </div>
                                ) : carriers.length === 0 ? (
                                    <div className="text-center p-8 text-gray-500">
                                        No carriers configured. Add your first carrier to get started.
                                    </div>
                                ) : carriers.map((carrier) => (
                                    <div key={carrier.id} className="flex items-center justify-between p-4 border rounded-lg">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 bg-muted rounded-lg flex items-center justify-center">
                                                <Truck className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">{carrier.name}</span>
                                                    <Badge variant="outline">
                                                        {carrier.code}
                                                    </Badge>
                                                    <Badge
                                                        variant={carrier.isActive ? "default" : "secondary"}
                                                    >
                                                        {carrier.isActive ? "Active" : "Inactive"}
                                                    </Badge>
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    Services: {carrier.services.length > 0 ? carrier.services.join(", ") : "No services configured"}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setEditingCarrier(carrier);
                                                    setShowCarrierDialog(true);
                                                }}
                                            >
                                                <Edit className="h-4 w-4 mr-1" />
                                                Edit
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleDeleteCarrier(carrier.id)}
                                                className="text-red-600 hover:text-red-700"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        {/* Add New Carrier */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Add New Carrier</CardTitle>
                                <CardDescription>
                                    Connect a new shipping carrier
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {canCreate('shipping') ? (
                                    <Button
                                        className="w-full"
                                        onClick={() => setShowCarrierDialog(true)}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Carrier
                                    </Button>
                                ) : (
                                    <p className="text-center text-gray-500">
                                        You don't have permission to add carriers
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Recent Shipments Tab */}
                <TabsContent value="shipments" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Shipments</CardTitle>
                            <CardDescription>
                                Track and manage your recent shipments
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                            <Table className="min-w-[1000px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Shipment ID</TableHead>
                                        <TableHead>Order</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Carrier</TableHead>
                                        <TableHead>Tracking Number</TableHead>
                                        <TableHead>Destination</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Est. Delivery</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center">
                                                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                                                Loading shipments...
                                            </TableCell>
                                        </TableRow>
                                    ) : shipments.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center text-gray-500">
                                                No shipments found. Create orders to generate shipments.
                                            </TableCell>
                                        </TableRow>
                                    ) : shipments.map((shipment) => (
                                        <TableRow key={shipment.id}>
                                            <TableCell className="font-medium">{shipment.id}</TableCell>
                                            <TableCell>{shipment.order?.orderNumber || shipment.orderId}</TableCell>
                                            <TableCell>
                                                {shipment.order?.customer
                                                    ? `${shipment.order.customer.firstName} ${shipment.order.customer.lastName}`
                                                    : 'Unknown Customer'
                                                }
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Truck className="h-4 w-4" />
                                                    {shipment.carrier}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-mono text-sm">
                                                {shipment.trackingNumber || 'Not assigned'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <MapPin className="h-4 w-4" />
                                                    {shipment.order?.customer?.email || 'Unknown'}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={
                                                    shipment.status === "DELIVERED" ? "default" :
                                                    shipment.status === "IN_TRANSIT" ? "secondary" :
                                                    shipment.status === "SHIPPED" ? "outline" : "destructive"
                                                }>
                                                    {shipment.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{shipment.deliveredAt
                                                ? new Date(shipment.deliveredAt).toLocaleDateString()
                                                : 'Pending'
                                            }</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Settings Tab */}
                <TabsContent value="settings" className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Default Settings</CardTitle>
                                <CardDescription>
                                    Configure default shipping preferences
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="default-carrier">Default Carrier</Label>
                                    <Select>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select default carrier" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="fedex">FedEx</SelectItem>
                                            <SelectItem value="ups">UPS</SelectItem>
                                            <SelectItem value="usps">USPS</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="package-weight">Default Package Weight (lbs)</Label>
                                    <Input id="package-weight" type="number" placeholder="1.0" />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="dimensions">Default Dimensions (L x W x H)</Label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <Input placeholder="Length" />
                                        <Input placeholder="Width" />
                                        <Input placeholder="Height" />
                                    </div>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <Switch id="insurance" />
                                    <Label htmlFor="insurance">Add insurance by default</Label>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <Switch id="signature" />
                                    <Label htmlFor="signature">Require signature</Label>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Notifications</CardTitle>
                                <CardDescription>
                                    Configure shipping notifications
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label htmlFor="ship-notification">Shipment Created</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Notify customers when shipment is created
                                        </p>
                                    </div>
                                    <Switch id="ship-notification" />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label htmlFor="transit-notification">In Transit</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Send updates when package is in transit
                                        </p>
                                    </div>
                                    <Switch id="transit-notification" />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label htmlFor="delivery-notification">Delivered</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Confirm delivery to customers
                                        </p>
                                    </div>
                                    <Switch id="delivery-notification" />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label htmlFor="exception-notification">Exceptions</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Alert for delivery exceptions
                                        </p>
                                    </div>
                                    <Switch id="exception-notification" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
            </div>

            {/* Dialogs */}
            <ShippingZoneDialog
                open={showZoneDialog}
                onOpenChange={setShowZoneDialog}
                zone={editingZone}
                onSubmit={editingZone ? handleUpdateZone : handleCreateZone}
            />

            <ShippingRateDialog
                open={showRateDialog}
                onOpenChange={setShowRateDialog}
                rate={editingRate as any}
                zones={shippingZones as any}
                onSubmit={editingRate ? handleUpdateRate : handleCreateRate}
            />

            <CarrierDialog
                open={showCarrierDialog}
                onOpenChange={setShowCarrierDialog}
                carrier={editingCarrier}
                onSubmit={editingCarrier ? handleUpdateCarrier : handleCreateCarrier}
            />

            {/* Delete Confirmation Dialogs */}
            <AlertDialog open={showDeleteZoneConfirm} onOpenChange={setShowDeleteZoneConfirm}>
                <AlertDialogContent className="max-w-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Shipping Zone</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete the shipping zone "{zoneToDelete?.name}"? This action cannot be undone and will also remove all associated shipping rates.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteZone} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete Zone
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={showDeleteRateConfirm} onOpenChange={setShowDeleteRateConfirm}>
                <AlertDialogContent className="max-w-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Shipping Rate</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete the shipping rate "{rateToDelete?.name}"? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteRate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete Rate
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
