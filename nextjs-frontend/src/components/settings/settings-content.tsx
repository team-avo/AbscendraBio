"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Settings,
    Store,
    CreditCard,
    Truck,
    Users,
    Bell,
    Shield,
    Mail,
    Globe,
    Download,
    Upload,
    Save,
    Plus,
    Edit,
    Trash2
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { TaxRateDialog } from "./tax-rate-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { Country, State, City } from 'country-state-city';
import logger from '@/lib/logger';
import { AuditSettings } from './audit-settings';
import { MapPin, Eye, EyeOff } from 'lucide-react';

export function SettingsContent() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState("general");
    // Tax rates state
    const [taxRates, setTaxRates] = useState<any[]>([]);
    const [taxLoading, setTaxLoading] = useState(false);

    // Google Places integration state
    const [googlePlacesEnabled, setGooglePlacesEnabled] = useState(false);
    const [googlePlacesApiKey, setGooglePlacesApiKey] = useState('');
    const [googlePlacesLoading, setGooglePlacesLoading] = useState(false);
    const [googlePlacesSaving, setGooglePlacesSaving] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [showTaxDialog, setShowTaxDialog] = useState(false);
    const [editingTax, setEditingTax] = useState(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [taxToDelete, setTaxToDelete] = useState<string | null>(null);

    // Add state and effect to fetch email templates
    const [emailTemplates, setEmailTemplates] = useState<any[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [deleteTemplateDialogOpen, setDeleteTemplateDialogOpen] = useState(false);
    const [templateToDelete, setTemplateToDelete] = useState<any>(null);

    // Store information state
    const [storeInfo, setStoreInfo] = useState<any>(null);
    const [storeLoading, setStoreLoading] = useState(false);
    const [storeSaving, setStoreSaving] = useState(false);
    const [logoUploading, setLogoUploading] = useState(false);

    // Country/State/City selections for Store Address
    const [storeCountry, setStoreCountry] = useState('US');
    const [storeState, setStoreState] = useState('');
    const [storeCity, setStoreCity] = useState('');

    // Country/State/City data
    const countries = Country.getAllCountries();
    const storeStates = storeCountry ? State.getStatesOfCountry(storeCountry) : [];
    const storeCities = storeCountry && storeState ? City.getCitiesOfState(storeCountry, storeState) : [];

    // Fetch tax rates from backend
    const fetchTaxRates = async () => {
        setTaxLoading(true);
        try {
            const res = await api.get("/tax-rates");
            logger.info("[Settings] /tax-rates response:", { data: res });
            if (res.success) setTaxRates(res.data);
            else {
                toast.error("Failed to load tax rates");
                logger.error("[Settings] Failed to load tax rates:", { error: res.error });
            }
        } catch (e) {
            toast.error("Failed to load tax rates");
            logger.error("[Settings] Exception while loading tax rates:", { error: e });
        } finally {
            setTaxLoading(false);
        }
    };

    const fetchEmailTemplates = async () => {
        setTemplatesLoading(true);
        try {
            const res = await api.get("/email-templates");
            if (res.success) setEmailTemplates(res.data || []);
            else setEmailTemplates([]);
        } catch (e) {
            setEmailTemplates([]);
        } finally {
            setTemplatesLoading(false);
        }
    };

    // Fetch store information
    const fetchStoreInfo = async () => {
        setStoreLoading(true);
        try {
            const res = await api.get("/settings/store/info");
            if (res.success) {
                setStoreInfo(res.data);

                // Initialize country/state/city selections
                if (res.data.country) {
                    setStoreCountry(res.data.country);
                }
                if (res.data.state) {
                    setStoreState(res.data.state);
                }
                if (res.data.city) {
                    setStoreCity(res.data.city);
                }
            } else {
                toast.error("Failed to load store information");
            }
        } catch (e) {
            toast.error("Failed to load store information");
            logger.error("Error fetching store info:", { error: e });
        } finally {
            setStoreLoading(false);
        }
    };

    // Save store information
    const saveStoreInfo = async (data: any) => {
        setStoreSaving(true);
        try {
            // Include country/state/city selections in the data
            const dataWithSelections = {
                ...data,
                country: storeCountry,
                state: storeState,
                city: storeCity,
            };

            const res = await api.put("/settings/store/info", dataWithSelections);
            if (res.success) {
                setStoreInfo(res.data);
                toast.success("Store information updated successfully");
            } else {
                toast.error(res.error || "Failed to update store information");
            }
        } catch (e: any) {
            toast.error(e.response?.data?.error || "Failed to update store information");
            logger.error("Error saving store info:", { error: e });
        } finally {
            setStoreSaving(false);
        }
    };

    // Upload logo
    const uploadLogo = async (file: File) => {
        setLogoUploading(true);
        try {
            // Validate file size (2MB max)
            if (file.size > 2 * 1024 * 1024) {
                toast.error("File size must be less than 2MB");
                setLogoUploading(false);
                return;
            }

            // Validate file type
            const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
            if (!allowedTypes.includes(file.type)) {
                toast.error("Only JPG, PNG, SVG, and WebP images are allowed");
                setLogoUploading(false);
                return;
            }

            // Create FormData and upload file
            const formData = new FormData();
            formData.append('logo', file);

            logger.info('[Settings] Uploading logo file:', { data: { name: file.name, size: file.size, type: file.type } });

            const res = await api.postFormData("/settings/store/logo/upload", formData);
            if (res.success) {
                setStoreInfo(res.data);
                toast.success("Logo uploaded successfully");
                logger.info('[Settings] Logo uploaded successfully:', { data: res.data.logoUrl });
            } else {
                toast.error(res.error || "Failed to update logo");
            }
        } catch (e: any) {
            toast.error(e.response?.data?.error || "Failed to update logo");
            logger.error("Error uploading logo:", { error: e });
        } finally {
            setLogoUploading(false);
        }
    };

    // Fetch Google Places config
    const fetchGooglePlacesConfig = async () => {
        setGooglePlacesLoading(true);
        try {
            const res = await api.getGooglePlacesConfig();
            if (res.success && res.data) {
                setGooglePlacesEnabled(res.data.enabled);
                setGooglePlacesApiKey(res.data.apiKey || '');
            }
        } catch (e) {
            logger.error('Error fetching Google Places config:', { error: e });
        } finally {
            setGooglePlacesLoading(false);
        }
    };

    // Save Google Places config
    const saveGooglePlacesConfig = async () => {
        // Validate API key format when enabled (Google Places keys start with "AIza")
        if (googlePlacesEnabled && googlePlacesApiKey) {
            if (!googlePlacesApiKey.startsWith('AIza') || googlePlacesApiKey.length < 30) {
                toast.error('Invalid Google Places API key format. Keys should start with "AIza".');
                return;
            }
        }
        if (googlePlacesEnabled && !googlePlacesApiKey.trim()) {
            toast.error('Please enter a Google Places API key before enabling.');
            return;
        }
        setGooglePlacesSaving(true);
        try {
            const res = await api.updateGooglePlacesConfig({
                enabled: googlePlacesEnabled,
                apiKey: googlePlacesApiKey || null
            });
            if (res.success) {
                toast.success('Google Places settings saved');
            } else {
                toast.error(res.error || 'Failed to save Google Places settings');
            }
        } catch (e: any) {
            toast.error(e.response?.data?.error || 'Failed to save Google Places settings');
            logger.error('Error saving Google Places config:', { error: e });
        } finally {
            setGooglePlacesSaving(false);
        }
    };

    useEffect(() => {
        fetchTaxRates();
        fetchEmailTemplates();
        fetchStoreInfo();
        fetchGooglePlacesConfig();
    }, []);

    useEffect(() => { fetchEmailTemplates(); }, []);

    // Add/Edit/Delete handlers
    const handleAddTax = () => { setEditingTax(null); setShowTaxDialog(true); };
    const handleEditTax = (tax: any) => { setEditingTax(tax); setShowTaxDialog(true); };

    // Email template handlers
    const handleAddEmailTemplate = () => {
        logger.info("Navigate to email templates page");
        router.push("/settings/email-templates");
    };
    const handleEditEmailTemplate = (template: any) => {
        logger.info("Navigate to email templates page with template:", { data: template });
        router.push(`/settings/email-templates/${template.type}/edit`);
    };

    const handleDeleteEmailTemplate = (template: any) => {
        setTemplateToDelete(template);
        setDeleteTemplateDialogOpen(true);
    };

    const confirmDeleteTemplate = async () => {
        if (!templateToDelete) return;

        try {
            const response = await api.delete(`/email-templates/${templateToDelete.id}`);
            if (response.success) {
                toast.success("Email template deleted successfully");
                fetchEmailTemplates(); // Refresh the list
            } else {
                toast.error(response.error || "Failed to delete email template");
            }
        } catch (error: any) {
            logger.error("Error deleting template:", { error: error });
            if (error.response?.data?.error === 'Validation failed' && error.response?.data?.details) {
                const errorMessages = error.response.data.details.map((detail: any) => `${detail.field}: ${detail.message}`).join(', ');
                toast.error(`Validation failed: ${errorMessages}`);
            } else {
                toast.error(error.response?.data?.error || "Failed to delete email template");
            }
        } finally {
            setDeleteTemplateDialogOpen(false);
            setTemplateToDelete(null);
        }
    };

    const cancelDeleteTemplate = () => {
        setDeleteTemplateDialogOpen(false);
        setTemplateToDelete(null);
    };
    const handleDeleteTax = async (id: string) => {
        setTaxToDelete(id);
        setDeleteDialogOpen(true);
    };

    const confirmDeleteTax = async () => {
        if (!taxToDelete) return;
        try {
            await api.delete(`/tax-rates/${taxToDelete}`);
            toast.success("Tax rate deleted");
            fetchTaxRates();
        } catch (e) {
            toast.error("Failed to delete tax rate");
        } finally {
            setDeleteDialogOpen(false);
            setTaxToDelete(null);
        }
    };

    const cancelDeleteTax = () => {
        setDeleteDialogOpen(false);
        setTaxToDelete(null);
    };

    return (
        <div className="space-y-0">

            {/* ════════ DARK HERO STRIP ════════ */}
            <div className="relative bg-mist border border-line border-t-2 border-t-[#5A9ADA] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#5A9ADA]/8 rounded-full blur-[100px] pointer-events-none" />

                <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-xl font-black text-[#043061] tracking-tight">Settings</h1>
                            <p className="text-xs text-gray-500 mt-0.5">Manage your store configuration and preferences</p>
                        </div>
                        <div className="flex items-center gap-2.5 bg-white border border-line rounded-xl px-4 py-2">
                            <Settings className="h-4 w-4 text-[#5A9ADA]" />
                            <div>
                                <p className="text-[9px] text-gray-500 font-medium uppercase tracking-widest leading-none">Config</p>
                                <p className="text-xs font-black text-white leading-tight">Store Settings</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Settings Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-4">
                <div className="w-full overflow-x-auto no-scrollbar pb-1">
                    <TabsList className="inline-flex w-full sm:w-auto h-10 sm:h-11 p-1 bg-muted/50 border">
                        <TabsTrigger value="general" className="px-4 py-1.5 text-xs sm:text-sm whitespace-nowrap">General</TabsTrigger>
                        <TabsTrigger value="taxes" className="px-4 py-1.5 text-xs sm:text-sm whitespace-nowrap">Taxes</TabsTrigger>
                        <TabsTrigger value="notifications" className="px-4 py-1.5 text-xs sm:text-sm whitespace-nowrap">Notifications</TabsTrigger>
                        <TabsTrigger value="integrations" className="px-4 py-1.5 text-xs sm:text-sm whitespace-nowrap">Integrations</TabsTrigger>
                        <TabsTrigger value="audit" className="px-4 py-1.5 text-xs sm:text-sm whitespace-nowrap">Audit</TabsTrigger>
                    </TabsList>
                </div>

                {/* General Settings */}
                <TabsContent value="general" className="space-y-4 sm:space-y-4 mt-4">
                    {storeLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-muted-foreground animate-pulse">Loading store information...</div>
                        </div>
                    ) : (
                        <>
                            <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
                                <Card className="shadow-sm border-muted-foreground/10">
                                    <CardHeader className="p-4 sm:p-5 pb-2 sm:pb-3 border-b">
                                        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                                            <Store className="h-5 w-5 text-primary" />
                                            Store Information
                                        </CardTitle>
                                        <CardDescription className="text-xs sm:text-sm">
                                            Basic information about your store
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-4 sm:p-5 space-y-3">
                                        <div className="grid gap-2">
                                            <Label htmlFor="store-name">Store Name</Label>
                                            <Input
                                                id="store-name"
                                                type="text"
                                                value={storeInfo?.name || ''}
                                                onChange={(e) => setStoreInfo({ ...storeInfo, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="store-description">Description</Label>
                                            <Textarea
                                                id="store-description"
                                                value={storeInfo?.description || ''}
                                                onChange={(e) => setStoreInfo({ ...storeInfo, description: e.target.value })}
                                                rows={3}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="store-email">Contact Email</Label>
                                            <Input
                                                id="store-email"
                                                type="email"
                                                value={storeInfo?.email || ''}
                                                onChange={(e) => setStoreInfo({ ...storeInfo, email: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="store-phone">Phone Number</Label>
                                            <Input
                                                id="store-phone"
                                                type="text"
                                                value={storeInfo?.phone || ''}
                                                onChange={(e) => setStoreInfo({ ...storeInfo, phone: e.target.value })}
                                                placeholder="Enter phone number"
                                            />
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="shadow-sm border-muted-foreground/10">
                                    <CardHeader className="p-4 sm:p-5 pb-2 sm:pb-3 border-b">
                                        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                                            <Globe className="h-5 w-5 text-primary" />
                                            Store Address
                                        </CardTitle>
                                        <CardDescription className="text-xs sm:text-sm">
                                            Your business address and location
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-4 sm:p-5 space-y-3">
                                        <div className="grid gap-2">
                                            <Label htmlFor="address-line1">Address Line 1</Label>
                                            <Input
                                                id="address-line1"
                                                type="text"
                                                value={storeInfo?.addressLine1 || ''}
                                                onChange={(e) => setStoreInfo({ ...storeInfo, addressLine1: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="address-line2">Address Line 2</Label>
                                            <Input
                                                id="address-line2"
                                                type="text"
                                                value={storeInfo?.addressLine2 || ''}
                                                onChange={(e) => setStoreInfo({ ...storeInfo, addressLine2: e.target.value })}
                                                placeholder="Suite, apartment, etc."
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
                                            <div className="grid gap-2">
                                                <Label htmlFor="country" className="text-xs sm:text-sm">Country</Label>
                                                <Select
                                                    value={storeCountry}
                                                    onValueChange={(value) => {
                                                        setStoreCountry(value);
                                                        setStoreState('');
                                                        setStoreCity('');
                                                        setStoreInfo({ ...storeInfo, country: value, state: '', city: '' });
                                                    }}
                                                >
                                                    <SelectTrigger className="w-full h-9 sm:h-10">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="max-h-60">
                                                        {countries.map((country) => (
                                                            <SelectItem key={country.isoCode} value={country.isoCode}>
                                                                {country.flag} {country.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="grid gap-2">
                                                <Label htmlFor="state" className="text-xs sm:text-sm">State</Label>
                                                <Select
                                                    value={storeState}
                                                    onValueChange={(value) => {
                                                        setStoreState(value);
                                                        setStoreCity('');
                                                        const state = storeStates.find(s => s.isoCode === value);
                                                        setStoreInfo({ ...storeInfo, state: state?.name || value, city: '' });
                                                    }}
                                                    disabled={storeStates.length === 0}
                                                >
                                                    <SelectTrigger className="w-full h-9 sm:h-10">
                                                        <SelectValue placeholder={storeStates.length === 0 ? "Select country..." : "Select state"} />
                                                    </SelectTrigger>
                                                    <SelectContent className="max-h-60">
                                                        {storeStates.map((state) => (
                                                            <SelectItem key={state.isoCode} value={state.isoCode}>
                                                                {state.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="grid gap-2">
                                                <Label htmlFor="city" className="text-xs sm:text-sm">City</Label>
                                                <Select
                                                    value={storeCity}
                                                    onValueChange={(value) => {
                                                        setStoreCity(value);
                                                        setStoreInfo({ ...storeInfo, city: value });
                                                    }}
                                                    disabled={storeCities.length === 0}
                                                >
                                                    <SelectTrigger className="w-full h-9 sm:h-10">
                                                        <SelectValue placeholder={storeCities.length === 0 ? "Select state..." : "Select city"} />
                                                    </SelectTrigger>
                                                    <SelectContent className="max-h-60">
                                                        {storeCities.map((city) => (
                                                            <SelectItem key={city.name} value={city.name}>
                                                                {city.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="zip">ZIP Code</Label>
                                            <Input
                                                id="zip"
                                                type="text"
                                                value={storeInfo?.postalCode || ''}
                                                onChange={(e) => setStoreInfo({ ...storeInfo, postalCode: e.target.value })}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card className="shadow-sm border-muted-foreground/10 mt-4 sm:mt-4">
                                <CardHeader className="p-4 sm:p-5 pb-2 sm:pb-3 border-b">
                                    <CardTitle className="text-lg sm:text-xl">Store Logo</CardTitle>
                                    <CardDescription className="text-xs sm:text-sm">
                                        Upload your store logo (recommended size: 200x200px)
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-4 sm:p-5">
                                    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-center sm:text-left">
                                        <Avatar className="h-16 w-16 sm:h-20 sm:w-20 ring-2 ring-primary/10">
                                            <AvatarImage src="/logo.png" alt="Store Logo" />
                                            <AvatarFallback>CR</AvatarFallback>
                                        </Avatar>
                                        <div className="space-y-2 flex-1">
                                            <input
                                                type="file"
                                                id="logo-upload"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        uploadLogo(file);
                                                    }
                                                }}
                                            />
                                            <Button
                                                variant="outline"
                                                onClick={() => document.getElementById('logo-upload')?.click()}
                                                disabled={logoUploading}
                                                className="w-full sm:w-auto h-9 sm:h-10"
                                            >
                                                <Upload className="h-4 w-4 mr-2" />
                                                {logoUploading ? 'Uploading...' : 'Upload New Logo'}
                                            </Button>
                                            <p className="text-[10px] sm:text-xs text-muted-foreground">
                                                JPG, PNG, or SVG. Max file size 2MB.
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="shadow-sm border-muted-foreground/10 mt-4 sm:mt-4 cursor-pointer transition-all hover:shadow-md hover:border-primary/50" onClick={() => router.push('/settings/sales-channels')}>
                                <CardHeader className="p-4 sm:p-5 pb-2 sm:pb-3 border-b">
                                    <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                                        <Globe className="h-5 w-5 text-primary" />
                                        Sales Channels
                                    </CardTitle>
                                    <CardDescription className="text-xs sm:text-sm">
                                        Manage channel partners, pricing, and integrations (Odoo sync)
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-4 sm:p-5">
                                    <Button variant="outline" className="w-full h-10 sm:h-11">
                                        Manage Sales Channels
                                    </Button>
                                </CardContent>
                            </Card>

                            <div className="flex justify-end pt-4 sm:pt-4">
                                <Button
                                    onClick={() => saveStoreInfo(storeInfo)}
                                    disabled={storeSaving}
                                    className="w-full sm:w-auto h-10 sm:h-11 px-6 shadow-sm"
                                >
                                    <Save className="h-4 w-4 mr-2" />
                                    {storeSaving ? 'Saving...' : 'Save Store Information'}
                                </Button>
                            </div>
                        </>
                    )}
                </TabsContent>

                {/* Payment Settings */}
                <TabsContent value="payments" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CreditCard className="h-5 w-5" />
                                Payment Gateways
                            </CardTitle>
                            <CardDescription>
                                Configure payment methods for your store
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6">
                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-6 bg-blue-600 rounded flex items-center justify-center">
                                            <span className="text-white text-xs font-bold">S</span>
                                        </div>
                                        <div>
                                            <h4 className="font-medium">Stripe</h4>
                                            <p className="text-sm text-muted-foreground">Accept credit cards and digital payments</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="default">Active</Badge>
                                        <Switch defaultChecked />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-6 bg-blue-500 rounded flex items-center justify-center">
                                            <span className="text-white text-xs font-bold">PP</span>
                                        </div>
                                        <div>
                                            <h4 className="font-medium">PayPal</h4>
                                            <p className="text-sm text-muted-foreground">PayPal payments and digital wallet</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline">Inactive</Badge>
                                        <Switch />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-6 bg-green-600 rounded flex items-center justify-center">
                                            <span className="text-white text-xs font-bold">$</span>
                                        </div>
                                        <div>
                                            <h4 className="font-medium">Bank Transfer</h4>
                                            <p className="text-sm text-muted-foreground">Direct bank transfer for large orders</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="default">Active</Badge>
                                        <Switch defaultChecked />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid gap-6 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Stripe Configuration</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="stripe-public">Publishable Key</Label>
                                    <Input id="stripe-public" placeholder="pk_test_..." type="password" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="stripe-secret">Secret Key</Label>
                                    <Input id="stripe-secret" placeholder="sk_test_..." type="password" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="stripe-webhook">Webhook Endpoint</Label>
                                    <Input id="stripe-webhook" placeholder="whsec_..." type="password" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Payment Settings</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="currency">Default Currency</Label>
                                    <Select defaultValue="USD">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="USD">USD - US Dollar</SelectItem>
                                            <SelectItem value="EUR">EUR - Euro</SelectItem>
                                            <SelectItem value="GBP">GBP - British Pound</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label>Capture payments immediately</Label>
                                        <p className="text-sm text-muted-foreground">Charge customers when order is placed</p>
                                    </div>
                                    <Switch defaultChecked />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label>Enable test mode</Label>
                                        <p className="text-sm text-muted-foreground">Use test API keys for development</p>
                                    </div>
                                    <Switch />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Shipping Settings */}
                <TabsContent value="shipping" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Truck className="h-5 w-5" />
                                Shipping Zones
                            </CardTitle>
                            <CardDescription>
                                Configure shipping rates for different regions
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div>
                                        <h4 className="font-medium">United States</h4>
                                        <p className="text-sm text-muted-foreground">Free shipping over $100</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm">
                                            <Edit className="h-3 w-3" />
                                        </Button>
                                        <Button variant="outline" size="sm">
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div>
                                        <h4 className="font-medium">Canada</h4>
                                        <p className="text-sm text-muted-foreground">$15.00 flat rate</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm">
                                            <Edit className="h-3 w-3" />
                                        </Button>
                                        <Button variant="outline" size="sm">
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                                <Button variant="outline" className="w-full">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Shipping Zone
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid gap-6 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Shipping Options</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label>Enable real-time rates</Label>
                                        <p className="text-sm text-muted-foreground">Calculate shipping costs from carriers</p>
                                    </div>
                                    <Switch defaultChecked />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label>Require signature</Label>
                                        <p className="text-sm text-muted-foreground">For orders over certain amount</p>
                                    </div>
                                    <Switch />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="signature-threshold">Signature threshold</Label>
                                    <Input id="signature-threshold" placeholder="$500.00" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Package Settings</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="default-weight">Default Package Weight (lbs)</Label>
                                    <Input id="default-weight" defaultValue="1.0" />
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="package-length">Length (in)</Label>
                                        <Input id="package-length" defaultValue="10" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="package-width">Width (in)</Label>
                                        <Input id="package-width" defaultValue="8" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="package-height">Height (in)</Label>
                                        <Input id="package-height" defaultValue="6" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Tax Settings */}
                <TabsContent value="taxes" className="space-y-4 sm:space-y-4 mt-4">
                    <Card className="shadow-sm border-muted-foreground/10">
                        <CardHeader className="p-4 sm:p-5 pb-2 sm:pb-3 border-b">
                            <CardTitle className="text-lg sm:text-xl">Tax Configuration</CardTitle>
                            <CardDescription className="text-xs sm:text-sm">
                                Configure tax rates and rules for your store
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label>Enable taxes</Label>
                                    <p className="text-sm text-muted-foreground">Charge taxes on orders</p>
                                </div>
                                <Switch defaultChecked />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label>Prices include tax</Label>
                                    <p className="text-sm text-muted-foreground">Display prices with tax included</p>
                                </div>
                                <Switch />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="tax-calculation">Tax calculation method</Label>
                                <Select defaultValue="destination">
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="destination">Based on shipping address</SelectItem>
                                        <SelectItem value="origin">Based on store address</SelectItem>
                                        <SelectItem value="billing">Based on billing address</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tax Rates Table */}
                    <Card className="shadow-sm border-muted-foreground/10">
                        <CardHeader className="p-4 sm:p-5 pb-2 sm:pb-3 border-b">
                            <CardTitle className="text-lg sm:text-xl">Tax Rates</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-5">
                            <div className="rounded-xl border border-gray-200 overflow-hidden -mx-2 sm:mx-0">
                                <Table className="min-w-[700px]">
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="font-semibold px-4 py-3">Country</TableHead>
                                            <TableHead className="font-semibold px-4 py-3">State</TableHead>
                                            <TableHead className="font-semibold px-4 py-3 text-center">Rate (%)</TableHead>
                                            <TableHead className="font-semibold px-4 py-3">Type</TableHead>
                                            <TableHead className="font-semibold px-4 py-3 text-center">Status</TableHead>
                                            <TableHead className="font-semibold px-4 py-3 text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {taxLoading ? (
                                            <TableRow><TableCell colSpan={6} className="text-center py-6">Loading...</TableCell></TableRow>
                                        ) : taxRates.length === 0 ? (
                                            <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No tax rates found.</TableCell></TableRow>
                                        ) : taxRates.filter((tax: any) => tax.isActive).length === 0 ? (
                                            <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No active tax rates found.</TableCell></TableRow>
                                        ) : taxRates.filter((tax: any) => tax.isActive).map((tax: any) => (
                                            <TableRow key={tax.id} className="hover:bg-muted/30 transition-colors">
                                                <TableCell className="px-4 py-3">{tax.country}</TableCell>
                                                <TableCell className="px-4 py-3">{tax.state || '-'}</TableCell>
                                                <TableCell className="px-4 py-3 text-center">{tax.rate}</TableCell>
                                                <TableCell className="px-4 py-3">{tax.type}</TableCell>
                                                <TableCell className="px-4 py-3 text-center">
                                                    <Badge variant={tax.isActive ? "default" : "secondary"} className="font-medium">
                                                        {tax.isActive ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button variant="outline" size="sm" onClick={() => handleEditTax(tax)} className="h-8">Edit</Button>
                                                        <Button variant="outline" size="sm" onClick={() => handleDeleteTax(tax.id)} className="h-8 text-destructive hover:text-destructive">Delete</Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            <Button className="mt-4 w-full sm:w-auto h-9 sm:h-10" onClick={handleAddTax}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Tax Rate
                            </Button>
                        </CardContent>
                    </Card>
                    {/* Tax Rate Dialog (Add/Edit) */}
                    {showTaxDialog && (
                        <TaxRateDialog
                            open={showTaxDialog}
                            onClose={() => setShowTaxDialog(false)}
                            onSuccess={() => { setShowTaxDialog(false); fetchTaxRates(); }}
                            tax={editingTax}
                        />
                    )}


                </TabsContent>

                {/* Notification Settings */}
                <TabsContent value="notifications" className="space-y-4 sm:space-y-4 mt-4">
                    <Card className="shadow-sm border-muted-foreground/10">
                        <CardHeader className="p-4 sm:p-5 pb-2 sm:pb-3 border-b">
                            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                                <Bell className="h-5 w-5 text-primary" />
                                Email Notifications
                            </CardTitle>
                            <CardDescription className="text-xs sm:text-sm">
                                Configure when to send email notifications
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-5 space-y-3">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex-1">
                                    <Label className="text-sm sm:text-base">Order confirmations</Label>
                                    <p className="text-xs sm:text-sm text-muted-foreground">Send when order is placed</p>
                                </div>
                                <Switch defaultChecked />
                            </div>
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex-1">
                                    <Label className="text-sm sm:text-base">Shipping notifications</Label>
                                    <p className="text-xs sm:text-sm text-muted-foreground">Send when order ships</p>
                                </div>
                                <Switch defaultChecked />
                            </div>
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex-1">
                                    <Label className="text-sm sm:text-base">Low stock alerts</Label>
                                    <p className="text-xs sm:text-sm text-muted-foreground">Send when inventory is low</p>
                                </div>
                                <Switch defaultChecked />
                            </div>
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex-1">
                                    <Label className="text-sm sm:text-base">New customer welcome</Label>
                                    <p className="text-xs sm:text-sm text-muted-foreground">Send welcome email to new customers</p>
                                </div>
                                <Switch defaultChecked />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm border-muted-foreground/10">
                        <CardHeader className="p-4 sm:p-5 pb-2 sm:pb-3 border-b">
                            <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-lg sm:text-xl">
                                Email Templates
                                <Button onClick={handleAddEmailTemplate} size="sm" className="w-full sm:w-auto">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Manage Templates
                                </Button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-5">
                            {templatesLoading ? (
                                <div className="text-center py-4">
                                    <p className="text-muted-foreground">Loading templates...</p>
                                </div>
                            ) : emailTemplates.length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-muted-foreground mb-4">No email templates configured</p>
                                    <Button onClick={handleAddEmailTemplate} variant="outline">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Create First Template
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {emailTemplates.map((template) => (
                                        <div key={template.id} className="p-3 border rounded-lg hover:bg-muted/50 dark:hover:bg-muted/20 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center flex-wrap gap-2">
                                                    <h4 className="font-medium text-sm truncate">{template.name}</h4>
                                                    <Badge variant={template.isActive ? "default" : "secondary"} className="text-[10px] h-5 px-1.5">
                                                        {template.isActive ? "Active" : "Inactive"}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1 truncate">{template.subject}</p>
                                            </div>
                                            <div className="flex items-center gap-2 self-end sm:self-auto border-t sm:border-0 pt-2 sm:pt-0 w-full sm:w-auto justify-end">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleEditEmailTemplate(template)}
                                                    className="h-8 w-8 p-0"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDeleteEmailTemplate(template)}
                                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* User Management */}
                <TabsContent value="users" className="space-y-4 sm:space-y-4 mt-4">
                    <Card className="shadow-sm border-muted-foreground/10">
                        <CardHeader className="p-4 sm:p-5 pb-2 sm:pb-3 border-b">
                            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                                <Users className="h-5 w-5 text-primary" />
                                Team Members
                            </CardTitle>
                            <CardDescription className="text-xs sm:text-sm">
                                Manage admin users and their permissions
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-5">
                            <div className="rounded-xl border border-gray-200 overflow-hidden -mx-2 sm:mx-0">
                                <Table className="min-w-[800px]">
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="font-semibold">User</TableHead>
                                            <TableHead className="font-semibold">Role</TableHead>
                                            <TableHead className="font-semibold">Last Active</TableHead>
                                            <TableHead className="font-semibold text-center">Status</TableHead>
                                            <TableHead className="font-semibold text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow className="hover:bg-muted/30 transition-colors">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8 ring-2 ring-primary/5">
                                                        <AvatarFallback>AD</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="font-medium text-sm">Admin User</div>
                                                        <div className="text-xs text-muted-foreground">admin@ascendrabio.com</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="default" className="font-medium text-[10px]">Super Admin</Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">2 minutes ago</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="default" className="text-[10px]">Active</Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="outline" size="sm" className="h-8">Edit</Button>
                                            </TableCell>
                                        </TableRow>
                                        <TableRow className="hover:bg-muted/30 transition-colors">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8 ring-2 ring-primary/5">
                                                        <AvatarFallback>JD</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="font-medium text-sm">John Doe</div>
                                                        <div className="text-xs text-muted-foreground">john@ascendrabio.com</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="font-medium text-[10px]">Staff</Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">1 hour ago</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="default" className="text-[10px]">Active</Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="outline" size="sm" className="h-8">Edit</Button>
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                            <Button variant="outline" className="w-full h-10 sm:h-11 mt-4 shadow-sm">
                                <Plus className="h-4 w-4 mr-2" />
                                Invite Team Member
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm border-muted-foreground/10">
                        <CardHeader className="p-4 sm:p-5 pb-2 sm:pb-3 border-b">
                            <CardTitle className="text-lg sm:text-xl">Roles & Permissions</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-5">
                            <div className="space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border rounded-lg hover:bg-muted/5 transition-colors gap-3">
                                    <div className="flex-1">
                                        <h4 className="font-medium text-sm sm:text-base">Super Admin</h4>
                                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Full access to all features</p>
                                    </div>
                                    <Button variant="outline" size="sm" className="h-8 sm:h-9 w-full sm:w-auto">Edit Permissions</Button>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border rounded-lg hover:bg-muted/5 transition-colors gap-3">
                                    <div className="flex-1">
                                        <h4 className="font-medium text-sm sm:text-base">Staff</h4>
                                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Limited access to orders and products</p>
                                    </div>
                                    <Button variant="outline" size="sm" className="h-8 sm:h-9 w-full sm:w-auto">Edit Permissions</Button>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border rounded-lg hover:bg-muted/5 transition-colors gap-3">
                                    <div className="flex-1">
                                        <h4 className="font-medium text-sm sm:text-base">Read Only</h4>
                                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">View-only access to dashboard</p>
                                    </div>
                                    <Button variant="outline" size="sm" className="h-8 sm:h-9 w-full sm:w-auto">Edit Permissions</Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Integrations */}
                <TabsContent value="integrations" className="space-y-4 sm:space-y-4 mt-4">
                    <Card className="shadow-sm border-muted-foreground/10">
                        <CardHeader className="p-4 sm:p-5 pb-2 sm:pb-3 border-b">
                            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                                <MapPin className="h-5 w-5 text-primary" />
                                Google Places Autocomplete
                            </CardTitle>
                            <CardDescription className="text-xs sm:text-sm">
                                Enable address autocomplete for customers during checkout and account management
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-5 space-y-4">
                            {googlePlacesLoading ? (
                                <div className="text-sm text-muted-foreground">Loading...</div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="text-sm font-medium">Enable Address Autocomplete</Label>
                                            <p className="text-xs text-muted-foreground">
                                                When enabled, customers will see Google Places suggestions while typing their address
                                            </p>
                                        </div>
                                        <Switch
                                            checked={googlePlacesEnabled}
                                            onCheckedChange={setGooglePlacesEnabled}
                                        />
                                    </div>
                                    {googlePlacesEnabled && (
                                        <div className="space-y-2">
                                            <Label htmlFor="google-places-key" className="text-sm font-medium">API Key</Label>
                                            <div className="relative">
                                                <Input
                                                    id="google-places-key"
                                                    type={showApiKey ? 'text' : 'password'}
                                                    value={googlePlacesApiKey}
                                                    onChange={(e) => setGooglePlacesApiKey(e.target.value)}
                                                    placeholder="Paste your Google Places API key"
                                                    className="pr-10"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                                                    onClick={() => setShowApiKey(!showApiKey)}
                                                >
                                                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Requires a Google Cloud API key with <strong>Maps JavaScript API</strong> and <strong>Places API (New)</strong> both enabled in Google Cloud Console.
                                                Restrict the key to your domain(s) for security.
                                            </p>
                                        </div>
                                    )}
                                    <div className="pt-2">
                                        <Button
                                            onClick={saveGooglePlacesConfig}
                                            disabled={googlePlacesSaving}
                                            className="h-9"
                                        >
                                            <Save className="h-4 w-4 mr-2" />
                                            {googlePlacesSaving ? 'Saving...' : 'Save Integration Settings'}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Audit Settings */}
                <TabsContent value="audit" className="space-y-4 sm:space-y-4 mt-4">
                    <AuditSettings />
                </TabsContent>
            </Tabs>
            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Tax Rate</DialogTitle>
                    </DialogHeader>
                    <div>Are you sure you want to delete this tax rate? This action cannot be undone.</div>
                    <DialogFooter>
                        <Button variant="outline" onClick={cancelDeleteTax}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmDeleteTax}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Template Confirmation Dialog */}
            <Dialog open={deleteTemplateDialogOpen} onOpenChange={setDeleteTemplateDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Email Template</DialogTitle>
                    </DialogHeader>
                    <div>
                        Are you sure you want to delete the email template "{templateToDelete?.name}"?
                        This action cannot be undone and may affect email functionality.
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={cancelDeleteTemplate}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmDeleteTemplate}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
