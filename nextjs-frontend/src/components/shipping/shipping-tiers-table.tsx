'use client';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Truck } from 'lucide-react';

// Inline currency formatter
const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

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

interface ShippingTiersTableProps {
    tiers: ShippingTier[];
    loading: boolean;
    onEdit: (tier: ShippingTier) => void;
    onDelete: (tier: ShippingTier) => void;
}

export function ShippingTiersTable({
    tiers,
    loading,
    onEdit,
    onDelete,
}: ShippingTiersTableProps) {
    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (tiers.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed rounded-lg">
                <Truck className="h-10 w-10 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No shipping tiers found</h3>
                <p className="text-muted-foreground">
                    Create your first shipping tier to get started.
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="min-w-[150px]">Name</TableHead>
                        <TableHead className="min-w-[180px]">Range</TableHead>
                        <TableHead className="min-w-[100px]">Rate</TableHead>
                        <TableHead className="min-w-[150px]">Service</TableHead>
                        <TableHead className="min-w-[100px]">Status</TableHead>
                        <TableHead className="text-right min-w-[100px]">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {tiers.map((tier) => (
                        <TableRow key={tier.id}>
                            <TableCell className="font-medium">{tier.name}</TableCell>
                            <TableCell>
                                {formatCurrency(Number(tier.minSubtotal))} -{' '}
                                {tier.maxSubtotal
                                    ? formatCurrency(Number(tier.maxSubtotal))
                                    : '∞'}
                            </TableCell>
                            <TableCell>
                                {Number(tier.shippingRate) === 0 ? (
                                    <Badge className="bg-green-500 hover:bg-green-600">Free</Badge>
                                ) : (
                                    formatCurrency(Number(tier.shippingRate))
                                )}
                            </TableCell>
                            <TableCell>{tier.serviceName || 'Standard'}</TableCell>
                            <TableCell>
                                <Badge className={tier.isActive ? 'bg-green-500 hover:bg-green-600' : ''}>
                                    {tier.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onEdit(tier)}
                                    >
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:text-destructive"
                                        onClick={() => onDelete(tier)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
