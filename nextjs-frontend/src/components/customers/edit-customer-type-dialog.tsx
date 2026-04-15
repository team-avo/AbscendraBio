'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, Customer } from '@/lib/api';
import { toast } from 'sonner';
import logger from '@/lib/logger';
import { Users } from 'lucide-react';

interface EditCustomerTypeDialogProps {
    customer: Customer | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function EditCustomerTypeDialog({ customer, open, onOpenChange, onSuccess }: EditCustomerTypeDialogProps) {
    const [loading, setLoading] = useState(false);
    const [customerType, setCustomerType] = useState<'B2C' | 'B2B' | 'ENTERPRISE_1' | 'ENTERPRISE_2'>('B2C');

    useEffect(() => {
        if (customer) {
            setCustomerType(customer.customerType);
        }
    }, [customer]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!customer) return;

        try {
            setLoading(true);
            const response = await api.updateCustomer(customer.id, {
                customerType,
            });

            if (response.success) {
                toast.success('Customer type updated successfully');
                onSuccess();
                onOpenChange(false);
            } else {
                toast.error(response.error || 'Failed to update customer type');
            }
        } catch (error: any) {
            logger.error('Error updating customer type:', { error: error });
            toast.error(error?.response?.data?.error || error?.message || 'Failed to update customer type');
        } finally {
            setLoading(false);
        }
    };

    if (!customer) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] p-0 rounded-2xl overflow-hidden border-gray-200">
                <div className="bg-[#1B2D4F] px-6 py-5 relative overflow-hidden flex-shrink-0">
                    <div className="absolute -top-8 -right-8 w-28 h-28 bg-[#3A6FA0]/25 rounded-full blur-2xl pointer-events-none" />
                    <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                            <Users className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <DialogTitle className="text-base font-bold text-white">Edit Customer Type</DialogTitle>
                            <p className="text-xs text-white/50 mt-0.5">Update the account tier and pricing category</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 p-6">
                    <div className="space-y-2">
                        <Label htmlFor="customerType">Customer Type</Label>
                        <Select
                            value={customerType}
                            onValueChange={(value: 'B2C' | 'B2B' | 'ENTERPRISE_1' | 'ENTERPRISE_2') => setCustomerType(value)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select customer type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="B2C">Wholesale</SelectItem>
                                <SelectItem value="ENTERPRISE_1">Enterprise</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading} className="bg-[#1B2D4F] hover:bg-[#243d6b] text-white rounded-xl">
                            {loading ? 'Updating...' : 'Update Type'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
