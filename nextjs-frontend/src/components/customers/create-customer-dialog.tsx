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
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import logger from '@/lib/logger';
import { cn } from '@/lib/utils';

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
      if (digitsOnly.length < 10 || digitsOnly.length > 15) {
        newErrors.mobile = 'Please enter a valid phone number (10-15 digits)';
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
        <DialogContent className="sm:max-w-[580px] max-h-[90vh] w-[calc(100vw-2rem)] p-0 gap-0 overflow-hidden rounded-2xl">

          {/* ── DARK HEADER ── */}
          <div className="bg-[#043061] px-6 py-5 relative overflow-hidden flex-shrink-0">
            <div className="absolute -top-8 -right-8 w-28 h-28 bg-[#5A9ADA]/25 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />
            <div className="relative z-10 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                <UserPlus className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white leading-tight">New Customer</h2>
                <p className="text-xs text-white/40 mt-0.5">Fill in the details to create an account</p>
              </div>
            </div>
          </div>

          {/* ── SCROLLABLE FORM BODY ── */}
          <div className="overflow-y-auto flex-1" style={{ maxHeight: 'calc(90vh - 140px)' }}>
            <form id="create-customer-form" onSubmit={handleSubmit} className="p-6 space-y-6">

              {/* Section: Personal */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Personal Info</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">First Name <span className="text-red-400">*</span></label>
                    <Input
                      value={formData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      placeholder="John"
                      className={cn("rounded-lg h-9 text-sm", errors.firstName ? 'border-red-400' : 'border-slate-200')}
                    />
                    {errors.firstName && <p className="text-xs text-red-500">{errors.firstName}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Last Name <span className="text-red-400">*</span></label>
                    <Input
                      value={formData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      placeholder="Doe"
                      className={cn("rounded-lg h-9 text-sm", errors.lastName ? 'border-red-400' : 'border-slate-200')}
                    />
                    {errors.lastName && <p className="text-xs text-red-500">{errors.lastName}</p>}
                  </div>
                </div>
              </div>

              {/* Section: Company */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Company</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Company Name</label>
                    <Input
                      value={formData.companyName}
                      onChange={(e) => handleInputChange('companyName', e.target.value)}
                      placeholder="RefinedMD"
                      className="rounded-lg h-9 text-sm border-slate-200"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">NPI / License</label>
                    <Input
                      value={formData.licenseNumber}
                      onChange={(e) => handleInputChange('licenseNumber', e.target.value)}
                      placeholder="1234567890"
                      className="rounded-lg h-9 text-sm border-slate-200"
                    />
                  </div>
                </div>
              </div>

              {/* Section: Contact */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Contact</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Email <span className="text-red-400">*</span></label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="john@example.com"
                      className={cn("rounded-lg h-9 text-sm", errors.email ? 'border-red-400' : 'border-slate-200')}
                    />
                    {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Mobile <span className="text-red-400">*</span></label>
                    <PhoneInputWithFlag
                      placeholder="Phone number"
                      value={formData.mobile}
                      onChange={(value) => handleInputChange('mobile', value)}
                      className={cn("rounded-lg h-9 text-sm", errors.mobile ? 'border-red-400' : 'border-slate-200')}
                    />
                    {errors.mobile && <p className="text-xs text-red-500">{errors.mobile}</p>}
                  </div>
                </div>
              </div>

              {/* Section: Location */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Location</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">City</label>
                    <CitySelector
                      value={formData.city}
                      onChange={(value) => handleInputChange('city', value)}
                      placeholder="Select city"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">ZIP Code</label>
                    <Input
                      value={formData.zip}
                      onChange={(e) => handleInputChange('zip', e.target.value)}
                      placeholder="ZIP code"
                      className="rounded-lg h-9 text-sm border-slate-200"
                    />
                  </div>
                </div>
              </div>

              {/* Section: Account */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Account</p>
                <div className="space-y-3">
                  {/* Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Password <span className="text-red-400">*</span></label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        placeholder="Min. 4 characters, no spaces"
                        className={cn("rounded-lg h-9 text-sm pr-10", errors.password ? 'border-red-400' : 'border-slate-200')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
                  </div>

                  {/* Customer Type — visual cards */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-2">Customer Type <span className="text-red-400">*</span></label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleInputChange('customerType', 'B2C')}
                        className={cn(
                          "p-3 rounded-xl border-2 text-left transition-all",
                          formData.customerType === 'B2C'
                            ? 'border-[#043061] bg-[#043061]/5'
                            : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                        )}
                      >
                        <p className={cn("text-xs font-bold", formData.customerType === 'B2C' ? 'text-[#043061]' : 'text-slate-600')}>Wholesale</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Standard pricing</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInputChange('customerType', 'ENTERPRISE_1')}
                        className={cn(
                          "p-3 rounded-xl border-2 text-left transition-all",
                          formData.customerType === 'ENTERPRISE_1'
                            ? 'border-[#043061] bg-[#043061]/5'
                            : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                        )}
                      >
                        <p className={cn("text-xs font-bold", formData.customerType === 'ENTERPRISE_1' ? 'text-[#043061]' : 'text-slate-600')}>Enterprise</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Custom pricing</p>
                      </button>
                    </div>
                  </div>

                  {/* Active toggle */}
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="text-xs font-semibold text-slate-700">Account Status</p>
                      <p className="text-[10px] text-slate-400">{formData.isActive ? 'Active — customer can log in' : 'Inactive — login disabled'}</p>
                    </div>
                    <Switch
                      checked={formData.isActive}
                      onCheckedChange={(checked) => handleInputChange('isActive', checked)}
                    />
                  </div>
                </div>
              </div>

            </form>
          </div>

          {/* ── FOOTER ── */}
          <div className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-between flex-shrink-0">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-sm text-slate-400 hover:text-slate-600 font-medium transition-colors"
            >
              Cancel
            </button>
            <Button
              type="submit"
              form="create-customer-form"
              disabled={loading || !isFormValid()}
              className="bg-[#043061] hover:bg-[#16243f] text-white rounded-xl px-6 text-sm h-9 disabled:opacity-40"
            >
              {loading ? 'Creating...' : 'Create Customer'}
            </Button>
          </div>

        </DialogContent>
      </Dialog>
    </>
  );
}
