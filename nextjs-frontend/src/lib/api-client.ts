import { API_BASE_URL } from "./env";
import { ApiResponse } from "./api-types";
import logger from "./logger";

// Token management
export const TOKEN_KEY = "auth_token";

export const getToken = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token: string): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage full or blocked
  }
};

export const removeToken = (): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore
  }
};

// Utility functions for common operations
export const resolveImageUrl = (url?: string | null): string => {
  const fallback = "/peptide-vial-bpc157.png";
  if (!url) return fallback;
  if (/^https?:\/\//i.test(url)) return url;
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

// API client class
export class ApiClient {
  public baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  protected getHeaders(): HeadersInit {
    const token = getToken();
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  public async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseURL}${endpoint}`;
      const config: RequestInit = {
        headers: this.getHeaders(),
        cache: "no-store",
        credentials: "include",
        ...options,
      };

      // First request
      let response = await fetch(url, config);
      // If 304 (Not Modified), retry once with cache-busting to avoid empty body
      if (response.status === 304) {
        const sep = url.includes("?") ? "&" : "?";
        const bustUrl = `${url}${sep}_=${Date.now()}`;
        response = await fetch(bustUrl, config);
      }

      let data: any = null;
      try {
        data = await response.json();
      } catch (_) {
        data = null;
      }

      // Check for 401 Unauthorized first
      if (response.status === 401) {
        // Avoid infinite loops: don't retry if the failed request was the refresh endpoint itself
        if (endpoint === "/auth/refresh") {
          removeToken();
          return {
            success: false,
            error: data?.error || "Session expired",
          } as any;
        }

        // Check if it's an approval error from the backend - don't refresh for this
        if (
          data?.error &&
          (data.error.includes("pending for approval") ||
            data.error.includes("pending approval") ||
            data.error.includes("wait for approval") ||
            data.error.includes("verify your email"))
        ) {
          removeToken();
          return {
            success: false,
            error: data.error,
          } as any;
        }

        // Attempt to refresh token
        try {
          // Send current token via header for iOS Safari (which blocks cross-origin cookies)
          const currentToken = getToken();
          const refreshHeaders: Record<string, string> = {
            "Content-Type": "application/json",
          };
          if (currentToken) {
            refreshHeaders["Authorization"] = `Bearer ${currentToken}`;
          }
          const refreshResponse = await fetch(`${this.baseURL}/auth/refresh`, {
            method: "POST",
            headers: refreshHeaders,
            credentials: "include",
          });

          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json();
            if (refreshData.success && refreshData.data?.token) {
              // Update token
              setToken(refreshData.data.token);

              // Retry original request with new token
              const newHeaders = { ...this.getHeaders() } as any;
              // update auth header explicitly
              newHeaders["Authorization"] = `Bearer ${refreshData.data.token}`;

              const newConfig = {
                ...config,
                headers: newHeaders,
              };

              const retryResponse = await fetch(url, newConfig);
              let retryData: any = null;
              try {
                retryData = await retryResponse.json();
              } catch (_) {
                retryData = null;
              }

              if (retryResponse.ok) {
                return (retryData ?? { success: true }) as ApiResponse<T>;
              } else if (retryResponse.status === 401) {
                // If still 401 after refresh, then actual logout
                removeToken();
                return {
                  success: false,
                  error: retryData?.error || "Unauthorized",
                } as any;
              }
              // Return the retried response result (even if error)
              return {
                success: false,
                error:
                  (retryData && (retryData.error || retryData.message)) ||
                  retryResponse.statusText,
                data: retryData?.data,
              } as any;
            }
          }
        } catch (e) {
          // Refresh failed, proceed to logout
          logger.error("[API] Token refresh failed", { error: e });
        }

        removeToken();
        return { success: false, error: data?.error || "Unauthorized" } as any;
      }

      if (!response.ok) {
        return {
          success: false,
          error: (data && (data.error || data.message)) || response.statusText,
          data: data?.data ?? data,
        } as any;
      }

      return (data ?? { success: true }) as ApiResponse<T>;
    } catch (error: any) {
      logger.error("[API] Request failed", { error });
      return {
        success: false,
        error: error.message || "Request failed",
      } as any;
    }
  }

  // Add generic HTTP methods
  public async get<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  public async post<T = any>(
    endpoint: string,
    body?: any,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "POST",
      headers: { ...this.getHeaders(), "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public async postFormData<T = any>(
    endpoint: string,
    formData: FormData,
  ): Promise<ApiResponse<T>> {
    const headers = this.getHeaders();
    // Create new headers object without Content-Type for FormData
    const formDataHeaders: HeadersInit = {};

    if (typeof headers === "object" && headers !== null) {
      Object.entries(headers).forEach(([key, value]) => {
        if (key.toLowerCase() !== "content-type") {
          formDataHeaders[key] = value;
        }
      });
    }

    return this.request<T>(endpoint, {
      method: "POST",
      headers: formDataHeaders,
      body: formData,
    });
  }

  public async put<T = any>(
    endpoint: string,
    body?: any,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PUT",
      headers: { ...this.getHeaders(), "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public async patch<T = any>(
    endpoint: string,
    body?: any,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      headers: { ...this.getHeaders(), "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public async delete<T = any>(
    endpoint: string,
    body?: any,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "DELETE",
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}
