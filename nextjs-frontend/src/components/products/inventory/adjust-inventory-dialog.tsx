import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import logger from '@/lib/logger';
import { Package } from 'lucide-react';

interface AdjustInventoryDialogProps {
  inventory: {
    id: string;
    quantity: number;
    reservedQty?: number;
    lowStockAlert: number;
    variant: {
      sku: string;
      name: string;
      product: {
        name: string;
      };
    };
    location: {
      name: string;
    };
  };
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AdjustInventoryDialog({
  inventory,
  open,
  onClose,
  onSuccess,
}: AdjustInventoryDialogProps) {
  const [loading, setLoading] = useState(false);
  const availableQuantity = inventory.quantity - (inventory.reservedQty || 0);
  const [quantity, setQuantity] = useState(availableQuantity.toString());
  const [lowStockAlert, setLowStockAlert] = useState(inventory.lowStockAlert.toString());
  const [reason, setReason] = useState('');
  const [showReason, setShowReason] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      // Calculate total quantity: available quantity + reserved quantity
      const totalQuantity = parseInt(quantity) + (inventory.reservedQty || 0);
      
      const response = await api.updateInventory(inventory.id, {
        quantity: totalQuantity,
        lowStockAlert: parseInt(lowStockAlert),
        ...(reason.trim() ? { reason: reason.trim() } : {})
      });

      if (response.success) {
        onSuccess();
      } else {
        toast.error(response.error || 'Failed to update inventory');
      }
    } catch (error) {
      logger.error('Failed to update inventory:', { error: error });
      toast.error('Failed to update inventory');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="p-0 rounded-2xl overflow-hidden border-gray-200">
        <div className="bg-[#043061] px-6 py-5 relative overflow-hidden flex-shrink-0">
          <div className="absolute -top-8 -right-8 w-28 h-28 bg-[#5A9ADA]/25 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white">Adjust Inventory</DialogTitle>
              <p className="text-xs text-white/50 mt-0.5">Update stock levels and low stock alerts</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
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

          <div>
            <Label>Location</Label>
            <div className="text-sm text-muted-foreground">
              {inventory.location.name}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quantity">Available Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
              <div className="text-xs text-muted-foreground mt-1">
                Total: {inventory.quantity} | Reserved: {inventory.reservedQty || 0} | Available: {availableQuantity}
              </div>
            </div>

            <div>
              <Label htmlFor="lowStockAlert">Low Stock Alert</Label>
              <Input
                id="lowStockAlert"
                type="number"
                min="0"
                value={lowStockAlert}
                onChange={(e) => setLowStockAlert(e.target.value)}
              />
            </div>
          </div>

          <div>
            {!showReason ? (
              <Button
                type="button"
                variant="link"
                className="px-0"
                onClick={() => setShowReason(true)}
              >
                + Add a reason for adjustment
              </Button>
            ) : (
              <>
                <Label htmlFor="reason">Reason for Adjustment</Label>
                <Textarea
                  id="reason"
                  placeholder="Explain why you're adjusting the inventory..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-[#043061] hover:bg-[#0b4f96] text-white rounded-xl">
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 