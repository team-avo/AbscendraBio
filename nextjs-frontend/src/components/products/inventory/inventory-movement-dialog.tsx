import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Package } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import logger from '@/lib/logger';

interface Batch {
  id: string;
  batchNumber: string;
  quantity: number;
  expiryDate?: string;
}

interface InventoryMovementDialogProps {
  inventory?: {
    id: string;
    quantity: number;
    variant: {
      id: string;
      sku: string;
      name: string;
      product: {
        name: string;
      };
    };
    location: {
      id: string;
      name: string;
    };
  };
  locations: Array<{
    id: string;
    name: string;
  }>;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const MOVEMENT_TYPES = [
  { value: 'PURCHASE', label: 'Purchase' },
  { value: 'SALE', label: 'Sale' },
  { value: 'RETURN', label: 'Return' },
  { value: 'ADJUSTMENT_IN', label: 'Adjustment (In)' },
  { value: 'ADJUSTMENT_OUT', label: 'Adjustment (Out)' },
  { value: 'TRANSFER_IN', label: 'Transfer (In)' },
  { value: 'TRANSFER_OUT', label: 'Transfer (Out)' },
];

export function InventoryMovementDialog({
  inventory,
  locations,
  open,
  onClose,
  onSuccess,
}: InventoryMovementDialogProps) {
  const [loading, setLoading] = useState(false);
  const [variantId, setVariantId] = useState(inventory?.variant.id || '');
  const [locationId, setLocationId] = useState(inventory?.location.id || '');
  const [quantity, setQuantity] = useState('1');
  const [type, setType] = useState('PURCHASE');
  const [reason, setReason] = useState('');

  // Batch-related state
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatches, setSelectedBatches] = useState<{[batchId: string]: number}>({});
  const [showBatchSelection, setShowBatchSelection] = useState(false);
  const [batchesLoading, setBatchesLoading] = useState(false);

  // Fetch batches when inventory changes
  useEffect(() => {
    if (inventory && open) {
      fetchBatches();
    }
  }, [inventory, open]);

  const fetchBatches = async () => {
    if (!inventory) return;

    try {
      setBatchesLoading(true);
      const response = await api.getInventoryBatches(inventory.id);
      if (response.success) {
        setBatches(response.data || []);
      } else {
        logger.warn('Failed to fetch batches:', { warning: response.error });
        setBatches([]);
      }
    } catch (error) {
      logger.warn('Failed to fetch batches:', { warning: error });
      setBatches([]);
    } finally {
      setBatchesLoading(false);
    }
  };

  const handleBatchQuantityChange = (batchId: string, quantity: number) => {
    setSelectedBatches(prev => ({
      ...prev,
      [batchId]: quantity
    }));
  };

  const getTotalSelectedQuantity = () => {
    return Object.values(selectedBatches).reduce((sum, qty) => sum + qty, 0);
  };

  const isOutgoingMovement = ['SALE', 'ADJUSTMENT_OUT', 'TRANSFER_OUT'].includes(type);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!variantId || !locationId) {
      toast.error('Please select a product variant and location');
      return;
    }

    if (!reason.trim()) {
      toast.error('Please provide a reason for the movement');
      return;
    }

    try {
      setLoading(true);
      const response = await api.createInventoryMovement({
        variantId,
        locationId,
        quantity: parseInt(quantity),
        type: type as any,
        reason: reason.trim()
      });

      if (response.success) {
        onSuccess();
      } else {
        toast.error(response.error || 'Failed to record inventory movement');
      }
    } catch (error) {
      logger.error('Failed to record inventory movement:', { error: error });
      toast.error('Failed to record inventory movement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Inventory Movement</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {inventory && (
            <>
              <div>
                <Label>Product</Label>
                <div className="text-sm text-muted-foreground">
                  {inventory.variant.product.name} - {inventory.variant.name}
                </div>
              </div>

              <div>
                <Label>SKU</Label>
                <div className="text-sm text-muted-foreground">
                  {inventory.variant.sku}
                </div>
              </div>
            </>
          )}

          <div>
            <Label htmlFor="location">Location</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="type">Movement Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="Select movement type" />
              </SelectTrigger>
              <SelectContent>
                {MOVEMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          {/* Batch Selection for Outgoing Movements */}
          {isOutgoingMovement && batches.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Batch Selection (Optional)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBatchSelection(!showBatchSelection)}
                >
                  {showBatchSelection ? 'Hide Batches' : 'Select Batches'}
                </Button>
              </div>

              {showBatchSelection && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Available Batches
                      {getTotalSelectedQuantity() > 0 && (
                        <Badge variant="secondary">
                          {getTotalSelectedQuantity()} selected
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {batchesLoading ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                      </div>
                    ) : (
                      batches.map((batch) => (
                        <div key={batch.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{batch.batchNumber}</span>
                              <Badge variant="outline">Qty: {batch.quantity}</Badge>
                              {batch.expiryDate && (
                                <Badge variant="secondary" className="text-xs">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  {new Date(batch.expiryDate).toLocaleDateString()}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              max={batch.quantity}
                              value={selectedBatches[batch.id] || 0}
                              onChange={(e) => handleBatchQuantityChange(batch.id, parseInt(e.target.value) || 0)}
                              className="w-20"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      ))
                    )}

                    {getTotalSelectedQuantity() > 0 && (
                      <div className="text-sm text-muted-foreground text-center pt-2 border-t">
                        Total selected: {getTotalSelectedQuantity()} units
                        {parseInt(quantity) > 0 && getTotalSelectedQuantity() !== parseInt(quantity) && (
                          <span className="text-yellow-600 ml-2">
                            (Remaining: {parseInt(quantity) - getTotalSelectedQuantity()})
                          </span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              placeholder="Explain the reason for this movement..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Recording...' : 'Record Movement'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 