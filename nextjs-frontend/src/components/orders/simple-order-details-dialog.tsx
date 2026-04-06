import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, api } from '@/lib/api';
import { getPaymentMethodDisplay } from '@/lib/payment-utils';
import { format } from 'date-fns';
import { User, Mail, Phone } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import logger from '@/lib/logger';

interface SimpleOrderDetailsDialogProps {
    order: any;
    open: boolean;
    onClose: () => void;
}

export function SimpleOrderDetailsDialog({ order, open, onClose }: SimpleOrderDetailsDialogProps) {
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
                setFullOrder(order);
            }
        } catch (error) {
            logger.error('Error fetching order details:', { error: error });
            setFullOrder(order);
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
            <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader className="flex-shrink-0 pb-4">
                    <DialogTitle className="text-lg font-semibold">
                        Order #{displayOrder.orderNumber}
                    </DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <span className="ml-2">Loading order details...</span>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                        {/* Order Status & Payment */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium">Order Status</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Badge className={getStatusColor(displayOrder.status)}>
                                        {displayOrder.status.replace('_', ' ')}
                                    </Badge>
                                    <p className="text-sm text-muted-foreground mt-2">
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

                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium">Payment Method</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Badge variant="outline">
                                        {getPaymentMethodDisplay(displayOrder)}
                                    </Badge>
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
                                <div className="space-y-2">
                                    <p className="font-medium">
                                        {displayOrder.customer
                                            ? `${displayOrder.customer.firstName} ${displayOrder.customer.lastName}`
                                            : 'Guest Customer'}
                                    </p>
                                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                                        <Mail className="h-3 w-3" />
                                        {displayOrder.customer?.email || 'No email provided'}
                                    </p>
                                    {displayOrder.customer?.mobile && (
                                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                                            <Phone className="h-3 w-3" />
                                            {displayOrder.customer.mobile}
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Order Items */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-medium">
                                    Order Items ({displayOrder.items?.length || 0})
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {displayOrder.items?.map((item: any, index: number) => (
                                        <div key={index} className="flex justify-between items-start py-3 border-b last:border-b-0">
                                            <div className="flex-1">
                                                <p className="font-medium">{item.variant?.name || 'Unknown Product'}</p>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    SKU: {item.variant?.sku || 'N/A'} | Qty: {item.quantity}
                                                </p>
                                            </div>
                                            <div className="text-right ml-4">
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
                    </div>
                )
                }
            </DialogContent >
        </Dialog >
    );
}
