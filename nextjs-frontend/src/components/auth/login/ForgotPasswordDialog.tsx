'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface ForgotPasswordDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    email: string;
    setEmail: (email: string) => void;
    loading: boolean;
    onReset: () => void;
}

export function ForgotPasswordDialog({
    open,
    onOpenChange,
    email,
    setEmail,
    loading,
    onReset,
}: ForgotPasswordDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                    <DialogTitle>Reset Password</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <Label htmlFor="forgotEmail">Email address</Label>
                    <Input
                        id="forgotEmail"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                    />
                </div>
                <div className="mt-4 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button
                        disabled={loading}
                        onClick={onReset}
                    >
                        {loading ? (<><LoadingSpinner size={16} className="mr-2" />Sending...</>) : 'Send Reset Link'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
