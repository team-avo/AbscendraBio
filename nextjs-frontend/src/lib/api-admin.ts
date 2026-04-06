import { ApiClient } from "./api-client";
import {
    ApiResponse,
    PaginatedData,
    BulkQuote,
    CreateBulkQuoteRequest,
    SalesRepPerformanceResponse,
    SalesPersonReportResponse,
    TierUpgradeNotification,
} from "./api-types";

export const createAdminMethods = (client: ApiClient) => ({
    // Analytics - Sales
    async getSalesReports(
        range?:
            | "last_7_days"
            | "last_30_days"
            | "last_90_days"
            | "last_year"
            | "custom",
        from?: Date,
        to?: Date,
        detailed?: boolean,
        salesChannelId?: string,
        usePSTFilter?: boolean,
    ) {
        const params = new URLSearchParams();
        if (range) params.set("range", String(range));
        if (from) {
            const yyyy = from.getFullYear();
            const mm = String(from.getMonth() + 1).padStart(2, "0");
            const dd = String(from.getDate()).padStart(2, "0");
            params.set("from", `${yyyy}-${mm}-${dd}`);
        }
        if (to) {
            const yyyy = to.getFullYear();
            const mm = String(to.getMonth() + 1).padStart(2, "0");
            const dd = String(to.getDate()).padStart(2, "0");
            params.set("to", `${yyyy}-${mm}-${dd}`);
        }
        if (detailed) params.set("detailed", "true");
        if (salesChannelId) params.set("salesChannelId", salesChannelId);
        if (usePSTFilter) params.set("usePSTFilter", "true");
        const qs = params.toString();
        return client.get(`/analytics/sales${qs ? `?${qs}` : ""}`);
    },

    async sendSalesEmailReport(data: {
        email: string;
        range?: string;
        from?: string;
        to?: string;
        salesChannelId?: string;
        managerId?: string;
        salesRepId?: string;
        usePSTFilter?: boolean;
    }): Promise<ApiResponse> {
        return client.post("/analytics/email-report", {
            ...data,
            usePSTFilter: data.usePSTFilter ? "true" : "false",
        });
    },

    async sendTransactionsEmailReport(data: {
        email: string;
        orderId?: string;
        paymentStatus?: string;
        paymentGatewayName?: string;
        search?: string;
    }): Promise<ApiResponse> {
        return client.post("/transactions/email-report", data);
    },

    async getSalesByRegion(
        range?:
            | "last_7_days"
            | "last_30_days"
            | "last_90_days"
            | "last_year"
            | "custom",
        from?: Date,
        to?: Date,
        state?: string,
        city?: string,
        salesChannelId?: string,
    ) {
        const params = new URLSearchParams();
        if (range) params.set("range", String(range));
        if (from) {
            const yyyy = from.getFullYear();
            const mm = String(from.getMonth() + 1).padStart(2, "0");
            const dd = String(from.getDate()).padStart(2, "0");
            params.set("from", `${yyyy}-${mm}-${dd}`);
        }
        if (to) {
            const yyyy = to.getFullYear();
            const mm = String(to.getMonth() + 1).padStart(2, "0");
            const dd = String(to.getDate()).padStart(2, "0");
            params.set("to", `${yyyy}-${mm}-${dd}`);
        }
        if (state) params.set("state", state);
        if (city) params.set("city", city);
        if (salesChannelId) params.set("salesChannelId", salesChannelId);
        const qs = params.toString();
        return client.get(`/analytics/sales/by-region${qs ? `?${qs}` : ""}`);
    },

    async getSalesRegionFilters() {
        return client.get(`/analytics/sales/regions/filters`);
    },

    // Analytics - Product Performance
    async getProductPerformance(
        range?:
            | "last_7_days"
            | "last_30_days"
            | "last_90_days"
            | "last_year"
            | "custom"
            | "all",
        from?: Date,
        to?: Date,
        salesChannelId?: string,
    ) {
        const params = new URLSearchParams();
        if (range) params.set("range", String(range));
        if (from) {
            const yyyy = from.getFullYear();
            const mm = String(from.getMonth() + 1).padStart(2, "0");
            const dd = String(from.getDate()).padStart(2, "0");
            params.set("from", `${yyyy}-${mm}-${dd}`);
        }
        if (to) {
            const yyyy = to.getFullYear();
            const mm = String(to.getMonth() + 1).padStart(2, "0");
            const dd = String(to.getDate()).padStart(2, "0");
            params.set("to", `${yyyy}-${mm}-${dd}`);
        }
        if (salesChannelId) params.set("salesChannelId", salesChannelId);
        params.set("usePSTFilter", "true");
        const qs = params.toString();
        return client.get(`/analytics/products${qs ? `?${qs}` : ""}`);
    },

    // Analytics - Sales Reps
    async getSalesRepPerformance(
        range?: "7d" | "14d" | "30d" | "90d" | "365d" | "custom" | "all",
        from?: Date,
        to?: Date,
        independent?: boolean,
    ): Promise<ApiResponse<SalesRepPerformanceResponse>> {
        const params = new URLSearchParams();
        if (range) params.set("range", range);
        if (independent) params.set("independent", "true");
        if (from) {
            const yyyy = from.getFullYear();
            const mm = String(from.getMonth() + 1).padStart(2, "0");
            const dd = String(from.getDate()).padStart(2, "0");
            params.set("from", `${yyyy}-${mm}-${dd}`);
        }
        if (to) {
            const yyyy = to.getFullYear();
            const mm = String(to.getMonth() + 1).padStart(2, "0");
            const dd = String(to.getDate()).padStart(2, "0");
            params.set("to", `${yyyy}-${mm}-${dd}`);
        }
        params.set("usePSTFilter", "true");
        const qs = params.toString();
        return client.get(`/sales-reps/performance${qs ? `?${qs}` : ""}`);
    },

    // Notifications
    async getNotifications(params?: {
        page?: number;
        limit?: number;
        type?: string;
        priority?: string;
        isRead?: boolean;
        customerId?: string;
    }): Promise<ApiResponse<any>> {
        const queryParams = new URLSearchParams();
        if (params?.page) queryParams.append("page", params.page.toString());
        if (params?.limit) queryParams.append("limit", params.limit.toString());
        if (params?.type) queryParams.append("type", params.type);
        if (params?.priority) queryParams.append("priority", params.priority);
        if (params?.isRead !== undefined)
            queryParams.append("isRead", params.isRead.toString());
        if (params?.customerId) queryParams.append("customerId", params.customerId);

        const qs = queryParams.toString();
        return client.get(`/notifications${qs ? `?${qs}` : ""}`);
    },

    async getTierUpgradeNotifications(params?: {
        page?: number;
        limit?: number;
    }): Promise<
        ApiResponse<{ notifications: TierUpgradeNotification[]; total: number }>
    > {
        const queryParams = new URLSearchParams();
        if (params?.page) queryParams.append("page", params.page.toString());
        if (params?.limit) queryParams.append("limit", params.limit.toString());

        const qs = queryParams.toString();
        return client.get(`/notifications/tier-upgrades${qs ? `?${qs}` : ""}`);
    },

    async markNotificationAsRead(id: string): Promise<ApiResponse<any>> {
        return client.patch(`/notifications/${id}/read`);
    },

    async markAllNotificationsAsRead(): Promise<
        ApiResponse<{ updatedCount: number }>
    > {
        return client.patch("/notifications/mark-all-read");
    },

    async getUnreadNotificationCount(): Promise<ApiResponse<{ count: number }>> {
        return client.get("/notifications/unread-count");
    },

    // Bulk Quote methods
    async getBulkQuotes(params?: {
        page?: number;
        limit?: number;
        isRead?: boolean;
        customerId?: string;
        productId?: string;
        search?: string;
    }): Promise<ApiResponse<PaginatedData<BulkQuote>>> {
        const qs = new URLSearchParams();
        if (params?.page) qs.set("page", String(params.page));
        if (params?.limit) qs.set("limit", String(params.limit));
        if (params?.isRead !== undefined) qs.set("isRead", String(params.isRead));
        if (params?.customerId) qs.set("customerId", params.customerId);
        if (params?.productId) qs.set("productId", params.productId);
        if (params?.search) qs.set("search", params.search);

        const queryString = qs.toString();
        return client.get(`/bulk-quotes${queryString ? `?${queryString}` : ""}`);
    },

    async getBulkQuote(id: string): Promise<ApiResponse<BulkQuote>> {
        return client.get(`/bulk-quotes/${id}`);
    },

    async createBulkQuote(
        data: CreateBulkQuoteRequest,
    ): Promise<ApiResponse<BulkQuote>> {
        return client.post("/bulk-quotes", data);
    },

    async markBulkQuoteAsRead(id: string): Promise<ApiResponse<BulkQuote>> {
        return client.patch(`/bulk-quotes/${id}/read`);
    },

    async markBulkQuoteAsUnread(id: string): Promise<ApiResponse<BulkQuote>> {
        return client.patch(`/bulk-quotes/${id}/unread`);
    },

    async deleteBulkQuote(id: string): Promise<ApiResponse<{ message: string }>> {
        return client.delete(`/bulk-quotes/${id}`);
    },

    // Sales Manager & Representative methods
    async getSalesManagers(params?: {
        search?: string;
    }): Promise<ApiResponse<any[]>> {
        const qs = new URLSearchParams();
        if (params?.search) qs.append("search", params.search);
        return client.get(`/sales-managers?${qs.toString()}`);
    },

    async getSalesManager(id: string): Promise<ApiResponse<any>> {
        return client.get(`/sales-managers/${id}`);
    },

    async salesManagerAssignCustomers(
        managerId: string,
        customerIds: string[],
    ): Promise<ApiResponse<any>> {
        return client.put(`/sales-managers/${managerId}/assignments`, {
            customerIds,
        });
    },

    async getSalesRep(id: string): Promise<ApiResponse<any>> {
        return client.get(`/sales-reps/${id}`);
    },

    async getUnassignedCustomers(params?: {
        search?: string;
        page?: number;
        limit?: number;
    }): Promise<ApiResponse<any[]>> {
        const queryParams = new URLSearchParams();
        if (params?.search) queryParams.append("search", params.search);
        if (params?.page) queryParams.append("page", params.page.toString());
        if (params?.limit) queryParams.append("limit", params.limit.toString());

        const qs = queryParams.toString();
        return client.get(`/sales-reps/assignment-candidates${qs ? `?${qs}` : ""}`);
    },

    async getUnassignedCustomersForManager(params?: {
        search?: string;
        page?: number;
        limit?: number;
    }): Promise<ApiResponse<any[]>> {
        const queryParams = new URLSearchParams();
        if (params?.search) queryParams.append("search", params.search);
        if (params?.page) queryParams.append("page", params.page.toString());
        if (params?.limit) queryParams.append("limit", params.limit.toString());

        const qs = queryParams.toString();
        return client.get(
            `/sales-managers/assignment-candidates${qs ? `?${qs}` : ""}`,
        );
    },

    async assignCustomerToSalesRep(
        customerId: string,
    ): Promise<ApiResponse<any>> {
        return client.post("/sales-reps/assign-customer", { customerId });
    },

    async assignCustomerToSalesManager(
        customerId: string,
    ): Promise<ApiResponse<any>> {
        return client.post("/sales-managers/assign-customer", { customerId });
    },

    // Refund management
    async initiateOrderRefund(orderId: string, amount: number, reason: string) {
        return client.post(`/orders/${orderId}/refund`, { amount, reason });
    },

    async updateRefundStatus(refundId: string, status: string) {
        return client.put(`/orders/refunds/${refundId}/status`, { status });
    },

    // Transaction management
    async getTransactions(params?: {
        orderId?: string;
        paymentStatus?: string;
        paymentGatewayName?: string;
        page?: number;
        limit?: number;
        search?: string;
    }): Promise<ApiResponse<any>> {
        const queryParams = new URLSearchParams();
        if (params?.orderId) queryParams.append("orderId", params.orderId);
        if (params?.paymentStatus)
            queryParams.append("paymentStatus", params.paymentStatus);
        if (params?.paymentGatewayName)
            queryParams.append("paymentGatewayName", params.paymentGatewayName);
        if (params?.page) queryParams.append("page", params.page.toString());
        if (params?.limit) queryParams.append("limit", params.limit.toString());
        if (params?.search) queryParams.append("search", params.search);

        const qs = queryParams.toString();
        return client.get(`/transactions${qs ? `?${qs}` : ""}`);
    },

    // Dashboard Analytics
    async getDashboardAnalytics(
        range?:
            | "last_7_days"
            | "last_30_days"
            | "last_90_days"
            | "last_year"
            | "custom"
            | "all",
        from?: Date,
        to?: Date,
        salesChannelId?: string,
        usePSTFilter?: boolean,
    ): Promise<
        ApiResponse<{
            totalRevenue: number;
            revenueChange: number;
            totalOrders: number;
            orderChange: number;
            totalCustomers: number;
            customerChange: number;
            activeProducts: number;
            productChange: number;
            customerLifetimeValue: number;
            clvChange: number;
            recentOrders: Array<{
                id: string;
                customer: string;
                email: string;
                amount: number;
                status: string;
                date: string;
            }>;
            topProducts: Array<{
                id: string;
                name: string;
                sales: number;
                revenue: number;
                stock: number;
                trend: string;
            }>;
            customerTypeData: Array<{
                name: string;
                value: number;
                color: string;
                count: number;
            }>;
            salesData: Array<{ month: string; revenue: number; orders: number }>;
        }>
    > {
        const params = new URLSearchParams();
        if (range) params.set("range", String(range));
        if (from) {
            const yyyy = from.getFullYear();
            const mm = String(from.getMonth() + 1).padStart(2, "0");
            const dd = String(from.getDate()).padStart(2, "0");
            params.set("from", `${yyyy}-${mm}-${dd}`);
        }
        if (to) {
            const yyyy = to.getFullYear();
            const mm = String(to.getMonth() + 1).padStart(2, "0");
            const dd = String(to.getDate()).padStart(2, "0");
            params.set("to", `${yyyy}-${mm}-${dd}`);
        }
        if (salesChannelId) params.set("salesChannelId", salesChannelId);
        if (usePSTFilter) params.set("usePSTFilter", "true");
        const qs2 = params.toString();
        return client.get(`/analytics/dashboard${qs2 ? `?${qs2}` : ""}`);
    },

    // SKU Performance Analytics
    async getSkuPerformanceAnalytics(
        range?:
            | "7_days"
            | "1_month"
            | "3_months"
            | "6_months"
            | "12_months"
            | "all_time"
            | "custom",
        from?: Date,
        to?: Date,
        salesChannelId?: string,
    ): Promise<
        ApiResponse<
            Array<{
                id: string;
                sku: string;
                name: string;
                productName: string;
                totalSold: number;
                startDate: string;
                endDate: string;
            }>
        >
    > {
        const params = new URLSearchParams();
        if (range) params.set("range", String(range));
        if (from) params.set("from", from.toISOString());
        if (to) params.set("to", to.toISOString());
        if (salesChannelId) params.set("salesChannelId", salesChannelId);
        params.set("usePSTFilter", "true");
        const qs2 = params.toString();
        return client.get(`/analytics/sku-performance${qs2 ? `?${qs2}` : ""}`);
    },

    async getSkuComparison(
        variantId: string,
        period: "week" | "month",
        salesChannelId?: string,
    ): Promise<
        ApiResponse<{
            variantId: string;
            sku: string;
            name: string;
            productName: string;
            totalOutflow: number;
            period: string;
            comparison: {
                current: {
                    label: string;
                    total: number;
                    daily: Array<{ date: string; value: number }>;
                };
                previous: {
                    label: string;
                    total: number;
                    daily: Array<{ date: string; value: number }>;
                };
            };
        }>
    > {
        const params = new URLSearchParams();
        params.set("period", period);
        if (salesChannelId) params.set("salesChannelId", salesChannelId);
        params.set("usePSTFilter", "true");
        const qs2 = params.toString();
        return client.get(
            `/analytics/sku/${variantId}/comparison${qs2 ? `?${qs2}` : ""}`,
        );
    },

    async getSkuPerformanceHistory(
        variantId: string,
        period: "week" | "month" = "week",
        salesChannelId?: string,
    ): Promise<
        ApiResponse<{
            summary: {
                totalUnits: number;
                startDate: string;
                endDate: string;
                label: string;
            };
            weeks: Array<{
                label: string;
                total: number;
                delta: number | null;
            }>;
        }>
    > {
        const params = new URLSearchParams();
        params.set("period", period);
        if (salesChannelId) params.set("salesChannelId", salesChannelId);
        params.set("usePSTFilter", "true");
        const qs2 = params.toString();
        return client.get(
            `/analytics/sku/${variantId}/performance-history${qs2 ? `?${qs2}` : ""}`,
        );
    },

    // Audit logs
    async getAuditLogs(params?: {
        page?: number;
        limit?: number;
        userId?: string;
        action?: string;
        from?: string;
        to?: string;
    }): Promise<ApiResponse<any>> {
        const queryParams = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined) {
                    queryParams.append(key, value.toString());
                }
            });
        }
        const qs2 = queryParams.toString();
        return client.get(`/audit-logs${qs2 ? `?${qs2}` : ""}`);
    },

    // Sales Person Report
    async getSalesPersonReport(params: {
        managerId?: string;
        salesRepId?: string;
        range?: string;
        from?: Date;
        to?: Date;
        salesChannelId?: string;
    }): Promise<ApiResponse<SalesPersonReportResponse>> {
        const qp = new URLSearchParams();
        if (params.managerId) qp.set("managerId", params.managerId);
        if (params.salesRepId) qp.set("salesRepId", params.salesRepId);
        if (params.range) qp.set("range", params.range);
        if (params.from) {
            const yyyy = params.from.getFullYear();
            const mm = String(params.from.getMonth() + 1).padStart(2, "0");
            const dd = String(params.from.getDate()).padStart(2, "0");
            qp.set("from", `${yyyy}-${mm}-${dd}`);
        }
        if (params.to) {
            const yyyy = params.to.getFullYear();
            const mm = String(params.to.getMonth() + 1).padStart(2, "0");
            const dd = String(params.to.getDate()).padStart(2, "0");
            qp.set("to", `${yyyy}-${mm}-${dd}`);
        }
        if (params.salesChannelId) qp.set("salesChannelId", params.salesChannelId);
        qp.set("usePSTFilter", "true");
        const qs = qp.toString();
        return client.get(`/analytics/sales-person-report${qs ? `?${qs}` : ""}`);
    },

    // Login Audit Logs
    async getLoginAuditLogs(params?: {
        page?: number;
        limit?: number;
        status?: string;
        email?: string;
        portal?: string;
        source?: string;
        from?: string;
        to?: string;
    }): Promise<ApiResponse<any>> {
        const queryParams = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== "") {
                    queryParams.append(key, value.toString());
                }
            });
        }
        const qs = queryParams.toString();
        return client.get(`/login-audit-logs${qs ? `?${qs}` : ""}`);
    },

    async getLoginAuditSummary(params?: {
        from?: string;
        to?: string;
    }): Promise<ApiResponse<any>> {
        const queryParams = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== "") {
                    queryParams.append(key, value.toString());
                }
            });
        }
        const qs = queryParams.toString();
        return client.get(`/login-audit-logs/summary${qs ? `?${qs}` : ""}`);
    },

    getLoginAuditExportUrl(params?: {
        status?: string;
        email?: string;
        portal?: string;
        source?: string;
        from?: string;
        to?: string;
    }): string {
        const queryParams = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== "") {
                    queryParams.append(key, value.toString());
                }
            });
        }
        const qs = queryParams.toString();
        return `/login-audit-logs/export${qs ? `?${qs}` : ""}`;
    },
});
