'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Key, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface ChangePasswordDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (password: string) => Promise<any>;
    title?: string;
    description?: string;
    entityName?: string;
}

export function ChangePasswordDialog({
    open,
    onOpenChange,
    onConfirm,
    title = "Change Password",
    description,
    entityName = "user",
}: ChangePasswordDialogProps) {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleConfirm = async () => {
        if (!password) {
            toast.error('Password is required');
            return;
        }

        if (password.length < 4) {
            toast.error('Password must be at least 4 characters long');
            return;
        }

        if (/\s/.test(password)) {
            toast.error('Password cannot contain spaces');
            return;
        }

        try {
            setLoading(true);
            const result = await onConfirm(password);
            if (result.success) {
                toast.success(result.message || 'Password changed successfully');
                setPassword('');
                onOpenChange(false);
            } else {
                toast.error(result.error || 'Failed to change password');
            }
        } catch (error: any) {
            toast.error(error.message || 'An error occurred while changing password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val) {
                setPassword('');
                setShowPassword(false);
            }
            onOpenChange(val);
        }}>
            <DialogContent className="w-[95vw] sm:max-w-md p-0 rounded-2xl overflow-hidden border-gray-200 flex flex-col">
                <div className="bg-[#1B2D4F] px-6 py-5 relative overflow-hidden flex-shrink-0">
                  <div className="absolute -top-8 -right-8 w-28 h-28 bg-[#3A6FA0]/25 rounded-full blur-2xl pointer-events-none" />
                  <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />
                  <div className="flex items-center gap-3 relative z-10">
                    <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                      <Key className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <DialogTitle className="text-base font-bold text-white">Change Password</DialogTitle>
                      <p className="text-xs text-white/50 mt-0.5">Set a new password for this account</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 sm:p-6 py-4 sm:py-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="new-password">New Password</Label>
                            <div className="relative">
                                <Input
                                    id="new-password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter new password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pr-10"
                                    autoFocus
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                    )}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Minimum 4 characters, no spaces.
                            </p>
                        </div>
                    </div>
                </div>
                <DialogFooter className="p-4 sm:p-6 pt-2 sm:pt-4 border-t bg-muted/5 flex-col sm:flex-row gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="w-full sm:w-auto order-2 sm:order-1 rounded-xl">
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm} disabled={loading || !password} className="w-full sm:w-auto order-1 sm:order-2 bg-[#1B2D4F] hover:bg-[#243d6b] text-white rounded-xl">
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Updating...
                            </>
                        ) : (
                            'Update Password'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
