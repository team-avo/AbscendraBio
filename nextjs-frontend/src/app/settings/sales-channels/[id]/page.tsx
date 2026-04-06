"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    ArrowLeft,
    Save,
    Copy,
    Download,
    Upload,
    CheckCircle,
    Check,
    X,
    AlertCircle,
    RefreshCw,
    Info,
    CreditCard,
    Search,
    Edit3,
    Table as TableIcon,
    FileSpreadsheet,
    Eye,
    EyeOff,
    Link2,
    Play,
    Clock,
    Package,
    FileText,
    Receipt,
    Wallet,
    History,
    Settings2,
    Plus,
    Send,
    ShoppingCart,
    Settings,
    Truck,
    Edit,
    Trash2,
} from "lucide-react";
import { api, getToken } from "@/lib/api";
import logger from "@/lib/logger";
import { toast } from "sonner";
import { ProtectedRoute } from "@/contexts/auth-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EditOrderDialog } from '@/components/orders/edit-order-dialog';
import { PhoneInputWithFlag } from "@/components/customers/phone-input-with-flag";
import * as locationApi from "@/lib/api";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from "recharts";
import { formatCurrency } from "@/lib/api";
import { TrendingUp, ShoppingBag, DollarSign, Users, Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

// --- Inline Location Selectors (no cascading reset on mount) ---

function LocationCountrySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const [items, setItems] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        setLoading(true);
        locationApi.getCustomCountries().then(r => { if (r.success && r.data) setItems(r.data); }).finally(() => setLoading(false));
    }, []);
    return (
        <Select value={value || undefined} onValueChange={onChange} disabled={loading}>
            <SelectTrigger><SelectValue placeholder={loading ? "Loading…" : "Select country"} /></SelectTrigger>
            <SelectContent>
                {items.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
        </Select>
    );
}

function LocationStateSelect({ country, value, onChange }: { country: string; value: string; onChange: (v: string) => void }) {
    const [items, setItems] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        if (!country) { setItems([]); return; }
        setLoading(true);
        locationApi.getCustomStates(country).then(r => { if (r.success && r.data) setItems(r.data); }).finally(() => setLoading(false));
    }, [country]);
    return (
        <Select value={value || undefined} onValueChange={onChange} disabled={loading || !country}>
            <SelectTrigger><SelectValue placeholder={loading ? "Loading…" : "Select state"} /></SelectTrigger>
            <SelectContent>
                {items.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
        </Select>
    );
}

function LocationCitySelect({ country, state, value, onChange }: { country: string; state: string; value: string; onChange: (v: string) => void }) {
    const [items, setItems] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        if (!country || !state) { setItems([]); return; }
        setLoading(true);
        locationApi.getCustomCities(country, state).then(r => { if (r.success && r.data) setItems(r.data); }).finally(() => setLoading(false));
    }, [country, state]);
    return (
        <Select value={value || undefined} onValueChange={onChange} disabled={loading || !country || !state}>
            <SelectTrigger><SelectValue placeholder={loading ? "Loading…" : "Select city"} /></SelectTrigger>
            <SelectContent>
                {items.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
        </Select>
    );
}

