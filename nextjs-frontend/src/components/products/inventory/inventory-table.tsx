import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, Settings, MoreHorizontal } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';
import { useMemo, useState } from 'react';
import { ManageBatchesDialog } from './manage-batches-dialog';
import * as XLSX from 'xlsx';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { BulkInventoryDialog } from './bulk-inventory-dialog';

interface InventoryTableProps {
  inventory: Array<{
    id: string;
    quantity: number;
    reservedQty?: number;
    lowStockAlert: number;
    variant: {
      sku: string;
      name: string;
      product: {
        name: string;
        status: string;
      };
    };
    location: {
      name: string;
    };
  }>;
  loading: boolean;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onAdjustInventory: (inventory: any) => void;
  onCreateMovement: (inventory: any) => void;
  onRefresh?: () => void;
  // For filtered export
  onExportFiltered?: () => void;
  // For exporting all (caller handles fetching all pages)
  onExportAll?: () => void;
  filtersApplied?: boolean;
}

export function InventoryTable({
  inventory,
  loading,
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onAdjustInventory,
  onCreateMovement,
  onRefresh,
  onExportFiltered,
  onExportAll,
  filtersApplied,
}: InventoryTableProps) {
  const [selectedInventory, setSelectedInventory] = useState<any | null>(null);
  const [showBatchesDialog, setShowBatchesDialog] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<'adjust' | 'movement'>('adjust');

  const allSelected = useMemo(() => inventory.length > 0 && selectedIds.length === inventory.length, [inventory, selectedIds]);
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(inventory.map(i => i.id));
  };
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleExportSelected = () => {
    const selectedRows = inventory.filter(i => selectedIds.includes(i.id));
    const exportData = selectedRows.map((item) => {
      const availableQuantity = item.quantity - (item.reservedQty || 0);
      return {
        SKU: item.variant.sku,
        Product: item.variant.product.name,
        Variant: item.variant.name,
        Location: item.location.name,
        'Available Quantity': availableQuantity,
        'Total Quantity': item.quantity,
        'Reserved Quantity': item.reservedQty || 0,
        'Low Stock Alert': item.lowStockAlert,
        Status: availableQuantity === 0 ? 'Out of Stock' : (availableQuantity <= item.lowStockAlert ? 'Low Stock' : 'In Stock'),
      };
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, `inventory-selected-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const selectedRows = useMemo(() => inventory.filter(i => selectedIds.includes(i.id)), [inventory, selectedIds]);
  const openBulkAdjust = () => { setBulkMode('adjust'); setBulkOpen(true); };
  const openBulkMovement = () => { setBulkMode('movement'); setBulkOpen(true); };

  const getStockStatus = (quantity: number, reservedQty: number, lowStockAlert: number) => {
    const availableQuantity = quantity - (reservedQty || 0);
    if (availableQuantity === 0) return { label: 'Out of Stock', color: 'destructive' };
    if (availableQuantity <= lowStockAlert) return { label: 'Low Stock', color: 'warning' };
    return { label: 'In Stock', color: 'success' };
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[24px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-[100px]" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-x-auto">
        {/* Header actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-3 border-b bg-muted/30 gap-3">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {selectedIds.length > 0 ? `${selectedIds.length} selected` : 'No items selected'}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              {selectedIds.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleExportSelected} className="flex-1 sm:flex-none h-8">
                  Export Selected
                </Button>
              )}
              {filtersApplied && (
                <Button variant="outline" size="sm" onClick={onExportFiltered} className="flex-1 sm:flex-none h-8">
                  Export Filtered
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={onExportAll} className="flex-1 sm:flex-none h-8">
                Export All
              </Button>
            </div>
            {selectedIds.length > 0 && (
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <Button size="sm" onClick={openBulkAdjust} className="flex-1 sm:flex-none h-8">Bulk Adjust</Button>
                <Button size="sm" onClick={openBulkMovement} className="flex-1 sm:flex-none h-8">Bulk Movement</Button>
              </div>
            )}
          </div>
        </div>
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
              </TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inventory.map((item) => {
              const status = getStockStatus(item.quantity, item.reservedQty || 0, item.lowStockAlert);
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <Checkbox checked={selectedIds.includes(item.id)} onCheckedChange={() => toggleSelect(item.id)} />
                  </TableCell>
                  <TableCell
                    data-label="SKU"
                    className="font-medium cursor-pointer hover:underline"
                    onClick={() => onAdjustInventory(item)}
                    title="Adjust Inventory"
                  >
                    {item.variant.sku}
                  </TableCell>
                  <TableCell data-label="Product">{item.variant.product.name}</TableCell>
                  <TableCell data-label="Variant">{item.variant.name}</TableCell>
                  <TableCell data-label="Location">{item.location.name}</TableCell>
                  <TableCell data-label="Quantity">
                    {item.quantity - (item.reservedQty || 0)}
                  </TableCell>
                  <TableCell data-label="Status">
                    <Badge variant={status.color as any}>{status.label}</Badge>
                  </TableCell>
                  <TableCell data-label="Actions" className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onAdjustInventory(item)}>Adjust Inventory</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onCreateMovement(item)}>Record Movement</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSelectedInventory(item); setShowBatchesDialog(true); }}>Manage Batches</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
            {inventory.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  No inventory records found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t mt-4">
          <p className="text-sm text-muted-foreground text-center sm:text-left font-medium">
            Showing {totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to{' '}
            {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} products
          </p>
          <div className="w-full sm:w-auto overflow-x-auto flex justify-center pb-2 sm:pb-0">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={onPageChange}
            />
          </div>
        </div>
      )}
      <BulkInventoryDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        items={selectedRows as any}
        mode={bulkMode}
        onSuccess={onRefresh}
      />
      {/* Batches Dialog */}
      {showBatchesDialog && selectedInventory && (
        <ManageBatchesDialog
          open={showBatchesDialog}
          onClose={() => setShowBatchesDialog(false)}
          inventory={selectedInventory}
          onSuccess={() => {
            setShowBatchesDialog(false);
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
}