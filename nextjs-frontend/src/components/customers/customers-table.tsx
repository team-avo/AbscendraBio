'use client';

import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Edit, MoreHorizontal, Trash2, MapPin, User, Building, Crown, Eye, Check, Key, MessageSquare, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { Customer, api } from '@/lib/api';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { CustomerDetailsDialog } from './customer-details-dialog';
import { CustomerOrdersDialog } from './customer-orders-dialog';
import { ChangePasswordDialog } from '../users/change-password-dialog';
import { AssignSalesRepDialog } from './assign-sales-rep-dialog';
import { AssignSalesManagerDialog } from './assign-sales-manager-dialog';
import { EditCustomerTypeDialog } from './edit-customer-type-dialog';
import { useAuth } from '@/contexts/auth-context';
import logger from '@/lib/logger';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { Mail } from 'lucide-react';

interface CustomersTableProps {
  customers: Customer[];
  loading: boolean;
  onEdit: (customer: Customer) => void;
  onDelete: (customerId: string) => void;
  onHardDelete: (customerId: string) => void;
  onManageAddresses: (customer: Customer) => void;
  onViewDetails?: (customer: Customer) => void;
  onReactivate?: (customerId: string) => void;
  hideEditAndAddresses?: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onExportAll?: () => void;
  onEmailReport?: () => void;
  onRefreshCommentCounts?: () => void;
  onRefresh?: () => void;
}

