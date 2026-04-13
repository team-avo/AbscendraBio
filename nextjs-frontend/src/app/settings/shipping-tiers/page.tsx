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
                <div className="space-y-5 px-2 sm:px-0">
                    {/* Header */}
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Shipping Tiers</h1>
                            <p className="text-sm sm:text-base text-muted-foreground">
                                Configure dynamic shipping rates based on order subtotal ranges.
                            </p>
                        </div>
                        <Button
                            className="w-full sm:w-auto h-9 px-4 bg-[#1B2D4F] hover:bg-[#243d6b] text-white rounded-xl text-sm font-medium"
                            onClick={() => setShowDialog(true)}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Tier
                        </Button>
                    </div>

                    {/* Tiers Table */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50">
                                <Truck className="h-4 w-4 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800">Configured Tiers</p>
                                <p className="text-xs text-slate-500">Define shipping costs for different order value ranges</p>
                            </div>
                        </div>
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
