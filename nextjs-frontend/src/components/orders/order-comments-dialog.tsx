'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CommentSection } from '@/components/comments/comment-section';

interface OrderCommentsDialogProps {
    orderId: string;
    orderNumber: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCommentAdded?: () => void;
}

export function OrderCommentsDialog({ orderId, orderNumber, open, onOpenChange, onCommentAdded }: OrderCommentsDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Order Comments - {orderNumber}</DialogTitle>
                </DialogHeader>
                <div className="mt-4">
                    <CommentSection
                        type="ORDER"
                        orderId={orderId}
                        onCommentAdded={onCommentAdded}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
