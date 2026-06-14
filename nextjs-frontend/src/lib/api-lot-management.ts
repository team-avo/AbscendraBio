import { ApiClient } from "./api-client";

const qs = (params?: Record<string, any>) => {
  if (!params) return "";
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") sp.append(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
};

export const createLotManagementMethods = (client: ApiClient) => ({
  // Registries
  lmGetCompanies: () => client.get<any[]>("/lot-management/companies"),
  lmGetPeptides: (activeOnly = true) =>
    client.get<any[]>(`/lot-management/peptides${activeOnly ? "?activeOnly=true" : ""}`),
  lmGetPeptide: (id: string) => client.get<any>(`/lot-management/peptides/${id}`),
  lmCreatePeptide: (d: any) => client.post("/lot-management/peptides", d),
  lmUpdatePeptide: (id: string, d: any) => client.patch(`/lot-management/peptides/${id}`, d),
  lmGetSuppliers: () => client.get<any[]>("/lot-management/suppliers"),
  lmCreateSupplier: (d: any) => client.post("/lot-management/suppliers", d),
  lmUpdateSupplier: (id: string, d: any) => client.patch(`/lot-management/suppliers/${id}`, d),
  lmGetLabs: () => client.get<any[]>("/lot-management/labs"),
  lmCreateLab: (d: any) => client.post("/lot-management/labs", d),
  lmUpdateLab: (id: string, d: any) => client.patch(`/lot-management/labs/${id}`, d),
  lmGetServices: () => client.get<any[]>("/lot-management/services"),
  lmCreateService: (d: any) => client.post("/lot-management/services", d),
  lmUpdateService: (id: string, d: any) => client.patch(`/lot-management/services/${id}`, d),
  lmGetPatterns: () => client.get<any[]>("/lot-management/patterns"),

  // Lots
  lmGetLots: (params?: any) => client.get<any>(`/lot-management/lots${qs(params)}`),
  lmGetLot: (id: string) => client.get<any>(`/lot-management/lots/${id}`),
  lmPreviewLot: (d: any) => client.post<any>("/lot-management/lots/preview", d),
  lmCreateLot: (d: any) => client.post<any>("/lot-management/lots", d),
  lmUpdateLot: (id: string, d: any) => client.patch(`/lot-management/lots/${id}`, d),

  // COAs
  lmGetCoas: (params?: any) => client.get<any>(`/lot-management/coas${qs(params)}`),
  lmGetCoa: (id: string) => client.get<any>(`/lot-management/coas/${id}`),
  lmCreateCoa: (d: any) => client.post<any>("/lot-management/coas", d),
  lmUpdateCoaResults: (id: string, d: any) => client.patch(`/lot-management/coas/${id}/results`, d),
  lmApproveCoa: (id: string) => client.post(`/lot-management/coas/${id}/approve`, {}),
  lmShareCoa: (id: string, companyId: string) => client.post(`/lot-management/coas/${id}/share`, { companyId }),
  lmUnshareCoa: (id: string, companyId: string) => client.delete(`/lot-management/coas/${id}/share/${companyId}`),
  lmUploadCoaFile: (id: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return client.postFormData(`/lot-management/coas/${id}/file`, fd);
  },
  lmLabelPdfUrl: (coaId: string, templateId?: string) =>
    `/lot-management/coas/${coaId}/label${templateId ? `?templateId=${templateId}` : ""}`,

  // Label templates
  lmGetLabelTemplates: (params?: any) => client.get<any[]>(`/lot-management/label-templates${qs(params)}`),
  lmCreateLabelTemplate: (d: any) => client.post("/lot-management/label-templates", d),
  lmUpdateLabelTemplate: (id: string, d: any) => client.patch(`/lot-management/label-templates/${id}`, d),
  lmUploadArtwork: (file: File) => {
    const fd = new FormData();
    fd.append("image", file);
    return client.postFormData("/lot-management/label-templates/artwork", fd);
  },

  // Dashboard
  lmGetDashboard: (companyId?: string) =>
    client.get<any>(`/lot-management/dashboard${companyId ? `?companyId=${companyId}` : ""}`),
});
