'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Plus, X, Upload, DollarSign, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, Product, ProductVariant } from '@/lib/api';
import logger from '@/lib/logger';

interface VariantFormData {
  sku: string;
  shipstationSku: string;
  name: string;
  description: string;
  regularPrice: string;
  salePrice: string;
  weight: string;
  hsn: string;
  idealFor: string;
  keyBenefits: string;
  taxName: string;
  taxPercentage: string;
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

interface VariantErrors {
  sku?: string;
  name?: string;
  regularPrice?: string;
  weight?: string;
  segmentPrices?: {
    [spIndex: number]: {
      customerType?: string;
      regularPrice?: string;
    };
  };
}

interface VariantManagementDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function VariantManagementDialog({
  product,
  open,
  onOpenChange,
  onSuccess,
}: VariantManagementDialogProps) {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(false);
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [variantFormData, setVariantFormData] = useState<VariantFormData>({
    sku: '',
    shipstationSku: '',
    name: '',
    description: '',
    regularPrice: '',
    salePrice: '',
    weight: '',
    hsn: '',
    idealFor: '',
    keyBenefits: '',
    taxName: '',
    taxPercentage: '',
    isActive: true,
    seoTitle: '',
    seoDescription: '',
    seoSlug: '',
    variantOptions: [],
    segmentPrices: [],
  });
  const [variantFormImages, setVariantFormImages] = useState<Array<{ url: string; altText?: string }>>([]);
  const [variantErrors, setVariantErrors] = useState<VariantErrors>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [variantToDelete, setVariantToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (open && product) {
      fetchVariants();
    }
  }, [open, product]);

  const fetchVariants = async () => {
    if (!product) return;
    try {
      setLoading(true);
      const response = await api.getProduct(product.id);
      if (response.success && response.data) {
        setVariants(response.data.variants || []);
      }
    } catch (error) {
      logger.error('Failed to fetch variants:', { error: error });
    } finally {
      setLoading(false);
    }
  };

  const openVariantForm = (variant?: ProductVariant) => {
    if (variant) {
      setEditingVariant(variant);
      setVariantFormData({
        sku: variant.sku,
        shipstationSku: variant.shipstationSku || '',
        name: variant.name,
        description: variant.description || '',
        regularPrice: variant.regularPrice.toString(),
        salePrice: variant.salePrice?.toString() || '',
        weight: variant.weight?.toString() || '',
        hsn: variant.hsn || '',
        idealFor: (variant as any).idealFor || '',
        keyBenefits: (variant as any).keyBenefits || '',
        taxName: (variant as any).taxName || '',
        taxPercentage: (variant as any).taxPercentage?.toString?.() || '',
        isActive: variant.isActive,
        seoTitle: variant.seoTitle || '',
        seoDescription: variant.seoDescription || '',
        seoSlug: variant.seoSlug || '',
        variantOptions: variant.variantOptions || [],
        segmentPrices: ((variant as any).segmentPrices || [])
          .filter((sp: any) => sp.customerType === 'B2C' || sp.customerType === 'ENTERPRISE_1') // Only show B2C and ENTERPRISE_1
          .map((sp: any) => ({
            customerType: sp.customerType as 'B2C' | 'ENTERPRISE_1',
            regularPrice: sp.regularPrice.toString(),
            salePrice: sp.salePrice?.toString() || ''
          })),
      });
      // Load variant images if they exist
      const variantImages = (variant as any).images || [];
      setVariantFormImages(variantImages.map((img: any) => ({
        url: img.url || img,
        altText: img.altText || ''
      })));
    } else {
      setEditingVariant(null);
      setVariantFormData({
        sku: '',
        shipstationSku: '',
        name: '',
        description: '',
        regularPrice: '',
        salePrice: '',
        weight: '',
        hsn: '',
        idealFor: '',
        keyBenefits: '',
        taxName: '',
        taxPercentage: '',
        isActive: true,
        seoTitle: '',
        seoDescription: '',
        seoSlug: '',
        variantOptions: [],
        segmentPrices: [],
      });
      setVariantFormImages([]);
    }
    setVariantErrors({});
    setShowVariantForm(true);
  };

