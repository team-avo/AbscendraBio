import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/api';
import { format } from 'date-fns';
import { DollarSign, Package, User, Calendar, CreditCard, MapPin, FileText } from 'lucide-react';

interface OrderSummaryDialogProps {
  order: any;
  open: boolean;
  onClose: () => void;
}

export function OrderSummaryDialog({ order, open, onClose }: OrderSummaryDialogProps) {
  if (!order) return null;

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      PROCESSING: 'bg-blue-100 text-blue-800',
      SHIPPED: 'bg-purple-100 text-purple-800',
      DELIVERED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800',
      REFUNDED: 'bg-gray-100 text-gray-800',
      ON_HOLD: 'bg-orange-100 text-orange-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPaymentStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      COMPLETED: 'bg-green-100 text-green-800',
      FAILED: 'bg-red-100 text-red-800',
      REFUNDED: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const totalItems = order.items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0;
  const payments = order.payments || [];
  const totalPaid = payments
    .filter((p: any) => p.status === 'COMPLETED')
    .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <FileText className="h-5 w-5" />
            Order Summary - #{order.orderNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Order Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{formatCurrency(order.totalAmount)}</p>
                    <p className="text-xs text-muted-foreground">Total Amount</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center space-x-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{totalItems}</p>
                    <p className="text-xs text-muted-foreground">Total Items</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{order.items?.length || 0}</p>
                    <p className="text-xs text-muted-foreground">Unique Products</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">
                      {order.createdAt ? format(new Date(order.createdAt), 'dd') : '--'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {order.createdAt ? format(new Date(order.createdAt), 'MMM yyyy') : 'Unknown'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Status & Payment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Order Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className={getStatusColor(order.status)}>
                  {order.status.replace('_', ' ')}
                </Badge>
                <p className="text-sm text-muted-foreground mt-2">
                  Last updated: {order.updatedAt ? format(new Date(order.updatedAt), 'MMM dd, yyyy HH:mm') : 'Unknown'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Payment Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className={getPaymentStatusColor(
                  payments.length > 0 ? payments[0].status : 'PENDING'
                )}>
                  {payments.length > 0 ? payments[0].status : 'PENDING'}
                </Badge>
                <p className="text-sm text-muted-foreground mt-2">
                  Paid: {formatCurrency(totalPaid)} / {formatCurrency(order.totalAmount)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Customer Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Billing Address</h4>
                  {order.billingAddress ? (
                    <div className="text-sm text-muted-foreground">
                      <p>{order.billingAddress.firstName} {order.billingAddress.lastName}</p>
                      <p>{order.billingAddress.addressLine1}</p>
                      {order.billingAddress.addressLine2 && <p>{order.billingAddress.addressLine2}</p>}
                      <p>{order.billingAddress.city}, {order.billingAddress.state} {order.billingAddress.postalCode}</p>
                      <p>{order.billingAddress.country}</p>
                      {order.billingAddress.phone && <p>Phone: {order.billingAddress.phone}</p>}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No billing address</p>
                  )}
                </div>

                <div>
                  <h4 className="font-medium mb-2">Shipping Address</h4>
                  {order.shippingAddress ? (
                    <div className="text-sm text-muted-foreground">
                      <p>{order.shippingAddress.firstName} {order.shippingAddress.lastName}</p>
                      <p>{order.shippingAddress.addressLine1}</p>
                      {order.shippingAddress.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
                      <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}</p>
                      <p>{order.shippingAddress.country}</p>
                      {order.shippingAddress.phone && <p>Phone: {order.shippingAddress.phone}</p>}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No shipping address</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Financial Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Financial Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Subtotal:</span>
                  <span className="text-sm">{formatCurrency(order.subtotalAmount || order.totalAmount)}</span>
                </div>
                {order.discountAmount && order.discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span className="text-sm">Discount:</span>
                    <span className="text-sm">-{formatCurrency(order.discountAmount)}</span>
                  </div>
                )}
                {order.shippingAmount && order.shippingAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm">Shipping:</span>
                    <span className="text-sm">{formatCurrency(order.shippingAmount)}</span>
                  </div>
                )}
                {order.taxAmount && order.taxAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm">Tax:</span>
                    <span className="text-sm">{formatCurrency(order.taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span>{formatCurrency(order.totalAmount)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Order Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order Created:</span>
                  <span>{order.createdAt ? format(new Date(order.createdAt), 'MMM dd, yyyy HH:mm') : 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Updated:</span>
                  <span>{order.updatedAt ? format(new Date(order.updatedAt), 'MMM dd, yyyy HH:mm') : 'Unknown'}</span>
                </div>
                {payments.length > 0 && payments[0].createdAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Payment:</span>
                    <span>{format(new Date(payments[0].createdAt), 'MMM dd, yyyy HH:mm')}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
