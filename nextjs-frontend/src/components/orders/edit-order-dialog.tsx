'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Package, CreditCard, FileText, Truck, Tag, ChevronDown, Copy, Download, Check, Trash2, Loader2, MessageSquare } from 'lucide-react';
import { api, Order } from '@/lib/api';
import { getToken } from '@/lib/api';
import { API_BASE_URL } from '@/lib/env';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Dialog as UIDialog, DialogContent as UIDialogContent, DialogHeader as UIDialogHeader, DialogTitle as UIDialogTitle } from '@/components/ui/dialog';
import { RecordPaymentDialog } from './record-payment-dialog';
import { CommentSection } from '../comments/comment-section';
import logger from '@/lib/logger';

interface EditOrderDialogProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onDelete?: (orderId: string) => void;
  onCommentAdded?: () => void;
}

export function EditOrderDialog({ order, open, onOpenChange, onSuccess, onDelete, onCommentAdded }: EditOrderDialogProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [shippingAmount, setShippingAmount] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundReason, setRefundReason] = useState('');
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundError, setRefundError] = useState('');
  const [refundStatusLoading, setRefundStatusLoading] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [downloadingPackingSlip, setDownloadingPackingSlip] = useState(false);
  const [showOrderDeleteConfirm, setShowOrderDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingTransactionId, setUpdatingTransactionId] = useState<string | null>(null);

  // Shipping state
  const [shipments, setShipments] = useState<any[]>([]);
  const [shipmentsLoading, setShipmentsLoading] = useState(false);
  const [showCreateShipment, setShowCreateShipment] = useState(false);
  const [shipmentCreating, setShipmentCreating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [shipmentToDelete, setShipmentToDelete] = useState<string | null>(null);
  const [deletingShipment, setDeletingShipment] = useState(false);
  const [newShipment, setNewShipment] = useState({
    carrier: '',
    trackingNumber: '',
    trackingUrl: '',
    status: 'SHIPPED'
  });

  // Labels state
  const [carriers, setCarriers] = useState<any[]>([]);
  const [carriersLoading, setCarriersLoading] = useState(false);
  const [selectedCarrier, setSelectedCarrier] = useState('');
  const [carrierServices, setCarrierServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState('');
  const [labelCreating, setLabelCreating] = useState(false);
  const [labelResponse, setLabelResponse] = useState<any>(null);
  const [labelError, setLabelError] = useState('');
  const [labelRefreshing, setLabelRefreshing] = useState(false);
  const [labelLayout, setLabelLayout] = useState('4x6');
  const [labelFormat, setLabelFormat] = useState('pdf');
  const [trackingRefreshing, setTrackingRefreshing] = useState(false);

  useEffect(() => {
    if (order) {
      setStatus(order.status);
      setDiscountAmount(order.discountAmount);
      setShippingAmount(order.shippingAmount);
      setTaxAmount(order.taxAmount);
      setNotes('');
      // Reset carrier and service selections for new order
      setSelectedCarrier('');
      setSelectedService('');
      setCarrierServices([]);
      // Clear label-related errors and state
      setLabelError('');
      setLabelRefreshing(false);
      fetchShipments();
      fetchTransactions();
      fetchCarriers();

      // Load saved label if it exists
      if (order.shipstationLabel) {
        setLabelResponse(order.shipstationLabel);
      } else {
        setLabelResponse(null);
      }
    }
  }, [order]);

  const handleCopyOrderId = async () => {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(order.orderNumber);
      setCopied(true);
      toast.success('Order number copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy order number');
    }
  };

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
        toast.error('Failed to fetch invoice');
        setDownloadingInvoice(false);
        return;
      }

      const html = await response.text();

      // Open a new window for native browser print (vector text, infinitely sharp)
      const printWindow = window.open('', '_blank', 'width=400,height=600');
      if (!printWindow) {
        toast.error('Please allow popups to print the invoice');
        setDownloadingInvoice(false);
        return;
      }

      // Clean unsupported CSS color functions
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

      // Insert print CSS before closing </head> or at the beginning
      if (cleanHtml.includes('</head>')) {
        cleanHtml = cleanHtml.replace('</head>', printCSS + '</head>');
      } else {
        cleanHtml = printCSS + cleanHtml;
      }

      printWindow.document.open();
      printWindow.document.write(cleanHtml);
      printWindow.document.close();

      // Wait for content to load, then trigger print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          // Close the window after print dialog is dismissed
          printWindow.onafterprint = () => {
            printWindow.close();
          };
          // Fallback: close after a delay if onafterprint is not supported
          setTimeout(() => {
            if (!printWindow.closed) {
              printWindow.close();
            }
          }, 60000);
          setDownloadingInvoice(false);
        }, 300);
      };

      // Fallback if onload doesn't fire
      setTimeout(() => {
        if (!printWindow.closed) {
          printWindow.print();
          setTimeout(() => {
            if (!printWindow.closed) {
              printWindow.close();
            }
          }, 60000);
        }
        setDownloadingInvoice(false);
      }, 2000);

    } catch (error) {
      logger.error('Error downloading invoice:', { error: error });
      toast.error('Failed to download invoice');
      setDownloadingInvoice(false);
    }
  };

  const handleDownloadPackingSlip = async () => {
    if (!order) return;
    const token = getToken();

    setDownloadingPackingSlip(true);
    try {
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(`${API_BASE_URL}/orders/${order.id}/packing-slip`, {
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        toast.error('Failed to fetch packing slip');
        setDownloadingPackingSlip(false);
        return;
      }

      const html = await response.text();

      // Open a new window for native browser print (vector text, infinitely sharp)
      const printWindow = window.open('', '_blank', 'width=400,height=600');
      if (!printWindow) {
        toast.error('Please allow popups to print the packing slip');
        setDownloadingPackingSlip(false);
        return;
      }

      // Clean unsupported CSS color functions
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

      // Insert print CSS before closing </head> or at the beginning
      if (cleanHtml.includes('</head>')) {
        cleanHtml = cleanHtml.replace('</head>', printCSS + '</head>');
      } else {
        cleanHtml = printCSS + cleanHtml;
      }

      printWindow.document.open();
      printWindow.document.write(cleanHtml);
      printWindow.document.close();

      // Wait for content to load, then trigger print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          // Close the window after print dialog is dismissed
          printWindow.onafterprint = () => {
            printWindow.close();
          };
          // Fallback: close after a delay if onafterprint is not supported
          setTimeout(() => {
            if (!printWindow.closed) {
              printWindow.close();
            }
          }, 60000);
          setDownloadingPackingSlip(false);
        }, 300);
      };

      // Fallback if onload doesn't fire
      setTimeout(() => {
        if (!printWindow.closed) {
          printWindow.print();
          setTimeout(() => {
            if (!printWindow.closed) {
              printWindow.close();
            }
          }, 60000);
        }
        setDownloadingPackingSlip(false);
      }, 2000);

    } catch (error) {
      logger.error('Error downloading packing slip:', { error: error });
      toast.error('Failed to download packing slip');
      setDownloadingPackingSlip(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!order) return;

    setDeleting(true);
    try {
      const response = await api.hardDeleteOrder(order.id);
      if (response.success) {
        toast.success('Order deleted successfully');
        setShowOrderDeleteConfirm(false);
        onOpenChange(false);
        if (onDelete) {
          onDelete(order.id);
        }
        onSuccess();
      } else {
        toast.error(response.error || 'Failed to delete order');
      }
    } catch (error) {
      logger.error('Error deleting order:', { error: error });
      toast.error('Failed to delete order');
    } finally {
      setDeleting(false);
    }
  };

  const fetchTransactions = async () => {
    if (!order) return;
    try {
      const response = await api.getTransactions({ orderId: order.id });
      if (response.success && response.data) {
        const data = response.data as any;
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      logger.error('Failed to fetch transactions:', { error: error });
    }
  };

  const handleMarkAsPaid = async (transactionId: string) => {
    try {
      setUpdatingTransactionId(transactionId);
      const response = await api.updateTransaction(transactionId, { paymentStatus: 'COMPLETED' });

      if (response.success) {
        toast.success('Payment marked as COMPLETED');
        // Refresh the whole order to get updated status (e.g. PROCESSING, paymentStatus: PAID)
        if (order) {
          try {
            const reFetchedOrder = await api.getOrder(order.id);
            if (reFetchedOrder.success && reFetchedOrder.data) {
              // We need to trigger the parent success to update the table, 
              // but we can also update local state if needed.
              // Actually, since this is a dialog, we should probably call onSuccess and maybe fetchTransactions
              onSuccess();
              fetchTransactions();
              // Update local status if it changed to PROCESSING
              if (reFetchedOrder.data.status) {
                setStatus(reFetchedOrder.data.status);
              }
            }
          } catch (e) {
            logger.error('Failed to refetch order:', { error: e });
            onSuccess();
          }
        }
      } else {
        toast.error(response.error || 'Failed to update payment status');
      }
    } catch (error) {
      logger.error('Error updating transaction:', { error: error });
      toast.error('Failed to update payment status');
    } finally {
      setUpdatingTransactionId(null);
    }
  };

  const fetchShipments = async () => {
    if (!order) return;

    setShipmentsLoading(true);
    try {
      const response = await api.getOrderShipments(order.id);
      if (response.success) {
        setShipments(response.data || []);
      }
    } catch (error) {
      logger.error('Failed to fetch shipments:', { error: error });
    } finally {
      setShipmentsLoading(false);
    }
  };

  const fetchCarriers = async () => {
    setCarriersLoading(true);
    try {
      const response = await api.getShipStationCarriers();
      if (response.success) {
        const carrierList = Array.isArray(response.data) ? response.data : (response.data as any)?.carriers || [];
        logger.info('Fetched carriers:', { data: carrierList });
        setCarriers(carrierList);
      }
    } catch (error) {
      logger.error('Failed to fetch carriers:', { error: error });
      toast.error('Failed to fetch carriers');
    } finally {
      setCarriersLoading(false);
    }
  };

  const fetchCarrierServices = async (carrierId: string) => {
    try {
      const response = await api.getShipStationCarrierServices(carrierId);
      if (response.success) {
        const serviceList = Array.isArray(response.data) ? response.data : (response.data as any)?.services || [];
        setCarrierServices(serviceList);
      }
    } catch (error) {
      logger.error('Failed to fetch carrier services:', { error: error });
      toast.error('Failed to fetch carrier services');
    }
  };

  const handleCreateLabel = async () => {
    if (!order || !selectedCarrier || !selectedService) {
      toast.error('Please select both carrier and service');
      return;
    }

    setLabelCreating(true);
    setLabelError('');
    setLabelResponse(null);

    try {
      // Fetch store information
      const storeResponse = await api.get('/store-information');
      const storeInfo = storeResponse.data || {};

      // Map country name to country code
      const countryCodeMap: { [key: string]: string } = {
        'United States': 'US',
        'US': 'US',
        'Canada': 'CA',
        'Mexico': 'MX',
        'United Kingdom': 'GB',
        'Australia': 'AU',
        'Germany': 'DE',
        'France': 'FR',
        'Japan': 'JP',
        'China': 'CN',
        'India': 'IN',
      };

      // Map US state names to 2-letter codes
      const stateCodeMap: { [key: string]: string } = {
        'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
        'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
        'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
        'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
        'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
        'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
        'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
        'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
        'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
        'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
      };

      const countryCode = countryCodeMap[order.shippingAddress?.country || 'US'] || 'US';

      // Convert state name to 2-letter code if needed
      let shipToState = order.shippingAddress?.state || '';
      if (shipToState.length > 2) {
        shipToState = stateCodeMap[shipToState] || shipToState.substring(0, 2).toUpperCase();
      }

      // Convert store state to 2-letter code if needed
      let shipFromState = storeInfo.state || 'CA';
      if (shipFromState && shipFromState.length > 2) {
        shipFromState = stateCodeMap[shipFromState] || shipFromState.substring(0, 2).toUpperCase();
      }

      // Determine ship-from source: use sales channel address if available, otherwise use store info
      const sc: any = order.salesChannel;
      const useSalesChannelAddress = sc && sc.addressLine1; // Sales channel has a configured address

      let shipFromName: string;
      let shipFromCompany: string;
      let shipFromPhone: string;
      let shipFromAddress1: string;
      let shipFromAddress2: string | undefined;
      let shipFromCity: string;
      let shipFromStateCode: string;
      let shipFromPostal: string;
      let shipFromCountry: string;
      let shipFromEmail: string | undefined;

      if (useSalesChannelAddress) {
        // Use the sales channel's address for the label
        let scState = sc.state || '';
        if (scState.length > 2) {
          scState = stateCodeMap[scState] || scState.substring(0, 2).toUpperCase();
        }
        shipFromName = sc.companyName || 'Partner';
        shipFromCompany = sc.companyName || 'Partner';
        shipFromPhone = sc.contactNumber || storeInfo.phone || '1234567890';
        shipFromAddress1 = sc.addressLine1;
        shipFromAddress2 = sc.addressLine2 || undefined;
        shipFromCity = sc.city || '';
        shipFromStateCode = scState;
        shipFromPostal = sc.postalCode || '';
        shipFromCountry = countryCodeMap[sc.country || 'US'] || sc.country || 'US';
        shipFromEmail = sc.contactEmail || storeInfo.email || undefined;
      } else {
        // Use store info (Centre Labs default)
        shipFromName = storeInfo.name || 'Centre Labs';
        shipFromCompany = storeInfo.name || 'Centre Labs';
        shipFromPhone = storeInfo.phone || '1234567890';
        shipFromAddress1 = storeInfo.addressLine1 || '5825 W Sunset Blvd';
        shipFromAddress2 = storeInfo.addressLine2 || undefined;
        shipFromCity = storeInfo.city || 'Los Angeles';
        shipFromStateCode = shipFromState || 'CA';
        shipFromPostal = storeInfo.postalCode || '90028';
        shipFromCountry = countryCodeMap[storeInfo.country || 'US'] || 'US';
        shipFromEmail = storeInfo.email || undefined;
      }

      // Build items array for shipment
      const shipmentItems = order.items && order.items.length > 0
        ? order.items.map((item: any) => ({
          name: item.variant?.name || item.variant?.product?.name || item.productName || 'Order Item',
          quantity: item.quantity || 1,
          sku: item.variant?.sku || item.variant?.shipstationSku || item.sku || null,
          unit_price: Number(item.unitPrice || item.price || 0),
        }))
        : [];

      // Build the shipment payload
      const shipmentPayload = {
        orderId: order.id,
        shipment: {
          service_code: selectedService,
          ship_to: {
            name: order.shippingAddress?.firstName && order.shippingAddress?.lastName
              ? `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`
              : 'Customer',
            phone: order.shippingAddress?.phone || '1234567890',
            address_line1: order.shippingAddress?.address1 || '',
            address_line2: order.shippingAddress?.address2 || undefined,
            city_locality: order.shippingAddress?.city || '',
            state_province: shipToState,
            postal_code: order.shippingAddress?.postalCode || '',
            country_code: countryCode,
            address_residential_indicator: 'yes',
          },
          ship_from: {
            name: shipFromName,
            company_name: shipFromCompany,
            phone: shipFromPhone,
            address_line1: shipFromAddress1,
            address_line2: shipFromAddress2,
            city_locality: shipFromCity,
            state_province: shipFromStateCode,
            postal_code: shipFromPostal,
            country_code: shipFromCountry,
            address_residential_indicator: 'no',
          },
          return_to: {
            name: shipFromName,
            phone: shipFromPhone,
            email: shipFromEmail,
            company_name: shipFromCompany,
            address_line1: shipFromAddress1,
            address_line2: shipFromAddress2,
            address_line3: undefined,
            city_locality: shipFromCity,
            state_province: shipFromStateCode,
            postal_code: shipFromPostal,
            country_code: shipFromCountry,
            address_residential_indicator: 'no',
            instructions: 'Return items in original packaging',
          },
          is_return: false,
          items: shipmentItems,
          packages: [
            {
              weight: {
                value: 1,
                unit: 'ounce',
              },
              dimensions: {
                unit: 'inch',
                length: 8,
                width: 6,
                height: 4,
              },
              products: order.items && order.items.length > 0
                ? order.items.map((item: any) => ({
                  title: item.variant?.name || item.variant?.product?.name || item.productName || 'Order Item',
                  description: `${item.variant?.name || item.variant?.product?.name || item.productName || 'Order Item'} - Qty: ${item.quantity}, Price: $${Number(item.unitPrice || item.price || 0).toFixed(2)}`,
                  quantity: item.quantity || 1,
                  unit_price: Number(item.unitPrice || item.price || 0),
                }))
                : [
                  {
                    title: 'Order Item',
                    description: 'Order Item',
                    quantity: 1,
                    unit_price: 0,
                  },
                ],
            },
          ],
        },
        test_label: false,
        label_format: labelFormat,
        label_layout: labelLayout,
        label_download_type: 'url'
      };

      const response = await api.createShippingLabel(shipmentPayload);

      if (response.success) {
        setLabelResponse(response.data);
        setLabelError('');

        // Auto-update order status to LABEL_CREATED
        try {
          await api.updateOrderStatus(order.id, 'LABEL_CREATED', 'Shipping label generated automatically');
          setStatus('LABEL_CREATED');
        } catch (statusError) {
          logger.error('Error updating order status:', { error: statusError });
        }

        toast.success('Shipping label created successfully!');
      } else {
        // Extract specific error message from details if available
        let errorMsg = response.error || 'Failed to create shipping label';
        const errorResponse = response as any;
        if (errorResponse.details?.errors && Array.isArray(errorResponse.details.errors) && errorResponse.details.errors.length > 0) {
          errorMsg = errorResponse.details.errors[0].message || errorMsg;
        }
        setLabelError(errorMsg);
        // Store the full error response for display
        setLabelResponse(errorResponse);
        toast.error(errorMsg);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create shipping label';
      setLabelError(errorMessage);
      logger.error('Error creating label:', { error: error });
      toast.error(errorMessage);
    } finally {
      setLabelCreating(false);
    }
  };

  const handleRefreshLabelStatus = async () => {
    if (!labelResponse?.label_id) {
      toast.error('No label ID found');
      return;
    }

    setLabelRefreshing(true);
    try {
      const response = await api.getShipStationLabelStatus(labelResponse.label_id);
      if (response.success) {
        setLabelResponse(response.data);
        toast.success(`Label status updated: ${response.data.status}`);
      } else {
        toast.error('Failed to fetch label status');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch label status';
      logger.error('Error fetching label status:', { error: error });
      toast.error(errorMessage);
    } finally {
      setLabelRefreshing(false);
    }
  };

  const handleRefreshTracking = async () => {
    if (!order) {
      logger.warn('handleRefreshTracking: No order object');
      return;
    }

    logger.info(`Refreshing tracking for order: ${order.orderNumber} (ID: ${order.id})`);
    setTrackingRefreshing(true);
    try {
      const response = await api.syncOrderTracking(order.id);
      logger.info('Refresh tracking response:', response);
      if (response.success) {
        toast.success('Tracking status synced successfully');
        // Re-fetch everything to show updated status
        fetchShipments();
        onSuccess(); // Refresh the parent table
      } else {
        toast.error(response.error || 'Failed to sync tracking status');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync tracking status';
      logger.error('Error syncing tracking status:', { error: error });
      toast.error(errorMessage);
    } finally {
      setTrackingRefreshing(false);
    }
  };

  const handleCreateShipment = async () => {
    if (!order) return;

    setShipmentCreating(true);
    try {
      const response = await api.createShipment({
        orderId: order.id,
        ...newShipment
      });

      if (response.success) {
        // Backend automatically updates order status to SHIPPED and sends email
        // No need to call updateOrder separately to avoid duplicate emails

        toast.success('Shipment created successfully');
        setShowCreateShipment(false);
        setNewShipment({
          carrier: '',
          trackingNumber: '',
          trackingUrl: '',
          status: 'PENDING'
        });
        fetchShipments();
        onSuccess();
      } else {
        toast.error('Failed to create shipment');
      }
    } catch (error) {
      logger.error('Error creating shipment:', { error: error });
      toast.error('Failed to create shipment');
    } finally {
      setShipmentCreating(false);
    }
  };

  const handleUpdateShipment = async (shipmentId: string, data: any) => {
    try {
      const response = await api.updateShipmentTracking(shipmentId, data);

      if (response.success) {
        toast.success('Shipment updated successfully');
        fetchShipments();
        onSuccess();
      } else {
        toast.error('Failed to update shipment');
      }
    } catch (error) {
      toast.error('Failed to update shipment');
    }
  };

  const handleDeleteShipment = (shipmentId: string) => {
    setShipmentToDelete(shipmentId);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteShipment = async () => {
    if (!shipmentToDelete) return;

    setDeletingShipment(true);
    try {
      const response = await api.deleteShipment(shipmentToDelete);

      if (response.success) {
        toast.success('Shipment deleted successfully');
        setShowDeleteConfirm(false);
        setShipmentToDelete(null);
        fetchShipments();
        onSuccess();
      } else {
        toast.error('Failed to delete shipment');
      }
    } catch (error) {
      toast.error('Failed to delete shipment');
    } finally {
      setDeletingShipment(false);
    }
  };

  const handleSubmit = async () => {
    if (!order) return;

    try {
      setLoading(true);

      const statusChanged = status && status !== order.status;
      const amountsChanged =
        Number(discountAmount) !== Number(order.discountAmount || 0) ||
        Number(shippingAmount) !== Number(order.shippingAmount || 0) ||
        Number(taxAmount) !== Number(order.taxAmount || 0);

      // 1) If status changed to SHIPPED and label exists, auto-create shipment instead of just updating status
      // This prevents duplicate emails (shipment creation handles the email)
      if (statusChanged && status === 'SHIPPED' && labelResponse) {
        try {
          const shipmentData = {
            orderId: order.id,
            carrier: labelResponse.carrier_code || '',
            trackingNumber: labelResponse.tracking_number || '',
            trackingUrl: labelResponse.tracking_url || '',
            status: 'SHIPPED'
          };

          const shipmentRes = await api.createShipment(shipmentData);
          if (shipmentRes.success) {
            toast.success('Shipment created automatically from label data');
            fetchShipments();
          } else {
            throw new Error('Failed to create shipment');
          }
        } catch (shipmentError) {
          logger.error('Error auto-creating shipment:', { error: shipmentError });
          throw shipmentError;
        }
      } else if (statusChanged) {
        // For other status changes, use the dedicated status API
        const statusRes = await api.updateOrderStatus(order.id, status, notes.trim() || undefined);
        if (!statusRes.success) {
          throw new Error('Failed to update order status');
        }
      } else if (notes.trim()) {
        // If no status change but a note is provided, persist the note
        await api.addOrderNote(order.id, notes.trim());
      }

      // 2) If financial amounts changed, update them via PUT
      if (amountsChanged) {
        const response = await api.updateOrder(order.id, {
          // Do not redundantly send status unless changed (already handled above)
          ...(statusChanged ? { status } : {}),
          discountAmount: discountAmount.toString(),
          shippingAmount: shippingAmount.toString(),
          taxAmount: taxAmount.toString(),
        });
        if (!response.success) {
          throw new Error('Failed to update order amounts');
        }
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      logger.error('Failed to update order:', { error: error });
      toast.error('Failed to update order');
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateRefund = async () => {
    if (!order || !order.payments || order.payments.length === 0) return;
    setRefundLoading(true);
    setRefundError('');
    try {
      const payment = order.payments[0];
      const response = await api.initiateOrderRefund(order.id, refundAmount, refundReason);
      if (response.success) {
        setShowRefundDialog(false);
        setRefundAmount(0);
        setRefundReason('');
        onSuccess();
        toast.success('Refund initiated');
      } else {
        setRefundError(response.error || 'Failed to initiate refund');
      }
    } catch (e) {
      setRefundError('Failed to initiate refund');
    } finally {
      setRefundLoading(false);
    }
  };

  const handleUpdateRefundStatus = async (refundId: string, newStatus: string) => {
    setRefundStatusLoading(refundId);
    try {
      const response = await api.updateRefundStatus(refundId, newStatus);
      if (response.success) {
        onSuccess();
        toast.success('Refund status updated');
      } else {
        toast.error(response.error || 'Failed to update refund status');
      }
    } catch (e) {
      toast.error('Failed to update refund status');
    } finally {
      setRefundStatusLoading(null);
    }
  };

  if (!order) return null;

  // Check if payment is captured
  const hasPaymentCaptured = order.payments && order.payments.length > 0 &&
    order.payments.some((payment: any) =>
      payment.status === 'PAID' || payment.status === 'COMPLETED'
    );

  const subtotal = order.subtotal || 0;
  const totalAmount = Math.round((Number(subtotal ?? 0) - Number(discountAmount ?? 0) + Number(shippingAmount ?? 0) + Number(taxAmount ?? 0)) * 100) / 100;

  // Detect Authorize.Net credit card fee from the persisted order values and reuse it in display
  const originalBase = Math.round((Number(order.subtotal || 0) - Number(order.discountAmount || 0) + Number(order.shippingAmount || 0) + Number(order.taxAmount || 0)) * 100) / 100;
  const originalDelta = Math.round((Number(order.totalAmount || 0) - originalBase) * 100) / 100;
  const approxThreePct = Math.round(originalBase * 3) / 100;
  const hasAuthorizePayment = !!order.payments?.some((p: any) => {
    const provider = (p?.provider || '').toString().toLowerCase();
    return provider === 'authorize.net' || provider === 'authorize-net' || provider === 'authorizenet';
  });
  const isThreePctFee = Math.abs(originalDelta - approxThreePct) < 0.05; // Increased tolerance for detecting 3% fee
  const cardFee = (hasAuthorizePayment || isThreePctFee) && originalDelta > 0 ? originalDelta : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn(
          "flex flex-col bg-background text-foreground p-0", // Removed padding to handle header/footer
          "w-[95vw] sm:max-w-5xl",
          "max-h-[90vh] overflow-hidden" // Changed from h-[90vh] to handle short content without gaps
        )}>
          <DialogHeader className="p-4 pr-12 sm:p-6 sm:pb-3 border-b shrink-0">
            <div className="flex items-center gap-2">
              <DialogTitle className="flex items-center gap-2">
                Edit Order #{order.orderNumber}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyOrderId}
                  className="h-7 px-2"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </DialogTitle>
            </div>
            <DialogDescription>
              Update order details and status
            </DialogDescription>
          </DialogHeader>

          <div className="h-auto max-h-[80vh] overflow-y-auto px-4 pb-4 pt-1 sm:px-6 sm:pb-6 sm:pt-2">

            <Tabs defaultValue="details" className="w-full">
              <TabsList className={cn(
                "w-full overflow-x-auto flex justify-start sm:grid sm:grid-cols-6 p-1 mb-4 h-auto scrollbar-hide"
              )}>
                <TabsTrigger value="details" className="flex-1 px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">Details</TabsTrigger>
                <TabsTrigger value="items" className="flex-1 px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">Items</TabsTrigger>
                <TabsTrigger value="payments" className="flex-1 px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">Payments</TabsTrigger>
                <TabsTrigger value="shipping" className="flex-1 px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">Shipping</TabsTrigger>
                <TabsTrigger value="comments" className="flex-1 px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap text-black data-[state=active]:text-black">Comments</TabsTrigger>
                <TabsTrigger value="audit" className="flex-1 px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">Audit Trail</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Order Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="status">Order Status</Label>
                        <Select value={status} onValueChange={setStatus}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PENDING">Pending</SelectItem>
                            <SelectItem value="PROCESSING">Processing</SelectItem>
                            <SelectItem value="LABEL_CREATED">Label Created</SelectItem>
                            <SelectItem value="SHIPPED">Shipped</SelectItem>
                            <SelectItem value="DELIVERED">Delivered</SelectItem>
                            <SelectItem value="CANCELLED">Cancelled</SelectItem>
                            <SelectItem value="REFUNDED">Refunded</SelectItem>
                            {/* <SelectItem value="ON_HOLD">On Hold</SelectItem> */}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Customer</Label>
                        <div className="p-2 bg-gray-50 rounded text-black">
                          {order.customer ?
                            `${order.customer.firstName} ${order.customer.lastName}` :
                            'Guest Customer'
                          }
                        </div>
                      </div>

                      <div>
                        <Label>Order Source</Label>
                        <div className="p-2 bg-gray-50 rounded text-black">
                          {order.salesChannel?.companyName || 'Centre Labs'}
                          {order.partnerOrderId && (
                            <span className="ml-2 text-xs text-muted-foreground group">
                              (ID: {order.partnerOrderId})
                            </span>
                          )}
                        </div>
                      </div>


                    </div>

                    <div className="space-y-2">
                      <Label>Order Summary</Label>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span>${Number(subtotal ?? 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Discount:</span>
                          <Input
                            type="number"
                            value={discountAmount}
                            onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                            className="w-24 text-right"
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Shipping:</span>
                          <Input
                            type="number"
                            value={shippingAmount}
                            onChange={(e) => setShippingAmount(parseFloat(e.target.value) || 0)}
                            className="w-24 text-right"
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Tax:</span>
                          <Input
                            type="number"
                            value={taxAmount}
                            onChange={(e) => setTaxAmount(parseFloat(e.target.value) || 0)}
                            className="w-24 text-right"
                            min="0"
                            step="0.01"
                          />
                        </div>
                        {cardFee > 0 && (
                          <div className="flex justify-between">
                            <span>Credit card fee (3%):</span>
                            <span>${cardFee.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-medium text-lg pt-2 border-t">
                          <span>Total:</span>
                          <span>${Number(totalAmount + cardFee).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Add Note (Optional)</Label>
                      <Textarea
                        id="notes"
                        placeholder="Add a note about this order update..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="items" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="w-5 h-5" />
                      Order Items
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {order.items && order.items.length > 0 ? (
                        order.items.map((item) => {
                          const hasBulkPrice = !!(item as any).bulkUnitPrice;
                          const displayPrice = hasBulkPrice ? Number((item as any).bulkUnitPrice) : Number(item.unitPrice);
                          const regularPrice = Number(item.unitPrice);
                          const savings = hasBulkPrice ? (regularPrice - displayPrice) * item.quantity : 0;

                          return (
                            <div key={item.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 border rounded">
                              <div className="flex-1">
                                <div className="font-medium">
                                  {item.variant?.product?.name || 'Unknown Product'} - {item.variant?.name || 'Unknown Variant'}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  SKU: {item.variant?.sku || 'N/A'}
                                  {order.customer?.customerType && item.variant?.segmentPrices && item.variant.segmentPrices.length > 0 && (
                                    <span className="ml-2">
                                      (Customer Segment: {String(order.customer.customerType).replace('_', ' ')})
                                    </span>
                                  )}
                                </div>
                                {hasBulkPrice && (
                                  <div className="mt-1">
                                    <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">
                                      Bulk Price Applied
                                    </Badge>
                                  </div>
                                )}
                                {item.variant && item.variant.segmentPrices && item.variant.segmentPrices.length > 0 && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Segment Prices:
                                    {item.variant.segmentPrices.map(sp => (
                                      <span key={sp.id} className="ml-2">
                                        {sp.customerType}: ${sp.salePrice || sp.regularPrice}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-sm">Qty: {item.quantity}</span>
                                {hasBulkPrice ? (
                                  <div className="text-right">
                                    <div className="text-sm font-medium text-green-600">Bulk: ${displayPrice.toFixed(2)}</div>
                                    <div className="text-xs text-muted-foreground line-through">Reg: ${regularPrice.toFixed(2)}</div>
                                  </div>
                                ) : (
                                  <span className="text-sm">Unit: ${displayPrice.toFixed(2)}</span>
                                )}
                                <div className="text-right">
                                  <div className="text-sm font-medium">
                                    ${hasBulkPrice
                                      ? (displayPrice * item.quantity).toFixed(2)
                                      : Number(item.totalPrice).toFixed(2)}
                                  </div>
                                  {hasBulkPrice && savings > 0 && (
                                    <div className="text-xs text-green-600">Save ${savings.toFixed(2)}</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-muted-foreground text-center py-4">No items found</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="payments" className="space-y-4">
                {/* Payment Type Card */}
                {order.selectedPaymentType && (
                  <Card className="border-blue-200 bg-blue-50">
                    <CardHeader>
                      <CardTitle className="text-sm font-semibold text-blue-900">Selected Payment Type</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3">
                        <Badge variant="default" className="bg-blue-600">
                          {order.selectedPaymentType === 'ZELLE' ? 'Zelle' :
                            order.selectedPaymentType === 'BANK_WIRE' ? 'Bank Wire' :
                              order.selectedPaymentType === 'AUTHORIZE_NET' ? 'Authorize.Net' :
                                order.selectedPaymentType}
                        </Badge>
                        <span className="text-sm text-blue-800">
                          Selected by customer during checkout
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5" />
                        Payment History
                      </div>
                      {(!order.transactions || order.transactions.length === 0) && (
                        <Button
                          size="sm"
                          onClick={() => setShowRecordPayment(true)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <CreditCard className="w-4 h-4 mr-2" />
                          Record Payment
                        </Button>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {order.transactions && order.transactions.length > 0 ? (
                        order.transactions.map((transaction) => (
                          <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex-1">
                              <div className="font-semibold text-sm mb-1">
                                {transaction.paymentGatewayName === 'MANUAL' ? 'Bank Transfer' :
                                  transaction.paymentGatewayName === 'AUTHORIZE_NET' ? 'Direct' :
                                    transaction.paymentGatewayName}
                              </div>
                              <div className="text-xs text-muted-foreground mb-1">
                                Transaction: {transaction.id}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(transaction.createdAt).toLocaleString()}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <Badge variant={transaction.paymentStatus === 'COMPLETED' ? 'default' : 'secondary'}>
                                {transaction.paymentStatus === 'COMPLETED' ? 'Paid' : transaction.paymentStatus}
                              </Badge>
                              <span className="text-sm font-semibold">${Number(transaction.amount ?? 0).toFixed(2)}</span>
                              {transaction.paymentStatus === 'FAILED' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="mt-2 text-xs h-7 border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
                                  onClick={() => handleMarkAsPaid(transaction.id)}
                                  disabled={updatingTransactionId === transaction.id}
                                >
                                  {updatingTransactionId === transaction.id && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                                  Mark as Paid
                                </Button>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4 text-muted-foreground">
                          No payments recorded yet
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="shipping" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Tag className="w-5 h-5" />
                      Shipping Labels
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!hasPaymentCaptured && !labelResponse && (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="text-sm font-medium text-yellow-900 flex items-center gap-2">
                          ⚠️ Payment Required
                        </div>
                        <div className="text-sm text-yellow-800 mt-2">
                          You will be able to create the shipping label only once the payment is captured.
                        </div>
                      </div>
                    )}

                    {!labelResponse ? (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="carrier-select">Select Carrier *</Label>
                          <Select
                            value={selectedCarrier}
                            onValueChange={(value) => {
                              setSelectedCarrier(value);
                              setSelectedService('');
                              setCarrierServices([]);
                              if (value) {
                                fetchCarrierServices(value);
                              }
                            }}
                          >
                            <SelectTrigger id="carrier-select">
                              <SelectValue placeholder={carriersLoading ? "Loading carriers..." : "Select a carrier"} />
                            </SelectTrigger>
                            <SelectContent>
                              {carriers.length > 0 ? (
                                carriers.map((carrier: any) => (
                                  <SelectItem key={carrier.carrier_id} value={carrier.carrier_id}>
                                    <div className="flex items-center gap-2">
                                      <span>{carrier.friendly_name}</span>
                                      {carrier.primary && <Badge variant="secondary" className="text-xs">Primary</Badge>}
                                    </div>
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="no-carriers" disabled>
                                  {carriersLoading ? "Loading..." : "No carriers available"}
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>

                        {selectedCarrier && (
                          <div>
                            <Label htmlFor="service-select">Select Service *</Label>
                            <Select
                              value={selectedService}
                              onValueChange={setSelectedService}
                            >
                              <SelectTrigger id="service-select">
                                <SelectValue placeholder="Select a service" />
                              </SelectTrigger>
                              <SelectContent>
                                {carrierServices.length > 0 ? (
                                  carrierServices.map((service: any) => (
                                    <SelectItem key={service.service_code} value={service.service_code}>
                                      <div className="flex items-center gap-2">
                                        <span>{service.name}</span>
                                        {service.domestic && service.international && (
                                          <Badge variant="outline" className="text-xs">Domestic & International</Badge>
                                        )}
                                        {service.domestic && !service.international && (
                                          <Badge variant="outline" className="text-xs">Domestic</Badge>
                                        )}
                                        {!service.domestic && service.international && (
                                          <Badge variant="outline" className="text-xs">International</Badge>
                                        )}
                                      </div>
                                    </SelectItem>
                                  ))
                                ) : (
                                  <SelectItem value="no-services" disabled>
                                    No services available for this carrier
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {selectedCarrier && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="label-layout">Label Size</Label>
                              <Select
                                value={labelLayout}
                                onValueChange={setLabelLayout}
                              >
                                <SelectTrigger id="label-layout">
                                  <SelectValue placeholder="Select size" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="4x6">4 x 6 (Standard Thermal)</SelectItem>
                                  {/* <SelectItem value="letter">8.5 x 11 (Letter/Paper)</SelectItem> */}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="label-format">Label Format</Label>
                              <Select
                                value={labelFormat}
                                onValueChange={setLabelFormat}
                              >
                                <SelectTrigger id="label-format">
                                  <SelectValue placeholder="Select format" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pdf">PDF</SelectItem>
                                  {/* <SelectItem value="zpl">ZPL (Zebra)</SelectItem>
                              <SelectItem value="png">PNG (Image)</SelectItem> */}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}

                        {selectedCarrier && selectedService && (
                          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="text-sm font-medium text-blue-900">
                              Selected Configuration
                            </div>
                            <div className="text-sm text-blue-800 mt-2 space-y-1">
                              <div>
                                <strong>Carrier:</strong> {carriers.find((c: any) => c.carrier_id === selectedCarrier)?.friendly_name}
                              </div>
                              <div>
                                <strong>Service:</strong> {carrierServices.find((s: any) => s.service_code === selectedService)?.name}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="pt-4 border-t">
                          <p className="text-sm text-muted-foreground mb-4">
                            Select a carrier and service to create a shipping label for this order.
                          </p>
                          <Button
                            disabled={!selectedCarrier || !selectedService || labelCreating || !hasPaymentCaptured}
                            onClick={handleCreateLabel}
                            className="w-full"
                          >
                            {labelCreating ? 'Creating Label...' : 'Create Shipping Label'}
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {labelError && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
                        <div className="text-sm font-medium text-red-900">❌ Label Creation Error</div>

                        <div className="mt-2 p-3 bg-red-100 rounded">
                          <div className="text-sm text-red-800 font-semibold">{labelError}</div>
                        </div>

                        {labelResponse?.details?.errors && Array.isArray(labelResponse.details.errors) && labelResponse.details.errors.length > 0 && (
                          <div className="mt-3 p-3 bg-red-100 rounded">
                            <div className="font-semibold text-red-900 mb-2">Error Details:</div>
                            <div className="space-y-2">
                              {labelResponse.details.errors.map((err: any, idx: number) => (
                                <div key={idx} className="text-red-800 border-l-2 border-red-400 pl-2">
                                  <div className="font-semibold text-sm">{err.field_name || `Error ${idx + 1}`}</div>
                                  <div className="text-xs mt-1">{err.message}</div>
                                  {err.field_value && (
                                    <div className="text-xs mt-1 text-red-700">
                                      <strong>Invalid Value:</strong> {err.field_value}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {labelResponse?.status && (
                          <div className="text-xs text-red-700 mt-2">
                            <strong>Status Code:</strong> {labelResponse.status}
                          </div>
                        )}

                        {labelResponse?.payload && (
                          <div className="mt-3 p-3 bg-yellow-50 rounded text-xs border border-yellow-200">
                            <div className="font-semibold text-yellow-900 mb-2">📤 Request Payload Sent:</div>
                            <div className="text-yellow-800 font-mono overflow-auto max-h-48 bg-white p-2 rounded border border-yellow-200">
                              {JSON.stringify(labelResponse.payload, null, 2)}
                            </div>
                          </div>
                        )}

                        {labelResponse?.details?.request_id && (
                          <div className="text-xs text-red-700 mt-2">
                            <strong>Request ID:</strong> {labelResponse.details.request_id}
                          </div>
                        )}
                      </div>
                    )}

                    {labelResponse && !labelError && (
                      <div className="space-y-4 pt-4 border-t">
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <div className="text-sm font-medium text-green-900 flex items-center gap-2">
                            ✓ Label Created Successfully
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="p-3 bg-gray-50 rounded">
                            <div className="text-xs font-semibold text-gray-600 mb-1">Label ID</div>
                            <div className="text-sm font-mono text-gray-900 break-all">{labelResponse.label_id}</div>
                          </div>
                          <div className="p-3 bg-gray-50 rounded">
                            <div className="text-xs font-semibold text-gray-600 mb-1">Tracking Number</div>
                            <div className="text-sm font-mono text-gray-900">{labelResponse.tracking_number}</div>
                          </div>
                          <div className="p-3 bg-gray-50 rounded">
                            <div className="text-xs font-semibold text-gray-600 mb-1">Service Code</div>
                            <div className="text-sm font-mono text-gray-900">{labelResponse.service_code}</div>
                          </div>
                          <div className="p-3 bg-gray-50 rounded">
                            <div className="text-xs font-semibold text-gray-600 mb-1">Carrier</div>
                            <div className="text-sm font-mono text-gray-900">{labelResponse.carrier_code}</div>
                          </div>
                        </div>

                        <div className="flex gap-2 flex-wrap">


                          {labelResponse.label_download?.href && (
                            <a
                              href={labelResponse.label_download.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
                            >
                              📥 Download Label PDF
                            </a>
                          )}

                          {labelResponse.tracking_number && (
                            <a
                              href={(() => {
                                // If ShipStation provides a tracking URL, use it
                                if (labelResponse.tracking_url) {
                                  return `${labelResponse.tracking_url}${labelResponse.tracking_number}`;
                                }

                                // Fallback: Construct tracking URL based on carrier
                                const carrier = (labelResponse.carrier_code || '').toLowerCase();
                                const trackingNum = labelResponse.tracking_number;

                                if (carrier.includes('usps')) {
                                  return `https://tools.usps.com/go/TrackConfirmAction.action?tLabels=${trackingNum}`;
                                } else if (carrier.includes('fedex')) {
                                  return `https://www.fedex.com/fedextrack/?tracknumbers=${trackingNum}`;
                                } else if (carrier.includes('ups')) {
                                  return `https://www.ups.com/track?tracknum=${trackingNum}`;
                                } else if (carrier.includes('dhl')) {
                                  return `https://www.dhl.com/en/en/shipped.html?tracking_number=${trackingNum}`;
                                } else {
                                  // Generic fallback - just return the tracking number
                                  return `#`;
                                }
                              })()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-sm font-medium"
                            >
                              🔗 Track Package
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Collapsible defaultOpen={false} className="border rounded-lg">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between p-4 h-auto hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        <Truck className="w-5 h-5" />
                        <span className="font-semibold">Shipping & Billing Addresses</span>
                      </div>
                      <ChevronDown className="w-4 h-4 transition-transform" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="border-t p-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label className="font-semibold mb-2 block">Billing Address</Label>
                        <div className="p-3 bg-gray-50 rounded text-sm text-gray-900 space-y-1">
                          {order.billingAddress ? (
                            <div className="space-y-1.5">
                              <div className="flex items-start">
                                <span className="text-muted-foreground w-24 shrink-0 font-medium">Name:</span>
                                <span className="font-semibold">{order.billingAddress.firstName} {order.billingAddress.lastName}</span>
                              </div>
                              {order.billingAddress.company && (
                                <div className="flex items-start">
                                  <span className="text-muted-foreground w-24 shrink-0 font-medium">Company:</span>
                                  <span className="font-medium text-blue-800">{order.billingAddress.company}</span>
                                </div>
                              )}
                              <div className="flex items-start">
                                <span className="text-muted-foreground w-24 shrink-0 font-medium">Address 1:</span>
                                <span>{order.billingAddress.address1}</span>
                              </div>
                              {order.billingAddress.address2 && (
                                <div className="flex items-start">
                                  <span className="text-muted-foreground w-24 shrink-0 font-medium">Address 2:</span>
                                  <span>{order.billingAddress.address2}</span>
                                </div>
                              )}
                              <div className="flex items-start">
                                <span className="text-muted-foreground w-24 shrink-0 font-medium">Location:</span>
                                <div>{order.billingAddress.city}, {order.billingAddress.state} {order.billingAddress.postalCode}</div>
                              </div>
                              <div className="flex items-start">
                                <span className="text-muted-foreground w-24 shrink-0 font-medium">Country:</span>
                                <div>{order.billingAddress.country}</div>
                              </div>
                              {order.billingAddress.phone && (
                                <div className="flex items-start pb-1">
                                  <span className="text-muted-foreground w-24 shrink-0 font-medium">Phone:</span>
                                  <div className="text-gray-600">📞 {order.billingAddress.phone}</div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-muted-foreground">No billing address</div>
                          )}
                        </div>
                      </div>

                      <div>
                        <Label className="font-semibold mb-2 block">Shipping Address</Label>
                        <div className="p-3 bg-gray-50 rounded text-sm text-gray-900 space-y-1">
                          {order.shippingAddress ? (
                            <div className="space-y-1.5">
                              <div className="flex items-start">
                                <span className="text-muted-foreground w-24 shrink-0 font-medium">Name:</span>
                                <span className="font-semibold">{order.shippingAddress.firstName} {order.shippingAddress.lastName}</span>
                              </div>
                              {order.shippingAddress.company && (
                                <div className="flex items-start">
                                  <span className="text-muted-foreground w-24 shrink-0 font-medium">Company:</span>
                                  <span className="font-medium text-green-800">{order.shippingAddress.company}</span>
                                </div>
                              )}
                              <div className="flex items-start">
                                <span className="text-muted-foreground w-24 shrink-0 font-medium">Address 1:</span>
                                <span>{order.shippingAddress.address1}</span>
                              </div>
                              {order.shippingAddress.address2 && (
                                <div className="flex items-start">
                                  <span className="text-muted-foreground w-24 shrink-0 font-medium">Address 2:</span>
                                  <span>{order.shippingAddress.address2}</span>
                                </div>
                              )}
                              <div className="flex items-start">
                                <span className="text-muted-foreground w-24 shrink-0 font-medium">Location:</span>
                                <div>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}</div>
                              </div>
                              <div className="flex items-start">
                                <span className="text-muted-foreground w-24 shrink-0 font-medium">Country:</span>
                                <div>{order.shippingAddress.country}</div>
                              </div>
                              {order.shippingAddress.phone && (
                                <div className="flex items-start pb-1">
                                  <span className="text-muted-foreground w-24 shrink-0 font-medium">Phone:</span>
                                  <div className="text-gray-600">📞 {order.shippingAddress.phone}</div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-muted-foreground">No shipping address</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Truck className="w-5 h-5" />
                      Shipment Tracking
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefreshTracking}
                        disabled={trackingRefreshing}
                        className="text-xs"
                      >
                        {trackingRefreshing ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Refreshing...
                          </>
                        ) : (
                          <>
                            <Truck className="w-3 h-3 mr-1" />
                            Refresh Live Tracking
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Pre-populate from saved label if available
                          if (labelResponse) {
                            const carrierName = labelResponse.carrier_code || '';
                            const trackingUrl = labelResponse.tracking_url || '';
                            setNewShipment({
                              carrier: carrierName,
                              trackingNumber: '',
                              trackingUrl: trackingUrl,
                              status: 'PENDING'
                            });
                          } else {
                            // Reset form if no label
                            setNewShipment({
                              carrier: '',
                              trackingNumber: '',
                              trackingUrl: '',
                              status: 'PENDING'
                            });
                          }
                          setShowCreateShipment(true);
                        }}
                        className="text-xs"
                      >
                        Create Manual Shipment
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Manage shipment tracking information</p>
                    </div>

                    {shipmentsLoading ? (
                      <div className="text-center py-4 text-muted-foreground">
                        Loading shipments...
                      </div>
                    ) : shipments.length > 0 ? (
                      shipments.map((shipment) => (
                        <div key={shipment.id} className="p-4 border rounded space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-medium">{shipment.carrier}</div>
                              <div className="text-sm text-muted-foreground">
                                Tracking: {shipment.trackingNumber || 'N/A'}
                              </div>
                              {shipment.trackingUrl && (
                                <a
                                  href={shipment.trackingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-600 hover:underline"
                                >
                                  Track Package
                                </a>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={shipment.status === 'DELIVERED' ? 'default' : 'outline'}>
                                {shipment.status}
                              </Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteShipment(shipment.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <Label className="text-xs">Tracking Number</Label>
                              <Input
                                value={shipment.trackingNumber || ''}
                                onChange={(e) => handleUpdateShipment(shipment.id, { trackingNumber: e.target.value })}
                                placeholder="Enter tracking number"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Tracking URL</Label>
                              <Input
                                value={shipment.trackingUrl || ''}
                                onChange={(e) => handleUpdateShipment(shipment.id, { trackingUrl: e.target.value })}
                                placeholder="Enter tracking URL"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Status</Label>
                              <Select
                                value={shipment.status}
                                onValueChange={(value) => handleUpdateShipment(shipment.id, { status: value })}
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="PENDING">Pending</SelectItem>
                                  <SelectItem value="SHIPPED">Shipped</SelectItem>
                                  <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
                                  <SelectItem value="DELIVERED">Delivered</SelectItem>
                                  <SelectItem value="RETURNED">Returned</SelectItem>
                                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">Carrier</Label>
                              <Input
                                value={shipment.carrier}
                                onChange={(e) => handleUpdateShipment(shipment.id, { carrier: e.target.value })}
                                placeholder="Enter carrier"
                                className="mt-1"
                              />
                            </div>
                          </div>

                          <div className="text-xs text-muted-foreground">
                            Created: {new Date(shipment.createdAt).toLocaleString()}
                            {shipment.shippedAt && (
                              <> • Shipped: {new Date(shipment.shippedAt).toLocaleString()}</>
                            )}
                            {shipment.deliveredAt && (
                              <> • Delivered: {new Date(shipment.deliveredAt).toLocaleString()}</>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-center py-4">No shipments found</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="audit" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Audit Trail
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {order.auditLogs && order.auditLogs.length > 0 ? (
                      <div className="space-y-3">
                        {order.auditLogs.map((log) => (
                          <div key={log.id} className="flex items-start gap-4 p-4 border rounded-lg">
                            <div className="flex-1">
                              <div className="font-semibold text-sm mb-1">
                                {log.action.replace(/_/g, ' ').toUpperCase()}
                              </div>
                              <div className="text-xs text-muted-foreground mb-2">
                                {log.user ? `${log.user.firstName} ${log.user.lastName} (${log.user.email})` : 'System'}
                                {' • '}
                                {new Date(log.createdAt).toLocaleString()}
                              </div>
                              {log.details && typeof log.details === 'object' ? (
                                <div className="text-xs space-y-1">
                                  {log.action === 'ORDER_UPDATED' && log.details.changes && (
                                    <div className="bg-blue-50 p-2 rounded">
                                      <div className="font-medium text-blue-800 mb-1">Changes:</div>
                                      {Object.entries(log.details.changes).map(([key, value]: [string, unknown]) => (
                                        <div key={key} className="flex justify-between">
                                          <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                                          <span className="font-medium">{typeof value === 'number' ? `$${value.toLocaleString()}` : String(value)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {log.action === 'STATUS_UPDATED' && (
                                    <div className="bg-green-50 p-2 rounded">
                                      <div className="flex items-center gap-2">
                                        <span className="text-green-800">Status changed from</span>
                                        <Badge variant="outline" className="text-xs">{log.details.previousStatus}</Badge>
                                        <span className="text-green-800">to</span>
                                        <Badge variant="default" className="text-xs">{log.details.newStatus}</Badge>
                                      </div>
                                      {log.details.note && (
                                        <div className="text-green-700 mt-1 italic">"{log.details.note}"</div>
                                      )}
                                    </div>
                                  )}
                                  {log.action === 'ORDER_CREATED' && (
                                    <div className="bg-purple-50 p-2 rounded">
                                      <div className="font-medium text-purple-800 mb-1">Order Created:</div>
                                      <div className="space-y-1 text-purple-700">
                                        {log.details.orderNumber && <div>Order #: {log.details.orderNumber}</div>}
                                        {log.details.totalAmount && <div>Amount: ${log.details.totalAmount.toLocaleString()}</div>}
                                        {log.details.customerType && <div>Customer Type: {log.details.customerType === 'B2B' || log.details.customerType === 'B2C' ? 'Wholesale' : log.details.customerType === 'ENTERPRISE_1' || log.details.customerType === 'ENTERPRISE_2' ? 'Enterprise' : log.details.customerType}</div>}
                                        {log.details.itemCount && <div>Items: {log.details.itemCount}</div>}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-xs text-muted-foreground">
                                  {log.details}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">No audit logs found</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="comments" className="space-y-4 pt-4">
                <CommentSection type="ORDER" orderId={order.id} onCommentAdded={onCommentAdded} />
              </TabsContent>
            </Tabs>
          </div>

          <div className="p-4 sm:p-6 border-t bg-gray-50/50 shrink-0">
            <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={handleDownloadInvoice}
                  disabled={downloadingInvoice}
                  className="w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {downloadingInvoice ? 'Downloading...' : 'Invoice'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadPackingSlip}
                  disabled={downloadingPackingSlip}
                  className="w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm"
                >
                  <Package className="h-4 w-4 mr-2" />
                  {downloadingPackingSlip ? 'Downloading...' : 'Packing Slip'}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowOrderDeleteConfirm(true)}
                  className="w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Order
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="flex-1 sm:flex-none h-9 sm:h-10 text-xs sm:text-sm"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 sm:flex-none h-9 sm:h-10 text-xs sm:text-sm"
                >
                  {loading ? 'Updating...' : 'Update Order'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Shipment Dialog */}
      < UIDialog open={showCreateShipment} onOpenChange={setShowCreateShipment} >
        <UIDialogContent>
          <UIDialogHeader>
            <UIDialogTitle>Create Shipment</UIDialogTitle>
          </UIDialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Carrier *</Label>
              <Input
                value={newShipment.carrier}
                onChange={(e) => setNewShipment({ ...newShipment, carrier: e.target.value })}
                placeholder="e.g., FedEx, UPS, DHL"
                required
              />
            </div>
            <div>
              <Label>Tracking Number</Label>
              <Input
                value={newShipment.trackingNumber}
                onChange={(e) => {
                  const trackingNum = e.target.value;
                  // Auto-generate tracking URL based on carrier and tracking number
                  let trackingUrl = newShipment.trackingUrl;

                  if (trackingNum && newShipment.carrier) {
                    const carrier = newShipment.carrier.toLowerCase();

                    if (carrier.includes('usps')) {
                      trackingUrl = `https://tools.usps.com/go/TrackConfirmAction.action?tLabels=${trackingNum}`;
                    } else if (carrier.includes('fedex')) {
                      trackingUrl = `https://www.fedex.com/fedextrack/?tracknumbers=${trackingNum}`;
                    } else if (carrier.includes('ups')) {
                      trackingUrl = `https://www.ups.com/track?tracknum=${trackingNum}`;
                    } else if (carrier.includes('dhl')) {
                      trackingUrl = `https://www.dhl.com/en/en/shipped.html?tracking_number=${trackingNum}`;
                    }
                  }

                  setNewShipment({
                    ...newShipment,
                    trackingNumber: trackingNum,
                    trackingUrl: trackingUrl
                  });
                }}
                placeholder="Enter tracking number"
              />
            </div>
            <div>
              <Label>Tracking URL</Label>
              <Input
                value={newShipment.trackingUrl}
                onChange={(e) => setNewShipment({ ...newShipment, trackingUrl: e.target.value })}
                placeholder="Auto-generated or enter manually"
                readOnly={!!(newShipment.trackingNumber && newShipment.carrier)}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={newShipment.status}
                onValueChange={(value) => setNewShipment({ ...newShipment, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="SHIPPED">Shipped</SelectItem>
                  <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
                  <SelectItem value="DELIVERED">Delivered</SelectItem>
                  <SelectItem value="RETURNED">Returned</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateShipment(false)} disabled={shipmentCreating}>
                Cancel
              </Button>
              <Button onClick={handleCreateShipment} disabled={!newShipment.carrier || shipmentCreating}>
                {shipmentCreating ? '⏳ Creating...' : 'Create Shipment'}
              </Button>
            </div>
          </div>
        </UIDialogContent>
      </UIDialog >

      {/* Delete Shipment Confirmation Dialog */}
      < UIDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm} >
        <UIDialogContent>
          <UIDialogHeader>
            <UIDialogTitle>Delete Shipment</UIDialogTitle>
          </UIDialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to delete this shipment? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setShipmentToDelete(null);
                }}
                disabled={deletingShipment}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteShipment}
                disabled={deletingShipment}
              >
                {deletingShipment ? '🗑️ Deleting...' : '🗑️ Delete'}
              </Button>
            </div>
          </div>
        </UIDialogContent>
      </UIDialog >

      {/* Record Payment Dialog */}
      < RecordPaymentDialog
        open={showRecordPayment}
        onOpenChange={setShowRecordPayment}
        order={order}
        onSuccess={() => {
          fetchTransactions();
          onSuccess();
        }
        }
      />

      {/* Delete Order Confirmation Dialog */}
      <AlertDialog open={showOrderDeleteConfirm} onOpenChange={setShowOrderDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete order #{order?.orderNumber}? This action cannot be undone.
              This will permanently delete the order and restore inventory stock levels.
              {order?.payments && order.payments.length > 0 && (
                <span className="block mt-2 text-red-600 font-semibold">
                  Warning: This order has payment records that will also be deleted.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOrder}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete Order'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
