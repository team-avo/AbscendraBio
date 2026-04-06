import { ApiClient } from "./api-client";
import { ApiResponse, Comment, CommentType, PaginatedData } from "./api-types";

export const createCommentMethods = (client: ApiClient) => ({
    async getComments(params?: {
        type?: CommentType;
        orderId?: string;
        customerId?: string;
        search?: string;
        page?: number;
        limit?: number;
        includeOrderComments?: boolean;
    }): Promise<ApiResponse<PaginatedData<Comment>>> {
        const searchParams = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    searchParams.append(key, value.toString());
                }
            });
        }

        const response = await client.get<{
            comments: Comment[];
            pagination: {
                page: number;
                limit: number;
                total: number;
                pages: number;
            };
        }>(`/comments?${searchParams.toString()}`);

        if (response.success && response.data) {
            return {
                success: true,
                data: {
                    items: response.data.comments,
                    pagination: response.data.pagination,
                },
            } as ApiResponse<PaginatedData<Comment>>;
        }

        return response as ApiResponse<PaginatedData<Comment>>;
    },

    async getCommentCounts(params: { orderIds?: string[]; customerIds?: string[] }): Promise<ApiResponse<{
        orders: Record<string, number>;
        customers: Record<string, number>;
    }>> {
        const { orderIds = [], customerIds = [] } = params;
        if (orderIds.length === 0 && customerIds.length === 0) {
            return { success: true, data: { orders: {}, customers: {} } };
        }
        const queryParams = new URLSearchParams();
        if (orderIds.length > 0) queryParams.append("orderIds", orderIds.join(","));
        if (customerIds.length > 0) queryParams.append("customerIds", customerIds.join(","));

        return client.get(`/comments/counts?${queryParams.toString()}`);
    },

    async createComment(data: {
        type: CommentType;
        content: string;
        orderId?: string;
        customerId?: string;
        images?: string[];
    }): Promise<ApiResponse<Comment>> {
        return client.post("/comments", data);
    },

    async replyToComment(id: string, content: string, images?: string[]): Promise<ApiResponse<Comment>> {
        return client.post(`/comments/${id}/reply`, { content, images });
    },

    async updateComment(id: string, content: string, images?: string[]): Promise<ApiResponse<Comment>> {
        return client.patch(`/comments/${id}`, { content, images });
    },

    async uploadCommentImages(files: File[]): Promise<ApiResponse<string[]>> {
        const formData = new FormData();
        files.forEach((file) => formData.append("images", file));

        const response = await client.postFormData<{
            success: boolean;
            urls: string[];
        }>("/comments/upload", formData);

        if (response.success && response.data) {
            return {
                success: true,
                data: response.data.urls,
            };
        }

        return response as any;
    },

    async deleteComment(id: string): Promise<ApiResponse<void>> {
        return client.delete(`/comments/${id}`);
    },
});
