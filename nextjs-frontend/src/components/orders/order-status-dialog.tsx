'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { api, Order } from '@/lib/api';
import { toast } from 'sonner';
import logger from '@/lib/logger';

interface OrderStatusDialogProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const statusOptions = [
  { value: 'PENDING', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'PROCESSING', label: 'Processing', color: 'bg-blue-100 text-blue-800' },
  { value: 'LABEL_CREATED', label: 'Label Printed', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'SHIPPED', label: 'Shipped', color: 'bg-purple-100 text-purple-800' },
  { value: 'DELIVERED', label: 'Delivered', color: 'bg-green-100 text-green-800' },
  { value: 'CANCELLED', label: 'Cancelled', color: 'bg-red-100 text-red-800' },
  { value: 'REFUNDED', label: 'Refunded', color: 'bg-gray-100 text-gray-800' },
  { value: 'ON_HOLD', label: 'On Hold', color: 'bg-orange-100 text-orange-800' },
];

export function OrderStatusDialog({ order, open, onOpenChange, onSuccess }: OrderStatusDialogProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(order?.status || '');
  const [note, setNote] = useState('');

  const handleSubmit = async () => {
    if (!order) return;

    try {
      setLoading(true);
      
      const response = await api.updateOrderStatus(order.id, status, note.trim() || undefined);
      
      if (response.success) {
        onSuccess();
        onOpenChange(false);
        setNote('');
        toast.success(`Order status updated to ${status}`);
      }
    } catch (error) {
      logger.error('Failed to update order status:', { error: error });
      toast.error('Failed to update order status');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setNote('');
      onOpenChange(false);
    }
  };

  if (!order) return null;

  const currentStatus = statusOptions.find(s => s.value === order.status);
  const newStatus = statusOptions.find(s => s.value === status);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[92vw] sm:w-auto max-w-md">
        <DialogHeader>
          <DialogTitle>Update Order Status</DialogTitle>
          <DialogDescription>
            Update the status for order #{order.orderNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Current Status</Label>
            <div className="mt-1">
              <Badge variant="outline" className={currentStatus?.color}>
                {currentStatus?.label}
              </Badge>
            </div>
          </div>

          <div>
            <Label htmlFor="status">New Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select new status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={option.color}>
                        {option.label}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {status && status !== order.status && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="text-sm font-medium text-blue-800">
                Status Change Preview
              </div>
              <div className="text-sm text-blue-700 mt-1">
                {currentStatus?.label} → {newStatus?.label}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="note">Note (Optional)</Label>
            <Textarea
              id="note"
              placeholder="Add a note about this status change..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading || !status || status === order.status}
            >
              {loading ? 'Updating...' : 'Update Status'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}