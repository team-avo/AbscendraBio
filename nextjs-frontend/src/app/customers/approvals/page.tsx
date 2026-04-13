"use client";

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { ProtectedRoute } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Clock, User, Mail, Phone, Calendar, Search, Building, Crown, MoreHorizontal, Eye } from 'lucide-react';
import { api } from '@/lib/api';
import { Pagination } from '@/components/ui/pagination';
import logger from '@/lib/logger';

interface PendingCustomer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  city?: string;
  zip?: string;
  customerType: 'B2C' | 'B2B' | 'ENTERPRISE_1' | 'ENTERPRISE_2';
  createdAt: string;
  isActive: boolean;
  isApproved: boolean;
  emailVerified?: boolean;
}

export default function CustomerApprovalsPage() {
  const [pendingCustomers, setPendingCustomers] = useState<PendingCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [selectedCustomer, setSelectedCustomer] = useState<PendingCustomer | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const ITEMS_PER_PAGE = 10;

  const fetchPendingCustomers = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        search: searchTerm || undefined,
      };

      if (statusFilter === 'pending') {
        params.approvalStatus = 'PENDING';
      } else if (statusFilter === 'approved') {
        params.approvalStatus = 'APPROVED';
      } else if (statusFilter === 'rejected') {
        params.approvalStatus = 'DEACTIVATED';
      }

      const response = await api.getCustomers(params);

      if (response && response.success && response.data) {
        setPendingCustomers(response.data.customers || []);
        setTotalItems(response.data.pagination.total);
        setTotalPages(response.data.pagination.pages);

        // Update stats from the backend response
        if (response.data.stats) {
          setStats({
            pending: response.data.stats.pending || 0,
            approved: response.data.stats.approved || 0,
            rejected: response.data.stats.rejected || 0
          });
        }
      }
    } catch (error) {
      logger.error('Failed to fetch customers:', { error });
      toast.error('Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingCustomers();
  }, [statusFilter, currentPage, searchTerm]);

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchTerm]);

  // Removed fetchAllCustomers as stats are now fetched with main list

  const handleApproval = async (customerId: string, approved: boolean) => {
    try {
      logger.debug('Starting approval process:', { customerId, approved });
      setProcessing(customerId);

      const updateData = {
        isApproved: approved,
        isActive: approved, // Also activate the account if approved
      };

      logger.debug('Sending update data:', { updateData });

      const response = await api.updateCustomer(customerId, updateData);

      logger.debug('API response:', { response });

      if (response.success) {
        toast.success(
          approved
            ? 'Customer account approved successfully'
            : 'Customer account rejected successfully'
        );

        logger.debug('Approval successful, refreshing data...');

        // Optimistically update dialog state to reflect new status immediately
        setSelectedCustomer((prev) => prev && prev.id === customerId
          ? { ...prev, isApproved: approved, isActive: approved }
          : prev
        );

        // Refresh the customer list
        await fetchPendingCustomers();

        // Close dialog if approved (it will disappear from pending list)
        if (approved) {
          setSelectedCustomer(null);
        }
      } else {
        logger.error('API returned error:', { error: response.error });
        toast.error(response.error || 'Operation failed');
      }
    } catch (error: any) {
      logger.error('Failed to update customer:', { error });
      toast.error(error?.response?.data?.error || error?.message || 'Failed to update customer');
    } finally {
      setProcessing(null);
    }
  };

  const handleViewDetails = (customer: PendingCustomer) => {
    setSelectedCustomer(customer);
  };

  const getCustomerTypeBadge = (type: string) => {
    const variants: { [key: string]: { variant: "default" | "secondary" | "destructive" | "outline", label: string, icon: any } } = {
      B2C: { variant: "outline", label: "Wholesale", icon: Building },
      B2B: { variant: "secondary", label: "Wholesale (B2B)", icon: Building },
      ENTERPRISE_1: { variant: "default", label: "Enterprise T1", icon: Crown },
      ENTERPRISE_2: { variant: "default", label: "Enterprise T2", icon: Crown },
    };

    const config = variants[type] || { variant: "outline", label: type, icon: User };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const filteredCustomers = pendingCustomers;

  // Calculate stats for pending, approved, and rejected
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0
  });

  // Removed loadStats effect as stats are now fetched with main list

  // Calculate customer type counts for filters
  const typeCounts = {
    total: pendingCustomers.length,
    b2c: pendingCustomers.filter(c => c.customerType === 'B2C').length,
    b2b: pendingCustomers.filter(c => c.customerType === 'B2B').length,
    e1: pendingCustomers.filter(c => c.customerType === 'ENTERPRISE_1').length,
    e2: pendingCustomers.filter(c => c.customerType === 'ENTERPRISE_2').length,
  };

  return (
    <ProtectedRoute requiredRoles={['ADMIN', 'MANAGER', 'STAFF']}>
      <DashboardLayout>
        <div className="space-y-5 px-2 sm:px-0">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Customer Approvals</h1>
              <p className="text-sm text-slate-500 mt-0.5">Review and approve pending customer registrations</p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Pending Approvals */}
            <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 px-5 py-4 shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Pending Approvals</p>
                <p className="text-2xl font-bold text-amber-600 leading-tight">{stats.pending}</p>
              </div>
            </div>
            {/* Approved */}
            <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 px-5 py-4 shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Approved</p>
                <p className="text-2xl font-bold text-emerald-600 leading-tight">{stats.approved}</p>
              </div>
            </div>
            {/* Rejected */}
            <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 px-5 py-4 shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Rejected</p>
                <p className="text-2xl font-bold text-red-600 leading-tight">{stats.rejected}</p>
              </div>
            </div>
            {/* Total */}
            <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 px-5 py-4 shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                <User className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Total</p>
                <p className="text-2xl font-bold text-slate-900 leading-tight">{totalItems}</p>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name, email, or mobile..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 bg-slate-50 border-slate-200 rounded-xl text-sm placeholder:text-slate-400"
              />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 px-3 text-sm border-slate-200 rounded-xl bg-slate-50 w-auto min-w-[140px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Approvals List</h2>
                <p className="text-xs text-slate-400">{totalItems.toLocaleString()} records</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium">
                    {statusFilter === 'all' ? 'No Customers Found' :
                      statusFilter === 'approved' ? 'No Approved Accounts' :
                        statusFilter === 'rejected' ? 'No Rejected Accounts' : 'No Pending Approvals'}
                  </h3>
                  <p className="text-muted-foreground">
                    {searchTerm || statusFilter !== 'all'
                      ? "Try adjusting your search or filters"
                      : statusFilter === 'all' ? "No customer accounts found in the system." :
                        "All customer accounts have been reviewed and processed."}
                  </p>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto -mx-4 sm:mx-0">
                  <Table className="min-w-[800px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Registration Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCustomers.map((customer) => (
                        <TableRow key={customer.id}>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <Avatar>
                                <AvatarImage src={`/avatars/${customer.id}.jpg`} />
                                <AvatarFallback>
                                  {getInitials(customer.firstName, customer.lastName)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">
                                  {[customer.firstName, customer.lastName].filter(Boolean).join(' ')}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  ID: {customer.id}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="text-sm">{customer.email}</div>
                              <div className="text-sm text-muted-foreground">{customer.mobile}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {new Date(customer.createdAt).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {customer.isApproved ? (
                                <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                                  <CheckCircle className="mr-1 h-3 w-3" />
                                  Approved
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                                  <Clock className="mr-1 h-3 w-3" />
                                  Pending
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleViewDetails(customer)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {!customer.isApproved && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => handleApproval(customer.id, true)}
                                      disabled={processing === customer.id}
                                      className="text-green-600"
                                    >
                                      <CheckCircle className="mr-2 h-4 w-4" />
                                      Approve
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleApproval(customer.id, false)}
                                      disabled={processing === customer.id}
                                      className="text-red-600"
                                    >
                                      <XCircle className="mr-2 h-4 w-4" />
                                      Reject
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {customer.isApproved && (
                                  <DropdownMenuItem
                                    onClick={() => handleApproval(customer.id, false)}
                                    disabled={processing === customer.id}
                                    className="text-red-600"
                                  >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Revoke Approval
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {totalPages > 1 && (
                    <div className="py-4 border-t px-4">
                      <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Customer Details Dialog */}
          <Dialog open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[calc(100vw-2rem)] sm:w-full p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle>Customer Details</DialogTitle>
                <DialogDescription>
                  Review customer information before making approval decision
                </DialogDescription>
              </DialogHeader>
              {selectedCustomer && (
                <div className="space-y-4">
                  {/** Local state to force Tier 2 (B2B) default in UI */}
                  {(() => {
                    // use a ref in closure to inject state without rerender loops
                    return null;
                  })()}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                      <p className="text-sm font-medium">{[selectedCustomer.firstName, selectedCustomer.lastName].filter(Boolean).join(' ')}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Customer ID</label>
                      <p className="text-sm font-mono bg-muted px-2 py-1 rounded break-all">{selectedCustomer.id}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Email</label>
                      <p className="text-sm">{selectedCustomer.email}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Email Verification</label>
                      <div className="mt-1">
                        {selectedCustomer.emailVerified ? (
                          <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">Verified</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">Unverified</Badge>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Mobile</label>
                      <p className="text-sm">{selectedCustomer.mobile}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Customer Type</label>
                      {/* Bind to actual customer type and allow changing */}
                      <Select
                        value={selectedCustomer.customerType}
                        onValueChange={async (value) => {
                          try {
                            setProcessing(selectedCustomer.id);

                            const updateData = {
                              customerType: value as 'B2C' | 'B2B' | 'ENTERPRISE_1' | 'ENTERPRISE_2',
                            };

                            const response = await api.updateCustomer(selectedCustomer.id, updateData);

                            if (response.success) {
                              toast.success('Customer type updated successfully');

                              // Update the selected customer with new data
                              setSelectedCustomer({
                                ...selectedCustomer,
                                customerType: value as 'B2C' | 'B2B' | 'ENTERPRISE_1' | 'ENTERPRISE_2'
                              });

                              // Refresh the customer list
                              await fetchPendingCustomers();
                            } else {
                              toast.error(response.error || 'Failed to update customer type');
                            }
                          } catch (error: any) {
                            logger.error('Failed to update customer type:', { error });
                            toast.error(error?.response?.data?.error || error?.message || 'Failed to update customer type');
                          } finally {
                            setProcessing(null);
                          }
                        }}
                        disabled={processing === selectedCustomer.id}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select customer tier" />
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
                      <label className="text-sm font-medium text-muted-foreground">Status</label>
                      <div className="mt-1">
                        {selectedCustomer.isApproved ? (
                          <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Approved
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                            <Clock className="mr-1 h-3 w-3" />
                            Pending Approval
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Registration Date</label>
                      <p className="text-sm">{new Date(selectedCustomer.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Account Active</label>
                      <p className="text-sm">
                        {selectedCustomer.isActive ? (
                          <span className="text-green-600 font-medium">✓ Active</span>
                        ) : (
                          <span className="text-red-600 font-medium">✗ Inactive</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">City</label>
                      <p className="text-sm">{selectedCustomer.city || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">ZIP Code</label>
                      <p className="text-sm">{selectedCustomer.zip || '-'}</p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-4 border-t">
                    <Button variant="outline" onClick={() => setSelectedCustomer(null)}>
                      Close
                    </Button>
                    {!selectedCustomer.isApproved ? (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => handleApproval(selectedCustomer.id, false)}
                          disabled={processing === selectedCustomer.id}
                          className="border-red-300 text-red-700 hover:bg-red-50"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                        <Button
                          onClick={() => handleApproval(selectedCustomer.id, true)}
                          disabled={processing === selectedCustomer.id}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => handleApproval(selectedCustomer.id, false)}
                        disabled={processing === selectedCustomer.id}
                        className="border-red-300 text-red-700 hover:bg-red-50"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Revoke Approval
                      </Button>
                    )}
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
