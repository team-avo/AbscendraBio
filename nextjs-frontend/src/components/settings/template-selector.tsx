"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Package, UserPlus, AlertTriangle, X, CreditCard, Lock, Shield } from "lucide-react";

interface TemplateOption {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  subject: string;
  htmlContent: string;
}

const TEMPLATE_OPTIONS: TemplateOption[] = [
  {
    id: "order-confirmation",
    name: "Order Confirmation",
    description: "Professional order confirmation email with order details",
    icon: <Package className="h-6 w-6" />,
    category: "Orders",
    subject: "Order Confirmation - {{orderNumber}}",
    htmlContent: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Confirmation</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .order-details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        .product-item { border-bottom: 1px solid #eee; padding: 10px 0; }
        .total { font-weight: bold; font-size: 18px; margin-top: 20px; padding-top: 20px; border-top: 2px solid #eee; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{storeName}}</h1>
            <p>Order Confirmation</p>
        </div>
        
        <div class="content">
            <h2>Thank you for your order, {{customerName}}!</h2>
            <p>We've received your order and are processing it. Here are your order details:</p>
            
            <div class="order-details">
                <h3>Order Information</h3>
                <p><strong>Order Number:</strong> {{orderNumber}}</p>
                <p><strong>Order Date:</strong> {{orderDate}}</p>
                <p><strong>Estimated Delivery:</strong> {{estimatedDelivery}}</p>
                
                <h4>Order Items:</h4>
                <div class="product-item">
                    {{orderItems}}
                </div>
                
                <div class="total">
                    <strong>Total: {{orderTotal}}</strong>
                </div>
            </div>
            
            <p>We'll send you a shipping confirmation with tracking information once your order ships.</p>
            
            <a href="{{orderLink}}" class="button">View Order Details</a>
        </div>
        
        <div class="footer">
            <p>If you have any questions, please contact us at {{storeEmail}} or call {{storePhone}}</p>
            <p>{{storeAddress}}</p>
        </div>
    </div>
</body>
</html>`
  },
  {
    id: "shipping-notification",
    name: "Shipping Notification",
    description: "Notify customers when their order has been shipped",
    icon: <Package className="h-6 w-6" />,
    category: "Orders",
    subject: "Your order has shipped! - {{orderNumber}}",
    htmlContent: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Shipped</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
        .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .shipping-info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .button { display: inline-block; background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        .tracking { background: #e8f5e8; border: 1px solid #28a745; padding: 15px; border-radius: 6px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{storeName}}</h1>
            <p>Your Order Has Shipped!</p>
        </div>
        
        <div class="content">
            <h2>Great news, {{customerName}}!</h2>
            <p>Your order has been shipped and is on its way to you.</p>
            
            <div class="shipping-info">
                <h3>Shipping Information</h3>
                <p><strong>Order Number:</strong> {{orderNumber}}</p>
                <p><strong>Carrier:</strong> {{carrier}}</p>
                <p><strong>Estimated Delivery:</strong> {{estimatedDelivery}}</p>
                
                <div class="tracking">
                    <h4>Tracking Number:</h4>
                    <p style="font-size: 18px; font-weight: bold; color: #28a745;">{{trackingNumber}}</p>
                </div>
            </div>
            
            <p>You can track your package using the tracking number above.</p>
            
            <a href="#" class="button">Track Package</a>
        </div>
        
        <div class="footer">
            <p>If you have any questions, please contact us at {{storeEmail}} or call {{storePhone}}</p>
            <p>{{storeAddress}}</p>
        </div>
    </div>
</body>
</html>`
  },
  {
    id: "welcome-email",
    name: "Welcome Email",
    description: "Welcome new customers to your store",
    icon: <UserPlus className="h-6 w-6" />,
    category: "Marketing",
    subject: "Welcome to {{storeName}}!",
    htmlContent: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to {{storeName}}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
        .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .welcome-box { background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .button { display: inline-block; background: #ff6b6b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        .discount { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 6px; margin: 15px 0; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to {{storeName}}!</h1>
            <p>We're excited to have you on board</p>
        </div>
        
        <div class="content">
            <h2>Hello {{customerName}}!</h2>
            <p>Welcome to {{storeName}}! We're thrilled to have you as part of our community.</p>
            
            <div class="welcome-box">
                <h3>Getting Started</h3>
                <p>Here's what you can do to get started:</p>
                <ul>
                    <li>Browse our premium peptide collection</li>
                    <li>Set up your account preferences</li>
                    <li>Explore our research resources</li>
                </ul>
            </div>
            
            <div class="discount">
                <h3>🎉 Special Welcome Offer!</h3>
                <p>Use code <strong>{{discountCode}}</strong> for {{discountAmount}} off your first order!</p>
            </div>
            
            <p>If you haven't already, please verify your email address to complete your account setup.</p>
            
            <a href="{{verificationLink}}" class="button">Verify Email Address</a>
            <br>
            <a href="#" class="button">Start Shopping</a>
        </div>
        
        <div class="footer">
            <p>If you have any questions, please contact us at {{storeEmail}} or call {{storePhone}}</p>
            <p>{{storeAddress}}</p>
        </div>
    </div>
</body>
</html>`
  },
  {
    id: "low-inventory-alert",
    name: "Low Inventory Alert",
    description: "Alert when inventory is running low",
    icon: <AlertTriangle className="h-6 w-6" />,
    category: "Inventory",
    subject: "Low Inventory Alert - {{productName}}",
    htmlContent: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Low Inventory Alert</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
        .header { background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .alert-box { background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .button { display: inline-block; background: #ffc107; color: #333; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; font-weight: bold; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{storeName}}</h1>
            <p>Low Inventory Alert</p>
        </div>
        
        <div class="content">
            <h2>Inventory Alert</h2>
            <p>This is an automated alert to notify you about low inventory levels.</p>
            
            <div class="alert-box">
                <h3>Product: {{productName}}</h3>
                <p><strong>Current Stock:</strong> {{currentStock}} units</p>
                <p><strong>Reorder Point:</strong> {{reorderPoint}} units</p>
                <p><strong>Supplier:</strong> {{supplierName}}</p>
            </div>
            
            <p>Please consider placing a reorder to maintain adequate inventory levels.</p>
            
            <a href="#" class="button">Manage Inventory</a>
        </div>
        
        <div class="footer">
            <p>This is an automated alert from {{storeName}}</p>
            <p>Contact: {{storeEmail}}</p>
        </div>
    </div>
</body>
</html>`
  },
  {
    id: "order-cancelled",
    name: "Order Cancelled",
    description: "Notify customers when their order has been cancelled",
    icon: <X className="h-6 w-6" />,
    category: "Orders",
    subject: "Order Cancelled - {{orderNumber}}",
    htmlContent: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Cancelled</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
        .header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .cancellation-info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545; }
        .button { display: inline-block; background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        .refund-info { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 6px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{storeName}}</h1>
            <p>Order Cancelled</p>
        </div>
        
        <div class="content">
            <h2>Order Cancellation Notice</h2>
            <p>Dear {{customerName}},</p>
            <p>We regret to inform you that your order has been cancelled.</p>
            
            <div class="cancellation-info">
                <h3>Order Details</h3>
                <p><strong>Order Number:</strong> {{orderNumber}}</p>
                <p><strong>Order Date:</strong> {{orderDate}}</p>
                <p><strong>Cancellation Date:</strong> {{cancellationDate}}</p>
                <p><strong>Order Total:</strong> {{orderTotal}}</p>
                
                <h4>Order Items:</h4>
                <div class="product-item">
                    {{orderItems}}
                </div>
            </div>
            
            <div class="refund-info">
                <h3>Refund Information</h3>
                <p>If payment was processed, a refund will be issued to your original payment method within 5-10 business days.</p>
                <p><strong>Refund Amount:</strong> {{refundAmount}}</p>
            </div>
            
            <p>If you have any questions about this cancellation or would like to place a new order, please don't hesitate to contact us.</p>
            
            <a href="#" class="button">Contact Support</a>
            <a href="#" class="button" style="background: #6c757d;">Place New Order</a>
        </div>
        
        <div class="footer">
            <p>If you have any questions, please contact us at {{storeEmail}} or call {{storePhone}}</p>
            <p>{{storeAddress}}</p>
        </div>
    </div>
</body>
</html>`
  }
];

interface TemplateSelectorProps {
  onSelectTemplate: (template: TemplateOption) => void;
  onClose: () => void;
}

export function TemplateSelector({ onSelectTemplate, onClose }: TemplateSelectorProps) {
  const categories = Array.from(new Set(TEMPLATE_OPTIONS.map(t => t.category)));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-y-auto w-full mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Choose Email Template</h2>
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="space-y-6">
          {categories.map(category => (
            <div key={category}>
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">{category}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {TEMPLATE_OPTIONS.filter(template => template.category === category).map(template => (
                  <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                          {template.icon}
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-lg">{template.name}</CardTitle>
                          <CardDescription className="text-sm">
                            {template.description}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          <strong>Subject:</strong> {template.subject}
                        </p>
                        <div className="flex justify-between items-center">
                          <Badge variant="outline">{template.category}</Badge>
                          <Button 
                            size="sm" 
                            onClick={() => onSelectTemplate(template)}
                          >
                            Use Template
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Choose a template to get started, or create your own from scratch
          </p>
          <Button variant="outline" onClick={onClose}>
            Start from Scratch
          </Button>
        </div>
      </div>
    </div>
  );
} 