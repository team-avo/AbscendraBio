
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
import { api, Customer } from '@/lib/api';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import logger from '@/lib/logger';

export default function B2CCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
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
      const params = {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        search: searchTerm || undefined,
        customerType: 'B2C',
        isApproved: true, // Only show approved customers
        isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
      };

      const response = await api.getCustomers(params);

      if (response.success && response.data) {
        setCustomers(response.data.customers || []);
        setTotalCustomers(response.data.pagination.total);
        setTotalPages(response.data.pagination.pages);
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
  }, [currentPage, searchTerm, statusFilter]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
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
      const response = await api.deleteCustomer(customerId);
      if (response.success) {
        fetchCustomers();
        toast.success('Customer deactivated successfully');
      }
    } catch (error) {
      logger.error('Failed to delete customer:', { error });
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
      Type: c.customerType === 'B2C' ? 'Tier 1' : c.customerType === 'B2B' ? 'Tier 2' : c.customerType,
      Active: c.isActive ? 'Yes' : 'No',
      Approved: c.isApproved ? 'Yes' : 'No',
      Created: new Date(c.createdAt as any).toLocaleString(),
      Orders: c._count?.orders || 0,
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
          customerType: 'B2C',
          isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
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
    XLSX.writeFile(wb, `customers-b2c-all-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <ProtectedRoute requiredRoles={['ADMIN', 'MANAGER', 'STAFF', 'SALES_REP', 'SALES_MANAGER']}>
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
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-purple-500/15 text-purple-400 border border-purple-500/20">
                      B2C
                    </span>
                  </div>
                  <h1 className="text-xl font-black text-[#043061] tracking-tight">B2C Customers</h1>
                  <p className="text-xs text-gray-500 mt-0.5">Business-to-consumer tier accounts</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2.5 bg-white border border-line rounded-xl px-4 py-2">
                    <Users className="h-4 w-4 text-purple-400" />
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
                onEdit={setEditingCustomer}
                onDelete={handleDeleteCustomer}
                onHardDelete={handleHardDeleteCustomer}
                onManageAddresses={handleManageAddresses}
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                onExportAll={handleExportAll}
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
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
