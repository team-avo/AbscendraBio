'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { ProtectedRoute } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import logger from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Mail, ShoppingCart, RefreshCw } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Badge } from '@/components/ui/badge';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Pagination } from '@/components/ui/pagination';

interface AbandonedCart {
    id: string;
    customerId: string;
    updatedAt: string;
    customer: {
        firstName: string;
        lastName: string;
        email: string;
        customerType: string;
        mobile: string;
    };
    items: {
        quantity: number;
        updatedAt: string;
        variant: {
            name: string;
            sku: string;
            product: {
                name: string;
            };
        };
    }[];
}

export default function AbandonedCartsPage() {
    const [carts, setCarts] = useState<AbandonedCart[]>([]);
    const [loading, setLoading] = useState(true);
    const [minutes, setMinutes] = useState(30);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
    const [sendingAll, setSendingAll] = useState(false);

    // Dialog states
    const [showSendAllConfirm, setShowSendAllConfirm] = useState(false);
    const [cartToNotify, setCartToNotify] = useState<AbandonedCart | null>(null);

    useEffect(() => {
        fetchAbandonedCarts();
    }, [page]);

    const fetchAbandonedCarts = async () => {
        setLoading(true);
        try {
            const response = await api.getAbandonedCarts(minutes, page);
            if (response.success && response.data) {
                setCarts(response.data);
                if (response.pagination) {
                    setTotalPages(response.pagination.pages);
                }
            } else {
                toast.error('Failed to fetch abandoned carts');
            }
        } catch (error) {
            logger.error('Error fetching carts:', { error });
            toast.error('An error occurred while fetching carts');
        } finally {
            setLoading(false);
        }
    };

    const handleSendAllClick = () => {
        setShowSendAllConfirm(true);
    };

    const confirmSendAll = async () => {
        if (sendingAll) return;
        setSendingAll(true);
        try {
            const response = await api.notifyAllAbandonedCarts(minutes);
            if (response.success) {
                toast.success(response.message || 'Emails sent successfully');
                fetchAbandonedCarts(); // Refresh list
                setShowSendAllConfirm(false);
            } else {
                toast.error(response.error || 'Failed to send emails');
            }
        } catch (error) {
            logger.error('Error sending bulk emails:', { error });
            toast.error('An error occurred while sending emails');
        } finally {
            setSendingAll(false);
        }
    };

    const handleSendEmailClick = (cart: AbandonedCart) => {
        setCartToNotify(cart);
    };

    const confirmSendEmail = async () => {
        if (!cartToNotify || sendingEmailId) return;

        const cart = cartToNotify;
        setSendingEmailId(cart.id);

        try {
            const response = await api.notifyAbandonedCart(cart.id, cart.customer.email);
            if (response.success) {
                toast.success(`Email sent to ${cart.customer.email}`);
                setCartToNotify(null);
            } else {
                toast.error(response.error || 'Failed to send email');
            }
        } catch (error) {
            logger.error('Error sending email:', { error });
            toast.error('Details: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setSendingEmailId(null);
        }
    };

    return (
        <ProtectedRoute requiredRoles={['ADMIN', 'SUPER_ADMIN', 'STAFF']}>
            <DashboardLayout>
                <div className="space-y-5 px-2 sm:px-0">
                    {/* Header */}
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">Abandoned Carts</h1>
                            <p className="text-muted-foreground text-xs sm:text-sm lg:text-base">
                                View and manage carts that have been inactive.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={handleSendAllClick}
                                disabled={loading || sendingAll || carts.length === 0}
                                className="h-9 px-4 bg-[#1B2D4F] hover:bg-[#243d6b] text-white rounded-xl text-sm font-medium disabled:opacity-50 gap-2"
                            >
                                {sendingAll ? <LoadingSpinner size={16} /> : <Mail className="h-4 w-4" />}
                                Send for All
                            </Button>
                            <Button
                                onClick={fetchAbandonedCarts}
                                disabled={loading}
                                variant="outline"
                                size="icon"
                                className="rounded-xl"
                            >
                                {loading ? <LoadingSpinner size={16} /> : <RefreshCw className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>

                    {/* Table Card */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                                <ShoppingCart className="h-4 w-4 text-orange-500" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold text-slate-900">Customer Carts</h2>
                                <p className="text-xs text-slate-500">List of inactive carts</p>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            {loading ? (
                                <div className="flex justify-center p-8">
                                    <LoadingSpinner size={32} className="text-muted-foreground" />
                                </div>
                            ) : carts.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    No abandoned carts found matching the criteria.
                                </div>
                            ) : (
                                <div className="overflow-x-auto -mx-4 sm:mx-0">
                                    <Table className="min-w-[700px]">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Customer</TableHead>
                                                <TableHead>Items</TableHead>
                                                <TableHead>Last Active</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {carts.map((cart) => (
                                                <TableRow key={cart.id}>
                                                    <TableCell>
                                                        <div className="font-medium">
                                                            {cart.customer.firstName} {cart.customer.lastName}
                                                        </div>
                                                        <div className="text-sm text-muted-foreground">
                                                            {cart.customer.email}
                                                        </div>
                                                    </TableCell>

                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                                                            <span>
                                                                {cart.items.reduce((sum, item) => sum + item.quantity, 0)} items
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate">
                                                            {cart.items.slice(0, 2).map(i => i.variant.product.name).join(', ')}
                                                            {cart.items.length > 2 ? ` +${cart.items.length - 2} more` : ''}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {cart.items.length > 0
                                                            ? new Date(cart.items[0].updatedAt || cart.updatedAt).toLocaleString()
                                                            : new Date(cart.updatedAt).toLocaleString()
                                                        }
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleSendEmailClick(cart)}
                                                            disabled={sendingEmailId === cart.id}
                                                        >
                                                            {sendingEmailId === cart.id ? (
                                                                <LoadingSpinner size={16} className="mr-2" />
                                                            ) : (
                                                                <Mail className="h-4 w-4 mr-2" />
                                                            )}
                                                            <span className="hidden sm:inline">Send Email Alert</span>
                                                            <span className="sm:hidden">Send</span>
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}

                            {/* Pagination Controls */}
                            {carts.length > 0 && totalPages > 1 && (
                                <div className="mt-4 pt-4 border-t px-6 pb-4">
                                    <Pagination
                                        currentPage={page}
                                        totalPages={totalPages}
                                        onPageChange={setPage}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <ConfirmationDialog
                        open={showSendAllConfirm}
                        onOpenChange={setShowSendAllConfirm}
                        onConfirm={confirmSendAll}
                        title="Send Emails to All Abandoned Carts"
                        description={`Are you sure you want to send emails to all customers with abandoned carts ? This action cannot be undone.`}
                        confirmText="Send All Emails"
                        cancelText="Cancel"
                        isLoading={sendingAll}
                    />

                    <ConfirmationDialog
                        open={!!cartToNotify}
                        onOpenChange={(open) => !open && setCartToNotify(null)}
                        onConfirm={confirmSendEmail}
                        title="Send Abandoned Cart Email"
                        description={`Are you sure you want to send an abandoned cart reminder to ${cartToNotify?.customer.email}?`}
                        confirmText="Send Email"
                        cancelText="Cancel"
                        isLoading={!!sendingEmailId && (cartToNotify ? sendingEmailId === cartToNotify.id : false)}
                    />
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
