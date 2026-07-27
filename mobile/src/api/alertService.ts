import { api } from "./client";
import { Alert, PaginatedResult, CreateAlertData, Category } from "../types";

export const alertService = {
  getAlerts: async (
    page = 1,
    limit = 20,
    filters: Record<string, string> = {}
  ): Promise<PaginatedResult<Alert>> => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...filters,
    });
    const res = await api.get(`/v1/alerts?${params.toString()}`);
    return res.data?.data || res.data;
  },

  getAlert: async (id: string): Promise<Alert> => {
    const res = await api.get(`/v1/alerts/${id}`);
    return res.data?.data || res.data;
  },

  createAlert: async (data: CreateAlertData): Promise<Alert> => {
    const res = await api.post("/v1/alerts", data);
    return res.data?.data || res.data;
  },

  uploadMedia: async (fileUri: string, fileName = "photo.jpg", fileType = "image/jpeg"): Promise<string> => {
    const formData = new FormData();
    formData.append("image", {
      uri: fileUri,
      name: fileName,
      type: fileType,
    } as any);

    const res = await api.post("/v1/media/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data?.data?.url || res.data?.url;
  },

  getCategories: async (includeInactive = false): Promise<Category[]> => {
    const res = await api.get(`/v1/alerts/categories?includeInactive=${includeInactive}`);
    return res.data?.data || res.data || [];
  },

  updateAlertStatus: async (id: string, status: string, officerNote?: string): Promise<Alert> => {
    const res = await api.patch(`/v1/alerts/${id}/status`, { status, officerNote });
    return res.data?.data || res.data;
  },

  addOfficerNote: async (id: string, note: string): Promise<Alert> => {
    const res = await api.post(`/v1/alerts/${id}/note`, { note });
    return res.data?.data || res.data;
  },

  assignOfficer: async (id: string, officerId: string): Promise<Alert> => {
    const res = await api.post(`/v1/alerts/${id}/assign`, { officerId });
    return res.data?.data || res.data;
  },
};

