import React from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Code } from 'lucide-react';

interface Placeholder {
  key: string;
  label: string;
  description: string;
  category: string;
}

const PLACEHOLDERS: Placeholder[] = [
  // Customer Information
  { key: '{{customerName}}', label: 'Customer Name', description: 'Full name of the customer', category: 'Customer' },
  { key: '{{customerEmail}}', label: 'Customer Email', description: 'Email address of the customer', category: 'Customer' },
  { key: '{{customerPhone}}', label: 'Customer Phone', description: 'Phone number of the customer', category: 'Customer' },
  
  // Order Information
  { key: '{{orderNumber}}', label: 'Order Number', description: 'Unique order identifier', category: 'Order' },
  { key: '{{orderDate}}', label: 'Order Date', description: 'Date when order was placed', category: 'Order' },
  { key: '{{orderTotal}}', label: 'Order Total', description: 'Total amount of the order', category: 'Order' },
  { key: '{{orderItems}}', label: 'Order Items', description: 'List of items in the order', category: 'Order' },
  { key: '{{orderStatus}}', label: 'Order Status', description: 'Current status of the order', category: 'Order' },
  
  // Shipping Information
  { key: '{{trackingNumber}}', label: 'Tracking Number', description: 'Shipping tracking number', category: 'Shipping' },
  { key: '{{carrier}}', label: 'Carrier', description: 'Shipping carrier name', category: 'Shipping' },
  { key: '{{estimatedDelivery}}', label: 'Estimated Delivery', description: 'Estimated delivery date', category: 'Shipping' },
  { key: '{{shippingAddress}}', label: 'Shipping Address', description: 'Customer shipping address', category: 'Shipping' },
  
  // Store Information
  { key: '{{storeName}}', label: 'Store Name', description: 'Name of your store', category: 'Store' },
  { key: '{{storeEmail}}', label: 'Store Email', description: 'Store contact email', category: 'Store' },
  { key: '{{storePhone}}', label: 'Store Phone', description: 'Store contact phone', category: 'Store' },
  { key: '{{storeAddress}}', label: 'Store Address', description: 'Store physical address', category: 'Store' },
  { key: '{{storeWebsite}}', label: 'Store Website', description: 'Store website URL', category: 'Store' },
  
  // Account & Security
  { key: '{{verificationLink}}', label: 'Verification Link', description: 'Account verification URL', category: 'Account' },
  { key: '{{resetPasswordLink}}', label: 'Reset Password Link', description: 'Password reset URL', category: 'Account' },
  { key: '{{loginLink}}', label: 'Login Link', description: 'Login page URL', category: 'Account' },
  
  // Promotions & Discounts
  { key: '{{discountCode}}', label: 'Discount Code', description: 'Promotional discount code', category: 'Promotions' },
  { key: '{{discountAmount}}', label: 'Discount Amount', description: 'Amount of discount', category: 'Promotions' },
  { key: '{{expiryDate}}', label: 'Expiry Date', description: 'Promotion expiry date', category: 'Promotions' },
];

interface PlaceholderHelperProps {
  onInsertPlaceholder: (placeholder: string) => void;
}

export function PlaceholderHelper({ onInsertPlaceholder }: PlaceholderHelperProps) {
  const categories = [...new Set(PLACEHOLDERS.map(p => p.category))];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 px-3">
          <Code className="h-4 w-4 mr-2" />
          Insert Placeholder
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-h-96 overflow-y-auto">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Available Placeholders</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Click on any placeholder to insert it into your email content
            </p>
          </div>
          
          {categories.map(category => (
            <div key={category}>
              <h5 className="font-medium text-sm mb-2 text-gray-700 dark:text-gray-300">
                {category}
              </h5>
              <div className="space-y-2">
                {PLACEHOLDERS
                  .filter(p => p.category === category)
                  .map(placeholder => (
                    <div
                      key={placeholder.key}
                      className="p-2 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                      onClick={() => onInsertPlaceholder(placeholder.key)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <Badge variant="secondary" className="text-xs mb-1">
                            {placeholder.label}
                          </Badge>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {placeholder.description}
                          </p>
                        </div>
                        <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                          {placeholder.key}
                        </code>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Helper function to extract placeholders from content
export function extractPlaceholders(content: string): string[] {
  const placeholderRegex = /\{\{([^}]+)\}\}/g;
  const placeholders: string[] = [];
  let match;
  
  while ((match = placeholderRegex.exec(content)) !== null) {
    placeholders.push(match[0]); // Full placeholder with {{}}
  }
  
  return [...new Set(placeholders)]; // Remove duplicates
}

// Helper function to validate placeholders
export function validatePlaceholders(content: string): { valid: boolean; invalid: string[] } {
  const foundPlaceholders = extractPlaceholders(content);
  const validPlaceholders = PLACEHOLDERS.map(p => p.key);
  const invalidPlaceholders = foundPlaceholders.filter(p => !validPlaceholders.includes(p));
  
  return {
    valid: invalidPlaceholders.length === 0,
    invalid: invalidPlaceholders
  };
} 