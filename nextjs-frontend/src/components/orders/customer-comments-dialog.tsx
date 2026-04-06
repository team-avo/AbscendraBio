'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CommentSection } from '@/components/comments/comment-section';

interface CustomerCommentsDialogProps {
    customerId: string;
    customerName: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCommentAdded?: () => void;
}

export function CustomerCommentsDialog({ customerId, customerName, open, onOpenChange, onCommentAdded }: CustomerCommentsDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Customer Comments - {customerName}</DialogTitle>
                </DialogHeader>
                <div className="mt-4">
                    <CommentSection
                        type="CUSTOMER"
                        customerId={customerId}
                        includeOrderComments={false}
                        onCommentAdded={onCommentAdded}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
