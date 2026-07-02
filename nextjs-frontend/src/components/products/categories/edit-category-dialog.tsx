import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import logger from '@/lib/logger';
import { Tag } from 'lucide-react';

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
      <DialogContent className="p-0 rounded-2xl overflow-hidden border-gray-200">
        <div className="bg-[#043061] px-6 py-5 relative overflow-hidden flex-shrink-0">
          <div className="absolute -top-8 -right-8 w-28 h-28 bg-[#5A9ADA]/25 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Tag className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white">Edit Category</DialogTitle>
              <p className="text-xs text-white/50 mt-0.5">Update category name and details</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
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
              className="rounded-xl"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-[#043061] hover:bg-[#0b4f96] text-white rounded-xl">
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 