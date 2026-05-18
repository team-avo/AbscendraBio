import { ApiClient } from "./api-client";
import { ApiResponse, User, Permission } from "./api-types";

export const createAuthMethods = (client: ApiClient) => ({
  async login(
    email: string,
    password: string,
    portal?: "CUSTOMER" | "ADMIN",
  ): Promise<ApiResponse<{ user: User; token: string }>> {
    return client.post("/auth/login", { email, password, portal });
  },

  async register(userData: {
    email: string;
    password: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    role?: string;
    mobile?: string; // required when role=CUSTOMER
    customerType?: "B2C" | "B2B" | "ENTERPRISE_1" | "ENTERPRISE_2";
    companyName?: string;
    licenseNumber?: string;
    city?: string;
    zip?: string;
  }): Promise<ApiResponse<{ user: User; token: string }>> {
    return client.post("/auth/register", userData);
  },

  async getProfile(): Promise<ApiResponse<User>> {
    return client.get("/auth/profile");
  },

  async updateProfile(userData: {
    firstName?: string;
    lastName?: string;
    email?: string;
  }): Promise<ApiResponse<User>> {
    return client.put("/auth/profile", userData);
  },

  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<ApiResponse> {
    return client.put("/auth/change-password", {
      currentPassword,
      newPassword,
    });
  },

  async logout(): Promise<ApiResponse> {
    return client.post("/auth/logout");
  },

  // OTP (mobile verification)
  async requestOtp(
    customerId: string,
    mobile?: string,
  ): Promise<ApiResponse<{ message: string }>> {
    return client.post(`/otp/request`, { customerId, mobile });
  },

  async verifyOtp(
    customerId: string,
    code: string,
  ): Promise<ApiResponse<{ message: string }>> {
    return client.post(`/otp/verify`, { customerId, code });
  },

  // Email verification endpoints
  async verifyEmail(token: string): Promise<ApiResponse> {
    return client.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
  },

  async resendVerification(email?: string): Promise<ApiResponse> {
    return client.post(`/auth/request-email-verification`, email ? { email } : {});
  },

  // Password reset flow
  async requestPasswordReset(
    email: string,
  ): Promise<ApiResponse<{ message: string }>> {
    return client.post(`/auth/password-reset/request`, { email });
  },

  async confirmPasswordReset(
    token: string,
    newPassword: string,
  ): Promise<ApiResponse<{ message: string }>> {
    return client.post(`/auth/password-reset/confirm`, { token, newPassword });
  },

  // Email OTP login
  async requestEmailOtp(
    email: string,
  ): Promise<ApiResponse<{ message: string }>> {
    return client.post(`/auth/email-otp/request`, { email });
  },

  async verifyEmailOtp(
    email: string,
    code: string,
    portal?: "CUSTOMER" | "ADMIN",
  ): Promise<ApiResponse<{ user: User; token: string }>> {
    return client.post(`/auth/email-otp/verify`, { email, code, portal });
  },

  // User management endpoints
  async getUserStats(): Promise<
    ApiResponse<{
      total: number;
      active: number;
      inactive: number;
      admins: number;
    }>
  > {
    return client.get("/users/stats");
  },

  async getUsers(params?: {
    page?: number;
    limit?: number;
    role?: string;
    isActive?: boolean;
    search?: string;
  }): Promise<
    ApiResponse<{
      users: User[];
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
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }
    return client.get(`/users?${searchParams.toString()}`);
  },

  async getUser(id: string): Promise<ApiResponse<User>> {
    return client.get(`/users/${id}`);
  },

  async createUser(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive?: boolean;
  }): Promise<ApiResponse<User>> {
    return client.post("/users", userData);
  },

  async updateUser(
    id: string,
    userData: {
      email?: string;
      firstName?: string;
      lastName?: string;
      role?: string;
      isActive?: boolean;
    },
  ): Promise<ApiResponse<User>> {
    return client.put(`/users/${id}`, userData);
  },

  async deactivateUser(id: string): Promise<ApiResponse> {
    return client.patch(`/users/${id}/deactivate`);
  },

  async deleteUser(id: string): Promise<ApiResponse> {
    return client.delete(`/users/${id}`);
  },

  async resetUserPassword(
    id: string,
    newPassword: string,
  ): Promise<ApiResponse> {
    return client.post(`/users/${id}/reset-password`, { newPassword });
  },

  async resetCustomerPassword(
    id: string,
    newPassword: string,
  ): Promise<ApiResponse> {
    return client.post(`/customers/${id}/reset-password`, { newPassword });
  },

  async updateUserPermissions(
    id: string,
    permissions: Permission[],
  ): Promise<ApiResponse<User>> {
    return client.put(`/users/${id}/permissions`, { permissions });
  },

  // Report a client-side login failure (fire-and-forget, unauthenticated)
  async reportLoginFailure(data: {
    email: string;
    portal: string;
    failureReason: string;
    failureDetail?: string;
    deviceInfo?: Record<string, unknown>;
  }): Promise<ApiResponse> {
    return client.post("/auth/login-event", data);
  },
});
