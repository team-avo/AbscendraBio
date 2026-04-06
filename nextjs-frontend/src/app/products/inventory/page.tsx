'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { ProtectedRoute } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Inventory Management</h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Manage product inventory levels and stock movements
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
              <Button onClick={() => setShowLocationsDialog(true)} variant="secondary" size="sm" className="sm:size-default">
                Manage Locations
              </Button>
              <Button onClick={() => setShowMovementDialog(true)} size="sm" className="sm:size-default">
                <ArrowUpDown className="mr-2 h-4 w-4" />
                Record Movement
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 w-full">
            <Card className="py-0.5 gap-0 sm:py-3 sm:gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-3 sm:pb-1">
                <CardTitle className="text-[10px] sm:text-xs font-medium">Total Variants</CardTitle>
                <Package className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-2 pt-0 sm:p-3 sm:pt-0">
                <div className="text-base sm:text-lg lg:text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            <Card className="py-0.5 gap-0 sm:py-3 sm:gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-3 sm:pb-1">
                <CardTitle className="text-[10px] sm:text-xs font-medium">In Stock</CardTitle>
                <PackageCheck className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
              </CardHeader>
              <CardContent className="p-2 pt-0 sm:p-3 sm:pt-0">
                <div className="text-base sm:text-lg lg:text-2xl font-bold text-green-600">{stats.inStock}</div>
              </CardContent>
            </Card>
            <Card className="py-0.5 gap-0 sm:py-3 sm:gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-3 sm:pb-1">
                <CardTitle className="text-[10px] sm:text-xs font-medium">Low Stock</CardTitle>
                <Package className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-600" />
              </CardHeader>
              <CardContent className="p-2 pt-0 sm:p-3 sm:pt-0">
                <div className="text-base sm:text-lg lg:text-2xl font-bold text-yellow-600">{stats.lowStock}</div>
              </CardContent>
            </Card>
            <Card className="py-0.5 gap-0 sm:py-3 sm:gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-3 sm:pb-1">
                <CardTitle className="text-[10px] sm:text-xs font-medium">Out of Stock</CardTitle>
                <PackageX className="h-3 w-3 sm:h-4 sm:w-4 text-red-600" />
              </CardHeader>
              <CardContent className="p-2 pt-0 sm:p-3 sm:pt-0">
                <div className="text-xl sm:text-2xl font-bold text-red-600">{stats.outOfStock}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Search and filter inventory</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 w-full min-w-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search items..."
                      className="pl-10 text-sm w-full"
                      value={searchTerm}
                      onChange={(e) => handleSearch(e.target.value)}
                    />
                  </div>
                </div>
                {/* <div className="w-[200px]">
                  <Select value={locationFilter} onValueChange={handleLocationFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Locations</SelectItem>
                      {locations.map((location: any) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div> */}
                <div className="w-full sm:w-[200px]">
                  <Select
                    value={outOfStockOnly ? 'out' : (lowStockFilter ? 'low' : 'all')}
                    onValueChange={(value) => handleLowStockFilter(value as any)}
                  >
                    <SelectTrigger className="text-sm">
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
            </CardContent>
          </Card>

          {/* Inventory Table */}
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