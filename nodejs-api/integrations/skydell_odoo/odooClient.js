/**
 * Odoo Vendor API Client (v2)
 *
 * HTTP wrapper for Skydell's Odoo Vendor API endpoints.
 * Supports dynamic configuration from database and variant-aware API format.
 * Includes comprehensive logging for all API calls.
 */

const axios = require("axios");
const prisma = require("../../prisma/client");
const { logOdooSync } = require("./odooLogger");

// Cache for config to avoid DB lookup on every request
let configCache = null;
let configCacheTime = 0;
const CONFIG_CACHE_TTL = 60000; // 1 minute cache

/**
 * Get integration config from database (with caching)
 */
async function getConfig() {
  const now = Date.now();

  // Return cached config if still valid
  if (configCache && now - configCacheTime < CONFIG_CACHE_TTL) {
    return configCache;
  }

  const config = await prisma.odooIntegrationConfig.findFirst();

  if (!config) {
    // Fallback to env vars if no config in DB
    return {
      apiBaseUrl:
        process.env.ODOO_API_BASE_URL || "https://bol9967-odoo18-tk.odoo.com",
      apiToken:
        process.env.ODOO_API_TOKEN ||
        "aO1V5iLQJ285eMPKy1iQv_wuZYOEfSXtxbMjwhTXBoc",
      partnerId: process.env.ODOO_PARTNER_ID || "13",
      isEnabled: false,
      salesChannelId: null,
    };
  }

  configCache = config;
  configCacheTime = now;
  return config;
}

/**
 * Clear config cache (call when config is updated)
 */
function clearConfigCache() {
  configCache = null;
  configCacheTime = 0;
}

/**
 * Check if integration is enabled
 */
async function isIntegrationEnabled() {
  const config = await getConfig();
  return config.isEnabled === true;
}

/**
 * Get linked sales channel ID
 */
async function getLinkedSalesChannelId() {
  const config = await getConfig();
  return config.salesChannelId;
}

/**
 * Make a request to Odoo API with logging
 * @param {string} method - HTTP method
 * @param {string} endpoint - API endpoint
 * @param {Object} data - Request payload
 * @param {Object} logContext - Logging context
 * @param {string} logContext.triggerType - Type of trigger
 * @param {string} [logContext.triggerReason] - Human-readable reason
 * @param {string} [logContext.variantId] - Variant ID
 * @param {string} [logContext.variantSku] - Variant SKU
 * @param {string} [logContext.productId] - Product ID
 * @param {string} [logContext.productName] - Product name
 * @param {string} [logContext.orderId] - Order ID
 * @param {string} [logContext.initiatedBy] - User ID or "system"
 */
