'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, Package, Users, Target, Tag } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import logger from '@/lib/logger';

interface CreateCouponDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface FormData {
  code: string;
  name: string;
  description: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING' | 'BOGO' | 'VOLUME_DISCOUNT';
  value: string;
  minOrderAmount: string;
  maxDiscount: string;
  usageLimit: string;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;

  // Customer segmentation
  customerTypes: string[];
  isForIndividualCustomer?: boolean;
  specificCustomerIds?: string[];

  // BOGO specific
  bogoType: string;
  buyQuantity: string;
  getQuantity: string;
  getDiscount: string;

  // Product/Category rules
  productRules: Array<{
    productId?: string;
    variantId?: string;
    ruleType: 'BUY' | 'GET' | 'INCLUDE' | 'EXCLUDE';
    quantity?: string;
  }>;
  categoryRules: Array<{
    categoryId: string;
    ruleType: 'INCLUDE' | 'EXCLUDE';
  }>;

  // Volume tiers
  volumeTiers: Array<{
    minQuantity: string;
    maxQuantity?: string;
    discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FIXED_PRICE';
    discountValue: string;
  }>;
}

interface FormErrors {
  code?: string;
  name?: string;
  type?: string;
  value?: string;
  bogoType?: string;
  buyQuantity?: string;
  getQuantity?: string;
  getDiscount?: string;
  volumeTiers?: string;
  [key: string]: string | undefined; // For dynamic volume tier errors
}

