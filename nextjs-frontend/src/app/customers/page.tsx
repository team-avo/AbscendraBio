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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Search, Users, UserCheck, UserX, Building, Crown, Mail, Clock } from 'lucide-react';
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
        <div className="space-y-5 px-2 sm:px-0">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Customers</h1>
              <p className="text-sm text-slate-500 mt-0.5">Manage and grow your customer relationships</p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => setShowCreateDialog(true)} className="h-9 px-4 bg-[#1B2D4F] hover:bg-[#243d6b] text-white rounded-xl text-sm font-medium">
                <Plus className="mr-1.5 h-4 w-4" />Add Customer
              </Button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Total Customers */}
            <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 px-5 py-4 shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Total Customers</p>
                <p className="text-2xl font-bold text-slate-900 leading-tight">{stats.total}</p>
              </div>
            </div>
            {/* Active */}
            <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 px-5 py-4 shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <UserCheck className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Active</p>
                <p className="text-2xl font-bold text-emerald-600 leading-tight">{stats.active}</p>
              </div>
            </div>
            {/* Inactive */}
            <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 px-5 py-4 shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <UserX className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Inactive</p>
                <p className="text-2xl font-bold text-red-600 leading-tight">{stats.inactive}</p>
              </div>
            </div>
            {/* Pending Approval */}
            <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 px-5 py-4 shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Pending Approval</p>
                <p className="text-2xl font-bold text-amber-600 leading-tight">{stats.pendingApproval}</p>
              </div>
            </div>
            {/* Wholesale */}
            <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 px-5 py-4 shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <Building className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Wholesale</p>
                <p className="text-2xl font-bold text-blue-600 leading-tight">{stats.b2c + stats.b2b}</p>
              </div>
            </div>
            {/* Enterprise — dark navy hero chip */}
            <div className="relative flex items-center gap-3 bg-[#1B2D4F] rounded-2xl px-5 py-4 shadow-sm overflow-hidden">
              <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/5" />
              <div className="absolute -right-2 -bottom-6 h-24 w-24 rounded-full bg-white/5" />
              <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 relative">
                <Crown className="h-5 w-5 text-amber-400" />
              </div>
              <div className="relative">
                <p className="text-xs text-white/60 font-medium">Enterprise</p>
                <p className="text-2xl font-bold text-white leading-tight">{stats.e1 + stats.e2}</p>
              </div>
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
              <Select value={typeFilter} onValueChange={handleTypeFilter}>
                <SelectTrigger className="h-9 px-3 text-sm border-slate-200 rounded-xl bg-slate-50 w-auto min-w-[140px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="WHOLESALE">Wholesale</SelectItem>
                  <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                </SelectContent>
              </Select>
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
              <SalesRoleFilters
                selectedSalesRepId={salesRepFilter}
                selectedSalesManagerId={salesManagerFilter}
                onSalesRepChange={(id) => { setSalesRepFilter(id); setCurrentPage(1); }}
                onSalesManagerChange={(id) => { setSalesManagerFilter(id); setCurrentPage(1); }}
              />
            </div>
          </div>

          {/* Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                <Users className="h-4 w-4 text-slate-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Customers List</h2>
                <p className="text-xs text-slate-400">{loading ? '...' : totalCustomers.toLocaleString()} customers</p>
              </div>
            </div>
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

          {/* Dialogs */}
          <CreateCustomerDialog
            open={showCreateDialog}
            onOpenChange={setShowCreateDialog}
            onSuccess={handleCustomerCreated}
          />

          <EditCustomerDialog
            customer={editingCustomer}
            open={!!editingCustomer}
            onOpenChange={(open) => !open && setEditingCustomer(null)}
            onSuccess={handleCustomerUpdated}
          />

          <CustomerAddressDialog
            customer={addressCustomer}
            open={!!addressCustomer}
            onOpenChange={(open) => !open && setAddressCustomer(null)}
            onSuccess={handleAddressesUpdated}
          />

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