async function odooRequest(method, endpoint, data = null, logContext = {}) {
  const config = await getConfig();

  const url = `${config.apiBaseUrl}${endpoint}?partner_id=${config.partnerId}`;
  const headers = {
    Authorization: `Bearer ${config.apiToken}`,
    "Content-Type": "application/json",
  };

  const startTime = Date.now();
  console.log(`[OdooClient] ${method} ${url}`);
  console.log(`[OdooClient] Request:`, JSON.stringify(data, null, 2));

  // Prepare log entry base
  const logEntry = {
    triggerType: logContext.triggerType || "MANUAL_SINGLE",
    triggerReason: logContext.triggerReason || null,
    variantId: logContext.variantId || null,
    variantSku: logContext.variantSku || null,
    productId: logContext.productId || null,
    productName: logContext.productName || null,
    orderId: logContext.orderId || null,
    httpMethod: method,
    endpoint: endpoint,
    requestPayload: data,
    initiatedBy: logContext.initiatedBy || "system",
    salesChannelId: config.salesChannelId || null,
  };

  try {
    const response = await axios({
      method,
      url,
      headers,
      data,
      timeout: 30000, // 30 second timeout
    });

    const duration = Date.now() - startTime;
    console.log(
      `[OdooClient] Response (${duration}ms):`,
      JSON.stringify(response.data, null, 2),
    );

    // Detect application-level errors returned inside HTTP 200 (Odoo JSON-RPC pattern).
    // e.g. { result: { error: "variant_default_code_exists", message: "..." } }
    // Only treat as an error when the field is explicitly a non-empty string — avoids
    // false positives from truthy objects, booleans, or 0 that may appear in result.
    const _resultError = response.data?.result?.error;
    const _topError = response.data?.error;
    const appError =
      (typeof _resultError === "string" && _resultError.length > 0
        ? _resultError
        : null) ||
      (typeof _topError === "string" && _topError.length > 0
        ? _topError
        : null) ||
      null;

    if (appError) {
      let appErrorMessage =
        response.data?.result?.message ||
        (typeof appError === "string" ? appError : JSON.stringify(appError));

      // For variants_incomplete, append expected_combinations to make the error actionable
      if (
        appError === "variants_incomplete" &&
        response.data?.result?.expected_combinations
      ) {
        const combinations = JSON.stringify(
          response.data.result.expected_combinations,
        );
        appErrorMessage += ` — expected_combinations: ${combinations}`;
      }

      console.warn(
        `[OdooClient] Application-level error in HTTP 200 response: ${appError}`,
      );

      await logOdooSync({
        ...logEntry,
        statusCode: response.status,
        responsePayload: response.data,
        status: "FAILED",
        errorMessage: appErrorMessage,
        duration,
      });

      return {
        success: false,
        appError: appError,
        errorMessage: appErrorMessage,
        data: response.data,
        status: response.status,
        duration,
      };
    }

    // Log successful request
    await logOdooSync({
      ...logEntry,
      statusCode: response.status,
      responsePayload: response.data,
      status: "SUCCESS",
      duration,
    });

    return {
      success: true,
      data: response.data,
      status: response.status,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    if (error.response) {
      console.error(`[OdooClient] Error Response (${duration}ms):`, {
        status: error.response.status,
        data: error.response.data,
      });

      // Log failed request with response
      await logOdooSync({
        ...logEntry,
        statusCode: error.response.status,
        responsePayload: error.response.data,
        status: "FAILED",
        errorMessage: error.response.data?.error || error.message,
        duration,
      });

      return {
        success: false,
        error: error.response.data,
        status: error.response.status,
        duration,
      };
    } else if (error.request) {
      console.error(`[OdooClient] No Response (${duration}ms):`, error.message);

      // Log failed request with no response
      await logOdooSync({
        ...logEntry,
        statusCode: 0,
        responsePayload: null,
        status: "FAILED",
        errorMessage: `No response from Odoo server: ${error.message}`,
        duration,
      });

      return {
        success: false,
        error: {
          message: "No response from Odoo server",
          details: error.message,
        },
        status: 0,
        duration,
      };
    } else {
      console.error(`[OdooClient] Request Setup Error:`, error.message);

      // Log request setup error
      await logOdooSync({
        ...logEntry,
        statusCode: 0,
        responsePayload: null,
        status: "FAILED",
        errorMessage: `Failed to setup request: ${error.message}`,
        duration,
      });

      return {
        success: false,
        error: { message: "Failed to setup request", details: error.message },
        status: 0,
        duration,
      };
    }
  }
}

/**
 * Create a new product in Odoo (simple, no variants)
 *
 * @param {Object} productData - Product data
 * @param {string} productData.name - Product name
 * @param {string} productData.default_code - SKU (must be unique)
 * @param {number} productData.vendor_on_hand_qty - Available stock
 * @param {Object} supplierData - Supplier data
 * @param {number} supplierData.price - Supplier price
 * @param {Object} logContext - Logging context
 */
async function createProduct(
  productData,
  supplierData = { price: 0 },
  logContext = {},
) {
  const payload = {
    product: {
      name: productData.name,
      default_code: productData.default_code,
      vendor_on_hand_qty: productData.vendor_on_hand_qty,
    },
    supplier: supplierData,
  };

  return await odooRequest("POST", "/vendor_api/product/create", payload, {
    ...logContext,
    triggerType: logContext.triggerType || "PRODUCT_CREATED",
    variantSku: productData.default_code,
    productName: productData.name,
  });
}

/**
 * Create a product with variants in Odoo (new API format)
 *
 * @param {Object} productData - Base product data
 * @param {string} productData.name - Product name (e.g., "BPC-157")
 * @param {string} productData.default_code - Base product SKU
 * @param {Object} supplierData - Base supplier data
 * @param {Array} variants - Array of variant objects
 * @param {string} variants[].default_code - Variant SKU
 * @param {number} variants[].vendor_on_hand_qty - Variant stock
 * @param {number} variants[].price - Variant price
 * @param {Object} variants[].attributes - Attribute key-value pairs
 * @param {Object} logContext - Logging context
 */
async function createProductWithVariants(
  productData,
  supplierData = { price: 0 },
  variants = [],
  logContext = {},
) {
  const payload = {
    product: {
      name: productData.name,
      default_code: productData.default_code,
      vendor_on_hand_qty: productData.vendor_on_hand_qty || 0,
    },
    supplier: supplierData,
  };

  if (variants && variants.length > 0) {
    payload.variants = variants.map((v) => ({
      default_code: v.default_code,
      vendor_on_hand_qty: v.vendor_on_hand_qty || 0,
      price: v.price || 0,
      attributes: v.attributes || {},
    }));
  }

  return await odooRequest("POST", "/vendor_api/product/create", payload, {
    ...logContext,
    triggerType: logContext.triggerType || "PRODUCT_CREATED",
    variantSku: productData.default_code,
    productName: productData.name,
  });
}

/**
 * Read a product from Odoo by SKU
 *
 * @param {string} sku - Product SKU (default_code)
 * @param {Object} logContext - Logging context (optional, usually not logged for reads)
 */
async function readProduct(sku, logContext = null) {
  const payload = {
    default_code: sku,
  };

  // Only log if context provided (reads are usually internal checks)
  if (logContext) {
    return await odooRequest("POST", "/vendor_api/product/read", payload, {
      ...logContext,
      variantSku: sku,
    });
  }

  // For non-logged reads, still make request but skip logging
  const config = await getConfig();
  const url = `${config.apiBaseUrl}/vendor_api/product/read?partner_id=${config.partnerId}`;

  try {
    const response = await axios({
      method: "POST",
      url,
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        "Content-Type": "application/json",
      },
      data: payload,
      timeout: 30000,
    });
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    if (error.response) {
      return {
        success: false,
        error: error.response.data,
        status: error.response.status,
      };
    }
    return { success: false, error: { message: error.message }, status: 0 };
  }
}

