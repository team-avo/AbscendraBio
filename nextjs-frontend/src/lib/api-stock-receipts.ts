import { ApiClient } from "./api-client";
import { ApiResponse } from "./api-types";

export type PendingReceiptStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "PARTIAL";

export type LineMatchStatus =
  | "UNMATCHED"
  | "AUTO_MATCHED"
  | "MANUAL_MATCHED"
  | "REJECTED";

export interface SupplierEmailSource {
  id: string;
  name: string;
  senderEmail: string;
  parserKey: string;
  defaultLocationId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  location?: { id: string; name: string } | null;
  _count?: { receipts: number; mappings: number };
}

export interface SupplierProductMapping {
  id: string;
  supplierSourceId: string;
  supplierProductName: string;
  variantId: string;
  quantityMultiplier: number;
  createdAt: string;
  variant?: {
    id: string;
    sku: string;
    name: string;
    product: { name: string };
  };
}

export interface StockReceiptListItem {
  id: string;
  orderNumber: string | null;
  rawSubject: string;
  receivedAt: string;
  status: PendingReceiptStatus;
  source: { id: string; name: string; senderEmail: string };
  lineCount: number;
  matchedCount: number;
  processedAt: string | null;
}

export interface StockReceiptLine {
  id: string;
  receiptId: string;
  supplierProductName: string;
  parsedQuantity: number;
  matchedVariantId: string | null;
  effectiveQuantity: number | null;
  matchStatus: LineMatchStatus;
  appliedMovementId: string | null;
  variant?: {
    id: string;
    sku: string;
    name: string;
    product: { id: string; name: string };
  } | null;
}

export interface StockReceiptDetail {
  id: string;
  supplierSourceId: string;
  gmailMessageId: string;
  gmailThreadId: string | null;
  orderNumber: string | null;
  rawSubject: string;
  rawHtml: string;
  receivedAt: string;
  status: PendingReceiptStatus;
  processedAt: string | null;
  source: SupplierEmailSource & { location: { id: string; name: string } };
  processedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  lines: StockReceiptLine[];
}

export interface StockReceiptListResponse {
  data: StockReceiptListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  pendingCount: number;
}

export const createStockReceiptMethods = (client: ApiClient) => ({
  async listStockReceipts(params?: {
    status?: PendingReceiptStatus;
    supplierSourceId?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<StockReceiptListItem[]> & { pendingCount?: number; pagination?: any }> {
    const qs = new URLSearchParams();
    if (params?.status) qs.append("status", params.status);
    if (params?.supplierSourceId) qs.append("supplierSourceId", params.supplierSourceId);
    if (params?.page) qs.append("page", String(params.page));
    if (params?.limit) qs.append("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return client.get(`/stock-receipts${suffix}`);
  },

  async getStockReceipt(id: string): Promise<ApiResponse<StockReceiptDetail>> {
    return client.get(`/stock-receipts/${id}`);
  },

  async mapStockReceiptLine(
    receiptId: string,
    lineId: string,
    payload: {
      variantId: string;
      quantityMultiplier?: number;
      rememberMapping?: boolean;
    },
  ): Promise<ApiResponse<StockReceiptLine>> {
    return client.patch(`/stock-receipts/${receiptId}/lines/${lineId}`, payload);
  },

  async unlinkStockReceiptLine(
    receiptId: string,
    lineId: string,
  ): Promise<ApiResponse<StockReceiptLine>> {
    return client.patch(`/stock-receipts/${receiptId}/lines/${lineId}/unlink`, {});
  },

  async approveStockReceipt(
    id: string,
  ): Promise<
    ApiResponse<{
      status: PendingReceiptStatus;
      appliedLines: number;
      movements: string[];
    }>
  > {
    return client.post(`/stock-receipts/${id}/approve`, {});
  },

  async rejectStockReceipt(id: string): Promise<ApiResponse<any>> {
    return client.post(`/stock-receipts/${id}/reject`, {});
  },

  async listSupplierSources(): Promise<ApiResponse<SupplierEmailSource[]>> {
    return client.get(`/stock-receipts/suppliers`);
  },

  async listSupplierParserKeys(): Promise<ApiResponse<string[]>> {
    return client.get(`/stock-receipts/parsers`);
  },

  async createSupplierSource(payload: {
    name: string;
    senderEmail: string;
    parserKey: string;
    defaultLocationId: string;
    active?: boolean;
  }): Promise<ApiResponse<SupplierEmailSource>> {
    return client.post(`/stock-receipts/suppliers`, payload);
  },

  async updateSupplierSource(
    id: string,
    payload: Partial<{
      name: string;
      senderEmail: string;
      parserKey: string;
      defaultLocationId: string;
      active: boolean;
    }>,
  ): Promise<ApiResponse<SupplierEmailSource>> {
    return client.patch(`/stock-receipts/suppliers/${id}`, payload);
  },

  async deleteSupplierSource(id: string): Promise<ApiResponse<any>> {
    return client.delete(`/stock-receipts/suppliers/${id}`);
  },

  async listSupplierMappings(
    supplierSourceId: string,
  ): Promise<ApiResponse<SupplierProductMapping[]>> {
    return client.get(`/stock-receipts/suppliers/${supplierSourceId}/mappings`);
  },

  async deleteSupplierMapping(id: string): Promise<ApiResponse<any>> {
    return client.delete(`/stock-receipts/mappings/${id}`);
  },
});
