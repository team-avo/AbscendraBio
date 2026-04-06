import { ApiClient, getToken } from "./api-client";
import { ApiResponse, Order, PaginatedData, OrderNote } from "./api-types";
import logger from "./logger";

export const createOrderMethods = (client: ApiClient) => ({
  async getOrders(params?: {
    page?: number;
    limit?: number;
    status?: string;
    customerId?: string;
    salesRepId?: string;
    customerType?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    paymentMethod?: string;
    failedPayments?: boolean;
    excludeFailedPayments?: boolean;
    salesChannelId?: string;
    usePSTFilter?: boolean;
  }): Promise<ApiResponse<PaginatedData<Order>>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          if (key === "usePSTFilter") {
            searchParams.append(key, value ? "true" : "false");
          } else {
            searchParams.append(key, value.toString());
          }
        }
      });
    }

    const response = await client.get<{
      orders: Order[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
      stats?: {
        pending: number;
        processing: number;
        shipped: number;
        delivered: number;
        cancelled: number;
        revenue?: number;
      };
    }>(`/orders?${searchParams.toString()}`);

    if (response.success && response.data) {
      const result: any = {
        success: true,
        data: {
          orders: response.data.orders,
          pagination: response.data.pagination,
        },
      };
      (result.data as any).stats = (response.data as any).stats;
      return result as ApiResponse<PaginatedData<Order>>;
    }

    return response as ApiResponse<PaginatedData<Order>>;
  },

  async getOrder(id: string): Promise<ApiResponse<Order>> {
    return client.get(`/orders/${id}`);
  },

  async getSalesChannels(): Promise<ApiResponse<any[]>> {
    return client.get("/sales-channels");
  },

  // Customer self-service orders
  async getCustomerOrders(
    customerId: string,
    params?: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      from?: string;
      to?: string;
    },
  ): Promise<
    ApiResponse<{
      orders: Order[];
      pagination: { page: number; limit: number; total: number; pages: number };
    }>
  > {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          searchParams.append(key, value.toString());
        }
      });
    }
    const qs = searchParams.toString();
    return client.get(`/customers/${customerId}/orders${qs ? `?${qs}` : ""}`);
  },

  async getCustomerOrdersStats(customerId: string): Promise<
    ApiResponse<{
      ALL: number;
      ACTIVE: number;
      DELIVERED: number;
      CANCELLED: number;
    }>
  > {
    return client.get(`/customers/${customerId}/orders-stats`);
  },

  async createOrder(orderData: {
    customerId: string;
    billingAddressId?: string;
    shippingAddressId?: string;
    billingAddress?: {
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
    };
    shippingAddress?: {
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
    };
    items: {
      variantId: string;
      quantity: number;
      unitPrice: string;
    }[];
    discountAmount?: string;
    shippingAmount?: string;
    taxAmount?: string;
    couponCode?: string;
    selectedPaymentType?: "ZELLE" | "BANK_WIRE" | "AUTHORIZE_NET" | null;
    skipWarehouse?: boolean;
    suppressEmail?: boolean;
  }): Promise<ApiResponse<Order>> {
    return client.post("/orders", orderData);
  },

  async updateOrder(
    id: string,
    orderData: {
      status?: string;
      billingAddressId?: string;
      shippingAddressId?: string;
      discountAmount?: string;
      shippingAmount?: string;
      taxAmount?: string;
    },
  ): Promise<ApiResponse<Order>> {
    return client.put(`/orders/${id}`, orderData);
  },

  async updateOrderStatus(
    id: string,
    status: string,
    note?: string,
  ): Promise<ApiResponse> {
    return client.patch(`/orders/${id}/status`, { status, note });
  },

  async cancelOwnOrder(
    id: string,
  ): Promise<ApiResponse<{ orderId: string; status: string }>> {
    return client.post(`/orders/${id}/cancel`);
  },

  async addOrderNote(
    id: string,
    note: string,
    isInternal: boolean = true,
  ): Promise<ApiResponse<OrderNote>> {
    return client.post(`/orders/${id}/notes`, { note, isInternal });
  },

  async getOrderNotes(id: string): Promise<ApiResponse<OrderNote[]>> {
    return client.get(`/orders/${id}/notes`);
  },

  async deleteOrder(id: string): Promise<ApiResponse> {
    return client.delete(`/orders/${id}`);
  },

  async bulkDeleteOrders(
    ids: string[],
  ): Promise<ApiResponse<{ deletedCount: number }>> {
    return client.delete("/orders/bulk-delete", { ids });
  },

  async hardDeleteOrder(id: string): Promise<ApiResponse> {
    return client.delete(`/orders/${id}/hard`);
  },

  async sendOrdersEmailReport(data: {
    email: string;
    dateFrom?: string;
    dateTo?: string;
    usePSTFilter?: boolean;
    filters?: any;
  }): Promise<ApiResponse> {
    return client.post("/orders/email-report", {
      ...data,
      usePSTFilter: data.usePSTFilter ? "true" : "false",
    });
  },

  // Authorize.Net charge using Accept.js opaqueData
  async chargeAuthorizeNet(data: {
    orderId: string;
    amount: number;
    opaqueData: { dataDescriptor: string; dataValue: string };
  }): Promise<
    ApiResponse<{ transactionId: string; gatewayTransactionId?: string }>
  > {
    return client.post(`/payments/authorize/charge`, data);
  },

  // Authorize card directly with Authorize.Net API (without Accept.js)
  async authorizeCard(data: {
    orderId?: string;
    amount: number | string;
    cardNumber: string;
    expirationDate: string;
    cardCode: string;
    cardholderName?: string;
    billingAddress?: any;
    shippingAddress?: any;
    shippingAmount?: number | string;
    paymentFeePct?: number;
    discountAmount?: number | string;
    subtotal?: number | string;
    taxAmount?: number | string;
  }): Promise<
    ApiResponse<{
      transactionId?: string;
      gatewayTransactionId?: string;
      authCode?: string;
      gateway?: any;
      gatewayResponse?: any;
      orderId?: string;
    }>
  > {
    return client.post(`/payments/authorize-card`, data);
  },

  // Customer-initiated manual payment (Zelle/Bank Wire)
  async initiateManualPayment(data: {
    orderId: string;
    amount: number;
    note?: string;
  }): Promise<ApiResponse<{ transactionId: string; status: string }>> {
    return client.post(`/payments/manual/initiate`, data);
  },

  // Fetch public Accept config (clientKey + apiLoginId)
  async getAuthorizeNetPublicConfig(): Promise<
    ApiResponse<{ apiLoginId: string; clientKey: string; env: string }>
  > {
    return client.get(`/payments/authorize/public-config`);
  },

  async calculateShippingFromWarehouse(
    customerAddressId: string,
    items: Array<{ variantId: string; quantity: number }>,
  ) {
    return client.post<{
      warehouse: {
        id: string;
        name: string;
        address?: string;
        city?: string;
        state?: string;
        country?: string;
      };
      distance: number;
      stockAvailable: boolean;
      shippingRate: {
        rate: number;
        carrier: string;
        estimatedDays: number;
        distance: number;
        warehouse: string;
        warehouseLocation: string;
        reason?: string;
      };
      stockDetails: Record<string, { available: number; required: number }>;
    }>("/orders/calculate-shipping", { customerAddressId, items });
  },

  async calculateCheckoutShippingRates(data: {
    customerAddressId: string;
    items: Array<{ variantId: string; quantity: number }>;
    weightOz?: number;
    dimensions?: { length: number; width: number; height: number };
    carrierCode?: string;
    serviceCode?: string;
    packageCode?: string;
    shipFrom: {
      country_code: string;
      postal_code: string;
      city_locality: string;
      state_province: string;
      address_line1: string;
    };
  }) {
    return client.post<{
      warehouse: {
        id: string;
        name: string;
        address?: string;
        city?: string;
        state?: string;
        country?: string;
        postalCode?: string;
      };
      distance: number;
      stockAvailable: boolean;
      shippingRate: {
        rate: number;
        carrier: string;
        service: string;
        estimatedDays: number;
        distance: number;
        warehouse: string;
        warehouseLocation: string;
        shipstationRateId?: string;
        allRates?: Array<{
          rate: number;
          carrier: string;
          service: string;
          estimatedDays: number;
          rateId: string;
        }>;
        fallback?: boolean;
        error?: string;
      };
      stockDetails: Record<string, { available: number; required: number }>;
      shipFrom: {
        country_code: string;
        postal_code: string;
        city_locality: string;
        state_province: string;
        address_line1: string;
      };
    }>("/orders/checkout/shipping-rates", data);
  },

  // ShipStation methods
  async getShipStationCarriers(): Promise<ApiResponse<any[]>> {
    return client.get("/shipstation/carriers");
  },

  async getShipStationCarrierServices(
    carrierId: string,
  ): Promise<ApiResponse<any[]>> {
    return client.get(`/shipstation/carriers/${carrierId}/services`);
  },

  async getShipStationCarrierPackages(
    carrierId: string,
  ): Promise<ApiResponse<any[]>> {
    return client.get(`/shipstation/carriers/${carrierId}/packages`);
  },

  async getShipStationWarehouses(): Promise<ApiResponse<any[]>> {
    return client.get("/shipstation/warehouses");
  },

  async getShipStationLabelStatus(labelId: string): Promise<ApiResponse<any>> {
    return client.get(`/shipstation/labels/${labelId}`);
  },

  async calculateShippingRates(data: {
    shipment_request?: any;
    rate_options?: any;
    shipTo?: any;
    shipFrom?: any;
    weightOz?: number;
    dimensions?: any;
    carrierCode?: string;
    serviceCode?: string;
    packageCode?: string;
  }): Promise<ApiResponse<any>> {
    return client.post("/shipstation/rates/estimate", data);
  },

  async createShipStationLabel(data: {
    orderId: string;
    shipTo: any;
    shipFrom: any;
    carrierCode: string;
    serviceCode: string;
    packageCode: string;
    weightOz: number;
    dimensions?: any;
  }): Promise<ApiResponse<any>> {
    return client.post("/shipstation/labels", data);
  },

  async syncShipmentTracking(data: {
    orderId: string;
    trackingNumber?: string;
  }): Promise<ApiResponse<any>> {
    return client.post("/shipstation/tracking/sync", data);
  },

  async syncOrderTracking(orderId: string): Promise<ApiResponse<any>> {
    return client.post(`/shipstation/tracking/orders/${orderId}/sync`);
  },

  async syncShipmentTrackingSyncAll(): Promise<ApiResponse<any>> {
    return client.post("/shipstation/tracking/sync-all");
  },

  async getOrderTrackingEvents(orderId: string): Promise<ApiResponse<any[]>> {
    return client.get(`/orders/${orderId}/tracking-events`);
  },

  async getShippingSyncStatus(params?: {
    page?: number;
    limit?: number;
  }): Promise<
    ApiResponse<{
      data: any[];
      pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    }>
  > {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append("page", params.page.toString());
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    const qs = searchParams.toString();
    return client.get(`/shipstation/tracking/sync-status${qs ? `?${qs}` : ""}`);
  },

  async createShippingLabel(data: any): Promise<ApiResponse<any>> {
    return client.post("/shipstation/labels", data);
  },

  // Refund management
  async initiateOrderRefund(orderId: string, amount: number, reason: string) {
    return client.post(`/orders/${orderId}/refund`, { amount, reason });
  },

  async updateRefundStatus(refundId: string, status: string) {
    return client.put(`/orders/refunds/${refundId}/status`, { status });
  },

  // Transaction management endpoints
  async getTransactions(params?: {
    orderId?: string;
    paymentStatus?: string;
    paymentGatewayName?: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<ApiResponse<{ transactions: any[] } | any[]>> {
    const queryParams = new URLSearchParams();
    if (params?.orderId) queryParams.append("orderId", params.orderId);
    if (params?.paymentStatus)
      queryParams.append("paymentStatus", params.paymentStatus);
    if (params?.paymentGatewayName)
      queryParams.append("paymentGatewayName", params.paymentGatewayName);
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.search) queryParams.append("search", params.search);
    return client.get(
      `/transactions${queryParams.toString() ? `?${queryParams}` : ""}`,
    );
  },

  async getTransaction(id: string): Promise<ApiResponse<any>> {
    return client.get(`/transactions/${id}`);
  },

  async createTransaction(data: {
    orderId: string;
    amount: string | number;
    paymentStatus: string;
    paymentGatewayName: string;
    paymentGatewayTransactionId?: string;
    paymentGatewayResponse?: string;
  }): Promise<ApiResponse<any>> {
    return client.post("/transactions", data);
  },

  async updateTransaction(
    id: string,
    data: {
      paymentStatus?: string;
      paymentGatewayTransactionId?: string;
      paymentGatewayResponse?: string;
    },
  ): Promise<ApiResponse<any>> {
    return client.put(`/transactions/${id}`, data);
  },

  // Shipping Management
  async getShipments(params?: {
    page?: number;
    limit?: number;
    orderId?: string;
    status?: string;
  }): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (params) {
      if (params.page) searchParams.append("page", params.page.toString());
      if (params.limit) searchParams.append("limit", params.limit.toString());
      if (params.orderId) searchParams.append("orderId", params.orderId);
      if (params.status) searchParams.append("status", params.status);
    }

    return client.get(`/shipping?${searchParams.toString()}`);
  },

  async getShipment(id: string): Promise<ApiResponse<any>> {
    return client.get(`/shipping/${id}`);
  },

  async getOrderShipments(orderId: string): Promise<ApiResponse<any>> {
    // Use public endpoint so customers can view their own shipments
    return client.get(`/shipping/public/order/${orderId}`);
  },

  async createShipment(data: {
    orderId: string;
    carrier: string;
    trackingNumber?: string;
    trackingUrl?: string;
    status?: string;
  }): Promise<ApiResponse<any>> {
    return client.post("/shipping", data);
  },

  async updateShipmentTracking(
    id: string,
    data: {
      trackingNumber?: string;
      trackingUrl?: string;
      status?: string;
      carrier?: string;
    },
  ): Promise<ApiResponse<any>> {
    return client.put(`/shipping/${id}/tracking`, data);
  },

  async deleteShipment(id: string): Promise<ApiResponse<any>> {
    return client.delete(`/shipping/${id}`);
  },

  // Applicable shipping rate
  async getApplicableShippingRate(
    country: string,
    subtotal: number,
    weight?: number,
  ): Promise<ApiResponse<any | null>> {
    const searchParams = new URLSearchParams();
    searchParams.append("country", country);
    searchParams.append("subtotal", subtotal.toString());
    if (weight) searchParams.append("weight", weight.toString());

    return client.get(`/shipping/applicable-rate?${searchParams.toString()}`);
  },

  // Shipping Zones Management
  async getShippingZones(): Promise<ApiResponse<any>> {
    return client.get("/shipping/zones");
  },

  async createShippingZone(data: {
    name: string;
    countries: string[];
    rates?: {
      name: string;
      rate: number;
      estimatedDays?: string;
      freeShippingThreshold?: number;
    }[];
  }): Promise<ApiResponse<any>> {
    return client.post("/shipping/zones", data);
  },

  async updateShippingZone(
    id: string,
    data: {
      name?: string;
      countries?: string[];
    },
  ): Promise<ApiResponse<any>> {
    return client.put(`/shipping/zones/${id}`, data);
  },

  async deleteShippingZone(id: string): Promise<ApiResponse<any>> {
    return client.delete(`/shipping/zones/${id}`);
  },

  // Shipping Rates Management
  async getShippingRates(zoneId?: string): Promise<ApiResponse<any>> {
    const params = zoneId ? `?zoneId=${zoneId}` : "";
    return client.get(`/shipping/rates${params}`);
  },

  async createShippingRate(data: {
    zoneId: string;
    name: string;
    rate: number;
    minWeight?: number;
    maxWeight?: number;
    minPrice?: number;
    maxPrice?: number;
    freeShippingThreshold?: number;
    estimatedDays?: string;
    isActive?: boolean;
  }): Promise<ApiResponse<any>> {
    return client.post("/shipping/rates", data);
  },

  async updateShippingRate(
    id: string,
    data: {
      name?: string;
      rate?: number;
      minWeight?: number;
      maxWeight?: number;
      minPrice?: number;
      maxPrice?: number;
      freeShippingThreshold?: number;
      estimatedDays?: string;
      isActive?: boolean;
    },
  ): Promise<ApiResponse<any>> {
    return client.put(`/shipping/rates/${id}`, data);
  },

  async deleteShippingRate(id: string): Promise<ApiResponse<any>> {
    return client.delete(`/shipping/rates/${id}`);
  },

  // Shipping Tiers Management
  async getShippingTiers(): Promise<ApiResponse<any>> {
    return client.get("/shipping/tiers");
  },

  async getPublicShippingTiers(): Promise<ApiResponse<any>> {
    return client.get("/shipping/public/tiers");
  },

  async getShippingTier(id: string): Promise<ApiResponse<any>> {
    return client.get(`/shipping/tiers/${id}`);
  },

  async createShippingTier(data: {
    name: string;
    minSubtotal: number;
    maxSubtotal?: number | null;
    shippingRate: number;
    serviceName?: string;
  }): Promise<ApiResponse<any>> {
    return client.post("/shipping/tiers", data);
  },

  async updateShippingTier(
    id: string,
    data: {
      name?: string;
      minSubtotal?: number;
      maxSubtotal?: number | null;
      shippingRate?: number;
      serviceName?: string;
      isActive?: boolean;
    },
  ): Promise<ApiResponse<any>> {
    return client.put(`/shipping/tiers/${id}`, data);
  },

  async deleteShippingTier(id: string): Promise<ApiResponse<any>> {
    return client.delete(`/shipping/tiers/${id}`);
  },

  // Carriers Management
  async getCarriers(): Promise<ApiResponse<any>> {
    return client.get("/shipping/carriers");
  },

  async createCarrier(data: {
    name: string;
    code: string;
    apiKey?: string;
    apiSecret?: string;
    services?: string[];
    trackingUrl?: string;
    isActive?: boolean;
  }): Promise<ApiResponse<any>> {
    return client.post("/shipping/carriers", data);
  },

  async updateCarrier(
    id: string,
    data: {
      name?: string;
      code?: string;
      apiKey?: string;
      apiSecret?: string;
      services?: string[];
      trackingUrl?: string;
      isActive?: boolean;
    },
  ): Promise<ApiResponse<any>> {
    return client.put(`/shipping/carriers/${id}`, data);
  },

  async deleteCarrier(id: string): Promise<ApiResponse<any>> {
    return client.delete(`/shipping/carriers/${id}`);
  },

  // File upload
  async uploadFile(
    file: File,
  ): Promise<ApiResponse<{ url: string; filename: string }>> {
    const formData = new FormData();
    // Backend S3 route expects field name 'image'
    formData.append("image", file);

    const token = getToken();
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${client.baseURL}/uploads/image`, {
        method: "POST",
        headers,
        credentials: "include",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || `HTTP ${response.status}: ${response.statusText}`,
        );
      }

      // Normalize to ApiResponse shape
      if (data && data.success && data.data?.url) {
        return {
          success: true,
          data: { url: data.data.url, filename: data.data.filename },
        } as any;
      }
      return data as ApiResponse<any>;
    } catch (error) {
      logger.error("File upload failed", { error });
      if (error instanceof Error) {
        // Show error toast (only on client side)
        if (typeof window !== "undefined") {
          const { toast } = await import("sonner");
          toast.error(error.message);
        }
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: "File upload failed",
      };
    }
  },
});
