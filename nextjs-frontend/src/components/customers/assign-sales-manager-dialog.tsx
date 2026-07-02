import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { api, Customer } from '@/lib/api';
import { toast } from 'sonner';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface AssignSalesManagerDialogProps {
    customer: Customer | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Check, ChevronsUpDown, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import logger from '@/lib/logger';

interface SalesManager {
    id: string;
    user: {
        firstName: string;
        lastName: string;
        email: string;
    };
}

export function AssignSalesManagerDialog({
    customer,
    open,
    onOpenChange,
    onSuccess
}: AssignSalesManagerDialogProps) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [salesManagers, setSalesManagers] = useState<SalesManager[]>([]);
    const [selectedManagerId, setSelectedManagerId] = useState<string>('');
    const [popoverOpen, setPopoverOpen] = useState(false);

    useEffect(() => {
        if (open) {
            fetchSalesManagers();
            // Pre-select current manager if exists
            if (customer?.salesManagerAssignments?.[0]?.salesManagerId) {
                setSelectedManagerId(customer.salesManagerAssignments[0].salesManagerId);
            } else {
                setSelectedManagerId('');
            }
        } else {
            // Reset popover state when dialog closes
            setPopoverOpen(false);
        }
    }, [open, customer]);

    const fetchSalesManagers = async () => {
        try {
            setLoading(true);
            const response = await api.get('/sales-managers');
            if (response.success && response.data) {
                setSalesManagers(response.data);
            }
        } catch (error) {
            logger.error('Failed to fetch sales managers:', { error: error });
            toast.error('Failed to load sales managers');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!customer || !selectedManagerId) return;

        try {
            setSaving(true);
            // Use the customer-based endpoint that only updates this customer's assignment
            const response = await api.put(`/customers/${customer.id}/sales-manager`, {
                salesManagerId: selectedManagerId
            });

            if (response.success) {
                toast.success('Sales manager assigned successfully');
                onSuccess();
                onOpenChange(false);
            } else {
                toast.error(response.error || 'Failed to assign sales manager');
            }
        } catch (error) {
            logger.error('Failed to assign sales manager:', { error: error });
            toast.error('Failed to assign sales manager');
        } finally {
            setSaving(false);
        }
    };

    if (!customer) return null;

    const hasExistingManager = customer.salesManagerAssignments && customer.salesManagerAssignments.length > 0;
    const dialogTitle = hasExistingManager ? "Change Sales Manager" : "Assign Sales Manager";
    const dialogDescription = hasExistingManager
        ? `Change the sales manager for ${customer.firstName} ${customer.lastName}.`
        : `Assign a sales manager to ${customer.firstName} ${customer.lastName}.`;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] p-0 rounded-2xl overflow-hidden border-gray-200">
                <div className="bg-[#043061] px-6 py-5 relative overflow-hidden flex-shrink-0">
                    <div className="absolute -top-8 -right-8 w-28 h-28 bg-[#5A9ADA]/25 rounded-full blur-2xl pointer-events-none" />
                    <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                            <Users className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <DialogTitle className="text-base font-bold text-white">Assign Sales Manager</DialogTitle>
                            <p className="text-xs text-white/50 mt-0.5">Assign or change the account manager</p>
                        </div>
                    </div>
                </div>

                <div className="p-6">
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="sales-manager">Sales Manager</Label>
                        {loading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LoadingSpinner size={16} />
                                Loading managers...
                            </div>
                        ) : (
                            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        className={cn(
                                            "w-full justify-between",
                                            !selectedManagerId && "text-muted-foreground"
                                        )}
                                    >
                                        {selectedManagerId
                                            ? salesManagers.find((mgr) => mgr.id === selectedManagerId)?.user.firstName + ' ' + salesManagers.find((mgr) => mgr.id === selectedManagerId)?.user.lastName
                                            : "Select a sales manager"}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="p-0 z-50 w-[var(--radix-popover-trigger-width)]"
                                    side="bottom"
                                    align="start"
                                    sideOffset={4}
                                    avoidCollisions={true}
                                    collisionPadding={20}
                                    style={{ maxHeight: 'var(--radix-popover-content-available-height)' }}
                                >
                                    <Command shouldFilter={true} className="w-full">
                                        <CommandInput placeholder="Search sales manager..." />
                                        <CommandList className="max-h-[300px] w-full overflow-y-auto overflow-x-hidden pointer-events-auto">
                                            <CommandEmpty>No sales manager found.</CommandEmpty>
                                            <CommandGroup>
                                                {salesManagers.map((mgr) => (
                                                    <CommandItem
                                                        value={`${mgr.user.firstName} ${mgr.user.lastName} ${mgr.user.email}`}
                                                        key={mgr.id}
                                                        onSelect={() => {
                                                            setSelectedManagerId(mgr.id);
                                                            setPopoverOpen(false); // Close popover after selection
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                mgr.id === selectedManagerId
                                                                    ? "opacity-100"
                                                                    : "opacity-0"
                                                            )}
                                                        />
                                                        {mgr.user.firstName} {mgr.user.lastName}
                                                        <span className="ml-2 text-xs text-muted-foreground">({mgr.user.email})</span>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving || !selectedManagerId || loading} className="bg-[#043061] hover:bg-[#0b4f96] text-white rounded-xl">
                        {saving && <LoadingSpinner size={16} className="mr-2" />}
                        Save Assignment
                    </Button>
                </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
