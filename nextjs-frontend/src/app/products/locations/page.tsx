'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { ProtectedRoute } from '@/contexts/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
        <div className="space-y-6 p-6">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Warehouse className="h-8 w-8" />
                Warehouse Locations
              </h1>
              <p className="text-muted-foreground mt-2">
                Manage your warehouse and distribution center locations
              </p>
            </div>
            <Button onClick={handleAddLocation} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Warehouse Location
            </Button>
          </div>

          {/* Search and Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Search & Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search warehouse locations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Warehouse Locations Table */}
          <Card>
            <CardHeader>
              <CardTitle>Warehouse Locations</CardTitle>
              <CardDescription>
                {loading
                  ? 'Loading...'
                  : `Showing ${filteredLocations.length} of ${locations.length} warehouse locations`
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WarehouseLocationsTable
                locations={filteredLocations}
                loading={loading}
                onEdit={handleEditLocation}
                onDelete={handleDeleteLocation}
              />
            </CardContent>
          </Card>

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
