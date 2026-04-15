'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInputWithFlag } from './phone-input-with-flag';
import { CitySelector } from './city-selector';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { api, Customer } from '@/lib/api';
import { toast } from 'sonner';
import logger from '@/lib/logger';
import { User } from 'lucide-react';

interface EditCustomerDialogProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditCustomerDialog({ customer, open, onOpenChange, onSuccess }: EditCustomerDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    licenseNumber: '',
    email: '',
    mobile: '',
    city: '',
    zip: '',
    customerType: 'B2C' as 'B2C' | 'B2B' | 'ENTERPRISE_1' | 'ENTERPRISE_2',
    isActive: true,
    tags: [] as string[],
  });

  useEffect(() => {
    if (customer) {
      setFormData({
        firstName: customer.firstName,
        lastName: customer.lastName,
        companyName: customer.companyName || '',
        licenseNumber: customer.licenseNumber || '',
        email: customer.email,
        mobile: customer.mobile,
        city: customer.city || '',
        zip: customer.zip || '',
        customerType: customer.customerType,
        isActive: customer.isActive,
        tags: customer.customerTags?.map(tag => tag.tag) || [],
      });
    }
  }, [customer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customer || !formData.firstName || !formData.lastName || !formData.email || !formData.mobile) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.mobile) {
      const digitsOnly = formData.mobile.replace(/\D/g, '');
      // Accept 10-digit local numbers or 11-15 digit international numbers (with country code)
      if (digitsOnly.length < 10 || digitsOnly.length > 15) {
        toast.error('Please enter a valid phone number (10-15 digits)');
        return;
      }
    }

    try {
      setLoading(true);
      const response = await api.updateCustomer(customer.id, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        mobile: formData.mobile,
        customerType: formData.customerType,
        isActive: formData.isActive,
        companyName: formData.companyName.trim() ? formData.companyName.trim() : undefined,
        licenseNumber: formData.licenseNumber.trim() ? formData.licenseNumber.trim() : undefined,
        city: formData.city.trim() ? formData.city.trim() : undefined,
        zip: formData.zip.trim() ? formData.zip.trim() : undefined,
        tags: formData.tags,
      });

      if (response.success) {
        toast.success('Customer updated successfully');
        onSuccess();
      } else {
        toast.error(response.error || 'Failed to update customer');
      }
    } catch (error: any) {
      logger.error('Error updating customer:', { error: error });
      toast.error(error?.response?.data?.error || error?.message || 'Failed to update customer');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto w-[calc(100vw-2rem)] sm:w-full p-0 rounded-2xl overflow-hidden border-gray-200">
        <div className="bg-[#1B2D4F] px-6 py-5 relative overflow-hidden flex-shrink-0">
          <div className="absolute -top-8 -right-8 w-28 h-28 bg-[#3A6FA0]/25 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white">Edit Customer</DialogTitle>
              <p className="text-xs text-white/50 mt-0.5">Update customer information and details</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name <span className="text-red-500">*</span></Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                placeholder="John"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name <span className="text-red-500">*</span></Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                placeholder="Doe"
                required
              />
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
              />
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
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mobile">Mobile Number <span className="text-red-500">*</span></Label>
              <PhoneInputWithFlag
                id="mobile"
                placeholder="Enter phone number"
                value={formData.mobile}
                onChange={(value) => handleInputChange('mobile', value)}
                required
              />
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
              <Label htmlFor="customerType">Customer Type <span className="text-red-500">*</span></Label>
              <Select
                value={formData.customerType}
                onValueChange={(value: 'B2C' | 'B2B' | 'ENTERPRISE_1' | 'ENTERPRISE_2') => handleInputChange('customerType', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select customer type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="B2C">Wholesale (B2C)</SelectItem>
                  <SelectItem value="B2B">Wholesale (B2B)</SelectItem>
                  <SelectItem value="ENTERPRISE_1">Enterprise Tier 1</SelectItem>
                  <SelectItem value="ENTERPRISE_2">Enterprise Tier 2</SelectItem>
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

          <div className="space-y-2">
            <Label htmlFor="tags">Customer Tags</Label>
            <Textarea
              id="tags"
              value={formData.tags.join(', ')}
              onChange={(e) => {
                const tags = e.target.value.split(',').map(tag => tag.trim()).filter(Boolean);
                setFormData(prev => ({ ...prev, tags }));
              }}
              placeholder="Enter tags separated by commas (e.g., VIP, Premium, Research)"
              rows={2}
            />
            <p className="text-sm text-muted-foreground">
              Enter tags separated by commas to categorize this customer.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.mobile} className="bg-[#1B2D4F] hover:bg-[#243d6b] text-white rounded-xl">
              {loading ? 'Updating...' : 'Update Customer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 