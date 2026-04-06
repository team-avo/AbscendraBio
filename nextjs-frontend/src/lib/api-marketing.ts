import { ApiClient } from "./api-client";
import { ApiResponse } from "./api-types";

export const createMarketingMethods = (client: ApiClient) => ({
    // Marketing Dashboard
    async getMarketingDashboard(): Promise<
        ApiResponse<{
            activeCampaigns: number;
            activeCampaignsChange: number;
            totalReach: number;
            totalReachChange: number;
            clickThroughRate: number;
            clickThroughRateChange: number;
            marketingRevenue: number;
            marketingRevenueChange: number;
        }>
    > {
        return client.get("/marketing/dashboard");
    },

    async blastSelectedCustomers(customerIds: string[]): Promise<ApiResponse<any>> {
        return client.post("/marketing/blast-selected", { customerIds });
    },

    async getMarketingCampaigns(): Promise<
        ApiResponse<
            Array<{
                id: string;
                name: string;
                type: string;
                status: string;
                audience: number;
                sent: number;
                opens: number;
                clicks: number;
                revenue: number;
                createdAt: string;
            }>
        >
    > {
        return client.get("/marketing/campaigns");
    },

    async getMarketingAnalytics(): Promise<
        ApiResponse<{
            campaignData: Array<{
                month: string;
                emailOpen: number;
                smsOpen: number;
                revenue: number;
            }>;
            channelData: Array<{
                name: string;
                value: number;
                color: string;
            }>;
        }>
    > {
        return client.get("/marketing/analytics");
    },

    async getMarketingCustomers(): Promise<
        ApiResponse<{
            loyaltyMembers: Array<{
                id: string;
                name: string;
                email: string;
                tier: string;
                points: number;
                totalSpent: number;
                joinDate: string;
            }>;
            programStats: {
                totalMembers: number;
                activeThisMonth: number;
                pointsRedeemed: number;
                averageSpend: number;
            };
        }>
    > {
        return client.get("/marketing/customers");
    },

    // Campaigns
    async getCampaigns(params?: {
        page?: number;
        limit?: number;
        type?: "EMAIL" | "SMS" | "AUTOMATION";
        status?: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED";
    }): Promise<ApiResponse<any>> {
        const searchParams = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null)
                    searchParams.append(key, String(value));
            });
        }
        return client.get(`/campaigns?${searchParams.toString()}`);
    },

    async getCampaign(id: string): Promise<ApiResponse<any>> {
        return client.get(`/campaigns/${id}`);
    },

    async createCampaign(data: {
        name: string;
        type: "EMAIL" | "SMS" | "AUTOMATION";
        status?: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED";
        promotionId?: string;
        scheduledAt?: string;
        emailTemplateType?: string;
        audienceFilter?: any;
    }): Promise<ApiResponse<any>> {
        return client.post("/campaigns", data);
    },

    async updateCampaign(
        id: string,
        data: {
            name?: string;
            status?: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED";
        }
    ): Promise<ApiResponse<any>> {
        return client.put(`/campaigns/${id}`, data);
    },

    async deleteCampaign(id: string): Promise<ApiResponse<any>> {
        return client.delete(`/campaigns/${id}`);
    },

    async getCampaignMetrics(
        id: string
    ): Promise<
        ApiResponse<{
            audience: number;
            sent: number;
            opens: number;
            clicks: number;
            revenue: number;
        }>
    > {
        return client.get(`/campaigns/${id}/metrics`);
    },

    // Email templates
    async getCampaignEmailTemplates(): Promise<ApiResponse<any>> {
        return client.get("/campaigns/templates/email");
    },
    async createCampaignEmailTemplate(data: {
        name: string;
        type: string;
        subject: string;
        htmlContent: string;
        textContent?: string;
    }): Promise<ApiResponse<any>> {
        return client.post("/campaigns/templates/email", data);
    },
    async sendCampaignNow(
        id: string,
        payload: { templateId: string }
    ): Promise<ApiResponse<any>> {
        return client.post(`/campaigns/${id}/send`, payload);
    },
    async sendTestEmail(email: string): Promise<ApiResponse<any>> {
        return client.post("/email-templates/test", { email });
    },
    async createEmailTemplate(data: {
        name: string;
        type:
        | "ORDER_CONFIRMATION"
        | "SHIPPING_NOTIFICATION"
        | "WELCOME_EMAIL"
        | "LOW_INVENTORY_ALERT"
        | "ORDER_CANCELLED"
        | "PAYMENT_FAILED"
        | "PASSWORD_RESET"
        | "ACCOUNT_VERIFICATION"
        | "MARKETING_GENERIC";
        subject: string;
        contentType: "HTML_CONTENT" | "TEXT_CONTENT";
        htmlContent?: string;
        textContent?: string;
        backgroundImages?: string[];
        isActive?: boolean;
    }): Promise<ApiResponse<any>> {
        return client.post("/email-templates", data);
    },
    async getEmailTemplate(type: string): Promise<ApiResponse<any>> {
        return client.get(`/email-templates/${type}`);
    },

    // Storefront inquiries
    async sendInquiry(email: string): Promise<ApiResponse<{ message: string }>> {
        return client.post(`/inquiries`, { email });
    },

    // Contact Lab
    async contactLab(payload: {
        email: string;
        message: string;
    }): Promise<ApiResponse<{ message: string }>> {
        return client.post(`/contact-lab`, payload);
    },
});
