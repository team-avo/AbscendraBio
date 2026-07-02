'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { ProtectedRoute } from '@/contexts/auth-context';
import { CustomersTable } from '@/components/customers/customers-table';
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
  const [showCreateDialog, setShowCreateDialog] = useState(false);

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
        <div className="space-y-0">
          {/* Dark hero strip */}
          <div className="relative bg-mist border border-line border-t-2 border-t-[#5A9ADA] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#5A9ADA]/8 rounded-full blur-[100px] pointer-events-none" />
            <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
              {/* Title row + pills */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-500/15 text-red-400 border border-red-500/20">
                      Rejected
                    </span>
                  </div>
                  <h1 className="text-xl font-black text-[#043061] tracking-tight">Rejected Accounts</h1>
                  <p className="text-xs text-gray-500 mt-0.5">Deactivated and rejected customer registrations</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2.5 bg-white border border-line rounded-xl px-4 py-2">
                    <XCircle className="h-4 w-4 text-red-400" />
                    <div>
                      <p className="text-[9px] text-gray-500 font-medium uppercase tracking-widest leading-none">Total</p>
                      <p className="text-base font-black text-[#043061] tabular-nums leading-tight">{totalCustomers.toLocaleString()}</p>
                    </div>
                  </div>
                  <Button onClick={() => setShowCreateDialog(true)} className="h-9 px-5 bg-[#043061] text-white hover:bg-[#0b4f96] rounded-xl text-xs font-black uppercase tracking-widest">
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Customer
                  </Button>
                </div>
              </div>

              {/* Status pills */}
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
                {[
                  { key: 'all',      label: 'All',      color: null },
                  { key: 'active',   label: 'Active',   color: 'emerald' },
                  { key: 'inactive', label: 'Inactive', color: 'red' },
                ].map((pill) => {
                  const colorStyles: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
                    emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', ring: 'ring-emerald-500/30', dot: 'bg-emerald-400' },
                    red:     { bg: 'bg-red-500/15',     text: 'text-red-400',     ring: 'ring-red-500/30',     dot: 'bg-red-400' },
                  };
                  const c = pill.color ? colorStyles[pill.color] : null;
                  const isAll = pill.key === 'all';
                  const isActive = isAll ? statusFilter === 'all' : statusFilter === pill.key;
                  return (
                    <button
                      key={pill.key}
                      onClick={() => handleStatusFilter(pill.key)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        isAll && isActive ? 'bg-[#043061] text-white ring-1 ring-[#043061]/20'
                        : isActive && c ? `${c.bg} ${c.text} ring-1 ${c.ring}`
                        : 'bg-white/[0.04] text-gray-500 hover:bg-white/[0.08] hover:text-gray-300'
                      }`}
                    >
                      {c && <span className={`w-1.5 h-1.5 rounded-full ${isActive ? c.dot : 'bg-gray-600'}`} />}
                      <span>{pill.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Compact filter row */}
          <div className="px-1 sm:px-0 py-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 sm:max-w-sm">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input placeholder="Search customers…" value={searchTerm} onChange={(e) => handleSearch(e.target.value)} className="pl-10 h-9 bg-white border-gray-200 rounded-xl text-xs placeholder:text-gray-400" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={statusFilter} onValueChange={handleStatusFilter}>
                  <SelectTrigger className="h-9 px-3 text-xs border-gray-200 rounded-xl bg-white w-auto min-w-[120px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden mx-1 sm:mx-0">
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

          {/* Dialogs */}
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
