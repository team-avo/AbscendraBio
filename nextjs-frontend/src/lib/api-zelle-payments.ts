import { ApiClient } from "./api-client";
import { ApiResponse } from "./api-types";

export type ZellePaymentStatus =
  | "UNMATCHED"
  | "MATCHED"
  | "CONFIRMED"
  | "MANUALLY_MATCHED"
  | "IGNORED";

export interface ZellePaymentOrder {
  id: string;
  orderNumber: string;
  totalAmount: string;
  status: string;
  selectedPaymentType?: string | null;
  billingFirstName?: string | null;
  billingLastName?: string | null;
  billingAddress1?: string | null;
  billingCity?: string | null;
  billingState?: string | null;
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  payments?: Array<{
    id: string;
    paymentMethod: string;
    status: string;
    amount: string;
    paidAt: string | null;
  }>;
}

export interface ZellePayment {
  id: string;
  gmailMessageId: string;
  gmailThreadId: string | null;
  rawSubject: string;
  receivedAt: string;
  parsedAmount: string;
  parsedSenderName: string;
  parsedMemo: string | null;
  status: ZellePaymentStatus;
  matchConfidence: string | null; // "HIGH" | "LOW" | "MANUAL" | null
  orderId: string | null;
  order: ZellePaymentOrder | null;
  confirmedById: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// The list endpoint returns extra top-level fields alongside the standard ApiResponse shape.
// We use a broader return type and cast in the page component.
export type ZelleListApiResponse = ApiResponse<ZellePayment[]> & {
  pendingReviewCount?: number;
};

export const createZellePaymentMethods = (client: ApiClient) => ({
  listZellePayments(params?: {
    status?: ZellePaymentStatus;
    page?: number;
    limit?: number;
  }): Promise<ZelleListApiResponse> {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    return client.get<ZellePayment[]>(`/zelle-payments?${qs.toString()}`);
  },

  getZellePayment(id: string): Promise<ApiResponse<ZellePayment>> {
    return client.get<ZellePayment>(`/zelle-payments/${id}`);
  },

  confirmZellePayment(id: string): Promise<ApiResponse<ZellePayment>> {
    return client.post<ZellePayment>(`/zelle-payments/${id}/confirm`, {});
  },

  linkZellePaymentToOrder(id: string, orderId: string): Promise<ApiResponse<ZellePayment>> {
    return client.post<ZellePayment>(`/zelle-payments/${id}/link`, { orderId });
  },

  ignoreZellePayment(id: string): Promise<ApiResponse<ZellePayment>> {
    return client.post<ZellePayment>(`/zelle-payments/${id}/ignore`, {});
  },

  unignoreZellePayment(id: string): Promise<ApiResponse<ZellePayment>> {
    return client.post<ZellePayment>(`/zelle-payments/${id}/unignore`, {});
  },
});