  const closeVariantForm = () => {
    setShowVariantForm(false);
    setEditingVariant(null);
    setVariantFormData({
      sku: '',
      shipstationSku: '',
      name: '',
      description: '',
      regularPrice: '',
      salePrice: '',
      weight: '',
      hsn: '',
      idealFor: '',
      keyBenefits: '',
      taxName: '',
      taxPercentage: '',
      isActive: true,
      seoTitle: '',
      seoDescription: '',
      seoSlug: '',
      variantOptions: [],
      segmentPrices: [],
    });
    setVariantFormImages([]);
    setVariantErrors({});
  };

  const validateVariantForm = () => {
    const errors: VariantErrors = {};
    const missingFields: string[] = [];

    if (!variantFormData.sku.trim()) {
      errors.sku = 'SKU is required';
      missingFields.push('SKU');
    }

    if (!variantFormData.name.trim()) {
      errors.name = 'Variant name is required';
      missingFields.push('Variant Name');
    }

    if (!variantFormData.regularPrice || parseFloat(variantFormData.regularPrice) <= 0) {
      errors.regularPrice = 'Regular price is required and must be greater than 0';
      missingFields.push('Regular Price');
    }

    if (!variantFormData.weight || parseFloat(variantFormData.weight) <= 0) {
      errors.weight = 'Weight is required and must be greater than 0';
      missingFields.push('Weight');
    }

    // Validate segment prices
    if (variantFormData.segmentPrices && variantFormData.segmentPrices.length > 0) {
      const segmentErrors: { [spIndex: number]: any } = {};
      variantFormData.segmentPrices.forEach((sp, spIndex) => {
        const segError: any = {};

        if (!sp.customerType) {
          segError.customerType = 'Customer type is required';
          missingFields.push(`Segment ${spIndex + 1}: Customer Type`);
        }

        if (!sp.regularPrice.trim() || parseFloat(sp.regularPrice) <= 0) {
          segError.regularPrice = 'Regular price is required and must be greater than 0';
          missingFields.push(`Segment ${spIndex + 1}: Regular Price`);
        }

        if (Object.keys(segError).length > 0) {
          segmentErrors[spIndex] = segError;
        }
      });

      if (Object.keys(segmentErrors).length > 0) {
        errors.segmentPrices = segmentErrors;
      }
    }

    setVariantErrors(errors);

    // Show toast with missing fields
    if (missingFields.length > 0) {
      toast.error(`Please fill in the following mandatory fields:\n${missingFields.join('\n')}`, {
        duration: 5000,
      });
    }

    return Object.keys(errors).length === 0;
  };

