'use client';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { CommentSection } from '@/components/comments/comment-section';
import { MessageSquare } from 'lucide-react';

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
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl overflow-hidden border-gray-200">
                <div className="bg-[#1B2D4F] px-6 py-5 relative overflow-hidden flex-shrink-0">
                  <div className="absolute -top-8 -right-8 w-28 h-28 bg-[#3A6FA0]/25 rounded-full blur-2xl pointer-events-none" />
                  <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />
                  <div className="flex items-center gap-3 relative z-10">
                    <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <DialogTitle className="text-base font-bold text-white">Order Comments</DialogTitle>
                      <p className="text-xs text-white/50 mt-0.5">Comments for order {orderNumber}</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
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
