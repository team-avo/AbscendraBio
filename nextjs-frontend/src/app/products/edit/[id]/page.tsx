'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
import { Plus, X, Upload, Package, ArrowLeft, Edit, Trash2, Star, Check, Clock, DollarSign } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { api, Product, ProductVariant, resolveImageUrl } from '@/lib/api';
import logger from '@/lib/logger';

interface ProductFormData {
  name: string;
  description: string;
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  shipstationSku: string;
  categories: string[];
  tags: string[];
  images: { url: string; altText: string; sortOrder: number }[];
  seoTitle?: string;
  seoDescription?: string;
  seoSlug?: string;
}

interface FormErrors {
  name?: string;
  description?: string;
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

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const productId = params.id as string;
  const tabParam = searchParams.get('tab') || 'basic';

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState(tabParam);
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
  const [selectedVariantIdForImages, setSelectedVariantIdForImages] = useState<string>('');
  const [variantImages, setVariantImages] = useState<Record<string, { url: string; altText: string; sortOrder: number }[]>>({});
  const variantRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [lastCreatedVariantId, setLastCreatedVariantId] = useState<string | null>(null);
  const [deleteVariantDialogOpen, setDeleteVariantDialogOpen] = useState(false);
  const [variantToDelete, setVariantToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [cats, tags] = await Promise.all([
          api.getDistinctCategories(),
          api.getDistinctTags(),
        ]);
        let catOpts: string[] = (cats.success ? (cats.data?.categories || []) : []);
        let tagOpts: string[] = (tags.success ? (tags.data?.tags || []) : []);

        if (!catOpts || catOpts.length === 0) {
          const catsList = await api.getCategories({ page: 1, limit: 100 });
          const raw: Array<{ name?: string }> = ((catsList as any)?.data?.categories || []);
          const names: string[] = Array.from(new Set(raw.map((c) => c.name || '').filter(Boolean)));
          catOpts = names;
        }

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

  useEffect(() => {
    if (product) {
      const firstVariantId = product.variants?.[0]?.id || '';
      setSelectedVariantIdForImages(firstVariantId);
      const map: Record<string, { url: string; altText: string; sortOrder: number }[]> = {};
      (product.variants || []).forEach((v: any) => {
        const imgs = (v.images || []).map((img: any, i: number) => ({ url: img.url, altText: img.altText || '', sortOrder: img.sortOrder ?? i }));
        map[v.id] = imgs;
      });
      setVariantImages(map);
    }
  }, [product]);

  // Variants state
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [variantFormData, setVariantFormData] = useState({
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
    variantOptions: [] as { name: string; value: string }[],
    segmentPrices: [] as {
      customerType: 'B2C' | 'B2B' | 'ENTERPRISE_1' | 'ENTERPRISE_2';
      regularPrice: string;
      salePrice: string;
    }[],
    bulkPrices: [] as {
      minQty: string;
      maxQty: string;
      price: string;
    }[],
  });
  const [variantErrors, setVariantErrors] = useState<any>({});
  const [variantFormImages, setVariantFormImages] = useState<Array<{ url: string; altText?: string }>>([]);

  // Related products state
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [upsellProducts, setUpsellProducts] = useState<any[]>([]);
  const [crossSellProducts, setCrossSellProducts] = useState<any[]>([]);
  // Independent search state per relation type
  const [relatedSearchQuery, setRelatedSearchQuery] = useState('');
  const [upsellSearchQuery, setUpsellSearchQuery] = useState('');
  const [crossSearchQuery, setCrossSearchQuery] = useState('');
  const [relatedSearchResults, setRelatedSearchResults] = useState<Product[]>([]);
  const [upsellSearchResults, setUpsellSearchResults] = useState<Product[]>([]);
  const [crossSearchResults, setCrossSearchResults] = useState<Product[]>([]);

  // Reviews state
  const [reviews, setReviews] = useState<any[]>([]);

  useEffect(() => {
    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const response = await api.getProduct(productId);
      if (response.success && response.data) {
        const productData = response.data;
        setProduct(productData);
        setFormData({
          name: productData.name || '',
          description: productData.description || '',
          status: productData.status || 'DRAFT',
          shipstationSku: productData.shipstationSku || '',
          categories: productData.categories?.map(cat => cat.name) || [],
          tags: productData.tags?.map(tag => tag.tag) || [],
          images: productData.images?.map(img => ({
            url: img.url,
            altText: img.altText || '',
            sortOrder: img.sortOrder
          })) || [],
          seoTitle: productData.seoTitle || '',
          seoDescription: productData.seoDescription || '',
          seoSlug: productData.seoSlug || '',
        });

        // Set variants, related products, and reviews
        setVariants(productData.variants || []);

        // Separate related products by type
        const relations = (productData as any).relatedProducts || [];
        setRelatedProducts(relations.filter((r: any) => r.type === 'RELATED'));
        setUpsellProducts(relations.filter((r: any) => r.type === 'UPSELL'));
        setCrossSellProducts(relations.filter((r: any) => r.type === 'CROSS_SELL'));

        setReviews((productData as any).reviews || []);
      } else {
        toast.error('Product not found');
        router.push('/products');
      }
    } catch (error) {
      logger.error('Failed to fetch product:', { error });
      toast.error('Failed to load product');
      router.push('/products');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    const missingFields: string[] = [];

    if (!formData.name.trim()) {
      newErrors.name = 'Product name is required';
      missingFields.push('Product Name');
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Product description is required';
      missingFields.push('Description');
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

  // Scroll to newly created variant after product data is loaded
  useEffect(() => {
    if (lastCreatedVariantId && variantRefs.current[lastCreatedVariantId]) {
      setTimeout(() => {
        variantRefs.current[lastCreatedVariantId]?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
        setLastCreatedVariantId(null);
      }, 300); // Wait a bit longer for the data to render
    }
  }, [variants.length, lastCreatedVariantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!product || !validateForm()) {
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
      };

      const response = await api.updateProduct(product.id, productData);

      if (response.success) {
        // Persist variant images if any were edited
        const vidList = Object.keys(variantImages);
        if (vidList.length > 0) {
          await Promise.all(vidList.map((vid) => api.updateVariant(product.id, vid, {
            images: (variantImages[vid] || []).map((img, i) => ({ ...img, sortOrder: i })),
          })));
        }
        toast.success('Product updated successfully');
        router.push('/products');
      } else {
        toast.error(response.error || 'Failed to update product');
      }
    } catch (error) {
      logger.error('Failed to update product:', { error });
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
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
        sortOrder: imageScope === 'product' ? formData.images.length : ((variantImages[selectedVariantIdForImages] || []).length),
      };

      if (imageScope === 'product') {
        setFormData(prev => ({
          ...prev,
          images: [...prev.images, newImage],
        }));
      } else if (selectedVariantIdForImages) {
        setVariantImages(prev => ({
          ...prev,
          [selectedVariantIdForImages]: [...(prev[selectedVariantIdForImages] || []), newImage],
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
    } else if (selectedVariantIdForImages) {
      setVariantImages(prev => ({
        ...prev,
        [selectedVariantIdForImages]: (prev[selectedVariantIdForImages] || []).filter((_, i) => i !== index),
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
    } else if (selectedVariantIdForImages) {
      setVariantImages(prev => {
        const list = [...(prev[selectedVariantIdForImages] || [])];
        const newIndex = index + delta;
        if (newIndex < 0 || newIndex >= list.length) return prev;
        const [item] = list.splice(index, 1);
        list.splice(newIndex, 0, item);
        return { ...prev, [selectedVariantIdForImages]: list.map((img, i) => ({ ...img, sortOrder: i })) };
      });
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

  // Related products functions
  const searchProducts = async (query: string, target: 'RELATED' | 'UPSELL' | 'CROSS_SELL') => {
    const setResults =
      target === 'RELATED'
        ? setRelatedSearchResults
        : target === 'UPSELL'
          ? setUpsellSearchResults
          : setCrossSearchResults;

    if (!query.trim()) {
      setResults([]);
      return;
    }

    try {
      const response = await api.getProducts({ search: query, limit: 10 });
      const products: Product[] =
        Array.isArray((response as any)?.data?.products)
          ? (response as any).data.products
          : [];

      // Exclude current product and already-added products
      const isAlreadyAdded = (p: Product) =>
        p.id === productId ||
        relatedProducts.some(rp => rp.relatedProduct.id === p.id) ||
        upsellProducts.some(up => up.relatedProduct.id === p.id) ||
        crossSellProducts.some(cp => cp.relatedProduct.id === p.id);

      const filtered = products.filter(p => !isAlreadyAdded(p));
      setResults(filtered);
    } catch (error) {
      logger.error('Failed to search products:', { error });
      setResults([]);
    }
  };

  const addRelatedProduct = async (relatedProductId: string, type: 'RELATED' | 'UPSELL' | 'CROSS_SELL') => {
    try {
      const response = await api.addProductRelation(productId, relatedProductId, type);
      if (response.success) {
        toast.success(`${type.toLowerCase()} product added successfully`);
        // Refresh the product data to get updated relations
        fetchProduct();
      } else {
        toast.error('Failed to add related product');
      }
    } catch (error) {
      toast.error('Failed to add related product');
    }
  };

  const removeRelatedProduct = async (relationId: string, type: string) => {
    try {
      const response = await api.removeProductRelation(productId, relationId);
      if (response.success) {
        toast.success(`${type.toLowerCase()} product removed successfully`);
        // Refresh the product data to get updated relations
        fetchProduct();
      } else {
        toast.error('Failed to remove related product');
      }
    } catch (error) {
      toast.error('Failed to remove related product');
    }
  };

  // Review management functions
  const approveReview = async (reviewId: string) => {
    try {
      const response = await api.approveReview(reviewId);
      if (response.success) {
        toast.success('Review approved successfully');
        fetchProduct(); // Refresh to get updated review status
      } else {
        toast.error('Failed to approve review');
      }
    } catch (error) {
      toast.error('Failed to approve review');
    }
  };

  const deleteReview = async (reviewId: string) => {
    try {
      const response = await api.deleteReview(reviewId);
      if (response.success) {
        toast.success('Review deleted successfully');
        fetchProduct(); // Refresh to get updated reviews
      } else {
        toast.error('Failed to delete review');
      }
    } catch (error) {
      toast.error('Failed to delete review');
    }
  };

  // Variant management functions
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
          .filter((sp: any) => sp.customerType === 'B2C' || sp.customerType === 'ENTERPRISE_1')
          .map((sp: any) => ({
            customerType: sp.customerType as 'B2C' | 'B2B' | 'ENTERPRISE_1' | 'ENTERPRISE_2',
            regularPrice: sp.regularPrice.toString(),
            salePrice: sp.salePrice?.toString() || ''
          })),
        bulkPrices: ((variant as any).bulkPrices || []).map((bp: any) => ({
          minQty: bp.minQty.toString(),
          maxQty: bp.maxQty?.toString() || '',
          price: bp.price.toString()
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
        bulkPrices: [],
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
      bulkPrices: [],
    });
    setVariantFormImages([]);
    setVariantErrors({});
  };

  const validateVariantForm = () => {
    const errors: any = {};
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

    // Weight validation removed as it is now optional

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
    if (!validateVariantForm()) {
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
        bulkPrices: variantFormData.bulkPrices
          .filter(bp => bp.minQty?.trim() && parseFloat(bp.minQty) > 0 && bp.price?.trim() && parseFloat(bp.price) > 0)
          .map(bp => ({
            minQty: parseInt(bp.minQty),
            maxQty: bp.maxQty?.trim() ? parseInt(bp.maxQty) : null,
            price: parseFloat(bp.price)
          })),
      };

      let response;
      if (editingVariant) {
        response = await api.updateProductVariant(productId, editingVariant.id, variantData);
      } else {
        response = await api.createProductVariant(productId, variantData);
      }

      if (response.success) {
        toast.success(`Variant ${editingVariant ? 'updated' : 'created'} successfully`);
        closeVariantForm();
        // Track newly created variant ID for scrolling
        if (!editingVariant && response.data?.id) {
          setLastCreatedVariantId(response.data.id);
        }
        fetchProduct(); // Refresh product data
      } else {
        toast.error(response.error || `Failed to ${editingVariant ? 'update' : 'create'} variant`);
      }
    } catch (error) {
      toast.error(`Failed to ${editingVariant ? 'update' : 'create'} variant`);
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

  const addBulkPrice = () => {
    setVariantFormData(prev => ({
      ...prev,
      bulkPrices: [...prev.bulkPrices, {
        minQty: '',
        maxQty: '',
        price: ''
      }]
    }));
  };

  const removeBulkPrice = (index: number) => {
    setVariantFormData(prev => ({
      ...prev,
      bulkPrices: prev.bulkPrices.filter((_, i) => i !== index)
    }));
  };

  const updateBulkPrice = (index: number, field: string, value: any) => {
    setVariantFormData(prev => ({
      ...prev,
      bulkPrices: prev.bulkPrices.map((bp, i) =>
        i === index ? { ...bp, [field]: value } : bp
      )
    }));
  };


  const handleDeleteVariantClick = (variant: ProductVariant) => {
    setVariantToDelete({ id: variant.id, name: variant.name });
    setDeleteVariantDialogOpen(true);
  };

  const handleDeleteVariantConfirm = async () => {
    if (!variantToDelete) return;

    try {
      const response = await api.deleteProductVariant(productId, variantToDelete.id);
      if (response.success) {
        toast.success('Variant deleted successfully');
        fetchProduct(); // Refresh product data
      } else {
        toast.error('Failed to delete variant');
      }
    } catch (error) {
      toast.error('Failed to delete variant');
    } finally {
      setDeleteVariantDialogOpen(false);
      setVariantToDelete(null);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requiredRoles={['ADMIN', 'MANAGER']}>
        <DashboardLayout>
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner size={32} />
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  if (!product) {
    return (
      <ProtectedRoute requiredRoles={['ADMIN', 'MANAGER']}>
        <DashboardLayout>
          <div className="text-center py-8">
            <p className="text-muted-foreground">Product not found</p>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRoles={['ADMIN', 'MANAGER']}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/products')}
                className="mt-1 sm:mt-0"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline"></span>
              </Button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Edit Product</h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Update product information and details.
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <Tabs value={currentTab} onValueChange={(value) => {
                  // ... (validation logic remains same)
                  const tabs = ['basic', 'variants', 'images', 'categories', 'related', 'reviews'];
                  const currentIndex = tabs.indexOf(currentTab);
                  const newIndex = tabs.indexOf(value);
                  if (newIndex > currentIndex) {
                    const newErrors: FormErrors = {};
                    if (currentTab === 'basic') {
                      if (!formData.name.trim()) newErrors.name = 'Product name is required';
                      if (!formData.description.trim()) newErrors.description = 'Product description is required';
                    }
                    setErrors(newErrors);
                    if (Object.keys(newErrors).length > 0) return;
                  }
                  setCurrentTab(value);
                }} className="w-full">
                  <div className="overflow-x-auto pb-2 scrollbar-hide">
                    <TabsList className="flex w-max sm:w-full sm:grid sm:grid-cols-6 min-w-full">
                      <TabsTrigger value="basic" className="flex-1">Basic Info</TabsTrigger>
                      <TabsTrigger value="variants" className="flex-1">Variants</TabsTrigger>
                      <TabsTrigger value="images" className="flex-1">Images</TabsTrigger>
                      <TabsTrigger value="categories" className="flex-1">Categories</TabsTrigger>
                      <TabsTrigger value="related" className="flex-1">Related</TabsTrigger>
                      <TabsTrigger value="reviews" className="flex-1">Reviews</TabsTrigger>
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
                        onValueChange={(value: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED') =>
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
                          <SelectItem value="ARCHIVED">Archived</SelectItem>
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
                            <Select value={selectedVariantIdForImages} onValueChange={(v) => setSelectedVariantIdForImages(v)}>
                              <SelectTrigger className="w-full sm:w-56">
                                <SelectValue placeholder="Select variant" />
                              </SelectTrigger>
                              <SelectContent>
                                {(product?.variants || []).map((v) => (
                                  <SelectItem key={v.id} value={v.id}>{v.name || v.sku}</SelectItem>
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
                      {(imageScope === 'product' ? formData.images.length === 0 : ((variantImages[selectedVariantIdForImages] || []).length === 0)) ? (
                        <>
                          <Package className="h-12 w-12 mb-2 text-muted-foreground opacity-60" />
                          <div className="text-muted-foreground mb-1">No images uploaded</div>
                          <div className="text-xs text-muted-foreground">Click "Upload Image" or drag and drop to add {imageScope === 'product' ? 'product' : 'variant'} images</div>
                        </>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full">
                          {(imageScope === 'product' ? formData.images : (variantImages[selectedVariantIdForImages] || [])).map((image: any, index: number) => (
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
                              <button
                                type="button"
                                onClick={() => removeCategory(category)}
                                className="ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                              >
                                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                              </button>
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
                              <button
                                type="button"
                                onClick={() => removeTag(tag)}
                                className="ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                              >
                                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="variants" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">Product Variants</h3>
                      <Button
                        type="button"
                        onClick={() => openVariantForm()}
                        size="sm"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Variant
                      </Button>
                    </div>

                    {variants.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No variants created yet</p>
                        <p className="text-sm">Add variants to manage different options like size, color, or material</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {variants.map((variant) => (
                          <div
                            key={variant.id}
                            ref={(el) => {
                              variantRefs.current[variant.id] = el;
                            }}
                            className="rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col h-full"
                          >
                            <div className="p-4 flex flex-col h-full">
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 h-full">
                                <div className="flex-1 space-y-2">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div>
                                      <h4 className="font-medium">{variant.name}</h4>
                                      <p className="text-xs sm:text-sm text-muted-foreground font-mono">SKU: {variant.sku}</p>
                                    </div>
                                    <div className="text-left sm:text-right shrink-0">
                                      <p className="font-bold text-base sm:text-lg">${variant.regularPrice}</p>
                                      {variant.salePrice && (
                                        <p className="text-xs sm:text-sm text-green-601 font-medium">Sale: ${variant.salePrice}</p>
                                      )}
                                    </div>
                                  </div>

                                  <div className="space-y-1">
                                    {variant.shipstationSku && (
                                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <span className="font-medium">ShipStation:</span> {variant.shipstationSku}
                                      </p>
                                    )}
                                    {variant.weight && variant.weight !== 0 && (
                                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <span className="font-medium">Weight:</span> {variant.weight}g
                                      </p>
                                    )}
                                  </div>

                                  {/* SEO Information for Variant */}
                                  {(variant.seoTitle || variant.seoDescription || variant.seoSlug) && (
                                    <div className="mt-2 p-2 bg-muted/30 rounded text-xs">
                                      {variant.seoTitle && (
                                        <p className="truncate"><span className="font-medium">SEO:</span> {variant.seoTitle}</p>
                                      )}
                                    </div>
                                  )}
                                </div>

                                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 pt-3 sm:pt-0 border-t sm:border-0">
                                  <Badge variant={variant.isActive ? "default" : "secondary"} className="h-fit">
                                    {variant.isActive ? "Active" : "Inactive"}
                                  </Badge>
                                  <div className="flex gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      onClick={() => openVariantForm(variant)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                      onClick={() => handleDeleteVariantClick(variant)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="related" className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium mb-4">Related Products</h3>
                      <div className="space-y-6">

                        {/* Related Products */}
                        <div>
                          <h4 className="font-medium mb-2">Related Products</h4>
                          <p className="text-sm text-muted-foreground mb-3">Products that are similar or complementary</p>
                          <div className="border rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="relative flex-1">
                                <Input
                                  placeholder="Search products to add..."
                                  value={relatedSearchQuery}
                                  onChange={(e) => {
                                    const q = e.target.value;
                                    setRelatedSearchQuery(q);
                                    searchProducts(q, 'RELATED');
                                  }}
                                />
                                {relatedSearchResults.length > 0 && (
                                  <div className="absolute top-full left-0 right-0 bg-white border border-t-0 rounded-b-md shadow-lg z-10 max-h-40 overflow-y-auto">
                                    {relatedSearchResults.map((product) => (
                                      <div
                                        key={product.id}
                                        className="p-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                                        onClick={() => {
                                          addRelatedProduct(product.id, 'RELATED');
                                          setRelatedSearchQuery('');
                                          setRelatedSearchResults([]);
                                        }}
                                      >
                                        <div className="font-medium">{product.name}</div>
                                        <div className="text-sm text-muted-foreground">{product.status}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {relatedProducts.length === 0 ? (
                              <div className="text-sm text-muted-foreground">No related products added</div>
                            ) : (
                              <div className="space-y-2">
                                {relatedProducts.map((relation) => (
                                  <div key={relation.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                    <span className="font-medium">{relation.relatedProduct.name}</span>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => removeRelatedProduct(relation.id, 'Related')}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Upsell Products */}
                        <div>
                          <h4 className="font-medium mb-2">Upsell Products</h4>
                          <p className="text-sm text-muted-foreground mb-3">Higher-value alternatives to suggest</p>
                          <div className="border rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="relative flex-1">
                                <Input
                                  placeholder="Search products to add..."
                                  value={upsellSearchQuery}
                                  onChange={(e) => {
                                    const q = e.target.value;
                                    setUpsellSearchQuery(q);
                                    searchProducts(q, 'UPSELL');
                                  }}
                                />
                                {upsellSearchResults.length > 0 && (
                                  <div className="absolute top-full left-0 right-0 bg-white border border-t-0 rounded-b-md shadow-lg z-10 max-h-40 overflow-y-auto">
                                    {upsellSearchResults.map((product) => (
                                      <div
                                        key={product.id}
                                        className="p-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                                        onClick={() => {
                                          addRelatedProduct(product.id, 'UPSELL');
                                          setUpsellSearchQuery('');
                                          setUpsellSearchResults([]);
                                        }}
                                      >
                                        <div className="font-medium">{product.name}</div>
                                        <div className="text-sm text-muted-foreground">{product.status}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {upsellProducts.length === 0 ? (
                              <div className="text-sm text-muted-foreground">No upsell products added</div>
                            ) : (
                              <div className="space-y-2">
                                {upsellProducts.map((relation) => (
                                  <div key={relation.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                    <span className="font-medium">{relation.relatedProduct.name}</span>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => removeRelatedProduct(relation.id, 'Upsell')}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Cross-sell Products */}
                        <div>
                          <h4 className="font-medium mb-2">Cross-sell Products</h4>
                          <p className="text-sm text-muted-foreground mb-3">Products often bought together</p>
                          <div className="border rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="relative flex-1">
                                <Input
                                  placeholder="Search products to add..."
                                  value={crossSearchQuery}
                                  onChange={(e) => {
                                    const q = e.target.value;
                                    setCrossSearchQuery(q);
                                    searchProducts(q, 'CROSS_SELL');
                                  }}
                                />
                                {crossSearchResults.length > 0 && (
                                  <div className="absolute top-full left-0 right-0 bg-white border border-t-0 rounded-b-md shadow-lg z-10 max-h-40 overflow-y-auto">
                                    {crossSearchResults.map((product) => (
                                      <div
                                        key={product.id}
                                        className="p-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                                        onClick={() => {
                                          addRelatedProduct(product.id, 'CROSS_SELL');
                                          setCrossSearchQuery('');
                                          setCrossSearchResults([]);
                                        }}
                                      >
                                        <div className="font-medium">{product.name}</div>
                                        <div className="text-sm text-muted-foreground">{product.status}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {crossSellProducts.length === 0 ? (
                              <div className="text-sm text-muted-foreground">No cross-sell products added</div>
                            ) : (
                              <div className="space-y-2">
                                {crossSellProducts.map((relation) => (
                                  <div key={relation.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                    <span className="font-medium">{relation.relatedProduct.name}</span>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => removeRelatedProduct(relation.id, 'Cross-sell')}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="reviews" className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium mb-4">Product Reviews</h3>

                      {reviews.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No reviews yet</p>
                          <p className="text-sm">Customer reviews will appear here once submitted</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {reviews.map((review) => (
                            <div key={review.id} className="rounded-xl border border-slate-200 bg-slate-50/50">
                              <div className="p-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="flex">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                          <Star
                                            key={star}
                                            className={`h-4 w-4 ${star <= review.rating
                                              ? 'text-yellow-400 fill-current'
                                              : 'text-gray-300'
                                              }`}
                                          />
                                        ))}
                                      </div>
                                      <span className="text-sm text-muted-foreground">
                                        by {review.customer?.firstName} {review.customer?.lastName}
                                      </span>
                                      <Badge variant={review.isApproved ? "default" : "secondary"}>
                                        {review.isApproved ? "Approved" : "Pending"}
                                      </Badge>
                                    </div>
                                    {review.title && (
                                      <h4 className="font-medium mb-1">{review.title}</h4>
                                    )}
                                    {review.comment && (
                                      <p className="text-sm text-muted-foreground">{review.comment}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-2">
                                      {new Date(review.createdAt).toLocaleDateString()}
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {!review.isApproved && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => approveReview(review.id)}
                                      >
                                        <Check className="h-4 w-4 mr-1" />
                                        Approve
                                      </Button>
                                    )}
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => deleteReview(review.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Form Actions */}
                <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 sm:gap-4 pt-6 border-t">
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
                        Updating...
                      </>
                    ) : (
                      'Update Product'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>

          {/* Variant Form Dialog */}
          {showVariantForm && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Weight (g)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={variantFormData.weight}
                        onChange={(e) => setVariantFormData(prev => ({ ...prev, weight: e.target.value }))}
                        placeholder="0.00"
                        className={variantErrors.weight ? 'border-red-500' : ''}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>HSN Code</Label>
                      <Input
                        value={variantFormData.hsn}
                        onChange={(e) => setVariantFormData(prev => ({ ...prev, hsn: e.target.value }))}
                        placeholder="Enter HSN code"
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
                      <div key={index} className="rounded-lg border border-slate-200 bg-white">
                        <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-600">Segment Price {index + 1}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSegmentPrice(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="p-3 sm:p-4 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
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
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Bulk Pricing */}
                  <div className="space-y-4 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <Label>Bulk Pricing</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addBulkPrice}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Bulk Price
                      </Button>
                    </div>

                    {variantFormData.bulkPrices.map((bp, index) => (
                      <div key={index} className="rounded-lg border border-slate-200 bg-white">
                        <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-600">Bulk Price {index + 1}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeBulkPrice(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="p-3 sm:p-4 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            <div className="space-y-2">
                              <Label className="text-xs sm:text-sm">Min Quantity <span className="text-red-500">*</span></Label>
                              <Input
                                type="number"
                                min="1"
                                value={bp.minQty}
                                onChange={(e) => updateBulkPrice(index, 'minQty', e.target.value)}
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
                                onChange={(e) => updateBulkPrice(index, 'maxQty', e.target.value)}
                                placeholder="e.g., 99"
                                className="text-sm"
                              />
                              <p className="text-[10px] sm:text-xs text-muted-foreground">Empty for unlimited</p>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs sm:text-sm">Price <span className="text-red-500">*</span></Label>
                              <div className="relative">
                                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={bp.price}
                                  onChange={(e) => updateBulkPrice(index, 'price', e.target.value)}
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Ideal For</Label>
                      <Input
                        value={variantFormData.idealFor}
                        onChange={(e) => setVariantFormData(prev => ({ ...prev, idealFor: e.target.value }))}
                        placeholder="e.g., Athletes, Skin Health"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Key Benefits</Label>
                      <Input
                        value={variantFormData.keyBenefits}
                        onChange={(e) => setVariantFormData(prev => ({ ...prev, keyBenefits: e.target.value }))}
                        placeholder="e.g., Recovery, Joint Support"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tax Name</Label>
                      <Input
                        value={variantFormData.taxName}
                        onChange={(e) => setVariantFormData(prev => ({ ...prev, taxName: e.target.value }))}
                        placeholder="e.g., GST, VAT"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tax Percentage (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={variantFormData.taxPercentage}
                        onChange={(e) => setVariantFormData(prev => ({ ...prev, taxPercentage: e.target.value }))}
                        placeholder="e.g., 18"
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
                  <div className="flex items-center justify-end gap-4 pt-4 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={closeVariantForm}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleVariantSubmit}
                    >
                      {editingVariant ? 'Update Variant' : 'Create Variant'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Delete Variant Confirmation Dialog */}
          <AlertDialog open={deleteVariantDialogOpen} onOpenChange={setDeleteVariantDialogOpen}>
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
                  onClick={handleDeleteVariantConfirm}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete Variant
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