  const handleVariantSubmit = async () => {
    if (!validateVariantForm() || !product) {
      return;
    }

    try {
      const variantData = {
        sku: variantFormData.sku.trim(),
        shipstationSku: variantFormData.shipstationSku.trim() || undefined,
        name: variantFormData.name.trim(),
        description: variantFormData.description.trim(),
        regularPrice: parseFloat(variantFormData.regularPrice),
        salePrice: variantFormData.salePrice?.trim() ? parseFloat(variantFormData.salePrice) : 0,
        weight: variantFormData.weight ? parseFloat(variantFormData.weight) : undefined,
        hsn: variantFormData.hsn.trim() || undefined,
        idealFor: variantFormData.idealFor.trim() || undefined,
        keyBenefits: variantFormData.keyBenefits.trim() || undefined,
        taxName: variantFormData.taxName.trim() || undefined,
        taxPercentage: variantFormData.taxPercentage ? parseFloat(variantFormData.taxPercentage) : undefined,
        isActive: variantFormData.isActive,
        seoTitle: variantFormData.seoTitle.trim() || undefined,
        seoDescription: variantFormData.seoDescription.trim() || undefined,
        seoSlug: variantFormData.seoSlug.trim() || undefined,
        options: variantFormData.variantOptions,
        images: variantFormImages.map((img, index) => ({ url: img.url, altText: img.altText || '', sortOrder: index })),
        segmentPrices: variantFormData.segmentPrices
          .filter(sp => sp.regularPrice?.trim() && parseFloat(sp.regularPrice) > 0)
          .map(sp => {
            const salePriceValue = sp.salePrice?.trim() ? parseFloat(sp.salePrice) : 0;
            return {
              customerType: sp.customerType,
              regularPrice: parseFloat(sp.regularPrice),
              salePrice: salePriceValue
            };
          }),
      };

      let response;
      if (editingVariant) {
        response = await api.updateProductVariant(product.id, editingVariant.id, variantData);
      } else {
        response = await api.createProductVariant(product.id, variantData);
      }

      if (response.success) {
        toast.success(`Variant ${editingVariant ? 'updated' : 'created'} successfully`);
        closeVariantForm();
        fetchVariants();
        if (onSuccess) onSuccess();
      } else {
        toast.error(response.error || `Failed to ${editingVariant ? 'update' : 'create'} variant`);
      }
    } catch (error) {
      toast.error(`Failed to ${editingVariant ? 'update' : 'create'} variant`);
    }
  };

  const handleDeleteClick = (variant: ProductVariant) => {
    setVariantToDelete({ id: variant.id, name: variant.name });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!product || !variantToDelete) return;

