'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Reply, Trash2, MessageSquare, ImagePlus, X, Image as ImageIcon, Eye } from 'lucide-react';
import { api, Comment, CommentType } from '@/lib/api';
import { formatDate } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
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

interface CommentSectionProps {
    type: CommentType;
    orderId?: string;
    customerId?: string;
    includeOrderComments?: boolean;
    onCommentAdded?: () => void;
}

export function CommentSection({ type, orderId, customerId, includeOrderComments, onCommentAdded }: CommentSectionProps) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [newComment, setNewComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [editingComment, setEditingComment] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [replyContent, setReplyContent] = useState('');
    const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
    const [selectedImages, setSelectedImages] = useState<File[]>([]);
    const [replyImages, setReplyImages] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const { user } = useAuth();

    const isStaff = !!(user && ["ADMIN", "MANAGER", "STAFF", "SALES_REP", "SALES_MANAGER"].includes(user.role));

    const fetchComments = async () => {
        try {
            setLoading(true);
            const res = await api.getComments({
                type,
                orderId,
                customerId,
                includeOrderComments,
                limit: 100, // Fetch all for now to show threads
            });
            if (res.success && res.data) {
                setComments(res.data.items || []);
            }
        } catch (error) {
            console.error('Error fetching comments:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchComments();
    }, [type, orderId, customerId, includeOrderComments]);

    const handleSubmitComment = async () => {
        if (!newComment.trim()) return;
        try {
            setSubmitting(true);

            let imageUrls: string[] = [];
            if (selectedImages.length > 0) {
                setIsUploading(true);
                const uploadRes = await api.uploadCommentImages(selectedImages);
                if (uploadRes.success && uploadRes.data) {
                    imageUrls = uploadRes.data;
                } else {
                    toast.error('Failed to upload images');
                    setSubmitting(false);
                    setIsUploading(false);
                    return;
                }
                setIsUploading(false);
            }

            const res = await api.createComment({
                type,
                content: newComment,
                orderId,
                customerId,
                images: imageUrls,
            });
            if (res.success) {
                setNewComment('');
                setSelectedImages([]);
                fetchComments();
                toast.success('Comment added');
                onCommentAdded?.();
            } else {
                toast.error(res.error || 'Failed to add comment');
            }
        } catch (error) {
            toast.error('Failed to add comment');
        } finally {
            setSubmitting(false);
            setIsUploading(false);
        }
    };

    const handleUpdateComment = async (id: string, content: string) => {
        if (!content.trim()) return;
        try {
            setSubmitting(true);
            const res = await api.updateComment(id, content);
            if (res.success) {
                setEditingComment(null);
                setEditContent('');
                fetchComments();
                toast.success('Comment updated');
            } else {
                toast.error(res.error || 'Failed to update comment');
            }
        } catch (error) {
            toast.error('Failed to update comment');
        } finally {
            setSubmitting(false);
        }
    };

    const handleReply = async (parentId: string) => {
        if (!replyContent.trim()) return;
        try {
            setSubmitting(true);

            let imageUrls: string[] = [];
            if (replyImages.length > 0) {
                setIsUploading(true);
                const uploadRes = await api.uploadCommentImages(replyImages);
                if (uploadRes.success && uploadRes.data) {
                    imageUrls = uploadRes.data;
                } else {
                    toast.error('Failed to upload images');
                    setSubmitting(false);
                    setIsUploading(false);
                    return;
                }
                setIsUploading(false);
            }

            const res = await api.replyToComment(parentId, replyContent, imageUrls);
            if (res.success) {
                setReplyContent('');
                setReplyImages([]);
                setReplyingTo(null);
                fetchComments();
                toast.success('Reply added');
                onCommentAdded?.();
            } else {
                toast.error(res.error || 'Failed to add reply');
            }
        } catch (error) {
            toast.error('Failed to add reply');
        } finally {
            setSubmitting(false);
            setIsUploading(false);
        }
    };

    const handleDelete = async (id: string) => {
        setCommentToDelete(id);
    };

    const confirmDelete = async () => {
        if (!commentToDelete) return;
        try {
            const res = await api.deleteComment(commentToDelete);
            if (res.success) {
                fetchComments();
                toast.success('Comment deleted');
                setCommentToDelete(null);
                onCommentAdded?.();
            } else {
                toast.error(res.error || 'Failed to delete comment');
            }
        } catch (error) {
            toast.error('Failed to delete comment');
        } finally {
            setCommentToDelete(null);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-2" />
                <p>Loading comments...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* New Comment Input */}
            <div className="space-y-2">
                <Textarea
                    placeholder={type === 'ORDER' ? "Add a comment about this order..." : "Add a comment for this customer..."}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="min-h-[100px] w-full"
                />
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <label className="cursor-pointer">
                            <input
                                type="file"
                                multiple
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                    if (e.target.files) {
                                        setSelectedImages(prev => [...prev, ...Array.from(e.target.files!)]);
                                    }
                                }}
                                disabled={submitting}
                            />
                            <div className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-100 transition-colors">
                                <ImagePlus className="h-3.5 w-3.5" />
                                Add Images
                            </div>
                        </label>
                    </div>
                    <Button onClick={handleSubmitComment} disabled={submitting || !newComment.trim()}>
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                        Post Comment
                    </Button>
                </div>

                {selectedImages.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                        {selectedImages.map((file, i) => (
                            <div key={i} className="relative group h-16 w-16 bg-muted rounded border overflow-hidden">
                                <img
                                    src={URL.createObjectURL(file)}
                                    alt="preview"
                                    className="h-full w-full object-cover"
                                />
                                <div
                                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                    onClick={() => window.open(URL.createObjectURL(file), '_blank')}
                                >
                                    <Eye className="h-5 w-5 text-white" />
                                </div>
                                <button
                                    onClick={() => setSelectedImages(prev => prev.filter((_, idx) => idx !== i))}
                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="divide-y">
                {comments.length > 0 ? (
                    comments.map((comment) => (
                        <CommentItem
                            key={comment.id}
                            comment={comment}
                            user={user}
                            isStaff={isStaff}
                            replyingTo={replyingTo}
                            setReplyingTo={setReplyingTo}
                            editingComment={editingComment}
                            setEditingComment={setEditingComment}
                            editContent={editContent}
                            setEditContent={setEditContent}
                            replyContent={replyContent}
                            setReplyContent={setReplyContent}
                            handleReply={handleReply}
                            handleUpdate={handleUpdateComment}
                            handleDelete={handleDelete}
                            submitting={submitting}
                            replyImages={replyImages}
                            setReplyImages={setReplyImages}
                        />
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center p-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                        <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
                        <p className="text-sm">No comments yet.</p>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!commentToDelete} onOpenChange={(open) => { if (!open) setCommentToDelete(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Comment</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this comment? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

interface CommentItemProps {
    comment: Comment;
    isReply?: boolean;
    user: any;
    isStaff: boolean;
    replyingTo: string | null;
    setReplyingTo: (id: string | null) => void;
    editingComment: string | null;
    setEditingComment: (id: string | null) => void;
    editContent: string;
    setEditContent: (content: string) => void;
    replyContent: string;
    setReplyContent: (content: string) => void;
    handleReply: (id: string) => void;
    handleUpdate: (id: string, content: string) => void;
    handleDelete: (id: string) => void;
    submitting: boolean;
    replyImages: File[];
    setReplyImages: (files: File[] | ((prev: File[]) => File[])) => void;
}

function CommentItem({
    comment,
    isReply = false,
    user,
    isStaff,
    replyingTo,
    setReplyingTo,
    editingComment,
    setEditingComment,
    editContent,
    setEditContent,
    replyContent,
    setReplyContent,
    handleReply,
    handleUpdate,
    handleDelete,
    submitting,
    replyImages,
    setReplyImages
}: CommentItemProps) {
    const initials = `${comment.user.firstName.charAt(0)}${comment.user.lastName.charAt(0)}`.toUpperCase();
    const canDelete = user && (user.id === comment.userId || user.role === 'ADMIN' || user.role === 'MANAGER');

    // Customers can only reply to staff comments on their orders
    // Staff can reply to anything
    const canReply = isStaff || (!isReply && !isStaff && comment.user.role !== 'CUSTOMER');

    return (
        <div className={cn("flex flex-col gap-2", isReply ? "ml-4 md:ml-8 mt-2" : "mt-4")}>
            <div className="flex gap-2 sm:gap-3">
                <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                        <span className="text-sm font-semibold truncate max-w-[120px] sm:max-w-none">
                            {comment.user.firstName} {comment.user.lastName}
                        </span>
                        <Badge variant="outline" className="text-[10px] py-0 h-4 shrink-0">
                            {comment.user.role}
                        </Badge>
                        {comment.type === 'ORDER' && comment.order && (
                            <Badge variant="secondary" className="text-[10px] py-0 h-4 bg-blue-50 text-blue-700 border-blue-100 shrink-0">
                                Order: {comment.order.orderNumber}
                            </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatDate(comment.createdAt)}
                        </span>
                        {comment.updatedAt !== comment.createdAt && (
                            <span className="text-[10px] text-muted-foreground italic shrink-0">(edited)</span>
                        )}
                    </div>
                    {editingComment === comment.id ? (
                        <div className="space-y-2 mt-2">
                            <Textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="text-sm min-h-[100px]"
                                autoFocus
                            />
                            <div className="flex justify-end gap-2">
                                <Button size="sm" variant="ghost" onClick={() => setEditingComment(null)}>Cancel</Button>
                                <Button size="sm" onClick={() => handleUpdate(comment.id, editContent)} disabled={submitting || !editContent.trim()}>
                                    {submitting ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Send className="h-3 w-3 mr-2" />}
                                    Save
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-muted/50 p-3 rounded-lg border">
                            <div className="text-sm whitespace-pre-wrap">
                                {comment.content}
                            </div>
                            {comment.images && comment.images.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                                    {comment.images.map((url, i) => (
                                        <a
                                            key={i}
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block relative group h-20 w-20 sm:h-24 sm:w-24 rounded-md border overflow-hidden bg-white transition-all"
                                        >
                                            <img
                                                src={url}
                                                alt={`comment-image-${i}`}
                                                className="h-full w-full object-cover transition-transform group-hover:scale-110"
                                            />
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Eye className="h-6 w-6 text-white" />
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    <div className="flex items-center gap-4 mt-1">
                        {canReply && !editingComment && (
                            <button
                                onClick={() => {
                                    setEditingComment(null);
                                    if (replyingTo === comment.id) {
                                        setReplyingTo(null);
                                    } else {
                                        setReplyContent('');
                                        setReplyingTo(comment.id);
                                    }
                                }}
                                className="text-[10px] font-medium text-blue-600 hover:underline flex items-center gap-1"
                            >
                                <Reply className="h-3 w-3" />
                                Reply
                            </button>
                        )}
                        {user && (user.id === comment.userId || user.role === 'ADMIN' || user.role === 'MANAGER') && !editingComment && (
                            <button
                                onClick={() => {
                                    setReplyingTo(null);
                                    setEditContent(comment.content);
                                    setEditingComment(comment.id);
                                }}
                                className="text-[10px] font-medium text-slate-600 hover:underline flex items-center gap-1"
                            >
                                Edit
                            </button>
                        )}
                        {canDelete && !editingComment && (
                            <button
                                onClick={() => handleDelete(comment.id)}
                                className="text-[10px] font-medium text-red-600 hover:underline flex items-center gap-1"
                            >
                                <Trash2 className="h-3 w-3" />
                                Delete
                            </button>
                        )}
                    </div>

                    {replyingTo === comment.id && (
                        <div className="mt-2 space-y-2">
                            <Textarea
                                placeholder="Write a reply..."
                                value={replyContent}
                                onChange={(e) => setReplyContent(e.target.value)}
                                className="text-sm min-h-[80px]"
                                autoFocus
                            />
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <label className="cursor-pointer">
                                        <input
                                            type="file"
                                            multiple
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                if (e.target.files) {
                                                    setReplyImages(prev => [...prev, ...Array.from(e.target.files!)]);
                                                }
                                            }}
                                            disabled={submitting}
                                        />
                                        <div className="flex items-center gap-1 text-[10px] font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 transition-colors">
                                            <ImagePlus className="h-3 w-3" />
                                            Add Images
                                        </div>
                                    </label>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button size="sm" variant="ghost" onClick={() => { setReplyingTo(null); setReplyImages([]); }}>Cancel</Button>
                                    <Button size="sm" onClick={() => handleReply(comment.id)} disabled={submitting || !replyContent.trim()}>
                                        {submitting ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Send className="h-3 w-3 mr-2" />}
                                        Reply
                                    </Button>
                                </div>
                            </div>

                            {replyImages.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-1">
                                    {replyImages.map((file, i) => (
                                        <div key={i} className="relative group h-12 w-12 bg-muted rounded border overflow-hidden">
                                            <img
                                                src={URL.createObjectURL(file)}
                                                alt="preview"
                                                className="h-full w-full object-cover"
                                            />
                                            <div
                                                className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                onClick={() => window.open(URL.createObjectURL(file), '_blank')}
                                            >
                                                <Eye className="h-4 w-4 text-white" />
                                            </div>
                                            <button
                                                onClick={() => setReplyImages(prev => prev.filter((_, idx) => idx !== i))}
                                                className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                            >
                                                <X className="h-2 w-2" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {comment.replies && comment.replies.length > 0 && (
                <div className="space-y-2">
                    {comment.replies.map((reply) => (
                        <CommentItem
                            key={reply.id}
                            comment={reply}
                            isReply={true}
                            user={user}
                            isStaff={isStaff}
                            replyingTo={replyingTo}
                            setReplyingTo={setReplyingTo}
                            editingComment={editingComment}
                            setEditingComment={setEditingComment}
                            editContent={editContent}
                            setEditContent={setEditContent}
                            replyContent={replyContent}
                            setReplyContent={setReplyContent}
                            handleReply={handleReply}
                            handleUpdate={handleUpdate}
                            handleDelete={handleDelete}
                            submitting={submitting}
                            replyImages={replyImages}
                            setReplyImages={setReplyImages}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
