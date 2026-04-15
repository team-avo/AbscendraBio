'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { CreditCard } from 'lucide-react';

interface Order {
  id: string;
  orderNumber: string;
  totalAmount: number;
  customer?: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
  onSuccess?: () => void;
}

interface PaymentFormData {
  amount: string;
  paymentGatewayName: string;
  paymentGatewayTransactionId: string;
  paymentGatewayResponse: string;
  paymentStatus: string;
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  order,
  onSuccess
}: RecordPaymentDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors }
  } = useForm<PaymentFormData>({
    defaultValues: {
      amount: order ? parseFloat(order.totalAmount.toString()).toFixed(2) : '0.00',
      paymentGatewayName: 'MANUAL',
      paymentGatewayTransactionId: '',
      paymentGatewayResponse: '',
      paymentStatus: 'COMPLETED'
    }
  });

  // Watch for changes to auto-populate amount when order changes
  useEffect(() => {
    if (order) {
      setValue('amount', parseFloat(order.totalAmount.toString()).toFixed(2));
    }
  }, [order, setValue]);

  const onSubmit = async (data: PaymentFormData) => {
    if (!order) {
      toast.error('No order selected');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        orderId: order.id,
        amount: parseFloat(data.amount).toFixed(2),
        paymentStatus: data.paymentStatus,
        paymentGatewayName: data.paymentGatewayName,
        paymentGatewayTransactionId: data.paymentGatewayTransactionId || undefined,
        paymentGatewayResponse: data.paymentGatewayResponse || undefined,
      };

      const response = await api.createTransaction(payload);
      if (response.success) {
        toast.success(`Payment of $${parseFloat(data.amount).toFixed(2)} recorded for order #${order.orderNumber}`);
        onOpenChange(false);
        reset();
        onSuccess?.();
      } else {
        toast.error(response.error || 'Failed to record payment');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col p-0 rounded-2xl overflow-hidden border-gray-200" overlayClassName="backdrop-blur-sm">
        <div className="bg-[#1B2D4F] px-6 py-5 relative overflow-hidden flex-shrink-0">
          <div className="absolute -top-8 -right-8 w-28 h-28 bg-[#3A6FA0]/25 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white">Record Payment</DialogTitle>
              <p className="text-xs text-white/50 mt-0.5">Add a payment record for this order</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 overflow-y-auto flex-1 px-6 py-4">
          {/* Order Information */}
          {order && (
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <div className="font-medium">Order #{order.orderNumber}</div>
              {order.customer && (
                <div className="text-sm text-muted-foreground">
                  Customer: {order.customer.firstName} {order.customer.lastName} ({order.customer.email})
                </div>
              )}
              <div className="text-sm text-muted-foreground">
                Total Amount: ${parseFloat(order.totalAmount.toString()).toFixed(2)}
              </div>
            </div>
          )}

          {/* Payment Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Payment Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              {...register('amount', {
                required: 'Payment amount is required',
                min: { value: 0.01, message: 'Amount must be greater than 0' }
              })}
            />
            {errors.amount && (
              <p className="text-sm text-red-600">{errors.amount.message}</p>
            )}
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label htmlFor="paymentGatewayName">Payment Method</Label>
            <Select
              onValueChange={(value) => setValue('paymentGatewayName', value)}
              defaultValue="MANUAL"
            >
              <SelectTrigger>
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MANUAL">Manual (Zelle/Bank Wire)</SelectItem>
                <SelectItem value="AUTHORIZE_NET">Authorize.Net</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Payment Status */}
          <div className="space-y-2">
            <Label htmlFor="paymentStatus">Payment Status</Label>
            <Select
              onValueChange={(value) => setValue('paymentStatus', value)}
              defaultValue="COMPLETED"
            >
              <SelectTrigger>
                <SelectValue placeholder="Select payment status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                <SelectItem value="REFUNDED">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Transaction ID (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="paymentGatewayTransactionId">Transaction ID (Optional)</Label>
            <Input
              id="paymentGatewayTransactionId"
              placeholder="Enter transaction ID"
              {...register('paymentGatewayTransactionId')}
            />
          </div>

          {/* Notes (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="paymentGatewayResponse">Notes (Optional)</Label>
            <Textarea
              id="paymentGatewayResponse"
              placeholder="Add any notes about this payment..."
              rows={3}
              {...register('paymentGatewayResponse')}
            />
          </div>

          <DialogFooter className="flex-shrink-0 pt-4">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="bg-[#1B2D4F] hover:bg-[#243d6b] text-white rounded-xl">
              {submitting ? 'Recording...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


