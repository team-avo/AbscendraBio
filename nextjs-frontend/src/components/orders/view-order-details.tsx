"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Package,
    User,
    CreditCard,
    Truck,
    MapPin,
    Phone,
    Mail,
    Calendar,
    DollarSign,
    ShoppingCart,
    FileText,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    Tag,
    RotateCcw
} from "lucide-react";
import { api } from '@/lib/api';
import { toast } from 'sonner';
import logger from '@/lib/logger';
import { CommentSection } from '../comments/comment-section';

interface OrderItem {
    id: string;
    productId: string;
    productName: string;
    variantName?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    sku?: string;
}

interface OrderDetails {
    id: string;
    orderNumber: string;
    customer: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        phone?: string;
    };
    status: string;
    paymentStatus: string;
    shippingStatus: string;
    items: OrderItem[];
    subtotal: number;
    tax: number;
    shipping: number;
    discount: number;
    total: number;
    currency: string;
    createdAt: string;
    updatedAt: string;
    shippingAddress?: {
        name: string;
        street: string;
        address2?: string;
        company?: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
    };
    billingAddress?: {
        name: string;
        street: string;
        address2?: string;
        company?: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
    };
    paymentMethod?: {
        type: string;
        last4?: string;
        brand?: string;
    };
    payments?: Array<{
        id: string;
        paymentMethod: string;
        provider?: string;
        transactionId?: string;
        amount: number;
        currency: string;
        status: string;
        paidAt?: string;
    }>;
    notes?: string;
    trackingNumber?: string;
    estimatedDelivery?: string;
}

interface ViewOrderDetailsProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orderId: string;
    onCommentAdded?: () => void;
}

const StatusBadge = ({ status }: { status: string }) => {
    const getStatusConfig = (status: string) => {
        switch (status.toLowerCase()) {
            case 'pending':
                return { variant: 'secondary' as const, icon: Clock, label: 'Pending' };
            case 'processing':
                return { variant: 'default' as const, icon: AlertCircle, label: 'Processing' };
            case 'label_created':
                return { variant: 'default' as const, icon: Tag, label: 'Label Printed' };
            case 'shipped':
                return { variant: 'default' as const, icon: Truck, label: 'Shipped' };
            case 'delivered':
            case 'completed':
                return { variant: 'default' as const, icon: CheckCircle, label: 'Delivered' };
            case 'cancelled':
                return { variant: 'destructive' as const, icon: XCircle, label: 'Cancelled' };
            case 'refunded':
                return { variant: 'outline' as const, icon: RotateCcw, label: 'Refunded' };
            default:
                return { variant: 'secondary' as const, icon: Clock, label: status };
        }
    };

    const config = getStatusConfig(status);
    const Icon = config.icon;

    return (
        <Badge variant={config.variant} className="flex items-center gap-1">
            <Icon className="h-3 w-3" />
            {config.label}
        </Badge>
    );
};

const PaymentBadge = ({ status }: { status: string }) => {
    const getPaymentConfig = (status: string) => {
        switch (status.toLowerCase()) {
            case 'paid':
                return { variant: 'default' as const, className: 'bg-green-100 text-green-800' };
            case 'pending':
                return { variant: 'secondary' as const, className: 'bg-yellow-100 text-yellow-800' };
            case 'failed':
                return { variant: 'destructive' as const, className: 'bg-red-100 text-red-800' };
            case 'refunded':
                return { variant: 'outline' as const, className: 'bg-gray-100 text-gray-800' };
            default:
                return { variant: 'secondary' as const, className: '' };
        }
    };

    const config = getPaymentConfig(status);

    return (
        <Badge variant={config.variant} className={config.className}>
            {status}
        </Badge>
    );
};

