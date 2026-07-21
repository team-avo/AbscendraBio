// Types for API responses
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    totalPages?: number;
    totalItems?: number;
  };
  metrics?: any;
  stats?: any;
}

export interface PaginatedData<T> {
  items?: T[];
  users?: T[];
  customers?: T[];
  products?: T[];
  orders?: T[];
  collections?: T[];
  data?: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface Promotion {
  id: string;
  code: string;
  name: string;
  description?: string;
  type:
  | "PERCENTAGE"
  | "FIXED_AMOUNT"
  | "FREE_SHIPPING"
  | "BOGO"
  | "VOLUME_DISCOUNT";
  value: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  usageLimit?: number;
  usageCount: number;
  isActive: boolean;
  startsAt?: string;
  expiresAt?: string;
  isForIndividualCustomer?: boolean;
  specificCustomers?: Array<{ customerId: string }>;
  createdAt: string;
  updatedAt: string;
}

export type ThirdPartyReportCategory = "PURITY" | "ENDOTOXICITY" | "STERILITY";

export interface ThirdPartyReport {
  id: string;
  category: ThirdPartyReportCategory;
  name: string;
  description?: string | null;
  url?: string | null;
  previewUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  products?: Array<{ id: string; name: string }>;
  variants?: Array<{
    id: string;
    name: string;
    sku: string;
    productName?: string;
  }>;
}

export interface TaxRate {
  id: string;
  country: string;
  state?: string;
  rate: number;
  type: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data?: {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  error?: string;
}

// User types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role:
  | "ADMIN"
  | "MANAGER"
  | "STAFF"
  | "CUSTOMER"
  | "SALES_REP"
  | "SALES_MANAGER";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  permissions?: Permission[];
  customerId?: string;
  customer?: {
    id: string;
    customerType: "B2C" | "B2B" | "ENTERPRISE_1" | "ENTERPRISE_2";
    isApproved: boolean;
    isActive: boolean;
  };
}

export interface Permission {
  id: string;
  module: string;
  action: string;
  granted: boolean;
}

// Customer types
export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  companyName?: string;
  licenseNumber?: string;
  email: string;
  mobile: string;
  city?: string;
  zip?: string;
  customerType: "B2C" | "B2B" | "ENTERPRISE_1" | "ENTERPRISE_2";
  isActive: boolean;
  isApproved: boolean;
  emailVerified: boolean;
  mobileVerified?: boolean;
  approvalStatus?: "PENDING" | "APPROVED" | "DEACTIVATED";
  smsTransactionalConsent?: boolean;
  smsMarketingConsent?: boolean;
  smsConsentAt?: string | null;
  smsConsentSource?: string | null;
  createdAt: string;
  updatedAt: string;
  addresses?: Address[];
  customerTags?: CustomerTag[];
  salesAssignments?: SalesRepCustomerAssignment[];
  salesManagerAssignments?: SalesManagerCustomerAssignment[];
  _count?: {
    orders: number;
    addresses: number;
    reviews: number;
    comments: number;
  };
  comments?: Comment[];
}

export interface SalesRepCustomerAssignment {
  id: string;
  salesRepId: string;
  customerId: string;
  createdAt: string;
  updatedAt: string;
  salesRep?: {
    id: string;
    userId: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  };
}

export interface SalesRepPerformanceMetrics {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  assignedCustomers: number;
  activeCustomers: number;
  conversionRate: number;
}

export interface SalesRepPerformance {
  salesRepId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    isActive: boolean;
  };
  metrics: SalesRepPerformanceMetrics;
  lastOrderDate?: string | null;
  monthlyPerformance: Array<{ month: string; revenue: number; orders: number }>;
  topCustomers: Array<{
    id: string;
    name: string;
    email: string;
    revenue: number;
    orders: number;
    lastOrderDate?: string | null;
  }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    totalAmount: number;
    status: string;
    createdAt: string;
    customerId: string;
    customerName: string;
    selectedPaymentType?: "ZELLE" | "BANK_WIRE" | "AUTHORIZE_NET" | null;
  }>;
}

export interface SalesManager {
  id: string;
  userId: string;
  user: User;
  salesReps?: { id: string; user: User }[];
  assignments?: SalesManagerCustomerAssignment[];
  _count?: {
    assignments: number;
    salesReps: number;
  };
}

export interface SalesManagerCustomerAssignment {
  id: string;
  salesManagerId: string;
  customerId: string;
  assignedAt: string;
  customer?: Customer;
  salesManager?: SalesManager;
}

export interface SalesRepPerformanceResponse {
  range: string;
  rangeDays: number;
  generatedAt: string;
  period?: {
    from: string;
    to: string;
  };
  totals: {
    totalRevenue: number;
    totalOrders: number;
    averageConversion: number;
    repsActive: number;
  };
  reps: SalesRepPerformance[];
}

