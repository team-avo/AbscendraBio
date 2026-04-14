'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { ProtectedRoute } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, UserPlus, Users } from 'lucide-react';
import { api } from '@/lib/api';
import logger from '@/lib/logger';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';

interface UnassignedCustomer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  customerType: string;
  isActive: boolean;
  isApproved: boolean;
  createdAt: string;
  salesAssignments?: Array<{
    salesRep: {
      user: {
        firstName: string;
        lastName: string;
      }
    }
  }>;
  salesManagerAssignments?: Array<{
    salesManager: {
      user: {
        firstName: string;
        lastName: string;
      }
    }
  }>;
}

export default function AssignCustomersPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<UnassignedCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await api.getUnassignedCustomers({
        search: searchTerm || undefined,
        page: pagination.page,
        limit: pagination.limit
      }) as any;

      if (response.success && response.data) {
        if (response.pagination) {
          setCustomers(response.data);
          setPagination(response.pagination);
        } else {
          // Fallback for old API response structured as array
          setCustomers(response.data as any);
        }
      }
    } catch (error) {
      logger.error('Failed to fetch unassigned customers:', { error });
      toast.error('Failed to load unassigned customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'SALES_REP') {
      fetchCustomers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pagination.page]);

  // When search changes, reset to page 1 (avoid including pagination.page in the search effect)
  useEffect(() => {
    if (user?.role === 'SALES_REP') {
      setPagination(prev => ({ ...prev, page: 1 }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const handleAssign = async (customerId: string) => {
    try {
      setAssigningId(customerId);
      const response = await api.assignCustomerToSalesRep(customerId);

      if (response.success) {
        toast.success('Customer assigned successfully');
        fetchCustomers();
      } else {
        toast.error(response.error || 'Failed to assign customer');
      }
    } catch (error) {
      logger.error('Failed to assign customer:', { error });
      toast.error('Failed to assign customer');
    } finally {
      setAssigningId(null);
    }
  };

  const getCustomerTypeBadge = (type: string) => {
    const types: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
      'B2C': { label: 'Wholesale', variant: 'default' },
      'B2B': { label: 'Wholesale', variant: 'default' },
      'ENTERPRISE_1': { label: 'Enterprise', variant: 'outline' },
      'ENTERPRISE_2': { label: 'Enterprise', variant: 'outline' },
    };
    return types[type] || { label: type, variant: 'default' as const };
  };

  if (user && user.role !== 'SALES_REP') {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="p-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-center py-12">
                <p className="text-lg text-muted-foreground">This page is for Sales Representatives only.</p>
              </div>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
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
                  <p className="text-xs text-gray-500 mt-0.5">Claim unassigned customers to your portfolio</p>
                </div>
                <div className="flex items-center gap-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-2">
                  <UserPlus className="h-4 w-4 text-[#4D7DF2]" />
                  <div>
                    <p className="text-[9px] text-gray-500 font-medium uppercase tracking-widest leading-none">Unassigned</p>
                    <p className="text-base font-black text-white tabular-nums leading-tight">{pagination.total.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ════════ COMPACT FILTER ROW ════════ */}
          <div className="px-1 sm:px-0 py-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                placeholder="Search by name or email…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9 bg-white border-gray-200 rounded-xl text-xs placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* ════════ TABLE ════════ */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden mx-1 sm:mx-0">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex justify-center items-center py-16">
                  <div className="w-8 h-8 border-2 border-[#4D7DF2]/30 border-t-[#4D7DF2] rounded-full animate-spin" />
                </div>
              ) : customers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <Users className="h-6 w-6 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-700">No unassigned customers</p>
                    <p className="text-xs text-gray-400 mt-0.5">{searchTerm ? 'Try adjusting your search terms' : 'All customers have been assigned'}</p>
                  </div>
                </div>
              ) : (
                <>
                  <Table className="min-w-[800px]">
                    <TableHeader>
                      <TableRow className="bg-gray-50/50 border-b border-gray-100">
                        <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wider">Name</TableHead>
                        <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wider">Email</TableHead>
                        <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wider">Type</TableHead>
                        <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wider">Status</TableHead>
                        <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sales Rep</TableHead>
                        <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wider">Manager</TableHead>
                        <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wider">Joined</TableHead>
                        <TableHead className="text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customers.map((customer) => (
                        <TableRow key={customer.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50">
                          <TableCell className="font-bold text-gray-900 text-sm">
                            {customer.firstName} {customer.lastName}
                          </TableCell>
                          <TableCell className="text-xs text-gray-500">{customer.email}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-[#070B14]/5 text-[#070B14] border border-[#070B14]/10">
                              {getCustomerTypeBadge(customer.customerType).label}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                              customer.isApproved ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}>
                              {customer.isApproved ? 'Approved' : 'Pending'}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-gray-500">
                            {customer.salesAssignments && customer.salesAssignments.length > 0
                              ? `${customer.salesAssignments[0].salesRep.user.firstName} ${customer.salesAssignments[0].salesRep.user.lastName}`
                              : <span className="text-gray-300">—</span>}
                          </TableCell>
                          <TableCell className="text-xs text-gray-500">
                            {customer.salesManagerAssignments && customer.salesManagerAssignments.length > 0
                              ? `${customer.salesManagerAssignments[0].salesManager.user.firstName} ${customer.salesManagerAssignments[0].salesManager.user.lastName}`
                              : <span className="text-gray-300">—</span>}
                          </TableCell>
                          <TableCell className="text-xs text-gray-400">
                            {new Date(customer.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => handleAssign(customer.id)}
                              disabled={assigningId === customer.id || (customer.salesAssignments && customer.salesAssignments.length > 0)}
                              className="h-8 px-3 bg-[#070B14] hover:bg-[#1a2540] text-white rounded-xl text-xs font-bold disabled:opacity-40"
                            >
                              <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                              {assigningId === customer.id ? 'Assigning…' : 'Assign to Me'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {pagination.pages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                      <p className="text-xs text-gray-400">Page {pagination.page} of {pagination.pages}</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))} className="h-8 px-3 rounded-xl text-xs">Previous</Button>
                        <Button variant="outline" size="sm" disabled={pagination.page >= pagination.pages} onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))} className="h-8 px-3 rounded-xl text-xs">Next</Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
