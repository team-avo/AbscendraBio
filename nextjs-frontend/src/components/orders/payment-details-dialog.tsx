import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/api';
import { format } from 'date-fns';
import { CreditCard, CheckCircle, XCircle, Clock, AlertCircle, DollarSign } from 'lucide-react';

interface PaymentDetailsDialogProps {
  order: any;
  open: boolean;
  onClose: () => void;
}

export function PaymentDetailsDialog({ order, open, onClose }: PaymentDetailsDialogProps) {
  if (!order) return null;

  const getPaymentStatusIcon = (status: string) => {
    const icons: { [key: string]: any } = {
      PENDING: Clock,
      COMPLETED: CheckCircle,
      FAILED: XCircle,
      REFUNDED: AlertCircle,
    };
    return icons[status] || Clock;
  };

  const getPaymentStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      COMPLETED: 'bg-green-100 text-green-800 border-green-200',
      FAILED: 'bg-red-100 text-red-800 border-red-200',
      REFUNDED: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const payments = order.payments || [];
  const totalPaid = payments
    .filter((p: any) => p.status === 'COMPLETED')
    .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
  const totalRefunded = payments
    .filter((p: any) => p.status === 'REFUNDED')
    .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <CreditCard className="h-5 w-5" />
            Payment Details - #{order.orderNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Payment Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{formatCurrency(order.totalAmount)}</p>
                    <p className="text-xs text-muted-foreground">Order Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
                    <p className="text-xs text-muted-foreground">Total Paid</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <div>
                    <p className="text-2xl font-bold text-red-600">{formatCurrency(totalRefunded)}</p>
                    <p className="text-xs text-muted-foreground">Total Refunded</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Payment Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                {(() => {
                  const status = payments.length > 0 ? payments[0].status : 'PENDING';
                  const IconComponent = getPaymentStatusIcon(status);
                  return <IconComponent className="h-5 w-5" />;
                })()}
                <Badge className={getPaymentStatusColor(
                  payments.length > 0 ? payments[0].status : 'PENDING'
                )}>
                  {payments.length > 0 ? payments[0].status : 'PENDING'}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {payments.length > 0 && payments[0].createdAt
                    ? `Last payment: ${format(new Date(payments[0].createdAt), 'MMM dd, yyyy HH:mm')}`
                    : 'No payments recorded'
                  }
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Payment History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Payment History ({payments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length > 0 ? (
                <div className="space-y-3">
                  {payments.map((payment: any, index: number) => {
                    const IconComponent = getPaymentStatusIcon(payment.status);
                    return (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${
                            payment.status === 'COMPLETED' ? 'bg-green-100' :
                            payment.status === 'FAILED' ? 'bg-red-100' :
                            payment.status === 'REFUNDED' ? 'bg-gray-100' :
                            'bg-yellow-100'
                          }`}>
                            <IconComponent className={`h-4 w-4 ${
                              payment.status === 'COMPLETED' ? 'text-green-600' :
                              payment.status === 'FAILED' ? 'text-red-600' :
                              payment.status === 'REFUNDED' ? 'text-gray-600' :
                              'text-yellow-600'
                            }`} />
                          </div>
                          <div>
                            <p className="font-medium">{formatCurrency(payment.amount)}</p>
                            <p className="text-sm text-muted-foreground">
                              {payment.method || 'Unknown Method'} • 
                              {payment.transactionId ? ` #${payment.transactionId}` : ''}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {payment.createdAt ? format(new Date(payment.createdAt), 'MMM dd, yyyy HH:mm') : 'Unknown date'}
                            </p>
                          </div>
                        </div>
                        <Badge className={getPaymentStatusColor(payment.status)}>
                          {payment.status}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6">
                  <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No payments recorded</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Payment Breakdown</CardTitle>
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
                <div className="flex justify-between font-semibold border-t pt-2">
                  <span>Total:</span>
                  <span>{formatCurrency(order.totalAmount)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
