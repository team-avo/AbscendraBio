import { ApiClient } from "./api-client";
import { getToken } from "./api-client";
import {
  ApiResponse,
  PaginatedData,
  Product,
  ProductVariant,
  Collection,
  ThirdPartyReport,
  Location,
  Promotion,
} from "./api-types";

export const createProductMethods = (client: ApiClient) => ({
  async getProducts(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    category?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    include?: {
      variants?: {
        include?: {
          inventory?: boolean;
        };
      };
    };
  }): Promise<ApiResponse<PaginatedData<Product>>> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.status) queryParams.append("status", params.status);
    if (params?.search) queryParams.append("search", params.search);
    if (params?.category) queryParams.append("category", params.category);
    if (params?.sortBy) queryParams.append("sortBy", params.sortBy);
    if (params?.sortOrder) queryParams.append("sortOrder", params.sortOrder);
    if (params?.include?.variants?.include?.inventory) {
      queryParams.append("include", "variants.inventory");
    }

    const response = await client.get<{
      products: Product[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
      stats?: {
        active: number;
        draft: number;
        inactive: number;
        archived: number;
      };
    }>(`/products?${queryParams}`);

    if (response.success && response.data) {
      const result: any = {
        success: true,
        data: {
          products: response.data.products,
          pagination: response.data.pagination,
        },
      };
      // Attach stats in a backward-compatible way for callers opting to read it via 'as any'
      (result.data as any).stats = (response.data as any).stats;
      return result as ApiResponse<PaginatedData<Product>>;
    }

    return response as ApiResponse<PaginatedData<Product>>;
  },

  async getProduct(id: string): Promise<ApiResponse<Product>> {
    return client.get(`/products/${id}`);
  },

  async exportProducts(): Promise<Blob> {
    const response = await fetch(`${client.baseURL}/products/export/all`, {
      method: "GET",
      credentials: "include",
      headers: {
        ...(client["getHeaders"]() as Record<string, string>),
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Failed to export products");
    }

    return response.blob();
  },

  async updateProductsFromExcel(file: File): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append("file", file);

    return client.postFormData("/products/import/update", formData);
  },

  // Storefront (public) product endpoints
  async getStorefrontProducts(params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    isPopular?: boolean;
  }): Promise<
    ApiResponse<{
      products: Product[];
      pagination: { page: number; limit: number; total: number; pages: number };
    }>
  > {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.search) queryParams.append("search", params.search);
    if (params?.category) queryParams.append("category", params.category);
    if (params?.sortBy) queryParams.append("sortBy", params.sortBy);
    if (params?.sortOrder) queryParams.append("sortOrder", params.sortOrder);
    if (typeof params?.isPopular === "boolean")
      queryParams.append("isPopular", String(params.isPopular));
    const qs = queryParams.toString();
    return client.get(`/storefront/products${qs ? `?${qs}` : ""}`);
  },

  async getStorefrontProduct(id: string): Promise<ApiResponse<Product>> {
    return client.get(`/storefront/products/${id}`);
  },

  // Cart endpoints
  async getCart(): Promise<
    ApiResponse<{
      id: string;
      items: Array<{
        id: string;
        quantity: number;
        unitPrice: number;
        variant: ProductVariant & { product?: Product };
      }>;
    }>
  > {
    return client.get("/cart");
  },

  async getInventoryAvailability(variantId: string): Promise<
    ApiResponse<{
      variantId: string;
      totalAvailable: number;
      availability: Array<{
        locationId: string;
        locationName: string;
        totalQuantity: number;
        reservedQuantity: number;
        availableQuantity: number;
      }>;
      inStock: boolean;
    }>
  > {
    return client.get(`/inventory/availability/${variantId}`);
  },

  async addToCart(
    variantId: string,
    quantity: number = 1,
  ): Promise<ApiResponse<any>> {
    return client.post("/cart/items", { variantId, quantity });
  },

  async updateCartItem(
    itemId: string,
    quantity: number,
  ): Promise<ApiResponse<any>> {
    return client.put(`/cart/items/${itemId}`, { quantity });
  },

  async removeCartItem(itemId: string): Promise<ApiResponse<any>> {
    return client.delete(`/cart/items/${itemId}`);
  },

  async clearCart(): Promise<ApiResponse<any>> {
    return client.delete(`/cart`);
  },

  async validateCartStock(): Promise<
    ApiResponse<{
      removedItems: Array<{
        id: string;
        variantId: string;
        productName: string;
        variantName: string;
        quantity: number;
        reason: string;
      }>;
      cart: any;
    }>
  > {
    return client.post("/cart/validate-stock", {});
  },

  async mergeGuestCart(
    items: Array<{ variantId: string; quantity: number }>,
  ): Promise<ApiResponse<any>> {
    return client.post("/cart/merge", { items });
  },

  // Abandoned carts
  async getAbandonedCarts(
    minutes: number = 30,
    page: number = 1,
    limit: number = 10,
    search: string = "",
  ): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams({
      minutes: minutes.toString(),
      page: page.toString(),
      limit: limit.toString(),
    });
    if (search) queryParams.append("search", search);
    return client.get(`/cart/abandoned?${queryParams.toString()}`);
  },

  async notifyAbandonedCart(
    cartId: string,
    email: string,
  ): Promise<ApiResponse<any>> {
    return client.post("/cart/abandoned/notify", { cartId, email });
  },

  async notifyAllAbandonedCarts(
    minutes: number = 30,
    search: string = "",
  ): Promise<ApiResponse<any>> {
    return client.post("/cart/abandoned/notify-all", { minutes, search });
  },

  async createProduct(productData: {
    name: string;
    description?: string;
    status?: string;
    shipstationSku?: string;
    categories?: string[];
    tags?: string[];
    images?: any[];
    variants: any[];
    seoTitle?: string;
    seoDescription?: string;
    seoSlug?: string;
  }): Promise<ApiResponse<Product>> {
    return client.post("/products", productData);
  },

  async updateProduct(
    id: string,
    productData: {
      name?: string;
      description?: string;
      status?: string;
      shipstationSku?: string | null;
      categories?: string[];
      tags?: string[];
      images?: any[];
      seoTitle?: string;
      seoDescription?: string;
      seoSlug?: string;
    },
  ): Promise<ApiResponse<Product>> {
    return client.put(`/products/${id}`, productData);
  },

  async createVariant(
    productId: string,
    variantData: {
      sku: string;
      shipstationSku?: string;
      name: string;
      description?: string;
      regularPrice: number;
      salePrice?: number | null;
      weight?: number | null;
      hsn?: string;
      seoTitle?: string;
      seoDescription?: string;
      seoSlug?: string;
      isActive?: boolean;
      options?: Array<{ name: string; value: string }>;
      segmentPrices?: Array<{
        customerType: string;
        regularPrice: number;
        salePrice?: number | null;
      }>;
      images?: Array<{ url: string; altText?: string; sortOrder?: number }>;
    },
  ): Promise<ApiResponse<any>> {
    return client.post(`/products/${productId}/variants`, variantData);
  },

  async updateVariant(
    productId: string,
    variantId: string,
    data: Partial<{
      sku: string;
      shipstationSku?: string;
      name: string;
      description: string;
      regularPrice: number;
      salePrice: number | null;
      weight: number | null;
      hsn: string;
      seoTitle: string;
      seoDescription: string;
      seoSlug: string;
      isActive: boolean;
      options: Array<{ name: string; value: string }>;
      segmentPrices: Array<{
        customerType: string;
        regularPrice: number;
        salePrice?: number | null;
      }>;
      images: Array<{ url: string; altText?: string; sortOrder?: number }>;
    }>,
  ): Promise<ApiResponse<any>> {
    return client.put(`/products/${productId}/variants/${variantId}`, data);
  },

  async deleteProduct(id: string): Promise<ApiResponse> {
    return client.delete(`/products/${id}`);
  },

  async archiveProduct(id: string): Promise<ApiResponse> {
    return client.patch(`/products/${id}/archive`);
  },

  // Add: bulk upload products from parsed Excel rows
  async bulkUploadProducts(rows: any[]): Promise<ApiResponse<any>> {
    return client.post(`/products/bulk-upload`, { rows });
  },

  // Category Management
  async getCategories(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<
    ApiResponse<{
      categories: Array<{
        id: string;
        name: string;
        product: {
          name: string;
          status: string;
        };
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>
  > {
    const searchParams = new URLSearchParams();
    if (params) {
      if (params.page) searchParams.append("page", params.page.toString());
      if (params.limit) searchParams.append("limit", params.limit.toString());
      if (params.search) searchParams.append("search", params.search);
    }
    const queryString = searchParams.toString();
    return client.get(`/categories${queryString ? `?${queryString}` : ""}`);
  },

  async createCategory(data: { name: string; productId: string }): Promise<
    ApiResponse<{
      id: string;
      name: string;
      product: {
        name: string;
        status: string;
      };
    }>
  > {
    return client.post("/categories", data);
  },

  // Distinct lists for selectors
  async getDistinctCategories(): Promise<
    ApiResponse<{ categories: string[] }>
  > {
    return client.get(`/categories/distinct`);
  },

  async getDistinctTags(): Promise<ApiResponse<{ tags: string[] }>> {
    return client.get(`/products/tags/distinct`);
  },

  async updateCategory(
    id: string,
    data: {
      name: string;
    },
  ): Promise<
    ApiResponse<{
      id: string;
      name: string;
      product: {
        name: string;
        status: string;
      };
    }>
  > {
    return client.put(`/categories/${id}`, data);
  },

  async deleteCategory(id: string): Promise<ApiResponse<void>> {
    return client.delete(`/categories/${id}`);
  },

  // Collections
  async getCollections(params?: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
  }): Promise<
    ApiResponse<{
      collections: Collection[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>
  > {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.search) queryParams.append("search", params.search);
    if (typeof params?.isActive === "boolean")
      queryParams.append("isActive", params.isActive.toString());

    return client.get<{
      collections: Collection[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>(`/collections?${queryParams.toString()}`);
  },

  async getCollection(id: string): Promise<ApiResponse<Collection>> {
    return client.get<Collection>(`/collections/${id}`);
  },

  async createCollection(collectionData: {
    name: string;
    description?: string;
    isActive?: boolean;
    sortOrder?: number;
    productIds?: string[];
  }): Promise<ApiResponse<Collection>> {
    return client.post<Collection>("/collections", collectionData);
  },

  async updateCollection(
    id: string,
    collectionData: {
      name?: string;
      description?: string;
      isActive?: boolean;
      sortOrder?: number;
    },
  ): Promise<ApiResponse<Collection>> {
    return client.patch<Collection>(`/collections/${id}`, collectionData);
  },

  async deleteCollection(id: string): Promise<ApiResponse> {
    return client.delete(`/collections/${id}`);
  },

  async updateCollectionProducts(
    id: string,
    productIds: string[],
  ): Promise<ApiResponse> {
    return client.put(`/collections/${id}/products`, { productIds });
  },

  async reorderCollectionProducts(
    id: string,
    productOrders: Array<{ productId: string; sortOrder: number }>,
  ): Promise<ApiResponse> {
    return client.patch(`/collections/${id}/products/reorder`, {
      productOrders,
    });
  },

  // Product Variant aliases (same as createVariant/updateVariant but with different name)
  async createProductVariant(
    productId: string,
    variantData: {
      sku: string;
      shipstationSku?: string;
      name: string;
      description?: string;
      regularPrice: number;
      salePrice?: number;
      weight?: number;
      hsn?: string;
      isActive?: boolean;
      options?: { name: string; value: string }[];
      segmentPrices?: {
        customerType: "B2C" | "B2B" | "ENTERPRISE_1" | "ENTERPRISE_2";
        regularPrice: number;
        salePrice?: number;
      }[];
      images?: Array<{ url: string; altText?: string; sortOrder?: number }>;
    },
  ): Promise<ApiResponse<ProductVariant>> {
    return client.post<ProductVariant>(
      `/products/${productId}/variants`,
      variantData,
    );
  },

  async updateProductVariant(
    productId: string,
    variantId: string,
    variantData: {
      sku?: string;
      shipstationSku?: string;
      name?: string;
      description?: string;
      regularPrice?: number;
      salePrice?: number;
      weight?: number;
      hsn?: string;
      isActive?: boolean;
      options?: { name: string; value: string }[];
      segmentPrices?: {
        customerType:
        | "B2C"
        | "B2B"
        | "ENTERPRISE_1"
        | "ENTERPRISE_2"
        | "WHOLESALE";
        regularPrice: number;
        salePrice?: number;
      }[];
      images?: Array<{ url: string; altText?: string; sortOrder?: number }>;
    },
  ): Promise<ApiResponse<ProductVariant>> {
    return client.put<ProductVariant>(
      `/products/${productId}/variants/${variantId}`,
      variantData,
    );
  },

  async deleteProductVariant(
    productId: string,
    variantId: string,
  ): Promise<ApiResponse<void>> {
    return client.delete<void>(`/products/${productId}/variants/${variantId}`);
  },

  // Inventory Location endpoints
  async createLocation(data: { name: string; address?: string }) {
    return client.post("/locations", data);
  },
  async updateLocation(
    id: string,
    data: { name?: string; address?: string; isActive?: boolean },
  ) {
    return client.put(`/locations/${id}`, data);
  },
  async deleteLocation(id: string) {
    return client.delete(`/locations/${id}`);
  },

  // Inventory Management
  async getLocations(): Promise<ApiResponse<Location[]>> {
    return client.get("/locations");
  },

  async getInventory(params?: {
    page?: number;
    limit?: number;
    search?: string;
    locationId?: string;
    lowStock?: boolean;
    outOfStock?: boolean;
  }): Promise<
    ApiResponse<{
      inventory: Array<{
        id: string;
        quantity: number;
        lowStockAlert: number;
        variant: {
          id: string;
          sku: string;
          name: string;
          product: {
            name: string;
            status: string;
          };
        };
        location: {
          id: string;
          name: string;
        };
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>
  > {
    const searchParams = new URLSearchParams();
    if (params) {
      if (params.page) searchParams.append("page", params.page.toString());
      if (params.limit) searchParams.append("limit", params.limit.toString());
      if (params.search) searchParams.append("search", params.search);
      if (params.locationId)
        searchParams.append("locationId", params.locationId);
      if (params.lowStock)
        searchParams.append("lowStock", params.lowStock.toString());
      if (params.outOfStock)
        searchParams.append("outOfStock", params.outOfStock.toString());
    }
    const queryString = searchParams.toString();
    return client.get(`/inventory${queryString ? `?${queryString}` : ""}`);
  },

  async updateInventory(
    id: string,
    data: {
      quantity?: number;
      lowStockAlert?: number;
      reason?: string;
    },
  ): Promise<ApiResponse<any>> {
    return client.put(`/inventory/${id}`, data);
  },

  async createInventoryMovement(data: {
    variantId: string;
    locationId: string;
    quantity: number;
    type:
    | "PURCHASE"
    | "SALE"
    | "RETURN"
    | "ADJUSTMENT_IN"
    | "ADJUSTMENT_OUT"
    | "TRANSFER_IN"
    | "TRANSFER_OUT";
    reason: string;
  }): Promise<ApiResponse<any>> {
    return client.post("/inventory/movement", data);
  },

  // Product Relations Management
  async addProductRelation(
    productId: string,
    relatedProductId: string,
    type: "RELATED" | "UPSELL" | "CROSS_SELL",
  ): Promise<ApiResponse<any>> {
    return client.post(`/products/${productId}/relations`, {
      relatedProductId,
      type,
    });
  },

  async removeProductRelation(
    productId: string,
    relationId: string,
  ): Promise<ApiResponse<any>> {
    return client.delete(`/products/${productId}/relations/${relationId}`);
  },

  async getProductRelations(productId: string): Promise<ApiResponse<any>> {
    return client.get(`/products/${productId}/relations`);
  },

  // Product Reviews Management
  async approveReview(reviewId: string): Promise<ApiResponse<any>> {
    return client.put(`/reviews/${reviewId}/approve`, {});
  },

  async deleteReview(reviewId: string): Promise<ApiResponse<any>> {
    return client.delete(`/reviews/${reviewId}`);
  },

  async getProductReviews(productId: string): Promise<ApiResponse<any>> {
    return client.get(`/products/${productId}/reviews`);
  },

  // Inventory Batch Management
  async getInventoryBatches(inventoryId: string): Promise<ApiResponse<any>> {
    return client.get(`/inventory-batches?inventoryId=${inventoryId}`);
  },

  async createInventoryBatch(data: {
    inventoryId: string;
    batchNumber: string;
    quantity: number;
    expiryDate?: string;
  }): Promise<ApiResponse<any>> {
    return client.post("/inventory-batches", data);
  },

  async updateInventoryBatch(
    id: string,
    data: {
      batchNumber?: string;
      quantity?: number;
      expiryDate?: string;
    },
  ): Promise<ApiResponse<any>> {
    return client.put(`/inventory-batches/${id}`, data);
  },

  async deleteInventoryBatch(id: string): Promise<ApiResponse<any>> {
    return client.delete(`/inventory-batches/${id}`);
  },

  async getExpiringBatches(days: number = 30): Promise<ApiResponse<any>> {
    return client.get(`/inventory-batches/expiring?days=${days}`);
  },

  async getExpiredBatches(): Promise<ApiResponse<any>> {
    return client.get("/inventory-batches/expired");
  },

  async getLowStockItems(): Promise<ApiResponse<any>> {
    return client.get("/inventory/low-stock");
  },

  async getOutOfStockItems(): Promise<ApiResponse<any>> {
    return client.get("/inventory/out-of-stock");
  },

  async getInventoryManagement(params?: {
    search?: string;
    filter?: "all" | "low-stock" | "out-of-stock";
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.append("search", params.search);
    if (params?.filter) searchParams.append("filter", params.filter);
    if (params?.page) searchParams.append("page", params.page.toString());
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    const queryString = searchParams.toString();
    return client.get(
      `/inventory/management${queryString ? `?${queryString}` : ""}`,
    );
  },

  async getVariantInventoryDetails(
    variantId: string,
  ): Promise<ApiResponse<any>> {
    return client.get(`/inventory/variant/${variantId}/details`);
  },

  async updateVariantInventory(
    variantId: string,
    data: {
      onHand?: number;
      committed?: number;
      barcode?: string;
      sellWhenOutOfStock?: boolean;
      reason?: string;
    },
  ): Promise<ApiResponse<any>> {
    return client.put(`/inventory/variant/${variantId}/update`, data);
  },

  async updateLocationInventory(
    variantId: string,
    locationId: string,
    data: {
      onHand?: number;
      committed?: number;
      barcode?: string;
      sellWhenOutOfStock?: boolean;
      reason?: string;
    },
  ): Promise<ApiResponse<any>> {
    return client.put(
      `/inventory/variant/${variantId}/location/${locationId}/update`,
      data,
    );
  },

  async getVariantCommittedOrders(variantId: string): Promise<
    ApiResponse<
      {
        id: string;
        orderNumber: string;
        customerName: string;
        customerEmail: string;
        status: string;
        quantity: number;
        createdAt: string;
      }[]
    >
  > {
    return client.get(`/inventory/variant/${variantId}/committed-orders`);
  },

  // Inventory Sync from ShipStation
  async syncShipStationInventory(): Promise<ApiResponse<any>> {
    return client.post("/inventory/sync/shipstation", {});
  },

  async syncShipStationInventorySku(sku: string): Promise<ApiResponse<any>> {
    return client.post(`/inventory/sync/shipstation/${sku}`, {});
  },

  // Promotion/Coupon management endpoints
  async getPromotions(params?: {
    page?: number;
    limit?: number;
    isActive?: boolean;
  }): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }

    return client.get(`/promotions?${searchParams.toString()}`);
  },

  async getPromotionStats(): Promise<
    ApiResponse<{
      totalCoupons: number;
      activeCoupons: number;
      totalUsage: number;
    }>
  > {
    return client.get("/promotions/stats");
  },

  async getPromotion(id: string): Promise<ApiResponse<Promotion>> {
    return client.get(`/promotions/${id}`);
  },

  async validateCoupon(code: string): Promise<ApiResponse<Promotion>> {
    return client.get(`/promotions/code/${code}`);
  },

  async calculatePromotionDiscount(data: {
    promotionCode: string;
    orderItems: Array<{
      variantId: string;
      quantity: number;
      unitPrice: number;
      variant?: { productId?: string };
    }>;
    customerId?: string;
    subtotal: number;
    shippingAmount: number;
  }): Promise<ApiResponse<{ discount: number; appliedItems?: any[] }>> {
    return client.post("/promotions/calculate-discount", data);
  },

  async createPromotion(data: {
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
    startsAt?: string;
    expiresAt?: string;
    customerTypes?: string[];
    bogoType?: string;
    buyQuantity?: number;
    getQuantity?: number;
    getDiscount?: number;
    productRules?: any[];
    categoryRules?: any[];
    volumeTiers?: any[];
    isForIndividualCustomer?: boolean;
    specificCustomerIds?: string[];
  }): Promise<ApiResponse<Promotion>> {
    return client.post("/promotions", data);
  },

  async updatePromotion(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      type:
      | "PERCENTAGE"
      | "FIXED_AMOUNT"
      | "FREE_SHIPPING"
      | "BOGO"
      | "VOLUME_DISCOUNT";
      value: number;
      minOrderAmount: number;
      maxDiscount: number;
      usageLimit: number;
      isActive: boolean;
      startsAt: string;
      expiresAt: string;
      customerTypes: string[];
      bogoType: string;
      buyQuantity: number;
      getQuantity: number;
      getDiscount: number;
      productRules: any[];
      categoryRules: any[];
      volumeTiers: any[];
      isForIndividualCustomer: boolean;
      specificCustomerIds: string[];
    }>,
  ): Promise<ApiResponse<Promotion>> {
    return client.put(`/promotions/${id}`, data);
  },

  async deletePromotion(id: string): Promise<ApiResponse<void>> {
    return client.delete(`/promotions/${id}`);
  },

  async useCoupon(code: string): Promise<ApiResponse<Promotion>> {
    return client.post(`/promotions/use/${code}`);
  },

  // Tax Rates
  async getTaxRates(params?: {
    country?: string;
    state?: string;
  }): Promise<ApiResponse<any[]>> {
    const searchParams = new URLSearchParams();
    if (params) {
      if (params.country) searchParams.append("country", params.country);
      if (params.state) searchParams.append("state", params.state);
    }

    return client.get(`/tax-rates?${searchParams.toString()}`);
  },

  async getApplicableTaxRate(
    country: string,
    state?: string,
  ): Promise<ApiResponse<any | null>> {
    const searchParams = new URLSearchParams();
    searchParams.append("country", country);
    if (state) searchParams.append("state", state);

    return client.get(`/tax-rates/applicable?${searchParams.toString()}`);
  },

  // Third Party Reports
  async getThirdPartyReports(
    category?: string,
  ): Promise<ApiResponse<ThirdPartyReport[]>> {
    return client.get(
      `/third-party-reports${category ? `?category=${category}` : ""}`,
    );
  },

  async linkReportToItems(
    reportId: string,
    data: { productIds?: string[]; variantIds?: string[] },
  ): Promise<ApiResponse<ThirdPartyReport>> {
    return client.post(`/third-party-reports/${reportId}/links`, data);
  },

  async unlinkReportFromItems(
    reportId: string,
    data: { productIds?: string[]; variantIds?: string[] },
  ): Promise<ApiResponse<ThirdPartyReport>> {
    return client.delete(`/third-party-reports/${reportId}/links`, data);
  },

  /**
   * Public: Get third-party reports linked to a product
   */
  async getPublicReportsForProduct(
    productId: string,
  ): Promise<ApiResponse<any[]>> {
    try {
      const res = await fetch(
        `${client.baseURL}/public-third-party-reports/product/${productId}`,
      );
      return await res.json();
    } catch (error) {
      return { success: false, error: "Failed to fetch reports" };
    }
  },

  /**
   * Public: Get presigned download URL for a third-party report
   */
  async getPublicReportDownloadUrl(
    reportId: string,
    mode: "inline" | "attachment" = "attachment",
  ): Promise<ApiResponse<{ url: string }>> {
    try {
      const res = await fetch(
        `${client.baseURL}/public-third-party-reports/${reportId}/download-url?mode=${mode}`,
      );
      return await res.json();
    } catch (error) {
      return { success: false, error: "Failed to get download URL" };
    }
  },

  async sendProductsEmailReport(params: {
    email: string;
  }): Promise<ApiResponse> {
    return client.post("/products/email-report", params);
  },
});
