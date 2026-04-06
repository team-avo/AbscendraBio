'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Edit, Trash2, Calendar, Package } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import logger from '@/lib/logger';

interface Batch {
  id: string;
  batchNumber: string;
  quantity: number;
  expiryDate?: string;
  createdAt: string;
}

interface BatchManagementDialogProps {
  open: boolean;
  onClose: () => void;
  inventory: any;
  onSuccess: () => void;
}

export function BatchManagementDialog({
  open,
  onClose,
  inventory,
  onSuccess,
}: BatchManagementDialogProps) {
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
      }
    } catch (error) {
      logger.error('Failed to fetch batches:', { error: error });
      toast.error('Failed to load batches');
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
  };

  const openCreateForm = () => {
    resetForm();
    setShowCreateForm(true);
  };

  const openEditForm = (batch: Batch) => {
    setFormData({
      batchNumber: batch.batchNumber,
      quantity: batch.quantity.toString(),
      expiryDate: batch.expiryDate ? batch.expiryDate.split('T')[0] : '',
    });
    setEditingBatch(batch);
    setShowCreateForm(true);
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
        onSuccess();
      } else {
        toast.error(response.error || `Failed to ${editingBatch ? 'update' : 'create'} batch`);
      }
    } catch (error) {
      toast.error(`Failed to ${editingBatch ? 'update' : 'create'} batch`);
    } finally {
      setLoading(false);
    }
  };

  const deleteBatch = async (batchId: string) => {
    if (!confirm('Are you sure you want to delete this batch?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await api.deleteInventoryBatch(batchId);
      if (response.success) {
        toast.success('Batch deleted successfully');
        fetchBatches();
        onSuccess();
      } else {
        toast.error('Failed to delete batch');
      }
    } catch (error) {
      toast.error('Failed to delete batch');
    } finally {
      setLoading(false);
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
      return <Badge variant="destructive">Expired</Badge>;
    }
    
    if (isExpiringSoon(expiryDate)) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Expiring Soon</Badge>;
    }
    
    return <Badge variant="outline">Valid</Badge>;
  };

  const totalBatchQuantity = batches.reduce((sum, batch) => sum + batch.quantity, 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Batch Management - {inventory?.variant?.name} ({inventory?.variant?.sku})
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Inventory Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Inventory</p>
                  <p className="text-2xl font-bold">{inventory?.quantity || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total in Batches</p>
                  <p className="text-2xl font-bold">{totalBatchQuantity}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="text-lg font-medium">{inventory?.location?.name}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Batch List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Batches</h3>
              <Button onClick={openCreateForm} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Batch
              </Button>
            </div>

            {batches.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No batches created yet</p>
                <p className="text-sm">Add batches to track inventory by batch numbers and expiry dates</p>
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch Number</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Expiry Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((batch) => (
                      <TableRow key={batch.id}>
                        <TableCell className="font-medium">{batch.batchNumber}</TableCell>
                        <TableCell>{batch.quantity}</TableCell>
                        <TableCell>
                          {batch.expiryDate ? (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {new Date(batch.expiryDate).toLocaleDateString()}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No expiry</span>
                          )}
                        </TableCell>
                        <TableCell>{getExpiryBadge(batch.expiryDate)}</TableCell>
                        <TableCell>{new Date(batch.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditForm(batch)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteBatch(batch.id)}
                            >
                              <Trash2 className="h-4 w-4" />
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
            <Card>
              <CardHeader>
                <CardTitle>{editingBatch ? 'Edit Batch' : 'Create New Batch'}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Batch Number *</Label>
                      <Input
                        value={formData.batchNumber}
                        onChange={(e) => setFormData(prev => ({ ...prev, batchNumber: e.target.value }))}
                        placeholder="Enter batch number"
                        className={formErrors.batchNumber ? 'border-red-500' : ''}
                      />
                      {formErrors.batchNumber && (
                        <p className="text-sm text-red-600">{formErrors.batchNumber}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Quantity *</Label>
                      <Input
                        type="number"
                        value={formData.quantity}
                        onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                        placeholder="Enter quantity"
                        className={formErrors.quantity ? 'border-red-500' : ''}
                      />
                      {formErrors.quantity && (
                        <p className="text-sm text-red-600">{formErrors.quantity}</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Expiry Date (Optional)</Label>
                    <Input
                      type="date"
                      value={formData.expiryDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, expiryDate: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <Button type="submit" disabled={loading}>
                      {editingBatch ? 'Update Batch' : 'Create Batch'}
                    </Button>
                    <Button type="button" variant="outline" onClick={resetForm}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
