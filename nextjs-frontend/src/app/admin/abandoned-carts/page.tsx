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
                <div className="space-y-0">

                    {/* ════════ DARK HERO STRIP ════════ */}
                    <div className="relative bg-[#070B14] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
                        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                        <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#4D7DF2]/8 rounded-full blur-[100px] pointer-events-none" />

                        <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div>
                                    <h1 className="text-xl font-black text-white tracking-tight">Abandoned Carts</h1>
                                    <p className="text-xs text-gray-500 mt-0.5">Recover lost sales by notifying inactive customers</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-2">
                                        <ShoppingCart className="h-4 w-4 text-orange-400" />
                                        <div>
                                            <p className="text-[9px] text-gray-500 font-medium uppercase tracking-widest leading-none">Carts</p>
                                            <p className="text-base font-black text-white tabular-nums leading-tight">{carts.length.toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={fetchAbandonedCarts}
                                        disabled={loading}
                                        variant="outline"
                                        className="h-9 w-9 p-0 border-white/10 bg-white/[0.06] text-gray-300 hover:bg-white/[0.12] hover:text-white rounded-xl"
                                    >
                                        {loading ? <LoadingSpinner size={14} /> : <RefreshCw className="h-4 w-4" />}
                                    </Button>
                                    <Button
                                        onClick={handleSendAllClick}
                                        disabled={loading || sendingAll || carts.length === 0}
                                        className="h-9 px-5 bg-white text-[#070B14] hover:bg-gray-100 rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-50"
                                    >
                                        {sendingAll ? <LoadingSpinner size={14} className="mr-1.5" /> : <Mail className="h-3.5 w-3.5 mr-1.5" />}
                                        Notify All
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ════════ TABLE ════════ */}
                    <div className="mt-4 bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden mx-1 sm:mx-0">
                        <div className="overflow-x-auto">
                            {loading ? (
                                <div className="flex justify-center items-center py-16">
                                    <div className="w-8 h-8 border-2 border-[#4D7DF2]/30 border-t-[#4D7DF2] rounded-full animate-spin" />
                                </div>
                            ) : carts.length === 0 ? (
                                <div className="text-center py-16 text-gray-400 text-sm">No abandoned carts found for this time window.</div>
                            ) : (
                                <Table className="min-w-[700px]">
                                    <TableHeader>
                                        <TableRow className="bg-gray-50/50 border-b border-gray-100">
                                            <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wider">Customer</TableHead>
                                            <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wider">Items</TableHead>
                                            <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wider">Last Active</TableHead>
                                            <TableHead className="text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {carts.map((cart) => (
                                            <TableRow key={cart.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50">
                                                <TableCell>
                                                    <p className="text-sm font-bold text-gray-900">{cart.customer.firstName} {cart.customer.lastName}</p>
                                                    <p className="text-xs text-gray-400">{cart.customer.email}</p>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2 text-sm text-gray-700">
                                                        <ShoppingCart className="h-4 w-4 text-gray-400" />
                                                        <span className="font-semibold">{cart.items.reduce((sum, item) => sum + item.quantity, 0)} items</span>
                                                    </div>
                                                    <p className="text-xs text-gray-400 mt-0.5 max-w-[200px] truncate">
                                                        {cart.items.slice(0, 2).map(i => i.variant.product.name).join(', ')}
                                                        {cart.items.length > 2 ? ` +${cart.items.length - 2} more` : ''}
                                                    </p>
                                                </TableCell>
                                                <TableCell className="text-xs text-gray-500">
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
                                                        className="h-8 px-3 bg-[#070B14] hover:bg-[#1a2540] text-white rounded-xl text-xs font-bold"
                                                    >
                                                        {sendingEmailId === cart.id ? (
                                                            <LoadingSpinner size={12} className="mr-1.5" />
                                                        ) : (
                                                            <Mail className="h-3.5 w-3.5 mr-1.5" />
                                                        )}
                                                        Send Alert
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                            {carts.length > 0 && totalPages > 1 && (
                                <div className="px-6 py-4 border-t border-gray-100">
                                    <Pagination
                                        currentPage={page}
                                        totalPages={totalPages}
                                        onPageChange={setPage}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Confirmation dialogs */}
                    <ConfirmationDialog
                        open={showSendAllConfirm}
                        onOpenChange={setShowSendAllConfirm}
                        onConfirm={confirmSendAll}
                        title="Send Emails to All"
                        description={`This will send recovery emails to all ${carts.length} customers with abandoned carts. Continue?`}
                        confirmText="Send All"
                        cancelText="Cancel"
                        isLoading={sendingAll}
                    />
                    <ConfirmationDialog
                        open={!!cartToNotify}
                        onOpenChange={(o) => !o && setCartToNotify(null)}
                        onConfirm={confirmSendEmail}
                        title="Send Recovery Email"
                        description={`Send an abandoned cart email to ${cartToNotify?.customer.email}?`}
                        confirmText="Send Email"
                        cancelText="Cancel"
                        isLoading={sendingEmailId === cartToNotify?.id}
                    />
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
