"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProtectedRoute } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Plus,
    Search,
    Edit,
    Trash2,
    Globe,
    MapPin,
    Building2,
    Loader2,
    AlertCircle,
    X,
    Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import * as api from "@/lib/api";
import logger from '@/lib/logger';

interface CustomLocation {
    id: string;
    country: string;
    state: string | null;
    city: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export default function LocationsManagementPage() {
    const [locations, setLocations] = useState<CustomLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterCountry, setFilterCountry] = useState<string>("United States");
    const [filterActive, setFilterActive] = useState<string>("all");
    const [filterEntryType, setFilterEntryType] = useState<string>("cities");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const [availableCountries, setAvailableCountries] = useState<string[]>([]);
    const [loadingCountries, setLoadingCountries] = useState(false);

    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<CustomLocation | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const [formData, setFormData] = useState({
        country: "",
        state: "",
        city: "",
        isActive: true
    });
    const [formLoading, setFormLoading] = useState(false);

    const [dialogCountries, setDialogCountries] = useState<string[]>([]);
    const [dialogStates, setDialogStates] = useState<string[]>([]);
    const [dialogCities, setDialogCities] = useState<string[]>([]);
    const [loadingDialogStates, setLoadingDialogStates] = useState(false);
    const [loadingDialogCities, setLoadingDialogCities] = useState(false);

    const [isCustomCountry, setIsCustomCountry] = useState(false);
    const [isCustomState, setIsCustomState] = useState(false);
    const [isCustomCity, setIsCustomCity] = useState(false);

    const fetchAvailableCountries = async () => {
        setLoadingCountries(true);
        try {
            const response = await api.getCustomLocations({ page: 1, limit: 1000 });
            if (response.success && response.data && response.data.locations) {
                const countries = Array.from(new Set(response.data.locations.map((loc: CustomLocation) => loc.country)))
                    .filter(Boolean) as string[];
                setAvailableCountries(countries.sort());
            }
        } catch (error: any) {
            logger.error("Failed to load countries:", { error: error });
        } finally {
            setLoadingCountries(false);
        }
    };

    useEffect(() => {
        fetchAvailableCountries();
    }, []);

