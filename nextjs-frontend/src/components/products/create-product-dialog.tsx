'use client';

import { useState, useRef } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Plus, X, Upload, Package } from 'lucide-react';
import { toast } from 'sonner';
import logger from '@/lib/logger';

interface CreateProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ProductFormData {
  name: string;
  description: string;
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE';
  shipstationSku: string;
  categories: string[];
  tags: string[];
  images: { url: string; altText: string; sortOrder: number }[];
  seoTitle?: string;
  seoDescription?: string;
  seoSlug?: string;
  variants: {
    sku: string;
    shipstationSku: string;
    name: string;
    description: string;
    regularPrice: string;
    salePrice: string;
    weight: string;
    isActive: boolean;
    variantOptions: { name: string; value: string }[];
  }[];
}

interface FormErrors {
  name?: string;
  description?: string;
  variants?: string;
}

export function CreateProductDialog({ open, onOpenChange, onSuccess }: CreateProductDialogProps) {
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    status: 'DRAFT',
    shipstationSku: '',
    categories: [],
    tags: [],
    images: [],
    seoTitle: '',
    seoDescription: '',
    seoSlug: '',
    variants: [{
      sku: '',
      shipstationSku: '',
      name: '',
      description: '',
      regularPrice: '',
      salePrice: '',
      weight: '',
      isActive: true,
      variantOptions: [],
    }],
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newTag, setNewTag] = useState('');
    const [uploadingImage, setUploadingImage] = useState(false);
  const [currentTab, setCurrentTab] = useState('basic-info');
  const tabsRef = useRef<HTMLDivElement>(null);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Product name is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Product description is required';
    }

    if (formData.variants.length === 0) {
      newErrors.variants = 'At least one variant is required';
    } else {
      const hasValidVariant = formData.variants.some(v => 
        v.sku.trim() && v.name.trim() && v.regularPrice
      );
      if (!hasValidVariant) {
        newErrors.variants = 'At least one variant must have SKU, name, and price';
      }
      // Validate weight for all variants
      for (const v of formData.variants) {
        if (v.weight && isNaN(Number(v.weight))) {
          newErrors.variants = 'Variant weight must be a valid number';
          break;
        }
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
      const productData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        status: formData.status,
        shipstationSku: formData.shipstationSku?.trim() || undefined,
        categories: formData.categories,
        tags: formData.tags,
        images: formData.images,
        seoTitle: formData.seoTitle?.trim() || undefined,
        seoDescription: formData.seoDescription?.trim() || undefined,
        seoSlug: formData.seoSlug?.trim() || undefined,
        variants: formData.variants.map(v => ({
          sku: v.sku.trim(),
          shipstationSku: v.shipstationSku.trim() || undefined,
          name: v.name.trim(),
          description: v.description.trim(),
          regularPrice: parseFloat(v.regularPrice),
          salePrice: v.salePrice ? parseFloat(v.salePrice) : undefined,
          weight: v.weight && !isNaN(Number(v.weight)) ? parseFloat(v.weight) : undefined,
          isActive: v.isActive,
          variantOptions: v.variantOptions,
        })),
      };

      const response = await api.createProduct(productData);

      if (response.success) {
        toast.success('Product created successfully');
        onSuccess();
        handleReset();
      } else {
        toast.error(response.error || 'Failed to create product');
      }
    } catch (error) {
      logger.error('Failed to create product:', { error: error });
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      name: '',
      description: '',
      status: 'DRAFT',
      shipstationSku: '',
      categories: [],
      tags: [],
      images: [],
      seoTitle: '',
      seoDescription: '',
      seoSlug: '',
      variants: [{
        sku: '',
        shipstationSku: '',
        name: '',
        description: '',
        regularPrice: '',
        salePrice: '',
        weight: '',
        isActive: true,
        variantOptions: [],
      }],
    });
    setErrors({});
    setNewCategory('');
    setNewTag('');
  };

  const addCategory = () => {
    if (newCategory.trim() && !formData.categories.includes(newCategory.trim())) {
      setFormData(prev => ({
        ...prev,
        categories: [...prev.categories, newCategory.trim()]
      }));
      setNewCategory('');
    }
  };

  const removeCategory = (category: string) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.filter(c => c !== category)
    }));
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };

  const addVariant = () => {
    setFormData(prev => ({
      ...prev,
      variants: [...prev.variants, {
        sku: '',
        shipstationSku: '',
        name: '',
        description: '',
        regularPrice: '',
        salePrice: '',
        weight: '',
        isActive: true,
        variantOptions: [],
      }]
    }));
  };

  const removeVariant = (index: number) => {
    if (formData.variants.length > 1) {
      setFormData(prev => ({
        ...prev,
        variants: prev.variants.filter((_, i) => i !== index)
      }));
    }
  };

  const updateVariant = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map((variant, i) => 
        i === index ? { ...variant, [field]: value } : variant
      )
    }));
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const response = await api.uploadFile(file);
      if (response.success && response.data) {
        setFormData(prev => ({
          ...prev,
          images: [...prev.images, {
            url: response.data!.url,
            altText: formData.name || 'Product image',
            sortOrder: prev.images.length,
          }]
        }));
      }
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

    const handleNextTab = () => {
    const tabs = ['basic-info', 'variants', 'images', 'categories'];
    const currentIndex = tabs.indexOf(currentTab);
    if (currentIndex < tabs.length - 1) {
      setCurrentTab(tabs[currentIndex + 1]);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      handleReset();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto p-0 rounded-2xl overflow-hidden border-gray-200">
        <div className="bg-[#1B2D4F] px-6 py-5 relative overflow-hidden flex-shrink-0">
          <div className="absolute -top-8 -right-8 w-28 h-28 bg-[#3A6FA0]/25 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white">Create Product</DialogTitle>
              <p className="text-xs text-white/50 mt-0.5">Add a new product to your catalog</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="variants">Variants</TabsTrigger>
              <TabsTrigger value="images">Images</TabsTrigger>
              <TabsTrigger value="categories">Categories</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Product Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter product name"
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
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter product description"
                  className={errors.description ? 'border-red-500' : ''}
                  rows={4}
                />
                {errors.description && (
                  <p className="text-sm text-red-600">{errors.description}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="seoTitle">SEO Title</Label>
                <Input
                  id="seoTitle"
                  value={formData.seoTitle}
                  onChange={(e) => setFormData(prev => ({ ...prev, seoTitle: e.target.value }))}
                  placeholder="SEO title for this product"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seoDescription">SEO Description</Label>
                <Textarea
                  id="seoDescription"
                  value={formData.seoDescription}
                  onChange={(e) => setFormData(prev => ({ ...prev, seoDescription: e.target.value }))}
                  placeholder="SEO description for this product"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seoSlug">SEO Slug</Label>
                <Input
                  id="seoSlug"
                  value={formData.seoSlug}
                  onChange={(e) => setFormData(prev => ({ ...prev, seoSlug: e.target.value }))}
                  placeholder="SEO-friendly URL slug (e.g. product-name)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: 'DRAFT' | 'ACTIVE' | 'INACTIVE') => 
                    setFormData(prev => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
                    <div className="space-y-2">
                      <Label htmlFor="shipstationSku">ShipStation SKU</Label>
                      <Input
                        id="shipstationSku"
                        value={formData.shipstationSku}
                        onChange={(e) => setFormData(prev => ({ ...prev, shipstationSku: e.target.value }))}
                        placeholder="ShipStation SKU"
                      />
                    </div>
            </TabsContent>

            <TabsContent value="variants" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Product Variants</h3>
                <Button type="button" onClick={addVariant} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Variant
                </Button>
              </div>

              {errors.variants && (
                <p className="text-sm text-red-600">{errors.variants}</p>
              )}

              <div className="space-y-4">
                {formData.variants.map((variant, index) => (
                  <Card key={index}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Variant {index + 1}</CardTitle>
                        {formData.variants.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeVariant(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>SKU</Label>
                          <Input
                            value={variant.sku}
                            onChange={(e) => updateVariant(index, 'sku', e.target.value)}
                            placeholder="Enter SKU"
                          />
                        </div>
                            <div className="space-y-2">
                              <Label>ShipStation SKU</Label>
                              <Input
                                value={variant.shipstationSku}
                                onChange={(e) => updateVariant(index, 'shipstationSku', e.target.value)}
                                placeholder="ShipStation SKU"
                              />
                            </div>
                        <div className="space-y-2">
                          <Label>Variant Name</Label>
                          <Input
                            value={variant.name}
                            onChange={(e) => updateVariant(index, 'name', e.target.value)}
                            placeholder="Enter variant name"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          value={variant.description}
                          onChange={(e) => updateVariant(index, 'description', e.target.value)}
                          placeholder="Enter variant description"
                          rows={2}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Regular Price ($)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={variant.regularPrice}
                            onChange={(e) => updateVariant(index, 'regularPrice', e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Sale Price ($)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={variant.salePrice}
                            onChange={(e) => updateVariant(index, 'salePrice', e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Weight (g)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={variant.weight}
                            onChange={(e) => updateVariant(index, 'weight', e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={variant.isActive}
                          onCheckedChange={(checked) => updateVariant(index, 'isActive', checked)}
                        />
                        <Label>Active Variant</Label>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="images" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Product Images</h3>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                    />
                    <Button
                      type="button"
                      onClick={() => document.getElementById('image-upload')?.click()}
                      disabled={uploadingImage}
                      size="sm"
                    >
                      {uploadingImage ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Upload Image
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {formData.images.map((image, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={image.url}
                        alt={image.altText}
                        className="w-full h-32 object-cover rounded-md border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeImage(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                {formData.images.length === 0 && (
                  <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                    <Package className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2 text-sm text-gray-600">No images uploaded</p>
                    <p className="text-xs text-gray-500">Click "Upload Image" to add product images</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="categories" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Categories</Label>
                  <div className="flex space-x-2">
                    <Input
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="Add category"
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCategory())}
                    />
                    <Button type="button" onClick={addCategory} size="sm">
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.categories.map((category, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                        {category}
                        <X 
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => removeCategory(category)}
                        />
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Tags</Label>
                  <div className="flex space-x-2">
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="Add tag"
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    />
                    <Button type="button" onClick={addTag} size="sm">
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag, index) => (
                      <Badge key={index} variant="outline" className="flex items-center gap-1">
                        {tag}
                        <X 
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => removeTag(tag)}
                        />
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-[#1B2D4F] hover:bg-[#243d6b] text-white rounded-xl">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Product'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}