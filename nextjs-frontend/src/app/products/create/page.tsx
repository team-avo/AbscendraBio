'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { ProtectedRoute } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Plus, X, Upload, Package, ArrowLeft, Check, DollarSign } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { api, resolveImageUrl } from '@/lib/api';
import logger from '@/lib/logger';

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
    images?: { url: string; altText: string; sortOrder: number }[];
    segmentPrices: {
      customerType: 'B2C' | 'B2B' | 'ENTERPRISE_1' | 'ENTERPRISE_2';
      regularPrice: string;
      salePrice: string;
    }[];
    bulkPrices: {
      minQty: string;
      maxQty: string;
      price: string;
    }[];
  }[];
}

interface FormErrors {
  name?: string;
  description?: string;
  variants?: string;
  variantErrors?: {
    [index: number]: {
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
    };
  };
}

export default function CreateProductPage() {
  const router = useRouter();
  const [currentTab, setCurrentTab] = useState('basic');
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
      bulkPrices: [],
    }],
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newTag, setNewTag] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [showCatSelect, setShowCatSelect] = useState(false);
  const [showTagSelect, setShowTagSelect] = useState(false);
  const [selectedCategoryOption, setSelectedCategoryOption] = useState<string>("");
  const [selectedTagOption, setSelectedTagOption] = useState<string>("");
  const [imageScope, setImageScope] = useState<'product' | 'variant'>('product');
  const [imageVariantIndex, setImageVariantIndex] = useState<number>(0);
  const variantRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const [lastAddedVariantIndex, setLastAddedVariantIndex] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [cats, tags] = await Promise.all([
          api.getDistinctCategories(),
          api.getDistinctTags(),
        ]);
        let catOpts: string[] = (cats.success ? (cats.data?.categories || []) : []);
        let tagOpts: string[] = (tags.success ? (tags.data?.tags || []) : []);

        // Fallback: fetch categories list and dedupe names
        if (!catOpts || catOpts.length === 0) {
          const catsList = await api.getCategories({ page: 1, limit: 100 });
          const raw: Array<{ name?: string }> = ((catsList as any)?.data?.categories || []);
          const names: string[] = Array.from(new Set(raw.map((c) => c.name || '').filter(Boolean)));
          catOpts = names;
        }

        // Fallback: aggregate tags from products listing
        if (!tagOpts || tagOpts.length === 0) {
          const prods = await api.getProducts({ page: 1, limit: 100 });
          const raw: Array<{ tags?: Array<{ tag?: string }> }> = ((prods as any)?.data?.products || []);
          const names: string[] = Array.from(new Set(
            raw.flatMap((p) => (p.tags || []).map((t) => t.tag || '')).filter(Boolean)
          ));
          tagOpts = names;
        }

        setAvailableCategories(catOpts);
        setAvailableTags(tagOpts);
      } catch (err) {
        logger.error('Failed loading category/tag options', { error: err });
      }
    })();
  }, []);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    const missingFields: string[] = [];

    // Validate product name
    if (!formData.name.trim()) {
      newErrors.name = 'Product name is required';
      missingFields.push('Product Name');
    }

    // Validate description
    if (!formData.description.trim()) {
      newErrors.description = 'Product description is required';
      missingFields.push('Description');
    }

    // Validate variants
    if (formData.variants.length === 0) {
      newErrors.variants = 'At least one variant is required';
      missingFields.push('At least one variant');
    } else {
      const variantErrors: { [index: number]: any } = {};

      formData.variants.forEach((variant, index) => {
        const variantError: any = {};

        // Validate SKU
        if (!variant.sku.trim()) {
          variantError.sku = 'SKU is required';
          missingFields.push(`Variant ${index + 1}: SKU`);
        }

        // Validate variant name
        if (!variant.name.trim()) {
          variantError.name = 'Variant name is required';
          missingFields.push(`Variant ${index + 1}: Name`);
        }

        // Validate regular price
        if (!variant.regularPrice.trim() || parseFloat(variant.regularPrice) <= 0) {
          variantError.regularPrice = 'Regular price is required and must be greater than 0';
          missingFields.push(`Variant ${index + 1}: Regular Price`);
        }

        // Validate weight
        if (!variant.weight.trim() || parseFloat(variant.weight) <= 0) {
          variantError.weight = 'Weight is required and must be greater than 0';
          missingFields.push(`Variant ${index + 1}: Weight`);
        }

        // Validate segment prices
        if (variant.segmentPrices && variant.segmentPrices.length > 0) {
          const segmentErrors: { [spIndex: number]: any } = {};
          variant.segmentPrices.forEach((sp, spIndex) => {
            const segError: any = {};

            if (!sp.customerType) {
              segError.customerType = 'Customer type is required';
              missingFields.push(`Variant ${index + 1}, Segment ${spIndex + 1}: Customer Type`);
            }

            if (!sp.regularPrice.trim() || parseFloat(sp.regularPrice) <= 0) {
              segError.regularPrice = 'Regular price is required and must be greater than 0';
              missingFields.push(`Variant ${index + 1}, Segment ${spIndex + 1}: Regular Price`);
            }

            if (Object.keys(segError).length > 0) {
              segmentErrors[spIndex] = segError;
            }
          });

          if (Object.keys(segmentErrors).length > 0) {
            variantError.segmentPrices = segmentErrors;
          }
        }

        if (Object.keys(variantError).length > 0) {
          variantErrors[index] = variantError;
        }
      });

      if (Object.keys(variantErrors).length > 0) {
        newErrors.variantErrors = variantErrors;
      }
    }

    setErrors(newErrors);

    // Show toast with missing fields
    if (missingFields.length > 0) {
      toast.error(`Please fill in the following mandatory fields:\n${missingFields.join('\n')}`, {
        duration: 5000,
      });
    }

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
        variants: formData.variants.filter(variant =>
          variant.sku.trim() && variant.name.trim()
        ).map(variant => ({
          ...variant,
          shipstationSku: variant.shipstationSku?.trim() || undefined,
          regularPrice: parseFloat(variant.regularPrice) || 0,
          salePrice: variant.salePrice ? parseFloat(variant.salePrice) : null,
          weight: variant.weight ? parseFloat(variant.weight) : null,
          idealFor: variant.idealFor?.trim() || undefined,
          keyBenefits: variant.keyBenefits?.trim() || undefined,
          taxName: variant.taxName?.trim() || undefined,
          taxPercentage: variant.taxPercentage ? parseFloat(variant.taxPercentage) : undefined,
          images: ((variant as any).images || []).map((img: any, i: number) => ({ ...img, sortOrder: i })),
          segmentPrices: variant.segmentPrices.map(sp => ({
            customerType: sp.customerType,
            regularPrice: parseFloat(sp.regularPrice),
            salePrice: sp.salePrice ? parseFloat(sp.salePrice) : undefined
          })).filter(sp => sp.regularPrice > 0),
          bulkPrices: variant.bulkPrices.map(bp => ({
            minQty: parseInt(bp.minQty),
            maxQty: bp.maxQty ? parseInt(bp.maxQty) : null,
            price: parseFloat(bp.price)
          })).filter(bp => bp.minQty > 0 && bp.price > 0),
        })),
      };

      const response = await api.createProduct(productData);

      if (response.success) {
        toast.success('Product created successfully');
        router.push('/products');
      } else {
        toast.error(response.error || 'Failed to create product');
      }
    } catch (error) {
      logger.error('Failed to create product:', { error });
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addVariant = () => {
    const newIndex = formData.variants.length;
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
        bulkPrices: [],
      }],
    }));
    setLastAddedVariantIndex(newIndex);
  };

  const removeVariant = (index: number) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index),
    }));
  };

  const updateVariant = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map((variant, i) =>
        i === index ? { ...variant, [field]: value } : variant
      ),
    }));
  };

  const addSegmentPrice = (variantIndex: number) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map((variant, i) =>
        i === variantIndex ? {
          ...variant,
          segmentPrices: [...variant.segmentPrices, {
            customerType: 'B2C',
            regularPrice: '',
            salePrice: ''
          }]
        } : variant
      ),
    }));
  };

  const removeSegmentPrice = (variantIndex: number, segmentIndex: number) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map((variant, i) =>
        i === variantIndex ? {
          ...variant,
          segmentPrices: variant.segmentPrices.filter((_, si) => si !== segmentIndex)
        } : variant
      ),
    }));
  };

  const updateSegmentPrice = (variantIndex: number, segmentIndex: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map((variant, i) =>
        i === variantIndex ? {
          ...variant,
          segmentPrices: variant.segmentPrices.map((sp, si) =>
            si === segmentIndex ? { ...sp, [field]: value } : sp
          )
        } : variant
      ),
    }));
  };

  const addBulkPrice = (variantIndex: number) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map((variant, i) =>
        i === variantIndex ? {
          ...variant,
          bulkPrices: [...variant.bulkPrices, {
            minQty: '',
            maxQty: '',
            price: ''
          }]
        } : variant
      ),
    }));
  };

  const removeBulkPrice = (variantIndex: number, bulkIndex: number) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map((variant, i) =>
        i === variantIndex ? {
          ...variant,
          bulkPrices: variant.bulkPrices.filter((_, bi) => bi !== bulkIndex)
        } : variant
      ),
    }));
  };

  const updateBulkPrice = (variantIndex: number, bulkIndex: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map((variant, i) =>
        i === variantIndex ? {
          ...variant,
          bulkPrices: variant.bulkPrices.map((bp, bi) =>
            bi === bulkIndex ? { ...bp, [field]: value } : bp
          )
        } : variant
      ),
    }));
  };


  const addCategory = () => {
    if (newCategory.trim() && !formData.categories.includes(newCategory.trim())) {
      setFormData(prev => ({
        ...prev,
        categories: [...prev.categories, newCategory.trim()],
      }));
      setNewCategory('');
    }
  };

  const removeCategory = (category: string) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.filter(c => c !== category),
    }));
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()],
      }));
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag),
    }));
  };

  const tabs = ['basic', 'variants', 'images', 'categories'];

  const validateCurrentTab = (): boolean => {
    const newErrors: FormErrors = {};
    const missingFields: string[] = [];

    if (currentTab === 'basic') {
      if (!formData.name.trim()) {
        newErrors.name = 'Product name is required';
        missingFields.push('Product Name');
      }
      if (!formData.description.trim()) {
        newErrors.description = 'Product description is required';
        missingFields.push('Description');
      }
    } else if (currentTab === 'variants') {
      if (formData.variants.length === 0) {
        newErrors.variants = 'At least one variant is required';
        missingFields.push('At least one variant');
      } else {
        const variantErrors: { [index: number]: any } = {};

        formData.variants.forEach((variant, index) => {
          const variantError: any = {};

          if (!variant.sku.trim()) {
            variantError.sku = 'SKU is required';
            missingFields.push(`Variant ${index + 1}: SKU`);
          }

          if (!variant.name.trim()) {
            variantError.name = 'Variant name is required';
            missingFields.push(`Variant ${index + 1}: Name`);
          }

          if (!variant.regularPrice.trim() || parseFloat(variant.regularPrice) <= 0) {
            variantError.regularPrice = 'Regular price is required and must be greater than 0';
            missingFields.push(`Variant ${index + 1}: Regular Price`);
          }

          if (!variant.weight.trim() || parseFloat(variant.weight) <= 0) {
            variantError.weight = 'Weight is required and must be greater than 0';
            missingFields.push(`Variant ${index + 1}: Weight`);
          }

          if (variant.segmentPrices && variant.segmentPrices.length > 0) {
            const segmentErrors: { [spIndex: number]: any } = {};
            variant.segmentPrices.forEach((sp, spIndex) => {
              const segError: any = {};

              if (!sp.customerType) {
                segError.customerType = 'Customer type is required';
                missingFields.push(`Variant ${index + 1}, Segment ${spIndex + 1}: Customer Type`);
              }

              if (!sp.regularPrice.trim() || parseFloat(sp.regularPrice) <= 0) {
                segError.regularPrice = 'Regular price is required and must be greater than 0';
                missingFields.push(`Variant ${index + 1}, Segment ${spIndex + 1}: Regular Price`);
              }

              if (Object.keys(segError).length > 0) {
                segmentErrors[spIndex] = segError;
              }
            });

            if (Object.keys(segmentErrors).length > 0) {
              variantError.segmentPrices = segmentErrors;
            }
          }

          if (Object.keys(variantError).length > 0) {
            variantErrors[index] = variantError;
          }
        });

        if (Object.keys(variantErrors).length > 0) {
          newErrors.variantErrors = variantErrors;
        }
      }
    }

    setErrors(newErrors);

    // Show toast with missing fields
    if (missingFields.length > 0) {
      toast.error(`Please fill in the following mandatory fields:\n${missingFields.join('\n')}`, {
        duration: 5000,
      });
    }

    return Object.keys(newErrors).length === 0;
  };

  const nextTab = () => {
    if (!validateCurrentTab()) {
      return;
    }
    const currentIndex = tabs.indexOf(currentTab);
    if (currentIndex < tabs.length - 1) {
      setCurrentTab(tabs[currentIndex + 1]);
    }
  };

  const prevTab = () => {
    const currentIndex = tabs.indexOf(currentTab);
    if (currentIndex > 0) {
      setCurrentTab(tabs[currentIndex - 1]);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageUpload(e.dataTransfer.files[0]);
    }
  }, []);

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const res = await api.uploadFile(file);
      if (!res.success || !res.data?.url) {
        throw new Error(res.error || 'Upload failed');
      }
      const imageUrl = res.data.url;
      const newImage = {
        url: imageUrl,
        altText: file.name,
        sortOrder: imageScope === 'product' ? formData.images.length : ((formData.variants[imageVariantIndex]?.images || []).length),
      };

      if (imageScope === 'product') {
        setFormData(prev => ({
          ...prev,
          images: [...prev.images, newImage],
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          variants: prev.variants.map((v, i) => (
            i === imageVariantIndex ? { ...v, images: [...(v as any).images || [], newImage] } : v
          )),
        }));
      }

      toast.success('Image uploaded successfully');
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = (index: number) => {
    if (imageScope === 'product') {
      setFormData(prev => ({
        ...prev,
        images: prev.images.filter((_, i) => i !== index),
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        variants: prev.variants.map((v, i) => (
          i === imageVariantIndex ? { ...v, images: ((v as any).images || []).filter((_: any, j: number) => j !== index) } : v
        )),
      }));
    }
  };

  const moveImage = (index: number, direction: 'up' | 'down') => {
    const delta = direction === 'up' ? -1 : 1;
    if (imageScope === 'product') {
      setFormData(prev => {
        const list = [...prev.images];
        const newIndex = index + delta;
        if (newIndex < 0 || newIndex >= list.length) return prev;
        const [item] = list.splice(index, 1);
        list.splice(newIndex, 0, item);
        return { ...prev, images: list.map((img, i) => ({ ...img, sortOrder: i })) };
      });
    } else {
      setFormData(prev => {
        const v = prev.variants[imageVariantIndex] as any;
        const list = [...(v?.images || [])];
        const newIndex = index + delta;
        if (newIndex < 0 || newIndex >= list.length) return prev;
        const [item] = list.splice(index, 1);
        list.splice(newIndex, 0, item);
        return {
          ...prev,
          variants: prev.variants.map((vv, i) => (
            i === imageVariantIndex ? { ...(vv as any), images: list.map((img, j) => ({ ...img, sortOrder: j })) } : vv
          )),
        };
      });
    }
  };

  // Scroll to newly added variant
  useEffect(() => {
    if (lastAddedVariantIndex !== null && variantRefs.current[lastAddedVariantIndex]) {
      setTimeout(() => {
        variantRefs.current[lastAddedVariantIndex]?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
        setLastAddedVariantIndex(null);
      }, 100);
    }
  }, [lastAddedVariantIndex, formData.variants.length]);

  // Tab navigation helpers
  const isFirstTab = currentTab === tabs[0];
  const isLastTab = currentTab === tabs[tabs.length - 1];

  return (
    <ProtectedRoute requiredRoles={['ADMIN', 'MANAGER', 'STAFF']}>
      <DashboardLayout>
        <div className="space-y-0">
          {/* ════════ DARK HERO STRIP ════════ */}
          <div className="relative bg-[#070B14] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#4D7DF2]/8 rounded-full blur-[100px] pointer-events-none" />
            <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <button onClick={() => router.push('/products')} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 transition-colors text-xs mb-1.5">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to Products
                  </button>
                  <h1 className="text-xl font-black text-white tracking-tight">Create New Product</h1>
                  <p className="text-xs text-gray-500 mt-0.5">Add a new product to your catalog with variants and details</p>
                </div>
                <div className="flex items-center gap-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-2">
                  <Package className="h-4 w-4 text-[#4D7DF2]" />
                  <div>
                    <p className="text-[9px] text-gray-500 font-medium uppercase tracking-widest leading-none">Products</p>
                    <p className="text-xs font-bold text-white leading-tight mt-0.5">New Product</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm mt-4 mx-1 sm:mx-0">
            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
                  <div className="overflow-x-auto pb-2 scrollbar-hide">
                    <TabsList className="flex w-max sm:w-full sm:grid sm:grid-cols-4 min-w-full">
                      <TabsTrigger value="basic" className="flex-1">Basic Info</TabsTrigger>
                      <TabsTrigger value="variants" className="flex-1">Variants</TabsTrigger>
                      <TabsTrigger value="images" className="flex-1">Images</TabsTrigger>
                      <TabsTrigger value="categories" className="flex-1">Categories</TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="basic" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Product Name <span className="text-red-500">*</span></Label>
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
                      <Label htmlFor="description">Description <span className="text-red-500">*</span></Label>
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
                        placeholder="Enter ShipStation SKU"
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
                        <div
                          key={index}
                          ref={(el) => {
                            variantRefs.current[index] = el;
                          }}
                          className="rounded-xl border border-slate-200 bg-slate-50/50"
                        >
                          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                            <span className="text-sm font-semibold text-slate-700">Variant {index + 1}</span>
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
                          <div className="p-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <Label>SKU <span className="text-red-500">*</span></Label>
                                <Input
                                  value={variant.sku}
                                  onChange={(e) => updateVariant(index, 'sku', e.target.value)}
                                  placeholder="Enter SKU"
                                  className={errors.variantErrors?.[index]?.sku ? 'border-red-500' : ''}
                                />
                                {errors.variantErrors?.[index]?.sku && (
                                  <p className="text-sm text-red-600">{errors.variantErrors[index].sku}</p>
                                )}
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
                                <Label>Variant Name <span className="text-red-500">*</span></Label>
                                <Input
                                  value={variant.name}
                                  onChange={(e) => updateVariant(index, 'name', e.target.value)}
                                  placeholder="Enter variant name"
                                  className={errors.variantErrors?.[index]?.name ? 'border-red-500' : ''}
                                />
                                {errors.variantErrors?.[index]?.name && (
                                  <p className="text-sm text-red-600">{errors.variantErrors[index].name}</p>
                                )}
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

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Regular Price <span className="text-red-500">*</span></Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={variant.regularPrice}
                                  onChange={(e) => updateVariant(index, 'regularPrice', e.target.value)}
                                  placeholder="0.00"
                                  className={errors.variantErrors?.[index]?.regularPrice ? 'border-red-500' : ''}
                                />
                                {errors.variantErrors?.[index]?.regularPrice && (
                                  <p className="text-sm text-red-600">{errors.variantErrors[index].regularPrice}</p>
                                )}
                              </div>
                              <div className="space-y-2">
                                <Label>Sale Price <span className="text-red-500">*</span></Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={variant.salePrice}
                                  onChange={(e) => updateVariant(index, 'salePrice', e.target.value)}
                                  placeholder="0.00"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-sm">Weight (g) <span className="text-red-500">*</span></Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={variant.weight}
                                  onChange={(e) => updateVariant(index, 'weight', e.target.value)}
                                  placeholder="0.00"
                                  className={`text-sm ${errors.variantErrors?.[index]?.weight ? 'border-red-500' : ''}`}
                                />
                                {errors.variantErrors?.[index]?.weight && (
                                  <p className="text-[10px] sm:text-xs text-red-600">{errors.variantErrors[index].weight}</p>
                                )}
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm">HSN Code</Label>
                                <Input
                                  value={variant.hsn}
                                  onChange={(e) => updateVariant(index, 'hsn', e.target.value)}
                                  placeholder="Enter HSN code"
                                  className="text-sm"
                                />
                              </div>
                            </div>

                            {/* Marketing & Tax */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-sm">Ideal For</Label>
                                <Input
                                  value={variant.idealFor}
                                  onChange={(e) => updateVariant(index, 'idealFor', e.target.value)}
                                  placeholder="e.g., Athletes, Skin Health"
                                  className="text-sm"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm">Key Benefits</Label>
                                <Input
                                  value={variant.keyBenefits}
                                  onChange={(e) => updateVariant(index, 'keyBenefits', e.target.value)}
                                  placeholder="e.g., Recovery, Joint Support"
                                  className="text-sm"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-sm">Tax Name</Label>
                                <Input
                                  value={variant.taxName}
                                  onChange={(e) => updateVariant(index, 'taxName', e.target.value)}
                                  placeholder="e.g., GST, VAT"
                                  className="text-sm"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm">Tax Percentage (%)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={variant.taxPercentage}
                                  onChange={(e) => updateVariant(index, 'taxPercentage', e.target.value)}
                                  placeholder="e.g., 18"
                                  className="text-sm"
                                />
                              </div>
                            </div>

                            {/* Segment Pricing */}
                            <div className="space-y-4 border-t pt-4">
                              <div className="flex items-center justify-between">
                                <Label>Segment Pricing</Label>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addSegmentPrice(index)}
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Add Segment Price
                                </Button>
                              </div>

                              {variant.segmentPrices.map((sp, spIndex) => (
                                <div key={spIndex} className="rounded-lg border border-slate-200 bg-white">
                                  <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-600">Segment Price {spIndex + 1}</span>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeSegmentPrice(index, spIndex)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  <div className="p-3 sm:p-6 space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                                      <div className="space-y-2">
                                        <Label className="text-xs sm:text-sm">Customer Type <span className="text-red-500">*</span></Label>
                                        <select
                                          value={sp.customerType}
                                          onChange={(e) => updateSegmentPrice(index, spIndex, 'customerType', e.target.value)}
                                          className={`w-full rounded-md border bg-background px-3 py-2 text-sm ${errors.variantErrors?.[index]?.segmentPrices?.[spIndex]?.customerType ? 'border-red-500' : 'border-input'}`}
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
                                            onChange={(e) => updateSegmentPrice(index, spIndex, 'regularPrice', e.target.value)}
                                            placeholder="0.00"
                                            className={`pl-10 text-sm ${errors.variantErrors?.[index]?.segmentPrices?.[spIndex]?.regularPrice ? 'border-red-500' : ''}`}
                                          />
                                        </div>
                                        {errors.variantErrors?.[index]?.segmentPrices?.[spIndex]?.regularPrice && (
                                          <p className="text-[10px] sm:text-xs text-red-600">{errors.variantErrors[index].segmentPrices[spIndex].regularPrice}</p>
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
                                            onChange={(e) => updateSegmentPrice(index, spIndex, 'salePrice', e.target.value)}
                                            placeholder="0.00"
                                            className="pl-10 text-sm"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Bulk Pricing */}
                            <div className="space-y-4 border-t pt-4">
                              <div className="flex items-center justify-between">
                                <Label>Bulk Pricing</Label>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addBulkPrice(index)}
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Add Bulk Price
                                </Button>
                              </div>

                              {variant.bulkPrices.map((bp, bpIndex) => (
                                <div key={bpIndex} className="rounded-lg border border-slate-200 bg-white">
                                  <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-600">Bulk Price {bpIndex + 1}</span>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeBulkPrice(index, bpIndex)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  <div className="p-3 sm:p-6 space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                                      <div className="space-y-2">
                                        <Label className="text-xs sm:text-sm">Min Quantity <span className="text-red-500">*</span></Label>
                                        <Input
                                          type="number"
                                          min="1"
                                          value={bp.minQty}
                                          onChange={(e) => updateBulkPrice(index, bpIndex, 'minQty', e.target.value)}
                                          placeholder="e.g., 50"
                                          className="text-sm"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs sm:text-sm">Max Quantity</Label>
                                        <Input
                                          type="number"
                                          min="1"
                                          value={bp.maxQty}
                                          onChange={(e) => updateBulkPrice(index, bpIndex, 'maxQty', e.target.value)}
                                          placeholder="e.g., 99"
                                          className="text-sm"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs sm:text-sm">Price <span className="text-red-500">*</span></Label>
                                        <div className="relative">
                                          <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                          <Input
                                            type="number"
                                            step="0.01"
                                            value={bp.price}
                                            onChange={(e) => updateBulkPrice(index, bpIndex, 'price', e.target.value)}
                                            placeholder="0.00"
                                            className="pl-10 text-sm"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* SEO Fields for Variant */}
                            <div className="border-t pt-4">
                              <h4 className="font-medium mb-3">SEO Information for this variant</h4>
                              <div className="space-y-4 text-black dark:text-black">
                                <div className="space-y-2">
                                  <Label>SEO Title</Label>
                                  <Input
                                    value={variant.seoTitle}
                                    onChange={(e) => updateVariant(index, 'seoTitle', e.target.value)}
                                    placeholder="SEO title for this variant"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>SEO Description</Label>
                                  <Textarea
                                    value={variant.seoDescription}
                                    onChange={(e) => updateVariant(index, 'seoDescription', e.target.value)}
                                    placeholder="SEO description for this variant"
                                    rows={2}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>SEO Slug</Label>
                                  <Input
                                    value={variant.seoSlug}
                                    onChange={(e) => updateVariant(index, 'seoSlug', e.target.value)}
                                    placeholder="SEO-friendly URL slug (e.g. variant-name)"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`variant-active-${index}`}
                                checked={variant.isActive}
                                onChange={(e) => updateVariant(index, 'isActive', e.target.checked)}
                                className="rounded border-gray-300"
                              />
                              <Label htmlFor={`variant-active-${index}`}>Active</Label>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="images" className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <h3 className="text-lg font-medium">Images</h3>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Select value={imageScope} onValueChange={(v) => setImageScope(v as any)}>
                            <SelectTrigger className="w-full sm:w-48">
                              <SelectValue placeholder="Select scope" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="product">Product Images</SelectItem>
                              <SelectItem value="variant">Variant Images</SelectItem>
                            </SelectContent>
                          </Select>
                          {imageScope === 'variant' && (
                            <Select value={String(imageVariantIndex)} onValueChange={(v) => setImageVariantIndex(parseInt(v, 10))}>
                              <SelectTrigger className="w-full sm:w-56">
                                <SelectValue placeholder="Select variant" />
                              </SelectTrigger>
                              <SelectContent>
                                {formData.variants.map((v, i) => (
                                  <SelectItem key={i} value={String(i)}>{v.name || v.sku || `Variant ${i + 1}`}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleImageUpload(file);
                            }
                          }}
                          className="hidden"
                          ref={fileInputRef}
                          id="image-upload"
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingImage}
                          className="flex items-center gap-2 w-full sm:w-auto justify-center"
                        >
                          <Upload className="h-4 w-4" />
                          Upload Image
                        </Button>
                      </div>
                    </div>

                    <div
                      className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center transition-colors ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-muted'}`}
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      style={{ minHeight: '180px', cursor: 'pointer' }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {(imageScope === 'product' ? formData.images.length === 0 : ((formData.variants[imageVariantIndex] as any)?.images || []).length === 0) ? (
                        <>
                          <Package className="h-12 w-12 mb-2 text-muted-foreground opacity-60" />
                          <div className="text-muted-foreground mb-1">No images uploaded</div>
                          <div className="text-xs text-muted-foreground">Click "Upload Image" or drag and drop to add {imageScope === 'product' ? 'product' : 'variant'} images</div>
                        </>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full">
                          {(imageScope === 'product' ? formData.images : (((formData.variants[imageVariantIndex] as any)?.images) || [])).map((image: any, index: number) => (
                            <div key={index} className="relative group">
                              <img
                                src={resolveImageUrl(image.url)}
                                alt={image.altText}
                                className="w-full h-32 object-cover rounded-lg border"
                              />
                              <div className="absolute left-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button type="button" size="icon" variant="secondary" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); moveImage(index, 'up'); }}>↑</Button>
                                <Button type="button" size="icon" variant="secondary" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); moveImage(index, 'down'); }}>↓</Button>
                              </div>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={e => { e.stopPropagation(); removeImage(index); }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                      {uploadingImage && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-10">
                          <LoadingSpinner size={24} className="text-blue-500" />
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="categories" className="space-y-4">
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-medium mb-2">Categories</h3>
                        {availableCategories.length > 0 && (
                          <div className="mb-3 space-y-2">
                            <div className="flex gap-2">
                              <Select
                                value={selectedCategoryOption}
                                onValueChange={(val) => setSelectedCategoryOption(val)}
                              >
                                <SelectTrigger className="w-64">
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableCategories.map((cat) => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  if (selectedCategoryOption && !formData.categories.includes(selectedCategoryOption)) {
                                    setFormData(prev => ({ ...prev, categories: [...prev.categories, selectedCategoryOption] }));
                                  }
                                }}
                              >
                                Add
                              </Button>
                            </div>
                          </div>
                        )}
                        {/* Dropdown multi-select */}
                        {availableCategories.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {availableCategories.map((cat) => {
                              const active = formData.categories.includes(cat);
                              return (
                                <Button
                                  type="button"
                                  key={cat}
                                  variant={active ? 'secondary' : 'outline'}
                                  size="sm"
                                  onClick={() => {
                                    setFormData((prev) => ({
                                      ...prev,
                                      categories: active
                                        ? prev.categories.filter((c) => c !== cat)
                                        : [...prev.categories, cat],
                                    }));
                                  }}
                                >
                                  {cat}
                                </Button>
                              );
                            })}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Input
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                            placeholder="Add category"
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCategory())}
                          />
                          <Button type="button" onClick={addCategory} size="sm">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {formData.categories.map((category) => (
                            <Badge key={category} variant="secondary" className="flex items-center gap-1">
                              {category}
                              <X
                                className="h-3 w-3 cursor-pointer"
                                onClick={() => removeCategory(category)}
                              />
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-medium mb-2">Tags</h3>
                        {availableTags.length > 0 && (
                          <div className="mb-3 space-y-2">
                            <div className="flex gap-2">
                              <Select
                                value={selectedTagOption}
                                onValueChange={(val) => setSelectedTagOption(val)}
                              >
                                <SelectTrigger className="w-64">
                                  <SelectValue placeholder="Select tag" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableTags.map((tag) => (
                                    <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  if (selectedTagOption && !formData.tags.includes(selectedTagOption)) {
                                    setFormData(prev => ({ ...prev, tags: [...prev.tags, selectedTagOption] }));
                                  }
                                }}
                              >
                                Add
                              </Button>
                            </div>
                          </div>
                        )}
                        {/* Dropdown multi-select */}
                        {availableTags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {availableTags.map((tag) => {
                              const active = formData.tags.includes(tag);
                              return (
                                <Button
                                  type="button"
                                  key={tag}
                                  variant={active ? 'secondary' : 'outline'}
                                  size="sm"
                                  onClick={() => {
                                    setFormData((prev) => ({
                                      ...prev,
                                      tags: active
                                        ? prev.tags.filter((t) => t !== tag)
                                        : [...prev.tags, tag],
                                    }));
                                  }}
                                >
                                  {tag}
                                </Button>
                              );
                            })}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Input
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            placeholder="Add tag"
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                          />
                          <Button type="button" onClick={addTag} size="sm">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {formData.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="flex items-center gap-1">
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

                  {/* Navigation Buttons */}
                  <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 sm:gap-4 pt-6 border-t mt-6">
                    {!isFirstTab && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={prevTab}
                        disabled={isSubmitting}
                        className="w-full sm:w-auto"
                      >
                        Back
                      </Button>
                    )}
                    {!isLastTab ? (
                      <Button
                        type="button"
                        onClick={nextTab}
                        disabled={isSubmitting}
                        className="w-full sm:w-auto"
                      >
                        Save & Next
                      </Button>
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => router.push('/products')}
                          disabled={isSubmitting}
                          className="w-full sm:w-auto"
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                          {isSubmitting ? (
                            <>
                              <LoadingSpinner size={16} className="mr-2" />
                              Creating...
                            </>
                          ) : (
                            'Create Product'
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </Tabs>
              </form>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