    const fetchLocations = async () => {
        setLoading(true);
        try {
            const params: any = {
                page,
                limit: 50,
                search: searchTerm || undefined,
                country: filterCountry === "all_countries" ? undefined : filterCountry,
                isActive: filterActive === "all" ? undefined : filterActive === "active"
            };

            const response = await api.getCustomLocations(params);

            if (response.success && response.data) {
                let filteredLocations = response.data.locations;

                if (filterEntryType === "cities") {
                    filteredLocations = filteredLocations.filter((loc: CustomLocation) => loc.city !== null);
                } else if (filterEntryType === "states") {
                    filteredLocations = filteredLocations.filter((loc: CustomLocation) => loc.state !== null && loc.city === null);
                } else if (filterEntryType === "countries") {
                    filteredLocations = filteredLocations.filter((loc: CustomLocation) => loc.state === null && loc.city === null);
                }

                setLocations(filteredLocations);
                setTotalPages(response.data.pagination.pages);
                setTotal(filteredLocations.length);
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to load locations");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLocations();
    }, [page, filterCountry, filterActive, filterEntryType]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (page === 1) {
                fetchLocations();
            } else {
                setPage(1);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    const handleCreate = async () => {
        if (!formData.country.trim()) {
            toast.error("Country is required");
            return;
        }

        setFormLoading(true);
        try {
            const response = await api.createCustomLocation({
                country: formData.country.trim(),
                state: formData.state.trim() || null,
                city: formData.city.trim() || null,
                isActive: formData.isActive
            });

            if (response.success) {
                toast.success("Location created successfully");
                setIsAddDialogOpen(false);
                resetForm();
                fetchLocations();
            } else {
                toast.error(response.error || "Failed to create location");
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to create location");
        } finally {
            setFormLoading(false);
        }
    };

    const handleUpdate = async () => {
        if (!selectedLocation) return;

        setFormLoading(true);
        try {
            const response = await api.updateCustomLocation(selectedLocation.id, {
                country: formData.country.trim() || undefined,
                state: formData.state.trim() || null,
                city: formData.city.trim() || null,
                isActive: formData.isActive
            });

            if (response.success) {
                toast.success("Location updated successfully");
                setIsEditDialogOpen(false);
                resetForm();
                fetchLocations();
            } else {
                toast.error(response.error || "Failed to update location");
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to update location");
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedLocation) return;

        setFormLoading(true);
        try {
            const response = await api.deleteCustomLocation(selectedLocation.id);

            if (response.success) {
                toast.success("Location deleted successfully");
                setIsDeleteDialogOpen(false);
                setSelectedLocation(null);
                fetchLocations();
            } else {
                toast.error(response.error || "Failed to delete location");
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to delete location");
        } finally {
            setFormLoading(false);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;

        setFormLoading(true);
        try {
            const response = await api.bulkDeleteCustomLocations(selectedIds);

            if (response.success) {
                toast.success(`Deleted ${response.data?.count || selectedIds.length} location(s)`);
                setSelectedIds([]);
                fetchLocations();
            } else {
                toast.error(response.error || "Failed to delete locations");
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to delete locations");
        } finally {
            setFormLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            country: "",
            state: "",
            city: "",
            isActive: true
        });
        setSelectedLocation(null);
        setDialogStates([]);
        setDialogCities([]);
        setIsCustomCountry(false);
        setIsCustomState(false);
        setIsCustomCity(false);
    };

    const openAddDialog = async () => {
        setDialogCountries(availableCountries);

        if (availableCountries.includes("United States")) {
            setFormData({
                country: "United States",
                state: "",
                city: "",
                isActive: true
            });

            setLoadingDialogStates(true);
            try {
                const response = await api.getCustomStates("United States");
                if (response.success && response.data) {
                    setDialogStates(response.data);
                }
            } catch (error) {
                logger.error("Failed to load states:", { error: error });
            } finally {
                setLoadingDialogStates(false);
            }
        }

        setIsAddDialogOpen(true);
    };

    const openEditDialog = async (location: CustomLocation) => {
        setSelectedLocation(location);
        setFormData({
            country: location.country,
            state: location.state || "",
            city: location.city || "",
            isActive: location.isActive
        });

        setIsCustomCountry(false);
        setIsCustomState(false);
        setIsCustomCity(false);

        setDialogCountries(availableCountries);

        if (location.country && availableCountries.length > 0 && !availableCountries.includes(location.country)) {
            setIsCustomCountry(true);
        }

        if (location.country) {
            setLoadingDialogStates(true);
            try {
                const response = await api.getCustomStates(location.country);
                if (response.success && response.data) {
                    setDialogStates(response.data);
                    if (location.state && !response.data.includes(location.state)) {
                        setIsCustomState(true);
                    }
                }
            } catch (error) {
                logger.error("Failed to load states:", { error: error });
            } finally {
                setLoadingDialogStates(false);
            }
        }

        if (location.country && location.state) {
            setLoadingDialogCities(true);
            try {
                const response = await api.getCustomCities(location.country, location.state);
                if (response.success && response.data) {
                    setDialogCities(response.data);
                    if (location.city && !response.data.includes(location.city)) {
                        setIsCustomCity(true);
                    }
                }
            } catch (error) {
                logger.error("Failed to load cities:", { error: error });
            } finally {
                setLoadingDialogCities(false);
            }
        }

        setIsEditDialogOpen(true);
    };

    const openDeleteDialog = (location: CustomLocation) => {
        setSelectedLocation(location);
        setIsDeleteDialogOpen(true);
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === locations.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(locations.map(l => l.id));
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    return (
        <ProtectedRoute>
            <DashboardLayout>
                <div className="space-y-0">

                    {/* ════════ DARK HERO STRIP ════════ */}
                    <div className="relative bg-mist border border-line border-t-2 border-t-[#5A9ADA] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
                        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                        <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#5A9ADA]/8 rounded-full blur-[100px] pointer-events-none" />

                        <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div>
                                    <h1 className="text-xl font-black text-[#043061] tracking-tight">Manage Locations</h1>
                                    <p className="text-xs text-gray-500 mt-0.5">Manage countries, states, and cities for customer addresses</p>
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <div className="flex items-center gap-2.5 bg-white border border-line rounded-xl px-4 py-2">
                                        <MapPin className="h-4 w-4 text-[#5A9ADA]" />
                                        <div>
                                            <p className="text-[9px] text-gray-500 font-medium uppercase tracking-widest leading-none">Locations</p>
                                            <p className="text-base font-black text-[#043061] tabular-nums leading-tight">{locations.length}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={openAddDialog}
                                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#043061] text-white hover:bg-[#0b4f96] text-xs font-black uppercase tracking-widest transition-colors"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        Add Location
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ════════ COMPACT FILTERS ════════ */}
                    <div className="px-1 sm:px-0 py-4">
                        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="sm:col-span-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search by country, state, or city..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10 h-10"
                                    />
                                </div>
                            </div>
                            <Select value={filterCountry} onValueChange={setFilterCountry} disabled={loadingCountries}>
                                <SelectTrigger>
                                    <SelectValue placeholder={loadingCountries ? "Loading countries..." : "All Countries"} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all_countries">All Countries</SelectItem>
                                    {loadingCountries ? (
                                        <SelectItem value="loading" disabled>
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Loading...
                                            </div>
                                        </SelectItem>
                                    ) : (
                                        availableCountries.map((country) => (
                                            <SelectItem key={country} value={country}>
                                                {country}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                            <Select value={filterActive} onValueChange={setFilterActive}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="active">Active Only</SelectItem>
                                    <SelectItem value="inactive">Inactive Only</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        </div>
                    </div>

                    {/* Bulk Actions */}
                    {selectedIds.length > 0 && (
                        <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">
                                    {selectedIds.length} location(s) selected
                                </span>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleBulkDelete}
                                    disabled={formLoading}
                                >
                                    {formLoading ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Trash2 className="h-4 w-4 mr-2" />
                                    )}
                                    Delete Selected
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Table */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-slate-100 rounded-lg">
                                    <Warehouse className="h-4 w-4 text-slate-600" />
                                </div>
                                <span className="font-semibold text-slate-800">Locations ({total})</span>
                            </div>
                            {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                        </div>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12">
                                            <Checkbox
                                                checked={selectedIds.length === locations.length && locations.length > 0}
                                                onCheckedChange={toggleSelectAll}
                                            />
                                        </TableHead>
                                        <TableHead className="min-w-[150px]">
                                            <div className="flex items-center gap-2">
                                                <Globe className="h-4 w-4" />
                                                Country
                                            </div>
                                        </TableHead>
                                        <TableHead className="min-w-[150px]">
                                            <div className="flex items-center gap-2">
                                                <MapPin className="h-4 w-4" />
                                                State
                                            </div>
                                        </TableHead>
                                        <TableHead className="min-w-[150px]">
                                            <div className="flex items-center gap-2">
                                                <Building2 className="h-4 w-4" />
                                                City
                                            </div>
                                        </TableHead>
                                        <TableHead className="min-w-[100px]">Status</TableHead>
                                        <TableHead className="text-right min-w-[100px]">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {locations.length === 0 && !loading ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                                No locations found
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        locations.map((location) => (
                                            <TableRow key={location.id}>
                                                <TableCell>
                                                    <Checkbox
                                                        checked={selectedIds.includes(location.id)}
                                                        onCheckedChange={() => toggleSelect(location.id)}
                                                    />
                                                </TableCell>
                                                <TableCell className="font-medium">{location.country}</TableCell>
                                                <TableCell>{location.state || "—"}</TableCell>
                                                <TableCell>{location.city || "—"}</TableCell>
                                                <TableCell>
                                                    <Badge variant={location.isActive ? "default" : "secondary"}>
                                                        {location.isActive ? "Active" : "Inactive"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => openEditDialog(location)}
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => openDeleteDialog(location)}
                                                        >
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="px-5 py-4 border-t border-slate-100">
                                <Pagination
                                    currentPage={page}
                                    totalPages={totalPages}
                                    onPageChange={setPage}
                                />
                            </div>
                        )}
                    </div>

                    {/* Add Dialog */}
                    <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
                        setIsAddDialogOpen(open);
                        if (!open) {
                            resetForm();
                        }
                    }}>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Add New Location</DialogTitle>
                                <DialogDescription>
                                    Create a new country, state, or city entry
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div>
                                    <Label htmlFor="country">Country *</Label>
                                    {isCustomCountry ? (
                                        <div className="flex gap-2">
                                            <Input
                                                value={formData.country}
                                                onChange={(e) => setFormData({ ...formData, country: e.target.value, state: "", city: "" })}
                                                placeholder="Enter country name"
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => {
                                                    setIsCustomCountry(false);
                                                    setFormData({ ...formData, country: "", state: "", city: "" });
                                                }}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <Select
                                            value={formData.country}
                                            onValueChange={async (value) => {
                                                if (value === "__custom__") {
                                                    setIsCustomCountry(true);
                                                    setFormData({ ...formData, country: "", state: "", city: "" });
                                                } else {
                                                    setFormData({ ...formData, country: value, state: "", city: "" });
                                                    setLoadingDialogStates(true);
                                                    try {
                                                        const response = await api.getCustomStates(value);
                                                        if (response.success && response.data) {
                                                            setDialogStates(response.data);
                                                        }
                                                    } catch (error) {
                                                        logger.error("Failed to load states:", { error: error });
                                                    } finally {
                                                        setLoadingDialogStates(false);
                                                    }
                                                }
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select or add country" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__custom__" className="text-blue-600 font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <Plus className="h-4 w-4" />
                                                        Add New Country
                                                    </div>
                                                </SelectItem>
                                                {dialogCountries.map((country) => (
                                                    <SelectItem key={country} value={country}>
                                                        {country}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="state">State / Province</Label>
                                    {isCustomState ? (
                                        <div className="flex gap-2">
                                            <Input
                                                value={formData.state}
                                                onChange={(e) => setFormData({ ...formData, state: e.target.value, city: "" })}
                                                placeholder="Enter state name"
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => {
                                                    setIsCustomState(false);
                                                    setFormData({ ...formData, state: "", city: "" });
                                                }}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <Select
                                            value={formData.state}
                                            onValueChange={async (value) => {
                                                if (value === "__custom__") {
                                                    setIsCustomState(true);
                                                    setFormData({ ...formData, state: "", city: "" });
                                                } else {
                                                    setFormData({ ...formData, state: value, city: "" });
                                                    setLoadingDialogCities(true);
                                                    try {
                                                        const response = await api.getCustomCities(formData.country, value);
                                                        if (response.success && response.data) {
                                                            setDialogCities(response.data);
                                                        }
                                                    } catch (error) {
                                                        logger.error("Failed to load cities:", { error: error });
                                                    } finally {
                                                        setLoadingDialogCities(false);
                                                    }
                                                }
                                            }}
                                            disabled={!formData.country || loadingDialogStates}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={loadingDialogStates ? "Loading states..." : "Select or add state (optional)"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__custom__" className="text-blue-600 font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <Plus className="h-4 w-4" />
                                                        Add New State
                                                    </div>
                                                </SelectItem>
                                                {dialogStates.map((state) => (
                                                    <SelectItem key={state} value={state}>
                                                        {state}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="city">City</Label>
                                    {isCustomCity ? (
                                        <div className="flex gap-2">
                                            <Input
                                                value={formData.city}
                                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                                placeholder="Enter city name"
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => {
                                                    setIsCustomCity(false);
                                                    setFormData({ ...formData, city: "" });
                                                }}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <Select
                                            value={formData.city}
                                            onValueChange={(value) => {
                                                if (value === "__custom__") {
                                                    setIsCustomCity(true);
                                                    setFormData({ ...formData, city: "" });
                                                } else {
                                                    setFormData({ ...formData, city: value });
                                                }
                                            }}
                                            disabled={!formData.state || loadingDialogCities}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={loadingDialogCities ? "Loading cities..." : "Select or add city (optional)"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__custom__" className="text-blue-600 font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <Plus className="h-4 w-4" />
                                                        Add New City
                                                    </div>
                                                </SelectItem>
                                                {dialogCities.map((city) => (
                                                    <SelectItem key={city} value={city}>
                                                        {city}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="isActive"
                                        checked={formData.isActive}
                                        onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked as boolean })}
                                    />
                                    <Label htmlFor="isActive" className="cursor-pointer">
                                        Active
                                    </Label>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); resetForm(); }}>
                                    Cancel
                                </Button>
                                <Button
                                    className="h-9 px-4 bg-[#043061] hover:bg-[#0b4f96] text-white rounded-xl text-sm font-medium"
                                    onClick={handleCreate}
                                    disabled={formLoading}
                                >
                                    {formLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    Create
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Edit Dialog */}
                    <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Edit Location</DialogTitle>
                                <DialogDescription>
                                    Update location details
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div>
                                    <Label htmlFor="edit-country">Country *</Label>
                                    {isCustomCountry ? (
                                        <div className="flex gap-2">
                                            <Input
                                                id="edit-country"
                                                value={formData.country}
                                                onChange={(e) => setFormData({ ...formData, country: e.target.value, state: "", city: "" })}
                                                placeholder="Enter country name"
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => {
                                                    setIsCustomCountry(false);
                                                    setFormData({ ...formData, country: "", state: "", city: "" });
                                                }}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <Select
                                            value={formData.country}
                                            onValueChange={async (value) => {
                                                if (value === "__custom__") {
                                                    setIsCustomCountry(true);
                                                    setFormData({ ...formData, country: "", state: "", city: "" });
                                                } else {
                                                    setFormData({ ...formData, country: value, state: "", city: "" });
                                                    setLoadingDialogStates(true);
                                                    try {
                                                        const response = await api.getCustomStates(value);
                                                        if (response.success && response.data) {
                                                            setDialogStates(response.data);
                                                        }
                                                    } catch (error) {
                                                        logger.error("Failed to load states:", { error: error });
                                                    } finally {
                                                        setLoadingDialogStates(false);
                                                    }
                                                }
                                            }}
                                        >
                                            <SelectTrigger id="edit-country">
                                                <SelectValue placeholder="Select country" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__custom__" className="text-blue-600 font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <Plus className="h-4 w-4" />
                                                        Add New Country
                                                    </div>
                                                </SelectItem>
                                                {dialogCountries.map((country) => (
                                                    <SelectItem key={country} value={country}>
                                                        {country}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="edit-state">State / Province</Label>
                                    {isCustomState ? (
                                        <div className="flex gap-2">
                                            <Input
                                                id="edit-state"
                                                value={formData.state}
                                                onChange={(e) => setFormData({ ...formData, state: e.target.value, city: "" })}
                                                placeholder="Enter state name"
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => {
                                                    setIsCustomState(false);
                                                    setFormData({ ...formData, state: "", city: "" });
                                                }}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <Select
                                            value={formData.state || ""}
                                            onValueChange={async (value) => {
                                                if (value === "__custom__") {
                                                    setIsCustomState(true);
                                                    setFormData({ ...formData, state: "", city: "" });
                                                } else {
                                                    setFormData({ ...formData, state: value, city: "" });
                                                    setLoadingDialogCities(true);
                                                    try {
                                                        const response = await api.getCustomCities(formData.country, value);
                                                        if (response.success && response.data) {
                                                            setDialogCities(response.data);
                                                        }
                                                    } catch (error) {
                                                        logger.error("Failed to load cities:", { error: error });
                                                    } finally {
                                                        setLoadingDialogCities(false);
                                                    }
                                                }
                                            }}
                                            disabled={!formData.country || loadingDialogStates}
                                        >
                                            <SelectTrigger id="edit-state">
                                                <SelectValue placeholder={loadingDialogStates ? "Loading..." : "Select state"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__custom__" className="text-blue-600 font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <Plus className="h-4 w-4" />
                                                        Add New State
                                                    </div>
                                                </SelectItem>
                                                {dialogStates.map((state) => (
                                                    <SelectItem key={state} value={state}>
                                                        {state}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="edit-city">City</Label>
                                    {isCustomCity ? (
                                        <div className="flex gap-2">
                                            <Input
                                                id="edit-city"
                                                value={formData.city}
                                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                                placeholder="Enter city name"
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => {
                                                    setIsCustomCity(false);
                                                    setFormData({ ...formData, city: "" });
                                                }}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <Select
                                            value={formData.city || ""}
                                            onValueChange={(value) => {
                                                if (value === "__custom__") {
                                                    setIsCustomCity(true);
                                                    setFormData({ ...formData, city: "" });
                                                } else {
                                                    setFormData({ ...formData, city: value });
                                                }
                                            }}
                                            disabled={!formData.state || loadingDialogCities}
                                        >
                                            <SelectTrigger id="edit-city">
                                                <SelectValue placeholder={loadingDialogCities ? "Loading..." : "Select city"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__custom__" className="text-blue-600 font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <Plus className="h-4 w-4" />
                                                        Add New City
                                                    </div>
                                                </SelectItem>
                                                {dialogCities.map((city) => (
                                                    <SelectItem key={city} value={city}>
                                                        {city}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="edit-isActive"
                                        checked={formData.isActive}
                                        onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked as boolean })}
                                    />
                                    <Label htmlFor="edit-isActive" className="cursor-pointer">
                                        Active
                                    </Label>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => { setIsEditDialogOpen(false); resetForm(); }}>
                                    Cancel
                                </Button>
                                <Button
                                    className="h-9 px-4 bg-[#043061] hover:bg-[#0b4f96] text-white rounded-xl text-sm font-medium"
                                    onClick={handleUpdate}
                                    disabled={formLoading}
                                >
                                    {formLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    Update
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Delete Dialog */}
                    <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Delete Location</DialogTitle>
                                <DialogDescription>
                                    Are you sure you want to delete this location? This action cannot be undone.
                                </DialogDescription>
                            </DialogHeader>
                            {selectedLocation && (
                                <div className="py-4">
                                    <p className="text-sm">
                                        <strong>Country:</strong> {selectedLocation.country}
                                        {selectedLocation.state && <><br /><strong>State:</strong> {selectedLocation.state}</>}
                                        {selectedLocation.city && <><br /><strong>City:</strong> {selectedLocation.city}</>}
                                    </p>
                                </div>
                            )}
                            <DialogFooter>
                                <Button variant="outline" onClick={() => { setIsDeleteDialogOpen(false); setSelectedLocation(null); }}>
                                    Cancel
                                </Button>
                                <Button variant="destructive" onClick={handleDelete} disabled={formLoading}>
                                    {formLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    Delete
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
