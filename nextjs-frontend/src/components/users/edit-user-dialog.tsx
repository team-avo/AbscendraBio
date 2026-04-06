'use client';

import { useState, useEffect } from 'react';
import { api, User } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
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

interface EditUserDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'SALES_REP' | 'SALES_MANAGER' | 'CUSTOMER';
  isActive: boolean;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
}

export function EditUserDialog({ user, open, onOpenChange, onSuccess }: EditUserDialogProps) {
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    role: 'STAFF',
    isActive: true,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update form data when user changes
  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      });
    }
  }, [user]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.role) {
      newErrors.role = 'Role is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await api.updateUser(user.id, {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        role: formData.role,
        isActive: formData.isActive,
      });

      if (response.success) {
        toast.success('User updated successfully');
        onSuccess();
      } else {
        toast.error(response.error || 'Failed to update user');
      }
    } catch (error) {
      logger.error('Failed to update user:', { error: error });
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    if (user) {
      setFormData({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      });
    }
    setErrors({});
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      handleReset();
    }
    onOpenChange(newOpen);
  };

  if (!user) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[425px] p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="p-4 sm:p-6 pb-2 sm:pb-4 border-b">
          <DialogTitle className="text-xl sm:text-2xl">Edit User</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Update user information and permissions.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="John"
                  className={errors.firstName ? 'border-red-500' : ''}
                />
                {errors.firstName && (
                  <p className="text-sm text-red-600">{errors.firstName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Doe"
                  className={errors.lastName ? 'border-red-500' : ''}
                />
                {errors.lastName && (
                  <p className="text-sm text-red-600">{errors.lastName}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="john@example.com"
                className={errors.email ? 'border-red-500' : ''}
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value: 'ADMIN' | 'MANAGER' | 'STAFF' | 'SALES_REP' | 'SALES_MANAGER' | 'CUSTOMER') =>
                  setFormData(prev => ({ ...prev, role: value }))
                }
              >
                <SelectTrigger className={errors.role ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STAFF">Staff</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="ADMIN">Administrator</SelectItem>
                  <SelectItem value="SALES_REP">Sales Representative</SelectItem>
                  <SelectItem value="SALES_MANAGER">Sales Manager</SelectItem>
                  <SelectItem value="CUSTOMER">Customer</SelectItem>
                </SelectContent>
              </Select>
              {errors.role && (
                <p className="text-sm text-red-600">{errors.role}</p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
              />
              <Label htmlFor="isActive">Active User</Label>
            </div>

          </form>
        </div>

        <DialogFooter className="p-4 sm:p-6 pt-2 sm:pt-4 border-t bg-muted/5 flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
            className="w-full sm:w-auto order-2 sm:order-1"
          >
            Cancel
          </Button>
          <Button type="submit" onClick={handleSubmit} disabled={isSubmitting} className="w-full sm:w-auto order-1 sm:order-2">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              'Update User'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog >
  );
}