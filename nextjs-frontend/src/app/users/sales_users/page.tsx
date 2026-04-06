'use client';

import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

export default function SalesUsersPage() {
  const { user, hasRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [repSearchOpen, setRepSearchOpen] = useState(false);
  const [repSearchValue, setRepSearchValue] = useState('');
  const [allCustomersSearch, setAllCustomersSearch] = useState('');
  const [assignedCustomersSearch, setAssignedCustomersSearch] = useState('');
  const [reps, setReps] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [customersTab, setCustomersTab] = useState('assigned');

  const isAdmin = hasRole('ADMIN');

  // Load all reps once on mount
  useEffect(() => {
    if (!isAdmin) return;
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
  }, [isAdmin]);

  // Fetch candidates (available customers) with search
  useEffect(() => {
    if (!isAdmin) return;
    const fetchCandidates = async () => {
      setLoading(true);
      try {
        const res = await api.getUnassignedCustomers({
          search: allCustomersSearch,
          limit: 10000 // High limit to ensure "all" results are visible
        });
        if (res.success) {
          setCandidates(res.data || []);
        }
      } catch (error) {
        logger.error('Failed to fetch customers:', { error });
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      fetchCandidates();
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [isAdmin, allCustomersSearch]);

  const selectedRep = useMemo(() => reps.find(r => r.user?.id === selectedUserId || r.userId === selectedUserId) || null, [reps, selectedUserId]);

  // Filter reps based on search
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

  // Get selected rep display name
  const selectedRepDisplay = useMemo(() => {
    if (!selectedRep || !selectedRep.user) return 'Choose user';
    return `${selectedRep.user.firstName} ${selectedRep.user.lastName} (${selectedRep.user.email})`;
  }, [selectedRep]);

  useEffect(() => {
    if (selectedRep) {
      setSelectedCustomers(selectedRep.assignments?.map((a: any) => a.customerId) || []);
    } else {
      setSelectedCustomers([]);
    }
  }, [selectedRep]);

  // Merge customers from assignments and candidates to ensure we have details for all selected customers
  const displayAssignedCustomers = useMemo(() => {
    if (!selectedRep) return [];

    const assigned = (selectedRep.assignments || []).map((a: any) => a.customer).filter(Boolean);
    const candidateMatches = candidates.filter(c => selectedCustomers.includes(c.id));

    // Combine and unique by ID
    const combined = [...assigned, ...candidateMatches];
    const uniqueMap = new Map();
    combined.forEach(c => {
      if (c && c.id) uniqueMap.set(c.id, c);
    });

    // Filter by selectedCustomers to reflect current state (including removals)
    return Array.from(uniqueMap.values())
      .filter(c => selectedCustomers.includes(c.id));
  }, [selectedRep, candidates, selectedCustomers]);

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>Access Denied</CardTitle>
            </CardHeader>
            <CardContent>You do not have permission to view this page.</CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const handleCreateRep = async () => {
    if (!selectedUserId) return;
    setLoading(true);
    try {
      const res = await api.post('/sales-reps', { userId: selectedUserId });
      if (res.success) {
        // Refresh list
        const repsRes = await api.get('/sales-reps');
        if (repsRes.success) setReps(repsRes.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAssignments = async () => {
    const rep = reps.find(r => r.user?.id === selectedUserId || r.userId === selectedUserId);
    if (!rep || !rep.id) return;
    setLoading(true);
    try {
      const response = await api.put(`/sales-reps/${rep.id}/assignments`, { customerIds: selectedCustomers });
      if (!response.success) {
        throw new Error(response.error || 'Failed to update customer assignments');
      }

      const repsRes = await api.get('/sales-reps');
      if (repsRes.success) setReps(repsRes.data);

      toast.success('Assignments saved successfully! Customer assignments have been updated.');
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
      <div className="p-2 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2 sm:px-0 mt-2 sm:mt-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">Sales Users Management</h1>
        </div>

        <Card className="shadow-sm border-muted-foreground/10">
          <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div className="flex flex-col lg:flex-row gap-4 lg:items-end">
              <div className="flex-1 space-y-2">
                <Label className="text-xs sm:text-sm font-medium">Select Sales Rep User</Label>
                {loading ? (
                  <div className="flex items-center gap-2 p-2 border rounded-md bg-muted">
                    <Progress value={undefined} className="w-full" />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Loading reps...</span>
                  </div>
                ) : (
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
                )}
              </div>
              <div className="flex gap-2 w-full lg:w-auto">
                <Button
                  disabled={!selectedUserId || loading}
                  onClick={handleSaveAssignments}
                  className="w-full lg:w-auto bg-black hover:bg-gray-800 text-white h-10 sm:h-11 shadow-sm"
                >
                  Save Assignments
                </Button>
                {selectedRep && (
                  <Button
                    variant="outline"
                    className="w-full lg:w-auto h-10 sm:h-11 shadow-sm"
                    onClick={() => window.location.href = `/analytics/person?salesRepId=${selectedRep.id}`}
                  >
                    View Analytics
                  </Button>
                )}
              </div>
            </div>

            {selectedRep && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">
                    Customer Management
                    {selectedRep?.user && (
                      <span className="ml-2 text-blue-600 font-bold">
                        {selectedRep.user.firstName} {selectedRep.user.lastName}
                      </span>
                    )}
                  </h3>
                </div>

                <Tabs value={customersTab} onValueChange={setCustomersTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4 h-9 sm:h-10">
                    <TabsTrigger value="assigned" className="text-xs sm:text-sm">Assigned</TabsTrigger>
                    <TabsTrigger value="add" className="text-xs sm:text-sm">Add Customers</TabsTrigger>
                  </TabsList>

                  <TabsContent value="assigned" className="mt-0">
                    <div className="mb-2">
                      <Input
                        value={assignedCustomersSearch}
                        onChange={(e) => setAssignedCustomersSearch(e.target.value)}
                        placeholder="Search assigned customers..."
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2 max-h-80 overflow-y-auto border rounded p-3">
                      {displayAssignedCustomers
                        .filter((c: any) => {
                          if (!assignedCustomersSearch) return true;
                          const searchLower = assignedCustomersSearch.toLowerCase();
                          const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
                          const email = (c.email || '').toLowerCase();
                          return fullName.includes(searchLower) || email.includes(searchLower);
                        })
                        .map((c: any) => {
                          const isNew = !selectedRep?.assignments?.some((a: any) => a.customerId === c.id);
                          return (
                            <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 hover:bg-muted/50 rounded-md transition-colors gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="font-medium truncate">
                                  {c.firstName} {c.lastName}
                                  {isNew && <Badge className="ml-2 bg-green-100 text-green-800 hover:bg-green-100 border-none text-[10px] h-4">New</Badge>}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                              </div>
                              <div className="flex items-center gap-2 sm:shrink-0">
                                <Badge variant="secondary" className="text-[10px] sm:text-xs">Assigned</Badge>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
                                  onClick={() => setSelectedCustomers(prev => prev.filter(id => id !== c.id))}
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      {displayAssignedCustomers.filter((c: any) => {
                        if (!assignedCustomersSearch) return false;
                        const searchLower = assignedCustomersSearch.toLowerCase();
                        const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
                        const email = (c.email || '').toLowerCase();
                        return fullName.includes(searchLower) || email.includes(searchLower);
                      }).length === 0 && assignedCustomersSearch && (
                          <div className="text-sm text-muted-foreground text-center py-4">
                            No assigned customers found matching "{assignedCustomersSearch}"
                          </div>
                        )}
                      {displayAssignedCustomers.length === 0 && !assignedCustomersSearch && (
                        <div className="text-sm text-muted-foreground text-center py-4">
                          No customers assigned yet
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="add" className="mt-0">
                    <div className="mb-2">
                      <Input
                        value={allCustomersSearch}
                        onChange={(e) => setAllCustomersSearch(e.target.value)}
                        placeholder="Search available customers..."
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2 max-h-80 overflow-y-auto border rounded p-3">
                      {candidates
                        .filter(c => {
                          // Hide already selected
                          if (selectedCustomers.includes(c.id)) return false;
                          if (!allCustomersSearch) return true;
                          const searchLower = allCustomersSearch.toLowerCase();
                          const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
                          const email = (c.email || '').toLowerCase();
                          return fullName.includes(searchLower) || email.includes(searchLower);
                        })
                        .map(c => {
                          const currentManagerAssignment = c.salesManagerAssignments?.[0];
                          const currentManager = currentManagerAssignment?.salesManager?.user;
                          const currentRepAssignment = c.salesAssignments?.[0];
                          const currentRep = currentRepAssignment?.salesRep?.user;

                          return (
                            <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white border rounded-md shadow-sm gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="font-medium truncate">{c.firstName} {c.lastName}</div>
                                <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                                {(currentManager || currentRep) && (
                                  <div className="text-xs text-blue-600 mt-1 flex flex-col sm:flex-row sm:flex-wrap sm:gap-2">
                                    {currentManager && (
                                      <span className="truncate">
                                        Manager: <span className="font-medium">{currentManager.firstName} {currentManager.lastName}</span>
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
                                variant={currentRep ? 'destructive' : 'outline'}
                                onClick={() => {
                                  setSelectedCustomers(prev => [...prev, c.id]);
                                  setCustomersTab('assigned'); // Switch to assigned tab
                                }}
                                className={cn(
                                  "h-8 sm:shrink-0",
                                  currentRep ? "px-3" : "px-4 font-semibold hover:bg-black hover:text-white transition-colors"
                                )}
                              >
                                {currentRep ? 'Reassign' : 'Assign'}
                              </Button>
                            </div>
                          );
                        })}
                      {candidates.filter(c => {
                        if (selectedCustomers.includes(c.id)) return false;
                        if (!allCustomersSearch) return false;
                        const searchLower = allCustomersSearch.toLowerCase();
                        const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
                        const email = (c.email || '').toLowerCase();
                        return fullName.includes(searchLower) || email.includes(searchLower);
                      }).length === 0 && (
                          <div className="text-sm text-muted-foreground text-center py-4">
                            {allCustomersSearch ? `No customers found matching "${allCustomersSearch}"` : "No customers available"}
                          </div>
                        )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}


