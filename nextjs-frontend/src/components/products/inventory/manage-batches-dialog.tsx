import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, Calendar, Package } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import logger from '@/lib/logger';

interface Batch {
  id: string;
  batchNumber: string;
  quantity: number;
  expiryDate?: string;
  createdAt: string;
}

interface Inventory {
  id: string;
  quantity: number;
  variant: { sku: string; name: string; product: { name: string } };
  location: { name: string };
  batches?: Batch[];
}

interface ManageBatchesDialogProps {
  open: boolean;
  onClose: () => void;
  inventory: Inventory;
  onSuccess?: () => void;
}

export function ManageBatchesDialog({ open, onClose, inventory, onSuccess }: ManageBatchesDialogProps) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [formData, setFormData] = useState({
    batchNumber: '',
    quantity: '',
    expiryDate: '',
  });
  const [formErrors, setFormErrors] = useState<any>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [batchToDelete, setBatchToDelete] = useState<Batch | null>(null);

  useEffect(() => {
    if (open && inventory) {
      fetchBatches();
    }
  }, [open, inventory]);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const response = await api.getInventoryBatches(inventory.id);
      if (response.success) {
        setBatches(response.data || []);
      } else {
        logger.warn('Failed to fetch batches:', { warning: response.error });
        setBatches([]);
        // Don't show error toast if batch feature is not set up yet
      }
    } catch (error) {
      logger.warn('Failed to fetch batches:', { warning: error });
      setBatches([]);
      // Don't show error toast if batch feature is not set up yet
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      batchNumber: '',
      quantity: '',
      expiryDate: '',
    });
    setFormErrors({});
    setEditingBatch(null);
    setShowCreateForm(false);
    setShowDeleteConfirm(false);
    setBatchToDelete(null);
  };

  const openCreateForm = () => {
    resetForm();
    setShowCreateForm(true);
    // Scroll to the form after a short delay to ensure it's rendered
    setTimeout(() => {
      const formElement = document.querySelector('[data-batch-form]');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const openEditForm = (batch: Batch) => {
    setFormData({
      batchNumber: batch.batchNumber,
      quantity: batch.quantity.toString(),
      expiryDate: batch.expiryDate ? batch.expiryDate.split('T')[0] : '',
    });
    setEditingBatch(batch);
    setShowCreateForm(true);
    // Scroll to the form after a short delay to ensure it's rendered
    setTimeout(() => {
      const formElement = document.querySelector('[data-batch-form]');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const validateForm = () => {
    const errors: any = {};

    if (!formData.batchNumber.trim()) {
      errors.batchNumber = 'Batch number is required';
    }

    if (!formData.quantity || parseInt(formData.quantity) <= 0) {
      errors.quantity = 'Quantity must be greater than 0';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      const batchData = {
        inventoryId: inventory.id,
        batchNumber: formData.batchNumber.trim(),
        quantity: parseInt(formData.quantity),
        expiryDate: formData.expiryDate || undefined,
      };

      let response;
      if (editingBatch) {
        response = await api.updateInventoryBatch(editingBatch.id, batchData);
      } else {
        response = await api.createInventoryBatch(batchData);
      }

      if (response.success) {
        toast.success(`Batch ${editingBatch ? 'updated' : 'created'} successfully`);
        resetForm();
        fetchBatches();
        if (onSuccess) onSuccess();
      } else {
        toast.error(response.error || `Failed to ${editingBatch ? 'update' : 'create'} batch`);
      }
    } catch (error) {
      toast.error(`Failed to ${editingBatch ? 'update' : 'create'} batch`);
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = (batch: Batch) => {
    setBatchToDelete(batch);
    setShowDeleteConfirm(true);
  };

  const deleteBatch = async () => {
    if (!batchToDelete) return;

    try {
      setLoading(true);
      const response = await api.deleteInventoryBatch(batchToDelete.id);
      if (response.success) {
        toast.success('Batch deleted successfully');
        fetchBatches();
        if (onSuccess) onSuccess();
      } else {
        toast.error('Failed to delete batch');
      }
    } catch (error) {
      toast.error('Failed to delete batch');
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
      setBatchToDelete(null);
    }
  };

  const isExpiringSoon = (expiryDate?: string) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  const isExpired = (expiryDate?: string) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const today = new Date();
    return expiry < today;
  };

  const getExpiryBadge = (expiryDate?: string) => {
    if (!expiryDate) return null;

    if (isExpired(expiryDate)) {
      return <Badge variant="destructive" className="text-xs px-1 py-0">Expired</Badge>;
    }

    if (isExpiringSoon(expiryDate)) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-xs px-1 py-0">Expiring</Badge>;
    }

    return <Badge variant="outline" className="text-xs px-1 py-0">Valid</Badge>;
  };

  const totalBatchQuantity = batches.reduce((sum, batch) => sum + batch.quantity, 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-lg">
            Batch Management - {inventory?.variant?.name} ({inventory?.variant?.sku})
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-6">
            {/* Summary Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Inventory Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Inventory</p>
                    <p className="text-xl font-bold">{inventory?.quantity || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total in Batches</p>
                    <p className="text-xl font-bold">{totalBatchQuantity}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="text-base font-medium">{inventory?.location?.name}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Batch List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-medium">Batches</h3>
                <Button onClick={openCreateForm} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Batch
                </Button>
              </div>
              {batches.length === 0 ? (
                <div className="text-center py-6 border rounded-lg">
                  <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No batches created yet</p>
                  <p className="text-xs text-muted-foreground">Add batches to track inventory by batch numbers and expiry dates</p>
                </div>
              ) : (
                <div className="border rounded-lg max-h-72 overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 border-b">
                      <TableRow className="h-10">
                        <TableHead className="text-xs py-2 font-semibold">Batch Number</TableHead>
                        <TableHead className="text-xs py-2 font-semibold">Qty</TableHead>
                        <TableHead className="text-xs py-2 font-semibold">Expiry Date</TableHead>
                        <TableHead className="text-xs py-2 font-semibold">Status</TableHead>
                        <TableHead className="text-xs py-2 font-semibold">Created</TableHead>
                        <TableHead className="text-xs py-2 w-20 font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batches.map((batch) => (
                        <TableRow key={batch.id} className="h-10">
                          <TableCell className="font-medium text-sm py-2">{batch.batchNumber}</TableCell>
                          <TableCell className="text-sm py-2">{batch.quantity}</TableCell>
                          <TableCell className="text-sm py-2">
                            {batch.expiryDate ? (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs">{new Date(batch.expiryDate).toLocaleDateString()}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">No expiry</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2">{getExpiryBadge(batch.expiryDate)}</TableCell>
                          <TableCell className="text-xs py-2">
                            {new Date(batch.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditForm(batch)}
                                className="h-6 w-6 p-0"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => confirmDelete(batch)}
                                className="h-6 w-6 p-0"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
          </div>

              {/* Create/Edit Form */}
              {showCreateForm && (
                <Card data-batch-form>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{editingBatch ? 'Edit Batch' : 'Create New Batch'}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <form onSubmit={handleSubmit} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-sm font-medium">Batch Number *</Label>
                          <Input
                            value={formData.batchNumber}
                            onChange={(e) => setFormData(prev => ({ ...prev, batchNumber: e.target.value }))}
                            placeholder="Enter batch number"
                            className={`text-sm bg-white text-gray-900 ${formErrors.batchNumber ? 'border-red-500' : 'border-gray-300'}`}
                            style={{
                              color: '#111827',
                              backgroundColor: '#ffffff'
                            }}
                          />
                          {formErrors.batchNumber && (
                            <p className="text-xs text-red-600">{formErrors.batchNumber}</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-sm font-medium">Quantity *</Label>
                          <Input
                            type="number"
                            value={formData.quantity}
                            onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                            placeholder="Enter quantity"
                            className={`text-sm bg-white text-gray-900 ${formErrors.quantity ? 'border-red-500' : 'border-gray-300'}`}
                            style={{
                              color: '#111827',
                              backgroundColor: '#ffffff'
                            }}
                          />
                          {formErrors.quantity && (
                            <p className="text-xs text-red-600">{formErrors.quantity}</p>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm font-medium">Expiry Date (Optional)</Label>
                        <Input
                          type="date"
                          value={formData.expiryDate}
                          onChange={(e) => setFormData(prev => ({ ...prev, expiryDate: e.target.value }))}
                          className="text-sm bg-white text-gray-900 border-gray-300"
                          style={{
                            colorScheme: 'light',
                            color: '#111827',
                            backgroundColor: '#ffffff'
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        <Button type="submit" disabled={loading} size="sm">
                          {editingBatch ? 'Update Batch' : 'Create Batch'}
                        </Button>
                        <Button type="button" variant="outline" onClick={resetForm} size="sm">
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Batch</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete batch "{batchToDelete?.batchNumber}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteBatch} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}