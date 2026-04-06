"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
    Plus,
    Search,
    Edit,
    Trash2,
    Globe,
    MapPin,
    Building2,
    AlertCircle
} from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import * as api from "@/lib/api";

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
    const [filterCountry, setFilterCountry] = useState<string>("");
    const [filterActive, setFilterActive] = useState<string>("all");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    // Dialog states
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<CustomLocation | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // Form states
    const [formData, setFormData] = useState({
        country: "",
        state: "",
        city: "",
        isActive: true
    });
    const [formLoading, setFormLoading] = useState(false);

    // Fetch locations
    const fetchLocations = async () => {
        setLoading(true);
        try {
            const params: any = {
                page,
                limit: 50,
                search: searchTerm || undefined,
                country: filterCountry || undefined,
                isActive: filterActive === "all" ? undefined : filterActive === "active"
            };

            const response = await api.getCustomLocations(params);

            if (response.success && response.data) {
                setLocations(response.data.locations);
                setTotalPages(response.data.pagination.pages);
                setTotal(response.data.pagination.total);
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to load locations");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLocations();
    }, [page, filterCountry, filterActive]);

    // Handle search with debounce
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

    // Handle create
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

    // Handle update
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

    // Handle delete
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

    // Handle bulk delete
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
    };

    const openEditDialog = (location: CustomLocation) => {
        setSelectedLocation(location);
        setFormData({
            country: location.country,
            state: location.state || "",
            city: location.city || "",
            isActive: location.isActive
        });
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
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Manage Locations</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage countries, states, and cities for customer addresses
                    </p>
                </div>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Location
                </Button>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by country, state, or city..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        <Select value={filterCountry} onValueChange={setFilterCountry}>
                            <SelectTrigger>
                                <SelectValue placeholder="All Countries" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">All Countries</SelectItem>
                                <SelectItem value="United States">United States</SelectItem>
                                <SelectItem value="Canada">Canada</SelectItem>
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
                </CardContent>
            </Card>

            {/* Bulk Actions */}
            {selectedIds.length > 0 && (
                <Card className="border-destructive">
                    <CardContent className="pt-6">
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
                                    <LoadingSpinner size={16} className="mr-2" />
                                ) : (
                                    <Trash2 className="h-4 w-4 mr-2" />
                                )}
                                Delete Selected
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>Locations ({total})</span>
                        {loading && <LoadingSpinner size={16} />}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12">
                                    <Checkbox
                                        checked={selectedIds.length === locations.length && locations.length > 0}
                                        onCheckedChange={toggleSelectAll}
                                    />
                                </TableHead>
                                <TableHead>
                                    <div className="flex items-center gap-2">
                                        <Globe className="h-4 w-4" />
                                        Country
                                    </div>
                                </TableHead>
                                <TableHead>
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4" />
                                        State
                                    </div>
                                </TableHead>
                                <TableHead>
                                    <div className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4" />
                                        City
                                    </div>
                                </TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
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

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4">
                            <p className="text-sm text-muted-foreground">
                                Page {page} of {totalPages}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Add Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Location</DialogTitle>
                        <DialogDescription>
                            Create a new country, state, or city entry
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label htmlFor="country">Country *</Label>
                            <Input
                                id="country"
                                value={formData.country}
                                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                placeholder="e.g., United States"
                            />
                        </div>
                        <div>
                            <Label htmlFor="state">State / Province</Label>
                            <Input
                                id="state"
                                value={formData.state}
                                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                placeholder="e.g., California (optional)"
                            />
                        </div>
                        <div>
                            <Label htmlFor="city">City</Label>
                            <Input
                                id="city"
                                value={formData.city}
                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                placeholder="e.g., Los Angeles (optional)"
                            />
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
                        <Button onClick={handleCreate} disabled={formLoading}>
                            {formLoading && <LoadingSpinner size={16} className="mr-2" />}
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
                            <Input
                                id="edit-country"
                                value={formData.country}
                                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                            />
                        </div>
                        <div>
                            <Label htmlFor="edit-state">State / Province</Label>
                            <Input
                                id="edit-state"
                                value={formData.state}
                                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                            />
                        </div>
                        <div>
                            <Label htmlFor="edit-city">City</Label>
                            <Input
                                id="edit-city"
                                value={formData.city}
                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                            />
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
                        <Button onClick={handleUpdate} disabled={formLoading}>
                            {formLoading && <LoadingSpinner size={16} className="mr-2" />}
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
                            {formLoading && <LoadingSpinner size={16} className="mr-2" />}
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
