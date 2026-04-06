"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Search,
    Filter,
    Download,
    Eye,
    Edit,
    MoreHorizontal,
    Plus,
    RefreshCw,
    Calendar,
    Package,
    Truck,
    DollarSign,
    XCircle
} from "lucide-react";
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { ViewOrderDetails } from './view-order-details';
import logger from '@/lib/logger';

// Mock orders data
const orders = [
    {
        id: "ORD-001",
        customer: "John Doe",
        email: "john@example.com",
        status: "completed",
        amount: 1250.00,
        items: 3,
        date: "2024-06-30",
        payment: "paid",
        shipping: "delivered"
    },
    {
        id: "ORD-002",
        customer: "Sarah Wilson",
        email: "sarah@company.com",
        status: "processing",
        amount: 2100.00,
        items: 5,
        date: "2024-06-29",
        payment: "paid",
        shipping: "shipped"
    },
    {
        id: "ORD-003",
        customer: "Mike Johnson",
        email: "mike@research.org",
        status: "shipped",
        amount: 850.00,
        items: 2,
        date: "2024-06-28",
        payment: "paid",
        shipping: "shipped"
    },
    {
        id: "ORD-004",
        customer: "Emily Chen",
        email: "emily@biotech.com",
        status: "pending",
        amount: 3200.00,
        items: 8,
        date: "2024-06-27",
        payment: "pending",
        shipping: "pending"
    },
    {
        id: "ORD-005",
        customer: "Dr. Robert Smith",
        email: "robert@university.edu",
        status: "cancelled",
        amount: 750.00,
        items: 1,
        date: "2024-06-26",
        payment: "refunded",
        shipping: "cancelled"
    },
];

const StatusBadge = ({ status }: { status: string }) => {
    const variants: { [key: string]: { variant: "default" | "secondary" | "destructive" | "outline", label: string } } = {
        completed: { variant: "default", label: "Completed" },
        processing: { variant: "secondary", label: "Processing" },
        shipped: { variant: "outline", label: "Shipped" },
        pending: { variant: "destructive", label: "Pending" },
        cancelled: { variant: "destructive", label: "Cancelled" }
    };

    const config = variants[status] || { variant: "outline", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
};

const PaymentBadge = ({ status }: { status: string }) => {
    const variants: { [key: string]: { variant: "default" | "secondary" | "destructive" | "outline", label: string } } = {
        paid: { variant: "default", label: "Paid" },
        pending: { variant: "destructive", label: "Pending" },
        refunded: { variant: "secondary", label: "Refunded" },
        failed: { variant: "destructive", label: "Failed" }
    };

    const config = variants[status] || { variant: "outline", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
};

export function OrdersContent() {
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [paymentFilter, setPaymentFilter] = useState("all");
    const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null);
    const [showViewDetails, setShowViewDetails] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState<string>("");

    const filteredOrders = orders.filter(order => {
        const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === "all" || order.status === statusFilter;
        const matchesPayment = paymentFilter === "all" || order.payment === paymentFilter;

        return matchesSearch && matchesStatus && matchesPayment;
    });

    const orderStats = {
        total: orders.length,
        completed: orders.filter(o => o.status === "completed").length,
        processing: orders.filter(o => o.status === "processing").length,
        shipped: orders.filter(o => o.status === "shipped").length,
        pending: orders.filter(o => o.status === "pending").length,
        cancelled: orders.filter(o => o.status === "cancelled").length
    };

    const handleRequestCancellation = async (orderId: string) => {
        setLoadingOrderId(orderId);
        try {
            const res = await api.post(`/orders/${orderId}/request-cancellation`);
            if (res.success) {
                toast.success('Cancellation request submitted');
                // Optionally, refresh orders list here
            } else {
                toast.error(res.error || 'Failed to request cancellation');
            }
        } catch (e) {
            toast.error('Failed to request cancellation');
        } finally {
            setLoadingOrderId(null);
        }
    };

    const handleViewDetails = (orderId: string) => {
        logger.info('handleViewDetails called with orderId:', { data: orderId });
        logger.info('Current showViewDetails:', { data: showViewDetails });
        setSelectedOrderId(orderId);
        setShowViewDetails(true);
        logger.info('State should be updated now');
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
                    <p className="text-muted-foreground">
                        Manage and track all your customer orders
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                    </Button>
                    <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Order
                    </Button>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{orderStats.total}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Processing</CardTitle>
                        <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{orderStats.processing}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Shipped</CardTitle>
                        <Truck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{orderStats.shipped}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ${orders.reduce((sum, order) => sum + order.amount, 0).toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters and Search */}
            <Card>
                <CardHeader>
                    <CardTitle>Orders List</CardTitle>
                    <CardDescription>
                        View and manage all customer orders
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4 mb-6">
                        <div className="flex-1">
                            <Label htmlFor="search">Search Orders</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    id="search"
                                    placeholder="Search by order ID, customer name, or email..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="status-filter">Status</Label>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-40">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="processing">Processing</SelectItem>
                                    <SelectItem value="shipped">Shipped</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="payment-filter">Payment</Label>
                            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                                <SelectTrigger className="w-40">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Payments</SelectItem>
                                    <SelectItem value="paid">Paid</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="refunded">Refunded</SelectItem>
                                    <SelectItem value="failed">Failed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Orders Table */}
                    <div className="rounded-md border overflow-x-auto -mx-4 sm:mx-0">
                        <Table className="min-w-[900px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Order ID</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Payment</TableHead>
                                    <TableHead>Items</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredOrders.map((order) => (
                                    <TableRow key={order.id}>
                                        <TableCell className="font-medium">{order.id}</TableCell>
                                        <TableCell>
                                            <div>
                                                <div className="font-medium">{order.customer}</div>
                                                <div className="text-sm text-muted-foreground">{order.email}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <StatusBadge status={order.status} />
                                        </TableCell>
                                        <TableCell>
                                            <PaymentBadge status={order.payment} />
                                        </TableCell>
                                        <TableCell>{order.items}</TableCell>
                                        <TableCell>${order.amount.toFixed(2)}</TableCell>
                                        <TableCell>{new Date(order.date).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => {
                                                        logger.info('View Details clicked for order:', { data: order.id });
                                                        handleViewDetails(order.id);
                                                    }}>
                                                        <Eye className="h-4 w-4 mr-2" />
                                                        View Details
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => {
                                                        logger.info('Edit Order clicked for order:', { data: order.id });
                                                    }}>
                                                        <Edit className="h-4 w-4 mr-2" />
                                                        Edit Order
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    {/* Only show for eligible orders */}
                                                    {!["delivered", "cancelled", "refunded"].includes(order.status) && (
                                                        <DropdownMenuItem
                                                            onClick={() => handleRequestCancellation(order.id)}
                                                            disabled={loadingOrderId === order.id}
                                                            className="text-red-600"
                                                        >
                                                            {loadingOrderId === order.id ? (
                                                                <>
                                                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                                                    Requesting...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <XCircle className="h-4 w-4 mr-2" />
                                                                    Request Cancellation
                                                                </>
                                                            )}
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {filteredOrders.length === 0 && (
                        <div className="text-center py-12">
                            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-medium">No orders found</h3>
                            <p className="text-muted-foreground">
                                {searchTerm || statusFilter !== "all" || paymentFilter !== "all"
                                    ? "Try adjusting your search or filters"
                                    : "You don't have any orders yet"}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* View Order Details Dialog */}
            <ViewOrderDetails
                open={showViewDetails}
                onOpenChange={setShowViewDetails}
                orderId={selectedOrderId}
            />
        </div>
    );
}
