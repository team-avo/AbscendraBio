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
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Customer } from '@/lib/api';
import { Progress } from '@/components/ui/progress';

interface SalesManager {
  id: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    isActive: boolean;
  };
  salesReps: Array<{
    id: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      isActive: boolean;
    };
  }>;
  assignments?: Array<{
    id: string;
    customerId: string;
    customer: Customer;
  }>;
}

interface SalesRep {
  id: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    isActive: boolean;
  };
  salesManager?: {
    id: string;
    user?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  };
}

export default function SalesManagersPage() {
  const { user, hasRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingUnassigned, setLoadingUnassigned] = useState(false);
  const [managerSearchOpen, setManagerSearchOpen] = useState(false);
  const [managerSearchValue, setManagerSearchValue] = useState('');
  const [allRepsSearch, setAllRepsSearch] = useState('');
  const [assignedRepsSearch, setAssignedRepsSearch] = useState('');
  const [managers, setManagers] = useState<SalesManager[]>([]);
  const [allReps, setAllReps] = useState<SalesRep[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');
  const [selectedReps, setSelectedReps] = useState<string[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [unassignedCustomers, setUnassignedCustomers] = useState<Customer[]>([]);
  const [unassignedCustomersSearch, setUnassignedCustomersSearch] = useState('');
  const [assignedCustomersSearch, setAssignedCustomersSearch] = useState('');
  const [repsTab, setRepsTab] = useState('assigned');
  const [customersTab, setCustomersTab] = useState('assigned');

  const isAdmin = hasRole('ADMIN');

  // Load all managers once on mount
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoading(true);
      try {
        const managersRes = await api.get('/sales-managers');
        if (managersRes.success) {
          const data = (managersRes as any).data;
          setManagers(Array.isArray(data) ? data : (data?.managers ?? []));
        }
      } catch (error) {
        logger.error('Failed to fetch sales managers:', { error });
        toast.error('Failed to load sales managers');
      } finally {
        setLoading(false);
      }
    })();
  }, [isAdmin]);

  // Load all sales reps once on mount
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoading(true);
      try {
        const repsRes = await api.get('/sales-managers/available/sales-reps');
        if (repsRes.success) {
          const data = (repsRes as any).data;
          setAllReps(Array.isArray(data) ? data : (data?.salesReps ?? []));
        }
      } catch (error) {
        logger.error('Failed to fetch sales reps:', { error });
        toast.error('Failed to load sales representatives');
      } finally {
        setLoading(false);
      }
    })();
  }, [isAdmin]);

  // Load unassigned customers with server-side search
  useEffect(() => {
    if (!isAdmin || customersTab !== 'add') return;

    const fetchCandidates = async () => {
      setLoadingUnassigned(true);
      try {
        const res = await api.getUnassignedCustomersForManager({
          search: unassignedCustomersSearch,
          limit: 10000,
        });
        if (res.success) {
          setUnassignedCustomers(res.data || []);
        }
      } catch (error) {
        logger.error('Failed to fetch assignment candidates:', { error });
      } finally {
        setLoadingUnassigned(false);
      }
    };

    const timer = setTimeout(() => {
      fetchCandidates();
    }, 500);

    return () => clearTimeout(timer);
  }, [isAdmin, customersTab, unassignedCustomersSearch]);

  const selectedManager = useMemo(() => managers.find(m => m.id === selectedManagerId) || null, [managers, selectedManagerId]);

  const filteredManagers = useMemo(() => {
    if (!managerSearchValue) return managers;
    const searchLower = managerSearchValue.toLowerCase();
    return managers.filter(manager => {
      const firstName = manager.user?.firstName || '';
      const lastName = manager.user?.lastName || '';
      const email = manager.user?.email || '';
      const fullName = `${firstName} ${lastName}`.toLowerCase();
      return fullName.includes(searchLower) || email.toLowerCase().includes(searchLower);
    });
  }, [managers, managerSearchValue]);

  const selectedManagerDisplay = useMemo(() => {
    if (!selectedManager || !selectedManager.user) return 'Choose manager';
    return `${selectedManager.user.firstName} ${selectedManager.user.lastName} (${selectedManager.user.email})`;
  }, [selectedManager]);

  const displayAssignedCustomers = useMemo(() => {
    if (!selectedManager) return [];

    const assignedFromServer = selectedManager.assignments?.map(a => a.customer) || [];
    const selectedFromCandidates = unassignedCustomers.filter(c => selectedCustomers.includes(c.id));

    const uniqueMap = new Map<string, Customer>();
    assignedFromServer.forEach(c => { if (c) uniqueMap.set(c.id, c); });
    selectedFromCandidates.forEach(c => { if (c) uniqueMap.set(c.id, c); });

    return Array.from(uniqueMap.values())
      .filter(c => selectedCustomers.includes(c.id));
  }, [selectedManager, unassignedCustomers, selectedCustomers]);

  useEffect(() => {
    if (selectedManager) {
      setSelectedReps(selectedManager.salesReps?.map(r => r.id) || []);
      setSelectedCustomers(selectedManager.assignments?.map(a => a.customerId) || []);
    } else {
      setSelectedReps([]);
      setSelectedCustomers([]);
    }
  }, [selectedManager]);

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="space-y-5 px-2 sm:px-0">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
            <h2 className="text-lg font-semibold mb-1">Access Denied</h2>
            <p className="text-muted-foreground text-sm">You do not have permission to view this page.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const handleSaveAssignments = async () => {
    if (!selectedManager) return;
    setLoading(true);
    try {
      const repsResponse = await api.put(`/sales-managers/${selectedManager.id}/sales-reps`, { salesRepIds: selectedReps });
      if (!repsResponse.success) {
        throw new Error(repsResponse.error || 'Failed to update sales representatives');
      }

      const customersResponse = await api.put(`/sales-managers/${selectedManager.id}/assignments`, { customerIds: selectedCustomers });
      if (!customersResponse.success) {
        throw new Error(customersResponse.error || 'Failed to update customer assignments');
      }

      const managersRes = await api.get('/sales-managers');
      if (managersRes.success) {
        const data = (managersRes as any).data;
        setManagers(Array.isArray(data) ? data : (data?.managers ?? []));
      }

      toast.success('Assignments saved successfully! Sales reps and customers have been updated.');
    } catch (error: any) {
      logger.error('Failed to save assignments:', { error });
      const errorMessage = error?.message || error?.response?.data?.error || 'Failed to save assignments. Please try again.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Dark hero strip */}
        <div className="bg-mist border border-line border-t-2 border-t-[#5A9ADA] rounded-2xl mx-1 sm:mx-0 overflow-hidden relative">
          {/* Grid texture */}
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
              backgroundSize: '32px 32px',
            }}
          />
          {/* Blue glow */}
          <div className="absolute top-0 left-1/4 w-72 h-32 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative px-5 pt-5 pb-4 space-y-3">
            {/* Top row: title left, stat chip + CTA right */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">Sales Managers</h1>
                <p className="text-blue-200/60 text-xs mt-0.5">Manage your sales leadership team</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Stat chip */}
                <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-400/20 rounded-full px-3 py-1.5">
                  <Users className="h-3.5 w-3.5 text-blue-400" />
                  <span className="text-xs font-semibold text-blue-300">
                    {managers.length} Manager{managers.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {/* Save button in hero */}
                <Button
                  disabled={!selectedManagerId || loading}
                  onClick={handleSaveAssignments}
                  className="h-8 px-4 bg-white hover:bg-gray-100 text-[#043061] rounded-xl text-xs font-semibold"
                >
                  Save Assignments
                </Button>
                {selectedManagerId && (
                  <Button
                    variant="outline"
                    onClick={() => window.location.href = `/analytics/person?managerId=${selectedManagerId}`}
                    className="h-8 px-3 text-xs border-white/20 text-white hover:bg-white/10 rounded-xl"
                  >
                    View Analytics
                  </Button>
                )}
              </div>
            </div>

            {/* Manager selector row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end pb-1">
              <div>
                <Label className="text-blue-200/70 text-xs mb-1 block">Select Sales Manager</Label>
                {loading ? (
                  <div className="flex items-center gap-2 p-2 border border-white/10 rounded-xl bg-white/5">
                    <Progress value={undefined} className="w-full" />
                    <span className="text-sm text-blue-200/50 whitespace-nowrap">Loading managers...</span>
                  </div>
                ) : (
                  <Popover open={managerSearchOpen} onOpenChange={setManagerSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={managerSearchOpen}
                        className="w-full justify-between bg-white/5 border-white/15 text-white hover:bg-white/10 hover:text-white rounded-xl h-9 text-sm"
                        disabled={loading}
                      >
                        <span className="truncate">{selectedManagerDisplay}</span>
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
                            {filteredManagers.map((manager) => {
                              const managerId = manager.id;
                              const isSelected = selectedManagerId === managerId;
                              const displayText = `${manager.user?.firstName || ''} ${manager.user?.lastName || ''} ${manager.user?.email || ''}`.trim();
                              return (
                                <CommandItem
                                  key={managerId}
                                  value={`${managerId} ${displayText}`}
                                  onSelect={() => {
                                    setSelectedManagerId(managerId);
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
                                    {manager.user?.firstName} {manager.user?.lastName} ({manager.user?.email})
                                  </span>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main content panel */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden mx-1 sm:mx-0">
          <div className="p-5">
            {selectedManager && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Side: Sales Representatives */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Sales Representatives</h3>
                  </div>

                  <Tabs value={repsTab} onValueChange={setRepsTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                      <TabsTrigger value="assigned">Assigned Reps</TabsTrigger>
                      <TabsTrigger value="add">Add a sales rep</TabsTrigger>
                    </TabsList>

                    <TabsContent value="assigned" className="mt-0">
                      <div className="mb-3">
                        <Input
                          value={assignedRepsSearch}
                          onChange={(e) => setAssignedRepsSearch(e.target.value)}
                          placeholder="Search assigned reps..."
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2 max-h-[500px] overflow-y-auto border rounded-lg p-4 bg-gray-50/50 relative">
                        {loading && (
                          <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center p-4">
                            <Progress value={undefined} className="w-[60%]" />
                          </div>
                        )}
                        {allReps
                          .filter(r => {
                            if (!selectedReps.includes(r.id)) return false;
                            if (!assignedRepsSearch) return true;
                            const searchLower = assignedRepsSearch.toLowerCase();
                            const fullName = `${r.user?.firstName || ''} ${r.user?.lastName || ''}`.toLowerCase();
                            const email = (r.user?.email || '').toLowerCase();
                            return fullName.includes(searchLower) || email.includes(searchLower);
                          })
                          .map(r => (
                            <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white border rounded-md shadow-sm gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-sm truncate">{r.user?.firstName} {r.user?.lastName}</div>
                                <div className="text-xs text-muted-foreground truncate">{r.user?.email}</div>
                              </div>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setSelectedReps(prev => prev.filter(id => id !== r.id))}
                                className="h-8 px-3 sm:shrink-0 text-xs"
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                        {selectedReps.length === 0 && (
                          <div className="text-sm text-muted-foreground text-center py-8 bg-white border border-dashed rounded-md">
                            No sales representatives assigned yet
                          </div>
                        )}
                        {selectedReps.length > 0 && allReps.filter(r => {
                          if (!selectedReps.includes(r.id)) return false;
                          if (!assignedRepsSearch) return false;
                          const searchLower = assignedRepsSearch.toLowerCase();
                          const fullName = `${r.user.firstName} ${r.user.lastName}`.toLowerCase();
                          const email = (r.user.email || '').toLowerCase();
                          return fullName.includes(searchLower) || email.includes(searchLower);
                        }).length === 0 && assignedRepsSearch && (
                          <div className="text-sm text-muted-foreground text-center py-8">
                            No assigned reps found matching "{assignedRepsSearch}"
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="add" className="mt-0">
                      <div className="mb-3">
                        <Input
                          value={allRepsSearch}
                          onChange={(e) => setAllRepsSearch(e.target.value)}
                          placeholder="Search all reps by name/email..."
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2 max-h-[500px] overflow-y-auto border rounded-lg p-4 bg-gray-50/50 relative">
                        {loading && (
                          <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center p-4">
                            <Progress value={undefined} className="w-[60%]" />
                          </div>
                        )}
                        {allReps
                          .filter(r => {
                            if (selectedReps.includes(r.id)) return false;
                            if (!allRepsSearch) return true;
                            const searchLower = allRepsSearch.toLowerCase();
                            const fullName = `${r.user?.firstName || ''} ${r.user?.lastName || ''}`.toLowerCase();
                            const email = (r.user?.email || '').toLowerCase();
                            return fullName.includes(searchLower) || email.includes(searchLower);
                          })
                          .map(r => {
                            const currentManager = r.salesManager;
                            const isAssignedToOther = currentManager && currentManager.id !== selectedManager.id;

                            return (
                              <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white border rounded-md shadow-sm gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-sm truncate">{r.user?.firstName} {r.user?.lastName}</div>
                                  <div className="text-xs text-muted-foreground truncate">{r.user?.email}</div>
                                  {currentManager && (
                                    <div className="text-xs text-blue-600 mt-1 truncate">
                                      Assigned to Manager: <span className="font-medium">{currentManager.user?.firstName} {currentManager.user?.lastName}</span>
                                    </div>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  variant={isAssignedToOther ? "destructive" : "outline"}
                                  onClick={() => {
                                    setSelectedReps(prev => [...prev, r.id]);
                                    setRepsTab('assigned');
                                  }}
                                  className={cn(
                                    "h-8 sm:shrink-0 text-xs",
                                    isAssignedToOther ? "px-3" : "px-4 font-semibold hover:bg-black hover:text-white transition-colors"
                                  )}
                                >
                                  {isAssignedToOther ? "Reassign" : "Assign"}
                                </Button>
                              </div>
                            );
                          })}
                        {allReps.filter(r => {
                          if (selectedReps.includes(r.id)) return false;
                          if (!allRepsSearch) return true;
                          const searchLower = allRepsSearch.toLowerCase();
                          const fullName = `${r.user.firstName} ${r.user.lastName}`.toLowerCase();
                          const email = (r.user.email || '').toLowerCase();
                          return fullName.includes(searchLower) || email.includes(searchLower);
                        }).length === 0 && (
                          <div className="text-sm text-muted-foreground text-center py-8">
                            {allRepsSearch ? `No sales reps found matching "${allRepsSearch}"` : "All available sales reps are already assigned"}
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>

                {/* Right Side: Customers */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Assigned Customers
                      <span className="ml-2 text-blue-600">
                        {selectedManager.user?.firstName} {selectedManager.user?.lastName}
                      </span>
                    </h3>
                  </div>

                  <Tabs value={customersTab} onValueChange={setCustomersTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                      <TabsTrigger value="assigned">Assigned Customers</TabsTrigger>
                      <TabsTrigger value="add">Add a customer</TabsTrigger>
                    </TabsList>

                    <TabsContent value="assigned" className="mt-0">
                      <div className="mb-3">
                        <Input
                          value={assignedCustomersSearch}
                          onChange={(e) => setAssignedCustomersSearch(e.target.value)}
                          placeholder="Search assigned customers..."
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2 max-h-[500px] overflow-y-auto border rounded-lg p-4 bg-gray-50/50 relative">
                        {loading && (
                          <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center p-4">
                            <Progress value={undefined} className="w-[60%]" />
                          </div>
                        )}
                        {(() => {
                          const filtered = displayAssignedCustomers.filter(c => {
                            if (!assignedCustomersSearch) return true;
                            const searchLower = assignedCustomersSearch.toLowerCase();
                            const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
                            const email = (c.email || '').toLowerCase();
                            const company = (c.companyName || '').toLowerCase();
                            return fullName.includes(searchLower) || email.includes(searchLower) || company.includes(searchLower);
                          });

                          if (filtered.length === 0) {
                            return (
                              <div className="text-sm text-muted-foreground text-center py-8 bg-white border border-dashed rounded-md">
                                {assignedCustomersSearch ? `No assigned customers found matching "${assignedCustomersSearch}"` : "No customers assigned to this manager yet"}
                              </div>
                            );
                          }

                          return filtered.map(c => {
                            const isNew = !selectedManager.assignments?.some(a => a.customerId === c.id);
                            return (
                              <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white border rounded-md shadow-sm gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-sm truncate">
                                    {c.firstName} {c.lastName}
                                    {isNew && <Badge className="ml-2 bg-green-100 text-green-800 hover:bg-green-100 border-none text-[10px] h-4">New</Badge>}
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate">{c.email} {c.companyName ? `• ${c.companyName}` : ''}</div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => setSelectedCustomers(prev => prev.filter(id => id !== c.id))}
                                  className="h-8 px-3 sm:shrink-0 text-xs"
                                >
                                  Remove
                                </Button>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </TabsContent>

                    <TabsContent value="add" className="mt-0">
                      <div className="mb-3">
                        <Input
                          value={unassignedCustomersSearch}
                          onChange={(e) => setUnassignedCustomersSearch(e.target.value)}
                          placeholder="Search available customers..."
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2 max-h-[500px] overflow-y-auto border rounded-lg p-4 bg-gray-50/50 relative">
                        {loadingUnassigned && (
                          <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center p-4">
                            <Progress value={undefined} className="w-[60%]" />
                          </div>
                        )}
                        {!loadingUnassigned && Array.isArray(unassignedCustomers) && unassignedCustomers
                          .filter(c => {
                            if (selectedCustomers.includes(c.id)) return false;
                            if (!unassignedCustomersSearch) return true;
                            const searchLower = unassignedCustomersSearch.toLowerCase();
                            const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
                            const email = (c.email || '').toLowerCase();
                            const company = (c.companyName || '').toLowerCase();
                            return fullName.includes(searchLower) || email.includes(searchLower) || company.includes(searchLower);
                          })
                          .map(c => {
                            const currentManagerAssignment = c.salesManagerAssignments?.[0];
                            const currentManager = currentManagerAssignment?.salesManager?.user;
                            const currentRepAssignment = c.salesAssignments?.[0];
                            const currentRep = currentRepAssignment?.salesRep?.user;

                            return (
                              <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white border rounded-md shadow-sm gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-sm truncate">{c.firstName} {c.lastName}</div>
                                  <div className="text-xs text-muted-foreground truncate">{c.email} {c.companyName ? `• ${c.companyName}` : ''}</div>
                                  {(currentManager || currentRep) && (
                                    <div className="text-xs text-blue-600 mt-1 flex flex-col sm:flex-row sm:flex-wrap sm:gap-2">
                                      {currentManager && (
                                        <span className="truncate">
                                          Assigned to Manager: <span className="font-medium">{currentManager.firstName} {currentManager.lastName}</span>
                                        </span>
                                      )}
                                      {currentRep && (
                                        <span className="truncate">
                                          Rep: <span className="font-medium">{currentRep.firstName} {currentRep.lastName}</span>
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  variant={currentManager ? "destructive" : "outline"}
                                  onClick={() => {
                                    setSelectedCustomers(prev => [...prev, c.id]);
                                    setCustomersTab('assigned');
                                  }}
                                  className={cn(
                                    "h-8 sm:shrink-0 text-xs",
                                    currentManager ? "px-3" : "px-4 font-semibold hover:bg-black hover:text-white transition-colors"
                                  )}
                                >
                                  {currentManager ? "Reassign" : "Assign"}
                                </Button>
                              </div>
                            );
                          })}
                        {!loadingUnassigned && unassignedCustomers.filter(c => {
                          if (selectedCustomers.includes(c.id)) return false;
                          if (!unassignedCustomersSearch) return true;
                          const searchLower = unassignedCustomersSearch.toLowerCase();
                          const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
                          const email = (c.email || '').toLowerCase();
                          return fullName.includes(searchLower) || email.includes(searchLower);
                        }).length === 0 && (
                          <div className="text-sm text-muted-foreground text-center py-8">
                            {unassignedCustomersSearch ? `No customers found matching "${unassignedCustomersSearch}"` : "No customers available for assignment"}
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            )}

            {!selectedManager && !loading && (
              <div className="text-sm text-muted-foreground text-center py-12 border border-dashed rounded-xl">
                Select a sales manager above to manage their team assignments.
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
