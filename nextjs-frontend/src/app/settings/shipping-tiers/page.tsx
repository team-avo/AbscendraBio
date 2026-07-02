'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { ProtectedRoute } from '@/contexts/auth-context';
import { ShippingTiersTable } from '@/components/shipping/shipping-tiers-table';
import { ShippingTierDialog } from '@/components/shipping/shipping-tier-dialog';
import { Button } from '@/components/ui/button';
import { Plus, Truck } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import logger from '@/lib/logger';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ShippingTier {
    id: string;
    name: string;
    minSubtotal: string | number;
    maxSubtotal: string | number | null;
    shippingRate: string | number;
    serviceName: string | null;
    isActive: boolean;
    createdAt: string;
}

export default function ShippingTiersPage() {
    const [tiers, setTiers] = useState<ShippingTier[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const [editingTier, setEditingTier] = useState<ShippingTier | null>(null);
    const [deletingTier, setDeletingTier] = useState<ShippingTier | null>(null);

    useEffect(() => {
        fetchTiers();
    }, []);

    const fetchTiers = async () => {
        try {
            setLoading(true);
            const response = await api.getShippingTiers();

            if (response.success && response.data) {
                setTiers(response.data);
            } else {
                toast.error(response.error || 'Failed to fetch shipping tiers');
            }
        } catch (error) {
            logger.error('Failed to fetch shipping tiers:', { error: error });
            toast.error('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (tier: ShippingTier) => {
        setEditingTier(tier);
        setShowDialog(true);
    };

    const handleDelete = async () => {
        if (!deletingTier) return;

        try {
            const response = await api.deleteShippingTier(deletingTier.id);
            if (response.success) {
                toast.success('Tier deleted successfully');
                fetchTiers();
            } else {
                toast.error(response.error || 'Failed to delete tier');
            }
        } catch (error) {
            logger.error('Failed to delete tier:', { error: error });
            toast.error('An unexpected error occurred');
        } finally {
            setDeletingTier(null);
        }
    };

    const handleDialogClose = () => {
        setShowDialog(false);
        setEditingTier(null);
    };

    const handleSuccess = () => {
        fetchTiers();
        handleDialogClose();
    };

    return (
        <ProtectedRoute requiredRoles={['ADMIN']}>
            <DashboardLayout>
                <div className="space-y-0">

                    {/* ════════ DARK HERO STRIP ════════ */}
                    <div className="relative bg-mist border border-line border-t-2 border-t-[#5A9ADA] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
                        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                        <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#5A9ADA]/8 rounded-full blur-[100px] pointer-events-none" />

                        <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div>
                                    <h1 className="text-xl font-black text-[#043061] tracking-tight">Shipping Tiers</h1>
                                    <p className="text-xs text-gray-500 mt-0.5">Configure dynamic shipping rates based on order subtotal ranges</p>
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <div className="flex items-center gap-2.5 bg-white border border-line rounded-xl px-4 py-2">
                                        <Truck className="h-4 w-4 text-[#5A9ADA]" />
                                        <div>
                                            <p className="text-[9px] text-gray-500 font-medium uppercase tracking-widest leading-none">Tiers</p>
                                            <p className="text-base font-black text-[#043061] tabular-nums leading-tight">{tiers.length}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowDialog(true)}
                                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#043061] text-white hover:bg-[#0b4f96] text-xs font-black uppercase tracking-widest transition-colors"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        Add Tier
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ════════ TABLE ════════ */}
                    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden mx-1 sm:mx-0 mt-4">
                        <ShippingTiersTable
                            tiers={tiers}
                            loading={loading}
                            onEdit={handleEdit}
                            onDelete={(tier) => setDeletingTier(tier)}
                        />
                    </div>

                    {/* Dialogs */}
                    <ShippingTierDialog
                        open={showDialog}
                        onOpenChange={handleDialogClose}
                        tier={editingTier}
                        onSuccess={handleSuccess}
                    />

                    <AlertDialog open={!!deletingTier} onOpenChange={() => setDeletingTier(null)}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete Shipping Tier</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Are you sure you want to delete the tier &quot;{deletingTier?.name}&quot;? This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleDelete}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
