"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Plus, Minus } from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collection, Product, api } from "@/lib/api";
import { toast } from "sonner";
import logger from '@/lib/logger';

interface CollectionProductsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    collection: Collection;
    onSubmit: (productIds: string[]) => void;
}

export function CollectionProductsDialog({ open, onOpenChange, collection, onSubmit }: CollectionProductsDialogProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const response = await api.getProducts({
                search: searchTerm || undefined,
                status: "ACTIVE"
            });

            if (response.success && response.data) {
                setProducts(response.data.products || []);
            }
        } catch (error) {
            toast.error("Failed to fetch products");
            logger.error("Error fetching products:", { error: error });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, [searchTerm]);

    useEffect(() => {
        if (collection.products) {
            setSelectedProducts(new Set(collection.products.map(p => p.productId)));
        }
    }, [collection]);

    const handleToggleProduct = (productId: string) => {
        const newSelected = new Set(selectedProducts);
        if (newSelected.has(productId)) {
            newSelected.delete(productId);
        } else {
            newSelected.add(productId);
        }
        setSelectedProducts(newSelected);
    };

    const handleSave = async () => {
        onSubmit(Array.from(selectedProducts));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:max-w-[800px] h-[90vh] sm:h-[80vh] p-0 sm:p-6">
                <DialogHeader>
                    <DialogTitle>Collection Products</DialogTitle>
                    <DialogDescription>
                        Manage products in the {collection.name} collection
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col h-full gap-4">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 px-4 sm:px-0">
                        <div className="relative flex-1">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search products..."
                                className="pl-8"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Button onClick={handleSave} className="w-full sm:w-auto">Save Changes</Button>
                    </div>

                    <ScrollArea className="flex-1 border rounded-md">
                        <div className="hidden md:block">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12"></TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>SKU</TableHead>
                                        <TableHead>Price</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {products.map((product) => (
                                        <TableRow key={product.id}>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleToggleProduct(product.id)}
                                                >
                                                    {selectedProducts.has(product.id) ? (
                                                        <Minus className="h-4 w-4" />
                                                    ) : (
                                                        <Plus className="h-4 w-4" />
                                                    )}
                                                </Button>
                                            </TableCell>
                                            <TableCell className="font-medium">{product.name}</TableCell>
                                            <TableCell>
                                                {product.variants?.[0]?.sku || "N/A"}
                                            </TableCell>
                                            <TableCell>
                                                ${product.variants?.[0]?.regularPrice?.toLocaleString?.() || "N/A"}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={product.status === "ACTIVE" ? "default" : "secondary"}>
                                                    {product.status}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="md:hidden p-3 space-y-2">
                            {products.map((product) => (
                                <div key={product.id} className="border rounded-md p-3 flex items-start justify-between gap-3">
                                    <div className="min-w-0 space-y-1">
                                        <div className="font-medium truncate" title={product.name}>{product.name}</div>
                                        <div className="text-xs text-muted-foreground">SKU: {product.variants?.[0]?.sku || "N/A"}</div>
                                        <div className="text-xs">Price: ${product.variants?.[0]?.regularPrice?.toLocaleString?.() || "N/A"}</div>
                                        <div><Badge variant={product.status === "ACTIVE" ? "default" : "secondary"}>{product.status}</Badge></div>
                                    </div>
                                    <div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleToggleProduct(product.id)}
                                        >
                                            {selectedProducts.has(product.id) ? (
                                                <>
                                                    <Minus className="h-4 w-4 mr-1" /> Remove
                                                </>
                                            ) : (
                                                <>
                                                    <Plus className="h-4 w-4 mr-1" /> Add
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>

                    <div className="flex justify-between items-center px-4 sm:px-0">
                        <div className="text-sm text-muted-foreground">
                            {selectedProducts.size} products selected
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
} 