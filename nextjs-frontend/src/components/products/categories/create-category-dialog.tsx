import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import logger from '@/lib/logger';

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Category</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 