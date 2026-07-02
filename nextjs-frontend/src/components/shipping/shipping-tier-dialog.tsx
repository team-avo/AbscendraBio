'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import logger from '@/lib/logger';
import { Truck } from 'lucide-react';

interface ShippingTier {
    id: string;
    name: string;
    minSubtotal: string | number;
    maxSubtotal: string | number | null;
    shippingRate: string | number;
    serviceName: string | null;
    isActive: boolean;
}

interface ShippingTierDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tier?: ShippingTier | null;
    onSuccess: () => void;
}

export function ShippingTierDialog({
    open,
    onOpenChange,
    tier,
    onSuccess,
}: ShippingTierDialogProps) {
    const isEditing = !!tier;
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        minSubtotal: '',
        maxSubtotal: '',
        shippingRate: '',
        serviceName: '',
        isActive: true,
    });

    useEffect(() => {
        if (tier) {
            setFormData({
                name: tier.name || '',
                minSubtotal: String(tier.minSubtotal || ''),
                maxSubtotal: tier.maxSubtotal ? String(tier.maxSubtotal) : '',
                shippingRate: String(tier.shippingRate || ''),
                serviceName: tier.serviceName || '',
                isActive: tier.isActive ?? true,
            });
        } else {
            setFormData({
                name: '',
                minSubtotal: '',
                maxSubtotal: '',
                shippingRate: '',
                serviceName: '',
                isActive: true,
            });
        }
    }, [tier, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = {
                name: formData.name,
                minSubtotal: parseFloat(formData.minSubtotal),
                maxSubtotal: formData.maxSubtotal ? parseFloat(formData.maxSubtotal) : null,
                shippingRate: parseFloat(formData.shippingRate),
                serviceName: formData.serviceName || undefined,
                isActive: formData.isActive,
            };

            let response;
            if (isEditing && tier) {
                response = await api.updateShippingTier(tier.id, payload);
            } else {
                response = await api.createShippingTier(payload);
            }

            if (response.success) {
                toast.success(isEditing ? 'Tier updated successfully' : 'Tier created successfully');
                onSuccess();
                onOpenChange(false);
            } else {
                toast.error(response.error || 'Failed to save tier');
            }
        } catch (error) {
            logger.error('Failed to save tier:', { error: error });
            toast.error('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] p-0 rounded-2xl overflow-hidden border-gray-200">
                <div className="bg-[#043061] px-6 py-5 relative overflow-hidden flex-shrink-0">
                  <div className="absolute -top-8 -right-8 w-28 h-28 bg-[#5A9ADA]/25 rounded-full blur-2xl pointer-events-none" />
                  <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />
                  <div className="flex items-center gap-3 relative z-10">
                    <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                      <Truck className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <DialogTitle className="text-base font-bold text-white">Shipping Tier</DialogTitle>
                      <p className="text-xs text-white/50 mt-0.5">{isEditing ? 'Update the shipping tier details' : 'Create a new shipping tier'}</p>
                    </div>
                  </div>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 p-6">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Tier Name</Label>
                            <Input
                                id="name"
                                placeholder="e.g., Free 2-Day Shipping"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="minSubtotal">Min Subtotal ($)</Label>
                                <Input
                                    id="minSubtotal"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    value={formData.minSubtotal}
                                    onChange={(e) => setFormData({ ...formData, minSubtotal: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="maxSubtotal">Max Subtotal ($)</Label>
                                <Input
                                    id="maxSubtotal"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="Leave empty for ∞"
                                    value={formData.maxSubtotal}
                                    onChange={(e) => setFormData({ ...formData, maxSubtotal: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="shippingRate">Shipping Rate ($)</Label>
                            <Input
                                id="shippingRate"
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00 for free shipping"
                                value={formData.shippingRate}
                                onChange={(e) => setFormData({ ...formData, shippingRate: e.target.value })}
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="serviceName">Service Name (Optional)</Label>
                            <Input
                                id="serviceName"
                                placeholder="e.g., 2DAY, STANDARD"
                                value={formData.serviceName}
                                onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
                            />
                        </div>
                        {isEditing && (
                            <div className="flex items-center justify-between">
                                <Label htmlFor="isActive">Active</Label>
                                <Switch
                                    id="isActive"
                                    checked={formData.isActive}
                                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                                />
                            </div>
                        )}
                    </div>
                    <DialogFooter className="px-6 pb-6 pt-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading} className="bg-[#043061] hover:bg-[#0b4f96] text-white rounded-xl">
                            {loading ? 'Saving...' : isEditing ? 'Update Tier' : 'Create Tier'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
