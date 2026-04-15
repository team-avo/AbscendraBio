"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, ProtectedRoute } from "@/contexts/auth-context";
import { api, Order, formatCurrency, formatDate } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Package, CreditCard, CalendarDays, Download } from "lucide-react";
import { API_BASE_URL } from "@/lib/env";
import { getToken } from "@/lib/api-client";

export default function AccountOrdersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [status, setStatus] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalOrders, setTotalOrders] = useState<number>(0);
  const [counts, setCounts] = useState({ ALL: 0, ACTIVE: 0, DELIVERED: 0, CANCELLED: 0 });
  const [downloadingOrderId, setDownloadingOrderId] = useState<string | null>(null);
  const activeStatuses = ["PENDING", "PROCESSING", "SHIPPED"] as const;

  const getOrderPaymentStatus = (o: any) => {
    const statuses = (o?.payments || []).map((p: any) => String(p?.status || '').toUpperCase()).filter(Boolean);
    if (statuses.length > 0) {
      if (statuses.includes('COMPLETED')) return 'COMPLETED';
      if (statuses.includes('PENDING')) return 'PENDING';
      if (statuses.includes('FAILED')) return 'FAILED';
      return statuses[0];
    }

    const txStatuses = (o?.transactions || []).map((t: any) => String(t?.paymentStatus || '').toUpperCase()).filter(Boolean);
    if (txStatuses.length > 0) {
      if (txStatuses.includes('COMPLETED')) return 'COMPLETED';
      if (txStatuses.includes('PENDING')) return 'PENDING';
      if (txStatuses.includes('FAILED')) return 'FAILED';
      return txStatuses[0];
    }

    return 'PENDING';
  };

  const getPaymentStatusBadgeClass = (s: string) => {
    switch (String(s || '').toUpperCase()) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 border border-green-200';
      case 'FAILED':
        return 'bg-red-100 text-red-800 border border-red-200';
      case 'PENDING':
      default:
        return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
    }
  };

  const load = async () => {
    try {
      if (!user?.customerId) {
        setLoading(false);
        return;
      }
      setLoading(true);

      const params = {
        page: currentPage,
        limit: 20,
        search: search.trim() || undefined,
        status: status !== "ALL" ? status : undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
      };

      const [res, statsRes] = await Promise.all([
        api.getCustomerOrders(user.customerId, params),
        api.getCustomerOrdersStats(user.customerId)
      ]);

      if (res.success && res.data) {
        setOrders(res.data.orders);
        setTotalPages(res.data.pagination.pages);
        setTotalOrders(res.data.pagination.total);
      }

      if (statsRes.success && statsRes.data) {
        setCounts(statsRes.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = async (orderId: string) => {
    const token = getToken();
    setDownloadingOrderId(orderId);
    try {
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${API_BASE_URL}/orders/${orderId}/invoice`, {
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch invoice');
      }

      const html = await response.text();
      const printWindow = window.open('', '_blank', 'width=400,height=600');
      if (printWindow) {
        // Clean unsupported CSS color functions (matches admin end)
        let cleanHtml = html;
        cleanHtml = cleanHtml.replace(/(?:oklch|oklab|lab|lch|hwb)\s*\([^)]*\)/gi, '#000000');
        cleanHtml = cleanHtml.replace(/--[a-zA-Z0-9-]+:\s*(?:oklch|oklab|lab|lch|hwb)\s*\([^;]+\);/gi, '');

        // Inject @media print CSS for 4×6 label layout into the HTML
        const printCSS = `
          <style>
            @media print {
              @page {
                size: 4in 6in;
                margin: 0;
              }
              html, body {
                width: 100%;
                margin: 0;
                padding: 1mm;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
            }
          </style>
        `;

        if (cleanHtml.includes('</head>')) {
          cleanHtml = cleanHtml.replace('</head>', printCSS + '</head>');
        } else {
          cleanHtml = printCSS + cleanHtml;
        }

        printWindow.document.write(cleanHtml);
        printWindow.document.close();

        // Wait for images/resources to load before printing
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
        }, 500);
      }
    } catch (error) {
      console.error('Invoice download failed:', error);
      alert('Failed to download invoice. Please try again later.');
    } finally {
      setDownloadingOrderId(null);
    }
  };

  useEffect(() => {
    load();
  }, [user?.customerId, currentPage, status, dateFrom, dateTo]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      // If search query changes, we only need to reload if we aren't already loading 
      // or if current page is not 1 (which would trigger the other useEffect)
      if (currentPage !== 1) {
        setCurrentPage(1);
      } else {
        load();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <ProtectedRoute requiredRoles={["CUSTOMER"]}>
      <div className="space-y-6">
        {!user ? (
          <div className="flex items-center justify-center min-h-[50vh] text-center">
            <div>
              <h2 className="text-2xl font-bold mb-2">Please sign in to view your orders</h2>
              <p className="text-muted-foreground mb-4">You need a customer account to access this page.</p>
              <a href="/login" className="inline-flex items-center rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium">Go to Login</a>
            </div>
          </div>
        ) : user.role !== 'CUSTOMER' ? (
          <div className="flex items-center justify-center min-h-[50vh] text-center">
            <div>
              <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
              <p className="text-muted-foreground">This page is available to customer accounts only.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Dark Hero Strip */}
            <div className="relative bg-[#070B14] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
              {/* Grid texture */}
              <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
              {/* Blue glow */}
              <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#4D7DF2]/8 rounded-full blur-[100px] pointer-events-none" />
              <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-black text-white tracking-tight">MY ORDERS</h1>
                    <p className="text-xs text-white/40 mt-1">Track and manage your orders</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href="/account" className="inline-flex items-center gap-1.5 bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-2 text-xs font-medium text-white/70 hover:bg-white/[0.10] hover:text-white transition-all">
                      ← Back to Account
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick status filters */}
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: "ALL", label: "All" },
                  { key: "ACTIVE", label: "Active" },
                  { key: "DELIVERED", label: "Delivered" },
                  { key: "CANCELLED", label: "Cancelled" },
                ] as const
              ).map((tab) => {
                const isActive = (status === tab.key);
                const count = (counts as any)[tab.key] || 0;
                return (
                  <button
                    key={tab.key}
                    onClick={() => { setStatus(tab.key); setCurrentPage(1); }}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-all ${isActive ? 'bg-[#1B2D4F] text-white border-[#1B2D4F]' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'}`}
                  >
                    <span>{tab.label}</span>
                    <span className={`inline-flex items-center justify-center text-xs px-2 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'}`}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Input
                  placeholder="Search by order #"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={status} onValueChange={(val) => { setStatus(val); setCurrentPage(1); }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="force-light">
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="PROCESSING">Processing</SelectItem>
                  <SelectItem value="SHIPPED">Shipped</SelectItem>
                  <SelectItem value="DELIVERED">Delivered</SelectItem>
                  <SelectItem value="ON_HOLD">On Hold</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  <SelectItem value="REFUNDED">Refunded</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }} placeholder="From" />
              <div className="flex gap-2">
                <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }} placeholder="To" />
                <Button variant="outline" className="shrink-0 border-gray-300" onClick={() => { setSearch(""); setStatus("ALL"); setDateFrom(""); setDateTo(""); setCurrentPage(1); }}>Clear</Button>
              </div>
            </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6">
              <p className="text-sm font-semibold text-gray-900 mb-4">Orders History</p>
              <div>
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-xl" />
                    ))}
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                    <h3 className="text-lg font-medium text-gray-900">No orders found</h3>
                    <p className="text-sm text-muted-foreground">Adjust your filters or start shopping.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:gap-6">
                    {orders.map((o) => (
                      <div key={o.id} className="rounded-xl border border-gray-200 bg-white text-card-foreground hover:shadow-lg transition-shadow">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="text-xs uppercase text-muted-foreground">Order</div>
                              <div className="font-semibold">{o.orderNumber}</div>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${o.status === 'DELIVERED' ? 'bg-green-100 text-green-800'
                                : o.status === 'SHIPPED' ? 'bg-purple-100 text-purple-800'
                                  : o.status === 'PROCESSING' ? 'bg-blue-100 text-blue-800'
                                    : o.status === 'CANCELLED' ? 'bg-red-100 text-red-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                {o.status}
                              </span>
                            </div>
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2"><Package className="h-4 w-4" /> {(o._count?.items ?? o.items?.length ?? 0)} items</div>
                              <div className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4" />
                                {formatCurrency(Number(o.totalAmount))}
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getPaymentStatusBadgeClass(getOrderPaymentStatus(o))}`}>
                                  {getOrderPaymentStatus(o)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {formatDate(o.createdAt)}</div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-gray-300"
                              onClick={() => handleDownloadInvoice(o.id)}
                              disabled={downloadingOrderId === o.id}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              {downloadingOrderId === o.id ? 'Downloading...' : 'Invoice'}
                            </Button>
                            <Button variant="outline" size="sm" className="border-gray-300" onClick={() => router.push(`/account/orders/${o.id}`)}>
                              View details
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pagination Controls */}
                {!loading && totalPages > 1 && (
                  <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-6">
                    <p className="text-sm text-muted-foreground">
                      Showing {(currentPage - 1) * 20 + 1} to {Math.min(currentPage * 20, totalOrders)} of {totalOrders} orders
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      >
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                          .map((p, i, arr) => {
                            const showEllipsis = i > 0 && p - arr[i - 1] > 1;
                            return (
                              <div key={p} className="flex items-center gap-1">
                                {showEllipsis && <span className="text-muted-foreground">...</span>}
                                <Button
                                  variant={currentPage === p ? "default" : "outline"}
                                  size="sm"
                                  className="w-8 h-8 p-0"
                                  onClick={() => setCurrentPage(p)}
                                >
                                  {p}
                                </Button>
                              </div>
                            );
                          })
                        }
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}


