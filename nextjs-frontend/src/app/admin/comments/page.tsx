'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { ProtectedRoute } from '@/contexts/auth-context';
import { api, Comment, CommentType } from '@/lib/api';
import logger from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
    MessageSquare,
    Search,
    Trash2,
    ExternalLink,
    User,
    ShoppingBag
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Badge } from '@/components/ui/badge';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Pagination } from '@/components/ui/pagination';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CommentSection } from '@/components/comments/comment-section';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';

export default function AdminCommentsPage() {
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; commentId: string | null }>({
        open: false,
        commentId: null
    });
    const [selectedComment, setSelectedComment] = useState<Comment | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const router = useRouter();

    const fetchComments = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.getComments({
                type: typeFilter === 'all' ? undefined : typeFilter as CommentType,
                search: searchTerm || undefined,
                page,
                limit: 20
            });

            if (response.success && response.data?.items) {
                setComments(response.data.items);
                setTotalPages(response.data.pagination.pages);
            } else {
                toast.error('Failed to fetch comments');
            }
        } catch (error) {
            logger.error('Error fetching comments:', { error });
            toast.error('An error occurred while fetching comments');
        } finally {
            setLoading(false);
        }
    }, [typeFilter, searchTerm, page]);

    useEffect(() => {
        fetchComments();
    }, [fetchComments]);

    const handleDeleteClick = (id: string) => {
        setDeleteConfirm({ open: true, commentId: id });
    };

    const confirmDelete = async () => {
        if (!deleteConfirm.commentId) return;
        setDeleting(true);
        try {
            const response = await api.deleteComment(deleteConfirm.commentId);
            if (response.success) {
                toast.success('Comment deleted successfully');
                fetchComments();
                setDeleteConfirm({ open: false, commentId: null });
            } else {
                toast.error(response.error || 'Failed to delete comment');
            }
        } catch (error) {
            logger.error('Error deleting comment:', { error });
            toast.error('An error occurred while deleting the comment');
        } finally {
            setDeleting(false);
        }
    };

    const getTargetLink = (comment: Comment) => {
        if (comment.type === 'ORDER' && comment.orderId) {
            return `/orders?search=${comment.order?.orderNumber || comment.orderId}`;
        } else if (comment.type === 'CUSTOMER' && comment.customerId) {
            return `/customers?search=${comment.customer?.email || comment.customerId}`;
        }
        return '#';
    };

    const handleViewComment = (comment: Comment) => {
        setSelectedComment(comment);
        setDetailsOpen(true);
    };

    return (
        <ProtectedRoute requiredRoles={['ADMIN', 'MANAGER', 'STAFF']}>
            <DashboardLayout>
                <div className="space-y-0">

                    {/* ════════ DARK HERO STRIP ════════ */}
                    <div className="relative bg-mist border border-line border-t-2 border-t-[#5A9ADA] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
                        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                        <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#5A9ADA]/8 rounded-full blur-[100px] pointer-events-none" />

                        <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                                <div>
                                    <h1 className="text-xl font-black text-[#043061] tracking-tight">Customer Comments</h1>
                                    <p className="text-xs text-gray-500 mt-0.5">Manage and moderate customer feedback</p>
                                </div>
                                <div className="flex items-center gap-2.5 bg-white border border-line rounded-xl px-4 py-2">
                                    <MessageSquare className="h-4 w-4 text-[#5A9ADA]" />
                                    <div>
                                        <p className="text-[9px] text-gray-500 font-medium uppercase tracking-widest leading-none">Comments</p>
                                        <p className="text-base font-black text-[#043061] tabular-nums leading-tight">{comments.length.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Type pills */}
                            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
                                {[
                                    { key: 'all',     label: 'All',          color: null },
                                    { key: 'ORDER',    label: 'Order',    color: 'amber' },
                                    { key: 'CUSTOMER', label: 'Customer', color: 'blue' },
                                ].map((pill) => {
                                    const colorStyles: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
                                        blue:   { bg: 'bg-blue-500/15',   text: 'text-blue-400',   ring: 'ring-blue-500/30',   dot: 'bg-blue-400' },
                                        amber:  { bg: 'bg-amber-500/15',  text: 'text-amber-400',  ring: 'ring-amber-500/30',  dot: 'bg-amber-400' },
                                    };
                                    const c = pill.color ? colorStyles[pill.color] : null;
                                    const isAll = pill.key === 'all';
                                    const isActive = isAll ? typeFilter === 'all' : typeFilter === pill.key;
                                    return (
                                        <button
                                            key={pill.key}
                                            onClick={() => { setTypeFilter(pill.key); setPage(1); }}
                                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                                isAll && isActive ? 'bg-[#043061] text-white ring-1 ring-[#043061]/20'
                                                : isActive && c ? `${c.bg} ${c.text} ring-1 ${c.ring}`
                                                : 'bg-white/[0.04] text-gray-500 hover:bg-white/[0.08] hover:text-gray-300'
                                            }`}
                                        >
                                            {c && <span className={`w-1.5 h-1.5 rounded-full ${isActive ? c.dot : 'bg-gray-600'}`} />}
                                            <span>{pill.label}</span>
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
                                placeholder="Search comments by content or customer…"
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                                className="pl-10 h-9 bg-white border-gray-200 rounded-xl text-xs placeholder:text-gray-400"
                            />
                        </div>
                    </div>

                    {/* ════════ TABLE ════════ */}
                    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden mx-1 sm:mx-0">
                        <div className="overflow-x-auto">
                            {loading ? (
                                <div className="flex justify-center items-center py-16">
                                    <div className="w-8 h-8 border-2 border-[#5A9ADA]/30 border-t-[#5A9ADA] rounded-full animate-spin" />
                                </div>
                            ) : comments.length === 0 ? (
                                <div className="text-center py-16 text-gray-400 text-sm">No comments found matching your search.</div>
                            ) : (
                                <Table className="min-w-[700px]">
                                    <TableHeader>
                                        <TableRow className="bg-gray-50/50 border-b border-gray-100">
                                            <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wider">Customer</TableHead>
                                            <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wider">Comment</TableHead>
                                            <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wider">Type</TableHead>
                                            <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wider">Date</TableHead>
                                            <TableHead className="text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {comments.map((comment) => (
                                            <TableRow key={comment.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50">
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-8 w-8 rounded-xl">
                                                            <AvatarFallback className="rounded-xl bg-[#043061] text-white text-xs font-black">
                                                                {comment.customer ? `${comment.customer.firstName?.[0]}${comment.customer.lastName?.[0]}`.toUpperCase() : '?'}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="text-sm font-bold text-gray-900">
                                                                {comment.customer ? `${comment.customer.firstName} ${comment.customer.lastName}` : 'Unknown'}
                                                            </p>
                                                            <p className="text-xs text-gray-400">{comment.customer?.email}</p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <p className="text-sm text-gray-700 max-w-[280px] line-clamp-2">{comment.content}</p>
                                                </TableCell>
                                                <TableCell>
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                                        comment.type === 'ORDER' ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                                        : 'bg-blue-50 text-blue-700 border border-blue-100'
                                                    }`}>
                                                        {comment.type}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-xs text-gray-400">
                                                    {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => { setSelectedComment(comment); setDetailsOpen(true); }}
                                                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                                        >
                                                            <ExternalLink className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteConfirm({ open: true, commentId: comment.id })}
                                                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                            {comments.length > 0 && totalPages > 1 && (
                                <div className="px-6 py-4 border-t border-gray-100">
                                    <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Comment Details Dialog */}
                    {selectedComment && (
                        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                            <DialogContent className="max-w-lg rounded-2xl">
                                <DialogHeader>
                                    <DialogTitle className="font-black text-[#043061]">Comment Details</DialogTitle>
                                    <DialogDescription>Full comment information</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 mt-2">
                                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                                        <p className="text-sm text-gray-700 leading-relaxed">{selectedComment.content}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { label: 'Customer', value: selectedComment.customer ? `${selectedComment.customer.firstName} ${selectedComment.customer.lastName}` : 'Unknown' },
                                            { label: 'Type', value: selectedComment.type },
                                            { label: 'Date', value: new Date(selectedComment.createdAt).toLocaleString() },
                                        ].map(({ label, value }) => (
                                            <div key={label} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{label}</p>
                                                <p className="text-sm font-semibold text-gray-800 mt-0.5">{value}</p>
                                            </div>
                                        ))}
                                    </div>
                                    {selectedComment.orderId && (
                                        <Button variant="outline" className="w-full rounded-xl text-xs font-bold" onClick={() => router.push(`/orders?id=${selectedComment.orderId}`)}>
                                            <ShoppingBag className="mr-1.5 h-3.5 w-3.5" />View Order
                                        </Button>
                                    )}
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}

                    {/* Delete Confirmation */}
                    <ConfirmationDialog
                        open={deleteConfirm.open}
                        onOpenChange={(o) => setDeleteConfirm({ open: o, commentId: null })}
                        onConfirm={async () => {
                            if (!deleteConfirm.commentId) return;
                            setDeleting(true);
                            try {
                                const response = await api.deleteComment(deleteConfirm.commentId);
                                if (response.success) {
                                    toast.success('Comment deleted');
                                    setDeleteConfirm({ open: false, commentId: null });
                                    fetchComments();
                                } else {
                                    toast.error(response.error || 'Failed to delete comment');
                                }
                            } catch (error) {
                                logger.error('Error deleting comment:', { error });
                                toast.error('Failed to delete comment');
                            } finally {
                                setDeleting(false);
                            }
                        }}
                        title="Delete Comment"
                        description="Are you sure you want to permanently delete this comment? This action cannot be undone."
                        confirmText="Delete"
                        cancelText="Cancel"
                        variant="destructive"
                        isLoading={deleting}
                    />
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
