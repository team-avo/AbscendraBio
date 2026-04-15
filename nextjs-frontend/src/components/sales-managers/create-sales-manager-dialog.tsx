'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

interface CreateSalesManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
}

export function CreateSalesManagerDialog({ open, onOpenChange, onSuccess }: CreateSalesManagerDialogProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  const fetchUsers = async () => {
    try {
      setIsLoadingUsers(true);
      const response = await api.get('/users?limit=200');
      
      if (response.success && response.data) {
        // Filter users who are not already sales managers and not customers
        const staffUsers = response.data.users.filter((user: User) => 
          user.role !== 'CUSTOMER' && user.role !== 'SALES_MANAGER'
        );
        setUsers(staffUsers);
      }
    } catch (error) {
      logger.error('Failed to fetch users:', { error: error });
      toast.error('Failed to load users');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUserId) {
      toast.error('Please select a user');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await api.post('/sales-managers', {
        userId: selectedUserId,
      });

      if (response.success) {
        toast.success('Sales manager created successfully');
        onSuccess();
        setSelectedUserId('');
      } else {
        toast.error(response.error || 'Failed to create sales manager');
      }
    } catch (error) {
      logger.error('Failed to create sales manager:', { error: error });
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedUserId('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px] p-0 rounded-2xl overflow-hidden border-gray-200">
        <div className="bg-[#1B2D4F] px-6 py-5 relative overflow-hidden flex-shrink-0">
          <div className="absolute -top-8 -right-8 w-28 h-28 bg-[#3A6FA0]/25 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white">Create Sales Manager</DialogTitle>
              <p className="text-xs text-white/50 mt-0.5">Promote a user to Sales Manager role</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-6">
            <div className="space-y-2">
              <Label htmlFor="user">Select User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a user..." />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingUsers ? (
                    <div className="p-2 text-sm text-gray-500">Loading users...</div>
                  ) : users.length === 0 ? (
                    <div className="p-2 text-sm text-gray-500">No users available</div>
                  ) : (
                    users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} ({user.email})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="px-6 pb-6 pt-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !selectedUserId} className="bg-[#1B2D4F] hover:bg-[#243d6b] text-white rounded-xl">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Sales Manager'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
