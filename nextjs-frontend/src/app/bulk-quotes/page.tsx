"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProtectedRoute } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, type BulkQuote, resolveImageUrl } from "@/lib/api";
import logger from "@/lib/logger";
import { toast } from "sonner";
import {
  Search,
  Eye,
  CheckCircle,
  XCircle,
  Trash2,
  Mail,
  Calendar,
  Package,
  User,
  MoreHorizontal,
  Phone,
  Building,
  FileText,
} from "lucide-react";
import { formatDate } from "@/lib/api";

export default function BulkQuotesPage() {
  const [bulkQuotes, setBulkQuotes] = useState<BulkQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "read" | "unread">("all");
  const [selectedQuote, setSelectedQuote] = useState<BulkQuote | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });

  const loadBulkQuotes = async (page = 1, search = "", status = "all") => {
    setLoading(true);
    try {
      const params: any = {
        page,
        limit: 20,
      };

      if (search) params.search = search;
      if (status !== "all") params.isRead = status === "read";

      logger.debug("Loading bulk quotes with params:", { params });
      const response = await api.getBulkQuotes(params);
      logger.debug("Bulk quotes response:", { response });

      if (response.success && response.data) {
        setBulkQuotes(response.data.data || []);
        setPagination(response.data.pagination);
      } else if (response.data || (response as any).data) {
        // Handle direct response structure
        setBulkQuotes((response as any).data || []);
        setPagination((response as any).pagination || { page: 1, limit: 20, total: 0, pages: 0 });
      } else {
        logger.error("Failed to load bulk quotes:", { error: response.error });
        toast.error(response.error || "Failed to load bulk quotes");
      }
    } catch (error) {
      logger.error("Error loading bulk quotes:", { error });
      toast.error("Failed to load bulk quotes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBulkQuotes(1, searchTerm, statusFilter);
  }, []);

  const handleSearch = () => {
    loadBulkQuotes(1, searchTerm, statusFilter);
  };

  const handleStatusFilter = (status: "all" | "read" | "unread") => {
    setStatusFilter(status);
    loadBulkQuotes(1, searchTerm, status);
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      logger.debug("Marking bulk quote as read:", { id });
      const response = await api.markBulkQuoteAsRead(id);
      logger.debug("Mark as read response:", { response });

      if (response.success || response.data || (response as any).id) {
        toast.success("Marked as read");
        loadBulkQuotes(pagination.page, searchTerm, statusFilter);
      } else {
        toast.error("Failed to mark as read");
      }
    } catch (error) {
      logger.error("Error marking as read:", { error });
      toast.error("Failed to mark as read");
    }
  };

  const handleMarkAsUnread = async (id: string) => {
    try {
      logger.debug("Marking bulk quote as unread:", { id });
      const response = await api.markBulkQuoteAsUnread(id);
      logger.debug("Mark as unread response:", { response });

      if (response.success || response.data || (response as any).id) {
        toast.success("Marked as unread");
        loadBulkQuotes(pagination.page, searchTerm, statusFilter);
      } else {
        toast.error("Failed to mark as unread");
      }
    } catch (error) {
      logger.error("Error marking as unread:", { error });
      toast.error("Failed to mark as unread");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await api.deleteBulkQuote(id);
      if ((response as any).success === false) {
        toast.error("Failed to delete bulk quote");
      } else {
        toast.success("Bulk quote deleted");
        // Optimistically update UI
        setBulkQuotes((prev) => prev.filter((q) => q.id !== id));
        setPagination((prev) => ({ ...prev, total: Math.max(0, (prev.total || 1) - 1) }));
      }
    } catch (error) {
      logger.error("Error deleting bulk quote:", { error });
      toast.error("Failed to delete bulk quote");
    }
  };

  const handleViewDetails = async (id: string) => {
    try {
      const response = await api.getBulkQuote(id);
      logger.debug("Bulk quote details response:", { response });

      if (response.success && response.data) {
        setSelectedQuote(response.data);
        setDetailsOpen(true);
      } else if (response.data || (response as any).id) {
        // Handle direct response structure
        setSelectedQuote((response as any));
        setDetailsOpen(true);
      } else {
        // Try to find the quote in the current list
        const existingQuote = bulkQuotes.find(q => q.id === id);
        if (existingQuote) {
          setSelectedQuote(existingQuote);
          setDetailsOpen(true);
        } else {
          toast.error("Failed to load bulk quote details");
        }
      }
    } catch (error) {
      logger.error("Error loading bulk quote details:", { error });
      // Try to find the quote in the current list as fallback
      const existingQuote = bulkQuotes.find(q => q.id === id);
      if (existingQuote) {
        setSelectedQuote(existingQuote);
        setDetailsOpen(true);
      } else {
        toast.error("Failed to load bulk quote details");
      }
    }
  };

  const getStatusBadge = (isRead: boolean) => {
    return isRead ? (
      <Badge variant="secondary" className="bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3 mr-1" />
        Read
      </Badge>
    ) : (
      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
        <XCircle className="w-3 h-3 mr-1" />
        Unread
      </Badge>
    );
  };

  const statusPills: { label: string; value: "all" | "read" | "unread" }[] = [
    { label: "All", value: "all" },
    { label: "Unread", value: "unread" },
    { label: "Read", value: "read" },
  ];

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-2 sm:p-4 lg:p-6 space-y-4 sm:space-y-5">

          {/* Dark Hero Strip */}
          <div
            className="relative bg-[#070B14] rounded-2xl mx-1 sm:mx-0 overflow-hidden"
            style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }}
          >
            {/* Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[200px] bg-[#4D7DF2]/8 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative px-5 py-5 sm:px-7 sm:py-6 space-y-4">
              {/* Top row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Bulk Quote Requests</h1>
                  <p className="text-sm text-blue-200/70 mt-0.5">Review and respond to bulk pricing inquiries</p>
                </div>
                <div className="flex items-center gap-3">
                  {/* Stat chip */}
                  <div className="flex items-center gap-2 bg-white/10 border border-white/15 rounded-xl px-3 py-1.5">
                    <FileText className="h-4 w-4 text-blue-400" />
                    <span className="text-white font-semibold text-sm">{pagination.total}</span>
                    <span className="text-blue-200/70 text-xs">requests</span>
                  </div>
                </div>
              </div>

              {/* Status pills */}
              <div className="flex flex-wrap gap-2">
                {statusPills.map((pill) => (
                  <button
                    key={pill.value}
                    onClick={() => handleStatusFilter(pill.value)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                      statusFilter === pill.value
                        ? "bg-blue-500 text-white"
                        : "bg-white/10 text-blue-100 hover:bg-white/20"
                    )}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Compact filter row */}
          <div className="flex flex-col sm:flex-row gap-3 mx-1 sm:mx-0">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by customer name, email, or product..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-sm"
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} size="sm" className="h-9 px-4 text-sm">
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </div>

          {/* Results table */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden mx-1 sm:mx-0">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : bulkQuotes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No bulk quote requests found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkQuotes.map((quote) => (
                      <TableRow key={quote.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">
                              {quote.customer?.firstName} {quote.customer?.lastName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {quote.customer?.email}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {quote.customer?.mobile}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            {quote.product?.images?.[0] && (
                              <img
                                src={resolveImageUrl(quote.product.images[0].url)}
                                alt={quote.product.name}
                                className="w-12 h-12 rounded-md object-cover"
                              />
                            )}
                            <div>
                              <div className="font-medium">{quote.product?.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {quote.customer?.customerType === 'B2C' || quote.customer?.customerType === 'B2B'
                                  ? 'Wholesale'
                                  : quote.customer?.customerType === 'ENTERPRISE_1' || quote.customer?.customerType === 'ENTERPRISE_2'
                                    ? 'Enterprise'
                                    : quote.customer?.customerType}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Package className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{quote.quantity}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(quote.isRead)}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">
                              {formatDate(quote.createdAt)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewDetails(quote.id)}>
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              {quote.isRead ? (
                                <DropdownMenuItem onClick={() => handleMarkAsUnread(quote.id)}>
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Mark as Unread
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => handleViewDetails(quote.id)}>
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Mark as Read
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => { setPendingDeleteId(quote.id); setConfirmOpen(true); }}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                <div className="text-sm text-muted-foreground">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{" "}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                  {pagination.total} results
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadBulkQuotes(pagination.page - 1, searchTerm, statusFilter)}
                    disabled={pagination.page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadBulkQuotes(pagination.page + 1, searchTerm, statusFilter)}
                    disabled={pagination.page === pagination.pages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Details Dialog */}
          <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
            <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Bulk Quote Request Details</DialogTitle>
                <DialogDescription>
                  Customer details and request information
                </DialogDescription>
              </DialogHeader>

              {selectedQuote && (
                <div className="space-y-6">
                  {/* Customer Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center">
                      <User className="w-5 h-5 mr-2" />
                      Customer Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Name</label>
                        <p className="text-sm">
                          {selectedQuote.customer?.firstName} {selectedQuote.customer?.lastName}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Email</label>
                        <p className="text-sm flex items-center">
                          <Mail className="w-4 h-4 mr-1" />
                          {selectedQuote.customer?.email}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Phone</label>
                        <p className="text-sm flex items-center">
                          <Phone className="w-4 h-4 mr-1" />
                          {selectedQuote.customer?.mobile}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Customer Type</label>
                        <p className="text-sm flex items-center">
                          <Building className="w-4 h-4 mr-1" />
                          {selectedQuote.customer?.customerType === 'B2C' || selectedQuote.customer?.customerType === 'B2B'
                            ? 'Wholesale'
                            : selectedQuote.customer?.customerType === 'ENTERPRISE_1' || selectedQuote.customer?.customerType === 'ENTERPRISE_2'
                              ? 'Enterprise'
                              : selectedQuote.customer?.customerType}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Product Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center">
                      <Package className="w-5 h-5 mr-2" />
                      Product Information
                    </h3>
                    <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                      {selectedQuote.product?.images?.[0] && (
                        <img
                          src={resolveImageUrl(selectedQuote.product.images[0].url)}
                          alt={selectedQuote.product.name}
                          className="w-20 h-20 rounded-md object-cover"
                        />
                      )}
                      <div>
                        <h4 className="font-medium">{selectedQuote.product?.name}</h4>
                        <p className="text-sm text-gray-600">Quantity: {selectedQuote.quantity}</p>
                      </div>
                    </div>
                  </div>

                  {/* Request Details */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Request Details</h3>
                    <div className="space-y-2">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Quantity Requested</label>
                        <p className="text-sm">{selectedQuote.quantity} pieces</p>
                      </div>
                      {selectedQuote.notes && (
                        <div>
                          <label className="text-sm font-medium text-gray-600">Additional Notes</label>
                          <p className="text-sm p-3 bg-gray-50 rounded-md">{selectedQuote.notes}</p>
                        </div>
                      )}
                      <div>
                        <label className="text-sm font-medium text-gray-600">Requested On</label>
                        <p className="text-sm">{formatDate(selectedQuote.createdAt)}</p>
                      </div>
                      {selectedQuote.isRead && selectedQuote.reader && (
                        <div>
                          <label className="text-sm font-medium text-gray-600">Read By</label>
                          <p className="text-sm">
                            {selectedQuote.reader.firstName} {selectedQuote.reader.lastName}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end space-x-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => setDetailsOpen(false)}
                    >
                      Close
                    </Button>
                    {selectedQuote.isRead ? (
                      <Button
                        variant="outline"
                        onClick={() => {
                          handleMarkAsUnread(selectedQuote.id);
                          setDetailsOpen(false);
                        }}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Mark as Unread
                      </Button>
                    ) : (
                      <Button
                        onClick={() => {
                          handleMarkAsRead(selectedQuote.id);
                          setDetailsOpen(false);
                        }}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Mark as Read
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Confirm Delete Dialog */}
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Delete bulk quote?</DialogTitle>
                <DialogDescription>
                  This action cannot be undone. This will permanently delete the bulk quote request.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setConfirmOpen(false); setPendingDeleteId(null); }}>Cancel</Button>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    const id = pendingDeleteId;
                    setConfirmOpen(false);
                    setPendingDeleteId(null);
                    if (id) {
                      await handleDelete(id);
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
