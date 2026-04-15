'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import logger from '@/lib/logger';

interface SalesManager {
  id: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    isActive: boolean;
  };
  salesReps: Array<{
    id: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      isActive: boolean;
    };
  }>;
}

interface EditSalesManagerDialogProps {
  manager: SalesManager | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditSalesManagerDialog({ manager, open, onOpenChange, onSuccess }: EditSalesManagerDialogProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (manager) {
      setFirstName(manager.user.firstName);
      setLastName(manager.user.lastName);
      setEmail(manager.user.email);
    }
  }, [manager]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!manager) return;

    setIsSubmitting(true);

    try {
      const response = await api.updateUser(manager.user.id, {
        firstName,
        lastName,
        email,
      });

      if (response.success) {
        toast.success('Sales manager updated successfully');
        onSuccess();
      } else {
        toast.error(response.error || 'Failed to update sales manager');
      }
    } catch (error) {
      logger.error('Failed to update sales manager:', { error: error });
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!manager) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] p-0 rounded-2xl overflow-hidden border-gray-200">
        <div className="bg-[#1B2D4F] px-6 py-5 relative overflow-hidden flex-shrink-0">
          <div className="absolute -top-8 -right-8 w-28 h-28 bg-[#3A6FA0]/25 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white">Edit Sales Manager</DialogTitle>
              <p className="text-xs text-white/50 mt-0.5">Update sales manager information</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
              />
            </div>
          </div>

          <DialogFooter className="px-6 pb-6 pt-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-[#1B2D4F] hover:bg-[#243d6b] text-white rounded-xl">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Sales Manager'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
