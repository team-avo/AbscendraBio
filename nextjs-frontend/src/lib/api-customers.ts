import { ApiClient } from "./api-client";
import { ApiResponse, Customer, Product, Address } from "./api-types";

export const createCustomerMethods = (client: ApiClient) => ({
    async getCustomers(params?: {
        page?: number;
        limit?: number;
        customerType?: string;
        isActive?: boolean;
        isApproved?: boolean;
        approvalStatus?: "PENDING" | "APPROVED" | "DEACTIVATED";
        search?: string;
        salesRepId?: string;
        salesManagerId?: string;
    }): Promise<
        ApiResponse<{
            customers: Customer[];
            pagination: {
                page: number;
                limit: number;
                total: number;
                pages: number;
            };
            stats?: {
                active: number;
                inactive: number;
                pendingApproval?: number;
                pending?: number;
                approved?: number;
                rejected?: number;
                b2c: number;
                b2b: number;
                e1: number;
                e2: number
            };
        }>
    > {
        const searchParams = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined) {
                    searchParams.append(key, value.toString());
                }
            });
        }
        return client.get(`/customers?${searchParams.toString()}`);
    },

    async getCustomer(id: string): Promise<ApiResponse<Customer>> {
        return client.get(`/customers/${id}`);
    },

    async createCustomer(customerData: {
        firstName: string;
        lastName: string;
        middleName?: string;
        companyName?: string;
        licenseNumber?: string;
        email: string;
        mobile?: string;
        city?: string;
        zip?: string;
        password?: string;
        customerType?: string;
        isActive?: boolean;
        tags?: string[];
        addresses?: any[];
    }): Promise<ApiResponse<Customer>> {
        return client.post("/customers", customerData);
    },

    async updateCustomer(
        id: string,
        customerData: {
            firstName?: string;
            lastName?: string;
            middleName?: string;
            companyName?: string;
            licenseNumber?: string;
            email?: string;
            mobile?: string;
            city?: string;
            zip?: string;
            customerType?: string;
            isActive?: boolean;
            isApproved?: boolean;
            emailVerified?: boolean;
            mobileVerified?: boolean;
            tags?: string[];
        }
    ): Promise<ApiResponse<Customer>> {
        return client.put(`/customers/${id}`, customerData);
    },

    async deleteCustomer(id: string): Promise<ApiResponse> {
        return client.delete(`/customers/${id}`);
    },

    async hardDeleteCustomer(id: string): Promise<ApiResponse> {
        return client.delete(`/customers/${id}/hard`);
    },

    async bulkDeleteCustomers(ids: string[]): Promise<ApiResponse<{ deletedCount: number }>> {
        return client.post('/customers/bulk-delete', { ids });
    },

    // Favorites (customer self-service)
    async getFavorites(
        customerId: string,
        params?: { page?: number; limit?: number }
    ): Promise<
        ApiResponse<{
            favorites: Array<{ id: string; product: Product }>;
            pagination: { page: number; limit: number; total: number; pages: number };
        }>
    > {
        const searchParams = new URLSearchParams();
        if (params?.page) searchParams.append("page", params.page.toString());
        if (params?.limit) searchParams.append("limit", params.limit.toString());
        const qs = searchParams.toString();
        return client.get(
            `/customers/${customerId}/favorites${qs ? `?${qs}` : ""}`
        );
    },

    async addFavorite(
        customerId: string,
        productId: string
    ): Promise<ApiResponse<{ id: string; product: Product }>> {
        return client.post(`/customers/${customerId}/favorites`, { productId });
    },

    async removeFavorite(
        customerId: string,
        favoriteId: string
    ): Promise<ApiResponse> {
        return client.delete(`/customers/${customerId}/favorites/${favoriteId}`);
    },

    async removeFavoriteByProduct(
        customerId: string,
        productId: string
    ): Promise<ApiResponse> {
        const qs = new URLSearchParams({ productId }).toString();
        return client.delete(`/customers/${customerId}/favorites?${qs}`);
    },

    // Notify customer with credentials email
    async notifyCustomerCredentials(customerId: string, password: string): Promise<ApiResponse<{ message: string }>> {
        return client.post(`/customers/${customerId}/notify-credentials`, { password });
    },

    // Addresses
    async createAddress(
        customerId: string,
        addressData: any
    ): Promise<ApiResponse<Address>> {
        return client.post(`/customers/${customerId}/addresses`, addressData);
    },

    async updateAddress(
        customerId: string,
        addressId: string,
        addressData: any
    ): Promise<ApiResponse<Address>> {
        return client.put(`/customers/${customerId}/addresses/${addressId}`, addressData);
    },

    async deleteAddress(
        customerId: string,
        addressId: string
    ): Promise<ApiResponse> {
        return client.delete(`/customers/${customerId}/addresses/${addressId}`);
    },

    // Customer insights & analytics
    async getCustomerInsights(
        range?: "last_7_days" | "last_30_days" | "last_90_days" | "last_year" | "custom",
        from?: Date,
        to?: Date,
        search?: string,
        managerId?: string,
        salesChannelId?: string,
        page?: number,
        limit?: number
    ) {
        const params = new URLSearchParams();
        if (range) params.set("range", String(range));
        if (from) params.set("from", from.toISOString());
        if (to) params.set("to", to.toISOString());
        if (search) params.set("search", search);
        if (managerId) params.set("managerId", managerId);
        if (salesChannelId) params.set("salesChannelId", salesChannelId);
        if (page) params.set("page", String(page));
        if (limit) params.set("limit", String(limit));
        params.set("usePSTFilter", "true");
        const qs = params.toString();
        return client.get(`/analytics/customers${qs ? `?${qs}` : ""}`);
    },

    async getCustomerOrderFrequency(
        search?: string,
        salesChannelId?: string,
        range?: "last_7_days" | "last_30_days" | "last_90_days" | "last_year" | "custom" | "all_time",
        from?: Date,
        to?: Date,
        tab?: string,
        plusFilter?: string,
        page?: number,
        limit?: number
    ): Promise<ApiResponse<any>> {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (salesChannelId) params.set("salesChannelId", salesChannelId);
        if (range) params.set("range", String(range));
        if (from) params.set("from", from.toISOString());
        if (to) params.set("to", to.toISOString());
        if (tab) params.set("tab", tab);
        if (plusFilter) params.set("plusFilter", plusFilter);
        if (page) params.set("page", String(page));
        if (limit) params.set("limit", String(limit));
        const qs = params.toString();
        return client.get(`/analytics/customers/order-frequency${qs ? `?${qs}` : ""}`);
    },

    async getCustomerSummary(
        customerId: string,
        range?: string,
        from?: Date | null,
        to?: Date | null,
        salesChannelId?: string
    ) {
        const params = new URLSearchParams();
        if (range) params.set("range", range);
        if (from) {
            const yyyy = from.getFullYear();
            const mm = String(from.getMonth() + 1).padStart(2, '0');
            const dd = String(from.getDate()).padStart(2, '0');
            params.set("from", `${yyyy}-${mm}-${dd}`);
        }
        if (to) {
            const yyyy = to.getFullYear();
            const mm = String(to.getMonth() + 1).padStart(2, '0');
            const dd = String(to.getDate()).padStart(2, '0');
            params.set("to", `${yyyy}-${mm}-${dd}`);
        }
        if (salesChannelId) params.set("salesChannelId", salesChannelId);
        params.set("usePSTFilter", "true");
        const qs = params.toString();
        return client.get(`/analytics/customers/${customerId}/summary${qs ? `?${qs}` : ""}`);
    },

    async updateCustomerSalesRep(customerId: string, salesRepId: string): Promise<ApiResponse<any>> {
        return client.put(`/customers/${customerId}/sales-rep`, { salesRepId });
    },

    async sendCustomersEmailReport(params: {
        email: string;
        type?: string;
        customerType?: string;
        isActive?: boolean;
        isApproved?: boolean;
        approvalStatus?: string;
    }): Promise<ApiResponse> {
        return client.post("/customers/email-report", params);
    },
});
