'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { MoreHorizontal, Edit, Trash2, Package, Eye, Settings, Download, Upload } from 'lucide-react';
import { Product, formatDate, formatCurrency, resolveImageUrl } from '@/lib/api';
import { api } from '@/lib/api';
import { usePermissions } from '@/contexts/auth-context';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import logger from '@/lib/logger';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { SendReportDialog } from '@/components/shared/send-report-dialog';
import { Mail } from 'lucide-react';
import { toast } from 'sonner';

function ProductDetail({ product, onEdit }: { product: Product; onEdit?: () => void }) {
  const primaryImage = product.images?.[0];
  const variants = product.variants || [];
  const origin = (process.env.FRONTEND_URL || (typeof window !== 'undefined' ? window.location.origin : '')) as string;
  const frontendUrl = `${origin}/landing/products/${product.id}`;
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(frontendUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { }
  };

  const statusColor: Record<string, string> = {
    ACTIVE: 'bg-emerald-500/15 text-emerald-700 border-emerald-200',
    DRAFT: 'bg-amber-500/15 text-amber-700 border-amber-200',
    INACTIVE: 'bg-gray-500/15 text-gray-600 border-gray-200',
    ARCHIVED: 'bg-red-500/15 text-red-700 border-red-200',
  };

  return (
    <div className="space-y-0 -mt-2">
      {/* Dark Hero Header */}
      <div className="relative bg-[#070B14] rounded-xl overflow-hidden mb-4">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="absolute top-0 right-0 w-[300px] h-[120px] bg-[#4D7DF2]/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="relative z-10 px-5 py-4 flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center overflow-hidden flex-shrink-0">
            {primaryImage ? (
              <img src={resolveImageUrl(primaryImage.url)} alt={primaryImage.altText || product.name} className="w-full h-full object-cover" />
            ) : (
              <Package className="h-6 w-6 text-gray-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-black text-white text-base leading-snug break-words">{product.name}</div>
            <div className="text-xs text-gray-400 mt-0.5 break-words line-clamp-2 leading-snug">{product.description || 'No description'}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {(product.categories || []).slice(0, 4).map((c, i) => (
                <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/10 text-[10px] text-gray-300 font-medium border border-white/10">{c.name}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
          <div className="text-[10px] text-gray-400 font-medium uppercase tracking-widest leading-none mb-1.5">Status</div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${statusColor[product.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
            {product.status}
          </span>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
          <div className="text-[10px] text-gray-400 font-medium uppercase tracking-widest leading-none mb-1.5">Created</div>
          <div className="text-xs font-semibold text-gray-800">{formatDate(product.createdAt)}</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
          <div className="text-[10px] text-gray-400 font-medium uppercase tracking-widest leading-none mb-1.5">SS SKU</div>
          <div className="text-xs font-mono font-semibold text-gray-700 break-all">{product.shipstationSku || '—'}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-gray-100">
        <a href={frontendUrl} target="_blank" rel="noopener noreferrer">
          <button className="flex items-center gap-1.5 h-8 px-3 bg-[#1B2D4F] hover:bg-[#243d6b] text-white rounded-lg text-xs font-semibold transition-colors">
            <Eye className="h-3.5 w-3.5" />
            View in Store
          </button>
        </a>
        <button onClick={handleCopy} className="flex items-center gap-1.5 h-8 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-colors border border-gray-200">
          {copied ? '✓ Copied' : 'Copy Link'}
        </button>
        {onEdit && (
          <button onClick={onEdit} className="flex items-center gap-1.5 h-8 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-colors border border-gray-200">
            <Edit className="h-3.5 w-3.5" />
            Edit Product
          </button>
        )}
      </div>

      {/* Variants */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-800">Variants</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-xs font-bold text-slate-600">{variants.length}</span>
        </div>
        <div className="rounded-xl border border-gray-200 overflow-x-auto">
          <Table className="w-full min-w-[420px]">
            <TableHeader>
              <TableRow className="bg-gray-50/80">
                <TableHead className="w-32 min-w-[120px] text-xs font-semibold text-gray-500 uppercase tracking-wide">SKU</TableHead>
                <TableHead className="w-28 min-w-[100px] text-xs font-semibold text-gray-500 uppercase tracking-wide">SS SKU</TableHead>
                <TableHead className="min-w-[120px] text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</TableHead>
                <TableHead className="text-right w-20 min-w-[72px] text-xs font-semibold text-gray-500 uppercase tracking-wide">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variants.map(v => (
                <TableRow key={v.id} className="hover:bg-gray-50/60">
                  <TableCell className="font-mono break-all text-xs leading-snug align-top py-2.5 text-gray-700">{v.sku}</TableCell>
                  <TableCell className="break-all text-xs leading-snug text-gray-400 align-top py-2.5">
                    {v.shipstationSku || '—'}
                  </TableCell>
                  <TableCell className="text-xs leading-snug align-top py-2.5 whitespace-normal text-gray-700">{v.name}</TableCell>
                  <TableCell className="text-right text-xs font-bold align-top py-2.5 text-gray-800">{formatCurrency(v.salePrice || v.regularPrice)}</TableCell>
                </TableRow>
              ))}
              {variants.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-sm text-gray-400">No variants</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

interface ProductsTableProps {
  products: Product[];
  loading: boolean;
  onEdit: (product: Product) => void;
  onDelete: (productId: string) => void;
  onManageVariants: (product: Product) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function productsToExcel(products: Product[]) {
  const exportData = products.map((p) => ({
    'Product Name': p.name,
    'ShipStation SKU': p.shipstationSku || '',
    'Primary SKU': p.variants?.[0]?.sku || '',
    'Status': p.status,
    'Price Range': (p.variants && p.variants.length > 0)
      ? `${Math.min(...p.variants.map(v => v.salePrice || v.regularPrice))} - ${Math.max(...p.variants.map(v => v.salePrice || v.regularPrice))}`
      : '',
    'Categories': (p.categories || []).map(c => c.name).join(', '),
    'Created At': p.createdAt ? new Date(p.createdAt).toLocaleString() : ''
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  return wb;
}

export function ProductsTable({
  products,
  loading,
  onEdit,
  onDelete,
  onManageVariants,
  currentPage,
  totalPages,
  onPageChange,
}: ProductsTableProps) {
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [productToArchive, setProductToArchive] = useState<Product | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<null | 'delete' | 'export'>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const { canDelete, canUpdate } = usePermissions();

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [pricingDialogOpen, setPricingDialogOpen] = useState(false);
  const [selectedProductForPricing, setSelectedProductForPricing] = useState<Product | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const isMobile = useIsMobile();

  const openViewProduct = async (productId: string) => {
    setViewLoading(true);
    setViewDialogOpen(true);
    try {
      const response = await api.getProduct(productId);
      if (response.success && response.data) {
        setViewProduct(response.data);
      } else {
        toast.error('Failed to load product');
        setViewDialogOpen(false);
      }
    } catch (error) {
      logger.error('Failed to load product', { error });
      toast.error('Failed to load product');
      setViewDialogOpen(false);
    } finally {
      setViewLoading(false);
    }
  };

  const openPricingDialog = (product: Product) => {
    setSelectedProductForPricing(product);
    setPricingDialogOpen(true);
  };

  const allSelected = products.length > 0 && selected.length === products.length;
  const toggleSelectAll = () => {
    if (allSelected) setSelected([]);
    else setSelected(products.map(p => p.id));
  };
  const toggleSelect = (id: string) => {
    setSelected(sel => sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]);
  };

  const handleBulkDelete = async () => {
    if (selected.length === 0) return;
    // Call backend bulk delete endpoint
    try {
      const response = await api.post('/products/bulk-delete', { ids: selected });
      if (!response.success) {
        logger.error('Bulk delete failed:', { error: response.error });
      }
    } catch (err) {
      logger.error('Bulk delete request error:', { error: err });
    }
    setSelected([]);
    setBulkAction(null);
    // Optionally, refresh products list here
  };

  const handleBulkExport = () => {
    const selectedProducts = products.filter(p => selected.includes(p.id));
    const wb = productsToExcel(selectedProducts);
    const fileName = `products-selected-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    setBulkAction(null);
  };

  const handleExportAll = async () => {
    if (isMobile) {
      setShowEmailDialog(true);
      return;
    }
    setExportLoading(true);
    try {
      const blob = await api.exportProducts();
      const timestamp = new Date().toISOString().split('T')[0];
      saveAs(blob, `products-export-${timestamp}.xlsx`);
    } catch (error) {
      logger.error('Failed to export products:', { error: error });
      alert('Failed to export products. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  const handleSendEmailReport = async (email: string) => {
    return api.sendProductsEmailReport({ email });
  };

  const handleUpdateProducts = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUpdateLoading(true);
    setUpdateMessage(null);

    try {
      const response = await api.updateProductsFromExcel(file);
      if (response.success && response.data) {
        const stats = response.data.stats;
        setUpdateMessage({
          type: 'success',
          message: `✅ Update successful! Products: ${stats.productsUpdated}, Variants: ${stats.variantsUpdated}, Prices: ${stats.segmentPricesUpdated}, Inventory: ${stats.inventoryUpdated}, Product Images: ${stats.productImagesUpdated}, Variant Images: ${stats.variantImagesUpdated}`
        });
        // Refresh page after 2 seconds
        setTimeout(() => window.location.reload(), 2000);
      } else {
        throw new Error(response.error || 'Update failed');
      }
    } catch (error) {
      logger.error('Failed to update products:', { error: error });
      setUpdateMessage({
        type: 'error',
        message: `❌ Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setUpdateLoading(false);
      event.target.value = ''; // Reset input
    }
  };

  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (productToDelete) {
      onDelete(productToDelete.id);
      setDeleteDialogOpen(false);
      setProductToDelete(null);
    }
  };

  const handleArchiveClick = (product: Product) => {
    setProductToArchive(product);
    setArchiveDialogOpen(true);
  };

  const handleArchiveConfirm = async () => {
    if (productToArchive) {
      try {
        const response = await api.archiveProduct(productToArchive.id);
        if (response.success) {
          // Refresh the page to update the products list
          window.location.reload();
        } else {
          logger.error('Failed to archive product:', { error: response.error });
        }
      } catch (error) {
        logger.error('Failed to archive product:', { error: error });
      }
      setArchiveDialogOpen(false);
      setProductToArchive(null);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'default';
      case 'DRAFT':
        return 'secondary';
      case 'INACTIVE':
        return 'outline';
      case 'ARCHIVED':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800 hover:bg-green-100';
      case 'DRAFT':
        return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100';
      case 'INACTIVE':
        return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
      case 'ARCHIVED':
        return 'bg-red-100 text-red-800 hover:bg-red-100';
      default:
        return '';
    }
  };

  const getPriceRange = (product: Product) => {
    if (!product.variants || product.variants.length === 0) {
      return 'No variants';
    }

    // Get all prices including segment prices
    const prices = product.variants.flatMap(v => {
      const prices = [v.regularPrice];
      if (v.salePrice) prices.push(v.salePrice);
      if (v.segmentPrices) {
        const filteredSegmentPrices = v.segmentPrices.filter(sp => sp.customerType === 'B2C' || sp.customerType === 'ENTERPRISE_1');
        prices.push(...filteredSegmentPrices.map(sp => sp.regularPrice));
        prices.push(...filteredSegmentPrices.map(sp => sp.salePrice || 0).filter(p => p > 0));
      }
      return prices;
    });

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    if (minPrice === maxPrice) {
      return formatCurrency(minPrice);
    }

    return `${formatCurrency(minPrice)} - ${formatCurrency(maxPrice)}`;
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center space-x-4 p-4">
            <div className="w-16 h-16 bg-gray-200 rounded-md animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-1/4" />
              <div className="h-3 bg-gray-200 rounded animate-pulse w-1/6" />
            </div>
            <div className="h-8 bg-gray-200 rounded animate-pulse w-20" />
            <div className="h-8 bg-gray-200 rounded animate-pulse w-8" />
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-8">
        <Package className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No products</h3>
        <p className="mt-1 text-sm text-gray-500">Get started by creating a new product.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-3 border-b bg-muted/30 gap-3">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {selected.length > 0 ? `${selected.length} selected` : 'No items selected'}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setBulkAction('delete')} className="h-8">
                  Delete
                </Button>
                <Button variant="outline" size="sm" onClick={handleBulkExport} className="h-8">
                  Export
                </Button>
              </div>
            )}
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleUpdateProducts}
                  disabled={updateLoading}
                  className="hidden"
                  id="products-update-upload"
                />
                <label htmlFor="products-update-upload">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updateLoading}
                    className="h-8 gap-2 cursor-pointer w-full"
                    asChild
                  >
                    <span>
                      <Upload className="h-4 w-4" />
                      {updateLoading ? 'Updating' : 'Update'}
                    </span>
                  </Button>
                </label>
              </div>
              <Button
                variant={isMobile ? "default" : "outline"}
                size="sm"
                onClick={handleExportAll}
                disabled={exportLoading}
                className="h-8 gap-2 flex-1 sm:flex-none"
              >
                {isMobile ? <Mail className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                {exportLoading ? '...' : (isMobile ? 'Email Report' : 'Export All')}
              </Button>
            </div>
          </div>
        </div>
        {updateMessage && (
          <div className={`p-3 border-b ${updateMessage.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <p className={`text-sm ${updateMessage.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
              {updateMessage.message}
            </p>
          </div>
        )}

        <div className="overflow-x-auto">
          <Table className="min-w-[1000px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} /></TableHead>
                <TableHead className="min-w-[200px]">Product</TableHead>
                <TableHead className="min-w-[140px]">ShipStation SKU</TableHead>
                <TableHead className="min-w-[100px]">Status</TableHead>
                <TableHead className="min-w-[150px]">Categories</TableHead>
                <TableHead className="min-w-[120px]">Variants</TableHead>
                <TableHead className="min-w-[130px]">Total Inventory</TableHead>
                <TableHead className="min-w-[140px]">Price Range</TableHead>
                <TableHead className="min-w-[120px]">Created</TableHead>
                <TableHead className="text-right sticky right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 border-l">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow
                  key={product.id}
                  className="cursor-pointer hover:bg-muted/50 group"
                  onClick={() => openViewProduct(product.id)}
                >
                  <TableCell data-label="Select" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.includes(product.id)} onChange={() => toggleSelect(product.id)} />
                  </TableCell>
                  <TableCell data-label="Product">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gray-100 rounded-md flex items-center justify-center shrink-0">
                        {product.images && product.images.length > 0 ? (
                          <img
                            src={resolveImageUrl(product.images[0].url)}
                            alt={product.images[0].altText || product.name}
                            className="w-full h-full object-cover rounded-md"
                          />
                        ) : (
                          <Package className="h-6 w-6 text-gray-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate max-w-[180px]">{product.name}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                          {product.description || 'No description'}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell data-label="ShipStation SKU">
                    <div className="font-mono text-sm text-muted-foreground">
                      {product.shipstationSku || '-'}
                    </div>
                  </TableCell>
                  <TableCell data-label="Status">
                    <Badge
                      variant={getStatusBadgeVariant(product.status)}
                      className={getStatusColor(product.status)}
                    >
                      {product.status}
                    </Badge>
                  </TableCell>
                  <TableCell data-label="Categories">
                    <div className="flex flex-wrap gap-1 max-w-[150px]">
                      {product.categories && product.categories.length > 0 ? (
                        product.categories.slice(0, 2).map((category, index) => (
                          <Badge key={index} variant="outline" className="text-[10px] px-1 h-5">
                            {category.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">No categories</span>
                      )}
                      {product.categories && product.categories.length > 2 && (
                        <Badge variant="outline" className="text-[10px] px-1 h-5">
                          +{product.categories.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell data-label="Variants" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary" className="text-xs">
                        {product._count?.variants || 0}
                      </Badge>
                      {product.variants && product.variants.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/products/edit/${product.id}?tab=variants`)}
                          className="h-7 px-2"
                        >
                          <Settings className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell data-label="Available Inventory">
                    <span className="text-sm">
                      {product.variants && product.variants.length > 0
                        ? product.variants.reduce((sum, variant) =>
                          sum + (variant.inventory ? variant.inventory.reduce((invSum, inv) => invSum + ((inv.quantity || 0) - (inv.reservedQty || 0)), 0) : 0)
                          , 0)
                        : 0}
                    </span>
                  </TableCell>
                  <TableCell
                    data-label="Price Range"
                  >
                    <span className="font-medium text-sm">
                      {getPriceRange(product)}
                    </span>
                  </TableCell>
                  <TableCell data-label="Created">
                    <span className="text-sm text-muted-foreground">
                      {formatDate(product.createdAt)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right sticky right-0 bg-background group-hover:bg-muted/50 z-10 border-l" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openViewProduct(product.id)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Product
                        </DropdownMenuItem>
                        {canUpdate('PRODUCTS') && (
                          <DropdownMenuItem onClick={() => onEdit(product)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Product
                          </DropdownMenuItem>
                        )}
                        {canUpdate('PRODUCTS') && (
                          <DropdownMenuItem onClick={() => onManageVariants(product)}>
                            <Settings className="mr-2 h-4 w-4" />
                            Manage Variants
                          </DropdownMenuItem>
                        )}
                        {canDelete('PRODUCTS') && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleArchiveClick(product)}
                            >
                              <Package className="mr-2 h-4 w-4" />
                              Archive Product
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(product)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Product
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
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
        </div>
      )}

      {/* Bulk Actions Toolbar moved to table header */}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete{' '}
              <strong>{productToDelete?.name}</strong>?{' '}
              This will permanently delete the product and all associated variants, images, categories, tags, and inventory data from the database. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive{' '}
              <strong>{productToArchive?.name}</strong>?{' '}
              This will set the product status to ARCHIVED. The product will be hidden from active listings but can be restored later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchiveConfirm}
            >
              Archive Product
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkAction === 'delete'} onOpenChange={(open) => !open && setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Products</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{selected.length}</strong> selected product{selected.length === 1 ? '' : 's'}? This action cannot be undone and will remove associated variants.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Selected
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Product Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="w-[96vw] sm:max-w-[680px] max-h-[90vh] overflow-y-auto p-5">
          <DialogHeader className="sr-only">
            <DialogTitle>Product Details</DialogTitle>
            <DialogDescription>Full product information</DialogDescription>
          </DialogHeader>
          {viewLoading ? (
            <div className="py-12 text-center">
              <div className="inline-flex items-center gap-2 text-sm text-gray-400">
                <Package className="h-4 w-4 animate-pulse" />
                Loading product...
              </div>
            </div>
          ) : viewProduct ? (
            <ProductDetail product={viewProduct} onEdit={() => { setViewDialogOpen(false); onEdit(viewProduct); }} />
          ) : (
            <div className="py-8 text-center text-red-600">Failed to load product.</div>
          )}
        </DialogContent>
      </Dialog>

      {/* Pricing Details Dialog */}
      <Dialog open={pricingDialogOpen} onOpenChange={setPricingDialogOpen}>
        <DialogContent className="sm:max-w-[1200px] max-h-[90vh] overflow-y-auto bg-background text-foreground">
          <DialogHeader className="flex-shrink-0 pb-4">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <Package className="h-5 w-5" />
              Pricing Details - {selectedProductForPricing?.name}
            </DialogTitle>
            <DialogDescription>
              Segment pricing for all customer types and product variants
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 pr-2">
            {selectedProductForPricing && (
              <div className="space-y-6">
                {/* Product Summary */}
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h3 className="font-semibold text-lg mb-2">{selectedProductForPricing.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedProductForPricing.description || 'No description available'}
                  </p>
                </div>

                {/* Variants Pricing Table */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold">Variants & Pricing</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <Table className="min-w-[1200px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[200px]">Variant</TableHead>
                            <TableHead className="min-w-[120px]">SKU</TableHead>
                            <TableHead className="min-w-[150px]">ShipStation SKU</TableHead>
                            <TableHead className="min-w-[100px]">Regular Price</TableHead>
                            <TableHead className="min-w-[100px]">Sale Price</TableHead>
                            <TableHead className="min-w-[100px]">Wholesale</TableHead>
                            <TableHead className="min-w-[100px]">Enterprise</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedProductForPricing.variants?.map((variant) => (
                            <TableRow key={variant.id}>
                              <TableCell className="font-medium">
                                <div>
                                  <div className="font-semibold">{variant.name}</div>
                                  {variant.description && (
                                    <div className="text-sm text-muted-foreground">
                                      {variant.description}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {variant.sku || 'N/A'}
                              </TableCell>
                              <TableCell className="font-mono text-sm text-muted-foreground">
                                {variant.shipstationSku || '-'}
                              </TableCell>
                              <TableCell className="font-semibold">
                                {formatCurrency(variant.regularPrice || 0)}
                              </TableCell>
                              <TableCell className="text-green-600 font-semibold">
                                {variant.salePrice ? formatCurrency(variant.salePrice) : 'N/A'}
                              </TableCell>
                              <TableCell className="text-blue-600">
                                {variant.segmentPrices?.find(sp => sp.customerType === 'B2C')?.regularPrice
                                  ? formatCurrency(variant.segmentPrices.find(sp => sp.customerType === 'B2C')!.regularPrice)
                                  : formatCurrency(variant.regularPrice || 0)
                                }
                              </TableCell>
                              <TableCell className="text-orange-600">
                                {variant.segmentPrices?.find(sp => sp.customerType === 'ENTERPRISE_1')?.regularPrice
                                  ? formatCurrency(variant.segmentPrices.find(sp => sp.customerType === 'ENTERPRISE_1')!.regularPrice)
                                  : formatCurrency(variant.regularPrice || 0)
                                }
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <SendReportDialog
        open={showEmailDialog}
        onOpenChange={setShowEmailDialog}
        onSend={handleSendEmailReport}
        title="Email Product Catalog"
        description="Enter the email address where you want to receive the full product catalog report."
      />
    </div>
  );
}