/**
 * Update an existing product in Odoo (simple, no variants)
 *
 * @param {string} sku - Product SKU (default_code)
 * @param {Object} productData - Updated product data (only fields to update)
 * @param {Object} supplierData - Updated supplier data (optional)
 * @param {Object} logContext - Logging context
 */
async function updateProduct(
  sku,
  productData,
  supplierData = {},
  logContext = {},
) {
  const payload = {
    default_code: sku,
    product: productData,
  };

  if (Object.keys(supplierData).length > 0) {
    payload.supplier = supplierData;
  }

  return await odooRequest("POST", "/vendor_api/product/update", payload, {
    ...logContext,
    triggerType: logContext.triggerType || "PRODUCT_UPDATED",
    variantSku: sku,
  });
}

/**
 * Update a product with variants in Odoo (new API format)
 *
 * @param {string} sku - Base product SKU
 * @param {Object} productData - Updated base product data
 * @param {Object} supplierData - Updated supplier data
 * @param {Array} variants - Array of variant updates
 * @param {Object} logContext - Logging context
 */
async function updateProductWithVariants(
  sku,
  productData,
  supplierData = {},
  variants = [],
  logContext = {},
) {
  const payload = {
    default_code: sku,
    product: productData,
  };

  if (Object.keys(supplierData).length > 0) {
    payload.supplier = supplierData;
  }

  if (variants && variants.length > 0) {
    // Don't send attributes on update — only stock & price fields.
    // Attributes are only needed when creating a product in Odoo.
    payload.variants = variants.map((v) => ({
      default_code: v.default_code,
      vendor_on_hand_qty: v.vendor_on_hand_qty,
      price: v.price,
    }));
  }

  return await odooRequest(
    "POST",
    "/vendor_api/product/update",
    { variants: payload.variants },
    {
      ...logContext,
      triggerType: logContext.triggerType || "PRODUCT_UPDATED",
      variantSku: sku,
    },
  );
}

/**
 * Check if product exists in Odoo
 *
 * @param {string} sku - Product SKU
 * @returns {Promise<boolean>} - True if product exists
 */
async function productExists(sku) {
  const result = await readProduct(sku);
  // Product exists if response is successful AND result doesn't contain a non-empty string error
  if (!result.success) return false;
  const errorField = result.data?.result?.error;
  if (typeof errorField === "string" && errorField.length > 0) return false;
  return true;
}

module.exports = {
  // Config helpers
  getConfig,
  clearConfigCache,
  isIntegrationEnabled,
  getLinkedSalesChannelId,

  // Simple product operations
  createProduct,
  readProduct,
  updateProduct,
  productExists,

  // Variant-aware operations (new API)
  createProductWithVariants,
  updateProductWithVariants,
};
