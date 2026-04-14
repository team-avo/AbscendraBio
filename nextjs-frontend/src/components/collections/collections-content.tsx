"use client";

import { useState, useEffect, useMemo } from "react";
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
    Download,
    Eye,
    Edit,
    MoreHorizontal,
    Plus,
    Grid3X3,
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
        <div className="space-y-0">

            {/* ════════ DARK HERO STRIP ════════ */}
            <div className="relative bg-[#070B14] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#4D7DF2]/8 rounded-full blur-[100px] pointer-events-none" />

                <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-xl font-black text-white tracking-tight">Collections</h1>
                            <p className="text-xs text-gray-500 mt-0.5">Manage your product collections and featured sets</p>
                        </div>
                        <div className="flex items-center gap-2.5">
                            <div className="flex items-center gap-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-2">
                                <Grid3X3 className="h-4 w-4 text-[#4D7DF2]" />
                                <div>
                                    <p className="text-[9px] text-gray-500 font-medium uppercase tracking-widest leading-none">Collections</p>
                                    <p className="text-base font-black text-white tabular-nums leading-tight">{collectionStats.total}</p>
                                </div>
                            </div>
                            <button onClick={downloadCsv} disabled={loading || collections.length === 0} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-xs font-bold text-gray-300 hover:bg-white/10 transition-colors disabled:opacity-40">
                                <Download className="h-3.5 w-3.5" />
                                Export
                            </button>
                            <button onClick={() => setShowCreateDialog(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-[#070B14] hover:bg-gray-100 text-xs font-black uppercase tracking-widest transition-colors">
                                <Plus className="h-3.5 w-3.5" />
                                Add Collection
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ════════ COMPACT FILTER ROW ════════ */}
            <div className="px-1 sm:px-0 py-4">
                <div className="relative max-w-sm">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <Input
                        placeholder="Search collections…"
                        className="pl-10 h-9 bg-white border-gray-200 rounded-xl text-xs placeholder:text-gray-400"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* ════════ TABLE ════════ */}
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden mx-1 sm:mx-0">
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="flex justify-center items-center py-16">
                            <div className="w-8 h-8 border-2 border-[#4D7DF2]/30 border-t-[#4D7DF2] rounded-full animate-spin" />
                        </div>
                    ) : collections.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                                <Grid3X3 className="h-6 w-6 text-gray-400" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-700">No collections found</p>
                                <p className="text-xs text-gray-400 mt-0.5">{searchTerm ? 'Try adjusting your search' : 'Create your first collection'}</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <Table className="min-w-[800px]">
                                <TableHeader>
                                    <TableRow className="bg-gray-50/50 border-b border-gray-100">
                                        <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wider">Name</TableHead>
                                        <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wider">Description</TableHead>
                                        <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wider">Status</TableHead>
                                        <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wider">Products</TableHead>
                                        <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wider">Created</TableHead>
                                        <TableHead className="text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {collections.map((collection) => (
                                        <TableRow key={collection.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50">
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
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                                    <p className="text-xs text-gray-400">Page {page} of {totalPages}</p>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="h-8 px-3 rounded-xl text-xs">Previous</Button>
                                        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="h-8 px-3 rounded-xl text-xs">Next</Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

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