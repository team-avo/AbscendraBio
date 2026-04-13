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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Search, Crown } from 'lucide-react';
import { api, Customer } from '@/lib/api';
import { SalesRoleFilters } from '@/components/customers/sales-role-filters';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import logger from '@/lib/logger';
import { SendReportDialog } from '@/components/shared/send-report-dialog';
import { Mail } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';

export default function EnterpriseCustomersPage() {
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

            // Fetch both Enterprise 1 and Enterprise 2 customers in parallel
            const [ent1Response, ent2Response] = await Promise.all([
                api.getCustomers({ ...commonParams, page: currentPage, limit: PER_TYPE_LIMIT, customerType: 'ENTERPRISE_1' }),
                api.getCustomers({ ...commonParams, page: currentPage, limit: PER_TYPE_LIMIT, customerType: 'ENTERPRISE_2' }),
            ]);

            const ent1Customers = ent1Response.success && ent1Response.data ? ent1Response.data.customers : [];
            const ent2Customers = ent2Response.success && ent2Response.data ? ent2Response.data.customers : [];
            const allCustomers = [...ent1Customers, ...ent2Customers];

            const totalEnt1 = ent1Response.success && ent1Response.data ? ent1Response.data.pagination.total : 0;
            const totalEnt2 = ent2Response.success && ent2Response.data ? ent2Response.data.pagination.total : 0;
            const combinedTotal = totalEnt1 + totalEnt2;

            const pagesEnt1 = ent1Response.success && ent1Response.data ? ent1Response.data.pagination.pages : 0;
            const pagesEnt2 = ent2Response.success && ent2Response.data ? ent2Response.data.pagination.pages : 0;

            setCustomers(allCustomers);
            setTotalCustomers(combinedTotal);
            setTotalPages(Math.max(pagesEnt1, pagesEnt2));
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
            Type: 'Enterprise',
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

            const [ent1Res, ent2Res] = await Promise.all([
                api.getCustomers({
                    page: 1,
                    limit: 10000,
                    search: searchTerm || undefined,
                    customerType: 'ENTERPRISE_1',
                    isApproved: true,
                    isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
                    salesRepId: salesRepFilter === 'all' ? undefined : salesRepFilter,
                    salesManagerId: salesManagerFilter === 'all' ? undefined : salesManagerFilter,
                }),
                api.getCustomers({
                    page: 1,
                    limit: 10000,
                    search: searchTerm || undefined,
                    customerType: 'ENTERPRISE_2',
                    isApproved: true,
                    isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
                    salesRepId: salesRepFilter === 'all' ? undefined : salesRepFilter,
                    salesManagerId: salesManagerFilter === 'all' ? undefined : salesManagerFilter,
                })
            ]);

            logger.debug('Enterprise 1 Response:', { response: ent1Res });
            logger.debug('Enterprise 2 Response:', { response: ent2Res });

            const allCustomers = [
                ...(ent1Res?.success && ent1Res?.data?.customers ? ent1Res.data.customers : []),
                ...(ent2Res?.success && ent2Res?.data?.customers ? ent2Res.data.customers : [])
            ];

            logger.debug('All customers for export:', { count: allCustomers.length });

            if (allCustomers.length === 0) {
                toast.error('No customers to export');
                return;
            }

            const wb = exportRowsToExcel(allCustomers);
            XLSX.writeFile(wb, `customers-enterprise-all-${new Date().toISOString().split('T')[0]}.xlsx`);
            toast.success(`Exported ${allCustomers.length} customers successfully`);
        } catch (e) {
            logger.error('Export error:', { error: e });
            toast.error('Failed to export customers');
        }
    };

    const handleSendEmailReport = async (email: string) => {
        return api.sendCustomersEmailReport({
            email,
            customerType: 'ENTERPRISE', // API handles ENT1/ENT2 for this
            isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
            isApproved: true,
        });
    };

    return (
        <ProtectedRoute requiredRoles={['ADMIN', 'MANAGER', 'STAFF', 'SALES_REP', 'SALES_MANAGER']}>
            <DashboardLayout>
                <div className="space-y-5 px-2 sm:px-0">
                    {/* Header */}
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Enterprise Customers</h1>
                            <p className="text-sm text-slate-500 mt-0.5">Manage your Enterprise Tier 1 and Tier 2 accounts</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-amber-50 text-amber-700 border-amber-200">
                                <Crown className="h-3.5 w-3.5" />Enterprise
                            </span>
                            <Button onClick={() => setShowCreateDialog(true)} className="h-9 px-4 bg-[#1B2D4F] hover:bg-[#243d6b] text-white rounded-xl text-sm font-medium">
                                <Plus className="mr-1.5 h-4 w-4" />Add Customer
                            </Button>
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
                            <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
                                <Crown className="h-4 w-4 text-amber-500" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold text-slate-800">Enterprise Customers</h2>
                                <p className="text-xs text-slate-400">{totalCustomers.toLocaleString()} customers</p>
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
                        title="Send Enterprise Customers Report"
                        description="Enter the email address where you want to receive the filtered enterprise customers report."
                    />
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
