'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { ProtectedRoute } from '@/contexts/auth-context';
import { CustomersTable } from '@/components/customers/customers-table';
import { CreateCustomerDialog } from '@/components/customers/create-customer-dialog';
import { EditCustomerDialog } from '@/components/customers/edit-customer-dialog';
import { CustomerAddressDialog } from '@/components/customers/customer-address-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Users } from 'lucide-react';
import { SalesRoleFilters } from '@/components/customers/sales-role-filters';
import { api, Customer } from '@/lib/api';
import logger from '@/lib/logger';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { SendReportDialog } from '@/components/shared/send-report-dialog';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [salesRepFilter, setSalesRepFilter] = useState<string>('all');
  const [salesManagerFilter, setSalesManagerFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [statusStats, setStatusStats] = useState<{ active: number; inactive: number; pendingApproval?: number; b2c: number; b2b: number; e1: number; e2: number } | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [addressCustomer, setAddressCustomer] = useState<Customer | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    customerId: string | null;
    customerName: string;
    isLoading: boolean;
  }>({
    open: false,
    customerId: null,
    customerName: '',
    isLoading: false,
  });

  const ITEMS_PER_PAGE = 10;

  const fetchCustomers = async () => {
    try {
      setLoading(true);

      // Handle combined filter types
      let customerTypeParam: string | undefined;
      if (typeFilter === 'WHOLESALE') {
        // For wholesale, we'll fetch all and filter client-side
        customerTypeParam = undefined;
      } else if (typeFilter === 'ENTERPRISE') {
        // For enterprise, we'll fetch all and filter client-side
        customerTypeParam = undefined;
      } else if (typeFilter !== 'all') {
        customerTypeParam = typeFilter;
      }

      const params = {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        search: searchTerm || undefined,
        customerType: customerTypeParam,
        isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
        isApproved: true,
        salesRepId: salesRepFilter === 'all' ? undefined : salesRepFilter,
        salesManagerId: salesManagerFilter === 'all' ? undefined : salesManagerFilter,
      };

      const response = await api.getCustomers(params);

      if (response.success && response.data) {
        let list = (response.data.customers || [])
          .filter(c => c.isApproved);

        // Apply client-side filtering for combined types
        if (typeFilter === 'WHOLESALE') {
          list = list.filter(c => c.customerType === 'B2C' || c.customerType === 'B2B');
        } else if (typeFilter === 'ENTERPRISE') {
          list = list.filter(c => c.customerType === 'ENTERPRISE_1' || c.customerType === 'ENTERPRISE_2');
        } else if (typeFilter !== 'all') {
          list = list.filter(c => c.customerType === typeFilter);
        } else {
          // For 'all', show only the 4 main customer types
          list = list.filter(c => c.customerType === 'B2C' || c.customerType === 'B2B' || c.customerType === 'ENTERPRISE_1' || c.customerType === 'ENTERPRISE_2');
        }

        setCustomers(list);
        // Use backend totals and stats for accuracy across pagination
        const pagination = (response.data as any).pagination;
        setTotalCustomers(pagination?.total ?? list.length);
        setTotalPages(pagination?.pages ?? Math.ceil(list.length / ITEMS_PER_PAGE));
        const statsBlock: any = (response.data as any).stats;
        if (statsBlock) setStatusStats(statsBlock);
      }
    } catch (error) {
      logger.error('Failed to fetch customers:', { error });
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [currentPage, searchTerm, typeFilter, statusFilter, salesRepFilter, salesManagerFilter]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleTypeFilter = (value: string) => {
    setTypeFilter(value);
    setCurrentPage(1);
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleCustomerCreated = () => {
    setShowCreateDialog(false);
    fetchCustomers();
    toast.success('Customer created successfully');
  };

  const handleCustomerUpdated = () => {
    setEditingCustomer(null);
    fetchCustomers();
    toast.success('Customer updated successfully');
  };

  const handleDeleteCustomer = async (customerId: string) => {
    try {
      // For deactivation, prefer setting isApproved=false which will map to DEACTIVATED and inactive
      const response = await api.updateCustomer(customerId, { isApproved: false });
      if (response.success) {
        fetchCustomers();
        toast.success('Customer deactivated successfully');
      }
    } catch (error) {
      logger.error('Failed to deactivate customer:', { error });
      toast.error('Failed to deactivate customer');
    }
  };

  const handleHardDeleteCustomer = async (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    setDeleteDialog({
      open: true,
      customerId,
      customerName: `${customer.firstName} ${customer.lastName}`,
      isLoading: false,
    });
  };

  const confirmDeleteCustomer = async () => {
    if (!deleteDialog.customerId) return;

    setDeleteDialog(prev => ({ ...prev, isLoading: true }));

    try {
      const response = await api.hardDeleteCustomer(deleteDialog.customerId);
      if (response.success) {
        fetchCustomers();
        toast.success('Customer permanently deleted successfully');
      } else {
        toast.error(response.error || 'Failed to delete customer');
      }
    } catch (error: any) {
      logger.error('Error deleting customer:', { error });
      toast.error(error?.response?.data?.error || error?.message || 'Failed to delete customer');
    } finally {
      setDeleteDialog({
        open: false,
        customerId: null,
        customerName: '',
        isLoading: false,
      });
    }
  };

  const handleManageAddresses = (customer: Customer) => {
    setAddressCustomer(customer);
  };

  const handleAddressesUpdated = () => {
    setAddressCustomer(null);
    fetchCustomers();
    toast.success('Customer addresses updated successfully');
  };

  const exportRowsToExcel = (rows: Customer[]) => {
    const data = rows.map((c) => ({
      ID: c.id,
      'First Name': c.firstName,
      'Last Name': c.lastName,
      Email: c.email,
      Mobile: (c as any).mobile || '',
      Type: (c.customerType === 'B2C' || c.customerType === 'B2B') ? 'Wholesale' :
        (c.customerType === 'ENTERPRISE_1' || c.customerType === 'ENTERPRISE_2') ? 'Enterprise' :
          c.customerType,
      Active: c.isActive ? 'Yes' : 'No',
      Approved: c.isApproved ? 'Yes' : 'No',
      Created: new Date(c.createdAt as any).toLocaleString(),
      Orders: c._count?.orders || 0,
      'Sales Rep': c.salesAssignments?.[0]?.salesRep?.user ? `${c.salesAssignments[0].salesRep.user.firstName} ${c.salesAssignments[0].salesRep.user.lastName}` : 'N/A',
      'Sales Manager': c.salesManagerAssignments?.[0]?.salesManager?.user ? `${c.salesManagerAssignments[0].salesManager.user.firstName} ${c.salesManagerAssignments[0].salesManager.user.lastName}` : 'N/A',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customers');
    return wb;
  };

  const handleExportAll = async () => {
    let page = 1;
    const limit = 100;
    let pages = 1;
    const all: Customer[] = [];
    try {
      do {
        const res: any = await api.getCustomers({
          page,
          limit,
          search: searchTerm || undefined,
          customerType: typeFilter !== 'all' ? typeFilter : undefined,
          isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
          salesRepId: salesRepFilter === 'all' ? undefined : salesRepFilter,
          salesManagerId: salesManagerFilter === 'all' ? undefined : salesManagerFilter,
        });
        if (res?.success && res?.data) {
          all.push(...(res.data.customers || []));
          const pagination = res.data.pagination || {};
          pages = pagination.pages || 1;
        } else {
          break;
        }
        page += 1;
      } while (page <= pages);
    } catch (e) { }
    const wb = exportRowsToExcel(all);
    XLSX.writeFile(wb, `customers-all-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleSendEmailReport = async (email: string) => {
    return api.sendCustomersEmailReport({
      email,
      customerType: typeFilter !== 'all' ? typeFilter : undefined,
      isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
      isApproved: true,
    });
  };

  // const handleSendBlackFridayEmail = async () => {
  //   setSendingBlackFridayEmail(true);
  //   try {
  //     const response = await api.post('/black-friday/send', {});
  //     
  //     if (response.success) {
  //       toast.success('Black Friday emails sent successfully!');
  //     } else {
  //       toast.error(response.error || 'Failed to send Black Friday emails');
  //     }
  //   } catch (error: any) {
  //     logger.error('Error sending Black Friday emails:', { error: error });
  //     toast.error(error?.response?.data?.error || error?.message || 'Failed to send Black Friday emails');
  //   } finally {
  //     setSendingBlackFridayEmail(false);
  //   }
  // };

  // Calculate stats
  const stats = {
    total: totalCustomers,
    active: statusStats?.active ?? customers.filter(c => c.isActive).length,
    inactive: statusStats?.inactive ?? customers.filter(c => !c.isActive).length,
    pendingApproval: statusStats?.pendingApproval ?? 0,
    b2c: statusStats?.b2c ?? customers.filter(c => c.customerType === 'B2C').length,
    b2b: statusStats?.b2b ?? customers.filter(c => c.customerType === 'B2B').length,
    e1: statusStats?.e1 ?? customers.filter(c => c.customerType === 'ENTERPRISE_1').length,
    e2: statusStats?.e2 ?? customers.filter(c => c.customerType === 'ENTERPRISE_2').length,
  };

  return (
    <ProtectedRoute requiredRoles={['ADMIN', 'MANAGER', 'STAFF', 'SALES_REP', 'SALES_MANAGER']}>
      <DashboardLayout>
        <div className="space-y-0">

          {/* ════════ DARK HERO STRIP ════════ */}
          <div className="relative bg-mist border border-line border-t-2 border-t-[#5A9ADA] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#5A9ADA]/8 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
              {/* Top row */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-xl font-black text-[#043061] tracking-tight">Customers</h1>
                  <p className="text-xs text-gray-500 mt-0.5">Manage and grow your customer relationships</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2.5 bg-white border border-line rounded-xl px-4 py-2">
                    <Users className="h-4 w-4 text-[#5A9ADA]" />
                    <div>
                      <p className="text-[9px] text-gray-500 font-medium uppercase tracking-widest leading-none">Total</p>
                      <p className="text-base font-black text-[#043061] tabular-nums leading-tight">{stats.total.toLocaleString()}</p>
                    </div>
                  </div>
                  <Button onClick={() => setShowCreateDialog(true)} className="h-9 px-5 bg-[#043061] text-white hover:bg-[#0b4f96] rounded-xl text-xs font-black uppercase tracking-widest">
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Customer
                  </Button>
                </div>
              </div>

              {/* Segment pills */}
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
                {[
                  { key: 'all',        label: 'All',        count: stats.total,                    color: null },
                  { key: 'active',     label: 'Active',     count: stats.active,                   color: 'emerald' },
                  { key: 'inactive',   label: 'Inactive',   count: stats.inactive,                 color: 'red' },
                  { key: 'WHOLESALE',  label: 'Wholesale',  count: stats.b2c + stats.b2b,          color: 'blue' },
                  { key: 'ENTERPRISE', label: 'Enterprise', count: stats.e1 + stats.e2,            color: 'amber' },
                  { key: 'pending',    label: 'Pending',    count: stats.pendingApproval,          color: 'gray' },
                ].map((pill) => {
                  const colorStyles: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
                    emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', ring: 'ring-emerald-500/30', dot: 'bg-emerald-400' },
                    red:     { bg: 'bg-red-500/15',     text: 'text-red-400',     ring: 'ring-red-500/30',     dot: 'bg-red-400' },
                    blue:    { bg: 'bg-blue-500/15',    text: 'text-blue-400',    ring: 'ring-blue-500/30',    dot: 'bg-blue-400' },
                    amber:   { bg: 'bg-amber-500/15',   text: 'text-amber-400',   ring: 'ring-amber-500/30',   dot: 'bg-amber-400' },
                    gray:    { bg: 'bg-gray-500/15',    text: 'text-gray-300',    ring: 'ring-gray-500/30',    dot: 'bg-gray-400' },
                  };
                  const c = pill.color ? colorStyles[pill.color] : null;
                  const isAll = pill.key === 'all';

                  // Map segment pill click to status/type filter
                  const handlePillClick = () => {
                    if (pill.key === 'all') { setTypeFilter('all'); setStatusFilter('all'); setCurrentPage(1); }
                    else if (pill.key === 'active') { setTypeFilter('all'); setStatusFilter('active'); setCurrentPage(1); }
                    else if (pill.key === 'inactive') { setTypeFilter('all'); setStatusFilter('inactive'); setCurrentPage(1); }
                    else if (pill.key === 'WHOLESALE') { setTypeFilter('WHOLESALE'); setStatusFilter('all'); setCurrentPage(1); }
                    else if (pill.key === 'ENTERPRISE') { setTypeFilter('ENTERPRISE'); setStatusFilter('all'); setCurrentPage(1); }
                    else if (pill.key === 'pending') { /* navigate to approvals */ window.location.href = '/customers/approvals'; }
                  };

                  const isActive = isAll
                    ? typeFilter === 'all' && statusFilter === 'all'
                    : pill.key === 'active' ? statusFilter === 'active' && typeFilter === 'all'
                    : pill.key === 'inactive' ? statusFilter === 'inactive' && typeFilter === 'all'
                    : typeFilter === pill.key;

                  return (
                    <button
                      key={pill.key}
                      onClick={handlePillClick}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        isAll && isActive
                          ? 'bg-[#043061] text-white ring-1 ring-[#043061]/20'
                          : isActive && c
                          ? `${c.bg} ${c.text} ring-1 ${c.ring}`
                          : 'bg-white/[0.04] text-gray-500 hover:bg-white/[0.08] hover:text-gray-300'
                      }`}
                    >
                      {c && <span className={`w-1.5 h-1.5 rounded-full ${isActive ? c.dot : 'bg-gray-600'}`} />}
                      <span>{pill.label}</span>
                      <span className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-black tabular-nums ${
                        isAll && isActive ? 'bg-white/20 text-white'
                        : isActive && c ? `${c.bg} ${c.text}`
                        : 'bg-white/[0.06] text-gray-500'
                      }`}>
                        {(pill.count ?? 0).toLocaleString()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ════════ COMPACT FILTER ROW ════════ */}
          <div className="px-1 sm:px-0 py-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 sm:max-w-sm">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="Search customers by name, email, or mobile…"
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10 h-9 bg-white border-gray-200 rounded-xl text-xs placeholder:text-gray-400"
                />
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Select value={typeFilter} onValueChange={handleTypeFilter}>
                  <SelectTrigger className="h-9 px-3 text-xs border-gray-200 rounded-xl bg-white w-auto min-w-[130px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="WHOLESALE">Wholesale</SelectItem>
                    <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
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
                <SalesRoleFilters
                  selectedSalesRepId={salesRepFilter}
                  selectedSalesManagerId={salesManagerFilter}
                  onSalesRepChange={(id) => { setSalesRepFilter(id); setCurrentPage(1); }}
                  onSalesManagerChange={(id) => { setSalesManagerFilter(id); setCurrentPage(1); }}
                />
              </div>
            </div>
          </div>

          {/* ════════ TABLE ════════ */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden mx-1 sm:mx-0">
            <div className="overflow-x-auto">
              <CustomersTable
                customers={customers}
                loading={loading}
                onEdit={setEditingCustomer}
                onDelete={handleDeleteCustomer}
                onHardDelete={handleHardDeleteCustomer}
                onManageAddresses={handleManageAddresses}
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                onExportAll={handleExportAll}
                onEmailReport={() => setShowEmailDialog(true)}
                onRefreshCommentCounts={fetchCustomers}
                onRefresh={fetchCustomers}
              />
            </div>
          </div>

          {/* ════════ DIALOGS ════════ */}
          <CreateCustomerDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} onSuccess={handleCustomerCreated} />
          <EditCustomerDialog customer={editingCustomer} open={!!editingCustomer} onOpenChange={(open) => !open && setEditingCustomer(null)} onSuccess={handleCustomerUpdated} />
          <CustomerAddressDialog customer={addressCustomer} open={!!addressCustomer} onOpenChange={(open) => !open && setAddressCustomer(null)} onSuccess={handleAddressesUpdated} />
          <ConfirmationDialog
            open={deleteDialog.open}
            onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
            onConfirm={confirmDeleteCustomer}
            title="Delete Customer"
            description={`Are you sure you want to permanently delete ${deleteDialog.customerName}? This action cannot be undone and will remove all customer data including addresses, reviews, and favorites.`}
            confirmText="Delete Customer"
            cancelText="Cancel"
            variant="destructive"
            isLoading={deleteDialog.isLoading}
          />
          <SendReportDialog
            open={showEmailDialog}
            onOpenChange={setShowEmailDialog}
            onSend={handleSendEmailReport}
            title="Send Customers Report"
            description="Enter the email address where you want to receive the filtered customers report."
          />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
