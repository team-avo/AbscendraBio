'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Eye, EyeOff, Users } from 'lucide-react';
import { toast } from 'sonner';
import logger from '@/lib/logger';

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'SALES_REP' | 'SALES_MANAGER';
  isActive: boolean;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  role?: string;
}

export function CreateUserDialog({ open, onOpenChange, onSuccess }: CreateUserDialogProps) {
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'STAFF',
    isActive: true,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);


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

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 4) {
      newErrors.password = 'Password must be at least 4 characters';
    } else if (/\s/.test(formData.password)) {
      newErrors.password = 'Password cannot contain spaces';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.role) {
      newErrors.role = 'Role is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Check if form is valid for submit button state
  const isFormValid = () => {
    const hasValidFirstName = formData.firstName.trim();
    const hasValidLastName = formData.lastName.trim();
    const hasValidEmail = formData.email && /\S+@\S+\.\S+/.test(formData.email);
    const hasValidPassword = formData.password && formData.password.length >= 4 && !/\s/.test(formData.password);
    const hasValidConfirmPassword = formData.confirmPassword && formData.password === formData.confirmPassword;
    const hasValidRole = formData.role;

    return hasValidFirstName && hasValidLastName && hasValidEmail && hasValidPassword && hasValidConfirmPassword && hasValidRole;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await api.createUser({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role: formData.role,
        isActive: formData.isActive,
      });

      if (response.success) {
        toast.success('User created successfully');
        onSuccess();
        handleReset();
      } else {
        toast.error(response.error || 'Failed to create user');
      }
    } catch (error) {
      logger.error('Failed to create user:', { error: error });
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'STAFF',
      isActive: true,
    });
    setErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      handleReset();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[425px] p-0 rounded-2xl overflow-hidden border-gray-200 flex flex-col max-h-[90vh]">
        <div className="bg-[#1B2D4F] px-6 py-5 relative overflow-hidden flex-shrink-0">
          <div className="absolute -top-8 -right-8 w-28 h-28 bg-[#3A6FA0]/25 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white">Create User</DialogTitle>
              <p className="text-xs text-white/50 mt-0.5">Add a new user to the system</p>
            </div>
          </div>
        </div>

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
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, password: e.target.value }));
                  }}
                  placeholder="Enter a secure password"
                  className={errors.password ? 'border-red-500 pr-10' : 'pr-10'}
                />
                <button
                  type="button"
                  className="absolute top-1/2 -translate-y-1/2 right-3 flex items-center justify-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Password must be Minimum 4 characters, no spaces</p>
              {errors.password && (
                <p className="text-sm text-red-600">{errors.password}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm your password"
                  className={errors.confirmPassword ? 'border-red-500 pr-10' : 'pr-10'}
                />
                <button
                  type="button"
                  className="absolute top-1/2 -translate-y-1/2 right-3 flex items-center justify-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-red-600">{errors.confirmPassword}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value: 'ADMIN' | 'MANAGER' | 'STAFF' | 'SALES_REP' | 'SALES_MANAGER') =>
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
            className="w-full sm:w-auto order-2 sm:order-1 rounded-xl"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || !isFormValid()} className="w-full sm:w-auto order-1 sm:order-2 bg-[#1B2D4F] hover:bg-[#243d6b] text-white rounded-xl">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create User'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog >
  );
}