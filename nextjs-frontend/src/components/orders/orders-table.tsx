'use client';

import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Package,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Download,
  Calendar,
  CreditCard,
  FileSpreadsheet,
  CheckSquare,
  Mail,
  MessageSquare
} from 'lucide-react';
import { Order } from '@/lib/api';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { getToken } from '@/lib/api';
import { RecordPaymentDialog } from './record-payment-dialog';
import { OrderDetailsDialog } from './order-details-dialog';
import { CustomerDetailsDialog } from './customer-details-dialog';
import { StatusHistoryDialog } from './status-history-dialog';
import { OrderItemsDialog } from './order-items-dialog';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import logger from '@/lib/logger';
import { Pagination } from '../ui/pagination';
import { downloadOrdersExcel } from '@/lib/export-orders';
import { OrderCommentsDialog } from './order-comments-dialog';
import { CustomerCommentsDialog } from './customer-comments-dialog';
import { CommentCountMap } from '@/lib/api-types';
import { useIsMobile } from '@/hooks/use-is-mobile';

interface OrdersTableProps {
  orders: Order[];
  loading: boolean;
  onEdit: (order: Order) => void;
  onDelete: (orderId: string) => void;
  onUpdateStatus: (order: Order) => void;
  onViewDetails?: (orderId: string) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onRefresh?: () => void;
  totalOrders?: number;
  onExportAll?: () => void;
  onEmailReport?: () => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'PROCESSING':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'LABEL_CREATED':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    case 'SHIPPED':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'DELIVERED':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'CANCELLED':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'REFUNDED':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'ON_HOLD':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getStatusLabel = (status: string) => {
  const labels: { [key: string]: string } = {
    PENDING: 'Pending',
    PROCESSING: 'Processing',
    LABEL_CREATED: 'Label Printed',
    SHIPPED: 'Shipped',
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled',
    REFUNDED: 'Refunded',
    ON_HOLD: 'On Hold',
  };
  return labels[status] || status.replace('_', ' ');
};

const getPaymentStatusColor = (status: string) => {
  switch (status) {
    case 'PAID':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'FAILED':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'REFUNDED':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getPaymentTypeColor = (type?: string | null) => {
  switch (type) {
    case 'ZELLE':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'BANK_WIRE':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'AUTHORIZE_NET':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};


const getPaymentType = (order: Order) => {
  if (order.selectedPaymentType) return order.selectedPaymentType;
  if (order.payments && order.payments.length > 0) {
    const p = order.payments[0];
    if (p.provider?.toLowerCase().includes('authorize')) return 'AUTHORIZE_NET';
    if (p.provider?.toLowerCase().includes('zelle')) return 'ZELLE';
    if (p.provider?.toLowerCase().includes('wire') || p.provider?.toLowerCase().includes('bank')) return 'BANK_WIRE';
  }
  return null;
};

export function OrdersTable({
  orders,
  loading,
  onEdit,
  onDelete,
  onUpdateStatus,
  onViewDetails,
  currentPage,
  totalPages,
  onPageChange,
  onRefresh,
  totalOrders,
  onExportAll,
  onEmailReport,
}: OrdersTableProps) {
  const isMobile = useIsMobile();
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<null | 'delete' | 'export'>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Order | null>(null);

  // Export states
  const [isExporting, setIsExporting] = useState(false);
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false);
  const [exportType, setExportType] = useState<'all' | 'selected'>('selected');

  // Dialog states
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);
  const [customerDetailsOpen, setCustomerDetailsOpen] = useState(false);
  const [statusHistoryOpen, setStatusHistoryOpen] = useState(false);
  const [orderItemsOpen, setOrderItemsOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [commentCounts, setCommentCounts] = useState<CommentCountMap>({ orders: {}, customers: {} });
  const [orderCommentsOpen, setOrderCommentsOpen] = useState(false);
  const [customerCommentsOpen, setCustomerCommentsOpen] = useState(false);

  const fetchCommentCounts = async () => {
    if (orders.length === 0) return;
    try {
      const orderIds = orders.map(o => o.id);
      const customerIds = orders.map(o => o.customerId).filter((id): id is string => !!id);
      const res = await api.getCommentCounts({ orderIds, customerIds });
      if (res.success && res.data) {
        setCommentCounts(res.data);
      }
    } catch (error) {
      console.error('Error fetching comment counts:', error);
    }
  };

  useEffect(() => {
    fetchCommentCounts();
  }, [orders]);

  const handleDelete = (orderId: string) => {
    setDeletingId(orderId);
    onDelete(orderId);
    setDeletingId(null);
  };

  const handleRecordPayment = (order: Order) => {
    setSelectedOrderForPayment(order);
    setPaymentDialogOpen(true);
  };

  const allSelected = orders.length > 0 && selected.length === orders.length;
  const toggleSelectAll = () => {
    if (allSelected) setSelected([]);
    else setSelected(orders.map(o => o.id));
  };
  const toggleSelect = (id: string) => {
    setSelected(sel => sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]);
  };

  const handleBulkDelete = async () => {
    if (selected.length === 0) return;

    try {
      const result = await api.bulkDeleteOrders(selected);
      if (result.success) {
        toast.success(`Successfully deleted ${result.data?.deletedCount || selected.length} order(s)`);
        setSelected([]);
        setBulkAction(null);
        // Refresh the orders list
        if (onRefresh) {
          onRefresh();
        }
      } else {
        toast.error(result.error || 'Failed to delete orders');
      }
    } catch (error: any) {
      logger.error('Bulk delete error:', { error: error });
      toast.error(error.message || 'Failed to delete orders');
    }
  };

  const handleConfirmExport = async () => {
    setExportConfirmOpen(false);
    setIsExporting(true);
    try {
      if (exportType === 'selected') {
        const selectedOrders = orders.filter(o => selected.includes(o.id));
        const fileName = `orders-export-${new Date().toISOString().split('T')[0]}.xlsx`;
        downloadOrdersExcel(selectedOrders, fileName);
        toast.success(`Exported ${selectedOrders.length} order(s)`);
        setSelected([]);
      } else {
        if (onExportAll) {
          await onExportAll();
        } else {
          const fileName = `all-orders-export-${new Date().toISOString().split('T')[0]}.xlsx`;
          downloadOrdersExcel(orders, fileName);
          toast.success(`Exported ${orders.length} order(s)`);
        }
      }
    } catch (error) {
      logger.error('Export failed:', { error });
      toast.error('Failed to export orders');
    } finally {
      setIsExporting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Sales Rep</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Payment</TableHead>
                <TableHead className="table-cell">Payment Type</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="hidden md:table-cell">Source</TableHead>
                <TableHead className="table-cell">Date</TableHead>
                <TableHead className="table-cell text-center min-w-[120px] px-2">Order comments</TableHead>
                <TableHead className="table-cell text-center min-w-[120px] px-2">Customer comments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-16" />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Skeleton className="h-6 w-16" />
                  </TableCell>
                  <TableCell className="table-cell">
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className="table-cell">
                    <Skeleton className="h-4 w-10" />
                  </TableCell>
                  <TableCell className="table-cell">
                    <Skeleton className="h-4 w-10" />
                  </TableCell>
                  <TableCell className="table-cell text-center">
                    <Skeleton className="h-8 w-8 rounded-full mx-auto" />
                  </TableCell>
                  <TableCell className="table-cell text-center">
                    <Skeleton className="h-8 w-8 rounded-full mx-auto" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center">
        <Package className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-2 text-sm font-medium text-muted-foreground">No orders found</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Get started by creating your first order.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-x-auto">
        {/* Table Header with Export Buttons */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-3 sm:p-4 border-b bg-muted/30">
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
            <div className="text-xs sm:text-sm text-muted-foreground">
              {loading ? 'Loading...' : `${orders.length} orders`}
            </div>
            {selected.length > 0 && (
              <div className="flex items-center gap-1.5 shrink-0">
                <CheckSquare className="h-3.5 w-3.5" />
                <span className="text-xs sm:text-sm font-medium">{selected.length} selected</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full md:w-auto">
            {selected.length > 0 && (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => { setBulkAction('delete'); setConfirmOpen(true); }}
                  className="h-9 sm:h-8 px-2 sm:px-3"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  <span className="text-xs sm:text-sm whitespace-nowrap">Delete</span>
                </Button>
                {!isMobile && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setExportType('selected');
                      setExportConfirmOpen(true);
                    }}
                    className="h-9 sm:h-8 px-2 sm:px-3"
                    disabled={isExporting}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
                    <span className="text-xs sm:text-sm whitespace-nowrap">
                      {isExporting && exportType === 'selected' ? 'Exporting...' : 'Export'}
                    </span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelected([])}
                  className="h-9 sm:h-8 px-2 sm:px-3 col-span-2 sm:col-auto"
                  disabled={isExporting}
                >
                  <span className="text-xs sm:text-sm whitespace-nowrap">Clear</span>
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onEmailReport}
              className="h-9 sm:h-8 px-2 sm:px-3"
              disabled={isExporting}
            >
              <Mail className="h-3.5 w-3.5 mr-1.5" />
              <span className="text-xs sm:text-sm whitespace-nowrap">{isMobile ? "Email Report" : "Email"}</span>
            </Button>
            {!isMobile && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setExportType('all');
                  setExportConfirmOpen(true);
                }}
                className="h-9 sm:h-8 px-2 sm:px-3"
                disabled={isExporting}
              >
                <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
                <span className="text-xs sm:text-sm whitespace-nowrap">
                  {isExporting && exportType === 'all' ? 'Exporting...' : 'Export All'}
                </span>
              </Button>
            )}
          </div>
        </div>

        <Table className="min-w-[800px] sm:min-w-[900px] w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Sales Rep</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="table-cell">Payment</TableHead>
              <TableHead className="table-cell">Payment Type</TableHead>
              <TableHead className="table-cell text-center">Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead className="table-cell">Channel</TableHead>
              <TableHead className="table-cell">Date</TableHead>
              <TableHead className="table-cell text-center min-w-[120px] px-2">Order comments</TableHead>
              <TableHead className="table-cell text-center min-w-[120px] px-2">Customer comments</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell>
                  <Checkbox
                    checked={selected.includes(order.id)}
                    onCheckedChange={() => toggleSelect(order.id)}
                  />
                </TableCell>
                <TableCell
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    // Open Edit Order dialog instead of read-only details
                    onEdit?.(order);
                  }}
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-sm">#{order.orderNumber}</span>
                      {commentCounts.orders[order.id] > 0 && (
                        <Badge variant="secondary" className="h-4 px-1 text-[9px] font-bold bg-blue-100 text-blue-700 border-blue-200">
                          {commentCounts.orders[order.id]}
                        </Badge>
                      )}
                    </div>
                    {order.notes && Array.isArray(order.notes) && order.notes.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {order.notes[0].note.length > 30
                          ? `${order.notes[0].note.substring(0, 30)}...`
                          : order.notes[0].note}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    if (order.customer) {
                      setSelectedOrder(order);
                      setCustomerDetailsOpen(true);
                    }
                  }}
                >
                  <div className="flex items-center space-x-2">
                    <Avatar className="h-7 w-7 sm:h-8 sm:w-8 shrink-0">
                      <AvatarImage src="" />
                      <AvatarFallback className="text-[10px] sm:text-xs">
                        {order.customer?.firstName?.[0]}{order.customer?.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs sm:text-sm font-medium truncate max-w-[80px] sm:max-w-[120px] lg:max-w-[140px] flex items-center gap-1.5">
                        {order.customer ?
                          `${order.customer.firstName} ${order.customer.lastName}` :
                          'Guest'
                        }
                        {order.customer?.id && commentCounts.customers[order.customer.id] > 0 && (
                          <Badge variant="secondary" className="h-4 px-1 text-[9px] font-bold bg-green-100 text-green-700 border-green-200">
                            {commentCounts.customers[order.customer.id]}
                          </Badge>
                        )}
                      </span>
                      <span className="text-[10px] sm:text-xs text-muted-foreground truncate max-w-[100px] sm:max-w-[140px] lg:max-w-[180px]">
                        {order.customer?.email}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {order.customer?.salesAssignments?.[0]?.salesRep?.user ? (
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate max-w-[120px]">
                        {`${order.customer.salesAssignments[0].salesRep.user.firstName} ${order.customer.salesAssignments[0].salesRep.user.lastName}`}
                      </span>
                      <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                        {order.customer.salesAssignments[0].salesRep.user.email}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    setSelectedOrder(order);
                    setStatusHistoryOpen(true);
                  }}
                >
                  <Badge variant="outline" className={cn("text-[10px] sm:text-xs px-1.5 py-0 h-5 sm:h-6", getStatusColor(order.status))}>
                    {getStatusLabel(order.status)}
                  </Badge>
                </TableCell>
                <TableCell className="table-cell">
                  <Badge variant="outline" className={cn("text-[10px] sm:text-xs px-1.5 py-0 h-5 sm:h-6", getPaymentStatusColor(
                    order.payments && order.payments.length > 0
                      ? order.payments[0].status
                      : 'PENDING'
                  ))}>
                    {order.payments && order.payments.length > 0
                      ? order.payments[0].status
                      : 'PENDING'}
                  </Badge>
                </TableCell>
                <TableCell className="table-cell">
                  {(() => {
                    const pType = getPaymentType(order);
                    return pType ? (
                      <Badge variant="outline" className={cn("text-[9px] sm:text-[10px] px-1.5 py-0 h-5 border whitespace-nowrap", getPaymentTypeColor(pType))}>
                        {pType === 'AUTHORIZE_NET' ? 'AUTHORIZE.NET' : pType}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    );
                  })()}
                </TableCell>

                <TableCell
                  className="table-cell cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    setSelectedOrder(order);
                    setOrderItemsOpen(true);
                  }}
                >
                  <div className="flex items-center space-x-1">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{order.items?.length || 0}</span>
                  </div>
                </TableCell>
                <TableCell className="font-medium text-xs sm:text-sm">
                  {formatCurrency(order.totalAmount)}
                </TableCell>
                <TableCell className="table-cell">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] sm:text-xs font-medium truncate max-w-[100px]">
                      {order.salesChannel?.companyName || 'Ascendra Bio'}
                    </span>
                    {order.partnerOrderId && (
                      <span className="text-[9px] text-muted-foreground truncate max-w-[80px]">
                        ID: {order.partnerOrderId}
                      </span>
                    )}
                  </div>
                </TableCell>

                <TableCell className="table-cell">
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0 hidden sm:inline" />
                    <span className="text-[10px] sm:text-sm whitespace-nowrap">
                      {order.createdAt ? format(new Date(order.createdAt), 'MMM dd, yyyy') : '??'}
                    </span>
                  </div>
                </TableCell>

                <TableCell className="table-cell text-center min-w-[120px]">
                  <div className="flex justify-center items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 relative"
                      onClick={() => {
                        setSelectedOrder(order);
                        setOrderCommentsOpen(true);
                      }}
                    >
                      <MessageSquare className="h-4 w-4" />
                      {commentCounts.orders[order.id] > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
                          {commentCounts.orders[order.id]}
                        </span>
                      )}
                    </Button>
                  </div>
                </TableCell>

                <TableCell className="table-cell text-center min-w-[120px]">
                  <div className="flex justify-center items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 relative"
                      onClick={() => {
                        setSelectedOrder(order);
                        setCustomerCommentsOpen(true);
                      }}
                      disabled={!order.customer}
                    >
                      <MessageSquare className="h-4 w-4" />
                      {order.customer?.id && commentCounts.customers[order.customer.id] > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-600 text-[9px] font-bold text-white">
                          {commentCounts.customers[order.customer.id]}
                        </span>
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 px-2">
          <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center space-x-2 w-full sm:w-auto justify-center sm:justify-end">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={onPageChange}
            />
          </div>
        </div>
      )}

      {/* Record Payment Dialog */}
      <RecordPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        order={selectedOrderForPayment}
        onSuccess={() => {
          onRefresh?.();
        }}
      />

      {/* Dialog Components */}
      {
        selectedOrder && (
          <>
            <OrderDetailsDialog
              order={selectedOrder}
              open={orderDetailsOpen}
              onClose={() => setOrderDetailsOpen(false)}
              onCommentAdded={fetchCommentCounts}
            />

            <CustomerDetailsDialog
              customer={selectedOrder?.customer || null}
              open={customerDetailsOpen}
              onClose={() => setCustomerDetailsOpen(false)}
            />

            <StatusHistoryDialog
              order={selectedOrder}
              open={statusHistoryOpen}
              onClose={() => setStatusHistoryOpen(false)}
            />



            <OrderItemsDialog
              order={selectedOrder}
              open={orderItemsOpen}
              onClose={() => setOrderItemsOpen(false)}
            />

            <OrderCommentsDialog
              orderId={selectedOrder?.id || ''}
              orderNumber={selectedOrder?.orderNumber || ''}
              open={orderCommentsOpen}
              onOpenChange={setOrderCommentsOpen}
              onCommentAdded={fetchCommentCounts}
            />

            {selectedOrder.customer && (
              <CustomerCommentsDialog
                customerId={selectedOrder?.customer?.id || ''}
                customerName={`${selectedOrder?.customer?.firstName || ''} ${selectedOrder?.customer?.lastName || ''}`}
                open={customerCommentsOpen}
                onOpenChange={setCustomerCommentsOpen}
                onCommentAdded={fetchCommentCounts}
              />
            )}
          </>
        )
      }

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Orders</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selected.length} selected order{selected.length === 1 ? '' : 's'}?
              This action cannot be undone. Orders that have been delivered or have payments cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete {selected.length} Order{selected.length === 1 ? '' : 's'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Export Confirmation Dialog */}
      <AlertDialog open={exportConfirmOpen} onOpenChange={setExportConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Export</AlertDialogTitle>
            <AlertDialogDescription>
              {exportType === 'all'
                ? `Are you sure you want to export all ${totalOrders} orders? This may take a moment.`
                : `Are you sure you want to export the ${selected.length} selected order(s)?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isExporting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmExport}
              disabled={isExporting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isExporting ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              Export to Excel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div >
  );
}