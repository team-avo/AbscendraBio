'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Package, Target, Users } from 'lucide-react';
import { api, Promotion } from '@/lib/api';
import { toast } from 'sonner';
import logger from '@/lib/logger';

interface EditCouponDialogProps {
  coupon: Promotion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface FormData {
  name: string;
  description: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING' | 'BOGO' | 'VOLUME_DISCOUNT';
  value: string;
  minOrderAmount: string;
  maxDiscount: string;
  usageLimit: string;
  isActive: boolean;
  startsAt: string;
  expiresAt: string;

  // Customer segmentation
  customerTypes: string[];
  isForIndividualCustomer: boolean;
  specificCustomerIds: string[];

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

export function EditCouponDialog({ coupon, open, onOpenChange, onSuccess }: EditCouponDialogProps) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    type: 'PERCENTAGE',
    value: '',
    minOrderAmount: '',
    maxDiscount: '',
    usageLimit: '',
    isActive: true,
    startsAt: '',
    expiresAt: '',
    customerTypes: [],
    isForIndividualCustomer: false,
    specificCustomerIds: [],
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

  useEffect(() => {
    if (coupon) {
      setFormData({
        name: coupon.name,
        description: coupon.description || '',
        type: coupon.type,
        value: coupon.value.toString(),
        minOrderAmount: coupon.minOrderAmount?.toString() || '',
        maxDiscount: coupon.maxDiscount?.toString() || '',
        usageLimit: coupon.usageLimit?.toString() || '',
        isActive: coupon.isActive,
        startsAt: coupon.startsAt ?
          new Date(new Date(coupon.startsAt).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
            .toLocaleString('sv-SE', { timeZone: 'America/Los_Angeles' }).replace(' ', 'T').slice(0, 16)
          : '',
        expiresAt: coupon.expiresAt ?
          new Date(new Date(coupon.expiresAt).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
            .toLocaleString('sv-SE', { timeZone: 'America/Los_Angeles' }).replace(' ', 'T').slice(0, 16)
          : '',
        customerTypes: (coupon as any).customerTypes || [],
        isForIndividualCustomer: (coupon as any).isForIndividualCustomer || false,
        specificCustomerIds: [], // Will be populated from selectedCustomers
        bogoType: (coupon as any).bogoType || '',
        buyQuantity: (coupon as any).buyQuantity?.toString() || '',
        getQuantity: (coupon as any).getQuantity?.toString() || '',
        getDiscount: (coupon as any).getDiscount?.toString() || '',
        productRules: (coupon as any).productRules || [],
        categoryRules: (coupon as any).categoryRules || [],
        volumeTiers: (coupon as any).volumeTiers?.map((tier: any) => ({
          minQuantity: tier.minQuantity.toString(),
          maxQuantity: tier.maxQuantity?.toString() || '',
          discountType: tier.discountType,
          discountValue: tier.discountValue.toString(),
        })) || [],
      });

      // Populate selected customers if present in the coupon object
      if ((coupon as any).specificCustomers && Array.isArray((coupon as any).specificCustomers)) {
        // If specificCustomers contains customer details directly from backend include
        const customers = (coupon as any).specificCustomers.map((sc: any) => sc.customer).filter(Boolean);
        setSelectedCustomers(customers);
      } else {
        setSelectedCustomers([]);
      }
    }
  }, [coupon]);

  const fetchProducts = async () => {
    try {
      const response = await api.getProducts();
      if (response.success) {
        setProducts(response.data?.items || []);
      }
    } catch (error) {
      logger.error('Failed to fetch products:', { error: error });
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.getCategories();
      if (response.success) {
        setCategories(response.data?.categories || []);
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
  }, [customerSearchQuery]);

  const handleAddCustomer = (customer: any) => {
    if (!selectedCustomers.some(c => c.id === customer.id)) {
      setSelectedCustomers([...selectedCustomers, customer]);
    }
    setCustomerSearchQuery('');
    setSearchedCustomers([]);
  };

  const handleRemoveCustomer = (customerId: string) => {
    setSelectedCustomers(selectedCustomers.filter(c => c.id !== customerId));
  };

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };

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
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!coupon || !validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const updateData = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        type: formData.type,
        value: formData.type === 'BOGO' || formData.type === 'VOLUME_DISCOUNT' ? 0 : parseFloat(formData.value),
        minOrderAmount: formData.minOrderAmount ? parseFloat(formData.minOrderAmount) : undefined,
        maxDiscount: formData.maxDiscount ? parseFloat(formData.maxDiscount) : undefined,
        usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : undefined,
        isActive: formData.isActive,
        startsAt: formData.startsAt ? new Date(`${formData.startsAt}-08:00`).toISOString() : undefined,
        expiresAt: formData.expiresAt ? new Date(`${formData.expiresAt}-08:00`).toISOString() : undefined,

        // Customer segmentation
        customerTypes: formData.customerTypes,

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

        // Product and category rules
        productRules: formData.productRules,
        categoryRules: formData.categoryRules,
      };

      const response = await api.updatePromotion(coupon.id, updateData);

      if (response.success) {
        onSuccess();
      } else {
        toast.error(response.error || 'Failed to update coupon');
      }
    } catch (error) {
      logger.error('Failed to update coupon:', { error: error });
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [activeTab, setActiveTab] = useState('basic');

  const handleNextTab = (e: React.FormEvent) => {
    e.preventDefault();
    // Basic validation for first tab
    const newErrors: FormErrors = {};

    // Note: Code is disabled/read-only in edit mode so skipping check or checking existing
    if (!coupon) return;

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

  if (!coupon) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto w-[calc(100vw-2rem)] sm:w-full p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Edit Coupon</DialogTitle>
          <DialogDescription>
            Update the coupon details. Note: The coupon code cannot be changed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pb-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="restrictions">Restrictions & Limits</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Coupon Code</Label>
                  <Input
                    value={coupon.code}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Coupon code cannot be changed
                  </p>
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

              {/* BOGO Specific Configuration */}
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
                      <Input
                        type="number"
                        min="1"
                        value={formData.buyQuantity}
                        onChange={(e) => handleInputChange('buyQuantity', e.target.value)}
                        placeholder="2"
                        className="bg-gray-800 border-gray-600 text-white placeholder-gray-400"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white">Get Quantity *</Label>
                      <Input
                        type="number"
                        min="1"
                        value={formData.getQuantity}
                        onChange={(e) => handleInputChange('getQuantity', e.target.value)}
                        placeholder="1"
                        className="bg-gray-800 border-gray-600 text-white placeholder-gray-400"
                      />
                    </div>
                  </div>

                  {(formData.bogoType === 'BUY_X_GET_Y_PERCENT' || formData.bogoType === 'BUY_X_GET_Y_FIXED') && (
                    <div className="space-y-2">
                      <Label className="text-white">
                        {formData.bogoType === 'BUY_X_GET_Y_PERCENT' ? 'Discount Percentage (%)' : 'Fixed Price ($)'}
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max={formData.bogoType === 'BUY_X_GET_Y_PERCENT' ? '100' : undefined}
                        value={formData.getDiscount}
                        onChange={(e) => handleInputChange('getDiscount', e.target.value)}
                        placeholder={formData.bogoType === 'BUY_X_GET_Y_PERCENT' ? '50' : '5.00'}
                        className="bg-gray-800 border-gray-600 text-white placeholder-gray-400"
                      />
                    </div>
                  )}
                </Card>
              )}

              {/* Volume Discount Configuration */}
              {formData.type === 'VOLUME_DISCOUNT' && (
                <Card className="p-4 space-y-4 border-gray-600 bg-black">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-white" />
                    <h3 className="font-medium text-white">Volume Discount Tiers</h3>
                  </div>

                  {formData.volumeTiers.length === 0 && (
                    <div className="text-center py-4 text-gray-300">
                      <p className="text-sm">No volume tiers configured</p>
                      <p className="text-xs">Add tiers to create quantity-based discounts</p>
                    </div>
                  )}

                  {formData.volumeTiers.map((tier, index) => (
                    <div key={index} className="border border-gray-600 rounded-lg p-3 space-y-3 bg-gray-800">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-white">Tier {index + 1}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newTiers = formData.volumeTiers.filter((_, i) => i !== index);
                            setFormData(prev => ({ ...prev, volumeTiers: newTiers }));
                          }}
                          className="border-gray-500 text-white hover:bg-gray-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-white">Min Quantity *</Label>
                          <Input
                            type="number"
                            min="1"
                            value={tier.minQuantity}
                            onChange={(e) => {
                              const newTiers = [...formData.volumeTiers];
                              newTiers[index] = { ...tier, minQuantity: e.target.value };
                              setFormData(prev => ({ ...prev, volumeTiers: newTiers }));
                            }}
                            placeholder="10"
                            className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-white">Max Quantity (Optional)</Label>
                          <Input
                            type="number"
                            min="1"
                            value={tier.maxQuantity || ''}
                            onChange={(e) => {
                              const newTiers = [...formData.volumeTiers];
                              newTiers[index] = { ...tier, maxQuantity: e.target.value };
                              setFormData(prev => ({ ...prev, volumeTiers: newTiers }));
                            }}
                            placeholder="24"
                            className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-white">Discount Type *</Label>
                          <Select
                            value={tier.discountType}
                            onValueChange={(value) => {
                              const newTiers = [...formData.volumeTiers];
                              newTiers[index] = { ...tier, discountType: value as any };
                              setFormData(prev => ({ ...prev, volumeTiers: newTiers }));
                            }}
                          >
                            <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PERCENTAGE">Percentage Off</SelectItem>
                              <SelectItem value="FIXED_AMOUNT">Fixed Amount Off</SelectItem>
                              <SelectItem value="FIXED_PRICE">Fixed Price Per Unit</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-white">
                            {tier.discountType === 'PERCENTAGE' ? 'Percentage (%)' :
                              tier.discountType === 'FIXED_AMOUNT' ? 'Amount Off ($)' :
                                'Price Per Unit ($)'}
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={tier.discountValue}
                            onChange={(e) => {
                              const newTiers = [...formData.volumeTiers];
                              newTiers[index] = { ...tier, discountValue: e.target.value };
                              setFormData(prev => ({ ...prev, volumeTiers: newTiers }));
                            }}
                            placeholder={tier.discountType === 'PERCENTAGE' ? '15' : '5.00'}
                            className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const newTier = {
                        minQuantity: '',
                        maxQuantity: '',
                        discountType: 'PERCENTAGE' as const,
                        discountValue: ''
                      };
                      setFormData(prev => ({ ...prev, volumeTiers: [...prev.volumeTiers, newTier] }));
                    }}
                    className="w-full border-gray-500 text-white hover:bg-gray-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Volume Tier
                  </Button>
                </Card>
              )}
              <DialogFooter className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">Cancel</Button>
                <Button type="button" onClick={handleNextTab} className="w-full sm:w-auto">Next: Restrictions & Limits</Button>
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
                    <p className="text-xs text-muted-foreground">
                      Current usage: {coupon.usageCount}
                    </p>
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
                      placeholder="e.g., 2025-01-01T00:01"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expiresAt">Expiry Date & Time (PST)</Label>
                    <Input
                      id="expiresAt"
                      type="datetime-local"
                      value={formData.expiresAt}
                      onChange={(e) => handleInputChange('expiresAt', e.target.value)}
                      placeholder="e.g., 2025-12-31T23:59"
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
                    onClick={() => onOpenChange(false)}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Update Coupon'
                    )}
                  </Button>
                </div>
              </DialogFooter>
            </TabsContent>
          </Tabs>

        </form>
      </DialogContent>
    </Dialog >
  );
}
