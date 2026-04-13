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
    Filter,
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
        <ProtectedRoute requiredRoles={['ADMIN', 'MANAGER']}>
            <DashboardLayout>
                <div className="space-y-5 px-2 sm:px-0">
                    {/* Header */}
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">System Comments</h1>
                            <p className="text-muted-foreground">
                                Manage all internal notes and staff feedback across orders and customers.
                            </p>
                        </div>
                    </div>

                    {/* Filter Bar */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search by content, author, or target..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger className="w-full sm:w-[200px]">
                                    <SelectValue placeholder="Filter by type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="ORDER">Orders</SelectItem>
                                    <SelectItem value="CUSTOMER">Customers</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button
                                variant="outline"
                                onClick={() => { setSearchTerm(''); setTypeFilter('all'); setPage(1); }}
                            >
                                Reset
                            </Button>
                        </div>
                    </div>

                    {/* Table Card */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                                <MessageSquare className="h-4 w-4 text-blue-500" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold text-slate-900">Comments</h2>
                            </div>
                        </div>
                        {loading ? (
                            <div className="flex justify-center p-12">
                                <LoadingSpinner size={32} />
                            </div>
                        ) : comments.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                <p>No comments found matching your criteria.</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Author</TableHead>
                                        <TableHead>Content</TableHead>
                                        <TableHead>Target</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {comments.map((comment) => (
                                        <TableRow key={comment.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarFallback className="text-[10px]">
                                                            {comment.user?.firstName?.[0]}{comment.user?.lastName?.[0]}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium">
                                                            {comment.user?.firstName} {comment.user?.lastName}
                                                        </span>
                                                        <Badge variant="outline" className="text-[9px] h-3.5 uppercase px-1 w-fit">
                                                            {comment.user?.role}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="max-w-md">
                                                <p className="text-sm line-clamp-2">{comment.content}</p>
                                                {comment.parentId && (
                                                    <Badge variant="secondary" className="text-[9px] mt-1">Reply</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-1.5">
                                                        {comment.type === 'ORDER' ? (
                                                            <ShoppingBag className="h-3 w-3 text-blue-600" />
                                                        ) : (
                                                            <User className="h-3 w-3 text-green-600" />
                                                        )}
                                                        <span className="text-xs font-semibold">
                                                            {comment.type === 'ORDER' ? 'Order' : 'Customer'}
                                                        </span>
                                                    </div>
                                                    <Button
                                                        variant="link"
                                                        className="p-0 h-auto text-xs justify-start"
                                                        onClick={() => router.push(getTargetLink(comment))}
                                                    >
                                                        {comment.type === 'ORDER' ?
                                                            (comment.order?.orderNumber || 'View Order') :
                                                            (comment.customer?.firstName + ' ' + comment.customer?.lastName || 'View Customer')}
                                                        <ExternalLink className="h-3 w-3 ml-1" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleViewComment(comment)}
                                                    >
                                                        <MessageSquare className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-red-600"
                                                        onClick={() => handleDeleteClick(comment.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>

                    {totalPages > 1 && (
                        <div className="mt-4">
                            <Pagination
                                currentPage={page}
                                totalPages={totalPages}
                                onPageChange={setPage}
                            />
                        </div>
                    )}
                </div>

                <ConfirmationDialog
                    open={deleteConfirm.open}
                    onOpenChange={(open) => setDeleteConfirm({ ...deleteConfirm, open })}
                    onConfirm={confirmDelete}
                    title="Delete Comment"
                    description="Are you sure you want to delete this comment? This action cannot be undone and will also delete any replies to this comment."
                    confirmText="Delete"
                    cancelText="Cancel"
                    variant="destructive"
                    isLoading={deleting}
                />

                <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <MessageSquare className="h-5 w-5 text-blue-600" />
                                Comment Thread
                            </DialogTitle>
                            <DialogDescription>
                                {selectedComment?.type === 'ORDER'
                                    ? `Managing thread for Order: ${selectedComment.order?.orderNumber || selectedComment.orderId}`
                                    : `Managing thread for Customer: ${selectedComment?.customer?.firstName} ${selectedComment?.customer?.lastName}`
                                }
                            </DialogDescription>
                        </DialogHeader>

                        {selectedComment && (
                            <div className="mt-4">
                                <CommentSection
                                    type={selectedComment.type}
                                    orderId={selectedComment.orderId || undefined}
                                    customerId={selectedComment.customerId || undefined}
                                />
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
