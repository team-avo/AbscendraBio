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
    await handleExportFiltered();
  };

  // Derive active status pill key
  const activeStockPill = outOfStockOnly ? 'out' : (lowStockFilter ? 'low' : 'all');

  return (
    <ProtectedRoute requiredRoles={['ADMIN', 'MANAGER']}>
      <DashboardLayout>
        <div className="space-y-0">

          {/* ════════ DARK HERO STRIP ════════ */}
          <div className="relative bg-[#070B14] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#4D7DF2]/8 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
              {/* Top row */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-xl font-black text-white tracking-tight">Inventory</h1>
                  <p className="text-xs text-gray-500 mt-0.5">Monitor stock levels and reorder points</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-2">
                    <Package className="h-4 w-4 text-[#4D7DF2]" />
                    <div>
                      <p className="text-[9px] text-gray-500 font-medium uppercase tracking-widest leading-none">Total</p>
                      <p className="text-base font-black text-white tabular-nums leading-tight">{stats.total.toLocaleString()}</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setShowLocationsDialog(true)}
                    className="h-9 px-4 border border-white/10 bg-white/[0.06] text-gray-300 hover:bg-white/[0.12] hover:text-white rounded-xl text-xs font-bold"
                  >
                    Manage Locations
                  </Button>
                  <Button
                    onClick={() => setShowMovementDialog(true)}
                    className="h-9 px-5 bg-white text-[#070B14] hover:bg-gray-100 rounded-xl text-xs font-black uppercase tracking-widest"
                  >
                    <ArrowUpDown className="mr-1.5 h-3.5 w-3.5" /> Record Movement
                  </Button>
                </div>
              </div>

              {/* Status pills */}
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
                {[
                  { key: 'all', label: 'All',          count: stats.total,       color: null,      icon: null },
                  { key: 'in',  label: 'In Stock',     count: stats.inStock,     color: 'emerald', icon: <PackageCheck className="h-3 w-3" /> },
                  { key: 'low', label: 'Low Stock',    count: stats.lowStock,    color: 'amber',   icon: null },
                  { key: 'out', label: 'Out of Stock', count: stats.outOfStock,  color: 'red',     icon: <PackageX className="h-3 w-3" /> },
                ].map((pill) => {
                  const colorStyles: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
                    emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', ring: 'ring-emerald-500/30', dot: 'bg-emerald-400' },
                    amber:   { bg: 'bg-amber-500/15',   text: 'text-amber-400',   ring: 'ring-amber-500/30',   dot: 'bg-amber-400' },
                    red:     { bg: 'bg-red-500/15',     text: 'text-red-400',     ring: 'ring-red-500/30',     dot: 'bg-red-400' },
                  };
                  const c = pill.color ? colorStyles[pill.color] : null;
                  const isAll = pill.key === 'all';
                  const isActive = isAll ? activeStockPill === 'all' : activeStockPill === pill.key;
                  return (
                    <button
                      key={pill.key}
                      onClick={() => handleLowStockFilter(pill.key === 'in' ? 'all' : pill.key as any)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        isAll && isActive ? 'bg-white/15 text-white ring-1 ring-white/20'
                        : isActive && c ? `${c.bg} ${c.text} ring-1 ${c.ring}`
                        : 'bg-white/[0.04] text-gray-500 hover:bg-white/[0.08] hover:text-gray-300'
                      }`}
                    >
                      {c && <span className={`w-1.5 h-1.5 rounded-full ${isActive ? c.dot : 'bg-gray-600'}`} />}
                      <span>{pill.label}</span>
                      <span className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-black tabular-nums ${
                        isAll && isActive ? 'bg-white/20 text-white'
                        : isActive && c ? `${c.bg} ${c.text}`
                        : 'bg-white/[0.06] text-gray-500'
                      }`}>
                        {(pill.count ?? 0).toLocaleString()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ════════ COMPACT FILTER ROW ════════ */}
          <div className="px-1 sm:px-0 py-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 sm:max-w-sm">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10 h-9 bg-white border-gray-200 rounded-xl text-xs placeholder:text-gray-400"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={activeStockPill} onValueChange={(value) => handleLowStockFilter(value as any)}>
                  <SelectTrigger className="h-9 px-3 text-xs border-gray-200 rounded-xl bg-white w-auto min-w-[160px]">
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
          </div>

          {/* ════════ TABLE ════════ */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden mx-1 sm:mx-0">
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
          </div>

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