export function CreateCouponDialog({ open, onOpenChange, onSuccess }: CreateCouponDialogProps) {
  const [formData, setFormData] = useState<FormData>({
    code: '',
    name: '',
    description: '',
    type: 'PERCENTAGE',
    value: '',
    minOrderAmount: '',
    maxDiscount: '',
    usageLimit: '',
    startsAt: '',
    expiresAt: '',
    isActive: true,
    customerTypes: [],
    bogoType: '',
    buyQuantity: '',
    getQuantity: '',
    getDiscount: '',
    productRules: [],
    categoryRules: [],
    volumeTiers: [],
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // Customer search & selection
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [searchedCustomers, setSearchedCustomers] = useState<any[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<any[]>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);

  useEffect(() => {
    if (open) {
      fetchProducts();
      fetchCategories();
    }
  }, [open]);

  const fetchProducts = async () => {
    try {
      const response = await api.getProducts();
      if (response.success && response.data) {
        setProducts(response.data.items || []);
      }
    } catch (error) {
      logger.error('Failed to fetch products:', { error: error });
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.getCategories();
      if (response.success && response.data) {
        setCategories(response.data.categories || []);
      }
    } catch (error) {
      logger.error('Failed to fetch categories:', { error: error });
    }
  };

  // Debounced search for customers
  useEffect(() => {
    if (!formData.isForIndividualCustomer && customerSearchQuery.trim() === '') return;

    const delayDebounceFn = setTimeout(async () => {
      if (customerSearchQuery.trim().length >= 2) {
        setIsSearchingCustomers(true);
        try {
          const response = await api.getCustomers({
            search: customerSearchQuery,
            limit: 5
          });
          if (response.success && response.data) {
            setSearchedCustomers(response.data.customers || []);
          }
          // Also make sure to update form data to reflect intent
          setFormData(prev => ({ ...prev, isForIndividualCustomer: true }));
        } catch (error) {
          logger.error("Failed to search customers:", { error: error });
        } finally {
          setIsSearchingCustomers(false);
        }
      } else {
        setSearchedCustomers([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [customerSearchQuery]); // Removed formData.isForIndividualCustomer dependency to allow searching even if not yet checked

  const handleAddCustomer = (customer: any) => {
    if (!selectedCustomers.some(c => c.id === customer.id)) {
      setSelectedCustomers([...selectedCustomers, customer]);
    }
    setCustomerSearchQuery(''); // Clear search after adding
    setSearchedCustomers([]);
  };

  const handleRemoveCustomer = (customerId: string) => {
    setSelectedCustomers(selectedCustomers.filter(c => c.id !== customerId));
  };

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value } as FormData;

      // Initialize volume tiers when Volume Discount is selected
      if (field === 'type' && value === 'VOLUME_DISCOUNT' && prev.volumeTiers.length === 0) {
        newData.volumeTiers = [{
          minQuantity: '',
          maxQuantity: '',
          discountType: 'PERCENTAGE',
          discountValue: ''
        }];
      }

      return newData;
    });

    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.code.trim()) {
      newErrors.code = 'Coupon code is required';
    } else if (!/^[A-Z0-9_-]+$/.test(formData.code.toUpperCase())) {
      newErrors.code = 'Code can only contain letters, numbers, hyphens, and underscores';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Coupon name is required';
    }

    if (!formData.type) {
      newErrors.type = 'Coupon type is required';
    }

    // Value validation - only for basic promotion types
    if (formData.type !== 'BOGO' && formData.type !== 'VOLUME_DISCOUNT') {
      if (!formData.value.trim()) {
        newErrors.value = 'Value is required';
      } else {
        const value = parseFloat(formData.value);
        if (isNaN(value) || value <= 0) {
          newErrors.value = 'Value must be a positive number';
        } else if (formData.type === 'PERCENTAGE' && value > 100) {
          newErrors.value = 'Percentage cannot exceed 100%';
        }
      }
    }

    // BOGO validation
    if (formData.type === 'BOGO') {
      if (!formData.bogoType) {
        newErrors.bogoType = 'BOGO type is required';
      }
      if (!formData.buyQuantity || parseInt(formData.buyQuantity) <= 0) {
        newErrors.buyQuantity = 'Buy quantity must be greater than 0';
      }
      if (!formData.getQuantity || parseInt(formData.getQuantity) <= 0) {
        newErrors.getQuantity = 'Get quantity must be greater than 0';
      }
      if ((formData.bogoType === 'BUY_X_GET_Y_PERCENT' || formData.bogoType === 'BUY_X_GET_Y_FIXED') &&
        (!formData.getDiscount || parseFloat(formData.getDiscount) <= 0)) {
        newErrors.getDiscount = 'Discount value is required';
      }
    }

    // Volume discount validation
    if (formData.type === 'VOLUME_DISCOUNT') {
      if (formData.volumeTiers.length === 0) {
        newErrors.volumeTiers = 'At least one volume tier is required';
      } else {
        formData.volumeTiers.forEach((tier, index) => {
          if (!tier.minQuantity || parseInt(tier.minQuantity) <= 0) {
            newErrors[`volumeTier_${index}_minQuantity`] = 'Min quantity is required';
          }
          if (!tier.discountValue || parseFloat(tier.discountValue) <= 0) {
            newErrors[`volumeTier_${index}_discountValue`] = 'Discount value is required';
          }
        });
      }
    }

    // Min Order Amount validation
    if (!formData.minOrderAmount || !formData.minOrderAmount.trim()) {
      newErrors.minOrderAmount = 'Minimum order amount is required';
    } else if (parseFloat(formData.minOrderAmount) < 0) {
      newErrors.minOrderAmount = 'Minimum order amount cannot be negative';
    } else if (
      formData.type === 'PERCENTAGE' || formData.type === 'FIXED_AMOUNT'
    ) {
      const discountVal = parseFloat(formData.value) || 0;
      const minOrder = parseFloat(formData.minOrderAmount);
      if (formData.type === 'FIXED_AMOUNT' && discountVal > minOrder) {
        newErrors.minOrderAmount = 'Minimum order amount must be greater than or equal to the discount value';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const couponData = {
        code: formData.code.toUpperCase(),
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        type: formData.type,
        value: formData.type === 'BOGO' || formData.type === 'VOLUME_DISCOUNT' ? 0 : parseFloat(formData.value),
        minOrderAmount: formData.minOrderAmount ? parseFloat(formData.minOrderAmount) : undefined,
        maxDiscount: formData.maxDiscount ? parseFloat(formData.maxDiscount) : undefined,
        usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : undefined,
        startsAt: formData.startsAt ? new Date(`${formData.startsAt}-08:00`).toISOString() : undefined,
        expiresAt: formData.expiresAt ? new Date(`${formData.expiresAt}-08:00`).toISOString() : undefined,
        isActive: formData.isActive,

        // Individual customer restriction
        isForIndividualCustomer: formData.isForIndividualCustomer,
        specificCustomerIds: selectedCustomers.map(c => c.id),

        // BOGO specific fields
        ...(formData.type === 'BOGO' && {
          bogoType: formData.bogoType,
          buyQuantity: formData.buyQuantity ? parseInt(formData.buyQuantity) : undefined,
          getQuantity: formData.getQuantity ? parseInt(formData.getQuantity) : undefined,
          getDiscount: formData.getDiscount ? parseFloat(formData.getDiscount) : undefined,
        }),

        // Volume discount specific fields
        ...(formData.type === 'VOLUME_DISCOUNT' && {
          volumeTiers: formData.volumeTiers.map(tier => ({
            minQuantity: parseInt(tier.minQuantity),
            maxQuantity: tier.maxQuantity ? parseInt(tier.maxQuantity) : undefined,
            discountType: tier.discountType,
            discountValue: parseFloat(tier.discountValue),
          })),
        }),
      };

      const response = await api.createPromotion(couponData);

      if (response.success) {
        onSuccess();
        resetForm();
      } else {
        toast.error(response.error || 'Failed to create coupon');
      }
    } catch (error) {
      logger.error('Failed to create coupon:', { error: error });
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      type: 'PERCENTAGE',
      value: '',
      minOrderAmount: '',
      maxDiscount: '',
      usageLimit: '',
      startsAt: '',
      expiresAt: '',
      isActive: false,
      customerTypes: [],
      bogoType: '',
      buyQuantity: '',
      getQuantity: '',
      getDiscount: '',
      productRules: [],
      categoryRules: [],
      volumeTiers: [],
    });
    setSelectedCustomers([]);
    setCustomerSearchQuery('');
    setErrors({});
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const [activeTab, setActiveTab] = useState('basic');

  const handleNextTab = (e: React.FormEvent) => {
    e.preventDefault();
    // Basic validation for first tab
    const newErrors: FormErrors = {};
    if (!formData.code.trim()) newErrors.code = 'Coupon code is required';
    if (!formData.name.trim()) newErrors.name = 'Coupon name is required';
    if (!formData.type) newErrors.type = 'Coupon type is required';

    // Value checking only if on basic tab
    if (formData.type !== 'BOGO' && formData.type !== 'VOLUME_DISCOUNT') {
      if (!formData.value.trim()) newErrors.value = 'Value is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setActiveTab('restrictions');
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto w-[calc(100vw-2rem)] sm:w-full p-0 rounded-2xl overflow-hidden border-gray-200">
        <div className="bg-[#043061] px-6 py-5 relative overflow-hidden flex-shrink-0">
          <div className="absolute -top-8 -right-8 w-28 h-28 bg-[#5A9ADA]/25 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Tag className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white">Create Coupon</DialogTitle>
              <p className="text-xs text-white/50 mt-0.5">Create a new promotional coupon code</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pb-4">
          <div className="px-4 sm:px-6 pt-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="restrictions">Restrictions & Limits</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              {/* Content moved to be inside tab logic if needed, but Dialog Content wrapper is sufficient */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Coupon Code *</Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) => handleInputChange('code', e.target.value.toUpperCase())}
                      placeholder="SAVE20"
                      className={errors.code ? 'border-red-500' : ''}
                    />
                    {errors.code && (
                      <p className="text-sm text-red-600">{errors.code}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="type">Type *</Label>
                    <Select value={formData.type} onValueChange={(value: any) => handleInputChange('type', value)}>
                      <SelectTrigger className={errors.type ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PERCENTAGE">Percentage Discount</SelectItem>
                        <SelectItem value="FIXED_AMOUNT">Fixed Amount</SelectItem>
                        <SelectItem value="FREE_SHIPPING">Free Shipping</SelectItem>
                        <SelectItem value="BOGO">Buy One Get One</SelectItem>
                        <SelectItem value="VOLUME_DISCOUNT">Volume Discount</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.type && (
                      <p className="text-sm text-red-600">{errors.type}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Coupon Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="20% Off Summer Sale"
                    className={errors.name ? 'border-red-500' : ''}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-600">{errors.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Optional description for internal use"
                    rows={2}
                  />
                </div>

                {/* Value field - only show for basic promotion types */}
                {formData.type !== 'BOGO' && formData.type !== 'VOLUME_DISCOUNT' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="value">
                        Value * {formData.type === 'PERCENTAGE' ? '(%)' : '($)'}
                      </Label>
                      <Input
                        id="value"
                        type="number"
                        step="0.01"
                        min="0"
                        max={formData.type === 'PERCENTAGE' ? '100' : undefined}
                        value={formData.value}
                        onChange={(e) => handleInputChange('value', e.target.value)}
                        placeholder={formData.type === 'PERCENTAGE' ? '20' : '10.00'}
                        className={errors.value ? 'border-red-500' : ''}
                      />
                      {errors.value && (
                        <p className="text-sm text-red-600">{errors.value}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* BOGO & Volume Tiers components (Same as original) */}
                {/* Simplified re-insertion of existing logic for clarity in diff */}
                {formData.type === 'BOGO' && (
                  <Card className="p-4 space-y-4 border-gray-600 bg-black">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-white" />
                      <h3 className="font-medium text-white">BOGO Configuration</h3>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white">BOGO Type *</Label>
                      <Select value={formData.bogoType} onValueChange={(value) => handleInputChange('bogoType', value)}>
                        <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                          <SelectValue placeholder="Select BOGO type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BUY_X_GET_Y_FREE">Buy X Get Y Free</SelectItem>
                          <SelectItem value="BUY_X_GET_Y_PERCENT">Buy X Get Y at % Off</SelectItem>
                          <SelectItem value="BUY_X_GET_Y_FIXED">Buy X Get Y at Fixed Price</SelectItem>
                          <SelectItem value="CHEAPEST_FREE">Buy X Get Cheapest Free</SelectItem>
                          <SelectItem value="MOST_EXPENSIVE_FREE">Buy X Get Most Expensive Free</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-white">Buy Quantity *</Label>
                        <Input type="number" min="1" value={formData.buyQuantity} onChange={(e) => handleInputChange('buyQuantity', e.target.value)} placeholder="2" className="bg-gray-800 border-gray-600 text-white placeholder-gray-400" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white">Get Quantity *</Label>
                        <Input type="number" min="1" value={formData.getQuantity} onChange={(e) => handleInputChange('getQuantity', e.target.value)} placeholder="1" className="bg-gray-800 border-gray-600 text-white placeholder-gray-400" />
                      </div>
                    </div>
                    {(formData.bogoType === 'BUY_X_GET_Y_PERCENT' || formData.bogoType === 'BUY_X_GET_Y_FIXED') && (
                      <div className="space-y-2">
                        <Label className="text-white">{formData.bogoType === 'BUY_X_GET_Y_PERCENT' ? 'Discount Percentage (%)' : 'Fixed Price ($)'}</Label>
                        <Input type="number" step="0.01" min="0" max={formData.bogoType === 'BUY_X_GET_Y_PERCENT' ? '100' : undefined} value={formData.getDiscount} onChange={(e) => handleInputChange('getDiscount', e.target.value)} placeholder={formData.bogoType === 'BUY_X_GET_Y_PERCENT' ? '50' : '5.00'} className="bg-gray-800 border-gray-600 text-white placeholder-gray-400" />
                      </div>
                    )}
                  </Card>
                )}

                {formData.type === 'VOLUME_DISCOUNT' && (
                  <Card className="p-4 space-y-4 border-gray-600 bg-black">
                    {/* Volume Discount UI logic same as before, simplified for this replace block */}
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-white" />
                      <h3 className="font-medium text-white">Volume Discount Tiers</h3>
                    </div>
                    {formData.volumeTiers.map((tier, index) => (
                      <div key={index} className="border border-gray-600 rounded-lg p-3 space-y-3 bg-gray-800">
                        <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label className="text-xs text-white">Min Quantity *</Label><Input type="number" min="1" value={tier.minQuantity} onChange={(e) => { const newTiers = [...formData.volumeTiers]; newTiers[index] = { ...tier, minQuantity: e.target.value }; setFormData(prev => ({ ...prev, volumeTiers: newTiers })); }} className="bg-gray-700 border-gray-600 text-white placeholder-gray-400" /></div><div className="space-y-1"><Label className="text-xs text-white">Discount Value</Label><Input type="number" value={tier.discountValue} onChange={(e) => { const newTiers = [...formData.volumeTiers]; newTiers[index] = { ...tier, discountValue: e.target.value }; setFormData(prev => ({ ...prev, volumeTiers: newTiers })); }} className="bg-gray-700 border-gray-600 text-white placeholder-gray-400" /></div></div>
                      </div>
                    ))}
                    <Button type="button" variant="outline" onClick={() => setFormData(prev => ({ ...prev, volumeTiers: [...prev.volumeTiers, { minQuantity: '', maxQuantity: '', discountType: 'PERCENTAGE', discountValue: '' }] }))} className="w-full border-gray-500 text-white hover:bg-gray-700">Add Volume Tier</Button>
                  </Card>
                )}
              </div>

              <DialogFooter className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} className="w-full sm:w-auto rounded-xl">Cancel</Button>
                <Button type="button" onClick={handleNextTab} className="w-full sm:w-auto bg-[#043061] hover:bg-[#0b4f96] text-white rounded-xl">Next: Restrictions & Limits</Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="restrictions" className="space-y-4 mt-4">
              <div className="space-y-4 rounded-md border p-3 sm:p-4">
                <h3 className="text-base sm:text-lg font-medium">Customer Limits & Eligibility</h3>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="individual-customer"
                    checked={formData.isForIndividualCustomer}
                    onCheckedChange={(checked) => {
                      setFormData(prev => ({ ...prev, isForIndividualCustomer: checked }));
                      if (!checked) {
                        setSelectedCustomers([]);
                        setCustomerSearchQuery('');
                      }
                    }}
                  />
                  <Label htmlFor="individual-customer">Limit to specific customers only</Label>
                </div>

                {formData.isForIndividualCustomer && (
                  <div className="space-y-4 pl-6 border-l-2 border-gray-100">
                    <div className="space-y-2">
                      <Label>Search & Add Customers</Label>
                      <div className="relative">
                        <Users className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="customer-search"
                          placeholder="Search by name or email..."
                          value={customerSearchQuery}
                          onChange={(e) => {
                            setCustomerSearchQuery(e.target.value);
                            // Trigger search effect
                            setFormData(prev => ({ ...prev, isForIndividualCustomer: true }));
                          }}
                          className="pl-8"
                        />
                      </div>

                      {/* Search Results */}
                      {searchedCustomers.length > 0 && (
                        <div className="border rounded-md shadow-sm max-h-40 overflow-y-auto bg-white dark:bg-gray-800">
                          {searchedCustomers.map(customer => (
                            <div
                              key={customer.id}
                              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex justify-between items-center"
                              onClick={() => handleAddCustomer(customer)}
                            >
                              <div className="text-sm">
                                <div className="font-medium">{customer.firstName} {customer.lastName}</div>
                                <div className="text-xs text-muted-foreground">{customer.email}</div>
                              </div>
                              <Plus className="h-3 w-3" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Selected Customers List */}
                    {selectedCustomers.length > 0 && (
                      <div className="space-y-2">
                        <Label>Selected Customers ({selectedCustomers.length})</Label>
                        <div className="flex flex-wrap gap-2">
                          {selectedCustomers.map(customer => (
                            <Badge key={customer.id} variant="secondary" className="flex items-center gap-1 py-1">
                              {customer.firstName} {customer.lastName}
                              <button
                                type="button"
                                onClick={() => handleRemoveCustomer(customer.id)}
                                className="ml-1 hover:text-red-500"
                              >
                                &times;
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="usageLimit">Total Usage Limit</Label>
                    <Input
                      id="usageLimit"
                      type="number"
                      min="1"
                      value={formData.usageLimit}
                      onChange={(e) => handleInputChange('usageLimit', e.target.value)}
                      placeholder="100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minOrderAmount">
                      Minimum Order Amount ($) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="minOrderAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.minOrderAmount}
                      onChange={(e) => handleInputChange('minOrderAmount', e.target.value)}
                      placeholder="50.00"
                      className={errors.minOrderAmount ? 'border-red-500' : ''}
                    />
                    {errors.minOrderAmount && (
                      <p className="text-sm text-red-600">{errors.minOrderAmount}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxDiscount">Maximum Discount ($)</Label>
                    <Input
                      id="maxDiscount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.maxDiscount}
                      onChange={(e) => handleInputChange('maxDiscount', e.target.value)}
                      placeholder="100.00"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-md border p-3 sm:p-4">
                <h3 className="text-base sm:text-lg font-medium">Schedule</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startsAt">Start Date & Time (PST)</Label>
                    <Input
                      id="startsAt"
                      type="datetime-local"
                      value={formData.startsAt}
                      onChange={(e) => handleInputChange('startsAt', e.target.value)}
                      placeholder="e.g., 2025-11-27T00:01"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expiresAt">Expiry Date & Time (PST)</Label>
                    <Input
                      id="expiresAt"
                      type="datetime-local"
                      value={formData.expiresAt}
                      onChange={(e) => handleInputChange('expiresAt', e.target.value)}
                      placeholder="e.g., 2025-11-28T23:59"
                    />
                  </div>
                </div>
              </div>

              {/* Active Toggle Hide as per requirements */}

              <DialogFooter className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-between">
                <Button type="button" variant="ghost" onClick={() => setActiveTab('basic')} className="w-full sm:w-auto">← Back</Button>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenChange(false)}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto bg-[#043061] hover:bg-[#0b4f96] text-white rounded-xl">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Coupon'
                    )}
                  </Button>
                </div>
              </DialogFooter>
            </TabsContent>
          </Tabs>
          </div>
        </form>
      </DialogContent >
    </Dialog >
  );
}
