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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Sales Manager</DialogTitle>
          <DialogDescription>
            Select a user to promote to Sales Manager role.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !selectedUserId}>
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
