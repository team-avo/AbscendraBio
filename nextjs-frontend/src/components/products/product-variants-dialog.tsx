'use client';

import { useState, useEffect, useRef } from 'react';
import { api, Product, ProductVariant } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Loader2,
  Plus,
  X,
  Edit,
  Trash2,
  Package,
  DollarSign,
  Weight,
  Hash
} from 'lucide-react';
import { toast } from 'sonner';
import logger from '@/lib/logger';

interface ProductVariantsDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface VariantFormData {
  sku: string;
  shipstationSku: string;
  name: string;
  description: string;
  regularPrice: string;
  salePrice: string;
  weight: string;
  hsn: string;
  isActive: boolean;
  seoTitle: string;
  seoDescription: string;
  seoSlug: string;
  variantOptions: { name: string; value: string }[];
  segmentPrices: {
    customerType: 'B2C' | 'B2B' | 'ENTERPRISE_1' | 'ENTERPRISE_2';
    regularPrice: string;
    salePrice: string;
  }[];
}

interface FormErrors {
  sku?: string;
  name?: string;
  regularPrice?: string;
  seoSlug?: string;
  segmentPrices?: string;
}

export function ProductVariantsDialog({ product, open, onOpenChange, onSuccess }: ProductVariantsDialogProps) {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);
  const [formData, setFormData] = useState<VariantFormData>({
    sku: '',
    shipstationSku: '',
    name: '',
    description: '',
    regularPrice: '',
    salePrice: '',
    weight: '',
    hsn: '',
    seoTitle: '',
    seoDescription: '',
    seoSlug: '',
    isActive: true,
    variantOptions: [],
    segmentPrices: []
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [variantImages, setVariantImages] = useState<Array<{ url: string; altText?: string }>>([]);

  // Load variants when product changes
  useEffect(() => {
    if (product && open) {
      setVariants(product.variants || []);
    }
  }, [product, open]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.sku.trim()) {
      newErrors.sku = 'SKU is required';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Variant name is required';
    }

    if (!formData.regularPrice || parseFloat(formData.regularPrice) <= 0) {
      newErrors.regularPrice = 'Valid regular price is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setFormData({
      sku: '',
      shipstationSku: '',
      name: '',
      description: '',
      regularPrice: '',
      salePrice: '',
      weight: '',
      hsn: '',
      seoTitle: '',
      seoDescription: '',
      seoSlug: '',
      isActive: true,
      variantOptions: [],
      segmentPrices: []
    });
    setErrors({});
    setVariantImages([]);
    setEditingVariant(null);
    setShowAddForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!product || !validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const variantData = {
        sku: formData.sku.trim(),
        shipstationSku: formData.shipstationSku.trim() || undefined,
        name: formData.name.trim(),
        description: formData.description.trim(),
        regularPrice: parseFloat(formData.regularPrice),
        salePrice: formData.salePrice?.trim() ? parseFloat(formData.salePrice) : 0,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        hsn: formData.hsn || undefined,
        isActive: formData.isActive,
        options: formData.variantOptions,
        segmentPrices: formData.segmentPrices
          .filter(sp => sp.regularPrice?.trim() && parseFloat(sp.regularPrice) > 0)
          .map(sp => {
            const salePriceValue = sp.salePrice?.trim() ? parseFloat(sp.salePrice) : 0;
            return {
              customerType: sp.customerType,
              regularPrice: parseFloat(sp.regularPrice),
              salePrice: salePriceValue
            };
          }),
        images: variantImages.map((img, index) => ({ url: img.url, altText: img.altText || '', sortOrder: index }))
      };

      let response;
      if (editingVariant) {
        response = await api.updateProductVariant(product.id, editingVariant.id, variantData);
        if (response.success) {
          toast.success('Variant updated successfully');
        }
      } else {
        response = await api.createProductVariant(product.id, variantData);
        if (response.success) {
          toast.success('Variant created successfully');
        }
      }

      if (response.success) {
        onSuccess();
        resetForm();
      } else {
        toast.error(response.error || 'Failed to save variant');
      }
    } catch (error) {
      logger.error('Failed to save variant:', { error: error });
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (variant: ProductVariant) => {
    setFormData({
      sku: variant.sku,
      shipstationSku: variant.shipstationSku || '',
      name: variant.name,
      description: variant.description || '',
      regularPrice: variant.regularPrice.toString(),
      salePrice: variant.salePrice?.toString() || '',
      weight: variant.weight?.toString() || '',
      hsn: variant.hsn || '',
      isActive: variant.isActive,
      seoTitle: variant.seoTitle || '',
      seoDescription: variant.seoDescription || '',
      seoSlug: variant.seoSlug || '',
      variantOptions: variant.variantOptions || [],
      segmentPrices: (variant.segmentPrices || [])
        .filter(sp => sp.customerType === 'B2C' || sp.customerType === 'ENTERPRISE_1') // Only show B2C and ENTERPRISE_1
        .map(sp => ({
          customerType: sp.customerType as any,
          regularPrice: sp.regularPrice.toString(),
          salePrice: sp.salePrice?.toString() || ''
        }))
    });
    setVariantImages(((variant as any).images || []).map((img: any) => ({ url: img.url, altText: img.altText })));
    setEditingVariant(variant);
    setShowAddForm(true);

    // Smoothly scroll the form into view after it renders
    // Defer to next paint to ensure the element exists
    requestAnimationFrame(() => {
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    });
  };

  const handleDelete = async (variantId: string) => {
    if (!product) return;

    try {
      const response = await api.deleteProductVariant(product.id, variantId);
      if (response.success) {
        toast.success('Variant deleted successfully');
        onSuccess();
      } else {
        toast.error(response.error || 'Failed to delete variant');
      }
    } catch (error) {
      logger.error('Failed to delete variant:', { error: error });
      toast.error('Failed to delete variant');
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getVariantStatus = (variant: ProductVariant) => {
    if (!variant.isActive) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
  };

  const addSegmentPrice = () => {
    setFormData(prev => ({
      ...prev,
      segmentPrices: [...prev.segmentPrices, {
        customerType: 'B2C',
        regularPrice: '',
        salePrice: ''
      }]
    }));
  };

  const removeSegmentPrice = (index: number) => {
    setFormData(prev => ({
      ...prev,
      segmentPrices: prev.segmentPrices.filter((_, i) => i !== index)
    }));
  };

  const updateSegmentPrice = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      segmentPrices: prev.segmentPrices.map((sp, i) =>
        i === index ? { ...sp, [field]: value } : sp
      )
    }));
  };

  if (!product) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[990px] max-h-[95vh] sm:max-h-[90vh] overflow-y-auto bg-background text-foreground p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Manage Product Variants</DialogTitle>
          <DialogDescription>
            Manage variants for {product.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add/Edit Variant Form */}
          {showAddForm && (
            <Card className="bg-card" ref={formRef}>
              <CardHeader>
                <CardTitle className="text-lg">
                  {editingVariant ? 'Edit Variant' : 'Add New Variant'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Variant Images */}
                  <div className="space-y-2">
                    <Label>Variant Images</Label>
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={async (e) => {
                        e.preventDefault();
                        const files = Array.from(e.dataTransfer.files || []).filter(f => (f as File).type?.startsWith('image/'));
                        for (const file of files as File[]) {
                          const res = await api.uploadFile(file);
                          const uploadedUrl = res.success && res.data?.url ? res.data.url : null;
                          if (uploadedUrl) {
                            setVariantImages(prev => [...prev, { url: uploadedUrl }]);
                          }
                        }
                      }}
                      className="rounded-md border border-dashed p-4 text-center"
                    >
                      {variantImages.length === 0 ? (
                        <div className="text-sm text-muted-foreground py-6">
                          <div className="font-medium mb-1">No images uploaded</div>
                          <div>Click &quot;Upload Image&quot; or drag and drop to add variant images</div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {variantImages.map((img, idx) => (
                            <div key={idx} className="relative group border rounded-md overflow-hidden">
                              <img src={img.url} alt={img.altText || `Image ${idx + 1}`} className="w-full h-28 object-cover" />
                              <button
                                type="button"
                                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition bg-white/90 border rounded px-2 py-0.5 text-xs"
                                onClick={() => setVariantImages(prev => prev.filter((_, i) => i !== idx))}
                                title="Remove"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 flex justify-center">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={async () => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.multiple = true;
                            input.onchange = async () => {
                              const files = Array.from(input.files || []);
                              for (const file of files) {
                                const res = await api.uploadFile(file as File);
                                const uploadedUrl = res.success && res.data?.url ? res.data.url : null;
                                if (uploadedUrl) {
                                  setVariantImages(prev => [...prev, { url: uploadedUrl }]);
                                }
                              }
                            };
                            input.click();
                          }}
                        >
                          Upload Image
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sku" className="text-xs sm:text-sm">SKU</Label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="sku"
                          value={formData.sku}
                          onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                          placeholder="Enter SKU"
                          className={`pl-10 text-sm ${errors.sku ? 'border-red-500' : ''}`}
                        />
                      </div>
                      {errors.sku && (
                        <p className="text-[10px] sm:text-xs text-red-600">{errors.sku}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs sm:text-sm">ShipStation SKU</Label>
                      <Input
                        value={formData.shipstationSku}
                        onChange={(e) => setFormData(prev => ({ ...prev, shipstationSku: e.target.value }))}
                        placeholder="ShipStation SKU"
                        className="font-mono text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-xs sm:text-sm">Variant Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter variant name"
                        className={`text-sm ${errors.name ? 'border-red-500' : ''}`}
                      />
                      {errors.name && (
                        <p className="text-[10px] sm:text-xs text-red-600">{errors.name}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Enter variant description"
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="regularPrice" className="text-xs sm:text-sm">Regular Price</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="regularPrice"
                          type="number"
                          step="0.01"
                          value={formData.regularPrice}
                          onChange={(e) => setFormData(prev => ({ ...prev, regularPrice: e.target.value }))}
                          placeholder="0.00"
                          className={`pl-10 text-sm ${errors.regularPrice ? 'border-red-500' : ''}`}
                        />
                      </div>
                      {errors.regularPrice && (
                        <p className="text-[10px] sm:text-xs text-red-600">{errors.regularPrice}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="salePrice" className="text-xs sm:text-sm">Sale Price</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="salePrice"
                          type="number"
                          step="0.01"
                          value={formData.salePrice}
                          onChange={(e) => setFormData(prev => ({ ...prev, salePrice: e.target.value }))}
                          placeholder="0.00"
                          className="pl-10 text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="weight" className="text-xs sm:text-sm">Weight (g)</Label>
                      <div className="relative">
                        <Weight className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="weight"
                          type="number"
                          step="0.01"
                          value={formData.weight}
                          onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))}
                          placeholder="0.00"
                          className="pl-10 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={formData.isActive}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                    />
                    <Label>Active Variant</Label>
                  </div>

                  {/* Segment Pricing */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Segment Pricing</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addSegmentPrice}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Segment Price
                      </Button>
                    </div>

                    {formData.segmentPrices.map((sp, index) => (
                      <Card key={index} className="bg-card">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm">Segment Price {index + 1}</CardTitle>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeSegmentPrice(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-4 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            <div className="space-y-2">
                              <Label className="text-xs sm:text-sm">Customer Type</Label>
                              <select
                                value={sp.customerType}
                                onChange={(e) => updateSegmentPrice(index, 'customerType', e.target.value)}
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              >
                                <option value="B2C">Wholesale</option>
                                <option value="ENTERPRISE_1">Enterprise</option>

                              </select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs sm:text-sm">Regular Price</Label>
                              <div className="relative">
                                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={sp.regularPrice}
                                  onChange={(e) => updateSegmentPrice(index, 'regularPrice', e.target.value)}
                                  placeholder="0.00"
                                  className="pl-10 text-sm"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs sm:text-sm">Sale Price</Label>
                              <div className="relative">
                                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={sp.salePrice}
                                  onChange={(e) => updateSegmentPrice(index, 'salePrice', e.target.value)}
                                  placeholder="0.00"
                                  className="pl-10 text-sm"
                                />
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 sm:space-x-2">
                    <Button type="button" variant="outline" onClick={resetForm} className="w-full sm:w-auto">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        editingVariant ? 'Update Variant' : 'Add Variant'
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Variants List */}
          <Card className="bg-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Product Variants</CardTitle>
                  <CardDescription>
                    {variants.length} variant{variants.length !== 1 ? 's' : ''} configured
                  </CardDescription>
                </div>
                {!showAddForm && (
                  <Button onClick={() => setShowAddForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Variant
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {variants.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No variants</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Get started by adding a product variant.
                  </p>
                  <Button onClick={() => setShowAddForm(true)} className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Variant
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto scrollbar-hide">
                  <Table className="min-w-[800px] sm:min-w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">SKU</TableHead>
                        <TableHead className="whitespace-nowrap">ShipStation SKU</TableHead>
                        <TableHead className="whitespace-nowrap">Name</TableHead>
                        <TableHead className="whitespace-nowrap">Pricing</TableHead>
                        <TableHead className="whitespace-nowrap">Weight</TableHead>
                        <TableHead className="whitespace-nowrap">Status</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {variants.map((variant) => (
                        <TableRow key={variant.id}>
                          <TableCell>
                            <div className="font-mono text-sm">{variant.sku}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-mono text-sm text-muted-foreground whitespace-nowrap">
                              {variant.shipstationSku || '-'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium whitespace-nowrap">{variant.name}</div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 whitespace-nowrap">
                              <div className="font-medium">
                                {formatCurrency(variant.regularPrice)}
                              </div>
                              {variant.salePrice && variant.salePrice < variant.regularPrice && (
                                <div className="text-sm text-green-600">
                                  Sale: {formatCurrency(variant.salePrice)}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {variant.weight && variant.weight !== 0 ? `${variant.weight}g` : '-'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {getVariantStatus(variant)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(variant)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(variant.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}