export default function SalesChannelDetailsPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;
    const isNew = id === "new";

    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        companyName: "",
        contactPerson: "",
        contactNumber: "",
        contactEmail: "",
        type: "PARTNER",
        fulfillmentModel: "DROPSHIP",
        paymentTerms: "Net 14", // Default as requested
        status: "ACTIVE",
        apiKey: "",
        webhookUrl: "",
        autoPaid: false,
        // Ship-from address fields (for shipping labels)
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "",
        postalCode: "",
        country: "US",
    });

    // Price List Table State
    const [variants, setVariants] = useState<any[]>([]);
    const [tableLoading, setTableLoading] = useState(false);
    const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 1 });
    const [search, setSearch] = useState("");
    const [editedPrices, setEditedPrices] = useState<Record<string, number>>({});
    const [batchSaving, setBatchSaving] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [activeTab, setActiveTab] = useState(isNew ? "general" : "orders");
    const [analytics, setAnalytics] = useState<any>(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [dateRange, setDateRange] = useState<string>("30d");
    const [singleDate, setSingleDate] = useState<Date | undefined>(new Date());
    const [customRange, setCustomRange] = useState<DateRange | undefined>({
        from: new Date(new Date().setDate(new Date().getDate() - 30)),
        to: new Date(),
    });

    // Odoo Integration State
    const [odooConfig, setOdooConfig] = useState<{
        id?: string;
        isEnabled: boolean;
        apiBaseUrl: string;
        apiToken: string;
        partnerId: string;
        lastSyncAt: string | null;
        lastSyncStatus: string | null;
        syncedVariants: number;
    } | null>(null);
    const [odooLoading, setOdooLoading] = useState(false);
    const [odooSaving, setOdooSaving] = useState(false);
    const [odooTesting, setOdooTesting] = useState(false);
    const [odooSyncing, setOdooSyncing] = useState(false);
    const [odooConnectionStatus, setOdooConnectionStatus] = useState<'unknown' | 'connected' | 'failed'>('unknown');

    // Billing State
    const [billingConfig, setBillingConfig] = useState<any>(null);
    const [billingConfigLoading, setBillingConfigLoading] = useState(false);
    const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
    const [ledgerBalance, setLedgerBalance] = useState(0);
    const [pendingBalance, setPendingBalance] = useState(0); // Added pendingBalance state
    const [ledgerLoading, setLedgerLoading] = useState(false);
    const [ledgerPagination, setLedgerPagination] = useState({ page: 1, limit: 50, total: 0, pages: 1 });
    const [statements, setStatements] = useState<any[]>([]);
    const [statementsLoading, setStatementsLoading] = useState(false);
    const [statementsPagination, setStatementsPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
    const [paymentFormData, setPaymentFormData] = useState({ amount: "", referenceId: "", description: "" });
    const [paymentSaving, setPaymentSaving] = useState(false);
    const [triggeringStatement, setTriggeringStatement] = useState(false);
    const [sendingReminder, setSendingReminder] = useState(false);
    const [exportingData, setExportingData] = useState(false);

    // Payment Confirmation State
    const [confirmPayOpen, setConfirmPayOpen] = useState(false);
    const [statementToPay, setStatementToPay] = useState<string | null>(null);
    const [payingStatement, setPayingStatement] = useState(false);

    // Orders State
    const [orders, setOrders] = useState<any[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(false);
    const [ordersPagination, setOrdersPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
    const [editingOrder, setEditingOrder] = useState<any | null>(null);

    // Shipping Tiers State
    const [shippingTiers, setShippingTiers] = useState<any[]>([]);
    const [shippingTiersLoading, setShippingTiersLoading] = useState(false);
    const [tierDialogOpen, setTierDialogOpen] = useState(false);
    const [editingTier, setEditingTier] = useState<any | null>(null);
    const [deletingTier, setDeletingTier] = useState<any | null>(null);
    const [tierSaving, setTierSaving] = useState(false);
    const [tierDeleting, setTierDeleting] = useState(false);
    const [tierForm, setTierForm] = useState({
        uniqueTierId: '',
        name: '',
        minSubtotal: '',
        maxSubtotal: '',
        shippingRate: '',
        serviceName: '',
        isActive: true,
    });

    useEffect(() => {
        if (!isNew) {
            fetchChannelDetails();
            fetchVariants();
        }
    }, [id]);

    useEffect(() => {
        if (!isNew) {
            fetchVariants();
        }
    }, [pagination.page, search]);

    useEffect(() => {
        if (!isNew && activeTab === "analytics") {
            fetchAnalytics();
        }
    }, [activeTab, dateRange, customRange, singleDate]);

    useEffect(() => {
        if (!isNew && activeTab === "billing") {
            fetchBillingConfig();
            fetchLedger();
            fetchStatements();
        }
    }, [activeTab, id, ledgerPagination.page, statementsPagination.page]);

    useEffect(() => {
        if (!isNew && activeTab === "orders") {
            fetchOrders();
        }
    }, [activeTab, id, ordersPagination.page]);

    useEffect(() => {
        if (!isNew && activeTab === "integrations") {
            fetchOdooConfig();
        }
    }, [activeTab, id]);

    useEffect(() => {
        if (!isNew && activeTab === "shipping-tiers") {
            fetchShippingTiers();
        }
    }, [activeTab, id]);

    const fetchShippingTiers = async () => {
        setShippingTiersLoading(true);
        try {
            const res = await api.get(`/sales-channels/${id}/shipping-tiers`);
            if (res.success) {
                setShippingTiers(res.data);
            }
        } catch (e) {
            logger.error("An error occurred", { error: e });
            toast.error('Failed to load shipping tiers');
        } finally {
            setShippingTiersLoading(false);
        }
    };

    const openCreateTierDialog = () => {
        setEditingTier(null);
        setTierForm({ uniqueTierId: '', name: '', minSubtotal: '', maxSubtotal: '', shippingRate: '', serviceName: '', isActive: true });
        setTierDialogOpen(true);
    };

    const openEditTierDialog = (tier: any) => {
        setEditingTier(tier);
        setTierForm({
            uniqueTierId: tier.uniqueTierId || '',
            name: tier.name || '',
            minSubtotal: String(tier.minSubtotal ?? ''),
            maxSubtotal: tier.maxSubtotal != null ? String(tier.maxSubtotal) : '',
            shippingRate: String(tier.shippingRate ?? ''),
            serviceName: tier.serviceName || '',
            isActive: tier.isActive ?? true,
        });
        setTierDialogOpen(true);
    };

    const handleSaveTier = async (e: React.FormEvent) => {
        e.preventDefault();
        setTierSaving(true);
        try {
            const payload = {
                uniqueTierId: tierForm.uniqueTierId || undefined,
                name: tierForm.name,
                minSubtotal: String(parseFloat(tierForm.minSubtotal)),
                maxSubtotal: tierForm.maxSubtotal ? String(parseFloat(tierForm.maxSubtotal)) : null,
                shippingRate: String(parseFloat(tierForm.shippingRate)),
                serviceName: tierForm.serviceName || undefined,
                isActive: tierForm.isActive,
            };
            let res;
            if (editingTier) {
                res = await api.put(`/sales-channels/${id}/shipping-tiers/${editingTier.id}`, payload);
            } else {
                res = await api.post(`/sales-channels/${id}/shipping-tiers`, payload);
            }
            if (res.success) {
                toast.success(editingTier ? 'Tier updated' : 'Tier created');
                setTierDialogOpen(false);
                fetchShippingTiers();
            } else {
                toast.error((res as any).error || 'Failed to save tier');
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to save tier');
        } finally {
            setTierSaving(false);
        }
    };

    const handleDeleteTier = async () => {
        if (!deletingTier) return;
        setTierDeleting(true);
        try {
            const res = await api.delete(`/sales-channels/${id}/shipping-tiers/${deletingTier.id}`);
            if (res.success) {
                toast.success('Tier deleted');
                setDeletingTier(null);
                fetchShippingTiers();
            } else {
                toast.error((res as any).error || 'Failed to delete tier');
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to delete tier');
        } finally {
            setTierDeleting(false);
        }
    };

    const fetchOrders = async () => {
        setOrdersLoading(true);
        try {
            const res = await api.get(`/orders?salesChannelId=${id}&page=${ordersPagination.page}&limit=${ordersPagination.limit}`);
            if (res.success) {
                setOrders(res.data.orders);
                setOrdersPagination(res.data.pagination);
            }
        } catch (e) {
            logger.error("An error occurred", { error: e });
            toast.error("Failed to load orders");
        } finally {
            setOrdersLoading(false);
        }
    };

    const handleEditOrder = async (orderId: string) => {
        try {
            const response = await api.getOrder(orderId);
            if (response.success && response.data) {
                setEditingOrder(response.data);
            } else {
                toast.error('Failed to load order details');
            }
        } catch (error) {
            logger.error('Failed to fetch order details:', { error: error });
            toast.error('Failed to load order details');
        }
    };

    const handleOrderUpdated = () => {
        setEditingOrder(null);
        fetchOrders();
        toast.success('Order updated successfully');
    };

    const fetchOdooConfig = async () => {
        setOdooLoading(true);
        try {
            const res = await api.get(`/odoo/config?salesChannelId=${id}`);
            if (res.success && res.data) {
                setOdooConfig(res.data);
                setOdooConnectionStatus('unknown');
            } else {
                // No config exists yet, set defaults
                setOdooConfig({
                    isEnabled: false,
                    apiBaseUrl: 'https://bol9967-odoo18-tk.odoo.com',
                    apiToken: '',
                    partnerId: '7',
                    lastSyncAt: null,
                    lastSyncStatus: null,
                    syncedVariants: 0,
                });
            }
        } catch (e) {
            logger.error('Error fetching Odoo config:', { error: e });
            setOdooConfig({
                isEnabled: false,
                apiBaseUrl: 'https://bol9967-odoo18-tk.odoo.com',
                apiToken: '',
                partnerId: '7',
                lastSyncAt: null,
                lastSyncStatus: null,
                syncedVariants: 0,
            });
        } finally {
            setOdooLoading(false);
        }
    };

    const handleSaveOdooConfig = async () => {
        if (!odooConfig) return;

        setOdooSaving(true);
        try {
            const res = await api.put('/odoo/config', {
                salesChannelId: id,
                isEnabled: odooConfig.isEnabled,
                apiBaseUrl: odooConfig.apiBaseUrl,
                apiToken: odooConfig.apiToken,
                partnerId: odooConfig.partnerId,
            });

            if (res.success) {
                toast.success('Odoo integration settings saved');
                setOdooConfig(res.data);
            } else {
                toast.error(res.error || 'Failed to save settings');
            }
        } catch (e: any) {
            toast.error(e.message || 'Failed to save settings');
        } finally {
            setOdooSaving(false);
        }
    };

    const handleTestOdooConnection = async () => {
        if (!odooConfig) return;

        setOdooTesting(true);
        setOdooConnectionStatus('unknown');
        try {
            const res = await api.post<{ connected: boolean; message?: string; error?: string }>('/odoo/config/test-connection', {
                apiBaseUrl: odooConfig.apiBaseUrl,
                apiToken: odooConfig.apiToken,
                partnerId: odooConfig.partnerId,
            });

            // Response has connected at root level (not nested under data)
            const response = res as any;
            if (res.success && response.connected) {
                setOdooConnectionStatus('connected');
                toast.success(response.message || 'Connection successful!');
            } else {
                setOdooConnectionStatus('failed');
                toast.error(response.error || response.message || 'Connection failed');
            }
        } catch (e: any) {
            setOdooConnectionStatus('failed');
            toast.error(e.message || 'Connection test failed');
        } finally {
            setOdooTesting(false);
        }
    };

    const handleTriggerOdooSync = async () => {
        if (!odooConfig?.isEnabled) {
            toast.error('Please enable the integration first');
            return;
        }

        setOdooSyncing(true);
        try {
            const res = await api.post('/odoo/sync/full');
            if (res.success) {
                toast.success(`Sync started! Job ID: ${res.data?.jobId || 'processing'}`);
                // Refresh config to get updated sync stats
                setTimeout(fetchOdooConfig, 2000);
            } else {
                toast.error(res.error || 'Failed to start sync');
            }
        } catch (e: any) {
            toast.error(e.message || 'Failed to trigger sync');
        } finally {
            setOdooSyncing(false);
        }
    };

    const fetchBillingConfig = async () => {
        setBillingConfigLoading(true);
        try {
            const res = await api.get(`/sales-channels/${id}/billing/config`);
            if (res.success) {
                setBillingConfig(res.data);
            }
        } catch (e) {
            logger.error("An error occurred", { error: e });
        } finally {
            setBillingConfigLoading(false);
        }
    };

    const fetchLedger = async () => {
        setLedgerLoading(true);
        try {
            const q = new URLSearchParams({
                page: String(ledgerPagination.page),
                limit: String(ledgerPagination.limit)
            });
            const res = await api.get(`/sales-channels/${id}/billing/ledger?${q}`) as any;
            if (res.success) {
                setLedgerEntries(res.data);
                if (res.currentBalance !== undefined) setLedgerBalance(Number(res.currentBalance));
                if (res.pendingBalance !== undefined) setPendingBalance(Number(res.pendingBalance));
                if (res.pagination) setLedgerPagination(res.pagination);
            }
        } catch (e) {
            logger.error("An error occurred", { error: e });
        } finally {
            setLedgerLoading(false);
        }
    };

    const fetchStatements = async () => {
        setStatementsLoading(true);
        try {
            const q = new URLSearchParams({
                page: String(statementsPagination.page),
                limit: String(statementsPagination.limit)
            });
            const res = await api.get(`/sales-channels/${id}/billing/statements?${q}`) as any;
            if (res.success) {
                setStatements(res.data);
                if (res.pagination) setStatementsPagination(res.pagination);
            }
        } catch (e) {
            logger.error("An error occurred", { error: e });
        } finally {
            setStatementsLoading(false);
        }
    };

    const handleSaveBillingConfig = async () => {
        if (!billingConfig) return;
        setSaving(true);
        try {
            const res = await api.put(`/sales-channels/${id}/billing/config`, billingConfig);
            if (res.success) {
                toast.success("Billing settings saved");
                setBillingConfig(res.data);
            } else {
                toast.error(res.error || "Failed to save settings");
            }
        } catch (e: any) {
            toast.error(e.message || "Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    const handleRecordPayment = async () => {
        if (!paymentFormData.amount || parseFloat(paymentFormData.amount) <= 0) {
            toast.error("Please enter a valid amount");
            return;
        }

        setPaymentSaving(true);
        try {
            const res = await api.post(`/sales-channels/${id}/billing/payments`, paymentFormData);
            if (res.success) {
                toast.success("Payment recorded and allocated successfully");
                setIsPaymentDialogOpen(false);
                setPaymentFormData({ amount: "", referenceId: "", description: "" });
                fetchLedger();
                fetchStatements();
            } else {
                toast.error(res.error || "Failed to record payment");
            }
        } catch (e: any) {
            toast.error(e.message || "Failed to record payment");
        } finally {
            setPaymentSaving(false);
        }
    };

    const handleGenerateStatement = async () => {
        setTriggeringStatement(true);
        try {
            const res = await api.post(`/sales-channels/${id}/generate-statement`);
            if (res.success) {
                toast.success("Statement generation triggered successfully");
                fetchLedger();
                fetchStatements();
            } else {
                toast.error(res.message || "Failed to trigger statement generation");
            }
        } catch (e: any) {
            toast.error(e.message || "Failed to trigger statement generation");
        } finally {
            setTriggeringStatement(false);
        }
    };

    const handlePayClick = (statementId: string) => {
        setStatementToPay(statementId);
        setConfirmPayOpen(true);
    };

    const handleConfirmPayStatement = async () => {
        if (!statementToPay) return;

        setPayingStatement(true);
        try {
            const res = await api.post(`/sales-channels/${id}/billing/statements/${statementToPay}/pay`);
            if (res.success) {
                toast.success("Statement marked as PAID");
                fetchLedger();
                fetchStatements();
                setConfirmPayOpen(false);
                setStatementToPay(null);
            } else {
                toast.error(res.message || "Failed to mark statement as paid");
            }
        } catch (e: any) {
            toast.error(e.message || "Failed to mark statement as paid");
        } finally {
            setPayingStatement(false);
        }
    };

    const handleSendReminder = async (statementId: string) => {
        setSendingReminder(true);
        try {
            const res = await api.post(`/sales-channels/${id}/send-reminder/${statementId}`);
            if (res.success) {
                toast.success("Payment reminder sent successfully");
                fetchStatements();
            } else {
                toast.error(res.message || "Failed to send reminder");
            }
        } catch (e: any) {
            toast.error(e.message || "Failed to send reminder");
        } finally {
            setSendingReminder(false);
        }
    };

    const handleExport = async (type: 'ledger' | 'statements', format: 'csv' | 'excel') => {
        setExportingData(true);
        try {
            const endpoint = type === 'ledger' ? 'export-ledger' : 'export-statements';
            const token = getToken();
            const headers: HeadersInit = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/sales-channels/${id}/${endpoint}?format=${format}`, {
                headers,
                credentials: 'include',
            });

            if (!response.ok) throw new Error('Export failed');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${type}-${id}.${format === 'excel' ? 'xlsx' : 'csv'}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} exported successfully`);
        } catch (e: any) {
            toast.error(e.message || "Export failed");
        } finally {
            setExportingData(false);
        }
    };

    const fetchAnalytics = async () => {
        setAnalyticsLoading(true);
        try {
            let url = `/sales-channels/${id}/analytics?range=${dateRange}`;
            if (dateRange === "1d" && singleDate) {
                url += `&from=${singleDate.toISOString()}`;
            } else if (dateRange === "custom" && customRange?.from && customRange?.to) {
                url += `&from=${customRange.from.toISOString()}&to=${customRange.to.toISOString()}`;
            }
            const res = await api.get(url);
            if (res.success) {
                setAnalytics(res.data);
            }
        } catch (e) {
            logger.error("An error occurred", { error: e });
        } finally {
            setAnalyticsLoading(false);
        }
    };

    const fetchChannelDetails = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/sales-channels/${id}`);
            if (res.success) {
                setFormData(res.data);
            } else {
                toast.error("Failed to load channel details");
                router.push("/settings/sales-channels");
            }
        } catch (e) {
            toast.error("Failed to load channel details");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.companyName || !formData.contactPerson) {
            toast.error("Company Name and Contact Person are required");
            return;
        }

        setSaving(true);
        try {
            if (isNew) {
                const res = await api.post("/sales-channels", formData);
                if (res.success) {
                    toast.success("Sales Channel created successfully");
                    // Redirect to edit page to show integration details
                    router.push(`/settings/sales-channels/${res.data.id}`);
                } else {
                    toast.error(res.error || "Failed to create channel");
                }
            } else {
                const res = await api.put(`/sales-channels/${id}`, formData);
                if (res.success) {
                    toast.success("Sales Channel updated successfully");
                } else {
                    toast.error(res.error || "Failed to update channel");
                }
            }
        } catch (e: any) {
            toast.error(e.response?.data?.error || "An error occurred");
        } finally {
            setSaving(false);
        }
    };

    const handleCopyKey = () => {
        if (formData.apiKey) {
            navigator.clipboard.writeText(formData.apiKey);
            toast.success("API Key copied to clipboard");
        }
    };

    const fetchVariants = async () => {
        if (isNew) return;
        setTableLoading(true);
        try {
            const q = new URLSearchParams({
                page: String(pagination.page),
                limit: String(pagination.limit),
                search
            });
            const res = await api.get(`/sales-channels/${id}/prices?${q}`);
            if (res.success) {
                setVariants(res.data);
                if (res.pagination) {
                    setPagination(res.pagination);
                }
            }
        } catch (e) {
            logger.error("An error occurred", { error: e });
        } finally {
            setTableLoading(false);
        }
    };

    const [rowSaving, setRowSaving] = useState<string | null>(null);

    const handlePriceChange = (variantId: string, value: string) => {
        const numVal = parseFloat(value);
        if (!isNaN(numVal)) {
            setEditedPrices(prev => ({ ...prev, [variantId]: numVal }));
        } else if (value === "") {
            setEditedPrices(prev => ({ ...prev, [variantId]: 0 }));
        }
    };

    const handleCancelPrice = (variantId: string) => {
        setEditedPrices(prev => {
            const next = { ...prev };
            delete next[variantId];
            return next;
        });
    };

    const handleSavePrice = async (variantId: string) => {
        const price = editedPrices[variantId];
        if (price === undefined) return;

        setRowSaving(variantId);
        try {
            const res = await api.put(`/sales-channels/${id}/prices`, {
                updates: [{ variantId, price }]
            });
            if (res.success) {
                toast.success("Price updated successfully");
                handleCancelPrice(variantId);
                fetchVariants();
            }
        } catch (e) {
            toast.error("Failed to update price");
        } finally {
            setRowSaving(null);
        }
    };

    const handleSaveBatchPrices = async () => {
        const updates = Object.entries(editedPrices).map(([variantId, price]) => ({
            variantId,
            price
        }));

        if (updates.length === 0) return;

        setBatchSaving(true);
        try {
            const res = await api.put(`/sales-channels/${id}/prices`, { updates });
            if (res.success) {
                toast.success("Prices updated successfully");
                setEditedPrices({});
                fetchVariants();
            }
        } catch (e) {
            toast.error("Failed to update prices");
        } finally {
            setBatchSaving(false);
        }
    };

    const handlePageChange = (newPage: number) => {
        if (newPage > 0 && newPage <= pagination.pages) {
            setPagination(prev => ({ ...prev, page: newPage }));
        }
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex h-[50vh] items-center justify-center flex-col gap-4">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-muted-foreground">Loading channel details...</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <ProtectedRoute requiredPermissions={[{ module: 'settings', action: 'UPDATE' }]}>
            <DashboardLayout>
                <div className="space-y-6 max-w-5xl mx-auto pb-12">
                    {/* Header */}
                    {/* Header */}
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
                        <div className="flex items-center gap-3 sm:gap-4">
                            <Button variant="outline" size="icon" className="shrink-0" onClick={() => router.push("/settings/sales-channels")}>
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <div className="min-w-0">
                                <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
                                    {isNew ? "Create Sales Channel" : formData.companyName}
                                </h1>
                                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                                    {isNew ? "Configure a new sales channel or partner." : `Manage settings for ${formData.companyName}`}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleSave} disabled={saving} className="flex-1 sm:flex-none sm:min-w-[120px]">
                                <Save className="mr-2 h-4 w-4" />
                                {saving ? "Saving..." : "Save Changes"}
                            </Button>
                        </div>
                    </div>

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <div className="relative">
                            <TabsList className="flex w-full overflow-x-auto scrollbar-hide justify-start bg-muted/50 p-1 h-auto min-h-10">
                                <TabsTrigger value="orders" className="flex items-center gap-2 px-3 py-2 shrink-0" disabled={isNew}>
                                    <ShoppingCart className="h-4 w-4" />
                                    Orders
                                </TabsTrigger>
                                <TabsTrigger value="analytics" className="flex items-center gap-2 px-3 py-2 shrink-0" disabled={isNew}>
                                    <TrendingUp className="h-4 w-4" />
                                    Analytics
                                </TabsTrigger>
                                <TabsTrigger value="pricing" className="flex items-center gap-2 px-3 py-2 shrink-0" disabled={isNew}>
                                    <TableIcon className="h-4 w-4" />
                                    Price list
                                </TabsTrigger>
                                <TabsTrigger value="integrations" className="flex items-center gap-2 px-3 py-2 shrink-0" disabled={isNew}>
                                    <Link2 className="h-4 w-4" />
                                    Integrations
                                </TabsTrigger>
                                <TabsTrigger value="billing" className="flex items-center gap-2 px-3 py-2 shrink-0" disabled={isNew}>
                                    <Wallet className="h-4 w-4" />
                                    Billing
                                </TabsTrigger>
                                <TabsTrigger value="shipping-tiers" className="flex items-center gap-2 px-3 py-2 shrink-0" disabled={isNew}>
                                    <Truck className="h-4 w-4" />
                                    Shipping
                                </TabsTrigger>
                                <TabsTrigger value="general" className="flex items-center gap-2 px-3 py-2 shrink-0">
                                    <Settings className="h-4 w-4" />
                                    Settings
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <TabsContent value="orders" className="space-y-6 mt-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Sales Channel Orders</CardTitle>
                                    <CardDescription>View all orders associated with this sales channel.</CardDescription>
                                </CardHeader>
                                <CardContent className="p-0 sm:p-6">
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="min-w-[100px]">Order #</TableHead>
                                                    <TableHead className="min-w-[120px]">Date</TableHead>
                                                    <TableHead className="min-w-[200px]">Customer</TableHead>
                                                    <TableHead className="min-w-[120px]">Status</TableHead>
                                                    <TableHead className="text-right min-w-[100px]">Total</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {ordersLoading ? (
                                                    <TableRow><TableCell colSpan={5} className="text-center py-8"><RefreshCw className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                                                ) : orders.length === 0 ? (
                                                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No orders found.</TableCell></TableRow>
                                                ) : (
                                                    orders.map((order) => (
                                                        <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleEditOrder(order.id)}>
                                                            <TableCell className="font-medium">{order.orderNumber}</TableCell>
                                                            <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                                                            <TableCell>
                                                                <div className="flex flex-col">
                                                                    <span className="font-medium">{order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : 'Guest'}</span>
                                                                    <span className="text-xs text-muted-foreground">{order.customer?.email}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge variant="outline" className="text-[10px] uppercase">{order.status}</Badge>
                                                            </TableCell>
                                                            <TableCell className="text-right font-bold text-sm">
                                                                {formatCurrency(order.totalAmount)}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    {ordersPagination.pages > 1 && (
                                        <div className="flex items-center justify-end p-4 gap-2 border-t">
                                            <Button
                                                variant="outline" size="sm"
                                                disabled={ordersPagination.page <= 1}
                                                onClick={() => setOrdersPagination({ ...ordersPagination, page: ordersPagination.page - 1 })}
                                            >Prev</Button>
                                            <span className="text-xs">{ordersPagination.page} / {ordersPagination.pages}</span>
                                            <Button
                                                variant="outline" size="sm"
                                                disabled={ordersPagination.page >= ordersPagination.pages}
                                                onClick={() => setOrdersPagination({ ...ordersPagination, page: ordersPagination.page + 1 })}
                                            >Next</Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <EditOrderDialog
                                order={editingOrder}
                                open={!!editingOrder}
                                onOpenChange={(open) => !open && setEditingOrder(null)}
                                onSuccess={handleOrderUpdated}
                            />
                        </TabsContent>

                        <TabsContent value="general" className="space-y-6 mt-6">
                            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                {/* LEFT COLUMN: Main Config (Spans 2 cols on Large screens) */}
                                <div className="space-y-6 md:col-span-2">
                                    {/* General Information */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>General Information</CardTitle>
                                            <CardDescription>Basic contact details for this channel partner.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="grid gap-2">
                                                <Label className="text-sm font-medium">Company Name <span className="text-red-500">*</span></Label>
                                                <Input
                                                    value={formData.companyName}
                                                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                                                    placeholder="e.g. Skydell"
                                                />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                                                <div className="grid gap-2">
                                                    <Label className="text-sm font-medium">Contact Person <span className="text-red-500">*</span></Label>
                                                    <Input
                                                        value={formData.contactPerson}
                                                        onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                                                        placeholder="e.g. John Doe"
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label className="text-sm font-medium">Contact Number</Label>
                                                    <div className="[&_input]:h-10">
                                                        <PhoneInputWithFlag
                                                            value={formData.contactNumber || ""}
                                                            onChange={(val) => setFormData({ ...formData, contactNumber: val })}
                                                            placeholder="e.g. +1 555 123 4567"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid gap-2 md:col-span-2 lg:col-span-1">
                                                    <Label className="text-sm font-medium">Contact Email <span className="text-red-500">*</span></Label>
                                                    <Input
                                                        type="email"
                                                        value={formData.contactEmail}
                                                        onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                                                        placeholder="e.g. billing@partner.com"
                                                    />
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Shipping Address (Ship-From for Labels) */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <Truck className="h-5 w-5" />
                                                Shipping Address
                                            </CardTitle>
                                            <CardDescription>This address will appear as the &quot;Ship From&quot; and return address on shipping labels for this channel&apos;s orders. Leave blank to use Centre Labs&apos; default address.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="grid gap-2">
                                                    <Label className="text-sm font-medium">Address Line 1</Label>
                                                    <Input
                                                        value={formData.addressLine1 || ""}
                                                        onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                                                        placeholder="e.g. 123 Business Ave"
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label className="text-sm font-medium">Address Line 2</Label>
                                                    <Input
                                                        value={formData.addressLine2 || ""}
                                                        onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                                                        placeholder="e.g. Suite 200"
                                                    />
                                                </div>
                                            </div>
                                            {/* Country / State / City Selectors */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                                <div className="grid gap-2">
                                                    <Label className="text-sm font-medium">Country</Label>
                                                    <LocationCountrySelect
                                                        value={formData.country || ""}
                                                        onChange={(val) => setFormData(prev => ({ ...prev, country: val, state: "", city: "" }))}
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label className="text-sm font-medium">State / Province</Label>
                                                    <LocationStateSelect
                                                        country={formData.country || ""}
                                                        value={formData.state || ""}
                                                        onChange={(val) => setFormData(prev => ({ ...prev, state: val, city: "" }))}
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label className="text-sm font-medium">City</Label>
                                                    <LocationCitySelect
                                                        country={formData.country || ""}
                                                        state={formData.state || ""}
                                                        value={formData.city || ""}
                                                        onChange={(val) => setFormData(prev => ({ ...prev, city: val }))}
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label className="text-sm font-medium">Postal Code</Label>
                                                    <Input
                                                        value={formData.postalCode || ""}
                                                        onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                                                        placeholder="e.g. 77001"
                                                    />
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Configuration */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Configuration</CardTitle>
                                            <CardDescription>Operational model and status settings.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                                <div className="space-y-3">
                                                    <Label className="text-sm font-medium">Sales Channel Type</Label>
                                                    <Select
                                                        value={formData.type}
                                                        onValueChange={(v) => setFormData({ ...formData, type: v })}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="PARTNER">Channel Partner (External)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="space-y-3">
                                                    <Label className="text-sm font-medium">Fulfillment Model</Label>
                                                    <Select
                                                        value={formData.fulfillmentModel}
                                                        onValueChange={(v) => setFormData({ ...formData, fulfillmentModel: v })}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="DROPSHIP">Dropship (Fulfilled by Centre Research)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            <Separator />

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                                <div className="space-y-3">
                                                    <Label className="text-sm font-medium">Payment Terms</Label>
                                                    <div className="relative">
                                                        <CreditCard className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                        <Input
                                                            className="pl-9"
                                                            value={formData.paymentTerms || ""}
                                                            onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                                                            placeholder="e.g. Net 14"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    <Label className="text-sm font-medium">Channel Status</Label>
                                                    <Select
                                                        value={formData.status}
                                                        onValueChange={(v) => setFormData({ ...formData, status: v })}
                                                    >
                                                        <SelectTrigger className={formData.status === 'ACTIVE' ? "border-green-500 bg-green-50 dark:bg-green-900/10" : "border-yellow-500"}>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="ACTIVE">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="h-2 w-2 rounded-full bg-green-500" />
                                                                    Active
                                                                </div>
                                                            </SelectItem>
                                                            <SelectItem value="PAUSED">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="h-2 w-2 rounded-full bg-yellow-500" />
                                                                    Paused
                                                                </div>
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            <Separator />

                                            <div className="flex items-center justify-between rounded-lg border p-4">
                                                <div className="space-y-1">
                                                    <Label className="text-sm font-medium">Auto-mark orders as paid</Label>
                                                    <p className="text-xs text-muted-foreground">
                                                        When enabled, orders from this sales channel will automatically be marked as paid upon creation.
                                                    </p>
                                                </div>
                                                <Switch
                                                    checked={formData.autoPaid}
                                                    onCheckedChange={(checked) => setFormData({ ...formData, autoPaid: checked })}
                                                />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* RIGHT COLUMN: Integration */}
                                <div className="space-y-6 md:col-span-2 lg:col-span-1">
                                    {!isNew ? (
                                        <Card className="border-l-4 border-l-primary">
                                            <CardHeader>
                                                <CardTitle className="text-base text-primary">Integration Setup</CardTitle>
                                                <CardDescription>Order import authentication.</CardDescription>
                                                import logger from '@/lib/logger';
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-semibold uppercase text-muted-foreground">API Key</Label>
                                                    <div className="flex gap-2">
                                                        <Input
                                                            readOnly
                                                            type={showApiKey ? "text" : "password"}
                                                            value={formData.apiKey || "No Key Generated"}
                                                            className="font-mono text-xs bg-muted/50"
                                                        />
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => setShowApiKey(!showApiKey)}
                                                            title={showApiKey ? "Hide API Key" : "Show API Key"}
                                                        >
                                                            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                        </Button>
                                                        <Button variant="outline" size="icon" onClick={handleCopyKey} title="Copy API Key">
                                                            <Copy className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                    <Alert className="py-2 bg-blue-50 dark:bg-blue-900/10 border-none">
                                                        <Info className="h-4 w-4 text-blue-600" />
                                                        <AlertDescription className="text-xs text-blue-700 dark:text-blue-300">
                                                            Use header <code className="font-bold">X-API-Key</code>
                                                        </AlertDescription>
                                                    </Alert>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ) : (
                                        <Alert className="bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200">
                                            <AlertCircle className="h-4 w-4 text-yellow-600" />
                                            <AlertTitle className="text-yellow-800 dark:text-yellow-200 text-sm">Action Required</AlertTitle>
                                            <AlertDescription className="text-yellow-700 dark:text-yellow-300 text-xs">
                                                Save channel to unlock API and pricing.
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    {/* Webhook Configuration */}
                                    {!isNew && (
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-base">Webhook Configuration</CardTitle>
                                                <CardDescription>Push real-time inventory updates to this partner.</CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-semibold uppercase text-muted-foreground">Webhook URL</Label>
                                                    <Input
                                                        type="url"
                                                        value={formData.webhookUrl || ""}
                                                        onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                                                        placeholder="https://partner.com/api/supply-channels/webhook/..."
                                                        className="font-mono text-xs"
                                                    />
                                                    <Alert className="py-2 bg-blue-50 dark:bg-blue-900/10 border-none">
                                                        <Info className="h-4 w-4 text-blue-600" />
                                                        <AlertDescription className="text-xs text-blue-700 dark:text-blue-300">
                                                            Inventory changes will be automatically POSTed to this URL. Paste the webhook URL from the partner&apos;s Supply Channel settings.
                                                        </AlertDescription>
                                                    </Alert>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="pricing" className="space-y-6 mt-6">
                            {!isNew ? (
                                <Card>
                                    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0 p-4 sm:p-6">
                                        <div className="space-y-1">
                                            <CardTitle className="text-base sm:text-lg">SKU Price Management</CardTitle>
                                            <CardDescription className="text-xs sm:text-sm">Manage individual product prices for this channel.</CardDescription>
                                        </div>
                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => router.push(`/settings/sales-channels/${id}/pricing`)}
                                                className="h-8 w-full sm:w-auto"
                                            >
                                                <FileSpreadsheet className="mr-2 h-4 w-4" />
                                                Bulk Import / Export
                                            </Button>
                                            {Object.keys(editedPrices).length > 0 && (
                                                <Button size="sm" onClick={handleSaveBatchPrices} disabled={batchSaving} className="h-8 w-full sm:w-auto">
                                                    {batchSaving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                                    Save Changes ({Object.keys(editedPrices).length})
                                                </Button>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <div className="px-4 sm:px-6 pb-4">
                                        <div className="flex items-center gap-2 w-full sm:max-w-sm">
                                            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <Input
                                                placeholder="Search SKU or product..."
                                                value={search}
                                                onChange={(e) => setSearch(e.target.value)}
                                                className="h-8"
                                            />
                                        </div>
                                    </div>
                                    <CardContent className="p-0 border-t">
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-muted/50">
                                                        <TableHead className="min-w-[150px]">SKU</TableHead>
                                                        <TableHead className="min-w-[200px]">Product / Variant</TableHead>
                                                        <TableHead className="text-right min-w-[150px]">Channel Price</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {tableLoading ? (
                                                        <TableRow>
                                                            <TableCell colSpan={3} className="h-24 text-center">
                                                                <RefreshCw className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : variants.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={3} className="h-24 text-center text-muted-foreground text-sm">
                                                                No matches found.
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        variants.map((variant) => (
                                                            <TableRow key={variant.id}>
                                                                <TableCell className="font-mono text-[11px] py-2">{variant.sku}</TableCell>
                                                                <TableCell className="text-sm py-2 font-medium">{variant.name}</TableCell>

                                                                <TableCell className="text-right py-2">
                                                                    <div className="relative inline-block w-[120px]">
                                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                                                                        <Input
                                                                            type="number"
                                                                            step="0.01"
                                                                            className={`text-right h-8 pl-6 ${editedPrices[variant.id] !== undefined ? "border-primary ring-1 ring-primary" : ""}`}
                                                                            value={editedPrices[variant.id] !== undefined ? editedPrices[variant.id] : (variant.channelPrice || 0)}
                                                                            onChange={(e) => handlePriceChange(variant.id, e.target.value)}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        />
                                                                        {editedPrices[variant.id] !== undefined && (
                                                                            <div className="absolute top-full right-0 mt-1 flex gap-1 z-10 bg-background border rounded-md shadow-lg p-1">
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleCancelPrice(variant.id);
                                                                                    }}
                                                                                    disabled={rowSaving === variant.id}
                                                                                >
                                                                                    <X className="h-3.5 w-3.5" />
                                                                                </Button>
                                                                                <Button
                                                                                    variant="default"
                                                                                    size="icon"
                                                                                    className="h-7 w-7 bg-green-600 hover:bg-green-700"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleSavePrice(variant.id);
                                                                                    }}
                                                                                    disabled={rowSaving === variant.id}
                                                                                >
                                                                                    {rowSaving === variant.id ? (
                                                                                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                                                                    ) : (
                                                                                        <Check className="h-3.5 w-3.5 text-white" />
                                                                                    )}
                                                                                </Button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                        {/* Pagination */}
                                        <div className="flex flex-col sm:flex-row items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-t bg-muted/20 gap-2">
                                            <p className="text-xs text-muted-foreground">
                                                Showing <span className="font-medium">{variants.length}</span> items
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 text-xs"
                                                    onClick={() => handlePageChange(pagination.page - 1)}
                                                    disabled={pagination.page <= 1 || tableLoading}
                                                >
                                                    Prev
                                                </Button>
                                                <span className="text-xs">
                                                    {pagination.page} / {pagination.pages}
                                                </span>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 text-xs"
                                                    onClick={() => handlePageChange(pagination.page + 1)}
                                                    disabled={pagination.page >= pagination.pages || tableLoading}
                                                >
                                                    Next
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="h-40 flex items-center justify-center border-2 border-dashed rounded-lg">
                                    <p className="text-muted-foreground text-sm">Please save the channel first to manage pricing.</p>
                                </div>
                            )}
                        </TabsContent>

                        {/* Integrations Tab */}
                        <TabsContent value="integrations" className="space-y-6 mt-6">
                            {odooLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : odooConfig ? (
                                <div className="space-y-6">
                                    {/* Odoo Sync Card */}
                                    <Card>
                                        <CardHeader>
                                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/20 shrink-0">
                                                        <Package className="h-5 w-5 text-orange-600" />
                                                    </div>
                                                    <div>
                                                        <CardTitle className="text-lg">Odoo Inventory Sync</CardTitle>
                                                        <CardDescription>Sync inventory and product data to Odoo</CardDescription>
                                                    </div>
                                                </div>
                                                <Badge
                                                    variant={odooConfig.isEnabled ? "default" : "secondary"}
                                                    className={cn("w-fit", odooConfig.isEnabled ? "bg-green-600 hover:bg-green-700" : "")}
                                                >
                                                    {odooConfig.isEnabled ? "Enabled" : "Disabled"}
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            {/* Enable Toggle */}
                                            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                                                <div className="space-y-0.5">
                                                    <Label htmlFor="odoo-enable" className="font-medium">Enable Odoo Sync</Label>
                                                    <p className="text-sm text-muted-foreground">
                                                        When enabled, inventory updates will automatically sync to Odoo using this channel&apos;s price list
                                                    </p>
                                                </div>
                                                <Switch
                                                    id="odoo-enable"
                                                    checked={odooConfig.isEnabled}
                                                    onCheckedChange={(checked) => setOdooConfig({ ...odooConfig, isEnabled: checked })}
                                                />
                                            </div>

                                            <Separator />

                                            {/* API Configuration */}
                                            <div className="space-y-4">
                                                <h4 className="text-sm font-medium">API Configuration</h4>
                                                <div className="grid gap-4 md:grid-cols-2">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="odoo-url">API Base URL</Label>
                                                        <Input
                                                            id="odoo-url"
                                                            placeholder="https://your-odoo-instance.odoo.com"
                                                            value={odooConfig.apiBaseUrl}
                                                            onChange={(e) => setOdooConfig({ ...odooConfig, apiBaseUrl: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="odoo-partner">Partner ID</Label>
                                                        <Input
                                                            id="odoo-partner"
                                                            placeholder="7"
                                                            value={odooConfig.partnerId}
                                                            onChange={(e) => setOdooConfig({ ...odooConfig, partnerId: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="odoo-token">API Token</Label>
                                                    <div className="flex gap-2">
                                                        <Input
                                                            id="odoo-token"
                                                            type="password"
                                                            placeholder="Enter your API token"
                                                            value={odooConfig.apiToken}
                                                            onChange={(e) => setOdooConfig({ ...odooConfig, apiToken: e.target.value })}
                                                            className="flex-1"
                                                        />
                                                        <Button
                                                            variant="outline"
                                                            onClick={handleTestOdooConnection}
                                                            disabled={odooTesting || !odooConfig.apiBaseUrl || !odooConfig.apiToken || !odooConfig.partnerId}
                                                        >
                                                            {odooTesting ? (
                                                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                                            ) : odooConnectionStatus === 'connected' ? (
                                                                <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                                                            ) : odooConnectionStatus === 'failed' ? (
                                                                <X className="mr-2 h-4 w-4 text-red-600" />
                                                            ) : (
                                                                <AlertCircle className="mr-2 h-4 w-4" />
                                                            )}
                                                            Test
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>

                                            <Separator />

                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                                <div className="p-3 border rounded-lg">
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                                        <Clock className="h-4 w-4" />
                                                        Last Sync
                                                    </div>
                                                    <p className="font-medium text-sm">
                                                        {odooConfig.lastSyncAt ? new Date(odooConfig.lastSyncAt).toLocaleString() : 'Never'}
                                                    </p>
                                                </div>
                                                <div className="p-3 border rounded-lg">
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                                        <Package className="h-4 w-4" />
                                                        Synced Variants
                                                    </div>
                                                    <p className="font-medium text-sm">{odooConfig.syncedVariants}</p>
                                                </div>
                                                <div className="p-3 border rounded-lg sm:col-span-2 md:col-span-1">
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                                        <Info className="h-4 w-4" />
                                                        Status
                                                    </div>
                                                    <p className="font-medium text-sm truncate">
                                                        {odooConfig.lastSyncStatus || 'Not synced yet'}
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                        <CardFooter className="flex flex-col sm:flex-row justify-between gap-4 border-t pt-4">
                                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                                <Button
                                                    variant="outline"
                                                    onClick={handleTriggerOdooSync}
                                                    disabled={odooSyncing || !odooConfig.isEnabled}
                                                    className="w-full sm:w-auto"
                                                >
                                                    {odooSyncing ? (
                                                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Play className="mr-2 h-4 w-4" />
                                                    )}
                                                    Sync Now
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    onClick={() => router.push(`/settings/sales-channels/${id}/odoo-logs`)}
                                                    className="w-full sm:w-auto"
                                                >
                                                    <FileText className="mr-2 h-4 w-4" />
                                                    View Logs
                                                </Button>
                                            </div>
                                            <Button onClick={handleSaveOdooConfig} disabled={odooSaving} className="w-full sm:w-auto">
                                                {odooSaving ? (
                                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Save className="mr-2 h-4 w-4" />
                                                )}
                                                Save Settings
                                            </Button>
                                        </CardFooter>
                                    </Card>

                                    {/* Help Section */}
                                    <Card className="bg-muted/30">
                                        <CardHeader>
                                            <CardTitle className="text-base">How Odoo Sync Works</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="grid gap-4 md:grid-cols-3">
                                                <div className="space-y-2">
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                                                        <span className="font-bold text-primary text-sm">1</span>
                                                    </div>
                                                    <h4 className="font-medium text-sm">Price List</h4>
                                                    <p className="text-xs text-muted-foreground">
                                                        Products sync using this channel&apos;s price list from the Pricing tab.
                                                    </p>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                                                        <span className="font-bold text-primary text-sm">2</span>
                                                    </div>
                                                    <h4 className="font-medium text-sm">Auto Sync</h4>
                                                    <p className="text-xs text-muted-foreground">
                                                        Inventory syncs automatically when orders ship or stock changes.
                                                    </p>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                                                        <span className="font-bold text-primary text-sm">3</span>
                                                    </div>
                                                    <h4 className="font-medium text-sm">Manual Sync</h4>
                                                    <p className="text-xs text-muted-foreground">
                                                        Use &quot;Sync Now&quot; to trigger a full inventory sync immediately.
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            ) : (
                                <div className="h-40 flex items-center justify-center border-2 border-dashed rounded-lg">
                                    <p className="text-muted-foreground text-sm">Failed to load integration settings.</p>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="billing" className="space-y-6 mt-6">
                            <div className="flex flex-col space-y-6">
                                {/* Top Section: Billing Settings and Summary */}
                                <div className="grid gap-6 md:grid-cols-3">
                                    {/* Billing Settings - Spans 2 cols */}
                                    <div className="md:col-span-2">
                                        <Card>
                                            <CardHeader>
                                                <div className="flex items-center gap-2">
                                                    <Settings2 className="h-4 w-4 text-primary" />
                                                    <CardTitle className="text-base">Billing Settings</CardTitle>
                                                </div>
                                                <CardDescription>Configure cycles and thresholds.</CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                {billingConfigLoading ? (
                                                    <div className="flex justify-center py-4"><RefreshCw className="h-4 w-4 animate-spin" /></div>
                                                ) : (
                                                    <div className="grid gap-4 md:grid-cols-2">
                                                        <div className="space-y-2">
                                                            <Label className="text-xs font-semibold">Billing Cycle (Days)</Label>
                                                            <Input
                                                                type="number"
                                                                value={billingConfig?.billingCycleDays || 14}
                                                                onChange={(e) => setBillingConfig({ ...billingConfig, billingCycleDays: parseInt(e.target.value) })}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs font-semibold">Balance Threshold ($)</Label>
                                                            <Input
                                                                type="number"
                                                                value={billingConfig?.balanceThreshold || ""}
                                                                onChange={(e) => setBillingConfig({ ...billingConfig, balanceThreshold: e.target.value })}
                                                                placeholder="Trigger at balance..."
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs font-semibold">Order Count Threshold</Label>
                                                            <Input
                                                                type="number"
                                                                value={billingConfig?.orderCountThreshold || ""}
                                                                onChange={(e) => setBillingConfig({ ...billingConfig, orderCountThreshold: parseInt(e.target.value) })}
                                                                placeholder="Trigger at order count..."
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs font-semibold">Escalation (Days Overdue)</Label>
                                                            <Input
                                                                type="number"
                                                                value={billingConfig?.escalationDays || 7}
                                                                onChange={(e) => setBillingConfig({ ...billingConfig, escalationDays: parseInt(e.target.value) })}
                                                            />
                                                        </div>
                                                        <div className="space-y-2 md:col-span-2">
                                                            <Label className="text-xs font-semibold">Payment Instructions</Label>
                                                            <textarea
                                                                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                                value={billingConfig?.paymentInstructions || ""}
                                                                onChange={(e) => setBillingConfig({ ...billingConfig, paymentInstructions: e.target.value })}
                                                                placeholder="Bank transfer details..."
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </CardContent>
                                            <CardFooter className="flex flex-col sm:flex-row gap-2">
                                                <Button variant="outline" className="w-full sm:w-auto flex-1" onClick={handleSaveBillingConfig} disabled={saving}>
                                                    <Save className="mr-2 h-4 w-4" /> Save Billing Settings
                                                </Button>
                                                <Button variant="default" className="w-full sm:w-auto flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleGenerateStatement} disabled={triggeringStatement}>
                                                    {triggeringStatement ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                                                    Generate Statement Now
                                                </Button>
                                            </CardFooter>
                                        </Card>
                                    </div>

                                    <div className="md:col-span-1">
                                        <Card className="bg-primary/5 border-primary/20 h-full">
                                            <CardHeader>
                                                <CardTitle className="text-sm">Summary</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-2">
                                                    {(() => {
                                                        const pendingAmount = pendingBalance; // Use backend provided balance
                                                        const isPendingCredit = pendingAmount < 0;
                                                        const isBalanceCredit = ledgerBalance < 0;

                                                        return (
                                                            <>
                                                                <div className="flex justify-between text-sm">
                                                                    <span className="text-muted-foreground">{isPendingCredit ? "Pre-payment / Credit:" : "Pending Billing:"}</span>
                                                                    <span className={cn("font-bold", isPendingCredit ? "text-green-600" : "")}>
                                                                        {formatCurrency(Math.abs(pendingAmount))}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between text-sm">
                                                                    <span className="text-muted-foreground">{isBalanceCredit ? "Total Credit:" : "Total Outstanding:"}</span>
                                                                    <span className={cn("font-bold", isBalanceCredit ? "text-green-600" : "text-primary")}>
                                                                        {formatCurrency(Math.abs(ledgerBalance))}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between text-sm">
                                                                    <span className="text-muted-foreground">Open Statements:</span>
                                                                    <span className="font-bold text-orange-600">{statements.filter(s => s.status !== 'PAID').length}</span>
                                                                </div>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>

                                {/* Bottom Section: Ledger, Statements, Payments */}
                                <div className="w-full">
                                    <Tabs defaultValue="ledger" className="w-full">
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
                                            <TabsList className="grid w-full grid-cols-2 sm:w-auto">
                                                <TabsTrigger value="ledger" className="flex items-center gap-2">
                                                    <History className="h-4 w-4" /> Ledger
                                                </TabsTrigger>
                                                <TabsTrigger value="statements" className="flex items-center gap-2">
                                                    <FileText className="h-4 w-4" /> Statements
                                                </TabsTrigger>
                                            </TabsList>

                                            <div className="flex gap-2">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" size="sm" disabled={exportingData}>
                                                            {exportingData ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                                            Export
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        <DropdownMenuItem onClick={() => handleExport('ledger', 'csv')}>
                                                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                                                            Export Ledger as CSV
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleExport('ledger', 'excel')}>
                                                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                                                            Export Ledger as Excel
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleExport('statements', 'csv')}>
                                                            <Receipt className="mr-2 h-4 w-4" />
                                                            Export Statements as CSV
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleExport('statements', 'excel')}>
                                                            <Receipt className="mr-2 h-4 w-4" />
                                                            Export Statements as Excel
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>

                                                <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                                                    <DialogTrigger asChild>
                                                        <Button size="sm" className="bg-green-600 hover:bg-green-700">
                                                            <Plus className="mr-2 h-4 w-4" /> Record Payment
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent>
                                                        <DialogHeader>
                                                            <DialogTitle>Record Partner Payment</DialogTitle>
                                                            <DialogDescription>
                                                                Payments are automatically allocated to the oldest outstanding receivables (FIFO).
                                                            </DialogDescription>
                                                        </DialogHeader>
                                                        <div className="grid gap-4 py-4">
                                                            <div className="grid gap-2">
                                                                <Label htmlFor="amount">Amount ($) <span className="text-red-500">*</span></Label>
                                                                <Input
                                                                    id="amount"
                                                                    type="number"
                                                                    value={paymentFormData.amount}
                                                                    onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
                                                                    placeholder="0.00"
                                                                />
                                                            </div>
                                                            <div className="grid gap-2">
                                                                <Label htmlFor="ref">Reference ID (Optional)</Label>
                                                                <Input
                                                                    id="ref"
                                                                    value={paymentFormData.referenceId}
                                                                    onChange={(e) => setPaymentFormData({ ...paymentFormData, referenceId: e.target.value })}
                                                                    placeholder="Transaction or Check #"
                                                                />
                                                            </div>
                                                            <div className="grid gap-2">
                                                                <Label htmlFor="desc">Description</Label>
                                                                <Input
                                                                    id="desc"
                                                                    value={paymentFormData.description}
                                                                    onChange={(e) => setPaymentFormData({ ...paymentFormData, description: e.target.value })}
                                                                />
                                                            </div>
                                                        </div>
                                                        <DialogFooter>
                                                            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>Cancel</Button>
                                                            <Button onClick={handleRecordPayment} disabled={paymentSaving}>
                                                                {paymentSaving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                                                Post Payment
                                                            </Button>
                                                        </DialogFooter>
                                                    </DialogContent>
                                                </Dialog>

                                                <AlertDialog open={confirmPayOpen} onOpenChange={setConfirmPayOpen}>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Confirm Payment</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Are you sure you want to mark this statement as PAID? This will create a payment for the full remaining amount and update the ledger.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel disabled={payingStatement}>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={(e) => {
                                                                e.preventDefault();
                                                                handleConfirmPayStatement();
                                                            }} disabled={payingStatement}>
                                                                {payingStatement ? "Processing..." : "Confirm Payment"}
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </div>

                                        <TabsContent value="ledger">
                                            <Card>
                                                <CardContent className="p-0">
                                                    <div className="overflow-x-auto">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead className="min-w-[100px]">Date</TableHead>
                                                                    <TableHead className="min-w-[100px]">Type</TableHead>
                                                                    <TableHead className="min-w-[200px]">Description</TableHead>
                                                                    <TableHead className="text-right min-w-[100px]">Debit ($)</TableHead>
                                                                    <TableHead className="text-right min-w-[100px]">Credit ($)</TableHead>
                                                                    <TableHead className="text-right min-w-[100px]">Open</TableHead>
                                                                    <TableHead className="min-w-[120px]">Status</TableHead>
                                                                    <TableHead className="text-right min-w-[120px]">Balance</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {ledgerLoading ? (
                                                                    <TableRow><TableCell colSpan={8} className="text-center py-8"><RefreshCw className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                                                                ) : ledgerEntries.length === 0 ? (
                                                                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No ledger entries found.</TableCell></TableRow>
                                                                ) : (
                                                                    (() => {
                                                                        let runningBalance = ledgerBalance;
                                                                        return ledgerEntries.map((entry) => {
                                                                            const currentRowBalance = runningBalance;
                                                                            const signedAmount = entry.type === 'RECEIVABLE' ? Number(entry.amount) : -Number(entry.amount);
                                                                            // Update for next row (which is historically previous)
                                                                            runningBalance = currentRowBalance - signedAmount;

                                                                            return (
                                                                                <TableRow key={entry.id}>
                                                                                    <TableCell className="text-xs">{new Date(entry.createdAt).toLocaleDateString()}</TableCell>
                                                                                    <TableCell>
                                                                                        <Badge variant={entry.type === 'RECEIVABLE' ? 'outline' : 'secondary'} className="text-[10px]">
                                                                                            {entry.type}
                                                                                        </Badge>
                                                                                    </TableCell>
                                                                                    <TableCell className="text-xs">
                                                                                        {entry.description}
                                                                                        {entry.statement && <div className="text-[10px] text-primary mt-1">Stmt: {entry.statement.referenceId}</div>}
                                                                                    </TableCell>
                                                                                    <TableCell className="text-right text-xs font-mono">
                                                                                        {entry.type === 'RECEIVABLE' ? (
                                                                                            formatCurrency(entry.amount)
                                                                                        ) : (
                                                                                            <span className="text-muted-foreground">-</span>
                                                                                        )}
                                                                                    </TableCell>
                                                                                    <TableCell className="text-right text-xs font-mono">
                                                                                        {entry.type === 'PAYMENT' ? (
                                                                                            <span className="text-green-600 font-bold">{formatCurrency(entry.amount)}</span>
                                                                                        ) : (
                                                                                            <span className="text-muted-foreground">-</span>
                                                                                        )}
                                                                                    </TableCell>
                                                                                    <TableCell className="text-right text-xs font-mono font-bold">
                                                                                        {formatCurrency(entry.remainingAmount)}
                                                                                    </TableCell>
                                                                                    <TableCell>
                                                                                        <Badge
                                                                                            className="text-[10px]"
                                                                                            variant={entry.status === 'PAID' ? 'default' : entry.status === 'PARTIALLY_PAID' ? 'secondary' : 'outline'}
                                                                                        >
                                                                                            {entry.status}
                                                                                        </Badge>
                                                                                    </TableCell>
                                                                                    <TableCell className={cn(
                                                                                        "text-right text-xs font-mono font-medium",
                                                                                        currentRowBalance < 0 ? "text-green-600 font-bold" : "text-gray-700"
                                                                                    )}>
                                                                                        {formatCurrency(Math.abs(currentRowBalance))}
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                            );
                                                                        });
                                                                    })()
                                                                )}
                                                            </TableBody>
                                                        </Table>
                                                    </div>

                                                    {ledgerPagination.pages > 1 && (
                                                        <div className="flex items-center justify-end p-4 border-t gap-2">
                                                            <Button
                                                                variant="outline" size="sm"
                                                                disabled={ledgerPagination.page <= 1}
                                                                onClick={() => setLedgerPagination({ ...ledgerPagination, page: ledgerPagination.page - 1 })}
                                                            >Prev</Button>
                                                            <span className="text-xs">{ledgerPagination.page} / {ledgerPagination.pages}</span>
                                                            <Button
                                                                variant="outline" size="sm"
                                                                disabled={ledgerPagination.page >= ledgerPagination.pages}
                                                                onClick={() => setLedgerPagination({ ...ledgerPagination, page: ledgerPagination.page + 1 })}
                                                            >Next</Button>
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </TabsContent>

                                        <TabsContent value="statements">
                                            <Card>
                                                <CardContent className="p-0">
                                                    <div className="overflow-x-auto">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead className="min-w-[120px]">Reference</TableHead>
                                                                    <TableHead className="min-w-[100px]">Date</TableHead>
                                                                    <TableHead className="min-w-[100px]">Due Date</TableHead>
                                                                    <TableHead className="text-right min-w-[100px]">Total</TableHead>
                                                                    <TableHead className="text-right min-w-[100px]">Paid</TableHead>
                                                                    <TableHead className="min-w-[100px]">Status</TableHead>
                                                                    <TableHead className="text-right min-w-[100px]">Actions</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {statementsLoading ? (
                                                                    <TableRow><TableCell colSpan={7} className="text-center py-8"><RefreshCw className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                                                                ) : statements.length === 0 ? (
                                                                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No statements generated.</TableCell></TableRow>
                                                                ) : (
                                                                    statements.map((stmt) => (
                                                                        <TableRow key={stmt.id}>
                                                                            <TableCell className="font-bold text-xs">{stmt.referenceId}</TableCell>
                                                                            <TableCell className="text-xs">{new Date(stmt.createdAt).toLocaleDateString()}</TableCell>
                                                                            <TableCell className="text-xs">{new Date(stmt.dueDate).toLocaleDateString()}</TableCell>
                                                                            <TableCell className="text-right text-xs font-mono">{formatCurrency(stmt.totalAmount)}</TableCell>
                                                                            <TableCell className="text-right text-xs font-mono text-green-600">{formatCurrency(stmt.paidAmount)}</TableCell>
                                                                            <TableCell>
                                                                                <Badge
                                                                                    className="text-[10px]"
                                                                                    variant={stmt.status === 'PAID' ? 'default' : stmt.status === 'OVERDUE' ? 'destructive' : 'secondary'}
                                                                                >
                                                                                    {stmt.status}
                                                                                </Badge>
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <div className="flex gap-2 justify-end">
                                                                                    {stmt.status !== 'PAID' && (
                                                                                        <Button
                                                                                            variant="outline"
                                                                                            size="sm"
                                                                                            className="h-7 text-[10px]"
                                                                                            onClick={() => handlePayClick(stmt.id)}
                                                                                            title="Mark as Paid"
                                                                                        >
                                                                                            <CreditCard className="mr-1 h-3 w-3" /> Pay
                                                                                        </Button>
                                                                                    )}
                                                                                </div>
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ))
                                                                )}
                                                            </TableBody>
                                                        </Table>
                                                    </div>

                                                    {statementsPagination.pages > 1 && (
                                                        <div className="flex items-center justify-end p-4 border-t gap-2">
                                                            <Button
                                                                variant="outline" size="sm"
                                                                disabled={statementsPagination.page <= 1}
                                                                onClick={() => setStatementsPagination({ ...statementsPagination, page: statementsPagination.page - 1 })}
                                                            >Prev</Button>
                                                            <span className="text-xs">{statementsPagination.page} / {statementsPagination.pages}</span>
                                                            <Button
                                                                variant="outline" size="sm"
                                                                disabled={statementsPagination.page >= statementsPagination.pages}
                                                                onClick={() => setStatementsPagination({ ...statementsPagination, page: statementsPagination.page + 1 })}
                                                            >Next</Button>
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </TabsContent>
                                    </Tabs>
                                </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="analytics" className="space-y-6 mt-6">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <h2 className="text-lg font-semibold">Channel Performance</h2>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Select value={dateRange} onValueChange={setDateRange}>
                                        <SelectTrigger className="w-[160px] h-9">
                                            <SelectValue placeholder="Select Range" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1d">1 Day</SelectItem>
                                            <SelectItem value="7d">Last 7 Days</SelectItem>
                                            <SelectItem value="30d">Last 30 Days</SelectItem>
                                            <SelectItem value="60d">Last 60 Days</SelectItem>
                                            <SelectItem value="6m">Last 6 Months</SelectItem>
                                            <SelectItem value="1y">Last 1 Year</SelectItem>
                                            <SelectItem value="custom">Custom Range</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    {dateRange === "1d" && (
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant={"outline"}
                                                    size="sm"
                                                    className={cn(
                                                        "w-[180px] justify-start text-left font-normal h-9",
                                                        !singleDate && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {singleDate ? format(singleDate, "PPP") : <span>Pick a date</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="end">
                                                <Calendar
                                                    mode="single"
                                                    selected={singleDate}
                                                    onSelect={setSingleDate}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    )}

                                    {dateRange === "custom" && (
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    id="date"
                                                    variant={"outline"}
                                                    size="sm"
                                                    className={cn(
                                                        "w-[240px] justify-start text-left font-normal h-9",
                                                        !customRange && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {customRange?.from ? (
                                                        customRange.to ? (
                                                            <span className="text-xs">
                                                                {format(customRange.from, "LLL dd, y")} - {format(customRange.to, "LLL dd, y")}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs">{format(customRange.from, "LLL dd, y")}</span>
                                                        )
                                                    ) : (
                                                        <span className="text-xs">Pick a date</span>
                                                    )}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="end">
                                                <Calendar
                                                    initialFocus
                                                    mode="range"
                                                    defaultMonth={customRange?.from}
                                                    selected={customRange}
                                                    onSelect={setCustomRange}
                                                    numberOfMonths={2}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    )}
                                </div>
                            </div>

                            {analyticsLoading ? (
                                <div className="h-64 flex flex-col items-center justify-center gap-4">
                                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                                    <p className="text-muted-foreground">Calculating analytics...</p>
                                </div>
                            ) : analytics ? (
                                <div className="space-y-6">
                                    {/* Stats Cards */}
                                    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
                                        <Card className="py-2 gap-0 sm:py-2.5 sm:gap-1">
                                            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 py-1 pb-0 sm:p-4 sm:pb-1">
                                                <CardTitle className="text-[10px] sm:text-sm font-medium">Total Revenue</CardTitle>
                                                <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                                            </CardHeader>
                                            <CardContent className="p-2 pt-0 pb-1 sm:p-4 sm:pt-0">
                                                <div className="text-base sm:text-2xl font-bold truncate leading-tight">
                                                    {formatCurrency(analytics.summary.totalRevenue)}
                                                </div>
                                                <div className="text-[10px] sm:text-xs text-muted-foreground sm:mt-1">
                                                    Across {dateRange === '30d' ? '30 days' : dateRange}
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card className="py-2 gap-0 sm:py-2.5 sm:gap-1">
                                            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 py-1 pb-0 sm:p-4 sm:pb-1">
                                                <CardTitle className="text-[10px] sm:text-sm font-medium">Total Orders</CardTitle>
                                                <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                                            </CardHeader>
                                            <CardContent className="p-2 pt-0 pb-1 sm:p-4 sm:pt-0">
                                                <div className="text-base sm:text-2xl font-bold truncate leading-tight">
                                                    {analytics.summary.totalOrders.toLocaleString()}
                                                </div>
                                                <div className="text-[10px] sm:text-xs text-muted-foreground sm:mt-1">
                                                    Confirmed orders
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card className="py-2 gap-0 sm:py-2.5 sm:gap-1">
                                            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 py-1 pb-0 sm:p-4 sm:pb-1">
                                                <CardTitle className="text-[10px] sm:text-sm font-medium">Average Order Value</CardTitle>
                                                <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                                            </CardHeader>
                                            <CardContent className="p-2 pt-0 pb-1 sm:p-4 sm:pt-0">
                                                <div className="text-base sm:text-2xl font-bold truncate leading-tight">
                                                    {formatCurrency(analytics.summary.avgOrderValue)}
                                                </div>
                                                <div className="text-[10px] sm:text-xs text-muted-foreground sm:mt-1">
                                                    Per transaction
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card className="py-2 gap-0 sm:py-2.5 sm:gap-1">
                                            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 py-1 pb-0 sm:p-4 sm:pb-1">
                                                <CardTitle className="text-[10px] sm:text-sm font-medium">Status Overview</CardTitle>
                                                <Users className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                                            </CardHeader>
                                            <CardContent className="p-2 pt-0 pb-1 sm:p-4 sm:pt-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Badge variant={formData.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-[10px] h-4">
                                                        {formData.status}
                                                    </Badge>
                                                </div>
                                                <div className="text-[10px] sm:text-xs text-muted-foreground truncate">
                                                    {formData.type} Channel
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* Charts */}
                                    <div className="grid gap-6 md:grid-cols-2">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle>Revenue Trend</CardTitle>
                                                <CardDescription>
                                                    {dateRange === "1d" ? "Hourly" : "Daily"} revenue {dateRange === "custom" ? "for selected period" : `over the last ${dateRange}`}
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="h-[300px]">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <AreaChart data={analytics.timeSeries}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                        <XAxis
                                                            dataKey="label"
                                                            fontSize={10}
                                                            tickFormatter={(val) => {
                                                                if (dateRange === "1d") return val;
                                                                return val.split('-').slice(1).join('/');
                                                            }}
                                                        />
                                                        <YAxis fontSize={10} tickFormatter={(val) => `$${val}`} />
                                                        <RechartsTooltip
                                                            formatter={(val: number) => [formatCurrency(val), "Revenue"]}
                                                        />
                                                        <Area type="monotone" dataKey="revenue" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.1} />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardHeader>
                                                <CardTitle>Orders Trend</CardTitle>
                                                <CardDescription>
                                                    {dateRange === "1d" ? "Hourly" : "Daily"} order volume {dateRange === "custom" ? "for selected period" : `over the last ${dateRange}`}
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="h-[300px]">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={analytics.timeSeries}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                        <XAxis
                                                            dataKey="label"
                                                            fontSize={10}
                                                            tickFormatter={(val) => {
                                                                if (dateRange === "1d") return val;
                                                                return val.split('-').slice(1).join('/');
                                                            }}
                                                        />
                                                        <YAxis fontSize={10} />
                                                        <RechartsTooltip
                                                            formatter={(val: number) => [val, "Orders"]}
                                                        />
                                                        <Bar dataKey="orders" fill="#10b981" radius={[4, 4, 0, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed rounded-lg">
                                    <TrendingUp className="h-8 w-8 text-muted-foreground mb-4" />
                                    <p className="text-muted-foreground">No analytics data available yet.</p>
                                </div>
                            )}
                        </TabsContent>

                        {/* ── Shipping Tiers Tab ── */}
                        <TabsContent value="shipping-tiers" className="space-y-6 mt-6">
                            <Card>
                                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4">
                                    <div className="min-w-0">
                                        <CardTitle className="flex items-center gap-2">
                                            <Truck className="h-5 w-5" />
                                            Shipping Tiers
                                        </CardTitle>
                                        <CardDescription className="mt-1">
                                            Configure shipping rates for this sales channel based on order subtotal ranges.
                                        </CardDescription>
                                    </div>
                                    <Button onClick={openCreateTierDialog} size="sm" className="w-full sm:w-auto">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Tier
                                    </Button>
                                </CardHeader>
                                <CardContent className="p-0 sm:p-6">
                                    {shippingTiersLoading ? (
                                        <div className="flex items-center justify-center p-8">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                                        </div>
                                    ) : shippingTiers.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center p-10 text-center border-2 border-dashed rounded-lg">
                                            <Truck className="h-10 w-10 text-muted-foreground mb-4" />
                                            <h3 className="text-lg font-medium">No shipping tiers configured</h3>
                                            <p className="text-muted-foreground text-sm mt-1">
                                                Add your first tier to enable automatic shipping fee calculation for orders from this channel.
                                            </p>
                                            <Button className="mt-4" onClick={openCreateTierDialog}>
                                                <Plus className="h-4 w-4 mr-2" />
                                                Add First Tier
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="min-w-[150px]">Unique Tier ID</TableHead>
                                                        <TableHead className="min-w-[180px]">Name</TableHead>
                                                        <TableHead className="min-w-[180px]">Subtotal Range</TableHead>
                                                        <TableHead className="min-w-[120px]">Shipping Rate</TableHead>
                                                        <TableHead className="min-w-[120px]">Service</TableHead>
                                                        <TableHead className="min-w-[100px]">Status</TableHead>
                                                        <TableHead className="text-right min-w-[100px]">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {shippingTiers.map((tier) => (
                                                        <TableRow key={tier.id}>
                                                            <TableCell>
                                                                {tier.uniqueTierId ? (
                                                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{tier.uniqueTierId}</code>
                                                                ) : (
                                                                    <span className="text-muted-foreground text-xs">—</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="font-medium">{tier.name}</TableCell>
                                                            <TableCell>
                                                                {formatCurrency(Number(tier.minSubtotal))} –{' '}
                                                                {tier.maxSubtotal != null ? formatCurrency(Number(tier.maxSubtotal)) : '∞'}
                                                            </TableCell>
                                                            <TableCell>
                                                                {Number(tier.shippingRate) === 0 ? (
                                                                    <Badge className="bg-green-500 hover:bg-green-600">Free</Badge>
                                                                ) : (
                                                                    formatCurrency(Number(tier.shippingRate))
                                                                )}
                                                            </TableCell>
                                                            <TableCell>{tier.serviceName || <span className="text-muted-foreground">Standard</span>}</TableCell>
                                                            <TableCell>
                                                                <Badge className={tier.isActive ? 'bg-green-500 hover:bg-green-600' : 'bg-muted text-muted-foreground'}>
                                                                    {tier.isActive ? 'Active' : 'Inactive'}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex justify-end gap-1">
                                                                    <Button variant="ghost" size="sm" onClick={() => openEditTierDialog(tier)}>
                                                                        <Edit className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="text-destructive hover:text-destructive"
                                                                        onClick={() => setDeletingTier(tier)}
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                    </Tabs>

                    {/* ── Shipping Tier Create/Edit Dialog ── */}
                    <Dialog open={tierDialogOpen} onOpenChange={setTierDialogOpen}>
                        <DialogContent className="sm:max-w-[480px]">
                            <DialogHeader>
                                <DialogTitle>{editingTier ? 'Edit Shipping Tier' : 'Add Shipping Tier'}</DialogTitle>
                                <DialogDescription>
                                    {editingTier
                                        ? 'Update the shipping tier details below.'
                                        : 'Create a new shipping tier with a price range and rate for this channel.'}
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleSaveTier}>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="tier-uniqueTierId">Unique Tier ID <span className="text-muted-foreground text-xs">(optional, e.g. 1_DAY, STANDARD)</span></Label>
                                        <Input
                                            id="tier-uniqueTierId"
                                            placeholder="e.g. 1_DAY, 2_DAY, STANDARD"
                                            value={tierForm.uniqueTierId}
                                            onChange={(e) => setTierForm({ ...tierForm, uniqueTierId: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="tier-name">Tier Name</Label>
                                        <Input
                                            id="tier-name"
                                            placeholder="e.g. 1-Day Express, Standard Shipping"
                                            value={tierForm.name}
                                            onChange={(e) => setTierForm({ ...tierForm, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="tier-minSubtotal">Min Subtotal ($)</Label>
                                            <Input
                                                id="tier-minSubtotal"
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                placeholder="0.00"
                                                value={tierForm.minSubtotal}
                                                onChange={(e) => setTierForm({ ...tierForm, minSubtotal: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="tier-maxSubtotal">Max Subtotal ($)</Label>
                                            <Input
                                                id="tier-maxSubtotal"
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                placeholder="Leave empty for ∞"
                                                value={tierForm.maxSubtotal}
                                                onChange={(e) => setTierForm({ ...tierForm, maxSubtotal: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="tier-shippingRate">Shipping Rate ($)</Label>
                                        <Input
                                            id="tier-shippingRate"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="0.00 for free shipping"
                                            value={tierForm.shippingRate}
                                            onChange={(e) => setTierForm({ ...tierForm, shippingRate: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="tier-serviceName">Service Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
                                        <Input
                                            id="tier-serviceName"
                                            placeholder="e.g. Overnight, Ground, 2-Day"
                                            value={tierForm.serviceName}
                                            onChange={(e) => setTierForm({ ...tierForm, serviceName: e.target.value })}
                                        />
                                    </div>
                                    {editingTier && (
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="tier-isActive">Active</Label>
                                            <Switch
                                                id="tier-isActive"
                                                checked={tierForm.isActive}
                                                onCheckedChange={(checked) => setTierForm({ ...tierForm, isActive: checked })}
                                            />
                                        </div>
                                    )}
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setTierDialogOpen(false)}>Cancel</Button>
                                    <Button type="submit" disabled={tierSaving}>
                                        {tierSaving ? 'Saving...' : editingTier ? 'Update Tier' : 'Create Tier'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>

                    {/* ── Delete Tier Confirmation ── */}
                    <AlertDialog open={!!deletingTier} onOpenChange={(open) => !open && setDeletingTier(null)}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete Shipping Tier</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Are you sure you want to delete <strong>{deletingTier?.name}</strong>? This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleDeleteTier}
                                    disabled={tierDeleting}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                    {tierDeleting ? 'Deleting...' : 'Delete'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
