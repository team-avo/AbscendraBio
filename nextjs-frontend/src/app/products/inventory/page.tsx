'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { ProtectedRoute } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, PackageCheck, PackageX, ArrowUpDown, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '@/lib/api';
import logger from '@/lib/logger';
import { toast } from 'sonner';
import { InventoryTable } from '@/components/products/inventory/inventory-table';
import { AdjustInventoryDialog } from '@/components/products/inventory/adjust-inventory-dialog';
import { InventoryMovementDialog } from '@/components/products/inventory/inventory-movement-dialog';
import { ManageLocationsDialog } from '@/components/products/inventory/manage-locations-dialog';

interface InventoryLocation {
  id: string;
  name: string;
}

interface InventoryItem {
  id: string;
  quantity: number;
  reservedQty?: number;
  lowStockAlert: number;
  variant: {
    id: string;
    sku: string;
    name: string;
    product: {
      name: string;
      status: string;
    };
  };
  location: {
    id: string;
    name: string;
  };
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [outOfStockOnly, setOutOfStockOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [showMovementDialog, setShowMovementDialog] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState<InventoryItem | null>(null);
  const [showLocationsDialog, setShowLocationsDialog] = useState(false);

  const ITEMS_PER_PAGE = 10;

  const fetchLocations = async () => {
    try {
      const response = await api.getLocations();
      if (response.success && response.data) {
        setLocations(response.data as any);
      }
    } catch (error) {
      logger.error('Failed to fetch locations:', { error });
      toast.error('Failed to load locations');
    }
  };

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        search: searchTerm || undefined,
        locationId: locationFilter !== 'all' ? locationFilter : undefined,
        lowStock: lowStockFilter || undefined,
        outOfStock: outOfStockOnly || undefined,
      };

      const response = await api.getInventory(params);

