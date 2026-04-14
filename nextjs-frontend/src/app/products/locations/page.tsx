'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { ProtectedRoute } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { MapPin, Plus, Search } from 'lucide-react';
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
        <div className="space-y-0">

          {/* ════════ DARK HERO STRIP ════════ */}
          <div className="relative bg-[#070B14] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#4D7DF2]/8 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
              {/* Top row */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-xl font-black text-white tracking-tight">Warehouse Locations</h1>
                  <p className="text-xs text-gray-500 mt-0.5">Manage storage facilities and warehouse sites</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-2">
                    <MapPin className="h-4 w-4 text-[#4D7DF2]" />
                    <div>
                      <p className="text-[9px] text-gray-500 font-medium uppercase tracking-widest leading-none">Total</p>
                      <p className="text-base font-black text-white tabular-nums leading-tight">{locations.length.toLocaleString()}</p>
                    </div>
                  </div>
                  <Button
                    onClick={handleAddLocation}
                    className="h-9 px-5 bg-white text-[#070B14] hover:bg-gray-100 rounded-xl text-xs font-black uppercase tracking-widest"
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Location
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* ════════ COMPACT FILTER ROW ════════ */}
          <div className="px-1 sm:px-0 py-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                placeholder="Search warehouse locations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9 bg-white border-gray-200 rounded-xl text-xs placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* ════════ TABLE ════════ */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden mx-1 sm:mx-0">
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
