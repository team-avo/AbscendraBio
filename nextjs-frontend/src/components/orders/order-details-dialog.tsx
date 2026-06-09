import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatCurrency, api } from '@/lib/api';
import { format } from 'date-fns';
import { Calendar, CreditCard, Package, User, MapPin, Phone, Mail } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import logger from '@/lib/logger';
import { CommentSection } from '../comments/comment-section';

interface OrderDetailsDialogProps {
  order: any;
  open: boolean;
  onClose: () => void;
  onCommentAdded?: () => void;
}

export function OrderDetailsDialog({ order, open, onClose, onCommentAdded }: OrderDetailsDialogProps) {
  const [fullOrder, setFullOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (order && open) {
      fetchFullOrder();
    }
  }, [order, open]);

  const fetchFullOrder = async () => {
    if (!order?.id) return;

    setLoading(true);
    try {
      const response = await api.getOrder(order.id);
      if (response.success && response.data) {
        setFullOrder(response.data);
      } else {
        setFullOrder(order); // Fallback to basic order data
      }
    } catch (error) {
      logger.error('Error fetching order details:', { error: error });
      setFullOrder(order); // Fallback to basic order data
    } finally {
      setLoading(false);
    }
  };

  if (!order) return null;

  const displayOrder = fullOrder || order;

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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0 rounded-2xl overflow-hidden border-gray-200">
        <div className="bg-[#1B2D4F] px-6 py-5 relative overflow-hidden flex-shrink-0">
          <div className="absolute -top-8 -right-8 w-28 h-28 bg-[#3A6FA0]/25 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white">Order Details</DialogTitle>
              <p className="text-xs text-white/50 mt-0.5">View full order information and history</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading order details...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-6 p-6">
            {/* Order Status & Payment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Order Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge className={getStatusColor(displayOrder.status)}>
                    {displayOrder.status.replace('_', ' ')}
                  </Badge>
                  <p className="text-sm text-muted-foreground mt-2 break-words">
                    Created: {displayOrder.createdAt ? format(new Date(displayOrder.createdAt), 'MMM dd, yyyy HH:mm') : 'Unknown'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Payment Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge className={getPaymentStatusColor(
                    displayOrder.payments && displayOrder.payments.length > 0
                      ? displayOrder.payments[0].status
                      : 'PENDING'
                  )}>
                    {displayOrder.payments && displayOrder.payments.length > 0
                      ? displayOrder.payments[0].status
                      : 'PENDING'}
                  </Badge>
                  <p className="text-sm text-muted-foreground mt-2">
                    Total: {formatCurrency(displayOrder.totalAmount)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src="" />
                    <AvatarFallback>
                      {displayOrder.customer?.firstName?.[0]}{displayOrder.customer?.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {displayOrder.customer ?
                        `${displayOrder.customer.firstName} ${displayOrder.customer.lastName}` :
                        'Guest Customer'
                      }
                    </p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {displayOrder.customer?.email || 'No email provided'}
                    </p>
                    {displayOrder.customer?.mobile && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {displayOrder.customer.mobile}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Order Items */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Order Items ({displayOrder.items?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {displayOrder.items?.map((item: any, index: number) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b last:border-b-0">
                      <div className="flex-1">
                        <p className="font-medium">{item.variant?.name || 'Unknown Product'}</p>
                        <p className="text-sm text-muted-foreground">
                          SKU: {item.variant?.sku || 'N/A'} | Qty: {item.quantity}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(item.unitPrice)}</p>
                        <p className="text-sm text-muted-foreground">
                          Total: {formatCurrency(item.unitPrice * item.quantity)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Order Notes */}
            {displayOrder.notes && displayOrder.notes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Order Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {displayOrder.notes.map((note: any, index: number) => (
                      <div key={index} className="p-3 bg-muted rounded-lg">
                        <p className="text-sm">{note.note}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {note.createdAt ? format(new Date(note.createdAt), 'MMM dd, yyyy HH:mm') : 'Unknown date'}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Audit Trail */}
            {displayOrder.auditLogs && displayOrder.auditLogs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Audit Trail
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {displayOrder.auditLogs.map((log: any) => (
                      <div key={log.id} className="flex items-start gap-4 p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="font-semibold text-sm mb-1">
                            {log.action.replace(/_/g, ' ').toUpperCase()}
                          </div>
                          <div className="text-xs text-muted-foreground mb-2">
                            {log.user ? `${log.user.firstName} ${log.user.lastName} (${log.user.email})` : 'System'}
                            {' • '}
                            {new Date(log.createdAt).toLocaleString()}
                          </div>
                          {log.details && typeof log.details === 'object' ? (
                            <div className="text-xs space-y-1">
                              {log.action === 'ORDER_UPDATED' && log.details.changes && (
                                <div className="bg-blue-50 p-2 rounded">
                                  <div className="font-medium text-blue-800 mb-1">Changes:</div>
                                  {Object.entries(log.details.changes).map(([key, value]) => (
                                    <div key={key} className="flex justify-between">
                                      <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                                      <span className="font-medium">{typeof value === 'number' ? `$${value.toLocaleString()}` : String(value)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {log.action === 'STATUS_UPDATED' && (
                                <div className="bg-green-50 p-2 rounded">
                                  <div className="flex items-center gap-2">
                                    <span className="text-green-800">Status changed from</span>
                                    <Badge variant="outline" className="text-xs">{log.details.previousStatus}</Badge>
                                    <span className="text-green-800">to</span>
                                    <Badge variant="default" className="text-xs">{log.details.newStatus}</Badge>
                                  </div>
                                  {log.details.note && (
                                    <div className="text-green-700 mt-1 italic">"{log.details.note}"</div>
                                  )}
                                </div>
                              )}
                              {log.action === 'ORDER_CREATED' && (
                                <div className="bg-purple-50 p-2 rounded">
                                  <div className="font-medium text-purple-800 mb-1">Order Created:</div>
                                  <div className="space-y-1 text-purple-700">
                                    {log.details.orderNumber && <div>Order #: {log.details.orderNumber}</div>}
                                    {log.details.totalAmount && <div>Amount: ${log.details.totalAmount.toLocaleString()}</div>}
                                    {log.details.customerType && <div>Customer Type: {log.details.customerType === 'B2B' || log.details.customerType === 'B2C' ? 'Wholesale' : log.details.customerType === 'ENTERPRISE_1' || log.details.customerType === 'ENTERPRISE_2' ? 'Enterprise' : log.details.customerType}</div>}
                                    {log.details.itemCount && <div>Items: {log.details.itemCount}</div>}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              {log.details}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {/* Order Comments */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Comments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CommentSection
                  type="ORDER"
                  orderId={displayOrder.id}
                  onCommentAdded={onCommentAdded}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
