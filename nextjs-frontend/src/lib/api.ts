// API barrel file — composes domain-specific modules into a single `api` export
// and re-exports all types & utility functions for backward compatibility.

import { API_BASE_URL } from "./env";
import { ApiClient } from "./api-client";
import { isFrontendAsset } from "./image-assets";
import { createAuthMethods } from "./api-auth";
import { createOrderMethods } from "./api-orders";
import { createProductMethods } from "./api-products";
import { createCustomerMethods } from "./api-customers";
import { createAdminMethods } from "./api-admin";
import { createContentMethods } from "./api-content";
import { createMarketingMethods } from "./api-marketing";
import { createLocationMethods } from "./api-locations";
import { createCommentMethods } from "./api-comments";
import { createStockReceiptMethods } from "./api-stock-receipts";
import { createZellePaymentMethods } from "./api-zelle-payments";
import { createLotManagementMethods } from "./api-lot-management";
import { createWholesalePricingMethods } from "./api-wholesale-pricing";

// ---------------------
// Compose the api object
// ---------------------
const client = new ApiClient(API_BASE_URL);

export const api = Object.assign(client, {
  ...createAuthMethods(client),
  ...createOrderMethods(client),
  ...createProductMethods(client),
  ...createCustomerMethods(client),
  ...createAdminMethods(client),
  ...createContentMethods(client),
  ...createMarketingMethods(client),
  ...createLocationMethods(client),
  ...createCommentMethods(client),
  ...createStockReceiptMethods(client),
  ...createZellePaymentMethods(client),
  ...createLotManagementMethods(client),
  ...createWholesalePricingMethods(client),
});

// ---------------------
// Re-export all types
// ---------------------
export type {
  ApiResponse,
  PaginatedData,
  PaginatedResponse,
  Promotion,
  ThirdPartyReportCategory,
  ThirdPartyReport,
  TaxRate,
  User,
  Permission,
  Customer,
  SalesRepCustomerAssignment,
  SalesRepPerformanceMetrics,
  SalesRepPerformance,
  SalesManager,
  SalesManagerCustomerAssignment,
  SalesRepPerformanceResponse,
  SalesPersonReportResponse,
  Product,
  ProductVariant,
  Collection,
  Category,
  Order,
  OrderItem,
  OrderNote,
  Address,
  Location,
  BulkQuote,
  CreateBulkQuoteRequest,
  TierUpgradeNotification,
  Comment,
  CommentType,
  CommentCountMap,
} from "./api-types";

// ---------------------
// Re-export utility functions
// ---------------------
export { getToken, setToken, removeToken } from "./api-client";
export { ApiClient } from "./api-client";

// ---------------------
// Utility functions (kept here for backward compatibility)
// ---------------------
export const resolveImageUrl = (url?: string | null): string => {
  const fallback = "/peptide-vial-bpc157.png";
  if (!url) return fallback;
  if (/^https?:\/\//i.test(url)) return url;

  // If it's a known frontend asset directory, return as is
  if (isFrontendAsset(url)) {
    return url;
  }

  try {
    const base = API_BASE_URL.replace(/\/$/, "").replace(/\/api$/, "");
    const path = url.startsWith("/") ? url : `/${url}`;
    return `${base}${path}`;
  } catch {
    return fallback;
  }
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

export const formatCompactCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
};

export const formatDate = (date: string): string => {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
};

export const getStatusColor = (status: string): string => {
  const statusColors: { [key: string]: string } = {
    PENDING: "bg-yellow-100 text-yellow-800",
    PROCESSING: "bg-blue-100 text-blue-800",
    SHIPPED: "bg-purple-100 text-purple-800",
    DELIVERED: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
    REFUNDED: "bg-gray-100 text-gray-800",
    ON_HOLD: "bg-orange-100 text-orange-800",
    ACTIVE: "bg-green-100 text-green-800",
    INACTIVE: "bg-gray-100 text-gray-800",
    DRAFT: "bg-gray-100 text-gray-800",
    ARCHIVED: "bg-red-100 text-red-800",
  };
  return statusColors[status] || "bg-gray-100 text-gray-800";
};

// ---------------------
// Custom Location convenience functions (backward compat — delegate to api.xxx)
// ---------------------
export const getCustomCountries = async () => api.getCustomCountries();
export const getCustomStates = async (country: string) => api.getCustomStates(country);
export const getCustomCities = async (country: string, state?: string) => api.getCustomCities(country, state);
export const getCustomLocations = async (params?: Parameters<typeof api.getCustomLocations>[0]) => api.getCustomLocations(params);
export const createCustomLocation = async (data: Parameters<typeof api.createCustomLocation>[0]) => api.createCustomLocation(data);
export const updateCustomLocation = async (id: string, data: Parameters<typeof api.updateCustomLocation>[1]) => api.updateCustomLocation(id, data);
export const deleteCustomLocation = async (id: string) => api.deleteCustomLocation(id);
export const bulkDeleteCustomLocations = async (ids: string[]) => api.bulkDeleteCustomLocations(ids);

// ---------------------
// Public report convenience functions (backward compat)
// ---------------------
export const getPublicReportsForProduct = async (productId: string) => api.getPublicReportsForProduct(productId);
export const getPublicReportDownloadUrl = async (reportId: string, mode: 'inline' | 'attachment' = 'attachment') => api.getPublicReportDownloadUrl(reportId, mode);