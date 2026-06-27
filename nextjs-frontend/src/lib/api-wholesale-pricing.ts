import { ApiClient } from "./api-client";

export interface WholesalePrice {
  id: string;
  name: string;
  strength: string;
  category: string;
  reg: number;
  m2: number;
  m5: number;
  m10: number;
  displayOrder: number;
  isActive: boolean;
}

// Admin management of the wholesale prices that power the public /pricing page.
export const createWholesalePricingMethods = (client: ApiClient) => ({
  wpList: () => client.get<WholesalePrice[]>("/wholesale-pricing"),
  wpCreate: (d: Partial<WholesalePrice>) => client.post("/wholesale-pricing", d),
  wpUpdate: (id: string, d: Partial<WholesalePrice>) =>
    client.patch(`/wholesale-pricing/${id}`, d),
  wpDelete: (id: string) => client.delete(`/wholesale-pricing/${id}`),
});