export interface Address {
  id: string;
  customerId: string;
  type: "BILLING" | "SHIPPING";
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerTag {
  id: string;
  tag: string;
}

// Product types
export interface Product {
  id: string;
  name: string;
  description?: string;
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
  displayOrder?: number;
  isPopular?: boolean;
  shipstationSku?: string | null;
  createdAt: string;
  updatedAt: string;
  seoTitle?: string;
  seoDescription?: string;
  seoSlug?: string;
  variants?: ProductVariant[];
  images?: ProductImage[];
  categories?: ProductCategory[];
  tags?: ProductTag[];
  thirdPartyReports?: ThirdPartyReport[];
  _count?: {
    variants: number;
    reviews: number;
  };
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  description?: string;
  sku: string;
  shipstationSku?: string | null;
  barcode?: string;
  regularPrice: number;
  salePrice?: number;
  costPrice?: number;
  weight?: number;
  hsn?: string;
  isActive: boolean;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  inventory?: {
    id: string;
    locationId: string;
    quantity: number;
    reservedQty: number;
  }[];
  variantOptions?: VariantOption[];
  segmentPrices?: {
    id: string;
    customerType: "B2C" | "B2B" | "ENTERPRISE_1" | "ENTERPRISE_2";
    regularPrice: number;
    salePrice?: number;
  }[];
  seoTitle?: string;
  seoDescription?: string;
  seoSlug?: string;
  thirdPartyReports?: ThirdPartyReport[];
}

export interface VariantOption {
  id: string;
  name: string;
  value: string;
}

export interface ProductImage {
  id: string;
  url: string;
  altText?: string;
  sortOrder: number;
}

export interface ProductCategory {
  id: string;
  name: string;
}

export interface ProductTag {
  id: string;
  tag: string;
}

export interface Inventory {
  id: string;
  quantity: number;
  reservedQty: number;
  locationId: string;
  location?: {
    id: string;
    name: string;
  };
}

export interface Location {
  id: string;
  name: string;
  address?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Order types
export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  userId?: string;
  status:
  | "PENDING"
  | "PROCESSING"
  | "LABEL_CREATED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED"
  | "ON_HOLD";
  subtotal: number;
  discountAmount: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency?: string;
  billingAddressId?: string | null;
  shippingAddressId?: string | null;
  selectedPaymentType?: "ZELLE" | "BANK_WIRE" | "AUTHORIZE_NET" | null;
  shipstationLabel?: any;
  shipmentTrackingNumber?: string;
  shipmentRequestStatus?: string; // ACCEPTED_BY_SHIPPER | ON_THE_WAY | DELIVERED
  estimatedShippingCost?: number;
  salesChannelId?: string | null;
  partnerOrderId?: string | null;
  salesChannel?: {
    id: string;
    companyName: string;
    type: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  customer?: Customer;
  billingAddress?: Address;
  shippingAddress?: Address;
  items?: OrderItem[];
  payments?: Payment[];
  transactions?: Transaction[];
  shipments?: Shipment[];
  notes?: OrderNote[];
  auditLogs?: AuditLog[];
  _count?: {
    items: number;
    notes: number;
    comments: number;
  };
  comments?: Comment[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  variant?: ProductVariant & {
    product?: Product;
  };
}

export interface OrderNote {
  id: string;
  orderId: string;
  userId: string;
  note: string;
  isInternal: boolean;
  createdAt: string;
  user?: User;
}

export interface Payment {
  id: string;
  orderId: string;
  paymentMethod: string;
  provider?: string;
  status: string;
  amount: number;
  currency?: string;
  paidAt?: string;
}

export interface Transaction {
  id: string;
  orderId: string;
  paymentGatewayName: string;
  paymentGatewayTransactionId?: string;
  paymentStatus: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
  order?: Order;
}

export interface Shipment {
  id: string;
  orderId: string;
  carrier: string;
  trackingNumber?: string;
  status: string;
  shippedAt?: string;
}

export interface AuditLog {
  id: string;
  orderId?: string;
  userId: string;
  action: string;
  details: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  user?: User;
}

// Collection types
export interface Collection {
  id: string;
  name: string;
  description?: string;
  slug: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  products?: ProductCollection[];
  _count?: {
    products: number;
  };
}

export interface ProductCollection {
  id: string;
  collectionId: string;
  productId: string;
  sortOrder: number;
  product?: Product;
}

// Bulk Quote types
export interface BulkQuote {
  id: string;
  productId: string;
  customerId: string;
  quantity: number;
  notes?: string;
  isRead: boolean;
  readAt?: string;
  readBy?: string;
  createdAt: string;
  updatedAt: string;
  product?: {
    id: string;
    name: string;
    images?: Array<{ url: string; altText?: string }>;
  };
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    mobile: string;
    customerType: string;
  };
  reader?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface CreateBulkQuoteRequest {
  productId: string;
  customerId: string;
  quantity: number;
  notes?: string;
}

export interface TierUpgradeNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  isRead: boolean;
  metadata?: {
    customerName: string;
    customerEmail: string;
    lifetimeSpending: number;
    threshold: number;
    currentTier: string;
    suggestedTier: string;
    salesRepId: string;
    salesRepName: string;
  };
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    customerType: string;
  };
  order?: {
    id: string;
    orderNumber: string;
    totalAmount: number;
    status: string;
  };
  createdAt: string;
  readAt?: string;
}

// Sales person analytics report shape
export interface SalesPersonReportResponse {
  personName: string;
  totalRevenue: number;
  totalOrders: number;
  firstTimeOrdersCount: number;
  repeatOrdersCount: number;
  dailyBreakdown: Array<{
    date: string;
    revenue: number;
    orders: number;
  }>;
  detailedOrders: Array<{
    orderId: string;
    orderNumber: string;
    date: string;
    customerName: string;
    customerEmail: string;
    revenue: number;
    status: string;
    type: string;
    salesRepName?: string;
  }>;
}

// Alias for backward compatibility with imports that use `Category`
export type Category = ProductCategory;

