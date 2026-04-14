"use client";

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { ProtectedRoute } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Clock, User, Mail, Phone, Calendar, Search, Building, Crown, Eye } from 'lucide-react';
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
        <div className="space-y-0">

          {/* ════════ DARK HERO STRIP ════════ */}
          <div className="relative bg-[#070B14] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#4D7DF2]/8 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-xl font-black text-white tracking-tight">Customer Approvals</h1>
                  <p className="text-xs text-gray-500 mt-0.5">Review and approve new customer registrations</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-2">
                    <Clock className="h-4 w-4 text-amber-400" />
                    <div>
                      <p className="text-[9px] text-gray-500 font-medium uppercase tracking-widest leading-none">Pending</p>
                      <p className="text-base font-black text-white tabular-nums leading-tight">{stats.pending.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status pills */}
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
                {[
                  { key: 'pending',  label: 'Pending',  count: stats.pending,  color: 'amber' },
                  { key: 'approved', label: 'Approved', count: stats.approved, color: 'emerald' },
                  { key: 'rejected', label: 'Rejected', count: stats.rejected, color: 'red' },
                ].map((pill) => {
                  const colorStyles: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
                    amber:   { bg: 'bg-amber-500/15',   text: 'text-amber-400',   ring: 'ring-amber-500/30',   dot: 'bg-amber-400' },
                    emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', ring: 'ring-emerald-500/30', dot: 'bg-emerald-400' },
                    red:     { bg: 'bg-red-500/15',     text: 'text-red-400',     ring: 'ring-red-500/30',     dot: 'bg-red-400' },
                  };
                  const c = colorStyles[pill.color];
                  const isActive = statusFilter === pill.key;
                  return (
                    <button
                      key={pill.key}
                      onClick={() => setStatusFilter(pill.key)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        isActive ? `${c.bg} ${c.text} ring-1 ${c.ring}` : 'bg-white/[0.04] text-gray-500 hover:bg-white/[0.08] hover:text-gray-300'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? c.dot : 'bg-gray-600'}`} />
                      <span>{pill.label}</span>
                      <span className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-black tabular-nums ${
                        isActive ? `${c.bg} ${c.text}` : 'bg-white/[0.06] text-gray-500'
                      }`}>
                        {pill.count.toLocaleString()}
                      </span>
                    </button>
                  );
                })}
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
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
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
              ) : filteredCustomers.length === 0 ? (
                <div className="text-center py-16 text-gray-400 text-sm">No customers found matching the criteria.</div>
              ) : (
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow className="bg-gray-50/50 border-b border-gray-100">
                      <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wider">Customer</TableHead>
                      <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wider">Contact</TableHead>
                      <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wider">Type</TableHead>
                      <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wider">Registered</TableHead>
                      <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wider">Status</TableHead>
                      <TableHead className="text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.map((customer) => (
                      <TableRow key={customer.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 rounded-xl">
                              <AvatarFallback className="rounded-xl bg-[#070B14] text-white text-xs font-black">
                                {getInitials(customer.firstName, customer.lastName)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-bold text-gray-900">{customer.firstName} {customer.lastName}</p>
                              <p className="text-xs text-gray-400">{customer.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Phone className="h-3 w-3" />{customer.mobile || '—'}
                          </div>
                        </TableCell>
                        <TableCell>{getCustomerTypeBadge(customer.customerType)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Calendar className="h-3 w-3" />
                            {new Date(customer.createdAt).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          {customer.isApproved ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">
                              <CheckCircle className="h-3 w-3" /> Approved
                            </span>
                          ) : !customer.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 text-red-700 text-xs font-bold border border-red-100">
                              <XCircle className="h-3 w-3" /> Rejected
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold border border-amber-100">
                              <Clock className="h-3 w-3" /> Pending
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleViewDetails(customer)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {!customer.isApproved && customer.isActive !== false && (
                              <>
                                <button
                                  onClick={() => handleApproval(customer.id, true)}
                                  disabled={processing === customer.id}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors disabled:opacity-50 border border-emerald-100"
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />Approve
                                </button>
                                <button
                                  onClick={() => handleApproval(customer.id, false)}
                                  disabled={processing === customer.id}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-bold hover:bg-red-100 transition-colors disabled:opacity-50 border border-red-100"
                                >
                                  <XCircle className="h-3.5 w-3.5" />Reject
                                </button>
                              </>
                            )}
                            {customer.isApproved && (
                              <button
                                onClick={() => handleApproval(customer.id, false)}
                                disabled={processing === customer.id}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-bold hover:bg-red-100 transition-colors disabled:opacity-50 border border-red-100"
                              >
                                <XCircle className="h-3.5 w-3.5" />Revoke
                              </button>
                            )}
                            {!customer.isActive && !customer.isApproved && (
                              <button
                                onClick={() => handleApproval(customer.id, true)}
                                disabled={processing === customer.id}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors disabled:opacity-50 border border-emerald-100"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />Re-approve
                              </button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {filteredCustomers.length > 0 && totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-100">
                  <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                </div>
              )}
            </div>
          </div>

          {/* Detail Dialog */}
          {selectedCustomer && (
            <Dialog open={!!selectedCustomer} onOpenChange={(o) => !o && setSelectedCustomer(null)}>
              <DialogContent className="max-w-lg rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="font-black text-[#070B14]">Customer Details</DialogTitle>
                  <DialogDescription>Review registration information</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-14 w-14 rounded-2xl">
                      <AvatarFallback className="rounded-2xl bg-[#070B14] text-white text-lg font-black">
                        {getInitials(selectedCustomer.firstName, selectedCustomer.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-black text-gray-900 text-lg">{selectedCustomer.firstName} {selectedCustomer.lastName}</p>
                      <p className="text-sm text-gray-500">{selectedCustomer.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Phone', value: selectedCustomer.mobile || '—' },
                      { label: 'City', value: selectedCustomer.city || '—' },
                      { label: 'ZIP', value: selectedCustomer.zip || '—' },
                      { label: 'Registered', value: new Date(selectedCustomer.createdAt).toLocaleDateString() },
                    ].map(({ label, value }) => (
                      <div key={label} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{label}</p>
                        <p className="text-sm font-semibold text-gray-800 mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Account Type</p>
                    <div className="mt-1">{getCustomerTypeBadge(selectedCustomer.customerType)}</div>
                  </div>
                  {!selectedCustomer.isApproved && selectedCustomer.isActive !== false && (
                    <div className="flex gap-3 pt-2">
                      <Button onClick={() => handleApproval(selectedCustomer.id, true)} disabled={!!processing} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-widest">
                        <CheckCircle className="mr-1.5 h-3.5 w-3.5" />Approve
                      </Button>
                      <Button onClick={() => handleApproval(selectedCustomer.id, false)} disabled={!!processing} variant="destructive" className="flex-1 rounded-xl font-black text-xs uppercase tracking-widest">
                        <XCircle className="mr-1.5 h-3.5 w-3.5" />Reject
                      </Button>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