const CustomerTypeBadge = ({ type }: { type: string }) => {
  const variants: { [key: string]: { variant: "default" | "secondary" | "destructive" | "outline", label: string, icon: any } } = {
    B2C: { variant: "outline", label: "Wholesale", icon: Building },
    B2B: { variant: "secondary", label: "Wholesale", icon: Building },
    ENTERPRISE_1: { variant: "default", label: "Enterprise", icon: Crown },
    ENTERPRISE_2: { variant: "default", label: "Enterprise", icon: Crown },
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

const StatusBadge = ({ isApproved, approvalStatus }: { isApproved: boolean; approvalStatus?: 'PENDING' | 'APPROVED' | 'DEACTIVATED' }) => {
  // approvalStatus is authoritative; fall back to isApproved only when absent
  const status = approvalStatus
    ? approvalStatus
    : (isApproved ? 'APPROVED' : 'PENDING');
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    PENDING: { label: 'Pending', variant: 'secondary' },
    APPROVED: { label: 'Approved', variant: 'default' },
    DEACTIVATED: { label: 'Deactivated', variant: 'destructive' },
  };
  const cfg = map[status] || map.PENDING;
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
};

function customersToCSV(customers: Customer[]): string {
  const headers = ['First Name', 'Last Name', 'Company', 'License Number', 'Email', 'Type', 'Status'];
  const rows = customers.map(c => [
    c.firstName,
    c.lastName,
    c.companyName || '',
    c.licenseNumber || '',
    c.email,
    c.customerType,
    c.isActive ? 'Active' : 'Inactive'
  ]);
  return [headers, ...rows].map(r => r.map(x => `"${x}"`).join(',')).join('\n');
}

export function CustomersTable({
  customers,
  loading,
  onEdit,
  onDelete,
  onHardDelete,
  onManageAddresses,
  onViewDetails,
  onReactivate,
  hideEditAndAddresses,
  currentPage,
  totalPages,
  onPageChange,
  onExportAll,
  onEmailReport,
  onRefreshCommentCounts,
  onRefresh
}: CustomersTableProps) {
  const isMobile = useIsMobile();
  const [selected, setSelected] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: string) => {
    setSortConfig(prev =>
      prev?.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    );
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortConfig?.key !== col) return <ChevronsUpDown className="ml-1 h-3 w-3 inline opacity-40" />;
    return sortConfig.dir === 'asc'
      ? <ChevronUp className="ml-1 h-3 w-3 inline text-primary" />
      : <ChevronDown className="ml-1 h-3 w-3 inline text-primary" />;
  };

  const sortedCustomers = [...customers].sort((a, b) => {
    if (!sortConfig) return 0;
    const dir = sortConfig.dir === 'asc' ? 1 : -1;
    switch (sortConfig.key) {
      case 'name': return dir * (`${a.firstName} ${a.lastName}`).localeCompare(`${b.firstName} ${b.lastName}`);
      case 'email': return dir * (a.email || '').localeCompare(b.email || '');
      case 'type': return dir * (a.customerType || '').localeCompare(b.customerType || '');
      case 'created': return dir * (new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
      case 'orders': return dir * ((a._count?.orders || 0) - (b._count?.orders || 0));
      default: return 0;
    }
  });

  const [bulkAction, setBulkAction] = useState<null | 'delete' | 'export' | 'deactivate'>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [customerDetailsOpen, setCustomerDetailsOpen] = useState(false);
  const [customerOrdersOpen, setCustomerOrdersOpen] = useState(false);
  const [changePasswordDialogOpen, setChangePasswordDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [assignRepDialog, setAssignRepDialog] = useState<{ open: boolean; customer: Customer | null }>({ open: false, customer: null });
  const [assignManagerDialog, setAssignManagerDialog] = useState<{ open: boolean; customer: Customer | null }>({ open: false, customer: null });
  const [editTypeOpen, setEditTypeOpen] = useState(false);

  // Check if current user is ADMIN for controlling assignment options
  const { hasRole, user } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const isSalesManager = hasRole('SALES_MANAGER');
  const isSalesRep = user?.role === 'SALES_REP';
  const canEditSalesRep = isAdmin || isSalesManager;
  const canDeleteCustomer = isAdmin;

  const allSelected = customers.length > 0 && selected.length === customers.length;
  const toggleSelectAll = () => {
    if (allSelected) setSelected([]);
    else setSelected(customers.map(c => c.id));
  };
  const toggleSelect = (id: string) => {
    setSelected(sel => sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]);
  };

  const handleConfirmBulkDeactivate = async () => {
    logger.info('=== BULK DEACTIVATE STARTED ===');
    logger.info('Selected IDs:', { data: selected });
    if (selected.length === 0) {
      setConfirmOpen(false);
      return;
    }
    try {
      setConfirmLoading(true);
      for (const id of selected) {
        logger.info('Deactivating customer:', { data: id });
        await onDelete(id);
      }
      setSelected([]);
    } finally {
      setConfirmLoading(false);
      setConfirmOpen(false);
      setBulkAction(null);
      logger.info('=== BULK DEACTIVATE COMPLETED ===');
    }
  };

  const handleDelete = (customer: Customer) => {
    onDelete(customer.id);
  };

  const handleBulkExport = () => {
    const selectedCustomers = customers.filter(c => selected.includes(c.id));
    const exportData = selectedCustomers.map(c => ({
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
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customers');
    XLSX.writeFile(wb, `customers-selected-${new Date().toISOString().split('T')[0]}.xlsx`);
    setBulkAction(null);
  };

  const handleBulkDelete = async () => {
    logger.info('=== BULK DELETE STARTED ===');
    logger.info('Selected IDs:', { data: selected });
    logger.info('Bulk action:', { data: bulkAction });
    if (selected.length === 0) {
      logger.info('No customers selected, returning');
      return;
    }

    try {
      setConfirmLoading(true);
      logger.info('Calling api.bulkDeleteCustomers...');
      const result = await api.bulkDeleteCustomers(selected);
      logger.info('API Result:', { data: result });
      if (result.success) {
        toast.success(`Successfully deleted ${result.data?.deletedCount || selected.length} customer(s)`);
        setSelected([]);
        setBulkAction(null);
        setConfirmOpen(false);
        logger.info('=== BULK DELETE COMPLETED SUCCESSFULLY ===');
        // Reload page to refresh the list
        onRefresh?.();
      } else {
        logger.error('Bulk delete failed:', { error: result.error });
        toast.error(result.error || 'Failed to delete customers');
        setConfirmLoading(false);
      }
    } catch (error: any) {
      logger.error('Bulk delete error:', { error: error });
      toast.error(error.message || 'Failed to delete customers');
      setConfirmLoading(false);
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const handleCustomerClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerDetailsOpen(true);
  };

  const handleViewDetailsInternal = (customer: Customer) => {
    if (onViewDetails) {
      onViewDetails(customer);
    } else {
      handleCustomerClick(customer);
    }
  };

  const handleOrdersClick = (customer: Customer, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedCustomer(customer);
    setCustomerOrdersOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk action header */}
      {(!isMobile || selected.length > 0 || onEmailReport) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 border rounded-md bg-muted/30 gap-3">
          <div className="text-sm text-muted-foreground">
            {selected.length > 0 ? `${selected.length} selected` : ''}
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {selected.length > 0 && (
              <>
                {canDeleteCustomer && (
                  <Button variant="destructive" size="sm" className="flex-1 sm:flex-none" onClick={() => {
                    logger.info('DELETE SELECTED button clicked');
                    setBulkAction('delete');
                    setConfirmOpen(true);
                    logger.info('Set bulkAction to: delete, confirmOpen to: true');
                  }}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    DELETE
                  </Button>
                )}
                {!isMobile && (
                  <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={handleBulkExport}>Export ({selected.length})</Button>
                )}
                {canDeleteCustomer && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none"
                    onClick={() => { setBulkAction('deactivate'); setConfirmOpen(true); }}
                  >
                    Deactivate
                  </Button>
                )}
              </>
            )}
            {onEmailReport && (
              <Button
                variant="outline"
                size="sm"
                onClick={onEmailReport}
                className="flex-1 sm:flex-none"
              >
                <Mail className="h-4 w-4 mr-1" />
                {isMobile ? "Email Report" : "Email"}
              </Button>
            )}
            {onExportAll && !isMobile && (
              <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={onExportAll}>Export All</Button>
            )}
          </div>
        </div>
      )}
      <div className="rounded-xl border border-gray-200 overflow-hidden -mx-4 sm:mx-0">
        <Table className="min-w-[1100px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} /></TableHead>
              <TableHead className="min-w-[200px] cursor-pointer select-none" onClick={() => handleSort('name')}>Customer<SortIcon col="name" /></TableHead>
              <TableHead className="min-w-[200px] cursor-pointer select-none" onClick={() => handleSort('email')}>Contact<SortIcon col="email" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort('type')}>Type<SortIcon col="type" /></TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sales Rep</TableHead>
              <TableHead>Sales Manager</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort('orders')}>Orders<SortIcon col="orders" /></TableHead>
              <TableHead>Comments</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort('created')}>Created<SortIcon col="created" /></TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedCustomers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell><input type="checkbox" checked={selected.includes(customer.id)} onChange={() => toggleSelect(customer.id)} /></TableCell>
                <TableCell
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleCustomerClick(customer)}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={`/avatars/${customer.id}.jpg`} />
                      <AvatarFallback className="text-[10px]">
                        {getInitials(customer.firstName, customer.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-medium truncate flex items-center gap-2">
                        {[customer.firstName, customer.lastName].filter(Boolean).join(' ')}
                        {customer._count?.comments !== undefined && customer._count.comments > 0 && (
                          <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200">
                            {customer._count.comments}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">ID: {customer.id}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-0.5 min-w-[150px]">
                    {customer.companyName && (
                      <div className="text-sm font-semibold text-muted-foreground truncate">
                        {customer.companyName}
                      </div>
                    )}
                    <div className="text-sm truncate">{customer.email}</div>
                    <div className="text-xs text-muted-foreground">{customer.mobile}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <CustomerTypeBadge type={customer.customerType} />
                </TableCell>
                <TableCell>
                  <StatusBadge isApproved={customer.isApproved} approvalStatus={customer.approvalStatus as any} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 group">
                    <div className="text-sm">
                      {customer.salesAssignments && customer.salesAssignments.length > 0 ? (
                        <div className="space-y-1">
                          {customer.salesAssignments.map((assignment: any) => (
                            <div key={assignment.id} className="text-muted-foreground">
                              {assignment.salesRep?.user ?
                                `${assignment.salesRep.user.firstName} ${assignment.salesRep.user.lastName}` :
                                '-'}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                    {canEditSalesRep && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAssignRepDialog({ open: true, customer });
                        }}
                        title="Assign Sales Rep"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 group">
                    <div className="text-sm">
                      {customer.salesManagerAssignments && customer.salesManagerAssignments.length > 0 ? (
                        <div className="space-y-1">
                          {customer.salesManagerAssignments.map((assignment: any) => (
                            <div key={assignment.id} className="text-muted-foreground font-semibold text-primary">
                              {assignment.salesManager?.user ?
                                `${assignment.salesManager.user.firstName} ${assignment.salesManager.user.lastName}` :
                                '-'}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground font-mono text-xs opacity-50">Unassigned</span>
                      )}
                    </div>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAssignManagerDialog({ open: true, customer });
                        }}
                        title="Assign Sales Manager"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={(e) => handleOrdersClick(customer, e)}
                >
                  <div className="text-sm">
                    {customer._count?.orders || 0}
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewDetailsInternal(customer);
                    }}
                  >
                    <MessageSquare className="h-4 w-4" />
                    {customer._count?.comments !== undefined && customer._count.comments > 0 && (
                      <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                        {customer._count.comments}
                      </Badge>
                    )}
                  </Button>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {new Date(customer.createdAt).toLocaleDateString()}
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
                      <DropdownMenuItem onClick={() => handleViewDetailsInternal(customer)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleViewDetailsInternal(customer)}
                      >
                        <MessageSquare className="mr-2 h-4 w-4" />
                        View/Add Comments
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {!hideEditAndAddresses && isAdmin && (
                        <DropdownMenuItem onClick={() => onEdit(customer)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Customer
                        </DropdownMenuItem>
                      )}
                      {!hideEditAndAddresses && (isSalesManager || isSalesRep) && (
                        <DropdownMenuItem onClick={() => {
                          setSelectedCustomer(customer);
                          setEditTypeOpen(true);
                        }}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Customer Type
                        </DropdownMenuItem>
                      )}
                      {!hideEditAndAddresses && isAdmin && (
                        <DropdownMenuItem onClick={() => onManageAddresses(customer)}>
                          <MapPin className="mr-2 h-4 w-4" />
                          Manage Addresses
                        </DropdownMenuItem>
                      )}
                      {canEditSalesRep && (
                        <DropdownMenuItem onClick={() => setAssignRepDialog({ open: true, customer })}>
                          <User className="mr-2 h-4 w-4" />
                          Assign Sales Representative
                        </DropdownMenuItem>
                      )}
                      {isAdmin && (
                        <DropdownMenuItem onClick={() => setAssignManagerDialog({ open: true, customer })}>
                          <Crown className="mr-2 h-4 w-4" />
                          Assign Sales Manager
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      {!customer.isApproved && customer.approvalStatus === 'DEACTIVATED' && isAdmin && onReactivate && (
                        <DropdownMenuItem
                          onClick={() => onReactivate(customer.id)}
                          className="text-green-600"
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Reactivate Customer
                        </DropdownMenuItem>
                      )}
                      {canDeleteCustomer && customer.isApproved && (
                        <DropdownMenuItem
                          onClick={() => onDelete(customer.id)}
                          className="text-orange-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Deactivate Customer
                        </DropdownMenuItem>
                      )}
                      {isAdmin && (
                        <DropdownMenuItem
                          onClick={async () => {
                            try {
                              const resp = await api.requestPasswordReset(customer.email);
                              if (resp.success) toast.success('Password reset link sent successfully');
                              else toast.error(resp.error || 'Failed to send reset link');
                            } catch (e: any) {
                              toast.error(e?.message || 'Failed to send reset link');
                            }
                          }}
                        >
                          <Key className="mr-2 h-4 w-4" />
                          Send Reset Link
                        </DropdownMenuItem>
                      )}
                      {isAdmin && (
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setChangePasswordDialogOpen(true);
                          }}
                        >
                          <Key className="mr-2 h-4 w-4" />
                          Change Password
                        </DropdownMenuItem>
                      )}
                      {canDeleteCustomer && (
                        <DropdownMenuItem
                          onClick={() => onHardDelete(customer.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Customer
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {
        totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        )
      }
      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={confirmOpen && bulkAction === 'delete'} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Customers</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selected.length} selected customer{selected.length === 1 ? '' : 's'}?
              This action cannot be undone. Customers with orders cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={confirmLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {confirmLoading ? 'Deleting...' : `Delete ${selected.length} Customer${selected.length === 1 ? '' : 's'}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Deactivate Confirmation Dialog */}
      <AlertDialog open={confirmOpen && bulkAction === 'deactivate'} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Selected Customers</AlertDialogTitle>
            <AlertDialogDescription>
              Deactivate {selected.length} selected customer{selected.length === 1 ? '' : 's'}? They will lose access until re-approved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmBulkDeactivate}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Deactivate {selected.length} Customer{selected.length === 1 ? '' : 's'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Customer Details Dialog */}
      <CustomerDetailsDialog
        customer={selectedCustomer}
        open={customerDetailsOpen}
        onOpenChange={setCustomerDetailsOpen}
        onCommentAdded={onRefreshCommentCounts}
      />

      {/* Customer Orders Dialog */}
      <CustomerOrdersDialog
        customer={selectedCustomer}
        open={customerOrdersOpen}
        onOpenChange={setCustomerOrdersOpen}
      />

      <ChangePasswordDialog
        open={changePasswordDialogOpen}
        onOpenChange={setChangePasswordDialogOpen}
        onConfirm={(newPassword) => api.resetCustomerPassword(selectedCustomer?.id || '', newPassword)}
        title={`Change Password: ${selectedCustomer?.firstName} ${selectedCustomer?.lastName}`}
        entityName="customer"
      />

      {/* Assign Sales Rep Dialog */}
      <AssignSalesRepDialog
        open={assignRepDialog.open}
        customer={assignRepDialog.customer}
        onOpenChange={(open) => setAssignRepDialog(prev => ({ ...prev, open }))}
        onSuccess={() => {
          // Ideally we should reload data here, but onEdit/etc are callbacks. 
          // We can trigger a reload if we had a callback passed down, or just rely on the user refreshing if needed.
          // Providing a window reload for now to be safe as done elsewhere, or just close.
          // Since CustomersTable uses props 'customers', we can't easily refresh internal data without parent refresing.
          // We will notify parent or force reload.
          onRefresh?.();
        }}
      />

      {/* Assign Sales Manager Dialog */}
      <AssignSalesManagerDialog
        open={assignManagerDialog.open}
        customer={assignManagerDialog.customer}
        onOpenChange={(open) => setAssignManagerDialog(prev => ({ ...prev, open }))}
        onSuccess={() => {
          onRefresh?.();
        }}
      />

      {/* Edit Customer Type Dialog */}
      <EditCustomerTypeDialog
        open={editTypeOpen}
        customer={selectedCustomer}
        onOpenChange={setEditTypeOpen}
        onSuccess={() => {
          onRefresh?.();
        }}
      />
    </div >
  );
} 