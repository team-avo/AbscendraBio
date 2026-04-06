import { ApiClient } from "./api-client";
import { ApiResponse, Location } from "./api-types";

export const createLocationMethods = (client: ApiClient) => ({
    // Inventory Locations
    async getLocations(): Promise<ApiResponse<Location[]>> {
        return client.get("/locations");
    },

    async createLocation(data: { name: string; address?: string }) {
        return client.post("/locations", data);
    },

    async updateLocation(
        id: string,
        data: { name?: string; address?: string; isActive?: boolean }
    ) {
        return client.put(`/locations/${id}`, data);
    },

    async deleteLocation(id: string) {
        return client.delete(`/locations/${id}`);
    },

    // Custom Location Management
    async getCustomCountries(): Promise<ApiResponse<string[]>> {
        return client.get('/locations/custom/countries');
    },

    async getCustomStates(country: string): Promise<ApiResponse<string[]>> {
        return client.get(`/locations/custom/states?country=${encodeURIComponent(country)}`);
    },

    async getCustomCities(country: string, state?: string): Promise<ApiResponse<string[]>> {
        const params = new URLSearchParams({ country });
        if (state) params.append('state', state);
        return client.get(`/locations/custom/cities?${params.toString()}`);
    },

    async getCustomLocations(params?: {
        page?: number;
        limit?: number;
        search?: string;
        country?: string;
        state?: string;
        isActive?: boolean;
    }): Promise<ApiResponse<any>> {
        const queryParams = new URLSearchParams();
        if (params?.page) queryParams.append('page', params.page.toString());
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        if (params?.search) queryParams.append('search', params.search);
        if (params?.country) queryParams.append('country', params.country);
        if (params?.state) queryParams.append('state', params.state);
        if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());

        const qs = queryParams.toString();
        return client.get(`/locations/custom${qs ? `?${qs}` : ''}`);
    },

    async createCustomLocation(data: {
        country: string;
        state?: string | null;
        city?: string | null;
        isActive?: boolean;
    }): Promise<ApiResponse<any>> {
        return client.post('/locations/custom', data);
    },

    async updateCustomLocation(
        id: string,
        data: {
            country?: string;
            state?: string | null;
            city?: string | null;
            isActive?: boolean;
        }
    ): Promise<ApiResponse<any>> {
        return client.put(`/locations/custom/${id}`, data);
    },

    async deleteCustomLocation(id: string): Promise<ApiResponse<any>> {
        return client.delete(`/locations/custom/${id}`);
    },

    async bulkDeleteCustomLocations(ids: string[]): Promise<ApiResponse<{ count: number }>> {
        return client.post('/locations/custom/bulk-delete', { ids });
    },
});
