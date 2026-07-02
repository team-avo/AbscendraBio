"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Eye, Save, Upload, X, Mail } from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitize";
import logger from '@/lib/logger';

interface EmailTemplate {
  id?: string;
  name: string;
  type: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  backgroundImage?: string;
  isActive: boolean;
}

interface EmailTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  template?: EmailTemplate | null;
}

const TEMPLATE_TYPES = [
  { value: "ORDER_CONFIRMATION", label: "Order Confirmation" },
  { value: "SHIPPING_NOTIFICATION", label: "Shipping Notification" },
  { value: "WELCOME_EMAIL", label: "Welcome Email" },
  { value: "LOW_INVENTORY_ALERT", label: "Low Inventory Alert" },
  { value: "ORDER_CANCELLED", label: "Order Cancelled" },
  { value: "PAYMENT_FAILED", label: "Payment Failed" },
  { value: "PASSWORD_RESET", label: "Password Reset" },
  { value: "ACCOUNT_VERIFICATION", label: "Account Verification" },
  { value: "MARKETING_GENERIC", label: "Marketing Blast" }
];

const DEFAULT_TEMPLATES = {
  ORDER_CONFIRMATION: {
    name: "Order Confirmation",
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
  SHIPPING_NOTIFICATION: {
    name: "Shipping Notification",
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
  WELCOME_EMAIL: {
    name: "Welcome Email",
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
  LOW_INVENTORY_ALERT: {
    name: "Low Inventory Alert",
    subject: "⚠️ Low Stock Alert - Action Required",
    htmlContent: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Low Inventory Alert</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 700px; margin: 0 auto; background: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white; padding: 40px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
        .header p { margin: 10px 0 0 0; font-size: 16px; opacity: 0.9; }
        .alert-badge { display: inline-block; background: rgba(255,255,255,0.3); padding: 8px 16px; border-radius: 20px; font-size: 14px; margin-top: 10px; }
        .content { padding: 40px 30px; }
        .summary { background: #fff3e0; border-left: 4px solid #ff9800; padding: 20px; border-radius: 6px; margin-bottom: 30px; }
        .summary h3 { margin: 0 0 15px 0; color: #e65100; font-size: 18px; }
        .summary-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .stat { text-align: center; }
        .stat-number { font-size: 28px; font-weight: bold; color: #ff9800; }
        .stat-label { font-size: 12px; color: #666; text-transform: uppercase; margin-top: 5px; }
        .inventory-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .inventory-table th { background: #f5f5f5; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd; font-size: 13px; color: #555; }
        .inventory-table td { padding: 12px; border-bottom: 1px solid #eee; }
        .inventory-table tr:hover { background: #fafafa; }
        .product-name { font-weight: 600; color: #333; }
        .sku-badge { background: #e0e0e0; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-family: monospace; }
        .quantity-low { color: #d32f2f; font-weight: 600; }
        .quantity-out { color: #c62828; font-weight: bold; background: #ffebee; padding: 4px 8px; border-radius: 4px; }
        .action-section { background: #f0f4ff; border: 1px solid #e3f2fd; padding: 20px; border-radius: 8px; margin: 30px 0; }
        .action-section h3 { margin: 0 0 15px 0; color: #1565c0; font-size: 16px; }
        .action-list { list-style: none; padding: 0; margin: 0; }
        .action-list li { padding: 8px 0; padding-left: 25px; position: relative; }
        .action-list li:before { content: "✓"; position: absolute; left: 0; color: #4caf50; font-weight: bold; }
        .button { display: inline-block; background: #ff9800; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px 0; }
        .button:hover { background: #f57c00; }
        .footer { background: #f8f9fa; padding: 25px 30px; text-align: center; font-size: 13px; color: #666; border-top: 1px solid #eee; }
        .footer-contact { margin: 15px 0 0 0; }
        .footer-contact p { margin: 5px 0; }
        .divider { height: 1px; background: #eee; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📦 Inventory Alert</h1>
            <p>Stock levels require immediate attention</p>
            <div class="alert-badge">Action Required</div>
        </div>
        
        <div class="content">
            <p>Hello {{storeName}} Team,</p>
            <p>This is an automated notification from your inventory management system. Several products have reached critical stock levels and require your attention.</p>
            
            <div class="summary">
                <h3>📊 Alert Summary</h3>
                <div class="summary-stats">
                    <div class="stat">
                        <div class="stat-number">{{outOfStockCount}}</div>
                        <div class="stat-label">Out of Stock</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number">{{lowStockCount}}</div>
                        <div class="stat-label">Low Stock</div>
                    </div>
                </div>
            </div>

            <h3 style="color: #c62828; margin-top: 30px;">🚨 Out of Stock Products</h3>
            <table class="inventory-table">
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>SKU</th>
                        <th>Location</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {{outOfStockItems}}
                </tbody>
            </table>

            <h3 style="color: #ff9800; margin-top: 30px;">⚠️ Low Stock Products</h3>
            <table class="inventory-table">
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>SKU</th>
                        <th>Available</th>
                        <th>Threshold</th>
                        <th>Location</th>
                    </tr>
                </thead>
                <tbody>
                    {{lowStockItems}}
                </tbody>
            </table>

            <div class="action-section">
                <h3>📋 Recommended Actions</h3>
                <ul class="action-list">
                    <li>Review the inventory levels above</li>
                    <li>Contact your suppliers to place reorders</li>
                    <li>Update product availability status if needed</li>
                    <li>Notify customers of delayed shipments if applicable</li>
                    <li>Log into your admin dashboard to manage inventory</li>
                </ul>
            </div>

            <p style="text-align: center; margin-top: 30px;">
                <a href="{{adminDashboardLink}}" class="button">View Inventory Dashboard</a>
            </p>

            <div class="divider"></div>
            
            <p style="font-size: 13px; color: #999;">
                <strong>Alert Generated:</strong> {{alertDate}} at {{alertTime}}<br>
                <strong>Next Check:</strong> Daily at 1:00 AM
            </p>
        </div>
        
        <div class="footer">
            <p style="margin: 0 0 15px 0; font-weight: 600;">{{storeName}}</p>
            <div class="footer-contact">
                <p>📧 Email: {{storeEmail}}</p>
                <p>📞 Phone: {{storePhone}}</p>
                <p>📍 {{storeAddress}}</p>
            </div>
            <p style="margin-top: 15px; color: #999;">This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`
  },
  MARKETING_GENERIC: {
    name: "Marketing Blast",
    subject: "Update from {{storeName}}",
    htmlContent: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Update from {{storeName}}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
        .header { background: #333; color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .button { display: inline-block; background: #333; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{storeName}}</h1>
        </div>
        <div class="content">
            <h2>Hello {{customerName}},</h2>
            <p>We have some exciting news for you!</p>
            <p>[Insert your marketing message here]</p>
            <a href="#" class="button">Visit Store</a>
        </div>
        <div class="footer">
            <p>If you have any questions, please contact us at {{storeEmail}}</p>
            <p>{{storeAddress}}</p>
        </div>
    </div>
</body>
</html>`
  }
};

export function EmailTemplateDialog({ open, onClose, onSuccess, template }: EmailTemplateDialogProps) {
  logger.info("EmailTemplateDialog rendered with open:", { data: open, template: template });

  const [formData, setFormData] = useState<EmailTemplate>({
    name: "",
    type: "ORDER_CONFIRMATION",
    subject: "",
    htmlContent: "",
    textContent: "",
    backgroundImage: "",
    isActive: true
  });
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("editor");

  useEffect(() => {
    if (template) {
      setFormData(template);
    } else {
      // Set default template based on type
      const defaultTemplate = DEFAULT_TEMPLATES[formData.type as keyof typeof DEFAULT_TEMPLATES];
      if (defaultTemplate) {
        setFormData(prev => ({
          ...prev,
          name: defaultTemplate.name,
          subject: defaultTemplate.subject,
          htmlContent: defaultTemplate.htmlContent
        }));
      }
    }
  }, [template, formData.type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post("/email-templates", formData);
      if (response.success) {
        toast.success(response.message || "Email template saved successfully");
        onSuccess();
        onClose();
      } else {
        toast.error("Failed to save template");
      }
    } catch (error) {
      toast.error("Failed to save template");
      logger.error("Error saving template:", { error: error });
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    try {
      const response = await api.post(`/email-templates/${formData.type}/preview`, {
        sampleData: {
          customerName: "John Doe",
          orderNumber: "ORD-2024-001",
          orderDate: new Date().toLocaleDateString(),
          orderTotal: "$299.99",
          orderItems: "Peptide-001 (2x), Peptide-002 (1x)",
          estimatedDelivery: "3-5 business days",
          trackingNumber: "TRK123456789",
          carrier: "FedEx",
          verificationLink: "https://centreresearch.com/verify?token=abc123",
          discountCode: "WELCOME10",
          discountAmount: "10%"
        }
      });

      if (response.success) {
        setPreviewData(response.data);
        setActiveTab("preview");
      }
    } catch (error) {
      toast.error("Failed to generate preview");
    }
  };

  const handleTypeChange = (type: string) => {
    setFormData(prev => ({ ...prev, type }));
    const defaultTemplate = DEFAULT_TEMPLATES[type as keyof typeof DEFAULT_TEMPLATES];
    if (defaultTemplate && !template) {
      setFormData(prev => ({
        ...prev,
        type,
        name: defaultTemplate.name,
        subject: defaultTemplate.subject,
        htmlContent: defaultTemplate.htmlContent
      }));
    }
  };

  logger.info("EmailTemplateDialog returning JSX with open:", { data: open });

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl overflow-hidden max-w-6xl max-h-[90vh] overflow-y-auto w-full mx-4">
        <div className="bg-[#043061] px-6 py-5 relative overflow-hidden flex-shrink-0">
          <div className="absolute -top-8 -right-8 w-28 h-28 bg-[#5A9ADA]/25 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                <Mail className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Email Template</h2>
                <p className="text-xs text-white/50 mt-0.5">{template ? "Edit existing email template" : "Create a new email template"}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-white hover:bg-white/10">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="p-6">

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="editor">Editor</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="editor" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="template-type">Template Type</Label>
                  <Select value={formData.type} onValueChange={handleTypeChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input
                    id="template-name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter template name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email-subject">Email Subject</Label>
                <Input
                  id="email-subject"
                  value={formData.subject}
                  onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Enter email subject"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="html-content">HTML Content</Label>
                <Textarea
                  id="html-content"
                  value={formData.htmlContent}
                  onChange={(e) => setFormData(prev => ({ ...prev, htmlContent: e.target.value }))}
                  placeholder="Enter HTML content"
                  rows={20}
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="text-content">Plain Text Content (Optional)</Label>
                <Textarea
                  id="text-content"
                  value={formData.textContent || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, textContent: e.target.value }))}
                  placeholder="Enter plain text content for email clients that don't support HTML"
                  rows={5}
                />
              </div>

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={handlePreview}>
                  <Eye className="h-4 w-4 mr-2" />
                  Preview Template
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="space-y-4">
              {previewData ? (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Email Preview</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <Label>Subject:</Label>
                        <p className="text-sm text-muted-foreground">{previewData.subject}</p>
                      </div>
                      <Separator className="my-4" />
                      <div className="space-y-2">
                        <Label>HTML Content:</Label>
                        <div className="border rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto">
                          <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewData.htmlContent) }} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Click "Preview Template" to generate a preview</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="background-image">Background Image URL</Label>
                <Input
                  id="background-image"
                  value={formData.backgroundImage || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, backgroundImage: e.target.value }))}
                  placeholder="Enter background image URL"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is-active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                />
                <Label htmlFor="is-active">Template is active</Label>
              </div>

              <div className="space-y-2">
                <Label>Available Placeholders</Label>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Badge variant="outline">{"{{customerName}}"}</Badge>
                  <Badge variant="outline">{"{{customerEmail}}"}</Badge>
                  <Badge variant="outline">{"{{orderNumber}}"}</Badge>
                  <Badge variant="outline">{"{{orderDate}}"}</Badge>
                  <Badge variant="outline">{"{{orderTotal}}"}</Badge>
                  <Badge variant="outline">{"{{orderItems}}"}</Badge>
                  <Badge variant="outline">{"{{trackingNumber}}"}</Badge>
                  <Badge variant="outline">{"{{carrier}}"}</Badge>
                  <Badge variant="outline">{"{{estimatedDelivery}}"}</Badge>
                  <Badge variant="outline">{"{{storeName}}"}</Badge>
                  <Badge variant="outline">{"{{storeEmail}}"}</Badge>
                  <Badge variant="outline">{"{{storePhone}}"}</Badge>
                  <Badge variant="outline">{"{{storeAddress}}"}</Badge>
                  <Badge variant="outline">{"{{verificationLink}}"}</Badge>
                  <Badge variant="outline">{"{{discountCode}}"}</Badge>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 mt-6">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-[#043061] hover:bg-[#0b4f96] text-white rounded-xl">
              {loading ? "Saving..." : "Save Template"}
            </Button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
} 