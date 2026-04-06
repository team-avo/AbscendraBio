'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInputWithFlag } from './phone-input-with-flag';
import { CitySelector } from './city-selector';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import logger from '@/lib/logger';

interface CreateCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateCustomerDialog({ open, onOpenChange, onSuccess }: CreateCustomerDialogProps) {
  const [loading, setLoading] = useState(false);
  // Removed post-create notify UX; sending happens automatically on backend
  const [showPassword, setShowPassword] = useState(false);

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    licenseNumber: '',
    email: '',
    mobile: '',
    city: '',
    zip: '',
    password: '',
    customerType: 'B2C' as 'B2C' | 'B2B' | 'ENTERPRISE_1' | 'ENTERPRISE_2',
    isActive: true,
    tags: [] as string[],
  });

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

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

    if (!formData.mobile) {
      newErrors.mobile = 'Mobile number is required';
    } else {
      const digitsOnly = formData.mobile.replace(/\D/g, '');
      const localTen = digitsOnly.slice(-10);
      if (localTen.length !== 10) {
        newErrors.mobile = 'Mobile number must be exactly 10 digits';
      }
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 4) {
      newErrors.password = 'Password must be at least 4 characters';
    } else if (/\s/.test(formData.password)) {
      newErrors.password = 'Password cannot contain spaces';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Check if form is valid for submit button state
  const isFormValid = () => {
    const hasValidFirstName = formData.firstName.trim();
    const hasValidLastName = formData.lastName.trim();
    const hasValidEmail = formData.email && /\S+@\S+\.\S+/.test(formData.email);
    const hasValidMobile = formData.mobile && formData.mobile.replace(/\D/g, '').slice(-10).length === 10;
    const hasValidPassword = formData.password.length >= 4 && !/\s/.test(formData.password);
    return hasValidFirstName && hasValidLastName && hasValidEmail && hasValidMobile && hasValidPassword;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      const response = await api.createCustomer({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        mobile: formData.mobile,
        password: formData.password,
        customerType: formData.customerType,
        isActive: formData.isActive,
        companyName: formData.companyName.trim() ? formData.companyName.trim() : undefined,
        licenseNumber: formData.licenseNumber.trim() ? formData.licenseNumber.trim() : undefined,
        city: formData.city.trim() ? formData.city.trim() : undefined,
        zip: formData.zip.trim() ? formData.zip.trim() : undefined,
        tags: formData.tags,
      });

      if (response.success) {
        toast.success('Customer created successfully. Credentials email sent.');
        onSuccess();
        resetForm();
      } else {
        toast.error(response.error || 'Failed to create customer');
      }
    } catch (error: any) {
      logger.error('Error creating customer:', { error: error });

      // Handle specific error messages
      if (error?.response?.data?.error) {
        const errorMessage = error.response.data.error;
        if (errorMessage.includes('email') && errorMessage.includes('already')) {
          setErrors(prev => ({ ...prev, email: 'Email already taken' }));
        } else if (errorMessage.includes('mobile') && errorMessage.includes('already')) {
          setErrors(prev => ({ ...prev, mobile: 'Mobile number already taken' }));
        } else {
          toast.error(errorMessage);
        }
      } else {
        toast.error(error?.message || 'Failed to create customer');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      companyName: '',
      licenseNumber: '',
      email: '',
      mobile: '',
      city: '',
      zip: '',
      password: '',
      customerType: 'B2C',
      isActive: true,
      tags: [],
    });
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto w-[calc(100vw-2rem)] sm:w-full p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Create New Customer</DialogTitle>
            <DialogDescription>
              Add a new customer to the database. Fill in the required information below.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name <span className="text-red-500">*</span></Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  placeholder="John"
                  required
                  className={errors.firstName ? 'border-red-500' : ''}
                />
                {errors.firstName && (<p className="text-sm text-red-600">{errors.firstName}</p>)}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name <span className="text-red-500">*</span></Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  placeholder="Doe"
                  required
                  className={errors.lastName ? 'border-red-500' : ''}
                />
                {errors.lastName && (<p className="text-sm text-red-600">{errors.lastName}</p>)}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company</Label>
                <Input
                  id="companyName"
                  value={formData.companyName}
                  onChange={(e) => handleInputChange('companyName', e.target.value)}
                  placeholder="RefinedMD"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="licenseNumber">NPI / License Number (Optional)</Label>
                <Input
                  id="licenseNumber"
                  value={formData.licenseNumber}
                  onChange={(e) => handleInputChange('licenseNumber', e.target.value)}
                  placeholder="1234567890"
                  className={errors.licenseNumber ? 'border-red-500' : ''}
                />
                {errors.licenseNumber && (<p className="text-sm text-red-600">{errors.licenseNumber}</p>)}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address <span className="text-red-500">*</span></Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="john.doe@example.com"
                  required
                  className={errors.email ? 'border-red-500' : ''}
                />
                {errors.email && (<p className="text-sm text-red-600">{errors.email}</p>)}
              </div>

              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile Number <span className="text-red-500">*</span></Label>
                <PhoneInputWithFlag
                  id="mobile"
                  placeholder="Enter phone number"
                  value={formData.mobile}
                  onChange={(value) => handleInputChange('mobile', value)}
                  required
                  className={errors.mobile ? 'border-red-500' : ''}
                />
                {errors.mobile && (<p className="text-sm text-red-600">{errors.mobile}</p>)}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <CitySelector
                  id="city"
                  value={formData.city}
                  onChange={(value) => handleInputChange('city', value)}
                  placeholder="Select city"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="zip">ZIP Code</Label>
                <Input
                  id="zip"
                  value={formData.zip}
                  onChange={(e) => handleInputChange('zip', e.target.value)}
                  placeholder="Enter ZIP code"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => {
                      handleInputChange('password', e.target.value);
                    }}
                    placeholder="Enter a strong password"
                    required
                    className={`pr-10 ${errors.password ? 'border-red-500' : ''}`}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute top-1/2 -translate-y-1/2 right-2 flex items-center justify-center text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Password must be Minimum 4 characters, no spaces</p>
                {errors.password && (<p className="text-sm text-red-600">{errors.password}</p>)}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerType">Customer Type <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.customerType}
                  onValueChange={(value: 'B2C' | 'B2B' | 'ENTERPRISE_1' | 'ENTERPRISE_2') => handleInputChange('customerType', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="B2C">Wholesale</SelectItem>
                    <SelectItem value="ENTERPRISE_1">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="isActive">Status</Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => handleInputChange('isActive', checked)}
                  />
                  <Label htmlFor="isActive" className="text-sm">
                    {formData.isActive ? 'Active' : 'Inactive'}
                  </Label>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !isFormValid()}>
                {loading ? 'Creating...' : 'Create Customer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Credentials are emailed automatically by the backend; no notify dialog */}
    </>
  );
} 