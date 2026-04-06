import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';

interface CategoriesTableProps {
  categories: Array<{
    id: string;
    name: string;
    product: {
      name: string;
      status: string;
    };
  }>;
  loading: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEditCategory: (category: any) => void;
  onDeleteCategory: (categoryId: string) => void;
}

export function CategoriesTable({
  categories,
  loading,
  currentPage,
  totalPages,
  onPageChange,
  onEditCategory,
  onDeleteCategory,
}: CategoriesTableProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border overflow-x-auto">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow>
                <TableHead>Category Name</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Product Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-[80px]" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow>
              <TableHead>Category Name</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Product Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell data-label="Category Name" className="font-medium">{category.name}</TableCell>
                <TableCell data-label="Product">{category.product.name}</TableCell>
                <TableCell data-label="Product Status">{category.product.status}</TableCell>
                <TableCell data-label="Actions" className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEditCategory(category)}
                      className="h-8 w-8 p-0"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDeleteCategory(category.id)}
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {categories.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  No categories found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}