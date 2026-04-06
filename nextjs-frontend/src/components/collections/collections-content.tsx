"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Search,
    Filter,
    Download,
    Eye,
    Edit,
    MoreHorizontal,
    Plus,
    Package,
    DollarSign,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    Grid3X3,
    List,
    Star
} from "lucide-react";
import { CreateCollectionDialog } from "./create-collection-dialog";
import { EditCollectionDialog } from "./edit-collection-dialog";
import { CollectionProductsDialog } from "./collection-products-dialog";
import { api, Collection } from "@/lib/api";
import { toast } from "sonner";
import logger from "@/lib/logger";

interface CreateCollectionData {
    name: string;
    description: string;
    isActive: boolean;
    sortOrder?: number;
}

interface UpdateCollectionData {
    name?: string;
    description?: string;
    isActive?: boolean;
    sortOrder?: number;
}

export function CollectionsContent() {
    const [searchTerm, setSearchTerm] = useState("");
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showProductsDialog, setShowProductsDialog] = useState(false);
    const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
    const [collections, setCollections] = useState<Collection[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchCollections = async () => {
        try {
            setLoading(true);
            const response = await api.getCollections({
                page,
                limit: 10,
                search: searchTerm || undefined
            });

            if (response.success && response.data) {
                setCollections(response.data.collections);
                setTotalPages(response.data.pagination.pages);
            }
        } catch (error) {
            toast.error("Failed to fetch collections");
            logger.error("Error fetching collections", { error });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCollections();
    }, [page, searchTerm]);

    const handleCreateCollection = async (data: CreateCollectionData) => {
        try {
            const response = await api.createCollection(data);
            if (response.success) {
                toast.success("Collection created successfully");
                fetchCollections();
                setShowCreateDialog(false);
            }
        } catch (error) {
            toast.error("Failed to create collection");
            logger.error("Error creating collection", { error, data });
        }
    };

    const handleUpdateCollection = async (id: string, data: UpdateCollectionData) => {
        try {
            const response = await api.updateCollection(id, data);
            if (response.success) {
                toast.success("Collection updated successfully");
                fetchCollections();
                setShowEditDialog(false);
            }
        } catch (error) {
            toast.error("Failed to update collection");
            logger.error("Error updating collection", { error, id, data });
        }
    };

    const handleUpdateCollectionProducts = async (id: string, productIds: string[]) => {
        try {
            const response = await api.updateCollectionProducts(id, productIds);
            if (response.success) {
                toast.success("Collection products updated successfully");
                fetchCollections();
                setShowProductsDialog(false);
            }
        } catch (error) {
            toast.error("Failed to update collection products");
            logger.error("Error updating collection products", { error, id, productIds });
        }
    };

    const handleEdit = (collection: Collection) => {
        setSelectedCollection(collection);
        setShowEditDialog(true);
    };

    const handleViewProducts = (collection: Collection) => {
        setSelectedCollection(collection);
        setShowProductsDialog(true);
    };

    const escapeCsv = (value: any): string => {
        if (value === null || value === undefined) return "";
        const str = String(value);
        if (/[",\n]/.test(str)) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    };

    const csv = useMemo(() => {
        const header = ["name", "description", "status", "products", "created_at"];
        const rows = collections.map((c) => [
            c.name,
            c.description || "",
            c.isActive ? "ACTIVE" : "INACTIVE",
            String(c._count?.products || 0),
            new Date(c.createdAt).toISOString(),
        ]);
        return [header, ...rows].map((r) => r.map(escapeCsv).join(",")).join("\n");
    }, [collections]);

    const downloadCsv = () => {
        try {
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `collections_export.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            logger.error("[Collections] CSV export failed", { error: e });
        }
    };

    const collectionStats = {
        total: collections.length,
        active: collections.filter(c => c.isActive).length,
        totalProducts: collections.reduce((sum, c) => sum + (c._count?.products || 0), 0)
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Collections</h1>
                    <p className="text-muted-foreground">
                        Manage your product collections and featured sets
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" onClick={downloadCsv} disabled={loading || collections.length === 0} className="w-full sm:w-auto">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                    </Button>
                    <Button onClick={() => setShowCreateDialog(true)} className="w-full sm:w-auto">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Collection
                    </Button>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 w-full">
                <Card className="py-0.5 gap-0 sm:py-3 sm:gap-1">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-3 sm:pb-1">
                        <CardTitle className="text-[10px] sm:text-xs font-medium">Total Collections</CardTitle>
                        <Package className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-2 pt-0 sm:p-3 sm:pt-0">
                        <div className="text-base sm:text-lg lg:text-2xl font-bold">{collectionStats.total}</div>
                    </CardContent>
                </Card>

                <Card className="py-0.5 gap-0 sm:py-3 sm:gap-1">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-3 sm:pb-1">
                        <CardTitle className="text-[10px] sm:text-xs font-medium">Active Collections</CardTitle>
                        <Star className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-2 pt-0 sm:p-3 sm:pt-0">
                        <div className="text-base sm:text-lg lg:text-2xl font-bold text-green-600">{collectionStats.active}</div>
                    </CardContent>
                </Card>

                <Card className="py-0.5 gap-0 sm:py-3 sm:gap-1 col-span-2 md:col-span-1">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-3 sm:pb-1">
                        <CardTitle className="text-[10px] sm:text-xs font-medium">Total Products</CardTitle>
                        <Package className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-2 pt-0 sm:p-3 sm:pt-0">
                        <div className="text-base sm:text-lg lg:text-2xl font-bold">{collectionStats.totalProducts}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Collections Management */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <CardTitle>Collections List</CardTitle>
                            <CardDescription>
                                View and manage your product collections
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search collections..."
                                    className="pl-8 w-full"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table className="min-w-[800px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Products</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {collections.map((collection) => (
                                    <TableRow key={collection.id}>
                                        <TableCell className="font-medium whitespace-nowrap">{collection.name}</TableCell>
                                        <TableCell className="max-w-[300px] truncate">{collection.description || "-"}</TableCell>
                                        <TableCell>
                                            <Badge variant={collection.isActive ? "default" : "secondary"}>
                                                {collection.isActive ? "Active" : "Inactive"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">{collection._count?.products || 0}</TableCell>
                                        <TableCell className="whitespace-nowrap">{new Date(collection.createdAt).toLocaleDateString()}</TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => handleViewProducts(collection)}>
                                                        <Eye className="h-4 w-4 mr-2" />
                                                        View Products
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleEdit(collection)}>
                                                        <Edit className="h-4 w-4 mr-2" />
                                                        Edit Collection
                                                    </DropdownMenuItem>
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

            {/* Dialogs */}
            <CreateCollectionDialog
                open={showCreateDialog}
                onOpenChange={setShowCreateDialog}
                onSubmit={handleCreateCollection}
            />
            {selectedCollection && (
                <>
                    <EditCollectionDialog
                        open={showEditDialog}
                        onOpenChange={setShowEditDialog}
                        collection={selectedCollection}
                        onSubmit={(data) => handleUpdateCollection(selectedCollection.id, data)}
                    />
                    <CollectionProductsDialog
                        open={showProductsDialog}
                        onOpenChange={setShowProductsDialog}
                        collection={selectedCollection}
                        onSubmit={(productIds) => handleUpdateCollectionProducts(selectedCollection.id, productIds)}
                    />
                </>
            )}
        </div>
    );
}