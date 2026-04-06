import { ApiClient } from "./api-client";
import { ApiResponse } from "./api-types";

export const createContentMethods = (client: ApiClient) => ({
  // ---------------------
  // Content management
  // ---------------------
  async getContentPages(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: "DRAFT" | "PUBLISHED" | "ARCHIVED" | "SCHEDULED";
    type?:
      | "STATIC_PAGE"
      | "BLOG_POST"
      | "LEGAL_PAGE"
      | "LANDING_PAGE"
      | "PRODUCT_PAGE"
      | "CUSTOM_PAGE";
  }): Promise<
    ApiResponse<{
      pages: Array<{
        id: string;
        title: string;
        slug: string;
        status: string;
        pageType: string;
        views: number;
        author?: { id: string; firstName: string; lastName: string } | null;
        createdAt: string;
        updatedAt: string;
        publishedAt?: string | null;
      }>;
      pagination: { page: number; limit: number; total: number; pages: number };
    }>
  > {
    const qs = new URLSearchParams();
    if (params?.page) qs.append("page", String(params.page));
    if (params?.limit) qs.append("limit", String(params.limit));
    if (params?.search) qs.append("search", params.search);
    if (params?.status) qs.append("status", params.status);
    if (params?.type) qs.append("type", params.type);
    const query = qs.toString();
    return client.get(`/content/pages${query ? `?${query}` : ""}`);
  },

  async getContentPage(id: string): Promise<ApiResponse<any>> {
    return client.get(`/content/pages/${id}`);
  },

  async getPublicPageBySlug(
    slug: string,
    opts?: { preview?: boolean },
  ): Promise<ApiResponse<any>> {
    const s = slug.replace(/^\//, "");
    const q = opts?.preview ? "?preview=1" : "";
    return client.get(`/public-pages/${encodeURIComponent(s)}${q}`);
  },

  async getPreviewPageBySlug(slug: string): Promise<ApiResponse<any>> {
    const s = slug.replace(/^\//, "");
    return client.get(`/content/preview/${encodeURIComponent(s)}`);
  },

  // Navigation APIs (admin)
  async getNavigationMenus(): Promise<ApiResponse<{ menus: any[] }>> {
    return client.get(`/content/menus`);
  },
  async createNavigationMenu(data: {
    name: string;
    location: string;
    isActive?: boolean;
  }) {
    return client.post(`/content/menus`, data);
  },
  async updateNavigationMenu(
    id: string,
    data: { name?: string; location?: string; isActive?: boolean },
  ) {
    return client.put(`/content/menus/${id}`, data);
  },
  async deleteNavigationMenu(id: string) {
    return client.delete(`/content/menus/${id}`);
  },
  async getNavigationItems(menuId: string) {
    return client.get(`/content/menus/${menuId}/items`);
  },
  async createNavigationItem(
    menuId: string,
    data: {
      title: string;
      url?: string;
      pageId?: string;
      target?: string;
      order?: number;
      isActive?: boolean;
      parentId?: string;
    },
  ) {
    return client.post(`/content/menus/${menuId}/items`, data);
  },
  async updateNavigationItem(
    menuId: string,
    itemId: string,
    data: {
      title?: string;
      url?: string;
      pageId?: string;
      target?: string;
      order?: number;
      isActive?: boolean;
      parentId?: string;
    },
  ) {
    return client.put(`/content/menus/${menuId}/items/${itemId}`, data);
  },
  async deleteNavigationItem(menuId: string, itemId: string) {
    return client.delete(`/content/menus/${menuId}/items/${itemId}`);
  },
  async reorderNavigationItems(
    menuId: string,
    orders: Array<{ id: string; order: number }>,
  ) {
    return client.patch(`/content/menus/${menuId}/items/reorder`, { orders });
  },

  // Public Navigation (no auth)
  async getPublicNavigationMenus(params?: {
    location?: "main" | "footer";
  }): Promise<ApiResponse<{ menus: any[] }>> {
    const qs = new URLSearchParams();
    if (params?.location) qs.append("location", params.location);
    const q = qs.toString();
    return client.get(`/public-pages/navigation/menus${q ? `?${q}` : ""}`);
  },
  async getPublicFooter(): Promise<ApiResponse<any>> {
    return client.get(`/public-content/footer`);
  },

  // Admin Footer Settings
  async getFooterSettings(): Promise<ApiResponse<any>> {
    return client.get(`/content/footer`);
  },
  async updateFooterSettings(data: {
    siteTitle: string;
    siteDescription: string;
    facebookUrl?: string;
    twitterUrl?: string;
    instagramUrl?: string;
    sections: Array<{
      title: string;
      order?: number;
      links: Array<{
        title: string;
        href: string;
        target?: string;
        order?: number;
      }>;
    }>;
    contact?: {
      title?: string;
      email?: string;
      phone?: string;
      address?: string;
    };
  }): Promise<ApiResponse<any>> {
    return client.put(`/content/footer`, data);
  },
  async getPublicNavigationItems(
    menuId: string,
  ): Promise<ApiResponse<{ items: any[] }>> {
    return client.get(`/public-pages/navigation/menus/${menuId}/items`);
  },

  // Media
  async getMediaFiles(params?: { page?: number; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.page) qs.append("page", String(params.page));
    if (params?.limit) qs.append("limit", String(params.limit));
    const q = qs.toString();
    return client.get(`/content/media${q ? `?${q}` : ""}`);
  },
  async createMediaRecord(data: {
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
    altText?: string;
    caption?: string;
    isPublic?: boolean;
    uploadedBy: string;
  }) {
    return client.post(`/content/media`, data);
  },
  async deleteMedia(id: string) {
    return client.delete(`/content/media/${id}`);
  },
  async updateMedia(
    id: string,
    data: { altText?: string; caption?: string; isPublic?: boolean },
  ) {
    return client.put(`/content/media/${id}`, data);
  },

  // Content dashboard stats
  async getContentStats() {
    return client.get(`/content/stats`);
  },

  // Site SEO settings
  async getSiteSeo() {
    return client.get(`/settings/seo`);
  },
  async updateSiteSeo(data: {
    siteName?: string;
    defaultTitle?: string;
    defaultDescription?: string;
    defaultKeywords?: string;
    defaultOgImageUrl?: string;
    allowIndexing?: boolean;
    googleAnalyticsId?: string;
    googleTagManagerId?: string;
    facebookPixelId?: string;
    additionalHeadTags?: string;
  }) {
    return client.put(`/settings/seo`, data);
  },

  // Content analytics (page views)
  async getPageAnalytics(params?: {
    rangeDays?: number;
    type?:
      | "ALL"
      | "STATIC_PAGE"
      | "BLOG_POST"
      | "LEGAL_PAGE"
      | "LANDING_PAGE"
      | "PRODUCT_PAGE"
      | "CUSTOM_PAGE";
  }) {
    const qs = new URLSearchParams();
    if (params?.rangeDays) qs.append("rangeDays", String(params.rangeDays));
    if (params?.type) qs.append("type", params.type);
    const q = qs.toString();
    return client.get(`/content/analytics/pages${q ? `?${q}` : ""}`);
  },
  async getPageAnalyticsById(id: string, params?: { rangeDays?: number }) {
    const qs = new URLSearchParams();
    if (params?.rangeDays) qs.append("rangeDays", String(params.rangeDays));
    const q = qs.toString();
    return client.get(`/content/analytics/pages/${id}${q ? `?${q}` : ""}`);
  },

  async createContentPage(data: {
    title: string;
    slug: string;
    excerpt?: string;
    content: string;
    contentFormat?: "HTML" | "MARKDOWN" | "RICH_TEXT";
    metaTitle?: string;
    metaDescription?: string;
    metaKeywords?: string;
    ogImage?: string;
    pageType?:
      | "STATIC_PAGE"
      | "BLOG_POST"
      | "LEGAL_PAGE"
      | "LANDING_PAGE"
      | "PRODUCT_PAGE"
      | "CUSTOM_PAGE";
    status?: "DRAFT" | "PUBLISHED" | "ARCHIVED" | "SCHEDULED";
    isPublic?: boolean;
    allowComments?: boolean;
    authorId: string;
    tagIds?: string[];
  }): Promise<ApiResponse<any>> {
    return client.post("/content/pages", data);
  },

  async updateContentPage(
    id: string,
    data: Partial<{
      title: string;
      slug: string;
      excerpt: string;
      content: string;
      contentFormat: "HTML" | "MARKDOWN" | "RICH_TEXT";
      metaTitle: string;
      metaDescription: string;
      metaKeywords: string;
      ogImage: string;
      pageType:
        | "STATIC_PAGE"
        | "BLOG_POST"
        | "LEGAL_PAGE"
        | "LANDING_PAGE"
        | "PRODUCT_PAGE"
        | "CUSTOM_PAGE";
      status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | "SCHEDULED";
      isPublic: boolean;
      allowComments: boolean;
      authorId: string;
      tagIds: string[];
    }>,
  ): Promise<ApiResponse<any>> {
    return client.put(`/content/pages/${id}`, data);
  },

  async deleteContentPage(id: string): Promise<ApiResponse<void>> {
    return client.delete(`/content/pages/${id}`);
  },

  // Google Places integration settings
  async getGooglePlacesConfig(): Promise<
    ApiResponse<{ enabled: boolean; apiKey: string | null }>
  > {
    return client.get(`/settings/integrations/google-places`);
  },
  async updateGooglePlacesConfig(data: {
    enabled: boolean;
    apiKey?: string | null;
  }): Promise<ApiResponse<{ enabled: boolean; apiKey: string | null }>> {
    return client.put(`/settings/integrations/google-places`, data);
  },
});
