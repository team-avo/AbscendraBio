'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, Customer } from '@/lib/api';
import { toast } from 'sonner';
import logger from '@/lib/logger';

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
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Update Customer Type</DialogTitle>
                    <DialogDescription>
                        Change the customer type for {customer.firstName} {customer.lastName}.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
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
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Updating...' : 'Update Type'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
