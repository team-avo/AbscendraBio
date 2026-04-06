import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import logger from '@/lib/logger';

interface EditCategoryDialogProps {
  category: {
    id: string;
    name: string;
    product: {
      name: string;
    };
  };
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditCategoryDialog({
  category,
  open,
  onClose,
  onSuccess,
}: EditCategoryDialogProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(category.name);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Please enter a category name');
      return;
    }

    try {
      setLoading(true);
      const response = await api.updateCategory(category.id, {
        name: name.trim()
      });

      if (response.success) {
        onSuccess();
      } else {
        toast.error(response.error || 'Failed to update category');
      }
    } catch (error) {
      logger.error('Failed to update category:', { error: error });
      toast.error('Failed to update category');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Category</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Product</Label>
            <div className="text-sm text-muted-foreground">
              {category.product.name}
            </div>
          </div>

          <div>
            <Label htmlFor="name">Category Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter category name..."
            />
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
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 