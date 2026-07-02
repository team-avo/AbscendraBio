'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { ProtectedRoute } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, UserPlus, Users, CheckCircle } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { api } from '@/lib/api';
import logger from '@/lib/logger';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';

export default function ManagerSelfAssignmentPage() {
    const { user } = useAuth();
    const [customers, setCustomers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [assigningId, setAssigningId] = useState<string | null>(null);
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });

    const fetchCustomers = async (searchTerm = "") => {
        try {
            setLoading(true);
            const res = await api.getUnassignedCustomersForManager({
                search: searchTerm || undefined,
                page: pagination.page,
                limit: pagination.limit
            }) as any;

            if (res.success && res.data) {
                if (res.pagination) {
                    setCustomers(res.data);
                    setPagination(res.pagination);
                } else {
                    setCustomers(res.data);
                }
            }
        } catch (e) {
            logger.error('Failed to fetch unassigned customers:', { error: e });
            toast.error("Failed to fetch unassigned customers");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.role === 'SALES_MANAGER') {
            fetchCustomers(search);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, pagination.page]);

    useEffect(() => {
        setPagination(prev => ({ ...prev, page: 1 }));
    }, [search]);

    const handleAssignToMe = async (customerId: string) => {
        try {
            setAssigningId(customerId);
            const res = await api.assignCustomerToSalesManager(customerId);
            if (res.success) {
                toast.success("Customer assigned to your portfolio successfully");
                fetchCustomers(search);
            } else {
                toast.error(res.error || "Failed to assign customer");
            }
        } catch (e) {
            toast.error("An unexpected error occurred during assignment");
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

    return (
        <ProtectedRoute requiredRoles={['ADMIN']}>
            <DashboardLayout>
                <div className="space-y-0">
                    {/* ════════ DARK HERO STRIP ════════ */}
                    <div className="relative bg-mist border border-line border-t-2 border-t-[#5A9ADA] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
                        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                        <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#5A9ADA]/8 rounded-full blur-[100px] pointer-events-none" />
                        <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div>
                                    <h1 className="text-xl font-black text-[#043061] tracking-tight">Manage Customer Portfolio</h1>
                                    <p className="text-xs text-gray-500 mt-0.5">Assign or reassign customers to your portfolio</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
                            <div className="p-1.5 bg-slate-100 rounded-lg">
                                <Users className="h-4 w-4 text-slate-600" />
                            </div>
                            <div>
                                <span className="font-semibold text-slate-800">Customer Assignment</span>
                                <p className="text-xs text-muted-foreground">
                                    List of all customers. You can assign unassigned customers or reassign those already managed.
                                </p>
                            </div>
                        </div>

                        <div className="p-5">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="relative flex-1 max-w-sm">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                                    <Input
                                        placeholder="Search by name or email..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') fetchCustomers(search); }}
                                        className="pl-10"
                                    />
                                </div>
                                <Button
                                    className="h-9 px-4 bg-[#043061] hover:bg-[#0b4f96] text-white rounded-xl text-sm font-medium"
                                    onClick={() => fetchCustomers(search)}
                                    disabled={loading}
                                >
                                    {loading ? <LoadingSpinner size={16} className="mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                                    Search
                                </Button>
                                <Badge variant="outline" className="text-sm">
                                    {pagination.total} {pagination.total === 1 ? 'customer' : 'customers'} found
                                </Badge>
                            </div>

                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="text-muted-foreground flex items-center">
                                        <LoadingSpinner size={16} className="mr-2" />
                                        Loading customers...
                                    </div>
                                </div>
                            ) : customers.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <Users className="h-12 w-12 text-muted-foreground mb-4" />
                                    <h3 className="text-lg font-semibold mb-2">No unassigned customers</h3>
                                    <p className="text-muted-foreground">
                                        {search ? 'Try adjusting your search terms' : 'All customers have been assigned'}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="border rounded-lg overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Name</TableHead>
                                                    <TableHead>Email</TableHead>
                                                    <TableHead>Customer Type</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Assigned Rep</TableHead>
                                                    <TableHead>Sales Manager</TableHead>
                                                    <TableHead>Created</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {customers.map((customer) => {
                                                    const isAlreadyAssignedToMe = customer.salesManagerAssignments?.some(
                                                        (a: any) => a.salesManager?.user?.id === user?.id
                                                    );
                                                    const isAssignedToOther = customer.salesManagerAssignments && customer.salesManagerAssignments.length > 0 && !isAlreadyAssignedToMe;

                                                    return (
                                                        <TableRow key={customer.id}>
                                                            <TableCell className="font-medium">
                                                                {customer.firstName} {customer.lastName}
                                                            </TableCell>
                                                            <TableCell>{customer.email}</TableCell>
                                                            <TableCell>
                                                                <Badge variant={getCustomerTypeBadge(customer.customerType).variant}>
                                                                    {getCustomerTypeBadge(customer.customerType).label}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge variant={customer.isApproved ? 'default' : 'outline'}>
                                                                    {customer.isApproved ? 'Approved' : 'Pending'}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell>
                                                                {customer.salesAssignments && customer.salesAssignments.length > 0 ? (
                                                                    <Badge variant="secondary">
                                                                        {customer.salesAssignments[0].salesRep.user.firstName} {customer.salesAssignments[0].salesRep.user.lastName}
                                                                    </Badge>
                                                                ) : (
                                                                    <span className="text-muted-foreground text-sm">-</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                {customer.salesManagerAssignments && customer.salesManagerAssignments.length > 0 ? (
                                                                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                                                                        {customer.salesManagerAssignments[0].salesManager.user.firstName} {customer.salesManagerAssignments[0].salesManager.user.lastName}
                                                                    </Badge>
                                                                ) : (
                                                                    <span className="text-muted-foreground text-sm">-</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-muted-foreground">
                                                                {new Date(customer.createdAt).toLocaleDateString()}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => handleAssignToMe(customer.id)}
                                                                    disabled={assigningId === customer.id || isAlreadyAssignedToMe}
                                                                    className="gap-2"
                                                                    variant={isAlreadyAssignedToMe ? "outline" : "default"}
                                                                >
                                                                    {assigningId === customer.id ? (
                                                                        <LoadingSpinner size={16} />
                                                                    ) : isAlreadyAssignedToMe ? (
                                                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                                                    ) : (
                                                                        <UserPlus className="h-4 w-4" />
                                                                    )}
                                                                    {assigningId === customer.id
                                                                        ? 'Assigning...'
                                                                        : isAlreadyAssignedToMe
                                                                            ? 'Assigned to You'
                                                                            : isAssignedToOther
                                                                                ? 'Reassign to Me'
                                                                                : 'Assign to Me'}
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    {/* Pagination Controls */}
                                    {pagination.pages > 1 && (
                                        <div className="flex items-center justify-end gap-2 pt-4">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={pagination.page <= 1}
                                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                            >
                                                Previous
                                            </Button>
                                            <span className="text-sm text-muted-foreground">
                                                Page {pagination.page} of {pagination.pages}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={pagination.page >= pagination.pages}
                                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                            >
                                                Next
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
