'use client';

import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import logger from '@/lib/logger';

interface SendReportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSend: (email: string) => Promise<any>;
    title?: string;
    description?: string;
}

export function SendReportDialog({
    open,
    onOpenChange,
    onSend,
    title = 'Send Email Report',
    description = 'Enter the email address where you want to receive the report.',
}: SendReportDialogProps) {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSend = async () => {
        if (!email) {
            toast.error('Please enter an email address');
            return;
        }

        try {
            setLoading(true);
            const res = await onSend(email);
            if (res.success) {
                toast.success('Report sent successfully');
                onOpenChange(false);
                setEmail('');
            } else {
                toast.error(res.error || 'Failed to send report');
            }
        } catch (error) {
            logger.error('Failed to send report:', { error: error });
            toast.error('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="email" className="text-right">
                            Email
                        </Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="manager@example.com"
                            className="col-span-3"
                            disabled={loading}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSend} disabled={loading}>
                        {loading ? 'Sending...' : 'Send Report'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
