"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Send,
    RefreshCw,
    Code,
    History,
    Database,
    AlertCircle,
    CheckCircle2,
    Terminal,
    Copy,
    Trash2,
    Settings2,
    Activity,
    Globe,
    ExternalLink,
    Eye,
    EyeOff,
    Truck
} from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { API_BASE_URL } from "@/lib/env";
import logger from '@/lib/logger';

// Default payload for external order creation
const DEFAULT_PAYLOAD = {
    partnerOrderId: "EXT-" + Math.floor(Math.random() * 1000000),
    customer: {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        phone: "555-0199"
    },
    shippingAddress: {
        firstName: "John",
        lastName: "Doe",
        address1: "123 Main St",
        city: "New York",
        state: "NY",
        zip: "10001",
        country: "US"
    },
    billingAddress: {
        firstName: "John",
        lastName: "Doe",
        address1: "456 Billing Ave",
        city: "New York",
        state: "NY",
        zip: "10001",
        country: "US"
    },
    items: [
        {
            variantId: "",
            quantity: 1
        }
    ],
    // Optional shipping configuration
    shippingTierId: "",
    uniqueTierId: "",
    shippingOption: ""
};

export default function SalesOrderDebugPage() {
    const [apiKey, setApiKey] = useState("");
    const [baseUrl, setBaseUrl] = useState(API_BASE_URL);
    const [payload, setPayload] = useState(JSON.stringify(DEFAULT_PAYLOAD, null, 2));
    const [response, setResponse] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    const [variants, setVariants] = useState<any[]>([]);
    const [channels, setChannels] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [syncStats, setSyncStats] = useState<any>(null);
    const [isClient, setIsClient] = useState(false);
    const [fetchingChannels, setFetchingChannels] = useState(false);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
    const [isDeletingChannel, setIsDeletingChannel] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);

    // Cancel Order State
    const [cancelOrderId, setCancelOrderId] = useState("");
    const [cancelLoading, setCancelLoading] = useState(false);

    // Shipping Tiers State
    const [shippingTiers, setShippingTiers] = useState<any[]>([]);
    const [shippingTiersLoading, setShippingTiersLoading] = useState(false);
    const [tierApiDebug, setTierApiDebug] = useState<{ request: any, response: any } | null>(null);

    useEffect(() => {
        setIsClient(true);
        const savedHistory = localStorage.getItem("sales_order_debug_history");
        if (savedHistory) {
            try {
                setHistory(JSON.parse(savedHistory));
            } catch (e) {
                logger.error("Failed to parse history", { error: e });
            }
        }

        const savedApiKey = localStorage.getItem("sales_order_debug_apiKey");
        if (savedApiKey) setApiKey(savedApiKey);

        fetchChannels();
    }, []);

    useEffect(() => {
        if (isClient) {
            const timer = setTimeout(() => {
                fetchVariants(search);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [isClient, search]);

    useEffect(() => {
        if (isClient) {
            localStorage.setItem("sales_order_debug_history", JSON.stringify(history.slice(0, 50)));
        }
    }, [history, isClient]);

    useEffect(() => {
        if (isClient) {
            localStorage.setItem("sales_order_debug_apiKey", apiKey);
            if (apiKey) {
                fetchShippingTiers(apiKey, baseUrl);
            } else {
                setShippingTiers([]);
            }
        }
    }, [apiKey, baseUrl, isClient]);

    const fetchChannels = async () => {
        try {
            setFetchingChannels(true);
            const res = await api.get("/sales-channels");
            if (res.success) {
                setChannels(res.data);
            }
        } catch (e) {
            logger.error("Failed to fetch channels", { error: e });
        } finally {
            setFetchingChannels(false);
        }
    };

    const fetchShippingTiers = async (key: string, base: string) => {
        if (!key) return;
        setShippingTiersLoading(true);
        const endpoint = `${base}/sales-channels/integration/shipping-tiers`;
        const requestData = {
            method: 'GET',
            url: endpoint,
            headers: { "X-API-Key": key }
        };

        try {
            const res = await fetch(endpoint, {
                headers: { "X-API-Key": key }
            });
            const data = await res.json();

            setTierApiDebug({
                request: requestData,
                response: {
                    status: res.status,
                    statusText: res.statusText,
                    body: data
                }
            });

            if (data.success) {
                setShippingTiers(data.data);
            } else {
                setShippingTiers([]);
            }
        } catch (e: any) {
            logger.error("Failed to fetch shipping tiers", { error: e });
            setTierApiDebug({
                request: requestData,
                response: {
                    error: e.message
                }
            });
            setShippingTiers([]);
        } finally {
            setShippingTiersLoading(false);
        }
    };

    const handleDeleteClick = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setSelectedChannelId(id);
        setConfirmDeleteOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedChannelId) return;

        try {
            setIsDeletingChannel(true);
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
            setIsDeletingChannel(false);
            setConfirmDeleteOpen(false);
            setSelectedChannelId(null);
        }
    };

    const fetchVariants = async (searchQuery = "") => {
        try {
            setLoading(true);
            const res = await api.get(`/inventory/management?limit=25&search=${searchQuery}`);
            if (res.success && res.data) {
                setVariants(res.data);

                // Update default payload with a real variantId if available and payload is empty/default
                if (res.data.length > 0) {
                    try {
                        const currentPayload = JSON.parse(payload);
                        if (!currentPayload.items[0].variantId) {
                            const firstItem = res.data[0];
                            const updated = {
                                ...currentPayload,
                                items: [{
                                    ...currentPayload.items[0],
                                    variantId: firstItem.id,
                                    sku: firstItem.sku,
                                    name: firstItem.productName + " - " + firstItem.variantName,
                                    unitPrice: firstItem.price
                                }]
                            };
                            setPayload(JSON.stringify(updated, null, 2));
                        }
                    } catch (e) {
                        // ignore if JSON is currently invalid
                    }
                }
            }
        } catch (e) {
            logger.error("Failed to fetch variants", { error: e });
            toast.error("Failed to load variants");
        } finally {
            setLoading(false);
        }
    };

    const handleSendRequest = async () => {
        if (!apiKey) {
            toast.error("Please provide an X-API-Key");
            return;
        }

        setLoading(true);
        setResponse(null);

        const startTime = Date.now();
        let parsedPayload = {};

        try {
            parsedPayload = JSON.parse(payload);
        } catch (e) {
            toast.error("Invalid JSON in payload");
            setLoading(false);
            return;
        }

        try {
            const endpoint = `${baseUrl}/sales-channels/integration/orders`;
            const fetchRes = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": apiKey
                },
                body: JSON.stringify(parsedPayload)
            });

            const duration = Date.now() - startTime;
            const data = await fetchRes.json();

            setResponse({
                status: fetchRes.status,
                statusText: fetchRes.statusText,
                duration: `${duration}ms`,
                body: data
            });

            const historyItem = {
                id: Date.now(),
                timestamp: new Date().toISOString(),
                method: "POST",
                endpoint: "/integration/orders",
                status: fetchRes.status,
                duration: `${duration}ms`,
                request: parsedPayload,
                response: data
            };

            setHistory(prev => [historyItem, ...prev]);

            if (fetchRes.ok) {
                toast.success("Order request sent successfully!");
            } else {
                toast.error(`Request failed with status ${fetchRes.status}`);
            }
        } catch (e: any) {
            toast.error("Network error: " + e.message);
            setResponse({
                error: e.message
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCancelRequest = async () => {
        if (!apiKey) {
            toast.error("Please provide an X-API-Key");
            return;
        }

        if (!cancelOrderId) {
            toast.error("Please enter a Partner Order ID to cancel");
            return;
        }

        setCancelLoading(true);
        setResponse(null);

        const startTime = Date.now();

        try {
            const endpoint = `${baseUrl}/sales-channels/integration/orders/${cancelOrderId}`;
            const fetchRes = await fetch(endpoint, {
                method: "DELETE",
                headers: {
                    "X-API-Key": apiKey
                }
            });

            const duration = Date.now() - startTime;
            const data = await fetchRes.json();

            setResponse({
                status: fetchRes.status,
                statusText: fetchRes.statusText,
                duration: `${duration}ms`,
                body: data
            });

            const historyItem = {
                id: Date.now(),
                timestamp: new Date().toISOString(),
                method: "DELETE",
                endpoint: `/integration/orders/${cancelOrderId}`,
                status: fetchRes.status,
                duration: `${duration}ms`,
                request: { partnerOrderId: cancelOrderId },
                response: data
            };

            setHistory(prev => [historyItem, ...prev]);

            if (fetchRes.ok) {
                toast.success("Cancellation request processed!");
            } else {
                toast.error(`Request failed with status ${fetchRes.status}`);
            }
        } catch (e: any) {
            toast.error("Network error: " + e.message);
            setResponse({
                error: e.message
            });
        } finally {
            setCancelLoading(false);
        }
    };

    const clearHistory = () => {
        setHistory([]);
        localStorage.removeItem("sales_order_debug_history");
        toast.success("History cleared");
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
    };

    const setVariantInPayload = (id: string) => {
        try {
            const current = JSON.parse(payload);
            const variant = variants.find(v => v.id === id);

            if (current.items && current.items.length > 0) {
                current.items[0].variantId = id;
                if (variant) {
                    current.items[0].sku = variant.sku;
                    current.items[0].name = variant.productName + " - " + variant.variantName;
                    current.items[0].unitPrice = variant.price;
                }
            } else {
                current.items = [{
                    variantId: id,
                    quantity: 1,
                    sku: variant?.sku,
                    name: variant ? variant.productName + " - " + variant.variantName : undefined,
                    unitPrice: variant?.price
                }];
            }
            setPayload(JSON.stringify(current, null, 2));
            toast.success("Variant injected into payload");
        } catch (e) {
            toast.error("Fix JSON errors before selecting a variant");
        }
    };

    const setTierInPayload = (tier: any, type: 'id' | 'unique') => {
        try {
            const current = JSON.parse(payload);
            if (type === 'id') {
                current.shippingTierId = tier.id;
                delete current.uniqueTierId;
            } else {
                current.uniqueTierId = tier.uniqueTierId;
                delete current.shippingTierId;
            }
            setPayload(JSON.stringify(current, null, 2));
            toast.success(`${type === 'id' ? 'ID' : 'Unique ID'} injected into payload`);
        } catch (e) {
            toast.error("Fix JSON errors before selecting a tier");
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-6 max-w-7xl mx-auto pb-20 px-2 lg:px-4">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">API Debugger: Sales Channel Orders</h1>
                        <p className="text-muted-foreground mt-0.5 text-base lg:text-lg">
                            Test external order creation with API key authentication.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="secondary" size="sm" onClick={clearHistory}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Clear History
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Sales Channels Management Card */}
                    <Card className="shadow-sm border-muted/60 overflow-hidden lg:col-span-1">
                        <CardHeader className="py-3 px-4 border-b bg-muted/20">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                    <Globe className="h-4 w-4 text-blue-500" />
                                    Sales Channels
                                </CardTitle>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchChannels} disabled={fetchingChannels}>
                                    {fetchingChannels ? <LoadingSpinner size={14} /> : <RefreshCw className="h-3.5 w-3.5" />}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="max-h-[300px] overflow-y-auto">
                                <Table>
                                    <TableBody>
                                        {channels.length > 0 ? (
                                            channels.map((c) => (
                                                <TableRow key={c.id} className="group py-0">
                                                    <TableCell className="py-2 px-4">
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold text-sm truncate">{c.companyName}</span>
                                                            <span className="text-[10px] font-mono text-muted-foreground opacity-70 truncate">{c.apiKey}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-blue-600"
                                                                onClick={() => {
                                                                    setApiKey(c.apiKey);
                                                                    toast.success("API Key loaded");
                                                                }}
                                                                title="Load API Key"
                                                            >
                                                                <ExternalLink className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                onClick={() => handleDeleteClick(c.id)}
                                                                title="Delete Channel"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell className="h-20 text-center text-muted-foreground text-xs italic">
                                                    {fetchingChannels ? "Loading channels..." : "No channels found."}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Shipping Tiers Card (New) */}
                    <Card className="shadow-sm border-muted/60 overflow-hidden lg:col-span-1">
                        <CardHeader className="py-2 px-4 border-b bg-muted/20">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                    <Truck className="h-4 w-4 text-green-500" />
                                    Shipping Tiers
                                </CardTitle>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => fetchShippingTiers(apiKey, baseUrl)}
                                    disabled={shippingTiersLoading || !apiKey}
                                >
                                    {shippingTiersLoading ? <LoadingSpinner size={14} /> : <RefreshCw className="h-3.5 w-3.5" />}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Tabs defaultValue="tiers" className="w-full">
                                <TabsList className="w-full justify-start rounded-none border-b bg-muted/30 h-9">
                                    <TabsTrigger value="tiers" className="text-[10px] h-8 px-3">Tiers</TabsTrigger>
                                    <TabsTrigger value="debug" className="text-[10px] h-8 px-3">API Debug</TabsTrigger>
                                </TabsList>

                                <TabsContent value="tiers" className="m-0">
                                    <div className="max-h-[300px] overflow-y-auto">
                                        <Table>
                                            <TableHeader className="bg-muted/10 sticky top-0 z-10 border-b">
                                                <TableRow>
                                                    <TableHead className="py-2 text-[10px] px-2">Tier</TableHead>
                                                    <TableHead className="py-2 text-[10px] text-right px-2">Inject</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {!apiKey ? (
                                                    <TableRow>
                                                        <TableCell className="h-20 text-center text-muted-foreground text-[10px] italic">
                                                            Load an API Key to fetch tiers
                                                        </TableCell>
                                                    </TableRow>
                                                ) : shippingTiers.length > 0 ? (
                                                    shippingTiers.map((t) => (
                                                        <TableRow key={t.id} className="group py-0">
                                                            <TableCell className="py-2 px-2">
                                                                <div className="flex flex-col">
                                                                    <span className="font-semibold text-xs">{t.name}</span>
                                                                    <span className="text-[9px] text-muted-foreground">
                                                                        Rate: ${Number(t.shippingRate).toFixed(2)}
                                                                    </span>
                                                                    {t.uniqueTierId && (
                                                                        <span className="text-[9px] font-mono text-blue-500">{t.uniqueTierId}</span>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="py-2 px-2 text-right">
                                                                <div className="flex flex-col gap-1 items-end">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-6 text-[9px] px-1.5"
                                                                        onClick={() => setTierInPayload(t, 'unique')}
                                                                        disabled={!t.uniqueTierId}
                                                                    >
                                                                        Unique ID
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-6 text-[10px] px-1.5"
                                                                        onClick={() => setTierInPayload(t, 'id')}
                                                                    >
                                                                        DB ID
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={2} className="h-20 text-center text-muted-foreground text-[10px] italic">
                                                            {shippingTiersLoading ? "Fetching tiers..." : "No shipping tiers found."}
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </TabsContent>

                                <TabsContent value="debug" className="m-0 bg-zinc-950">
                                    <div className="max-h-[300px] overflow-y-auto p-3 space-y-4">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Request</span>
                                                <Badge variant="outline" className="text-[8px] h-4 bg-zinc-900 text-zinc-400">GET</Badge>
                                            </div>
                                            <div className="p-2 rounded bg-zinc-900 border border-zinc-800">
                                                <pre className="text-[9px] font-mono text-blue-400 whitespace-pre-wrap">
                                                    {tierApiDebug ? JSON.stringify(tierApiDebug.request, null, 2) : "No request sent yet."}
                                                </pre>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Response</span>
                                            <div className="p-2 rounded bg-zinc-900 border border-zinc-800">
                                                <pre className="text-[9px] font-mono text-green-400 whitespace-pre-wrap leading-relaxed">
                                                    {tierApiDebug ? JSON.stringify(tierApiDebug.response, null, 2) : "Awaiting response..."}
                                                </pre>
                                            </div>
                                        </div>

                                        <Button
                                            size="sm"
                                            className="w-full h-8 text-[10px] font-bold"
                                            onClick={() => fetchShippingTiers(apiKey, baseUrl)}
                                            disabled={shippingTiersLoading || !apiKey}
                                        >
                                            {shippingTiersLoading ? (
                                                <LoadingSpinner size={12} className="mr-2" />
                                            ) : (
                                                <Send className="mr-2 h-3 w-3" />
                                            )}
                                            Call API
                                        </Button>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>

                    {/* Configuration & Endpoint Card */}
                    <Card className="shadow-sm border-primary/10 overflow-hidden lg:col-span-1">
                        <CardHeader className="py-3 px-4 border-b bg-primary/5">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <Settings2 className="h-4 w-4 text-primary" />
                                System Configuration
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="apiKey" className="text-xs font-semibold">X-API-Key</Label>
                                    <div className="relative">
                                        <Input
                                            id="apiKey"
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                            placeholder="Enter Channel API Key"
                                            type={showApiKey ? "text" : "password"}
                                            className="h-9 font-mono text-xs pr-10"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="absolute right-0 top-0 h-9 w-10 hover:bg-transparent"
                                            onClick={() => setShowApiKey(!showApiKey)}
                                        >
                                            {showApiKey ? (
                                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                                            ) : (
                                                <Eye className="h-4 w-4 text-muted-foreground" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="baseUrl" className="text-xs font-semibold">API Base URL</Label>
                                    <Input
                                        id="baseUrl"
                                        value={baseUrl}
                                        onChange={(e) => setBaseUrl(e.target.value)}
                                        placeholder="http://localhost:5000/api"
                                        className="h-9 font-mono text-xs"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Inventory Selection Table */}
                <Card className="shadow-md border-muted/60 overflow-hidden">
                    <CardHeader className="py-3 px-4 border-b bg-muted/20">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div>
                                <CardTitle className="text-lg font-bold flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
                                    <Database className="h-4 w-4 text-orange-500" />
                                    Live Inventory Data
                                </CardTitle>
                                <CardDescription className="text-xs">Select variants to populate your order payload</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative w-full md:w-64">
                                    <Activity className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                        placeholder="Search SKU or Product..."
                                        className="pl-8 h-8 text-xs border-muted-foreground/20"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fetchVariants(search)}
                                    disabled={loading}
                                    className="h-8 text-xs bg-white shadow-sm"
                                >
                                    {loading ? <LoadingSpinner size={14} className="mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                                    Refresh
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                            <Table>
                                <TableHeader className="bg-muted/40 sticky top-0 z-10 shadow-sm border-b">
                                    <TableRow>
                                        <TableHead className="w-[140px] font-bold py-3 text-xs">SKU</TableHead>
                                        <TableHead className="font-bold py-3 text-xs">Product / Variant</TableHead>
                                        <TableHead className="font-bold py-3 text-xs">Variant ID</TableHead>
                                        <TableHead className="text-right font-bold py-3 text-xs">On Hand</TableHead>
                                        <TableHead className="text-right font-bold py-3 text-xs">Available</TableHead>
                                        <TableHead className="text-right font-bold py-3 text-xs">Committed</TableHead>
                                        <TableHead className="text-right font-bold w-[100px] py-3 text-xs text-orange-600">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {variants.length > 0 ? (
                                        variants.map((v) => (
                                            <TableRow key={v.id} className="hover:bg-orange-50/20 transition-colors group">
                                                <TableCell className="font-mono text-[11px] font-semibold text-blue-600">{v.sku}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col max-w-[200px]">
                                                        <span className="font-bold text-xs truncate text-zinc-800 dark:text-zinc-200">{v.productName}</span>
                                                        <span className="text-[10px] text-muted-foreground italic truncate">{v.variantName}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-mono text-[10px] text-zinc-400">{v.id}</TableCell>
                                                <TableCell className="text-right text-xs">{v.onHand}</TableCell>
                                                <TableCell className="text-right">
                                                    <Badge
                                                        variant={v.available > 0 ? "outline" : "destructive"}
                                                        className={v.available > 0 ? "border-green-500 text-green-700 bg-green-50/50 text-[10px] px-1.5 py-0 h-4" : "text-[10px] px-1.5 py-0 h-4"}
                                                    >
                                                        {v.available}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-orange-600 font-medium">{v.committed}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setVariantInPayload(v.id)}
                                                        className="h-7 text-[10px] px-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        Select ID
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-32 text-center text-muted-foreground text-xs italic">
                                                {loading ? "Fetching inventory..." : "No items found."}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* JSON Editor Card */}
                    <Card className="flex flex-col shadow-md lg:col-span-7 overflow-hidden border-blue-500/10">
                        <CardHeader className="py-2.5 px-4 border-b bg-blue-500/5">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    <Code className="h-4 w-4 text-blue-500" />
                                    Payload Editor
                                </CardTitle>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="font-mono text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20 py-0 h-5">POST</Badge>
                                    <Button variant="ghost" size="icon" onClick={() => copyToClipboard(payload)} className="h-7 w-7">
                                        <Copy className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 flex flex-col">
                            <div className="max-h-[350px] overflow-auto">
                                <Textarea
                                    className="w-full border-0 font-mono text-xs p-4 resize-none bg-zinc-950 text-zinc-50 focus-visible:ring-0 min-h-[350px]"
                                    value={payload}
                                    onChange={(e) => setPayload(e.target.value)}
                                    spellCheck={false}
                                />
                            </div>
                            <div className="p-3 border-t bg-muted/20">
                                <Button
                                    className="w-full h-10 text-sm font-bold shadow-sm"
                                    onClick={handleSendRequest}
                                    disabled={loading}
                                >
                                    {loading ? <LoadingSpinner size={16} className="mr-2" /> : <Send className="mr-2 h-4 w-4" />}
                                    Execute Request
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Cancellation Card */}
                    <Card className="flex flex-col shadow-md lg:col-span-7 overflow-hidden border-red-500/10 lg:col-start-1">
                        <CardHeader className="py-2.5 px-4 border-b bg-red-500/5">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 text-red-500" />
                                    Cancel Order
                                </CardTitle>
                                <Badge variant="outline" className="font-mono text-[10px] bg-red-500/10 text-red-600 border-red-500/20 py-0 h-5">DELETE</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 flex flex-col gap-4 bg-zinc-950/5">
                            <div className="space-y-1.5">
                                <Label htmlFor="cancelOrderId" className="text-xs font-semibold">Partner Order ID to Cancel</Label>
                                <Input
                                    id="cancelOrderId"
                                    value={cancelOrderId}
                                    onChange={(e) => setCancelOrderId(e.target.value)}
                                    placeholder="e.g. EXT-12345"
                                    className="h-9 font-mono text-xs"
                                />
                            </div>
                            <Button
                                variant="destructive"
                                className="w-full h-10 text-sm font-bold shadow-sm"
                                onClick={handleCancelRequest}
                                disabled={cancelLoading || !cancelOrderId}
                            >
                                {cancelLoading ? <LoadingSpinner size={16} className="mr-2" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                Send Cancellation Request
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Response Section */}
                    <Card className="flex flex-col shadow-md lg:col-span-5 lg:row-start-1 lg:row-span-2 overflow-hidden border-green-500/10">
                        <CardHeader className="py-2.5 px-4 border-b bg-green-500/5">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    <Terminal className="h-4 w-4 text-green-500" />
                                    Response
                                </CardTitle>
                                {response && (
                                    <Badge
                                        variant={response.status >= 200 && response.status < 300 ? "default" : "destructive"}
                                        className="font-mono text-[10px] py-0 h-5"
                                    >
                                        {response.status}
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 flex flex-col bg-zinc-900 overflow-hidden">
                            <div className="max-h-[350px] min-h-[350px] overflow-auto">
                                {response ? (
                                    <pre className="p-4 font-mono text-[10px] text-green-400 whitespace-pre-wrap leading-relaxed">
                                        {JSON.stringify(response.body, null, 2)}
                                    </pre>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-3 opacity-30 min-h-[350px]">
                                        <Activity className="h-10 w-10 text-muted-foreground" />
                                        <p className="text-[10px] font-semibold text-zinc-400 tracking-wider">AWAITING REQUEST</p>
                                    </div>
                                )}
                            </div>
                            {response && (
                                <div className="p-2 border-t border-zinc-800 bg-zinc-900/50 flex justify-between items-center text-[10px] font-mono text-zinc-500 px-3">
                                    <span>Time: {response.duration}</span>
                                    <Button variant="ghost" size="sm" className="h-6 text-[10px] text-zinc-400 hover:text-zinc-200" onClick={() => copyToClipboard(JSON.stringify(response.body))}>
                                        Copy Result
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* History Section */}
                <Card className="shadow-sm border-muted overflow-hidden">
                    <CardHeader className="py-3 px-4 border-b bg-muted/20">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <History className="h-4 w-4 text-indigo-500" />
                                Request History
                            </CardTitle>
                            <span className="text-[10px] text-muted-foreground">{history.length} events logged</span>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="max-h-[250px] overflow-y-auto">
                            <Table>
                                <TableHeader className="bg-muted/10 sticky top-0 z-10 shadow-xs border-b">
                                    <TableRow>
                                        <TableHead className="w-16 py-2 text-[10px] font-bold">Status</TableHead>
                                        <TableHead className="py-2 text-[10px] font-bold">Time</TableHead>
                                        <TableHead className="py-2 text-[10px] font-bold">Details</TableHead>
                                        <TableHead className="text-right py-2 text-[10px] font-bold">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {history.length > 0 ? (
                                        history.map((item) => (
                                            <TableRow key={item.id} className="text-[11px] group">
                                                <TableCell className="py-2">
                                                    <Badge variant={item.status >= 200 && item.status < 300 ? "default" : "destructive"} className="font-mono text-[9px] px-1.5 py-0 h-4">
                                                        {item.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground py-2">
                                                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </TableCell>
                                                <TableCell className="font-medium py-2">
                                                    {item.response?.data?.orderNumber || (item.response?.isDuplicate ? "Duplicate" : "-")}
                                                </TableCell>
                                                <TableCell className="text-right py-2 px-4">
                                                    <Button variant="ghost" size="sm" className="h-6 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => {
                                                        setPayload(JSON.stringify(item.request, null, 2));
                                                        setResponse({ body: item.response, status: item.status, duration: item.duration });
                                                        toast.success("Restored");
                                                    }}>
                                                        Restore
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-20 text-center text-muted-foreground text-[11px] italic">
                                                No request history.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
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
                isLoading={isDeletingChannel}
            />
        </DashboardLayout>
    );
}
