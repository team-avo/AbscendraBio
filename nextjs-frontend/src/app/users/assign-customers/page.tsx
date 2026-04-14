'use client';

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';
import { toast } from 'sonner';
import { ProtectedRoute } from '@/contexts/auth-context';

export default function AssignCustomersPage() {
    const { user, hasRole } = useAuth();
    const [loading, setLoading] = useState(false);
    const [repSearchOpen, setRepSearchOpen] = useState(false);
    const [repSearchValue, setRepSearchValue] = useState('');
    const [allCustomersSearch, setAllCustomersSearch] = useState('');
    const [assignedCustomersSearch, setAssignedCustomersSearch] = useState('');
    const [reps, setReps] = useState<any[]>([]);
    const [allCustomers, setAllCustomers] = useState<any[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);

    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10000,
        total: 0,
        pages: 1
    });

    const [isFetchingCustomers, setIsFetchingCustomers] = useState(false);

    const canAccess = hasRole('ADMIN') || hasRole('SALES_MANAGER');

    useEffect(() => {
        if (!canAccess) return;
        (async () => {
            setLoading(true);
            try {
                const repsRes = await api.get('/sales-reps');
                if (repsRes.success) {
                    const data = (repsRes as any).data;
                    setReps(Array.isArray(data) ? data : (data?.salesReps ?? []));
                }
            } catch (error) {
                logger.error('Failed to fetch sales reps:', { error });
                toast.error('Failed to load sales reps');
            } finally {
                setLoading(false);
            }
        })();
    }, [canAccess]);

    const fetchCustomers = async () => {
        if (!canAccess) return;
        setIsFetchingCustomers(true);
        try {
            const res = await api.getCustomers({
                page: pagination.page,
                limit: pagination.limit,
                search: allCustomersSearch || undefined,
                isActive: true
            });

            if (res.success && res.data) {
                const responseData = res.data;
                setAllCustomers(responseData.customers || []);
                if (responseData.pagination) {
                    setPagination(prev => ({
                        ...prev,
                        total: responseData.pagination.total,
                        pages: responseData.pagination.pages
                    }));
                }
            }
        } catch (error) {
            logger.error('Failed to fetch customers:', { error });
            toast.error('Failed to fetch customers');
        } finally {
            setIsFetchingCustomers(false);
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchCustomers();
        }, 500);
        return () => clearTimeout(timeoutId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canAccess, pagination.page, allCustomersSearch]);

    useEffect(() => {
        setPagination(prev => ({ ...prev, page: 1 }));
    }, [allCustomersSearch]);

    const selectedRep = useMemo(() => reps.find(r => r.user?.id === selectedUserId || r.userId === selectedUserId) || null, [reps, selectedUserId]);

    const filteredReps = useMemo(() => {
        if (!repSearchValue) return reps;
        const searchLower = repSearchValue.toLowerCase();
        return reps.filter(rep => {
            const firstName = rep.user?.firstName || '';
            const lastName = rep.user?.lastName || '';
            const email = rep.user?.email || '';
            const fullName = `${firstName} ${lastName}`.toLowerCase();
            return fullName.includes(searchLower) || email.toLowerCase().includes(searchLower);
        });
    }, [reps, repSearchValue]);

    const selectedRepDisplay = useMemo(() => {
        if (!selectedRep || !selectedRep.user) return 'Choose sales rep';
        return `${selectedRep.user?.firstName || ''} ${selectedRep.user?.lastName || ''} (${selectedRep.user?.email || ''})`;
    }, [selectedRep]);

    useEffect(() => {
        if (selectedRep) {
            setSelectedCustomers(selectedRep.assignments?.map((a: any) => a.customerId) || []);
        } else {
            setSelectedCustomers([]);
        }
    }, [selectedRep]);

    const handleSaveAssignments = async () => {
        const rep = reps.find(r => r.user?.id === selectedUserId || r.userId === selectedUserId);
        if (!rep || !rep.id) return;
        setLoading(true);
        try {
            await api.put(`/sales-reps/${rep.id}/assignments`, { customerIds: selectedCustomers });

            const repsRes = await api.get('/sales-reps');
            if (repsRes.success) {
                const data = (repsRes as any).data;
                setReps(Array.isArray(data) ? data : (data?.salesReps ?? []));
            }

            setTimeout(() => {
                fetchCustomers();
            }, 500);

            toast.success('Assignments saved successfully');
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
                <div className="space-y-0">

                    {/* ════════ DARK HERO STRIP ════════ */}
                    <div className="relative bg-[#070B14] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
                        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                        <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#4D7DF2]/8 rounded-full blur-[100px] pointer-events-none" />
                        <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div>
                                    <h1 className="text-xl font-black text-white tracking-tight">Assign Customers</h1>
                                    <p className="text-xs text-gray-500 mt-0.5">Assign customers to sales representatives</p>
                                </div>
                                <div className="flex items-center gap-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-2">
                                    <Users className="h-4 w-4 text-[#4D7DF2]" />
                                    <div>
                                        <p className="text-[9px] text-gray-500 font-medium uppercase tracking-widest leading-none">Customers</p>
                                        <p className="text-base font-black text-white tabular-nums leading-tight">{pagination.total.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden mx-1 sm:mx-0">
                        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
                            <span className="font-semibold text-gray-900 text-sm">Customer Assignment</span>
                        </div>

                        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                            <div className="flex flex-col lg:flex-row gap-4 lg:items-end">
                                <div className="flex-1 space-y-2">
                                    <Label className="text-xs sm:text-sm font-medium">Select Sales Rep</Label>
                                    <Popover open={repSearchOpen} onOpenChange={setRepSearchOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={repSearchOpen}
                                                className="w-full justify-between"
                                                disabled={loading}
                                            >
                                                <span className="truncate">
                                                    {selectedRepDisplay}
                                                </span>
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                            <Command>
                                                <CommandInput
                                                    placeholder="Search reps by name/email..."
                                                    value={repSearchValue}
                                                    onValueChange={setRepSearchValue}
                                                />
                                                <CommandList>
                                                    <CommandEmpty>No sales rep found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {filteredReps.map((rep) => {
                                                            const repId = rep.user?.id || rep.userId;
                                                            const isSelected = selectedUserId === repId;
                                                            const displayText = `${rep.user?.firstName || ''} ${rep.user?.lastName || ''} ${rep.user?.email || ''}`.trim();
                                                            return (
                                                                <CommandItem
                                                                    key={repId}
                                                                    value={`${repId} ${displayText}`}
                                                                    onSelect={() => {
                                                                        setSelectedUserId(repId);
                                                                        setRepSearchOpen(false);
                                                                        setRepSearchValue('');
                                                                    }}
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4",
                                                                            isSelected ? "opacity-100" : "opacity-0"
                                                                        )}
                                                                    />
                                                                    <span className="truncate">
                                                                        {rep.user?.firstName} {rep.user?.lastName} ({rep.user?.email})
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
                                <div className="flex gap-2 w-full lg:w-auto">
                                    <Button
                                        className="w-full lg:w-auto h-10 sm:h-11 shadow-sm h-9 px-4 bg-[#1B2D4F] hover:bg-[#243d6b] text-white rounded-xl text-sm font-medium"
                                        disabled={!selectedUserId || loading}
                                        onClick={handleSaveAssignments}
                                    >
                                        {loading ? 'Saving...' : 'Save Assignments'}
                                    </Button>
                                </div>
                            </div>

                            {selectedRep && (
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
                                    {/* Available Customers */}
                                    <div className="flex flex-col h-[600px]">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="font-semibold text-sm text-gray-500">Available Customers (Select to Assign)</h3>
                                            <Badge variant="outline">{pagination.total} found</Badge>
                                        </div>
                                        <div className="mb-2">
                                            <Input
                                                value={allCustomersSearch}
                                                onChange={(e) => setAllCustomersSearch(e.target.value)}
                                                placeholder="Search by name or email..."
                                                className="w-full"
                                            />
                                        </div>
                                        <div className="flex-1 border rounded-md overflow-hidden relative flex flex-col">
                                            {isFetchingCustomers && allCustomers.length === 0 && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                                                    <span className="loading loading-spinner loading-sm"></span> Loading...
                                                </div>
                                            )}
                                            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                                {allCustomers.map(c => {
                                                    const isAssigned = selectedCustomers.includes(c.id);
                                                    const assignedRep = c.salesAssignments?.[0]?.salesRep?.user;
                                                    const assignedManager = c.salesManagerAssignments?.[0]?.salesManager?.user;

                                                    return (
                                                        <div
                                                            key={c.id}
                                                            className={cn(
                                                                "flex flex-col p-2 rounded-md hover:bg-gray-100 cursor-pointer transition-colors border",
                                                                isAssigned ? "border-green-200 bg-green-50" : "border-transparent"
                                                            )}
                                                            onClick={() => {
                                                                if (isAssigned) {
                                                                    setSelectedCustomers(prev => prev.filter(id => id !== c.id));
                                                                } else {
                                                                    setSelectedCustomers(prev => [...prev, c.id]);
                                                                }
                                                            }}
                                                        >
                                                            <div className="flex items-start justify-between w-full">
                                                                <div>
                                                                    <div className="font-medium text-sm">{c.firstName} {c.lastName}</div>
                                                                    <div className="text-xs text-muted-foreground">{c.email}</div>
                                                                </div>
                                                                {isAssigned ? (
                                                                    <Check className="h-4 w-4 text-green-600" />
                                                                ) : (
                                                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0">+</Button>
                                                                )}
                                                            </div>

                                                            {(assignedRep || assignedManager) && (
                                                                <div className="mt-2 text-xs flex flex-wrap gap-1">
                                                                    {assignedRep && (
                                                                        <Badge variant="secondary" className="text-[10px] px-1 h-5">
                                                                            Rep: {assignedRep.firstName} {assignedRep.lastName}
                                                                        </Badge>
                                                                    )}
                                                                    {assignedManager && (
                                                                        <Badge variant="outline" className="text-[10px] px-1 h-5 border-blue-200 text-blue-700 bg-blue-50">
                                                                            Manager: {assignedManager.firstName} {assignedManager.lastName}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}

                                                {allCustomers.length === 0 && !isFetchingCustomers && (
                                                    <div className="p-4 text-center text-sm text-muted-foreground">No customers found</div>
                                                )}
                                            </div>

                                            {/* Pagination Controls */}
                                            {pagination.pages > 1 && (
                                                <div className="p-2 border-t bg-gray-50 flex items-center justify-between">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={pagination.page <= 1}
                                                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                                    >
                                                        Prev
                                                    </Button>
                                                    <span className="text-xs text-gray-500">
                                                        Page {pagination.page} / {pagination.pages}
                                                    </span>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={pagination.page >= pagination.pages}
                                                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                                    >
                                                        Next
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Assigned Customers (Pending Save) */}
                                    <div className="flex flex-col h-[600px]">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="font-semibold text-sm text-gray-500">
                                                Assigned to {selectedRep.user?.firstName}
                                            </h3>
                                            <Badge variant="secondary">{selectedCustomers.length}</Badge>
                                        </div>
                                        <div className="mb-2">
                                            <Input
                                                value={assignedCustomersSearch}
                                                onChange={(e) => setAssignedCustomersSearch(e.target.value)}
                                                placeholder="Filter assigned..."
                                                className="w-full"
                                            />
                                        </div>
                                        <div className="flex-1 border rounded-md overflow-hidden">
                                            <div className="h-full overflow-y-auto p-2 space-y-1">
                                                {/*
                                                    Note: This list is currently built from `selectedCustomers` IDs.
                                                    We might not have the full customer objects for all IDs if we paginated.
                                                    Ideally, we should fetch details for assigned customers if missing.
                                                    For now, we filter from `allCustomers` + `reps` assignments cache, which might be incomplete.
                                                    Improving this would require a separate fetch for selected IDs.
                                                    Currently, sticking to simple filtering for speed.
                                                */}
                                                {selectedCustomers.length > 0 && selectedCustomers.map(id => {
                                                    let c = allCustomers.find(cx => cx.id === id);
                                                    if (!c && selectedRep?.assignments) {
                                                        const assignment = selectedRep.assignments.find((a: any) => a.customerId === id);
                                                        if (assignment && assignment.customer) c = assignment.customer;
                                                    }

                                                    if (!c) return null;

                                                    if (assignedCustomersSearch) {
                                                        const searchLower = assignedCustomersSearch.toLowerCase();
                                                        const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
                                                        const email = (c.email || '').toLowerCase();
                                                        if (!fullName.includes(searchLower) && !email.includes(searchLower)) return null;
                                                    }

                                                    return (
                                                        <div key={id} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-100 bg-gray-50/50">
                                                            <div>
                                                                <div className="font-medium text-sm">{c.firstName} {c.lastName}</div>
                                                                <div className="text-xs text-muted-foreground">{c.email}</div>
                                                            </div>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                onClick={() => setSelectedCustomers(prev => prev.filter(x => x !== id))}
                                                            >
                                                                ×
                                                            </Button>
                                                        </div>
                                                    );
                                                })}
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