      if (response.success && response.data) {
        setInventory((response.data as any).inventory as InventoryItem[] || []);
        setTotalItems((response.data as any).pagination.total);
        setTotalPages((response.data as any).pagination.pages);
      }
    } catch (error) {
      logger.error('Failed to fetch inventory:', { error });
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [currentPage, searchTerm, locationFilter, lowStockFilter, outOfStockOnly]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleLocationFilter = (value: string) => {
    setLocationFilter(value);
    setCurrentPage(1);
  };

  const handleLowStockFilter = (value: 'all' | 'low' | 'out') => {
    setLowStockFilter(value === 'low');
    setOutOfStockOnly(value === 'out');
    setCurrentPage(1);
  };

  const handleAdjustInventory = (inventory: any) => {
    setSelectedInventory(inventory);
    setShowAdjustDialog(true);
  };

  const handleCreateMovement = (inventory: any) => {
    setSelectedInventory(inventory);
    setShowMovementDialog(true);
  };

  const handleInventoryUpdated = () => {
    setShowAdjustDialog(false);
    setShowMovementDialog(false);
    setSelectedInventory(null);
    fetchInventory();
    toast.success('Inventory updated successfully');
  };

  // Calculate stats across all filtered items (not paginated)
  const [stats, setStats] = useState({ total: 0, inStock: 0, lowStock: 0, outOfStock: 0 });
  const fetchAllForExport = async (): Promise<any[]> => {
    let page = 1;
    const limit = 100;
    let pages = 1;
    const all: any[] = [];
    try {
      do {
        const response: any = await api.getInventory({
          page,
          limit,
          search: searchTerm || undefined,
          locationId: locationFilter !== 'all' ? locationFilter : undefined,
          lowStock: lowStockFilter || undefined,
          outOfStock: outOfStockOnly || undefined,
        });
        if (response?.success && response?.data) {
          const list = response.data.inventory || [];
          const pagination = response.data.pagination || {};
          pages = pagination.pages || 1;
          all.push(...list);
        } else {
          break;
        }
        page += 1;
      } while (page <= pages);
    } catch (e) {
      // ignore
    }
    return all;
  };

  useEffect(() => {
    (async () => {
      const all = await fetchAllForExport();
      const total = all.length;
      const inStock = all.filter((i: any) => (i.quantity - (i.reservedQty || 0)) > 0).length;
      const lowStock = all.filter((i: any) => {
        const available = (i.quantity - (i.reservedQty || 0));
        return available > 0 && available <= (i.lowStockAlert ?? 0);
      }).length;
      const outOfStock = all.filter((i: any) => (i.quantity - (i.reservedQty || 0)) <= 0).length;
      setStats({ total, inStock, lowStock, outOfStock });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, locationFilter, lowStockFilter, outOfStockOnly]);

  const exportRowsToExcel = (rows: any[]) => {
    const data = rows.map((item: any) => ({
      SKU: item.variant?.sku,
      Product: item.variant?.product?.name,
      Variant: item.variant?.name,
      Location: item.location?.name,
      Quantity: item.quantity,
      'Low Stock Alert': item.lowStockAlert,
      Status: item.quantity === 0 ? 'Out of Stock' : (item.quantity <= item.lowStockAlert ? 'Low Stock' : 'In Stock'),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    return wb;
  };

  const handleExportFiltered = async () => {
    const all = await fetchAllForExport();
    const wb = exportRowsToExcel(all);
    XLSX.writeFile(wb, `inventory-filtered-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportAll = async () => {
    // For now, same as filtered because listing is already filtered by UI
    await handleExportFiltered();
  };

  return (
    <ProtectedRoute requiredRoles={['ADMIN', 'MANAGER']}>
      <DashboardLayout>
        <div className="space-y-5 px-2 sm:px-0">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Inventory Management</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Manage product inventory levels and stock movements
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => setShowLocationsDialog(true)}
                variant="outline"
                className="h-9 px-4 rounded-xl text-sm"
              >
                Manage Locations
              </Button>
              <Button
                onClick={() => setShowMovementDialog(true)}
                className="h-9 px-4 bg-[#1B2D4F] hover:bg-[#243d6b] text-white rounded-xl text-sm font-medium"
              >
                <ArrowUpDown className="mr-2 h-4 w-4" />
                Record Movement
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Total Variants */}
            <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm px-5 py-4">
              <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                <Package className="h-5 w-5 text-slate-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Total Variants</p>
                <p className="text-xl font-bold text-slate-900">{stats.total}</p>
              </div>
            </div>

            {/* In Stock */}
            <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm px-5 py-4">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <PackageCheck className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">In Stock</p>
                <p className="text-xl font-bold text-emerald-600">{stats.inStock}</p>
              </div>
            </div>

            {/* Low Stock */}
            <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm px-5 py-4">
              <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                <Package className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Low Stock</p>
                <p className="text-xl font-bold text-amber-600">{stats.lowStock}</p>
              </div>
            </div>

            {/* Out of Stock — dark navy hero chip */}
            <div className="relative flex items-center gap-3 bg-[#1B2D4F] rounded-2xl shadow-sm px-5 py-4 overflow-hidden">
              <div className="absolute -top-4 -right-4 h-20 w-20 rounded-full bg-white/5" />
              <div className="absolute -bottom-6 -left-2 h-16 w-16 rounded-full bg-white/5" />
              <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 relative">
                <PackageX className="h-5 w-5 text-red-400" />
              </div>
              <div className="relative">
                <p className="text-xs text-slate-400 font-medium">Out of Stock</p>
                <p className="text-2xl font-bold text-white">{stats.outOfStock}</p>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search items..."
                className="pl-10 w-full"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select
                value={outOfStockOnly ? 'out' : (lowStockFilter ? 'low' : 'all')}
                onValueChange={(value) => handleLowStockFilter(value as any)}
              >
                <SelectTrigger className="w-full sm:w-[200px] text-sm">
                  <SelectValue placeholder="Stock level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stock Levels</SelectItem>
                  <SelectItem value="low">Low Stock Only</SelectItem>
                  <SelectItem value="out">Out of Stock Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Inventory Table (has its own card styling internally) */}
          <InventoryTable
            inventory={inventory}
            loading={loading}
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
            onAdjustInventory={handleAdjustInventory}
            onCreateMovement={handleCreateMovement}
            onRefresh={fetchInventory}
            onExportFiltered={handleExportFiltered}
            onExportAll={handleExportAll}
            filtersApplied={Boolean(searchTerm || (locationFilter !== 'all') || lowStockFilter || outOfStockOnly)}
          />

          {/* Dialogs */}
          {showAdjustDialog && selectedInventory && (
            <AdjustInventoryDialog
              inventory={selectedInventory}
              open={showAdjustDialog}
              onClose={() => setShowAdjustDialog(false)}
              onSuccess={handleInventoryUpdated}
            />
          )}

          {showMovementDialog && (
            <InventoryMovementDialog
              inventory={selectedInventory || undefined}
              locations={locations}
              open={showMovementDialog}
              onClose={() => setShowMovementDialog(false)}
              onSuccess={handleInventoryUpdated}
            />
          )}

          {/* Locations Management Dialog */}
          {showLocationsDialog && (
            <ManageLocationsDialog
              open={showLocationsDialog}
              onClose={() => setShowLocationsDialog(false)}
              onSuccess={fetchLocations}
              locations={locations}
            />
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
