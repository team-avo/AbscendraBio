'use client';

import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import logger from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, Users } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ProtectedRoute } from '@/contexts/auth-context';

export default function AdminSalesManagerAssignmentsPage() {
    const { user, hasRole } = useAuth();
    const [loading, setLoading] = useState(false);
    const [managerSearchOpen, setManagerSearchOpen] = useState(false);
    const [managerSearchValue, setManagerSearchValue] = useState('');
    const [allCustomersSearch, setAllCustomersSearch] = useState('');
    const [assignedCustomersSearch, setAssignedCustomersSearch] = useState('');
    const [managers, setManagers] = useState<any[]>([]);
    const [allCustomers, setAllCustomers] = useState<any[]>([]);
    const [selectedManagerId, setSelectedManagerId] = useState<string>('');
    const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
    const [isFetchingCustomers, setIsFetchingCustomers] = useState(false);

    const canAccess = hasRole('ADMIN');

    useEffect(() => {
        if (!canAccess) return;
        (async () => {
            setLoading(true);
            try {
                const res = await api.getSalesManagers();
                if (res.success && res.data) {
                    setManagers(res.data);
                }
            } catch (error) {
                logger.error('Failed to fetch sales managers:', { error });
                toast.error('Failed to load sales managers');
            } finally {
                setLoading(false);
            }
        })();
    }, [canAccess]);

    useEffect(() => {
        if (!canAccess) return;
        (async () => {
            if (allCustomers.length > 0) return;

            setIsFetchingCustomers(true);
            try {
                const aggregated: any[] = [];
                let currentPage = 1;
                const limit = 100;

                while (currentPage <= 20) {
                    const res = await api.getCustomers({ page: currentPage, limit });
                    if (res.success && res.data) {
                        aggregated.push(...(res.data.customers || []));
                        const pages = res.data.pagination.pages;
                        if (!pages || currentPage >= pages) break;
                        currentPage += 1;
                    } else {
                        break;
                    }
                }
                setAllCustomers(aggregated);
            } catch (error) {
                logger.error('Failed to fetch customers:', { error });
            } finally {
                setIsFetchingCustomers(false);
            }
        })();
    }, [canAccess]);

    const selectedManager = useMemo(() =>
        managers.find(m => m.user?.id === selectedManagerId || m.userId === selectedManagerId) || null,
        [managers, selectedManagerId]);

    const filteredManagers = useMemo(() => {
        if (!managerSearchValue) return managers;
        const searchLower = managerSearchValue.toLowerCase();
        return managers.filter(m => {
            const firstName = m.user?.firstName || '';
            const lastName = m.user?.lastName || '';
            const email = m.user?.email || '';
            const fullName = `${firstName} ${lastName}`.toLowerCase();
            return fullName.includes(searchLower) || email.toLowerCase().includes(searchLower);
        });
    }, [managers, managerSearchValue]);

    const selectedManagerDisplay = useMemo(() => {
        if (!selectedManager || !selectedManager.user) return 'Choose sales manager';
        return `${selectedManager.user.firstName} ${selectedManager.user.lastName} (${selectedManager.user.email})`;
    }, [selectedManager]);

    useEffect(() => {
        if (selectedManager) {
            (async () => {
                try {
                    const res = await api.getSalesManager(selectedManager.id);
                    if (res.success && res.data) {
                        setSelectedCustomers(res.data.assignments?.map((a: any) => a.customer.id) || []);
                    }
                } catch (e) {
                    logger.error('Failed to load manager details', { error: e });
                }
            })();
        } else {
            setSelectedCustomers([]);
        }
    }, [selectedManager]);

    const handleSaveAssignments = async () => {
        if (!selectedManager || !selectedManager.id) return;
        setLoading(true);
        try {
            const res = await api.salesManagerAssignCustomers(selectedManager.id, selectedCustomers);
            if (res.success) {
                toast.success('Assignments saved successfully');
                const refreshRes = await api.getSalesManagers();
                if (refreshRes.success && refreshRes.data) {
                    setManagers(refreshRes.data);
                }
            } else {
                toast.error(res.error || 'Failed to save assignments');
            }
        } catch (error) {
            logger.error('Failed to save assignments:', { error });
            toast.error('Failed to save assignments');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ProtectedRoute requiredRoles={['ADMIN']}>
            <DashboardLayout>
                <div className="space-y-5 px-2 sm:px-0">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold tracking-tight">Assign Customers to Sales Managers</h1>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
                            <div className="p-1.5 bg-slate-100 rounded-lg">
                                <Users className="h-4 w-4 text-slate-600" />
                            </div>
                            <span className="font-semibold text-slate-800">Sales Manager Selection</span>
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                <div>
                                    <Label>Select Sales Manager</Label>
                                    <Popover open={managerSearchOpen} onOpenChange={setManagerSearchOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={managerSearchOpen}
                                                className="w-full justify-between mt-1"
                                                disabled={loading}
                                            >
                                                <span className="truncate">
                                                    {selectedManagerDisplay}
                                                </span>
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                            <Command>
                                                <CommandInput
                                                    placeholder="Search managers by name/email..."
                                                    value={managerSearchValue}
                                                    onValueChange={setManagerSearchValue}
                                                />
                                                <CommandList>
                                                    <CommandEmpty>No sales manager found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {filteredManagers.map((m) => {
                                                            const mId = m.user?.id || m.userId;
                                                            const isSelected = selectedManagerId === mId;
                                                            const displayText = `${m.user?.firstName || ''} ${m.user?.lastName || ''} ${m.user?.email || ''}`.trim();
                                                            return (
                                                                <CommandItem
                                                                    key={mId}
                                                                    value={`${mId} ${displayText}`}
                                                                    onSelect={() => {
                                                                        setSelectedManagerId(mId);
                                                                        setManagerSearchOpen(false);
                                                                        setManagerSearchValue('');
                                                                    }}
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4",
                                                                            isSelected ? "opacity-100" : "opacity-0"
                                                                        )}
                                                                    />
                                                                    <span className="truncate">
                                                                        {m.user?.firstName} {m.user?.lastName} ({m.user?.email})
                                                                    </span>
                                                                </CommandItem>
                                                            );
                                                        })}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        className="h-9 px-4 bg-[#1B2D4F] hover:bg-[#243d6b] text-white rounded-xl text-sm font-medium"
                                        disabled={!selectedManagerId || loading}
                                        onClick={handleSaveAssignments}
                                    >
                                        {loading ? <LoadingSpinner size={16} className="mr-2" /> : null}
                                        {loading ? 'Saving...' : 'Save Assignments'}
                                    </Button>
                                </div>
                            </div>

                            {selectedManager && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                    {/* Available Customers */}
                                    <div className="flex flex-col h-[500px]">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="font-semibold text-sm text-gray-500">Available Customers</h3>
                                            <Badge variant="outline">{allCustomers.length} loaded</Badge>
                                        </div>
                                        <div className="mb-2">
                                            <Input
                                                value={allCustomersSearch}
                                                onChange={(e) => setAllCustomersSearch(e.target.value)}
                                                placeholder="Search by name or email..."
                                                className="w-full"
                                            />
                                        </div>
                                        <div className="flex-1 border rounded-md overflow-hidden relative">
                                            {isFetchingCustomers && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10 font-medium">
                                                    <LoadingSpinner size={16} className="mr-2" /> Loading...
                                                </div>
                                            )}
                                            <div className="h-full overflow-y-auto p-2 space-y-1">
                                                {allCustomers
                                                    .filter(c => {
                                                        if (!allCustomersSearch) return true;
                                                        const searchLower = allCustomersSearch.toLowerCase();
                                                        const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
                                                        const email = (c.email || '').toLowerCase();
                                                        return fullName.includes(searchLower) || email.includes(searchLower);
                                                    })
                                                    .map(c => {
                                                        const isAssigned = selectedCustomers.includes(c.id);
                                                        return (
                                                            <div
                                                                key={c.id}
                                                                className={cn(
                                                                    "flex items-center justify-between p-2 rounded-md hover:bg-gray-100 cursor-pointer transition-colors",
                                                                    isAssigned && "opacity-50"
                                                                )}
                                                                onClick={() => !isAssigned && setSelectedCustomers(prev => [...prev, c.id])}
                                                            >
                                                                <div>
                                                                    <div className="font-medium text-sm">{c.firstName} {c.lastName}</div>
                                                                    <div className="text-xs text-muted-foreground">{c.email}</div>
                                                                </div>
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-8 w-8 p-0"
                                                                    disabled={isAssigned}
                                                                >
                                                                    {isAssigned ? <Check className="h-4 w-4" /> : "+"}
                                                                </Button>
                                                            </div>
                                                        );
                                                    })}

                                                {allCustomers.length === 0 && !isFetchingCustomers && (
                                                    <div className="p-4 text-center text-sm text-muted-foreground">No customers found</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Assigned Customers */}
                                    <div className="flex flex-col h-[500px]">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="font-semibold text-sm text-gray-500">
                                                Assigned to {selectedManager.user?.firstName}
                                            </h3>
                                            <Badge variant="secondary">{selectedCustomers.length}</Badge>
                                        </div>
                                        <div className="mb-2">
                                            <Input
                                                value={assignedCustomersSearch}
                                                onChange={(e) => setAssignedCustomersSearch(e.target.value)}
                                                placeholder="Search assigned..."
                                                className="w-full"
                                            />
                                        </div>
                                        <div className="flex-1 border rounded-md overflow-hidden">
                                            <div className="h-full overflow-y-auto p-2 space-y-1">
                                                {allCustomers
                                                    .filter(c => {
                                                        if (!selectedCustomers.includes(c.id)) return false;
                                                        if (!assignedCustomersSearch) return true;
                                                        const searchLower = assignedCustomersSearch.toLowerCase();
                                                        const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
                                                        const email = (c.email || '').toLowerCase();
                                                        return fullName.includes(searchLower) || email.includes(searchLower);
                                                    })
                                                    .map(c => (
                                                        <div key={c.id} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-100 bg-gray-50/50">
                                                            <div>
                                                                <div className="font-medium text-sm">{c.firstName} {c.lastName}</div>
                                                                <div className="text-xs text-muted-foreground">{c.email}</div>
                                                            </div>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                onClick={() => setSelectedCustomers(prev => prev.filter(id => id !== c.id))}
                                                            >
                                                                ×
                                                            </Button>
                                                        </div>
                                                    ))}
                                                {selectedCustomers.length === 0 && (
                                                    <div className="p-4 text-center text-sm text-muted-foreground">
                                                        No customers assigned
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
