"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
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
import { api, Product } from '@/lib/api';
import Papa from 'papaparse';

const StatusBadge = ({ status }: { status: string }) => {
    const variants: { [key: string]: { variant: "default" | "secondary" | "destructive" | "outline", label: string } } = {
        active: { variant: "default", label: "Active" },
        low_stock: { variant: "destructive", label: "Low Stock" },
        out_of_stock: { variant: "outline", label: "Out of Stock" },
        draft: { variant: "secondary", label: "Draft" },
        inactive: { variant: "outline", label: "Inactive" }
    };

    const config = variants[status.toLowerCase()] || { variant: "outline", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
};

export function ProductsContent() {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [tagFilter, setTagFilter] = useState("");
    const [viewMode, setViewMode] = useState<"table" | "grid">("table");
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [allTags, setAllTags] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [importedRows, setImportedRows] = useState<any[]>([]);
    const [importPreview, setImportPreview] = useState<any[]>([]);

    const handleImportClick = () => fileInputRef.current?.click();
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        Papa.parse(file, {
            header: true,
            complete: (results) => {
                setImportPreview(results.data.slice(0, 5));
                setImportedRows(results.data);
                setImportDialogOpen(true);
            },
        });
    };
    const handleImportConfirm = async () => {
        await fetch('/api/products/bulk-import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ products: importedRows }),
        });
        setImportDialogOpen(false);
        setImportedRows([]);
        setImportPreview([]);
    };

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (searchTerm) params.search = searchTerm;
            if (categoryFilter !== "all") params.category = categoryFilter;
            if (statusFilter !== "all") params.status = statusFilter;
            if (tagFilter) params.tag = tagFilter;
            const response = await api.getProducts(params);
            if (response.success && response.data && response.data.products) {
                setProducts(response.data.products);
                const tagsSet = new Set<string>();
                response.data.products.forEach((p: Product) => {
                    if (p.tags) p.tags.forEach(t => tagsSet.add(t.tag));
                });
                setAllTags(Array.from(tagsSet));
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
        // eslint-disable-next-line
    }, [searchTerm, categoryFilter, statusFilter, tagFilter]);

    const getProductStock = (p: Product) => {
        return p.variants?.reduce((sum, v) => sum + (v.inventory?.reduce((s, i) => s + i.quantity, 0) || 0), 0) || 0;
    };

    const getProductPrice = (p: Product) => {
        return p.variants?.[0]?.regularPrice || 0;
    };

    const filteredProducts = products.filter(product => {
        const productSku = product.shipstationSku || '';
        const productCategory = product.categories?.[0]?.name || '';

        const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            productSku.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (product.description || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === "all" || productCategory === categoryFilter;
        const matchesStatus = statusFilter === "all" || product.status.toLowerCase() === statusFilter.toLowerCase();

        return matchesSearch && matchesCategory && matchesStatus;
    });

    const productStats = {
        total: products.length,
        active: products.filter(p => p.status === "ACTIVE").length,
        lowStock: products.filter(p => {
            const stock = getProductStock(p);
            return stock > 0 && stock < 10;
        }).length,
        outOfStock: products.filter(p => getProductStock(p) === 0).length,
        totalValue: products.reduce((sum, product) => sum + (getProductPrice(product) * getProductStock(product)), 0)
    };

    const categories = Array.from(new Set(products.map(p => p.categories?.[0]?.name).filter(Boolean) as string[]));

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Products</h1>
                    <p className="text-muted-foreground">
                        Manage your peptide inventory and product catalog
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" className="w-full sm:w-auto">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                    </Button>
                    <Button onClick={() => router.push('/products/create')} className="w-full sm:w-auto">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Product
                    </Button>
                    <Button onClick={handleImportClick} className="w-full sm:w-auto">Import</Button>
                    <input type="file" ref={fileInputRef} accept=".csv" style={{ display: 'none' }} onChange={handleFileChange} />
                </div>
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-center">
                <Input
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full sm:w-[200px]"
                />
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filter by category" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[150px]">
                        <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="DRAFT">Draft</SelectItem>
                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                        <SelectItem value="ARCHIVED">Archived</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={tagFilter} onValueChange={setTagFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filter by tag" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="">All Tags</SelectItem>
                        {allTags.map(tag => (
                            <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{productStats.total}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">{productStats.lowStock}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{productStats.outOfStock}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ${productStats.totalValue.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Products List</CardTitle>
                            <CardDescription>
                                View and manage all products in your catalog
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant={viewMode === "table" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setViewMode("table")}
                            >
                                <List className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={viewMode === "grid" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setViewMode("grid")}
                            >
                                <Grid3X3 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4 mb-6">
                        <div className="flex-1">
                            <Label htmlFor="search">Search Products</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    id="search"
                                    placeholder="Search by name, SKU, or description..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="category-filter">Category</Label>
                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                <SelectTrigger className="w-48">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Categories</SelectItem>
                                    {categories.map(category => (
                                        <SelectItem key={category} value={category}>{category}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="status-filter">Status</Label>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-40">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="ACTIVE">Active</SelectItem>
                                    <SelectItem value="DRAFT">Draft</SelectItem>
                                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {viewMode === "table" && (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Product</TableHead>
                                        <TableHead>SKU</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Price</TableHead>
                                        <TableHead>Stock</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Performance</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredProducts.map((product) => {
                                        const productSku = product.shipstationSku || 'N/A';
                                        const productCategory = product.categories?.[0]?.name || 'Uncategorized';
                                        const productImage = product.images?.[0]?.url || '/logo.png';
                                        const productPrice = getProductPrice(product);
                                        const productSalePrice = product.variants?.[0]?.salePrice;
                                        const productStock = getProductStock(product);

                                        return (
                                            <TableRow key={product.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-12 w-12">
                                                            <AvatarImage src={productImage} alt={product.name} />
                                                            <AvatarFallback>{product.name.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <div className="font-medium">{product.name}</div>
                                                            <div className="text-sm text-muted-foreground line-clamp-1">
                                                                {product.description}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-mono text-sm">{productSku}</TableCell>
                                                <TableCell>{productCategory}</TableCell>
                                                <TableCell>
                                                    <div>
                                                        {productSalePrice ? (
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium">${productSalePrice}</span>
                                                                <span className="line-through text-muted-foreground text-sm">
                                                                    ${productPrice}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="font-medium">${productPrice}</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <span>{productStock}</span>
                                                        <Progress
                                                            value={Math.min(100, (productStock / 100) * 100)}
                                                            className="w-16 h-2"
                                                        />
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <StatusBadge status={product.status} />
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm">
                                                        <div className="flex items-center gap-1">
                                                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                                            <span>{product._count?.reviews ? 4.5 : 0}</span>
                                                            <span className="text-muted-foreground">({product._count?.reviews || 0})</span>
                                                        </div>
                                                        <div className="text-muted-foreground">
                                                            0 sales
                                                        </div>
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
                                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                            <DropdownMenuItem>
                                                                <Eye className="mr-2 h-4 w-4" />
                                                                View Details
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem>
                                                                <Edit className="mr-2 h-4 w-4" />
                                                                Edit Product
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem>
                                                                Duplicate Product
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem className="text-red-600">
                                                                Delete Product
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {viewMode === "grid" && (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {filteredProducts.map((product) => {
                                const productSku = product.shipstationSku || 'N/A';
                                const productImage = product.images?.[0]?.url || '/logo.png';
                                const productPrice = getProductPrice(product);
                                const productSalePrice = product.variants?.[0]?.salePrice;
                                const productStock = getProductStock(product);

                                return (
                                    <Card key={product.id} className="overflow-hidden">
                                        <div className="aspect-square relative">
                                            <Image
                                                src={productImage}
                                                alt={product.name}
                                                fill
                                                className="object-cover"
                                            />
                                            <div className="absolute top-2 right-2">
                                                <StatusBadge status={product.status} />
                                            </div>
                                        </div>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-base">{product.name}</CardTitle>
                                            <CardDescription className="text-sm line-clamp-2">
                                                {product.description}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="pt-0">
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-muted-foreground">SKU</span>
                                                    <span className="text-sm font-mono">{productSku}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-muted-foreground">Price</span>
                                                    <div>
                                                        {productSalePrice ? (
                                                            <div className="flex items-center gap-1">
                                                                <span className="font-medium">${productSalePrice}</span>
                                                                <span className="line-through text-muted-foreground text-xs">
                                                                    ${productPrice}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="font-medium">${productPrice}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-muted-foreground">Stock</span>
                                                    <span className="text-sm">{productStock} units</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-muted-foreground">Rating</span>
                                                    <div className="flex items-center gap-1">
                                                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                                        <span className="text-sm">{product._count?.reviews ? 4.5 : 0}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 mt-4">
                                                <Button size="sm" className="flex-1">
                                                    <Edit className="h-3 w-3 mr-1" />
                                                    Edit
                                                </Button>
                                                <Button size="sm" variant="outline">
                                                    <Eye className="h-3 w-3" />
                                                </Button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button size="sm" variant="outline">
                                                            <MoreHorizontal className="h-3 w-3" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem>Duplicate</DropdownMenuItem>
                                                        <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}

                    {filteredProducts.length === 0 && (
                        <div className="text-center py-12">
                            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-medium">No products found</h3>
                            <p className="text-muted-foreground">
                                {searchTerm || categoryFilter !== "all" || statusFilter !== "all"
                                    ? "Try adjusting your search or filters"
                                    : "You don't have any products yet"}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {importDialogOpen && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
                        <h3 className="text-lg font-medium leading-6 text-gray-900">Import Preview</h3>
                        <div className="mt-2 px-7 py-3">
                            <p className="text-sm text-gray-500">Previewing first 5 rows:</p>
                            <pre className="mt-2 text-xs text-gray-700 bg-gray-100 p-2 rounded-md overflow-auto max-h-40">
                                {JSON.stringify(importPreview, null, 2)}
                            </pre>
                        </div>
                        <div className="items-center px-4 py-3">
                            <button
                                onClick={handleImportConfirm}
                                className="px-4 py-2 bg-blue-600 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                Confirm Import
                            </button>
                        </div>
                        <div className="items-center px-4 py-3">
                            <button
                                onClick={() => setImportDialogOpen(false)}
                                className="px-4 py-2 bg-red-600 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
