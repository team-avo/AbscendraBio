import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/api';
import { Package, Hash, Tag, DollarSign } from 'lucide-react';

interface OrderItemsDialogProps {
  order: any;
  open: boolean;
  onClose: () => void;
}

export function OrderItemsDialog({ order, open, onClose }: OrderItemsDialogProps) {
  if (!order) return null;

  const items = order.items || [];
  const totalItems = items.reduce((sum: number, item: any) => sum + item.quantity, 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl w-[95vw] max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Package className="h-5 w-5" />
            Order Items - #{order.orderNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Items Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 w-full">
            <Card className="min-w-0">
              <CardContent className="pt-4">
                <div className="flex items-center space-x-2">
                  <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-2xl font-bold break-words">{items.length}</p>
                    <p className="text-xs text-muted-foreground break-words">Unique Items</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardContent className="pt-4">
                <div className="flex items-center space-x-2">
                  <Hash className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-2xl font-bold break-words">{totalItems}</p>
                    <p className="text-xs text-muted-foreground break-words">Total Quantity</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardContent className="pt-4">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-2xl font-bold break-words">{formatCurrency(order.totalAmount)}</p>
                    <p className="text-xs text-muted-foreground break-words">Order Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Items List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Order Items ({items.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {items.map((item: any, index: number) => (
                  <div key={index} className="p-6">
                    {/* Product Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xl font-semibold text-gray-900 mb-2 break-words">
                          {item.variant?.name || 'Unknown Product'}
                        </h4>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <Tag className="h-4 w-4" />
                            <span className="break-words">SKU: {item.variant?.sku || 'N/A'}</span>
                          </div>
                          <Badge variant="outline" className="text-sm px-2 py-1">
                            Qty: {item.quantity}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(item.unitPrice)}</p>
                        <p className="text-sm text-gray-500">per unit</p>
                      </div>
                    </div>

                    {/* Product Details Grid */}
                    {item.variant && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4 pt-4 border-t border-gray-200">
                        <div className="space-y-4">
                          <h5 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Product Details</h5>
                          <div className="space-y-3">
                            <div className="flex items-center py-2">
                              <span className="text-sm text-gray-600 font-medium w-20 flex-shrink-0">Product:</span>
                              <span className="text-sm text-gray-900 ml-4 flex-1">{item.variant.product?.name || 'N/A'}</span>
                            </div>
                            <div className="flex items-center py-2">
                              <span className="text-sm text-gray-600 font-medium w-20 flex-shrink-0">Variant:</span>
                              <span className="text-sm text-gray-900 ml-4 flex-1">{item.variant.name}</span>
                            </div>
                            <div className="flex items-center py-2">
                              <span className="text-sm text-gray-600 font-medium w-20 flex-shrink-0">SKU:</span>
                              <span className="text-sm text-gray-900 font-mono ml-4 flex-1">{item.variant.sku || 'N/A'}</span>
                            </div>
                            {item.variant.description && (
                              <div className="pt-2">
                                <div className="flex items-start">
                                  <span className="text-sm text-gray-600 font-medium w-20 flex-shrink-0">Description:</span>
                                  <span className="text-sm text-gray-900 ml-4 flex-1">{item.variant.description}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h5 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Pricing</h5>
                          <div className="space-y-3">
                            <div className="flex items-center py-2">
                              <span className="text-sm text-gray-600 w-20 flex-shrink-0">Unit Price:</span>
                              <span className="text-sm font-semibold text-gray-900 ml-4 flex-1">{formatCurrency(item.unitPrice)}</span>
                            </div>
                            <div className="flex items-center py-2">
                              <span className="text-sm text-gray-600 w-20 flex-shrink-0">Quantity:</span>
                              <span className="text-sm font-semibold text-gray-900 ml-4 flex-1">{item.quantity}</span>
                            </div>
                            <div className="flex items-center py-3 pt-4 border-t border-gray-200">
                              <span className="text-base font-bold text-gray-900 w-20 flex-shrink-0">Total:</span>
                              <span className="text-lg font-bold text-gray-900 ml-4 flex-1">{formatCurrency(item.unitPrice * item.quantity)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Item Notes */}
                    {item.notes && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h5 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Item Notes</h5>
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-sm text-gray-900">{item.notes}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Order Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between py-2">
                  <span className="text-sm text-gray-600">Subtotal ({totalItems} items):</span>
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(Number(order.subtotal || 0))}</span>
                </div>
                {order.discountAmount && order.discountAmount > 0 && (
                  <div className="flex justify-between py-2 text-green-600">
                    <span className="text-sm">Discount:</span>
                    <span className="text-sm font-semibold">-{formatCurrency(order.discountAmount)}</span>
                  </div>
                )}
                {order.shippingAmount && order.shippingAmount > 0 && (
                  <div className="flex justify-between py-2">
                    <span className="text-sm text-gray-600">Shipping:</span>
                    <span className="text-sm font-semibold text-gray-900">{formatCurrency(order.shippingAmount)}</span>
                  </div>
                )}
                {order.taxAmount && order.taxAmount > 0 && (
                  <div className="flex justify-between py-2">
                    <span className="text-sm text-gray-600">Tax:</span>
                    <span className="text-sm font-semibold text-gray-900">{formatCurrency(order.taxAmount)}</span>
                  </div>
                )}
                {(() => {
                  // Display credit card fee (3%) for Authorize.Net orders when detectable
                  const subtotal = Number(order.subtotal || order.subtotalAmount || 0);
                  const base = Math.round((subtotal - Number(order.discountAmount || 0) + Number(order.shippingAmount || 0) + Number(order.taxAmount || 0)) * 100) / 100;
                  const delta = Math.round((Number(order.totalAmount || 0) - base) * 100) / 100;
                  const approxThreePct = Math.round(base * 3) / 100;
                  const hasAuthorizePayment = !!order.payments?.some((p: any) => {
                    const provider = (p?.provider || '').toString().toLowerCase();
                    return provider === 'authorize.net' || provider === 'authorize-net' || provider === 'authorizenet';
                  });
                  const isThreePctFee = Math.abs(delta - approxThreePct) < 0.05;
                  const showFee = (hasAuthorizePayment || isThreePctFee) && delta > 0;
                  if (!showFee) return null;
                  return (
                    <div className="flex justify-between py-2">
                      <span className="text-sm text-gray-600">Credit card fee (3%):</span>
                      <span className="text-sm font-semibold text-gray-900">{formatCurrency(delta)}</span>
                    </div>
                  );
                })()}
                <div className="flex justify-between py-3 pt-4 border-t border-gray-200">
                  <span className="text-lg font-bold text-gray-900">Total:</span>
                  <span className="text-xl font-bold text-gray-900">{formatCurrency(order.totalAmount)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
