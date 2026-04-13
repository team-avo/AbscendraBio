'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { ProtectedRoute } from '@/contexts/auth-context';
import { CustomersTable } from '@/components/customers/customers-table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, XCircle } from 'lucide-react';
import { api, Customer } from '@/lib/api';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import logger from '@/lib/logger';

export default function RejectedCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [reactivating, setReactivating] = useState(false);
  const [reactivateType, setReactivateType] = useState<'B2C' | 'B2B' | 'ENTERPRISE_1' | 'ENTERPRISE_2' | ''>('');

  const ITEMS_PER_PAGE = 10;

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        search: searchTerm || undefined,
        isApproved: false,
        approvalStatus: 'DEACTIVATED',
        isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
      } as any;
      const response = await api.getCustomers(params);
      if (response.success && response.data) {
        setCustomers(response.data.customers || []);
        setTotalCustomers(response.data.pagination.total);
        setTotalPages(response.data.pagination.pages);
      }
    } catch (error) {
      logger.error('Failed to fetch rejected customers:', { error });
      toast.error('Failed to load rejected customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [currentPage, searchTerm, statusFilter]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const exportRowsToExcel = (rows: Customer[]) => {
    const data = rows.map((c) => ({
      ID: c.id,
      'First Name': c.firstName,
      'Last Name': c.lastName,
      Email: c.email,
      Mobile: (c as any).mobile || '',
      Active: c.isActive ? 'Yes' : 'No',
      Approved: c.isApproved ? 'Yes' : 'No',
      Created: new Date(c.createdAt as any).toLocaleString(),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rejected');
    return wb;
  };

  // Export All is intentionally disabled on Rejected page

  const handleViewDetails = (customer: Customer) => {
    setSelectedCustomer(customer);
    setReactivateType((customer.customerType as any) || '');
  };

  const handleOpenReactivate = (customerId: string) => {
    const c = customers.find(x => x.id === customerId) || null;
    setSelectedCustomer(c);
    if (c) setReactivateType((c.customerType as any) || '');
  };

  const handleReactivate = async () => {
    if (!selectedCustomer) return;
    const payload: any = {
      isApproved: true,
      isActive: true,
      emailVerified: true,
      mobileVerified: true,
    };
    if (reactivateType) payload.customerType = reactivateType;
    try {
      setReactivating(true);
      const res = await api.updateCustomer(selectedCustomer.id, payload);
      if (res.success) {
        toast.success('Customer reactivated successfully');
        setSelectedCustomer(null);
        fetchCustomers();
      } else {
        toast.error(res.error || 'Failed to reactivate customer');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to reactivate customer');
    } finally {
      setReactivating(false);
    }
  };

  return (
    <ProtectedRoute requiredRoles={['ADMIN', 'MANAGER', 'STAFF']}>
      <DashboardLayout>
        <div className="space-y-5 px-2 sm:px-0">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Rejected Accounts</h1>
              <p className="text-sm text-slate-500 mt-0.5">View and manage deactivated customer accounts</p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search customers by name, email, or mobile..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 h-10 bg-slate-50 border-slate-200 rounded-xl text-sm placeholder:text-slate-400"
              />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <Select value={statusFilter} onValueChange={handleStatusFilter}>
                <SelectTrigger className="h-9 px-3 text-sm border-slate-200 rounded-xl bg-slate-50 w-auto min-w-[140px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-red-50 flex items-center justify-center">
                <XCircle className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Rejected Accounts</h2>
                <p className="text-xs text-slate-400">{totalCustomers.toLocaleString()} customers</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <CustomersTable
                customers={customers}
                loading={loading}
                onEdit={() => { }}
                onDelete={() => { }}
                onHardDelete={async (id: string) => {
                  try {
                    const res = await api.hardDeleteCustomer(id);
                    if (res.success) {
                      toast.success('Customer permanently deleted');
                      fetchCustomers();
                    } else {
                      toast.error(res.error || 'Failed to delete customer');
                    }
                  } catch (e: any) {
                    toast.error(e?.message || 'Failed to delete customer');
                  }
                }}
                onManageAddresses={() => { }}
                hideEditAndAddresses
                onViewDetails={handleViewDetails}
                onReactivate={handleOpenReactivate}
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          </div>

          <Dialog open={!!selectedCustomer} onOpenChange={(o) => { if (!o) setSelectedCustomer(null); }}>
            <DialogContent className="max-h-[90vh] overflow-y-auto w-[calc(100vw-2rem)] sm:w-full p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle>Customer Details</DialogTitle>
                <DialogDescription>Review details and reactivate if appropriate.</DialogDescription>
              </DialogHeader>
              {selectedCustomer && (
                <div className="space-y-4">
                  <div>
                    <div className="text-lg font-semibold">{selectedCustomer.firstName} {selectedCustomer.lastName}</div>
                    <div className="text-sm text-muted-foreground">ID: {selectedCustomer.id}</div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Email</div>
                      <div className="text-sm break-all">{selectedCustomer.email}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Mobile</div>
                      <div className="text-sm">{(selectedCustomer as any).mobile || '-'}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-1">Type</div>
                      <Select value={reactivateType} onValueChange={(v) => setReactivateType(v as any)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="B2C">Wholesale</SelectItem>
                          <SelectItem value="B2B">Wholesale (B2B)</SelectItem>
                          <SelectItem value="ENTERPRISE_1">Enterprise Tier 1</SelectItem>
                          <SelectItem value="ENTERPRISE_2">Enterprise Tier 2</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Created</div>
                      <div className="text-sm">{new Date(selectedCustomer.createdAt as any).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setSelectedCustomer(null)}>Close</Button>
                    <Button onClick={handleReactivate} disabled={reactivating} className="bg-green-600 hover:bg-green-700">{reactivating ? 'Reactivating...' : 'Reactivate'}</Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}