export function ViewOrderDetails({ open, onOpenChange, orderId, onCommentAdded }: ViewOrderDetailsProps) {
    const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && orderId) {
            loadOrderDetails();
        }
    }, [open, orderId]);

    const loadOrderDetails = async () => {
        setLoading(true);
        try {
            const response = await api.getOrder(orderId);

            if (response.success && response.data) {
                const order = response.data;

                // Transform the API response to match our OrderDetails interface
                const normalizePaymentStatus = (status?: string) => {
                    if (!status) return 'pending';
                    switch (status.toUpperCase()) {
                        case 'COMPLETED':
                            return 'paid';
                        case 'PENDING':
                            return 'pending';
                        case 'FAILED':
                            return 'failed';
                        case 'REFUNDED':
                            return 'refunded';
                        case 'CANCELLED':
                            return 'cancelled';
                        default:
                            return status.toLowerCase();
                    }
                };

                const payments = (order.payments || []).map((p: any) => ({
                    id: p.id,
                    paymentMethod: p.paymentMethod,
                    provider: p.provider,
                    transactionId: p.transactionId,
                    amount: Number(p.amount || 0),
                    currency: p.currency || 'USD',
                    status: normalizePaymentStatus(p.status),
                    paidAt: p.paidAt || undefined,
                }));

                const overallPaymentStatus = payments.find(p => p.status === 'paid')
                    ? 'paid'
                    : (payments.length > 0 ? payments[0].status : 'pending');

                const orderDetails: OrderDetails = {
                    id: order.id,
                    orderNumber: order.orderNumber || order.id,
                    customer: {
                        id: order.customer?.id || '',
                        firstName: order.customer?.firstName || '',
                        lastName: order.customer?.lastName || '',
                        email: order.customer?.email || '',
                        phone: order.customer?.mobile || ''
                    },
                    status: order.status?.toLowerCase() || 'pending',
                    paymentStatus: overallPaymentStatus,
                    shippingStatus: order.status?.toLowerCase() || 'pending',
                    items: order.items?.map(item => ({
                        id: item.id,
                        productId: item.variant?.product?.id || '',
                        productName: item.variant?.product?.name || 'Unknown Product',
                        variantName: item.variant?.name,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        totalPrice: item.totalPrice,
                        sku: item.variant?.sku
                    })) || [],
                    subtotal: order.subtotal || 0,
                    tax: order.taxAmount || 0,
                    shipping: order.shippingAmount || 0,
                    discount: order.discountAmount || 0,
                    total: order.totalAmount || 0,
                    currency: "USD",
                    createdAt: order.createdAt,
                    updatedAt: order.updatedAt,
                    shippingAddress: order.shippingAddress ? {
                        name: `${order.shippingAddress.firstName || ''} ${order.shippingAddress.lastName || ''}`.trim() || 'N/A',
                        street: order.shippingAddress.address1 || '',
                        address2: order.shippingAddress.address2 || '',
                        company: order.shippingAddress.company || '',
                        city: order.shippingAddress.city || '',
                        state: order.shippingAddress.state || '',
                        zipCode: order.shippingAddress.postalCode || '',
                        country: order.shippingAddress.country || ''
                    } : undefined,
                    billingAddress: order.billingAddress ? {
                        name: `${order.billingAddress.firstName || ''} ${order.billingAddress.lastName || ''}`.trim() || 'N/A',
                        street: order.billingAddress.address1 || '',
                        address2: order.billingAddress.address2 || '',
                        company: order.billingAddress.company || '',
                        city: order.billingAddress.city || '',
                        state: order.billingAddress.state || '',
                        zipCode: order.billingAddress.postalCode || '',
                        country: order.billingAddress.country || ''
                    } : undefined,
                    paymentMethod: payments[0] ? {
                        type: (payments[0].provider === 'manual' || payments[0].paymentMethod === 'BANK_TRANSFER') ? 'Manual' : (payments[0].paymentMethod || 'card'),
                        last4: undefined,
                        brand: (payments[0].provider === 'manual') ? undefined : (payments[0].provider || undefined)
                    } : undefined,
                    payments,
                    notes: order.notes?.[0]?.note,
                    trackingNumber: order.shipments?.[0]?.trackingNumber,
                    estimatedDelivery: undefined
                };

                setOrderDetails(orderDetails);
            } else {
                toast.error("Failed to load order details");
            }
        } catch (error) {
            logger.error("Error loading order details:", { error: error });
            toast.error("Failed to load order details");
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: orderDetails?.currency || 'USD'
        }).format(amount);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="w-[96vw] sm:w-auto max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Order Details</DialogTitle>
                    </DialogHeader>
                    <div className="flex items-center justify-center py-12">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                            <p className="text-muted-foreground">Loading order details...</p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    if (!orderDetails) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="w-[96vw] sm:w-auto max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Order Details</DialogTitle>
                    </DialogHeader>
                    <div className="text-center py-12">
                        <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium mb-2">Order not found</h3>
                        <p className="text-muted-foreground">The requested order could not be found.</p>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[96vw] sm:w-auto max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader className="px-4 sm:px-6">
                    <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                        <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                        Order - {orderDetails.orderNumber}
                    </DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="overview" className="w-full">
                    <div className="px-4 sm:px-6 mb-4">
                        <TabsList className="flex w-full overflow-x-auto overflow-y-hidden justify-start sm:grid sm:grid-cols-4 sm:justify-center p-1 scrollbar-hide">
                            <TabsTrigger value="overview" className="flex-1 px-3 py-1.5 text-xs sm:text-sm">Overview</TabsTrigger>
                            <TabsTrigger value="items" className="flex-1 px-3 py-1.5 text-xs sm:text-sm">Items</TabsTrigger>
                            <TabsTrigger value="shipping" className="flex-1 px-3 py-1.5 text-xs sm:text-sm">Shipping</TabsTrigger>
                            <TabsTrigger value="payment" className="flex-1 px-3 py-1.5 text-xs sm:text-sm">Payment</TabsTrigger>
                            <TabsTrigger value="comments" className="flex-1 px-3 py-1.5 text-xs sm:text-sm">Comments</TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="overview" className="m-0">
                        <div className="px-4 sm:px-6 pb-6 space-y-4">
                            {/* Order Summary */}
                            <Card className="border-none shadow-none sm:border sm:shadow-sm">
                                <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-3">
                                    <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                                        <ShoppingCart className="h-4 w-4" />
                                        Order Summary
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-3 sm:p-6 space-y-4">
                                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                                        <div className="space-y-1">
                                            <p className="text-[10px] sm:text-sm text-muted-foreground uppercase tracking-wider font-semibold">Status</p>
                                            <div className="mt-1">
                                                <StatusBadge status={orderDetails.status} />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] sm:text-sm text-muted-foreground uppercase tracking-wider font-semibold">Payment</p>
                                            <div className="mt-1">
                                                <PaymentBadge status={orderDetails.paymentStatus} />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] sm:text-sm text-muted-foreground uppercase tracking-wider font-semibold">Shipping</p>
                                            <div className="mt-1">
                                                <StatusBadge status={orderDetails.shippingStatus} />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] sm:text-sm text-muted-foreground uppercase tracking-wider font-semibold">Items</p>
                                            <p className="text-base sm:text-lg font-semibold">{orderDetails.items.length}</p>
                                        </div>
                                    </div>

                                    <Separator className="my-2 sm:my-4" />

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 sm:gap-4">
                                        <div>
                                            <p className="text-[10px] sm:text-sm text-muted-foreground uppercase tracking-wider font-semibold">Order Date</p>
                                            <p className="text-xs sm:text-sm font-medium">{formatDate(orderDetails.createdAt)}</p>
                                        </div>
                                        {orderDetails.trackingNumber && (
                                            <div>
                                                <p className="text-[10px] sm:text-sm text-muted-foreground uppercase tracking-wider font-semibold">Tracking Number</p>
                                                <p className="font-mono text-[10px] sm:text-sm break-all">{orderDetails.trackingNumber}</p>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Customer Information */}
                            <Card className="border-none shadow-none sm:border sm:shadow-sm">
                                <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-3">
                                    <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                                        <User className="h-4 w-4" />
                                        Customer Information
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-3 sm:p-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-[10px] sm:text-sm text-muted-foreground uppercase tracking-wider font-semibold">Name</p>
                                                <p className="text-sm sm:text-base font-medium">
                                                    {orderDetails.customer.firstName} {orderDetails.customer.lastName}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] sm:text-sm text-muted-foreground uppercase tracking-wider font-semibold">Email</p>
                                                <p className="text-xs sm:text-sm font-medium flex items-center gap-2 break-all">
                                                    <Mail className="h-3.5 w-3.5 shrink-0" />
                                                    {orderDetails.customer.email}
                                                </p>
                                            </div>
                                            {orderDetails.customer.phone && (
                                                <div>
                                                    <p className="text-[10px] sm:text-sm text-muted-foreground uppercase tracking-wider font-semibold">Phone</p>
                                                    <p className="text-xs sm:text-sm font-medium flex items-center gap-2">
                                                        <Phone className="h-3.5 w-3.5 shrink-0" />
                                                        {orderDetails.customer.phone}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Financial Summary */}
                            <Card className="border-none shadow-none sm:border sm:shadow-sm">
                                <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-3">
                                    <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                                        <DollarSign className="h-4 w-4" />
                                        Financial Summary
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-3 sm:p-6">
                                    <div className="space-y-2.5 sm:space-y-3 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Subtotal</span>
                                            <span className="font-medium">{formatCurrency(orderDetails.subtotal)}</span>
                                        </div>
                                        {orderDetails.tax > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Tax</span>
                                                <span className="font-medium">{formatCurrency(orderDetails.tax)}</span>
                                            </div>
                                        )}
                                        {orderDetails.shipping > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Shipping</span>
                                                <span className="font-medium">{formatCurrency(orderDetails.shipping)}</span>
                                            </div>
                                        )}
                                        {orderDetails.discount > 0 && (
                                            <div className="flex justify-between text-green-600">
                                                <span className="text-muted-foreground">Discount</span>
                                                <span className="font-medium">-{formatCurrency(orderDetails.discount)}</span>
                                            </div>
                                        )}
                                        <Separator className="my-1 sm:my-2" />
                                        <div className="flex justify-between font-bold text-base sm:text-lg pt-1">
                                            <span>Total</span>
                                            <span>{formatCurrency(orderDetails.total)}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="items" className="space-y-4 sm:space-y-6 m-0">
                        <Card className="border-none shadow-none sm:border sm:shadow-sm">
                            <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-3">
                                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                                    <Package className="h-4 w-4" />
                                    Order Items
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 sm:p-6">
                                <div className="space-y-3 sm:space-y-4">
                                    {orderDetails.items.map((item, index) => (
                                        <div key={item.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 border rounded-lg bg-card/50">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-muted rounded-lg flex items-center justify-center shrink-0">
                                                        <Package className="h-5 w-5 sm:h-6 sm:w-6" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-sm sm:text-base truncate">{item.productName}</p>
                                                        {item.variantName && (
                                                            <p className="text-[10px] sm:text-sm text-muted-foreground truncate">
                                                                {item.variantName}
                                                            </p>
                                                        )}
                                                        {item.sku && (
                                                            <p className="text-[10px] sm:text-xs text-muted-foreground font-mono">
                                                                {item.sku}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between sm:block text-right border-t sm:border-t-0 pt-2 sm:pt-0">
                                                <div className="sm:hidden text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Price</div>
                                                <div>
                                                    <p className="font-bold text-sm sm:text-base">{formatCurrency(item.totalPrice)}</p>
                                                    <p className="text-[10px] sm:text-xs text-muted-foreground">
                                                        {item.quantity} × {formatCurrency(item.unitPrice)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="shipping" className="space-y-6">
                        {orderDetails.shippingAddress && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Truck className="h-5 w-5" />
                                        Shipping Address
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-1.5 text-sm">
                                        <div className="flex">
                                            <span className="text-muted-foreground w-20 shrink-0 font-medium">Name:</span>
                                            <span className="font-semibold">{orderDetails.shippingAddress.name}</span>
                                        </div>
                                        {orderDetails.shippingAddress.company && (
                                            <div className="flex">
                                                <span className="text-muted-foreground w-20 shrink-0 font-medium">Company:</span>
                                                <span className="font-medium">{orderDetails.shippingAddress.company}</span>
                                            </div>
                                        )}
                                        <div className="flex">
                                            <span className="text-muted-foreground w-20 shrink-0 font-medium">Address:</span>
                                            <div className="flex flex-col">
                                                <span>{orderDetails.shippingAddress.street}</span>
                                                {orderDetails.shippingAddress.address2 && (
                                                    <span className="text-muted-foreground">{orderDetails.shippingAddress.address2}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex">
                                            <span className="text-muted-foreground w-20 shrink-0 font-medium">Location:</span>
                                            <span className="text-muted-foreground">
                                                {orderDetails.shippingAddress.city}, {orderDetails.shippingAddress.state} {orderDetails.shippingAddress.zipCode}
                                            </span>
                                        </div>
                                        <div className="flex">
                                            <span className="text-muted-foreground w-20 shrink-0 font-medium">Country:</span>
                                            <span className="text-muted-foreground">{orderDetails.shippingAddress.country}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {orderDetails.billingAddress && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <CreditCard className="h-5 w-5" />
                                        Billing Address
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-1.5 text-sm">
                                        <div className="flex">
                                            <span className="text-muted-foreground w-20 shrink-0 font-medium">Name:</span>
                                            <span className="font-semibold">{orderDetails.billingAddress.name}</span>
                                        </div>
                                        {orderDetails.billingAddress.company && (
                                            <div className="flex">
                                                <span className="text-muted-foreground w-20 shrink-0 font-medium">Company:</span>
                                                <span className="font-medium">{orderDetails.billingAddress.company}</span>
                                            </div>
                                        )}
                                        <div className="flex">
                                            <span className="text-muted-foreground w-20 shrink-0 font-medium">Address:</span>
                                            <div className="flex flex-col">
                                                <span>{orderDetails.billingAddress.street}</span>
                                                {orderDetails.billingAddress.address2 && (
                                                    <span className="text-muted-foreground">{orderDetails.billingAddress.address2}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex">
                                            <span className="text-muted-foreground w-20 shrink-0 font-medium">Location:</span>
                                            <span className="text-muted-foreground">
                                                {orderDetails.billingAddress.city}, {orderDetails.billingAddress.state} {orderDetails.billingAddress.zipCode}
                                            </span>
                                        </div>
                                        <div className="flex">
                                            <span className="text-muted-foreground w-20 shrink-0 font-medium">Country:</span>
                                            <span className="text-muted-foreground">{orderDetails.billingAddress.country}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    <TabsContent value="payment" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CreditCard className="h-5 w-5" />
                                    Payment Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Payment Status</p>
                                        <PaymentBadge status={orderDetails.paymentStatus} />
                                    </div>
                                    {orderDetails.paymentMethod && (
                                        <div>
                                            <p className="text-sm text-muted-foreground">Payment Method</p>
                                            <p className="font-medium">
                                                {orderDetails.paymentMethod.type}
                                                {orderDetails.paymentMethod.brand ? ` · ${orderDetails.paymentMethod.brand}` : ''}
                                                {orderDetails.paymentMethod.last4 ? ` · •••• ${orderDetails.paymentMethod.last4}` : ''}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {orderDetails.payments && orderDetails.payments.length > 0 && (
                                    <div className="space-y-3">
                                        {orderDetails.payments.map((p) => (
                                            <div key={p.id} className="flex items-center justify-between p-3 border rounded">
                                                <div className="flex-1">
                                                    <div className="font-medium">
                                                        {(p.provider === 'manual' || p.paymentMethod === 'BANK_TRANSFER') ? 'Manual' : p.paymentMethod + (p.provider ? ` · ${p.provider}` : '')}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">
                                                        {p.transactionId ? `Txn: ${p.transactionId}` : 'No transaction ID'}
                                                        {p.paidAt ? ` · ${new Date(p.paidAt).toLocaleString()}` : ''}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <Badge variant={p.status === 'paid' ? 'default' : (p.status === 'pending' ? 'secondary' : (p.status === 'failed' ? 'destructive' : 'outline'))}>
                                                        {p.status}
                                                    </Badge>
                                                    <span className="text-sm font-medium">{new Intl.NumberFormat('en-US', { style: 'currency', currency: p.currency || 'USD' }).format(p.amount)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {orderDetails.notes && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Order Notes</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-muted-foreground">{orderDetails.notes}</p>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    <TabsContent value="comments" className="m-0">
                        <div className="px-4 sm:px-6 pb-6 pt-4">
                            <CommentSection
                                type="ORDER"
                                orderId={orderId}
                                onCommentAdded={onCommentAdded}
                            />
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
} 