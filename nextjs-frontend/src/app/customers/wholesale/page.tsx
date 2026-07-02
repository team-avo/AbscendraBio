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
import { Plus, Search, Building } from 'lucide-react';
import { api, Customer } from '@/lib/api';
import { SalesRoleFilters } from '@/components/customers/sales-role-filters';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import logger from '@/lib/logger';
import { SendReportDialog } from '@/components/shared/send-report-dialog';

export default function WholesaleCustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [salesRepFilter, setSalesRepFilter] = useState<string>('all');
    const [salesManagerFilter, setSalesManagerFilter] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCustomers, setTotalCustomers] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
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

    // Fetch both B2C and B2B with a higher per-type limit so combining stays accurate.
    // We show up to 20 combined results per page, fetching 20 of each type to cover the combined page.
    const ITEMS_PER_PAGE = 20;
    const PER_TYPE_LIMIT = 20;

    const fetchCustomers = async () => {
        try {
            setLoading(true);

            const commonParams = {
                search: searchTerm || undefined,
                isApproved: true,
                isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
                salesRepId: salesRepFilter === 'all' ? undefined : salesRepFilter,
                salesManagerId: salesManagerFilter === 'all' ? undefined : salesManagerFilter,
            };

            // Fetch both B2C and B2B customers
            const [b2cResponse, b2bResponse] = await Promise.all([
                api.getCustomers({ ...commonParams, page: currentPage, limit: PER_TYPE_LIMIT, customerType: 'B2C' }),
                api.getCustomers({ ...commonParams, page: currentPage, limit: PER_TYPE_LIMIT, customerType: 'B2B' }),
            ]);

            const b2cCustomers = b2cResponse.success && b2cResponse.data ? b2cResponse.data.customers : [];
            const b2bCustomers = b2bResponse.success && b2bResponse.data ? b2bResponse.data.customers : [];
            const allCustomers = [...b2cCustomers, ...b2bCustomers];

            const totalB2C = b2cResponse.success && b2cResponse.data ? b2cResponse.data.pagination.total : 0;
            const totalB2B = b2bResponse.success && b2bResponse.data ? b2bResponse.data.pagination.total : 0;
            const combinedTotal = totalB2C + totalB2B;

            // Total pages = max pages across both types (we always fetch both in parallel per page)
            const pagesB2C = b2cResponse.success && b2cResponse.data ? b2cResponse.data.pagination.pages : 0;
            const pagesB2B = b2bResponse.success && b2bResponse.data ? b2bResponse.data.pagination.pages : 0;

            setCustomers(allCustomers);
            setTotalCustomers(combinedTotal);
            setTotalPages(Math.max(pagesB2C, pagesB2B));
        } catch (error) {
            logger.error('Failed to fetch customers:', { error });
            toast.error('Failed to load customers');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCustomers();
    }, [currentPage, searchTerm, statusFilter, salesRepFilter, salesManagerFilter]);

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
            Type: 'Wholesale',
            Active: c.isActive ? 'Yes' : 'No',
            Approved: c.isApproved ? 'Yes' : 'No',
            Created: new Date(c.createdAt as any).toLocaleString(),
            Orders: c._count?.orders || 0,
            'Sales Rep': (c as any).salesAssignments?.[0]?.salesRep?.user ? `${(c as any).salesAssignments[0].salesRep.user.firstName} ${(c as any).salesAssignments[0].salesRep.user.lastName}` : 'N/A',
            'Sales Manager': (c as any).salesManagerAssignments?.[0]?.salesManager?.user ? `${(c as any).salesManagerAssignments[0].salesManager.user.firstName} ${(c as any).salesManagerAssignments[0].salesManager.user.lastName}` : 'N/A',
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Customers');
        return wb;
    };

    const handleExportAll = async () => {
        try {
            logger.debug('Starting export with filters:', { searchTerm, statusFilter });

            const [b2cRes, b2bRes] = await Promise.all([
                api.getCustomers({
                    page: 1,
                    limit: 10000,
                    search: searchTerm || undefined,
                    customerType: 'B2C',
                    isApproved: true,
                    isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
                    salesRepId: salesRepFilter === 'all' ? undefined : salesRepFilter,
                    salesManagerId: salesManagerFilter === 'all' ? undefined : salesManagerFilter,
                }),
                api.getCustomers({
                    page: 1,
                    limit: 10000,
                    search: searchTerm || undefined,
                    customerType: 'B2B',
                    isApproved: true,
                    isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
                    salesRepId: salesRepFilter === 'all' ? undefined : salesRepFilter,
                    salesManagerId: salesManagerFilter === 'all' ? undefined : salesManagerFilter,
                })
            ]);

            logger.debug('B2C Response:', { response: b2cRes });
            logger.debug('B2B Response:', { response: b2bRes });

            const allCustomers = [
                ...(b2cRes?.success && b2cRes?.data?.customers ? b2cRes.data.customers : []),
                ...(b2bRes?.success && b2bRes?.data?.customers ? b2bRes.data.customers : [])
            ];

            logger.debug('All customers for export:', { count: allCustomers.length });

            if (allCustomers.length === 0) {
                toast.error('No customers to export');
                return;
            }

            const wb = exportRowsToExcel(allCustomers);
            XLSX.writeFile(wb, `customers-wholesale-all-${new Date().toISOString().split('T')[0]}.xlsx`);
            toast.success(`Exported ${allCustomers.length} customers successfully`);
        } catch (e) {
            logger.error('Export error:', { error: e });
            toast.error('Failed to export customers');
        }
    };

    const handleSendEmailReport = async (email: string) => {
        return api.sendCustomersEmailReport({
            email,
            customerType: 'WHOLESALE', // API handles B2C/B2B for this
            isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
            isApproved: true,
        });
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
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-500/15 text-blue-400 border border-blue-500/20">
                                            Wholesale
                                        </span>
                                    </div>
                                    <h1 className="text-xl font-black text-[#043061] tracking-tight">Wholesale Customers</h1>
                                    <p className="text-xs text-gray-500 mt-0.5">B2C and B2B wholesale accounts</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2.5 bg-white border border-line rounded-xl px-4 py-2">
                                        <Building className="h-4 w-4 text-blue-400" />
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
                        description={`Are you sure you want to permanently delete ${deleteDialog.customerName}? This action cannot be undone.`}
                        confirmText="Delete Customer"
                        cancelText="Cancel"
                        variant="destructive"
                        isLoading={deleteDialog.isLoading}
                    />
                    <SendReportDialog
                        open={showEmailDialog}
                        onOpenChange={setShowEmailDialog}
                        onSend={handleSendEmailReport}
                        title="Send Wholesale Customers Report"
                        description="Enter the email address where you want to receive the filtered wholesale customers report."
                    />
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
