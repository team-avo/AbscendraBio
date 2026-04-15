import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import logger from '@/lib/logger';
import { Tag } from 'lucide-react';

interface CreateCategoryDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateCategoryDialog({
  open,
  onClose,
  onSuccess,
}: CreateCategoryDialogProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [productId, setProductId] = useState('');
  const [products, setProducts] = useState<Array<{
    id: string;
    name: string;
    status: string;
  }>>([]);

  const fetchProducts = async () => {
    try {
      const response = await api.getProducts();
      if (response.success && response.data) {
        setProducts(response.data.products || []);
      }
    } catch (error) {
      logger.error('Failed to fetch products:', { error: error });
      toast.error('Failed to load products');
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Please enter a category name');
      return;
    }

    if (!productId) {
      toast.error('Please select a product');
      return;
    }

    try {
      setLoading(true);
      const response = await api.createCategory({
        name: name.trim(),
        productId
      });

      if (response.success) {
        onSuccess();
      } else {
        toast.error(response.error || 'Failed to create category');
      }
    } catch (error) {
      logger.error('Failed to create category:', { error: error });
      toast.error('Failed to create category');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="p-0 rounded-2xl overflow-hidden border-gray-200">
        <div className="bg-[#1B2D4F] px-6 py-5 relative overflow-hidden flex-shrink-0">
          <div className="absolute -top-8 -right-8 w-28 h-28 bg-[#3A6FA0]/25 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Tag className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white">Create Category</DialogTitle>
              <p className="text-xs text-white/50 mt-0.5">Add a new product category</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <Label htmlFor="name">Category Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter category name..."
            />
          </div>

          <div>
            <Label htmlFor="product">Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-[#1B2D4F] hover:bg-[#243d6b] text-white rounded-xl">
              {loading ? 'Creating...' : 'Create Category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 