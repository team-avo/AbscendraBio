'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Copy,
  Eye,
  Calendar,
  Percent,
  DollarSign
} from 'lucide-react';
import { Promotion } from '@/lib/api';
import { toast } from 'sonner';
import { Pagination } from '../ui/pagination';

interface CouponsTableProps {
  coupons: Promotion[];
  loading: boolean;
  onEdit: (coupon: Promotion) => void;
  onDelete: (coupon: Promotion) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const getStatusColor = (isActive: boolean, expiresAt?: string) => {
  if (!isActive) {
    return 'bg-gray-100 text-gray-800 border-gray-200';
  }

  if (expiresAt && new Date(expiresAt) < new Date()) {
    return 'bg-red-100 text-red-800 border-red-200';
  }

  return 'bg-green-100 text-green-800 border-green-200';
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'PERCENTAGE':
      return <Percent className="h-3 w-3" />;
    case 'FIXED_AMOUNT':
      return <DollarSign className="h-3 w-3" />;
    default:
      return null;
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'PERCENTAGE':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'FIXED_AMOUNT':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'FREE_SHIPPING':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'BOGO':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'VOLUME_DISCOUNT':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const formatValue = (type: string, value: number) => {
  switch (type) {
    case 'PERCENTAGE':
      return `${value}%`;
    case 'FIXED_AMOUNT':
      return `$${value.toFixed(2)}`;
    default:
      return value.toString();
  }
};

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  toast.success('Coupon code copied to clipboard');
};

export function CouponsTable({
  coupons,
  loading,
  onEdit,
  onDelete,
  currentPage,
  totalPages,
  onPageChange,
}: CouponsTableProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (coupons.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No coupons found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Usage Count</TableHead>
              <TableHead>Usage Limit</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coupons.map((coupon) => {
              const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < new Date();
              const usagePercentage = coupon.usageLimit
                ? (coupon.usageCount / coupon.usageLimit) * 100
                : 0;

              return (
                <TableRow key={coupon.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                        {coupon.code}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(coupon.code)}
                        className="h-6 w-6 p-0"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{coupon.name}</div>
                      {coupon.description && (
                        <div className="text-sm text-muted-foreground">
                          {coupon.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getTypeColor(coupon.type)}>
                      <div className="flex items-center gap-1">
                        {getTypeIcon(coupon.type)}
                        {coupon.type.replace('_', ' ')}
                      </div>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">
                      {formatValue(coupon.type, parseFloat(coupon.value.toString()))}
                    </span>
                    {coupon.minOrderAmount && (
                      <div className="text-xs text-muted-foreground">
                        Min: ${parseFloat(coupon.minOrderAmount.toString()).toFixed(2)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {coupon.usageCount}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {coupon.usageLimit ? `${coupon.usageLimit}` : 'Unlimited'}
                    </div>
                  </TableCell>
                  {/* Status Column Removed per requirements */}
                  <TableCell>
                    {coupon.expiresAt ? (
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3" />
                        {new Date(coupon.expiresAt).toLocaleDateString()}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Never</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(coupon)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyToClipboard(coupon.code)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy Code
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDelete(coupon)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages >= 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={onPageChange}
            />
          </div>
        </div>
      )}
    </div>
  );
}
