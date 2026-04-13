"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    CreditCard,
    DollarSign,
    TrendingUp,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Clock,
    RefreshCw,
    MoreHorizontal,
    Plus,
    Settings,
    Shield,
    Zap,
    Search
} from "lucide-react";
import { api, Order } from "@/lib/api";
import { EditOrderDialog } from "@/components/orders/edit-order-dialog";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import * as XLSX from 'xlsx';
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { getToken } from "@/lib/api";
import logger from '@/lib/logger';
import { useIsMobile } from "@/hooks/use-is-mobile";
import { SendReportDialog } from "@/components/shared/send-report-dialog";


const StatusBadge = ({ status }: { status: string }) => {
    const norm = (status || '').toString().trim();
    const label = norm.charAt(0).toUpperCase() + norm.slice(1).toLowerCase();
    const variants: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
        Completed: "default",
        Pending: "secondary",
        Failed: "destructive",
        Refunded: "outline",
    };

    const icons: { [key: string]: React.ReactNode } = {
        Completed: <CheckCircle className="h-3 w-3" />,
        Pending: <Clock className="h-3 w-3" />,
        Failed: <XCircle className="h-3 w-3" />,
        Refunded: <RefreshCw className="h-3 w-3" />,
    };

    return (
        <Badge variant={variants[label] ?? "outline"} className="flex items-center gap-1">
            {icons[label]}
            {label}
        </Badge>
    );
};

const GatewayStatus = ({ status }: { status: string }) => {
    const variants: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
        Connected: "default",
        "Not Connected": "destructive",
        Manual: "secondary",
    };

    return <Badge variant={variants[status]}>{status}</Badge>;
};

