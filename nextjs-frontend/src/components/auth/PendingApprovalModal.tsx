'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LottiePlayer } from '@/components/ui/lottie-player';
import { useAuth } from '@/contexts/auth-context';

export function PendingApprovalModal() {
  const { showPendingApprovalModal, setShowPendingApprovalModal } = useAuth();

  return (
    <Dialog open={showPendingApprovalModal} onOpenChange={setShowPendingApprovalModal}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-center">Account Pending Approval</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center space-y-4">
          {/* Lottie animation */}
          <LottiePlayer
            autoplay
            loop
            mode="normal"
            src="/Status-Animation.json"
            style={{ width: '200px', height: '200px' }}
          />
          <p className="text-center text-sm text-gray-600">
            Your account is pending for approval. Please wait for approval before logging in.
          </p>
          <Button 
            className="w-full" 
            onClick={() => setShowPendingApprovalModal(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
