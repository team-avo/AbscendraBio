'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Edit, Trash2, Warehouse } from 'lucide-react';

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

interface WarehouseLocationsTableProps {
  locations: WarehouseLocation[];
  loading: boolean;
  onEdit: (location: WarehouseLocation) => void;
  onDelete: (id: string) => void;
}

export function WarehouseLocationsTable({
  locations,
  loading,
  onEdit,
  onDelete,
}: WarehouseLocationsTableProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<WarehouseLocation | null>(null);

  const handleDeleteClick = (location: WarehouseLocation) => {
    setLocationToDelete(location);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (locationToDelete) {
      onDelete(locationToDelete.id);
      setDeleteConfirmOpen(false);
      setLocationToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setLocationToDelete(null);
  };
  const formatLocationAddress = (loc: WarehouseLocation) => {
    const parts = [];
    if (loc.address) parts.push(loc.address);
    if (loc.city) parts.push(loc.city);
    if (loc.state) parts.push(loc.state);
    if (loc.postalCode) parts.push(loc.postalCode);
    if (loc.country && loc.country !== 'US') parts.push(loc.country);
    return parts.length > 0 ? parts.join(', ') : '-';
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-muted-foreground">Loading warehouse locations...</div>
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="text-center py-12">
        <Warehouse className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No warehouse locations</h3>
        <p className="text-muted-foreground">
          Create your first warehouse location to get started
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Warehouse Name</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead className="w-[150px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {locations.map((location) => (
            <TableRow key={location.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <Warehouse className="h-4 w-4 text-muted-foreground" />
                  {location.name}
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  <div className="line-clamp-1">{formatLocationAddress(location)}</div>
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm space-y-1">
                  {location.email && (
                    <div className="text-muted-foreground">📧 {location.email}</div>
                  )}
                  {location.mobile && (
                    <div className="text-muted-foreground">📱 {location.mobile}</div>
                  )}
                  {!location.email && !location.mobile && (
                    <div className="text-muted-foreground">-</div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={location.isActive !== false ? 'default' : 'secondary'}>
                  {location.isActive !== false ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(location)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteClick(location)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Warehouse Location</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{locationToDelete?.name}"? This action cannot be undone.
              {locationToDelete?.isActive && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm">
                  ⚠️ This warehouse is currently active. Deleting it may affect inventory management.
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleDeleteCancel}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete Warehouse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