export function PaymentsContent() {
    const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [recordDialogOpen, setRecordDialogOpen] = useState(false);
    const [orders, setOrders] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [details, setDetails] = useState<any | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalTransactions, setTotalTransactions] = useState(0);
    const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
    const [selectAll, setSelectAll] = useState(false);
    const [orderDialogOpen, setOrderDialogOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [stats, setStats] = useState({
        totalRevenue: 0,
        pendingAmount: 0,
        failedCount: 0,
        successRate: 0
    });
    const isMobile = useIsMobile();
    const [showEmailDialog, setShowEmailDialog] = useState(false);

    const gatewayResponseView = (tx: any) => {
        const raw = tx?.paymentGatewayResponse;
        if (!raw) {
            return (
                <div className="text-muted-foreground text-sm">
                    No gateway response recorded for this transaction.
                </div>
            );
        }

        const FIELD_META: Record<
            string,
            {
                title: string;
                description: string;
                meanings?: Record<string, string>;
            }
        > = {
            responseCode: {
                title: 'Response Code',
                description: 'Overall status of the transaction.',
                meanings: {
                    '1': 'Approved',
                    '2': 'Declined',
                    '3': 'Error',
                    '4': 'Held for Review',
                },
            },
            avsResultCode: {
                title: 'AVS Result',
                description: 'Address Verification Service (AVS) response code.',
                meanings: {
                    A: 'The street address matched, but the postal code did not.',
                    B: 'No address information was provided.',
                    E: 'The AVS check returned an error.',
                    G: 'The card was issued by a bank outside the U.S. and does not support AVS.',
                    N: 'Neither the street address nor postal code matched.',
                    P: 'AVS is not applicable for this transaction.',
                    R: 'Retry — AVS was unavailable or timed out.',
                    S: 'AVS is not supported by card issuer.',
                    U: 'Address information is unavailable.',
                    W: 'The US ZIP+4 code matches, but the street address does not.',
                    X: 'Both the street address and the US ZIP+4 code matched.',
                    Y: 'The street address and postal code matched.',
                    Z: 'The postal code matched, but the street address did not.',
                },
            },
            cvvResultCode: {
                title: 'CVV Result',
                description: 'Card code verification (CVV) response code.',
                meanings: {
                    M: 'CVV matched.',
                    N: 'CVV did not match.',
                    P: 'CVV was not processed.',
                    S: 'CVV should have been present but was not indicated.',
                    U: 'The issuer was unable to process the CVV check.',
                },
            },
            cavvResultCode: {
                title: 'CAVV Result',
                description:
                    'Cardholder authentication verification response code (often blank for Mastercard).',
                meanings: {
                    '': 'CAVV not validated.',
                    '0': 'CAVV was not validated because erroneous data was submitted.',
                    '1': 'CAVV failed validation.',
                    '2': 'CAVV passed validation.',
                    '3': 'CAVV validation could not be performed; issuer attempt incomplete.',
                    '4': 'CAVV validation could not be performed; issuer system error.',
                    '5': 'Reserved for future use.',
                    '6': 'Reserved for future use.',
                    '7': 'CAVV failed validation, but the issuer is available.',
                    '8': 'CAVV passed validation and the issuer is available.',
                    '9': 'CAVV failed validation and the issuer is unavailable.',
                    A: 'CAVV passed validation but the issuer unavailable.',
                    B: 'CAVV passed validation, information only, no liability shift.',
                },
            },
        };

        const formatPrimitive = (v: any) => {
            if (v === null) return 'null';
            if (typeof v === 'undefined') return 'undefined';
            if (typeof v === 'string') return v;
            if (typeof v === 'number' || typeof v === 'boolean') return String(v);
            return JSON.stringify(v);
        };

        const isObject = (v: any) => v && typeof v === 'object' && !Array.isArray(v);

        const renderNode = (label: string, value: any): React.ReactNode => {
            if (Array.isArray(value)) {
                return (
                    <div className="rounded-lg border bg-muted/10 p-2 sm:p-3 space-y-3">
                        <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {label}
                        </div>
                        {value.length === 0 ? (
                            <div className="text-sm text-muted-foreground">(empty)</div>
                        ) : (
                            <div className="space-y-3">
                                {value.map((item, idx) => (
                                    <div key={`${label}-${idx}`} className="rounded-md border bg-background p-2 sm:p-3 space-y-2">
                                        <div className="text-[10px] sm:text-xs font-semibold text-muted-foreground">#{idx + 1}</div>
                                        {renderNode('Item', item)}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            }

            if (isObject(value)) {
                const entries = Object.entries(value);
                return (
                    <div className="rounded-lg border bg-muted/10 p-2 sm:p-3 space-y-3">
                        <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {label}
                        </div>
                        {entries.length === 0 ? (
                            <div className="text-sm text-muted-foreground">(empty)</div>
                        ) : (
                            <div className="space-y-2 border-l pl-2 sm:pl-3">
                                {entries.map(([k, v]) => (
                                    <div key={`${label}-${k}`}>{renderNode(k, v)}</div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            }

            return (
                <div className="flex flex-col lg:grid lg:grid-cols-12 gap-1 lg:gap-3 items-start">
                    <div className="lg:col-span-5 text-xs text-muted-foreground break-words">
                        <div className="font-semibold lg:font-medium text-foreground">
                            {FIELD_META[label]?.title ?? label}
                        </div>
                        {FIELD_META[label]?.description ? (
                            <div className="mt-0.5 lg:mt-1 text-[10px] lg:text-[11px] leading-snug text-muted-foreground">
                                {FIELD_META[label].description}
                            </div>
                        ) : null}
                    </div>
                    <div className="lg:col-span-7 w-full lg:w-auto">
                        <div className="inline-block w-full lg:max-w-full font-mono text-[11px] lg:text-sm bg-muted/20 rounded px-2 py-1 break-all">
                            {formatPrimitive(value)}
                        </div>
                        {FIELD_META[label]?.meanings ? (
                            <div className="mt-1 text-[11px] leading-snug text-muted-foreground">
                                {(() => {
                                    const key = typeof value === 'string' ? value : String(value ?? '');
                                    const meaning = FIELD_META[label].meanings?.[key] ??
                                        (key === '' ? FIELD_META[label].meanings?.[''] : undefined);
                                    return meaning ? `${key || 'Blank'} — ${meaning}` : null;
                                })()}
                            </div>
                        ) : null}
                    </div>
                </div>
            );
        };

        const rawString = typeof raw === 'string' ? raw : JSON.stringify(raw);
        try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            const pretty = JSON.stringify(parsed, null, 2);
            return (
                <div className="max-h-[52vh] overflow-auto pr-1 space-y-4">
                    {renderNode('Response', parsed)}

                    <div className="pt-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                            Raw JSON
                        </div>
                        <pre className="text-xs whitespace-pre-wrap break-words overflow-auto rounded-md border bg-muted/20 p-3">
                            {pretty}
                        </pre>
                    </div>
                </div>
            );
        } catch {
            return (
                <pre className="text-xs whitespace-pre-wrap break-words overflow-auto max-h-[52vh] rounded-md border bg-muted/20 p-3">
                    {rawString}
                </pre>
            );
        }
    };

    // Fetch orders and customers for the form
    useEffect(() => {
        if (recordDialogOpen) {
            // Fetch only orders with pending payments
            api.getOrders({ limit: 100, status: 'PENDING' }).then(res => {
                logger.info('Orders API response:', { data: res });
                if (res.success && res.data) {
                    // Handle both possible response structures
                    const ordersData = Array.isArray(res.data) ? res.data : res.data.orders || [];
                    // Filter to only show orders that don't have completed payments
                    const pendingOrders = ordersData.filter(order => {
                        // Check if order has any completed payments
                        const hasCompletedPayment = order.payments && order.payments.some((payment: any) =>
                            payment.status === 'COMPLETED' || payment.status === 'PAID'
                        );
                        return !hasCompletedPayment;
                    });
                    setOrders(pendingOrders);
                }
            });
            api.getCustomers({ limit: 100 }).then(res => {
                logger.info('Customers API response:', { data: res });
                if (res.success && res.data) {
                    // Handle both possible response structures
                    const customersData = Array.isArray(res.data) ? res.data : res.data.customers || [];
                    setCustomers(customersData);
                }
            });
        }
    }, [recordDialogOpen]);

    useEffect(() => {
        setLoading(true);
        setError(null);
        const token = getToken();
        logger.info('[Payments] Token in localStorage:', { data: token });
        const params: any = { page, limit: pageSize };
        if (statusFilter !== 'all') {
            params.paymentStatus = statusFilter.toUpperCase();
        }
        if (searchTerm) {
            params.search = searchTerm;
        }
        api.getTransactions(params)
            .then((res: any) => {
                logger.info('[Payments] /transactions API response:', { data: res });
                if (res.success && res.data) {
                    // Backend returns transactions in res.data array and pagination at top level
                    const transactionsData = Array.isArray(res.data) ? res.data : res.data.transactions || [];
                    const pagination = (res as any).pagination || {};
                    setTransactions(transactionsData);
                    setPageSize(pagination.limit || 20);
                    setTotalPages(pagination.pages || 1);
                    setTotalTransactions(pagination.total || 0);
                    if (res.stats) {
                        setStats(res.stats);
                    }
                } else {
                    setError(res.error || "Failed to load transactions");
                    // Only show toast if API call actually failed
                    if (!res.success) {
                        toast.error(res.error || "Failed to load transactions");
                    }
                }
            })
            .catch((e: any) => {
                logger.error('[Payments] Exception while loading transactions:', { error: e });
                setError(e.message || "Failed to load transactions");
                toast.error(e.message || "Failed to load transactions");
            })
            .finally(() => setLoading(false));
    }, [page, pageSize, statusFilter, searchTerm]);

    // Metrics are now provided by the backend global stats
    const totalRevenue = stats.totalRevenue;
    const pendingAmount = stats.pendingAmount;
    const failedCount = stats.failedCount;
    const successRate = stats.successRate;

    // Use transactions directly from API (already paginated and filtered server-side)
    const pageItems = transactions;

    async function onViewDetails(id: string) {
        try {
            const res = await api.getTransaction(id);
            if (res.success && res.data) {
                setDetails(res.data);
            } else {
                setDetails(null);
            }
        } catch {
            setDetails(null);
        } finally {
            setDetailsOpen(true);
        }
    }

    async function onOpenOrderFromDetails(orderId: string) {
        try {
            const res = await api.getOrder(orderId);
            if (res.success && res.data) {
                setSelectedOrder(res.data as unknown as Order);
                setOrderDialogOpen(true);
            } else {
                toast.error("Failed to load order details");
            }
        } catch (e: any) {
            toast.error(e?.message || "Failed to load order details");
        }
    }

    async function refreshTransactions() {
        setLoading(true);
        try {
            const res = await api.getTransactions({ page, limit: pageSize });
            if (res.success && res.data) {
                const transactionsData = Array.isArray(res.data) ? res.data : res.data.transactions || [];
                const pagination = (res as any).pagination || {};
                setTransactions(transactionsData);
                setPageSize(pagination.limit || 20);
                setTotalPages(pagination.pages || 1);
                setTotalTransactions(pagination.total || 0);
                if (res.stats) {
                    setStats(res.stats);
                }
            }
        } finally {
            setLoading(false);
        }
    }

    function onDownloadReceipt(tx: any) {
        const doc = new jsPDF({ unit: 'pt', format: 'a4' });
        const left = 48;
        let y = 64;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('Payment Receipt', left, y);
        y += 24;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        const add = (label: string, value: string) => {
            doc.setFont('helvetica', 'bold');
            doc.text(`${label}:`, left, y);
            doc.setFont('helvetica', 'normal');
            doc.text(value || '-', left + 120, y);
            y += 18;
        };
        add('Transaction ID', `${tx.id}`);
        add('Order ID', `${tx.orderId}`);
        add('Customer', tx?.order?.customer ? `${tx.order.customer.firstName} ${tx.order.customer.lastName}` : 'N/A');
        add('Amount', `$${Number(tx.amount).toFixed(2)}`);
        add('Method', `${tx.paymentGatewayName}`);
        add('Gateway', `${tx.paymentGatewayName}`);
        add('Status', `${tx.paymentStatus}`);
        add('Date', new Date(tx.createdAt).toLocaleString());
        y += 16;
        doc.setDrawColor(200);
        doc.line(left, y, left + 480, y);
        y += 24;
        doc.setFont('helvetica', 'italic');
        doc.text('Thank you for your payment.', left, y);
        doc.save(`receipt-${tx.id}.pdf`);
    }

    const handleSelectTransaction = (transactionId: string) => {
        setSelectedTransactions(prev =>
            prev.includes(transactionId)
                ? prev.filter(id => id !== transactionId)
                : [...prev, transactionId]
        );
    };

    const handleSelectAll = () => {
        if (selectAll) {
            setSelectedTransactions([]);
            setSelectAll(false);
        } else {
            setSelectedTransactions(pageItems.map(t => t.id));
            setSelectAll(true);
        }
    };

    const handleBulkExport = () => {
        if (selectedTransactions.length === 0) {
            toast.error('Please select transactions to export');
            return;
        }

        const selectedData = pageItems.filter(t => selectedTransactions.includes(t.id));
        const exportData = selectedData.map(transaction => ({
            'Transaction ID': transaction.id,
            'Order ID': transaction.orderId,
            'Customer': transaction.order?.customer
                ? `${transaction.order.customer.firstName} ${transaction.order.customer.lastName}`
                : 'N/A',
            'Customer Email': transaction.order?.customer?.email || 'N/A',
            'Amount': `$${parseFloat(transaction.amount).toFixed(2)}`,
            'Payment Method': transaction.paymentGatewayName,
            'Status': transaction.paymentStatus,
            'Gateway Transaction ID': transaction.paymentGatewayTransactionId || '',
            'Date': new Date(transaction.createdAt).toLocaleString(),
            'Completed At': transaction.completedAt ? new Date(transaction.completedAt).toLocaleString() : ''
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

        const fileName = `transactions-export-${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);

        toast.success(`Exported ${selectedTransactions.length} transactions to ${fileName}`);
        setSelectedTransactions([]);
        setSelectAll(false);
    };

    const handleSendEmailReport = async (email: string) => {
        return api.sendTransactionsEmailReport({
            email,
            paymentStatus: statusFilter !== 'all' ? statusFilter.toUpperCase() : undefined,
            search: searchTerm || undefined,
        });
    };

    const form = useForm({
        defaultValues: {
            orderId: "",
            amount: "",
            paymentMethod: "",
            paymentGatewayName: "MANUAL",
            paymentStatus: "COMPLETED",
            paymentGatewayTransactionId: "",
            notes: ""
        }
    });
    const { register, handleSubmit, reset, setValue } = form;

    const onSubmit = async (data: any) => {
        setSubmitting(true);
        try {
            logger.info('Form data submitted:', { data: data });

            // Validate required fields
            if (!data.orderId || !data.amount || !data.paymentGatewayName || !data.paymentStatus) {
                logger.info('Missing required fields:', {
                    data: {
                        orderId: data.orderId,
                        amount: data.amount,
                        paymentGatewayName: data.paymentGatewayName,
                        paymentStatus: data.paymentStatus
                    }
                });
                toast.error('Please fill in all required fields');
                setSubmitting(false);
                return;
            }

            // Validate amount is a positive number
            const amount = parseFloat(data.amount);
            if (isNaN(amount) || amount <= 0) {
                toast.error('Please enter a valid amount');
                setSubmitting(false);
                return;
            }

            const order = orders.find((o: any) => o.id === data.orderId);
            const payload = {
                orderId: data.orderId,
                amount: amount.toFixed(2),
                paymentGatewayName: data.paymentGatewayName,
                paymentStatus: data.paymentStatus,
                paymentGatewayTransactionId: data.paymentGatewayTransactionId || undefined,
                paymentGatewayResponse: undefined,
            };

            logger.info('Payload being sent:', { data: payload });
            const res = await api.createTransaction(payload);
            if (res.success) {
                toast.success("Payment recorded");
                setRecordDialogOpen(false);
                reset();
                // Refresh transactions
                setLoading(true);
                api.getTransactions({ page, limit: pageSize }).then((res: any) => {
                    if (res.success && res.data) {
                        const transactionsData = Array.isArray(res.data) ? res.data : res.data.transactions || [];
                        const pagination = (res as any).pagination || {};
                        setTransactions(transactionsData);
                        setPageSize(pagination.limit || 20);
                        setTotalPages(pagination.pages || 1);
                        setTotalTransactions(pagination.total || 0);
                        if (res.stats) {
                            setStats(res.stats);
                        }
                    }
                    setLoading(false);
                }).catch(() => {
                    setLoading(false);
                });
            } else {
                toast.error(res.error || "Failed to record payment");
            }
        } catch (e: any) {
            toast.error(e.message || "Failed to record payment");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-2 sm:px-0">
                <div>
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">Payments</h1>
                    <p className="text-muted-foreground text-xs sm:text-sm lg:text-base">
                        Manage payment processing, transactions, and gateway settings.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    <Button onClick={() => setRecordDialogOpen(true)} className="w-full sm:w-auto">
                        <Plus className="h-4 w-4 mr-2" /> Record Payment
                    </Button>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 w-full px-2 sm:px-0">
                <Card className="py-0 sm:py-0 gap-0">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 py-1 pb-0 sm:p-4 sm:py-2 sm:pb-0">
                        <CardTitle className="text-[10px] sm:text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-2 pt-0 pb-1 sm:p-4 sm:pt-0 sm:pb-2">
                        <div className="text-base sm:text-2xl font-bold truncate leading-tight">${totalRevenue.toLocaleString()}</div>
                        <div className="flex items-center text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                            <TrendingUp className="h-2 w-2 sm:h-3 sm:w-3 mr-1 text-green-500" />
                            +12.5%
                        </div>
                    </CardContent>
                </Card>

                <Card className="py-0 sm:py-0 gap-0">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 py-1 pb-0 sm:p-4 sm:py-2 sm:pb-0">
                        <CardTitle className="text-[10px] sm:text-sm font-medium">Pending Payments</CardTitle>
                        <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-2 pt-0 pb-1 sm:p-4 sm:pt-0 sm:pb-2">
                        <div className="text-base sm:text-2xl font-bold truncate leading-tight">${pendingAmount.toLocaleString()}</div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                            Awaiting processing
                        </p>
                    </CardContent>
                </Card>

                <Card className="py-0 sm:py-0 gap-0">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 py-1 pb-0 sm:p-4 sm:py-2 sm:pb-0">
                        <CardTitle className="text-[10px] sm:text-sm font-medium">Success Rate</CardTitle>
                        <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-2 pt-0 pb-1 sm:p-4 sm:pt-0 sm:pb-2">
                        <div className="text-base sm:text-2xl font-bold truncate leading-tight">{successRate.toFixed(1)}%</div>
                        <div className="flex items-center text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                            <TrendingUp className="h-2 w-2 sm:h-3 sm:w-3 mr-1 text-green-500" />
                            +2.1%
                        </div>
                    </CardContent>
                </Card>

                <Card className="py-0 sm:py-0 gap-0">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 py-1 pb-0 sm:p-4 sm:py-2 sm:pb-0">
                        <CardTitle className="text-[10px] sm:text-sm font-medium">Failed Transactions</CardTitle>
                        <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-2 pt-0 pb-1 sm:p-4 sm:pt-0 sm:pb-2">
                        <div className="text-base sm:text-2xl font-bold truncate leading-tight">{failedCount}</div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                            Requiring attention
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Transactions Section */}
            <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight px-2 sm:px-0 mb-4">Transactions</h2>
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div>
                                        <CardTitle>Recent Transactions</CardTitle>
                                        <CardDescription>
                                            View and manage payment transactions
                                        </CardDescription>
                                    </div>
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                                        {selectedTransactions.length > 0 && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleBulkExport}
                                                className="w-full sm:w-auto"
                                            >
                                                <Zap className="h-4 w-4 mr-2" />
                                                Export ({selectedTransactions.length})
                                            </Button>
                                        )}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full sm:w-auto"
                                            onClick={() => setShowEmailDialog(true)}
                                        >
                                            <Zap className="h-4 w-4 mr-2" />
                                            Email Report
                                        </Button>
                                        {!isMobile && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full sm:w-auto"
                                                onClick={() => {
                                                    const exportData = pageItems.map((transaction: any) => ({
                                                        'Transaction ID': transaction.id,
                                                        'Order ID': transaction.orderId,
                                                        'Customer': transaction.order?.customer
                                                            ? `${transaction.order.customer.firstName} ${transaction.order.customer.lastName}`
                                                            : 'N/A',
                                                        'Customer Email': transaction.order?.customer?.email || 'N/A',
                                                        'Amount': `$${parseFloat(transaction.amount).toFixed(2)}`,
                                                        'Payment Method': transaction.paymentGatewayName,
                                                        'Status': transaction.paymentStatus,
                                                        'Gateway Transaction ID': transaction.paymentGatewayTransactionId || '',
                                                        'Date': new Date(transaction.createdAt).toLocaleString(),
                                                        'Completed At': transaction.completedAt ? new Date(transaction.completedAt).toLocaleString() : ''
                                                    }));
                                                    const ws = XLSX.utils.json_to_sheet(exportData);
                                                    const wb = XLSX.utils.book_new();
                                                    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
                                                    const fileName = `transactions-all-${new Date().toISOString().split('T')[0]}.xlsx`;
                                                    XLSX.writeFile(wb, fileName);
                                                    toast.success(`Exported ${pageItems.length} transactions to ${fileName}`);
                                                }}
                                            >
                                                <Zap className="h-4 w-4 mr-2" />
                                                Export All
                                            </Button>
                                        )}
                                        <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
                                            <SelectTrigger className="w-full sm:w-32">
                                                <SelectValue placeholder="Filter" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Status</SelectItem>
                                                <SelectItem value="completed">Completed</SelectItem>
                                                <SelectItem value="pending">Pending</SelectItem>
                                                <SelectItem value="failed">Failed</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                {/* Search Bar */}
                                <div className="relative w-full">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search by transaction ID, order ID, payment ID, customer name or email..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto -mx-6">
                                <Table className="min-w-[1000px]">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-12">
                                                <Checkbox
                                                    checked={selectAll}
                                                    onCheckedChange={handleSelectAll}
                                                />
                                            </TableHead>
                                            <TableHead>Transaction ID</TableHead>
                                            <TableHead>Order</TableHead>
                                            <TableHead>Customer</TableHead>
                                            <TableHead>Amount</TableHead>
                                            <TableHead>Method</TableHead>
                                            <TableHead>Gateway</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow><TableCell colSpan={10}>Loading...</TableCell></TableRow>
                                        ) : error && (transactions === null || transactions === undefined) ? (
                                            <TableRow><TableCell colSpan={10}>Failed to load transactions.</TableCell></TableRow>
                                        ) : Array.isArray(transactions) && transactions.length === 0 ? (
                                            <TableRow><TableCell colSpan={10}>No transactions found.</TableCell></TableRow>
                                        ) : (
                                            pageItems.map((transaction) => (
                                                <TableRow key={transaction.id}>
                                                    <TableCell>
                                                        <Checkbox
                                                            checked={selectedTransactions.includes(transaction.id)}
                                                            onCheckedChange={() => handleSelectTransaction(transaction.id)}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        <button
                                                            className="text-primary hover:underline"
                                                            onClick={() => onViewDetails(transaction.id)}
                                                        >
                                                            {transaction.id}
                                                        </button>
                                                    </TableCell>
                                                    <TableCell>{transaction.orderId}</TableCell>
                                                    <TableCell>
                                                        {transaction.order?.customer
                                                            ? `${transaction.order.customer.firstName} ${transaction.order.customer.lastName}`
                                                            : 'N/A'
                                                        }
                                                    </TableCell>
                                                    <TableCell>${parseFloat(transaction.amount).toFixed(2)}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <CreditCard className="h-4 w-4" />
                                                            <span className="truncate max-w-[160px]">
                                                                {transaction.paymentGatewayName === 'MANUAL' ? 'Manual' : transaction.paymentGatewayName === 'AUTHORIZE_NET' ? 'Direct' : (transaction.paymentGatewayName || 'Other')}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">
                                                            {transaction.paymentGatewayName === 'MANUAL'
                                                                ? 'Zelle/Bank Wire'
                                                                : transaction.paymentGatewayName === 'AUTHORIZE_NET'
                                                                    ? 'Authorize.Net'
                                                                    : (transaction.paymentGatewayName || 'Other')}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <StatusBadge status={transaction.paymentStatus} />
                                                    </TableCell>
                                                    <TableCell>
                                                        {new Date(transaction.createdAt).toLocaleDateString()}
                                                    </TableCell>
                                                    <TableCell>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onViewDetails(transaction.id); }}>
                                                                    View Details
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onDownloadReceipt(transaction); }}>
                                                                    Download Receipt
                                                                </DropdownMenuItem>
                                                                {transaction.paymentStatus === "FAILED" && (
                                                                    <>
                                                                        <DropdownMenuSeparator />
                                                                        <DropdownMenuItem>
                                                                            Retry Payment
                                                                        </DropdownMenuItem>
                                                                    </>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="mt-4 pt-4 border-t">
                                <Pagination
                                    currentPage={page}
                                    totalPages={totalPages}
                                    onPageChange={setPage}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Transaction Details Dialog */}
            <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[560px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Transaction Details</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {details ? (
                            <Tabs defaultValue="summary" className="w-full">
                                <TabsList className="w-full">
                                    <TabsTrigger value="summary" className="flex-1">Summary</TabsTrigger>
                                    <TabsTrigger value="gateway" className="flex-1">Gateway Response</TabsTrigger>
                                </TabsList>

                                <TabsContent value="summary" className="mt-4">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                                        <div className="flex flex-col lg:gap-1">
                                            <span className="text-[10px] lg:text-xs font-semibold uppercase tracking-wide text-muted-foreground">ID:</span>
                                            <span className="font-medium break-all text-xs lg:text-sm">{details.id}</span>
                                        </div>
                                        <div className="flex flex-col lg:gap-1">
                                            <span className="text-[10px] lg:text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order ID:</span>
                                            <button
                                                className="font-medium break-all text-blue-600 hover:underline text-left text-xs lg:text-sm"
                                                onClick={() => onOpenOrderFromDetails(details.orderId)}
                                                title="View order details"
                                            >
                                                {details.orderId}
                                            </button>
                                        </div>
                                        <div className="flex flex-col lg:gap-1">
                                            <span className="text-[10px] lg:text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer</span>
                                            <span className="font-medium text-xs lg:text-sm">{details?.order?.customer ? `${details.order.customer.firstName} ${details.order.customer.lastName}` : 'N/A'}</span>
                                        </div>
                                        <div className="flex flex-col lg:gap-1">
                                            <span className="text-[10px] lg:text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount</span>
                                            <span className="font-semibold text-xs lg:text-sm">${Number(details.amount).toFixed(2)}</span>
                                        </div>
                                        <div className="flex flex-col lg:gap-1">
                                            <span className="text-[10px] lg:text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gateway</span>
                                            <span className="font-medium text-xs lg:text-sm">{details.paymentGatewayName}</span>
                                        </div>
                                        <div className="flex flex-col lg:gap-1">
                                            <span className="text-[10px] lg:text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gateway Txn</span>
                                            <span className="font-medium break-all text-xs lg:text-sm">{details.paymentGatewayTransactionId || '-'}</span>
                                        </div>
                                        <div className="flex flex-col lg:gap-1">
                                            <span className="text-[10px] lg:text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</span>
                                            <div>
                                                <StatusBadge status={details.paymentStatus} />
                                            </div>
                                        </div>
                                        <div className="flex flex-col lg:gap-1">
                                            <span className="text-[10px] lg:text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</span>
                                            <span className="font-medium text-xs lg:text-sm">{new Date(details.createdAt).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="gateway" className="mt-4">
                                    {gatewayResponseView(details)}
                                </TabsContent>
                            </Tabs>
                        ) : (
                            <div className="text-muted-foreground text-sm">No details available.</div>
                        )}

                        {details && (
                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="outline" onClick={() => setDetailsOpen(false)}>Close</Button>
                                <Button onClick={() => onDownloadReceipt(details)}>Download Receipt (PDF)</Button>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Order Details Dialog (reused EditOrderDialog) */}
            <EditOrderDialog
                order={selectedOrder}
                open={orderDialogOpen}
                onOpenChange={(open) => setOrderDialogOpen(open)}
                onSuccess={() => {
                    refreshTransactions();
                }}
            />

            <Dialog open={recordDialogOpen} onOpenChange={setRecordDialogOpen}>
                <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[500px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5" />
                            Record Payment
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        {/* Order Selection */}
                        <div className="space-y-2">
                            <Label htmlFor="record-order-id">Select order</Label>
                            <Select onValueChange={(value) => {
                                setValue("orderId", value);
                                // Auto-populate amount when order is selected
                                const selectedOrder = orders.find(order => order.id === value);
                                if (selectedOrder) {
                                    setValue("amount", selectedOrder.totalAmount.toString());
                                }
                            }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select order" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px]">
                                    {orders.map((order) => (
                                        <SelectItem key={order.id} value={order.id}>
                                            {order.id.slice(-8)} - {order.customer?.firstName} {order.customer?.lastName} (${parseFloat(order.totalAmount).toFixed(2)})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Order Information Display */}
                        {form.watch("orderId") && (() => {
                            const selectedOrder = orders.find(order => order.id === form.watch("orderId"));
                            return selectedOrder ? (
                                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                                    <div className="font-medium">Order #{selectedOrder.id.slice(-8)}</div>
                                    {selectedOrder.customer && (
                                        <div className="text-sm text-muted-foreground">
                                            Customer: {selectedOrder.customer.firstName} {selectedOrder.customer.lastName} ({selectedOrder.customer.email})
                                        </div>
                                    )}
                                    <div className="text-sm text-muted-foreground">
                                        Total Amount: ${parseFloat(selectedOrder.totalAmount.toString()).toFixed(2)}
                                    </div>
                                </div>
                            ) : null;
                        })()}

                        {/* Payment Amount */}
                        <div className="space-y-2">
                            <Label htmlFor="record-amount">Amount</Label>
                            <Input
                                id="record-amount"
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                {...register("amount", {
                                    required: 'Payment amount is required',
                                    min: { value: 0.01, message: 'Amount must be greater than 0' }
                                })}
                            />
                        </div>

                        {/* Payment Method */}
                        <div className="space-y-2">
                            <Label htmlFor="record-payment-method">Select payment method</Label>
                            <Select
                                defaultValue="MANUAL"
                                onValueChange={(value) => setValue("paymentGatewayName", value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select payment method" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="MANUAL">Manual (Zelle/Bank Wire)</SelectItem>
                                    <SelectItem value="AUTHORIZE_NET">Authorize.Net</SelectItem>
                                    <SelectItem value="OTHER">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Payment Status */}
                        <div className="space-y-2">
                            <Label htmlFor="record-status">Status</Label>
                            <Select
                                defaultValue="COMPLETED"
                                onValueChange={(value) => setValue("paymentStatus", value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="COMPLETED">Completed</SelectItem>
                                    <SelectItem value="PENDING">Pending</SelectItem>
                                    <SelectItem value="FAILED">Failed</SelectItem>
                                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                                    <SelectItem value="REFUNDED">Refunded</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Transaction ID */}
                        <div className="space-y-2">
                            <Label htmlFor="record-transaction-id">Enter transaction ID</Label>
                            <Input
                                id="record-transaction-id"
                                placeholder="Enter transaction ID"
                                {...register("paymentGatewayTransactionId")}
                            />
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label htmlFor="record-notes">Add any notes about this payment...</Label>
                            <Input
                                id="record-notes"
                                placeholder="Add any notes about this payment..."
                                {...register("notes")}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setRecordDialogOpen(false)} disabled={submitting}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={submitting}>
                                {submitting ? "Recording..." : "Record Payment"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <SendReportDialog
                open={showEmailDialog}
                onOpenChange={setShowEmailDialog}
                onSend={handleSendEmailReport}
                title="Email Transactions Report"
                description="The transactions report will be generated and sent to your email as an Excel attachment."
            />
        </div>
    );
}
