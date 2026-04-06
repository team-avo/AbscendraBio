"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { api, Order, formatCurrency, formatDate, getStatusColor } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Package, Truck, CreditCard, CalendarDays, Receipt, XCircle, CheckCircle2, Clock, Home, Download } from "lucide-react";
import { API_BASE_URL } from "@/lib/env";
import { getToken } from "@/lib/api-client";
import logger from '@/lib/logger';

export default function AccountOrderDetailsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showTracking, setShowTracking] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const orderId = params?.id as string;


  useEffect(() => {
    const load = async () => {
      if (!user) { setLoading(false); return; }
      try {
        if (user?.customerId) {
          // First try to get orders list
          const res = await api.getCustomerOrders(user.customerId, { page: 1, limit: 100 });
          if (res.success && res.data?.orders) {
            let found = res.data.orders.find(o => o.id === orderId);
            if (found) {
              logger.info('Order found from list:', { data: found });
              logger.info('Billing Address:', { data: found.billingAddress });
              logger.info('Shipping Address:', { data: found.shippingAddress });

              // If addresses are missing but IDs exist, try to fetch them separately
              if ((!found.billingAddress && found.billingAddressId) || (!found.shippingAddress && found.shippingAddressId)) {
                logger.info('Addresses missing, attempting to fetch from customer addresses...');
                try {
                  const customerRes = await api.getCustomer(user.customerId);
                  if (customerRes.success && customerRes.data?.addresses) {
                    const addresses = customerRes.data.addresses;
                    if (found.billingAddressId && !found.billingAddress) {
                      found.billingAddress = addresses.find((a: any) => a.id === found.billingAddressId);
                    }
                    if (found.shippingAddressId && !found.shippingAddress) {
                      found.shippingAddress = addresses.find((a: any) => a.id === found.shippingAddressId);
                    }
                    logger.info('Addresses fetched from customer:', { data: { billingAddress: found.billingAddress, shippingAddress: found.shippingAddress } });
                  }
                } catch (e) {
                  logger.error('Failed to fetch addresses from customer:', { error: e });
                }
              }

              // Fetch shipments separately to ensure they're included
              try {
                logger.info('Fetching shipments for order:', { data: found.id });
                const shipmentsRes = await api.getOrderShipments(found.id);
                logger.info('Shipments response:', { data: shipmentsRes });
                if (shipmentsRes.success) {
                  // Handle both array and object responses
                  const shipmentsData = Array.isArray(shipmentsRes.data)
                    ? shipmentsRes.data
                    : (shipmentsRes.data?.shipments || []);
                  found.shipments = shipmentsData;
                  logger.info('Shipments loaded successfully:', { data: shipmentsData.length, text: 'shipments' });
                } else {
                  logger.warn('Shipments fetch not successful:', { warning: shipmentsRes });
                  found.shipments = [];
                }
              } catch (e) {
                logger.error('Failed to fetch shipments:', { error: e });
                found.shipments = [];
              }
              setOrder(found);
            }
          }
        }
      } finally {
        setLoading(false);
      }
    };
    if (orderId) load();
  }, [orderId, user?.customerId]);

  const totals = useMemo(() => {
    if (!order) return null;
    return {
      subtotal: Number(order.subtotal || 0),
      discount: Number(order.discountAmount || 0),
      shipping: Number(order.shippingAmount || 0),
      tax: Number(order.taxAmount || 0),
      total: Number(order.totalAmount || 0),
    };
  }, [order]);

  const paymentStatus = useMemo(() => {
    const statuses = (order?.payments || []).map((p: any) => String(p?.status || '').toUpperCase()).filter(Boolean);
    if (statuses.length > 0) {
      if (statuses.includes('COMPLETED')) return 'COMPLETED';
      if (statuses.includes('PENDING')) return 'PENDING';
      if (statuses.includes('FAILED')) return 'FAILED';
      return statuses[0];
    }

    const txStatuses = (order?.transactions || []).map((t: any) => String(t?.paymentStatus || '').toUpperCase()).filter(Boolean);
    if (txStatuses.length > 0) {
      if (txStatuses.includes('COMPLETED')) return 'COMPLETED';
      if (txStatuses.includes('PENDING')) return 'PENDING';
      if (txStatuses.includes('FAILED')) return 'FAILED';
      return txStatuses[0];
    }

    return 'PENDING';
  }, [order]);

  const paymentBadgeClass = useMemo(() => {
    switch (paymentStatus) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 border border-green-200';
      case 'FAILED':
        return 'bg-red-100 text-red-800 border border-red-200';
      case 'PENDING':
      default:
        return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
    }
  }, [paymentStatus]);

  const trackingSteps = useMemo(() => {
    const steps: Array<{ key: string; title: string; subtitle: string; icon: React.ReactNode; dotClass: string; completed: boolean; fill?: boolean }> = [];
    const statusToIndex: Record<string, number> = {
      PENDING: 0,
      PROCESSING: 1,
      SHIPPED: 2,
      DELIVERED: 3,
      CANCELLED: 1,
      REFUNDED: 1,
      ON_HOLD: 1,
    };
    const currentIndex = order?.status ? (statusToIndex[order.status] ?? 0) : 0;
    steps.push({
      key: 'placed',
      title: 'Order placed',
      subtitle: order ? formatDate(order.createdAt) : '-',
      icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
      dotClass: 'bg-green-600',
      completed: 0 <= currentIndex,
      fill: currentIndex > 0,
    });
    steps.push({
      key: 'processing',
      title: 'Processing',
      subtitle: order && order.status !== 'PENDING' ? formatDate(order.updatedAt) : 'In queue',
      icon: <Clock className={`h-4 w-4 ${currentIndex >= 1 ? 'text-green-600' : 'text-blue-600'}`} />,
      dotClass: currentIndex >= 1 ? 'bg-green-600' : 'bg-blue-600',
      completed: 1 <= currentIndex,
      fill: currentIndex > 1,
    });
    // Use shippedAt if available, otherwise use order updatedAt if status is SHIPPED, otherwise show "Awaiting shipment"
    let shippedSubtitle = 'Awaiting shipment';
    if (order?.shipments?.[0]?.shippedAt) {
      shippedSubtitle = formatDate(order.shipments[0].shippedAt);
    } else if (order?.status === 'SHIPPED' && order?.updatedAt) {
      shippedSubtitle = formatDate(order.updatedAt);
    }

    steps.push({
      key: 'shipped',
      title: 'Shipped',
      subtitle: shippedSubtitle,
      icon: <Truck className={`h-4 w-4 ${currentIndex >= 2 ? 'text-green-600' : (order?.shipments?.length ? 'text-purple-600' : 'text-muted-foreground')}`} />,
      dotClass: currentIndex >= 2 ? 'bg-green-600' : (order?.shipments?.length ? 'bg-purple-600' : 'bg-muted-foreground'),
      completed: 2 <= currentIndex,
      fill: currentIndex > 2,
    });
    steps.push({
      key: 'delivered',
      title: 'Delivered',
      subtitle: order?.status === 'DELIVERED' ? formatDate(order.updatedAt) : 'Not delivered yet',
      icon: <Home className={`h-4 w-4 ${order?.status === 'DELIVERED' ? 'text-green-700' : 'text-muted-foreground'}`} />,
      dotClass: order?.status === 'DELIVERED' ? 'bg-green-700' : 'bg-muted-foreground',
      completed: 3 <= currentIndex,
    });
    if (order?.status === 'CANCELLED') {
      steps.push({
        key: 'cancelled',
        title: 'Order cancelled',
        subtitle: formatDate(order.updatedAt),
        icon: <XCircle className="h-4 w-4 text-red-600" />,
        dotClass: 'bg-red-600',
        completed: false,
      });
    }
    return steps;
  }, [order]);

  const handleDownloadInvoice = async () => {
    if (!order) return;
    const token = getToken();
    setDownloadingInvoice(true);
    try {
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${API_BASE_URL}/orders/${order.id}/invoice`, {
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

        // Inject @media print CSS for 4×6 label layout into the HTML (matches admin end)
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

        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
        }, 500);
      }
    } catch (error) {
      console.error('Invoice download failed:', error);
      alert('Failed to download invoice. Please try again later.');
    } finally {
      setDownloadingInvoice(false);
    }
  };

  return (
    <div className="force-light min-h-screen bg-background text-foreground">
      <main className="max-w-6xl mx-auto px-4 lg:px-6 py-8">
        {!user ? (
          <div className="flex items-center justify-center min-h-[50vh] text-center">
            <div>
              <h2 className="text-2xl font-bold mb-2">Please sign in to view your order</h2>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" aria-label="Back" onClick={() => router.back()} className="shrink-0">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Order Details</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground">Track your order and view items, payments and shipping.</p>
                </div>
              </div>

            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <CardTitle className="flex items-center gap-2 sm:gap-3 flex-wrap">
                        <Receipt className="h-5 w-5 shrink-0" />
                        <span className="truncate">Order {order?.orderNumber || orderId.slice(0, 8)}</span>
                        {order && (
                          <Badge className={`${getStatusColor(order.status)} shrink-0`}>{order.status}</Badge>
                        )}
                      </CardTitle>
                      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <Button
                          variant="outline"
                          onClick={handleDownloadInvoice}
                          disabled={downloadingInvoice || !order}
                          className="w-full sm:w-auto border-gray-300"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          {downloadingInvoice ? 'Downloading...' : 'Invoice'}
                        </Button>
                        <Button
                          onClick={() => setShowTracking(true)}
                          className="bg-purple-600 hover:bg-purple-700 text-white w-full sm:w-auto"
                        >
                          📦 Track order
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm">
                    {loading ? (
                      <div className="text-muted-foreground">Loading order...</div>
                    ) : !order ? (
                      <div className="text-muted-foreground">Order not found.</div>
                    ) : (
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <div className="text-muted-foreground">Placed on</div>
                          <div className="font-medium flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {formatDate(order.createdAt)}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-muted-foreground">Payment</div>
                          <div className="font-medium flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            {formatCurrency(Number(order.totalAmount))}
                            <Badge className={paymentBadgeClass}>{paymentStatus}</Badge>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-muted-foreground">Items</div>
                          <div className="font-medium flex items-center gap-2"><Package className="h-4 w-4" /> {order._count?.items ?? order.items?.length ?? 0}</div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Home className="h-5 w-5" />
                      Shipping & Billing Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    {!order ? (
                      <div className="text-muted-foreground">Order not found.</div>
                    ) : (
                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Billing Address */}
                        {order?.billingAddress ? (
                          <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="font-semibold text-blue-900">Billing Address</div>
                            <div className="text-gray-700 space-y-2 text-sm">
                              <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-0">
                                <span className="text-muted-foreground w-full sm:w-20 shrink-0 font-medium text-xs sm:text-sm">Name:</span>
                                <span className="font-semibold">{order.billingAddress.firstName} {order.billingAddress.lastName}</span>
                              </div>
                              {order.billingAddress.company && (
                                <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-0">
                                  <span className="text-muted-foreground w-full sm:w-20 shrink-0 font-medium text-xs sm:text-sm">Company:</span>
                                  <span className="font-medium text-blue-800">{order.billingAddress.company}</span>
                                </div>
                              )}
                              <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-0">
                                <span className="text-muted-foreground w-full sm:w-20 shrink-0 font-medium text-xs sm:text-sm">Address:</span>
                                <div className="flex flex-col">
                                  <div>{order.billingAddress.address1}</div>
                                  {order.billingAddress.address2 && <div>{order.billingAddress.address2}</div>}
                                </div>
                              </div>
                              <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-0">
                                <span className="text-muted-foreground w-full sm:w-20 shrink-0 font-medium text-xs sm:text-sm">Location:</span>
                                <div>{order.billingAddress.city}, {order.billingAddress.state} {order.billingAddress.postalCode}</div>
                              </div>
                              <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-0">
                                <span className="text-muted-foreground w-full sm:w-20 shrink-0 font-medium text-xs sm:text-sm">Country:</span>
                                <div>{order.billingAddress.country}</div>
                              </div>
                              {order.billingAddress.phone && (
                                <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-0 pt-1">
                                  <span className="text-muted-foreground w-full sm:w-20 shrink-0 font-medium text-xs sm:text-sm">Phone:</span>
                                  <div className="text-gray-600">📞 {order.billingAddress.phone}</div>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                            <div className="font-semibold text-amber-900">Billing Address</div>
                            <div className="text-amber-700 text-sm space-y-1">
                              <div>Address ID: {order?.billingAddressId || 'Not set'}</div>
                              <div className="text-xs text-amber-600 pt-1">Address data not loaded. Please contact support if this persists.</div>
                            </div>
                          </div>
                        )}

                        {/* Shipping Address */}
                        {order?.shippingAddress ? (
                          <div className="space-y-3 p-4 bg-green-50 rounded-lg border border-green-200">
                            <div className="font-semibold text-green-900">Shipping Address</div>
                            <div className="text-gray-700 space-y-2 text-sm">
                              <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-0">
                                <span className="text-muted-foreground w-full sm:w-20 shrink-0 font-medium text-xs sm:text-sm">Name:</span>
                                <span className="font-semibold">{order.shippingAddress.firstName} {order.shippingAddress.lastName}</span>
                              </div>
                              {order.shippingAddress.company && (
                                <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-0">
                                  <span className="text-muted-foreground w-full sm:w-20 shrink-0 font-medium text-xs sm:text-sm">Company:</span>
                                  <span className="font-medium text-green-800">{order.shippingAddress.company}</span>
                                </div>
                              )}
                              <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-0">
                                <span className="text-muted-foreground w-full sm:w-20 shrink-0 font-medium text-xs sm:text-sm">Address:</span>
                                <div className="flex flex-col">
                                  <div>{order.shippingAddress.address1}</div>
                                  {order.shippingAddress.address2 && <div>{order.shippingAddress.address2}</div>}
                                </div>
                              </div>
                              <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-0">
                                <span className="text-muted-foreground w-full sm:w-20 shrink-0 font-medium text-xs sm:text-sm">Location:</span>
                                <div>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}</div>
                              </div>
                              <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-0">
                                <span className="text-muted-foreground w-full sm:w-20 shrink-0 font-medium text-xs sm:text-sm">Country:</span>
                                <div>{order.shippingAddress.country}</div>
                              </div>
                              {order.shippingAddress.phone && (
                                <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-0 pt-1">
                                  <span className="text-muted-foreground w-full sm:w-20 shrink-0 font-medium text-xs sm:text-sm">Phone:</span>
                                  <div className="text-gray-600">📞 {order.shippingAddress.phone}</div>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                            <div className="font-semibold text-amber-900">Shipping Address</div>
                            <div className="text-amber-700 text-sm space-y-1">
                              <div>Address ID: {order?.shippingAddressId || 'Not set'}</div>
                              <div className="text-xs text-amber-600 pt-1">Address data not loaded. Please contact support if this persists.</div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Items</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="text-sm text-muted-foreground">Loading items...</div>
                    ) : !order?.items?.length ? (
                      <div className="text-sm text-muted-foreground">No items in this order.</div>
                    ) : (
                      <div className="divide-y">
                        {order.items.map((it) => {
                          const imgUrl = it.variant?.product?.images?.[0]?.url || "/placeholder.svg";
                          const hasBulkPrice = !!(it as any).bulkUnitPrice;
                          const displayPrice = hasBulkPrice ? Number((it as any).bulkUnitPrice) : Number(it.unitPrice);
                          const regularPrice = Number(it.unitPrice);
                          const savings = hasBulkPrice ? (regularPrice - displayPrice) * it.quantity : 0;

                          return (
                            <div key={it.id} className="py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                              <div className="flex items-start gap-4 min-w-0">
                                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-md overflow-hidden border bg-white shrink-0">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={imgUrl} alt={it.variant?.product?.name || 'Item image'} className="h-full w-full object-cover" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm sm:text-base line-clamp-2">{it.variant?.product?.name} {it.variant?.name ? `– ${it.variant.name}` : ''}</div>
                                  <div className="text-xs sm:text-sm text-muted-foreground">SKU: {it.variant?.sku}</div>
                                  {hasBulkPrice && (
                                    <div className="mt-1 flex items-center gap-2">
                                      <Badge className="bg-green-100 text-green-700 border-green-300 text-[10px] sm:text-xs">
                                        Bulk Price Applied
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 border-t sm:border-0 pt-2 sm:pt-0">
                                <div className="text-sm text-muted-foreground">Qty: {it.quantity}</div>
                                {hasBulkPrice ? (
                                  <div className="text-right space-y-0.5 sm:space-y-1">
                                    <div className="font-medium text-sm sm:text-base">{formatCurrency(displayPrice)} each</div>
                                    <div className="text-[10px] sm:text-xs text-muted-foreground line-through">{formatCurrency(regularPrice)} each</div>
                                    <div className="text-[10px] sm:text-xs text-green-600 font-medium">Save {formatCurrency(savings)}</div>
                                  </div>
                                ) : (
                                  <div className="font-medium text-sm sm:text-base">{formatCurrency(displayPrice)} each</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Shipping</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    {order && (order.shipments?.length ?? 0) > 0 ? (
                      <div className="space-y-4">
                        {(order.shipments || []).map((s: any) => (
                          <div key={s.id} className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-start gap-3 flex-1">
                              <Truck className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-900">{s.carrier || 'Shipment'}</div>
                                <div className="text-sm text-gray-600 mt-2 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400">Status:</span>
                                    <span className="font-medium">{s.status}</span>
                                  </div>
                                  {s.trackingNumber && (
                                    <div className="flex flex-col gap-1">
                                      <span className="text-xs text-gray-400">Tracking:</span>
                                      <span className="font-mono text-[10px] sm:text-xs bg-white px-2 py-1 rounded border border-gray-300 inline-block w-fit max-w-full truncate">{s.trackingNumber}</span>
                                    </div>
                                  )}
                                </div>
                                {s.trackingUrl && (
                                  <a
                                    href={s.trackingUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 mt-3 px-3 py-1.5 text-xs font-medium bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors w-full sm:w-auto justify-center"
                                  >
                                    🔗 Track Package
                                  </a>
                                )}
                              </div>
                            </div>
                            <div className="sm:text-right flex sm:flex-col justify-between sm:justify-start border-t sm:border-0 pt-2 sm:pt-0">
                              <div className="text-xs text-gray-500">Shipped</div>
                              <div className="font-medium text-gray-900 text-sm">{s.shippedAt ? formatDate(s.shippedAt) : 'Pending'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Truck className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                        <div className="text-muted-foreground">No shipments yet.</div>
                        <div className="text-xs text-gray-400 mt-1">Your order will be shipped soon</div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {totals ? (
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center justify-between"><div className="text-muted-foreground">Subtotal</div><div>{formatCurrency(totals.subtotal)}</div></div>
                        {!!totals.discount && <div className="flex items-center justify-between"><div className="text-muted-foreground">Discount</div><div>-{formatCurrency(totals.discount)}</div></div>}
                        <div className="flex items-center justify-between"><div className="text-muted-foreground">Shipping</div><div>{formatCurrency(totals.shipping)}</div></div>
                        <div className="flex items-center justify-between"><div className="text-muted-foreground">Tax</div><div>{formatCurrency(totals.tax)}</div></div>
                        {(() => {
                          // Detect Authorize.Net credit card fee and show it if present
                          // The fee is 3% of (subtotal - discount + shipping + tax), which is the amount before the fee
                          const amountBeforeFee = Math.round((Number(totals.subtotal) - Number(totals.discount || 0) + Number(totals.shipping) + Number(totals.tax)) * 100) / 100;
                          const calculatedFee = Math.round(amountBeforeFee * 3) / 100;
                          const actualFee = Math.round((Number(totals.total) - amountBeforeFee) * 100) / 100;

                          const hasAuthorizePayment = !!order?.payments?.some((p: any) => {
                            const provider = (p?.provider || '').toString().toLowerCase();
                            return provider === 'authorize.net' || provider === 'authorize-net' || provider === 'authorizenet';
                          });

                          // Show fee if it's an Authorize.Net payment or if the fee matches approximately 3%
                          const isThreePctFee = Math.abs(actualFee - calculatedFee) < 0.05;
                          const showFee = hasAuthorizePayment || isThreePctFee;

                          if (!showFee || actualFee <= 0) return null;
                          return (
                            <div className="flex items-center justify-between">
                              <div className="text-muted-foreground">Credit card fee (3%)</div>
                              <div>{formatCurrency(actualFee)}</div>
                            </div>
                          );
                        })()}
                        <Separator />
                        <div className="flex items-center justify-between font-semibold text-base"><div>Total</div><div>{formatCurrency(totals.total)}</div></div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">Loading totals...</div>
                    )}
                  </CardContent>
                </Card>
                <Button
                  variant="outline"
                  onClick={() => setShowTracking(true)}
                  className="w-full"
                >
                  Track order
                </Button>
                {user?.role === 'CUSTOMER' && order && order.status === 'PENDING' && (
                  <Button variant="destructive" disabled={canceling} onClick={() => setShowCancelConfirm(true)} className="w-full">
                    <XCircle className="h-4 w-4 mr-2" /> Cancel order
                  </Button>
                )}
              </div>
            </div>

            {/* Tracking dialog */}
            <Dialog open={showTracking} onOpenChange={(o) => { setShowTracking(o); }}>
              <DialogContent className="force-light sm:max-w-2xl bg-background text-foreground">
                <DialogHeader>
                  <DialogTitle>Order tracking</DialogTitle>
                  <DialogDescription>Follow the journey of your order.</DialogDescription>
                </DialogHeader>
                <div className="mt-2">
                  {/* Animated continuous rail under icons */}
                  <div className="space-y-4">
                    {trackingSteps.map((s, idx) => {
                      const showRail = idx < trackingSteps.length - 1;
                      const railColor = s.completed ? 'bg-green-500' : 'bg-muted';
                      const railActive = s.fill;
                      return (
                        <div key={s.key} className="flex gap-4 items-start">
                          <div className="w-6 flex flex-col items-center">
                            <div className={`h-2.5 w-2.5 rounded-full ${s.dotClass} ring-2 ring-background`} />
                            {showRail && (
                              <div className={`relative mt-2 h-10 w-1 overflow-hidden rounded-full ${railColor}`}>
                                {/* animated fill */}
                                <div className={`absolute left-0 top-0 h-full w-full ${railActive ? 'animate-[railFill_1.2s_ease-in-out_infinite]' : ''} bg-green-500`} style={{ transformOrigin: 'left center', clipPath: railActive ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)' }} />
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium flex items-center gap-2">{s.icon} {s.title}</div>
                            <div className="text-sm text-muted-foreground">{s.subtitle}</div>
                            {s.key === 'shipped' && order && (order.shipments?.length ?? 0) > 0 && (
                              <div className="space-y-2 mt-2">
                                {(order.shipments || []).map((shipment: any, idx: number) => (
                                  <div key={idx} className="space-y-1">
                                    <div className="text-xs text-muted-foreground">
                                      {shipment.carrier && <span className="font-medium">{shipment.carrier}</span>}
                                      {shipment.trackingNumber && <span> • Tracking #: {shipment.trackingNumber}</span>}
                                    </div>
                                    {shipment.trackingUrl && (
                                      <a
                                        href={shipment.trackingUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                                      >
                                        🔗 Track Package
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </DialogContent>
            </Dialog>



            {/* Cancel confirmation dialog */}
            <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
              <DialogContent className="force-light sm:max-w-md bg-background text-foreground">
                <DialogHeader>
                  <DialogTitle>Cancel this order?</DialogTitle>
                  <DialogDescription>This action cannot be undone. We will attempt to halt processing immediately.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCancelConfirm(false)}>Keep order</Button>
                  <Button variant="destructive" disabled={canceling} onClick={async () => {
                    if (!order) return;
                    try {
                      setCanceling(true);
                      const res = await api.cancelOwnOrder(order.id);
                      if (res.success) {
                        setOrder({ ...order, status: 'CANCELLED' });
                        setShowCancelConfirm(false);
                      }
                    } finally {
                      setCanceling(false);
                    }
                  }}>{canceling ? 'Cancelling...' : 'Confirm cancel'}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </main>
    </div>
  );
}


