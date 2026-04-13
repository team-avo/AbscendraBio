'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { ProtectedRoute } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { Warehouse, Plus, Search, Edit } from 'lucide-react';
import logger from '@/lib/logger';
import { ManageWarehouseLocationsDialog } from '@/components/products/inventory/manage-warehouse-locations-dialog';
import { WarehouseLocationsTable } from '@/components/products/inventory/warehouse-locations-table';
import { toast } from 'sonner';

interface WarehouseLocation {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  email?: string;
  mobile?: string;
  isActive?: boolean;
}

export default function WarehouseLocationsPage() {
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingLocation, setEditingLocation] = useState<WarehouseLocation | null>(null);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/locations');
      if (response.success) {
        setLocations(response.data || []);
      }
    } catch (error) {
      logger.error('Failed to fetch warehouse locations:', { error });
      toast.error('Failed to load warehouse locations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const handleAddLocation = () => {
    setEditingLocation(null);
    setShowDialog(true);
  };

  const handleEditLocation = (location: WarehouseLocation) => {
    setEditingLocation(location);
    setShowDialog(true);
  };

  const handleDeleteLocation = async (id: string) => {
    try {
      const response = await api.delete(`/locations/${id}`);
      if (response.success) {
        toast.success('Warehouse location deleted');
        fetchLocations();
      }
    } catch (error) {
      logger.error('Failed to delete warehouse location:', { error });
      toast.error('Failed to delete warehouse location');
    }
  };

  // Filter locations based on search term
  const filteredLocations = locations.filter(location => {
    const searchLower = searchTerm.toLowerCase();
    return (
      location.name.toLowerCase().includes(searchLower) ||
      location.address?.toLowerCase().includes(searchLower) ||
      location.city?.toLowerCase().includes(searchLower) ||
      location.state?.toLowerCase().includes(searchLower) ||
      location.email?.toLowerCase().includes(searchLower) ||
      location.mobile?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-5 px-2 sm:px-0">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <Warehouse className="h-5 w-5 text-slate-500" />
                Warehouse Locations
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Manage your warehouse and distribution center locations
              </p>
            </div>
            <Button
              onClick={handleAddLocation}
              className="h-9 px-4 bg-[#1B2D4F] hover:bg-[#243d6b] text-white rounded-xl text-sm font-medium w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Warehouse Location
            </Button>
          </div>

          {/* Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search warehouse locations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
          </div>

          {/* Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-slate-100">
                <Warehouse className="h-4 w-4 text-slate-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Warehouse Locations</h2>
                <p className="text-xs text-slate-400">
                  {loading ? 'Loading...' : `${filteredLocations.length} locations`}
                </p>
              </div>
            </div>
            <WarehouseLocationsTable
              locations={filteredLocations}
              loading={loading}
              onEdit={handleEditLocation}
              onDelete={handleDeleteLocation}
            />
          </div>

          {/* Edit/Add Dialog */}
          <ManageWarehouseLocationsDialog
            open={showDialog}
            onClose={() => {
              setShowDialog(false);
              setEditingLocation(null);
            }}
            onSuccess={() => {
              fetchLocations();
              setShowDialog(false);
              setEditingLocation(null);
            }}
            location={editingLocation}
          />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
