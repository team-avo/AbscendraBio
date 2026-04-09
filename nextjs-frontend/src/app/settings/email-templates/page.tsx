"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProtectedRoute } from "@/contexts/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RichTextEditor } from "@/components/settings/rich-text-editor";
import { TemplateSelector } from "@/components/settings/template-selector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Eye, Save, Plus, Edit, ArrowLeft, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { ImageUpload } from '@/components/settings/image-upload';
import { sanitizeHtml } from "@/lib/sanitize";
import logger from '@/lib/logger';

interface EmailTemplate {
  id?: string;
  name: string;
  type: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  backgroundImages?: string[];
  isActive: boolean;
  contentType?: 'HTML_CONTENT' | 'TEXT_CONTENT';
}

const TEMPLATE_TYPES = [
  { value: "ORDER_CONFIRMATION", label: "Order Confirmation" },
  { value: "SHIPPING_NOTIFICATION", label: "Shipping Notification" },
  { value: "WELCOME_EMAIL", label: "Welcome Email" },
  { value: "LOW_INVENTORY_ALERT", label: "Low Inventory Alert" },
  { value: "ORDER_CANCELLED", label: "Order Cancelled" },
  { value: "PAYMENT_SUCCESS", label: "Payment Success" },
  { value: "PAYMENT_FAILED", label: "Payment Failed" },
  { value: "PASSWORD_RESET", label: "Password Reset" },
  { value: "BULK_QUOTE", label: "Bulk Quote Request" },
  { value: "BLACK_FRIDAY", label: "Black Friday Promotion" },
  { value: "MARKETING_GENERIC", label: "Marketing Blast" },
  { value: "PARTNER_STATEMENT_GENERATED", label: "Partner Statement Generated" },
  { value: "PARTNER_PAYMENT_REMINDER", label: "Partner Payment Reminder" },
  { value: "PARTNER_OVERDUE_ALERT", label: "Partner Overdue Alert" },
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
            
            <a href="{{trackingUrl}}" class="button">Track Package</a>
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
    .alert { background: #fff3cd; border: 1px solid #ffeeba; padding: 20px; border-radius: 8px; margin: 20px 0; }
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
      <h2>Attention Required</h2>
      <p>Inventory levels are low for the following product:</p>
      <div class="alert">
        <p><strong>Product:</strong> {{productName}}</p>
        <p><strong>Current Stock:</strong> {{currentStock}}</p>
        <p><strong>Reorder Point:</strong> {{reorderPoint}}</p>
      </div>
      <p>Please review and reorder stock to avoid interruption in availability.</p>
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
  PAYMENT_FAILED: {
    name: "Payment Failed",
    subject: "Payment Failed - Order {{orderNumber}}",
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Failed</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; }
    .notice { background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .button { display: inline-block; background: #6c757d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{storeName}}</h1>
      <p>Payment Failed</p>
    </div>
    <div class="content">
      <h2>We couldn't process your payment</h2>
      <p>There was an issue processing payment for order <strong>{{orderNumber}}</strong>.</p>
      <div class="notice">
        <p>Please try another payment method or contact support for assistance.</p>
      </div>
      <a href="{{loginLink}}" class="button">Retry Payment</a>
    </div>
    <div class="footer">
      <p>If you have any questions, please contact us at {{storeEmail}} or call {{storePhone}}</p>
      <p>{{storeAddress}}</p>
    </div>
  </div>
</body>
</html>`
  },
  ORDER_CANCELLED: {
    name: "Order Cancelled",
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
  },
  PASSWORD_RESET: {
    name: "Password Reset",
    subject: "Reset your password",
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: linear-gradient(135deg, #007bff 0%, #17a2b8 100%); color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; }
    .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{storeName}}</h1>
      <p>Password Reset</p>
    </div>
    <div class="content">
      <h2>Hello {{customerName}},</h2>
      <p>We received a request to reset your password. Click the button below to continue.</p>
      <a href="{{resetPasswordLink}}" class="button">Reset Password</a>
      <p>If you did not request a password reset, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      <p>If you have any questions, please contact us at {{storeEmail}} or call {{storePhone}}</p>
      <p>{{storeAddress}}</p>
    </div>
  </div>
</body>
</html>`
  },
  ACCOUNT_VERIFICATION: {
    name: "Account Verification",
    subject: "Verify your account",
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Account</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: linear-gradient(135deg, #20c997 0%, #17a2b8 100%); color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; }
    .button { display: inline-block; background: #20c997; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{storeName}}</h1>
      <p>Verify Your Account</p>
    </div>
    <div class="content">
      <h2>Welcome, {{customerName}}!</h2>
      <p>Please verify your email address by clicking the button below.</p>
      <a href="{{verificationLink}}" class="button">Verify Email</a>
      <p>If you didn’t create an account, you can ignore this email.</p>
    </div>
    <div class="footer">
      <p>If you have any questions, please contact us at {{storeEmail}} or call {{storePhone}}</p>
      <p>{{storeAddress}}</p>
    </div>
  </div>
</body>
</html>`
  },
  PAYMENT_SUCCESS: {
    name: "Payment Success",
    subject: "Payment Received - Order {{orderNumber}}",
    htmlContent: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Received</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
        .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .payment-details { background: #eafaf1; border: 1px solid #c3e6cb; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{storeName}}</h1>
            <p>Payment Received</p>
        </div>
        
        <div class="content">
            <h2>Thank you, {{customerName}}!</h2>
            <p>We have received your payment for order <strong>{{orderNumber}}</strong>.</p>
            
            <div class="payment-details">
                <p><strong>Amount Paid:</strong> {{amountPaid}}</p>
                <p><strong>Payment Method:</strong> {{paymentMethod}}</p>
                <p><strong>Order Total:</strong> {{orderTotal}}</p>
            </div>
            
            <p>Your order is now being processed. We will notify you when it ships.</p>
        </div>
        
        <div class="footer">
            <p>If you have any questions, please contact us at {{storeEmail}} or call {{storePhone}}</p>
            <p>{{storeAddress}}</p>
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
  },
  BULK_QUOTE: {
    name: "Bulk Quote Request Confirmation",
    subject: "Your Bulk Quote Request Has Been Received - {{storeName}}",
    htmlContent: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bulk Quote Request Confirmation</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; }
        .header { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .product-info { background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626; }
        .footer { background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        .button { display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
        .highlight { color: #dc2626; font-weight: bold; }
        .contact-info { background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{storeName}}</h1>
            <p>Bulk Quote Request Received</p>
        </div>
        <div class="content">
            <h2>Dear {{customerName}},</h2>
            
            <p>Thank you for your interest in our products! We have received your bulk quote request and our sales team will review it shortly.</p>
            
            <div class="product-info">
                <h3>Request Details:</h3>
                <p><strong>Product:</strong> <span class="highlight">{{productName}}</span></p>
                <p><strong>Quantity:</strong> <span class="highlight">{{quantity}} pieces</span></p>
                <p><strong>Request Date:</strong> {{requestDate}}</p>
                {{#if notes}}
                <p><strong>Additional Notes:</strong> {{notes}}</p>
                {{/if}}
            </div>
            
            <p>Our sales representative will contact you within <strong>24-48 hours</strong> to discuss pricing and availability for your bulk order.</p>
            
            <div class="contact-info">
                <p><strong>Need immediate assistance?</strong></p>
                <p>Email: {{storeEmail}}<br>
                Phone: {{storePhone}}</p>
            </div>
            
            <p>Thank you for choosing <strong>{{storeName}}</strong>!</p>
            
            <p>Best regards,<br>
            The {{storeName}} Sales Team</p>
        </div>
        <div class="footer">
            <p><strong>{{storeName}}</strong><br>
            {{storeAddress}}</p>
            <p>This email was sent regarding your bulk quote request.</p>
        </div>
    </div>
</body>
</html>`,
    textContent: `BULK QUOTE REQUEST CONFIRMATION

Dear {{customerName}},

Thank you for your interest in our products! We have received your bulk quote request and our sales team will review it shortly.

REQUEST DETAILS:
Product: {{productName}}
Quantity: {{quantity}} pieces
Request Date: {{requestDate}}
{{#if notes}}
Additional Notes: {{notes}}
{{/if}}

Our sales representative will contact you within 24-48 hours to discuss pricing and availability for your bulk order.

If you have any immediate questions, please don't hesitate to contact us:
Email: {{storeEmail}}
Phone: {{storePhone}}

Thank you for choosing {{storeName}}!

Best regards,
The {{storeName}} Sales Team

{{storeName}}
{{storeAddress}}

This email was sent regarding your bulk quote request.`
  },
  BLACK_FRIDAY: {
    name: "Black Friday Promotion",
    subject: "🎉 Black Friday Sale - Up to 15% OFF at {{storeName}}!",
    htmlContent: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Black Friday Sale</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #d32f2f 0%, #c62828 100%); color: white; padding: 40px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 36px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
        .header p { margin: 10px 0 0 0; font-size: 18px; }
        .content { padding: 40px 30px; }
        .banner { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 30px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .banner h2 { margin: 0 0 10px 0; font-size: 28px; }
        .banner p { margin: 0; font-size: 16px; }
        .offer-box { background: #fff3cd; border: 3px solid #ffc107; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .offer-box h3 { margin: 0 0 10px 0; color: #d32f2f; font-size: 24px; }
        .offer-box p { margin: 0; font-size: 14px; color: #666; }
        .date-box { background: #f0f0f0; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; border-left: 4px solid #d32f2f; }
        .date-box p { margin: 5px 0; font-size: 14px; color: #333; }
        .date-box strong { color: #d32f2f; font-size: 16px; }
        .countdown { background: #f0f0f0; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .countdown h4 { margin: 0 0 10px 0; color: #d32f2f; }
        .countdown p { margin: 0; font-size: 14px; color: #666; }
        .button { display: inline-block; background: #d32f2f; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; font-size: 16px; }
        .button:hover { background: #c62828; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #eee; }
        .footer p { margin: 5px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 BLACK FRIDAY SALE 🎉</h1>
            <p>Limited Time Offer - Don't Miss Out!</p>
        </div>
        
        <div class="content">
            <h2>Hello {{customerName}}!</h2>
            <p>We're thrilled to announce our biggest sale of the year!</p>
            
            <div class="banner">
                <h2>UP TO 15% OFF</h2>
            </div>
            
            <div class="offer-box">
                <h3>Exclusive Offer</h3>
                <p>Use code <strong>{{discountCode}}</strong> at checkout for additional savings!</p>
            </div>
            
            <div class="date-box">
                <p><strong>Sale Period:</strong></p>
                <p>Starts: {{saleStartDate}}</p>
                <p>Ends: {{saleEndDate}}</p>
            </div>
            
            <div class="countdown">
                <h4>⏰ Limited Time Only!</h4>
                <p>This offer is valid for a limited time. Shop now before stock runs out!</p>
            </div>
            
            <p style="text-align: center;">
                <a href="{{shopLink}}" class="button">Shop Black Friday Deals</a>
            </p>
        </div>
        
        <div class="footer">
            <p><strong>Questions?</strong> Contact us at {{storeEmail}} or {{storePhone}}</p>
            <p>{{storeAddress}}</p>
            <p style="margin-top: 15px; font-size: 11px;">This is a promotional email from {{storeName}}. If you no longer wish to receive these emails, you can unsubscribe.</p>
        </div>
    </div>
</body>
</html>`
  }
};

// Function to wrap email content with header and footer
const wrapEmailWithHeaderFooter = (content: string, contentType: 'HTML_CONTENT' | 'TEXT_CONTENT') => {
  if (contentType === 'HTML_CONTENT') {
    // For HTML content, wrap with full email structure
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          /* Reset and base styles */
          * { box-sizing: border-box; }
          body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f4f4f4;
          }
          
          /* Container styles */
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: #ffffff; 
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
          }
          
          /* Header styles */
          .email-header { 
            text-align: center; 
            padding: 20px 0; 
            background-color: #ffffff; 
            display: flex; 
            justify-content: center; 
            align-items: center;
          }
          
          .email-header img {
            max-width: 80px; 
            width: 100%; 
            height: auto; 
            display: block;
          }
          
          /* Responsive logo sizing */
          @media screen and (max-width: 480px) {
            .email-header img {
              max-width: 60px;
            }
          }
          
          @media screen and (min-width: 768px) {
            .email-header img {
              max-width: 100px;
            }
          }
          
          /* Content styles */
          .content { 
            padding: 30px; 
            word-wrap: break-word;
            overflow-wrap: break-word;
          }
          
          /* Footer styles */
          .email-footer { 
            background-color: #f8f9fa; 
            padding: 20px; 
            text-align: center; 
            font-size: 14px; 
            color: #666; 
            margin-top: 30px;
          }
          
          /* Responsive typography */
          h1 { font-size: 24px; margin: 0 0 16px 0; }
          h2 { font-size: 20px; margin: 0 0 14px 0; }
          h3 { font-size: 18px; margin: 0 0 12px 0; }
          p { margin: 0 0 16px 0; }
          
          /* Button styles */
          .button, a[style*="display: inline-block"] {
            display: inline-block !important;
            padding: 12px 24px !important;
            background-color: #667eea !important;
            color: #ffffff !important;
            text-decoration: none !important;
            border-radius: 6px !important;
            font-weight: 500 !important;
            text-align: center !important;
            margin: 10px 0 !important;
            font-family: Arial, sans-serif !important;
            font-size: 14px !important;
          }
          
          /* Table styles */
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin: 16px 0 !important;
          }
          
          table td, table th {
            padding: 8px !important;
            border: 1px solid #ddd !important;
            text-align: left !important;
          }
          
          table th {
            background-color: #f8f9fa !important;
            font-weight: bold !important;
          }
          
          /* Image styles */
          img {
            max-width: 100% !important;
            height: auto !important;
            display: block !important;
          }
          
          /* Mobile responsive styles */
          @media only screen and (max-width: 600px) {
            .container {
              width: 100% !important;
              margin: 0 !important;
            }
            
            .content {
              padding: 20px !important;
            }
            
            .email-header {
              padding: 15px 0 !important;
            }
            
            .email-header img {
              max-width: 150px !important;
            }
            
            .email-footer {
              padding: 15px !important;
              font-size: 12px !important;
            }
            
            h1 { font-size: 20px !important; }
            h2 { font-size: 18px !important; }
            h3 { font-size: 16px !important; }
            
            .button, a[style*="display: inline-block"] {
              padding: 10px 20px !important;
              font-size: 13px !important;
              width: 100% !important;
              box-sizing: border-box !important;
            }
          }
          
          /* Dark mode support for email clients that support it */
          @media (prefers-color-scheme: dark) {
            body {
              background-color: #1a1a1a;
              color: #ffffff;
            }
            
            .container {
              background: #2d2d2d;
            }
            
            .email-footer {
              background-color: #3d3d3d;
              color: #cccccc;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="email-header">
            <img src="/logo.png" alt="Ascendra Bio" style="max-width: 80px; width: 100%; height: auto; display: block;">
          </div>
          <div class="content">
            ${content}
          </div>
          <div class="email-footer">
            <p>If you have any queries, please contact us at {{storeEmail}} or call {{storePhone}}</p>
            <p>{{storeAddress}}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  } else {
    // For TEXT_CONTENT, just wrap the content with header and footer
    return `
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
        <div style="text-align: center; padding: 20px 0; background-color: #ffffff; display: flex; justify-content: center; align-items: center;">
          <img src="/logo.png" alt="Ascendra Bio" style="max-width: 80px; width: 100%; height: auto; display: block;">
        </div>
        <div style="padding: 30px; word-wrap: break-word; overflow-wrap: break-word;">
          ${content}
        </div>
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; margin-top: 30px;">
          <p>If you have any queries, please contact us at {{storeEmail}} or call {{storePhone}}</p>
          <p>{{storeAddress}}</p>
        </div>
      </div>
    `;
  }
}

export default function EmailTemplatesPage() {
  const router = useRouter();
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("editor");
  const [previewData, setPreviewData] = useState<any>(null);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [useRichEditor, setUseRichEditor] = useState(true);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [contentType, setContentType] = useState<'HTML_CONTENT' | 'TEXT_CONTENT'>('HTML_CONTENT');
  const [formData, setFormData] = useState<EmailTemplate>({
    name: "",
    type: "ORDER_CONFIRMATION",
    subject: "",
    htmlContent: "",
    textContent: "",
    backgroundImages: [],
    isActive: true
  });
  const [showPreview, setShowPreview] = useState(false);

  // Fetch email templates
  const fetchEmailTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const res = await api.get("/email-templates");
      if (res.success) {
        setEmailTemplates(res.data || []);
      } else {
        toast.error("Failed to load email templates");
      }
    } catch (e) {
      logger.error("Error loading email templates:", { error: e });
      setEmailTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  };

  useEffect(() => {
    fetchEmailTemplates();
  }, []);

  // Add contentType to formData when editing
  useEffect(() => {
    if (editingTemplate) {
      setContentType((editingTemplate as any).contentType || 'HTML_CONTENT');
      setFormData(prev => ({
        ...prev,
        textContent: editingTemplate.textContent || '',
        htmlContent: editingTemplate.htmlContent || ''
      }));
    }
  }, [editingTemplate]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Always send both htmlContent and textContent as entered by the user
      const submitData = {
        ...formData,
        contentType,
        htmlContent: contentType === 'HTML_CONTENT' ? formData.htmlContent : '',
        textContent: contentType === 'TEXT_CONTENT' ? formData.textContent : '',
        backgroundImages: formData.backgroundImages || []
      };

      logger.info('Submitting template data:', { data: {
        name: submitData.name,
        type: submitData.type,
        subject: submitData.subject,
        contentType: submitData.contentType,
        htmlContentLength: submitData.htmlContent?.length,
        textContentLength: submitData.textContent?.length,
        backgroundImagesCount: submitData.backgroundImages?.length
      } });

      let response;
      if (editingTemplate?.id) {
        response = await api.put(`/email-templates/${editingTemplate.id}`, submitData);
      } else {
        response = await api.post("/email-templates", submitData);
      }

      if (response.success) {
        toast.success(response.message || "Email template saved successfully");
        fetchEmailTemplates();
        setEditingTemplate(null);
        resetForm();
      } else {
        // Show detailed validation errors if available
        if (response.error === 'Validation failed' && (response as any).details) {
          const errorMessages = (response as any).details.map((detail: any) => `${detail.field}: ${detail.message}`).join(', ');
          toast.error(`Validation failed: ${errorMessages}`);
        } else {
          toast.error(response.error || "Failed to save template");
        }
      }
    } catch (error: any) {
      logger.error("Error saving template:", { error: error });
      // Show detailed error information
      if (error.response?.data?.error === 'Validation failed' && error.response?.data?.details) {
        const errorMessages = error.response.data.details.map((detail: any) => `${detail.field}: ${detail.message}`).join(', ');
        toast.error(`Validation failed: ${errorMessages}`);
      } else {
        toast.error(error.response?.data?.error || "Failed to save template");
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle preview
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

  // Handle type change
  const handleTypeChange = (type: string) => {
    const defaultTemplate = DEFAULT_TEMPLATES[type as keyof typeof DEFAULT_TEMPLATES];
    if (defaultTemplate && !editingTemplate) {
      setFormData({
        name: defaultTemplate.name,
        type,
        subject: defaultTemplate.subject,
        htmlContent: defaultTemplate.htmlContent,
        textContent: defaultTemplate.htmlContent,
        backgroundImages: [],
        isActive: true
      });
    } else {
      setFormData(prev => ({ ...prev, type }));
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      type: "ORDER_CONFIRMATION",
      subject: "",
      htmlContent: "",
      textContent: "",
      backgroundImages: [],
      isActive: true
    });
    setEditingTemplate(null);
    setActiveTab("editor");
    setPreviewData(null);
  };

  // Handle template selection
  const handleTemplateSelect = (template: any) => {
    setFormData({
      name: template.name,
      type: template.id.toUpperCase().replace('-', '_'),
      subject: template.subject,
      htmlContent: template.htmlContent,
      textContent: template.htmlContent, // Use htmlContent as textContent for rich editor
      backgroundImages: [],
      isActive: true
    });
    setShowTemplateSelector(false);
    setActiveTab("editor");
  };

  // Edit template
  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template);
    // If template has textContent but no htmlContent, use textContent for rich editor
    const formDataToSet = {
      ...template,
      htmlContent: template.textContent || template.htmlContent || ""
    };
    setFormData(formDataToSet);
    setActiveTab("editor");
  };

  // Delete template
  const handleDeleteTemplate = async (template: EmailTemplate) => {
    if (!template.id) return;

    if (confirm("Are you sure you want to delete this template?")) {
      try {
        const response = await api.delete(`/email-templates/${template.id}`);
        if (response.success) {
          toast.success("Template deleted successfully");
          fetchEmailTemplates();
        } else {
          toast.error(response.error || "Failed to delete template");
        }
      } catch (error: any) {
        logger.error("Error deleting template:", { error: error });
        if (error.response?.data?.error === 'Validation failed' && error.response?.data?.details) {
          const errorMessages = error.response.data.details.map((detail: any) => `${detail.field}: ${detail.message}`).join(', ');
          toast.error(`Validation failed: ${errorMessages}`);
        } else {
          toast.error(error.response?.data?.error || "Failed to delete template");
        }
      }
    }
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-2 sm:px-0">
            <div className="flex items-center gap-3 sm:gap-4">
              <Button variant="outline" size="sm" onClick={() => router.back()} className="h-8 w-8 sm:h-9 sm:w-9 p-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">Email Templates</h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Manage your email templates for customer communications
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setShowTemplateSelector(true)} className="h-10 sm:h-11 shadow-sm w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Choose Template
              </Button>
              <Button onClick={resetForm} className="h-10 sm:h-11 shadow-sm w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Create New Template
              </Button>
            </div>
          </div>

          <div className="lg:col-span-2">
            <Card className="shadow-sm border-muted-foreground/10">
              <CardHeader className="p-4 sm:p-5 pb-2 sm:pb-3 border-b">
                <CardTitle className="text-lg sm:text-xl">
                  {editingTemplate ? "Edit Email Template" : "Create Email Template"}
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  {editingTemplate ? "Modify the selected template" : "Create a new email template"}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-5">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="editor" className="text-xs sm:text-sm">Editor</TabsTrigger>
                      <TabsTrigger value="preview" className="text-xs sm:text-sm">Preview</TabsTrigger>
                      <TabsTrigger value="settings" className="text-xs sm:text-sm">Settings</TabsTrigger>
                    </TabsList>

                    <TabsContent value="editor" className="space-y-3 pt-3 sm:pt-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="template-type" className="text-xs sm:text-sm font-medium">Template Type</Label>
                          <Select value={formData.type} onValueChange={handleTypeChange}>
                            <SelectTrigger className="h-9 sm:h-10">
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
                          <Label htmlFor="template-name" className="text-xs sm:text-sm font-medium">Template Name</Label>
                          <Input
                            id="template-name"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Enter template name"
                            className="h-9 sm:h-10"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email-subject" className="text-xs sm:text-sm font-medium">Email Subject</Label>
                        <Input
                          id="email-subject"
                          value={formData.subject}
                          onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                          placeholder="Enter email subject"
                          className="h-9 sm:h-10"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="content-type" className="text-xs sm:text-sm font-medium">Content Type</Label>
                        <Select value={contentType} onValueChange={v => setContentType(v as 'HTML_CONTENT' | 'TEXT_CONTENT')}>
                          <SelectTrigger className="h-9 sm:h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="HTML_CONTENT">HTML Content</SelectItem>
                            <SelectItem value="TEXT_CONTENT">Rich Text Content</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email-content">Email Content</Label>
                        {contentType === 'HTML_CONTENT' ? (
                          <>
                            <Textarea
                              id="html-content"
                              value={formData.htmlContent || ''}
                              onChange={e => setFormData(prev => ({ ...prev, htmlContent: e.target.value }))}
                              placeholder="Enter HTML content Here..."
                              rows={15}
                              className="font-mono text-sm"
                            />
                            <div className="flex justify-end mt-2">
                              <Button type="button" variant="outline" onClick={() => setShowPreview(true)}>
                                Preview
                              </Button>
                            </div>
                            <Dialog open={showPreview} onOpenChange={setShowPreview}>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Email HTML Preview</DialogTitle>
                                  <DialogClose asChild>
                                    <Button variant="ghost" className="absolute right-2 top-2">Close</Button>
                                  </DialogClose>
                                </DialogHeader>
                                <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900 dark:text-gray-100 max-h-[70vh] overflow-y-auto">
                                  <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(formData.htmlContent || '') }} />
                                </div>
                              </DialogContent>
                            </Dialog>
                          </>
                        ) : (
                          <RichTextEditor
                            content={formData.textContent || ''}
                            onChange={content => setFormData(prev => ({ ...prev, textContent: content }))}
                            placeholder="Start writing your email content here..."
                            uploadedImages={formData.backgroundImages || []}
                          />
                        )}
                      </div>

                      <div className="flex justify-between">
                        {/* Remove the Preview Template button here */}
                      </div>
                    </TabsContent>

                    <TabsContent value="preview" className="space-y-3 pt-3 sm:pt-4">
                      <div className="space-y-2">
                        <Label className="text-xs sm:text-sm font-medium">Subject:</Label>
                        <p className="text-sm text-muted-foreground bg-muted/30 p-2 rounded">{formData.subject}</p>
                      </div>
                      <Separator className="my-4" />
                      <div className="space-y-2">
                        <Label className="text-xs sm:text-sm font-medium">Preview:</Label>
                        {contentType === 'HTML_CONTENT' ? (
                          <div className="border rounded-lg p-0 max-h-[500px] overflow-y-auto bg-white">
                            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(wrapEmailWithHeaderFooter(formData.htmlContent || '', 'HTML_CONTENT')) }} />
                          </div>
                        ) : (
                          <div className="border rounded-lg p-4 bg-white dark:bg-gray-800 max-h-[500px] overflow-y-auto">
                            <div className="prose dark:prose-invert max-w-none text-sm sm:text-base" dangerouslySetInnerHTML={{ __html: sanitizeHtml(wrapEmailWithHeaderFooter(formData.textContent || '', 'TEXT_CONTENT')) }} />
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="settings" className="space-y-4">
                      {/* Image Upload */}
                      <ImageUpload
                        onImagesUploaded={(imageUrls) => setFormData(prev => ({ ...prev, backgroundImages: imageUrls }))}
                        existingImages={formData.backgroundImages || []}
                        maxImages={10}
                      />

                      <Separator />

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

                  <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={resetForm} className="h-10 sm:h-11 shadow-sm w-full sm:w-auto mt-2 sm:mt-0">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={loading} className="h-10 sm:h-11 shadow-sm w-full sm:w-auto">
                      {loading ? "Saving..." : editingTemplate ? "Update Template" : "Save Template"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Template Selector Modal */}
        {showTemplateSelector && (
          <TemplateSelector
            onSelectTemplate={handleTemplateSelect}
            onClose={() => setShowTemplateSelector(false)}
          />
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
} 