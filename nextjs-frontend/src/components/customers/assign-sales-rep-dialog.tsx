import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { api, Customer } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface AssignSalesRepDialogProps {
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
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import logger from '@/lib/logger';

interface SalesRep {
    id: string;
    user: {
        firstName: string;
        lastName: string;
        email: string;
    };
}

export function AssignSalesRepDialog({
    customer,
    open,
    onOpenChange,
    onSuccess
}: AssignSalesRepDialogProps) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
    const [selectedRepId, setSelectedRepId] = useState<string>('');
    const [popoverOpen, setPopoverOpen] = useState(false);

    useEffect(() => {
        if (open) {
            fetchSalesReps();
            // Pre-select current rep if exists
            if (customer?.salesAssignments?.[0]?.salesRepId) {
                setSelectedRepId(customer.salesAssignments[0].salesRepId);
            } else {
                setSelectedRepId('');
            }
        } else {
            // Reset popover state when dialog closes
            setPopoverOpen(false);
        }
    }, [open, customer]);

    const fetchSalesReps = async () => {
        try {
            setLoading(true);
            const response = await api.get('/sales-reps');
            if (response.success && response.data) {
                setSalesReps(response.data);
            }
        } catch (error) {
            logger.error('Failed to fetch sales reps:', { error: error });
            toast.error('Failed to load sales representatives');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!customer || !selectedRepId) return;

        try {
            setSaving(true);
            const response = await api.updateCustomerSalesRep(customer.id, selectedRepId);

            if (response.success) {
                toast.success('Sales representative assigned successfully');
                onSuccess();
                onOpenChange(false);
            } else {
                toast.error(response.error || 'Failed to assign sales representative');
            }
        } catch (error) {
            logger.error('Failed to assign sales rep:', { error: error });
            toast.error('Failed to assign sales representative');
        } finally {
            setSaving(false);
        }
    };

    if (!customer) return null;

    const hasExistingRep = customer.salesAssignments && customer.salesAssignments.length > 0;
    const dialogTitle = hasExistingRep ? "Change Sales Representative" : "Assign Sales Representative";
    const dialogDescription = hasExistingRep
        ? `Change the sales representative for ${customer.firstName} ${customer.lastName}.`
        : `Assign a sales representative to ${customer.firstName} ${customer.lastName}.`;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{dialogTitle}</DialogTitle>
                    <DialogDescription>
                        {dialogDescription}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="sales-rep">Sales Representative</Label>
                        {loading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading reps...
                            </div>
                        ) : (
                            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        className={cn(
                                            "w-full justify-between",
                                            !selectedRepId && "text-muted-foreground"
                                        )}
                                    >
                                        {selectedRepId
                                            ? salesReps.find((rep) => rep.id === selectedRepId)?.user.firstName + ' ' + salesReps.find((rep) => rep.id === selectedRepId)?.user.lastName
                                            : "Select a sales representative"}
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
                                        <CommandInput placeholder="Search sales rep..." />
                                        <CommandList className="max-h-[300px] w-full overflow-y-auto overflow-x-hidden pointer-events-auto">
                                            <CommandEmpty>No sales rep found.</CommandEmpty>
                                            <CommandGroup>
                                                {salesReps.map((rep) => (
                                                    <CommandItem
                                                        value={`${rep.user.firstName} ${rep.user.lastName} ${rep.user.email}`}
                                                        key={rep.id}
                                                        onSelect={() => {
                                                            setSelectedRepId(rep.id);
                                                            setPopoverOpen(false); // Close popover after selection
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                rep.id === selectedRepId
                                                                    ? "opacity-100"
                                                                    : "opacity-0"
                                                            )}
                                                        />
                                                        {rep.user.firstName} {rep.user.lastName}
                                                        <span className="ml-2 text-xs text-muted-foreground">({rep.user.email})</span>
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
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving || !selectedRepId || loading}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Assignment
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