    try {
      const response = await api.deleteProductVariant(product.id, variantToDelete.id);
      if (response.success) {
        toast.success('Variant deleted successfully');
        fetchVariants();
        if (onSuccess) onSuccess();
      } else {
        toast.error('Failed to delete variant');
      }
    } catch (error) {
      toast.error('Failed to delete variant');
    } finally {
      setDeleteDialogOpen(false);
      setVariantToDelete(null);
    }
  };

  const addSegmentPrice = () => {
    setVariantFormData(prev => ({
      ...prev,
      segmentPrices: [...prev.segmentPrices, {
        customerType: 'B2C',
        regularPrice: '',
        salePrice: ''
      }]
    }));
  };

  const removeSegmentPrice = (index: number) => {
    setVariantFormData(prev => ({
      ...prev,
      segmentPrices: prev.segmentPrices.filter((_, i) => i !== index)
    }));
  };

  const updateSegmentPrice = (index: number, field: string, value: any) => {
    setVariantFormData(prev => ({
      ...prev,
      segmentPrices: prev.segmentPrices.map((sp, i) =>
        i === index ? { ...sp, [field]: value } : sp
      )
    }));
  };

  if (!product) return null;

  return (
    <>
      <Dialog open={open && !showVariantForm} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Manage Product Variants</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Manage variants for {product.name}
              </p>
              <Button onClick={() => openVariantForm()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Variant
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : variants.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No variants configured</p>
                <p className="text-sm">Click "Add Variant" to create your first variant</p>
              </div>
            ) : (
              <div className="space-y-2">
                {variants.map((variant) => (
                  <Card key={variant.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-4">
                            <div>
                              <h4 className="font-medium">{variant.name}</h4>
                              <p className="text-sm text-muted-foreground">SKU: {variant.sku}</p>
                              {variant.shipstationSku && (
                                <p className="text-sm text-muted-foreground">
                                  ShipStation SKU: {variant.shipstationSku}
                                </p>
                              )}
                              {variant.weight && variant.weight !== 0 && (
                                <p className="text-sm text-muted-foreground">Weight: {variant.weight}g</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-medium">${variant.regularPrice}</p>
                              {variant.salePrice && (
                                <p className="text-sm text-green-600">Sale: ${variant.salePrice}</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openVariantForm(variant)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteClick(variant)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Variant Form Dialog */}
      {showVariantForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-background text-foreground border border-border rounded-lg p-4 sm:p-6 w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">
                {editingVariant ? 'Edit Variant' : 'Add New Variant'}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={closeVariantForm}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              {/* Basic Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">SKU <span className="text-red-500">*</span></Label>
                  <Input
                    value={variantFormData.sku}
                    onChange={(e) => setVariantFormData(prev => ({ ...prev, sku: e.target.value }))}
                    placeholder="Enter SKU"
                    className={`text-sm ${variantErrors.sku ? 'border-red-500' : ''}`}
                  />
                  {variantErrors.sku && (
                    <p className="text-xs text-red-600">{variantErrors.sku}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">ShipStation SKU</Label>
                  <Input
                    value={variantFormData.shipstationSku}
                    onChange={(e) => setVariantFormData(prev => ({ ...prev, shipstationSku: e.target.value }))}
                    placeholder="ShipStation SKU"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Variant Name <span className="text-red-500">*</span></Label>
                  <Input
                    value={variantFormData.name}
                    onChange={(e) => setVariantFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter variant name"
                    className={`text-sm ${variantErrors.name ? 'border-red-500' : ''}`}
                  />
                  {variantErrors.name && (
                    <p className="text-xs text-red-600">{variantErrors.name}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={variantFormData.description}
                  onChange={(e) => setVariantFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter variant description"
                  rows={2}
                />
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Regular Price <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={variantFormData.regularPrice}
                    onChange={(e) => setVariantFormData(prev => ({ ...prev, regularPrice: e.target.value }))}
                    placeholder="0.00"
                    className={variantErrors.regularPrice ? 'border-red-500' : ''}
                  />
                  {variantErrors.regularPrice && (
                    <p className="text-sm text-red-600">{variantErrors.regularPrice}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Sale Price <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={variantFormData.salePrice}
                    onChange={(e) => setVariantFormData(prev => ({ ...prev, salePrice: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Weight and HSN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Weight (g) <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={variantFormData.weight}
                    onChange={(e) => setVariantFormData(prev => ({ ...prev, weight: e.target.value }))}
                    placeholder="0.00"
                    className={`text-sm ${variantErrors.weight ? 'border-red-500' : ''}`}
                  />
                  {variantErrors.weight && (
                    <p className="text-xs text-red-600">{variantErrors.weight}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">HSN Code</Label>
                  <Input
                    value={variantFormData.hsn}
                    onChange={(e) => setVariantFormData(prev => ({ ...prev, hsn: e.target.value }))}
                    placeholder="Enter HSN code"
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Segment Pricing */}
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label>Segment Pricing</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addSegmentPrice}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Segment Price
                  </Button>
                </div>

                {variantFormData.segmentPrices.map((sp, index) => (
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs sm:text-sm">Customer Type <span className="text-red-500">*</span></Label>
                          <select
                            value={sp.customerType}
                            onChange={(e) => updateSegmentPrice(index, 'customerType', e.target.value)}
                            className={`w-full rounded-md border bg-background px-3 py-2 text-sm ${variantErrors.segmentPrices?.[index]?.customerType ? 'border-red-500' : 'border-input'}`}
                          >
                            <option value="B2C">Wholesale</option>
                            <option value="ENTERPRISE_1">Enterprise</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs sm:text-sm">Regular Price <span className="text-red-500">*</span></Label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="number"
                              step="0.01"
                              value={sp.regularPrice}
                              onChange={(e) => updateSegmentPrice(index, 'regularPrice', e.target.value)}
                              placeholder="0.00"
                              className={`pl-10 text-sm ${variantErrors.segmentPrices?.[index]?.regularPrice ? 'border-red-500' : ''}`}
                            />
                          </div>
                          {variantErrors.segmentPrices?.[index]?.regularPrice && (
                            <p className="text-[10px] sm:text-xs text-red-600">{variantErrors.segmentPrices[index].regularPrice}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs sm:text-sm">Sale Price <span className="text-red-500">*</span></Label>
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

              {/* Variant Images */}
              <div className="space-y-2 border-t pt-4">
                <Label>Variant Images</Label>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const files = Array.from(e.dataTransfer.files || []).filter(f => (f as File).type?.startsWith('image/'));
                    for (const file of files as File[]) {
                      const res = await api.uploadFile(file);
                      if (res.success && res.data?.url) {
                        const url = res.data.url;
                        setVariantFormImages(prev => [...prev, { url }]);
                      }
                    }
                  }}
                  className="rounded-md border border-dashed p-4 text-center"
                >
                  {variantFormImages.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-6">
                      <div className="font-medium mb-1">No images uploaded</div>
                      <div>Click &quot;Upload Image&quot; or drag and drop to add variant images</div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {variantFormImages.map((img, idx) => (
                        <div key={idx} className="relative group border rounded-md overflow-hidden">
                          <img src={img.url} alt={img.altText || `Image ${idx + 1}`} className="w-full h-28 object-cover" />
                          <button
                            type="button"
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition bg-white/90 border rounded px-2 py-0.5 text-xs"
                            onClick={() => setVariantFormImages(prev => prev.filter((_, i) => i !== idx))}
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
                            if (res.success && res.data?.url) {
                              const url = res.data.url;
                              setVariantFormImages(prev => [...prev, { url }]);
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

              {/* Marketing & Tax */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Ideal For</Label>
                  <Input
                    value={variantFormData.idealFor}
                    onChange={(e) => setVariantFormData(prev => ({ ...prev, idealFor: e.target.value }))}
                    placeholder="e.g., Athletes, Skin Health"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Key Benefits</Label>
                  <Input
                    value={variantFormData.keyBenefits}
                    onChange={(e) => setVariantFormData(prev => ({ ...prev, keyBenefits: e.target.value }))}
                    placeholder="e.g., Recovery, Joint Support"
                    className="text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Tax Name</Label>
                  <Input
                    value={variantFormData.taxName}
                    onChange={(e) => setVariantFormData(prev => ({ ...prev, taxName: e.target.value }))}
                    placeholder="e.g., GST, VAT"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Tax Percentage (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={variantFormData.taxPercentage}
                    onChange={(e) => setVariantFormData(prev => ({ ...prev, taxPercentage: e.target.value }))}
                    placeholder="e.g., 18"
                    className="text-sm"
                  />
                </div>
              </div>

              {/* SEO Fields */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">SEO Information</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>SEO Title</Label>
                    <Input
                      value={variantFormData.seoTitle}
                      onChange={(e) => setVariantFormData(prev => ({ ...prev, seoTitle: e.target.value }))}
                      placeholder="SEO title for this variant"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>SEO Description</Label>
                    <Textarea
                      value={variantFormData.seoDescription}
                      onChange={(e) => setVariantFormData(prev => ({ ...prev, seoDescription: e.target.value }))}
                      placeholder="SEO description for this variant"
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>SEO Slug</Label>
                    <Input
                      value={variantFormData.seoSlug}
                      onChange={(e) => setVariantFormData(prev => ({ ...prev, seoSlug: e.target.value }))}
                      placeholder="SEO-friendly URL slug (e.g. variant-name)"
                    />
                  </div>
                </div>
              </div>

              {/* Active Status */}
              <div className="flex items-center space-x-2 border-t pt-4">
                <input
                  type="checkbox"
                  id="variant-active"
                  checked={variantFormData.isActive}
                  onChange={(e) => setVariantFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="variant-active">Active</Label>
              </div>

              {/* Form Actions */}
              <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 sm:gap-4 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeVariantForm}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleVariantSubmit}
                  className="w-full sm:w-auto"
                >
                  {editingVariant ? 'Update Variant' : 'Create Variant'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Variant</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the variant <strong>{variantToDelete?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Variant
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

