import { api } from "./client";
import { Alert, PaginatedResult, CreateAlertData, Category, ResolutionInput } from "../types";

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

  getOfficerTasks: async (
    page = 1,
    limit = 20,
    status?: string
  ): Promise<PaginatedResult<Alert>> => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) params.set("status", status);
    const res = await api.get(`/v1/alerts/officer/tasks?${params.toString()}`);
    return res.data?.data || res.data;
  },

  createAlert: async (data: CreateAlertData): Promise<Alert> => {
    const res = await api.post("/v1/alerts", data);
    return res.data?.data || res.data;
  },

  updateAlert: async (id: string, data: Partial<CreateAlertData>): Promise<Alert> => {
    const res = await api.patch(`/v1/alerts/${id}`, data);
    return res.data?.data || res.data;
  },

  deleteAlert: async (id: string): Promise<Alert> => {
    const res = await api.delete(`/v1/alerts/${id}`);
    return res.data?.data || res.data;
  },

  restoreAlert: async (id: string): Promise<Alert> => {
    const res = await api.patch(`/v1/alerts/${id}/restore`);
    return res.data?.data || res.data;
  },

  startHandling: async (id: string): Promise<Alert> => {
    const res = await api.post(`/v1/alerts/${id}/start`);
    return res.data?.data || res.data;
  },

  confirmArrival: async (
    id: string,
    location: { latitude: number; longitude: number; accuracyMeters: number }
  ): Promise<Alert> => {
    const res = await api.post(`/v1/alerts/${id}/arrival`, location);
    return res.data?.data || res.data;
  },

  resolveIncident: async (id: string, data: ResolutionInput): Promise<Alert> => {
    const res = await api.post(`/v1/alerts/${id}/resolution`, data);
    return res.data?.data || res.data;
  },

  closeIncident: async (id: string, reviewNote?: string): Promise<Alert> => {
    const res = await api.post(`/v1/alerts/${id}/close`, { reviewNote });
    return res.data?.data || res.data;
  },
  validateImage: async (imageUrl: string) => {
    const res = await api.post('/v1/ai/validate-image', { imageUrl });
    return res.data?.data || res.data;
  },
  reviewClassification: async (id: string, category?: string): Promise<Alert> => {
    const res = await api.post(`/v1/alerts/${id}/classification/review`, { category });
    return res.data?.data || res.data;
  },
  getCurrentShift: async () => {
    const res = await api.get('/v1/alerts/officer/shifts/current');
    return res.data?.data || res.data;
  },
  getShiftHistory: async () => {
    const res = await api.get('/v1/alerts/officer/shifts/history');
    return res.data?.data || res.data;
  },
  startShift: async (location: { latitude: number; longitude: number; accuracyMeters: number }) => {
    const res = await api.post('/v1/alerts/officer/shifts/start', location);
    return res.data?.data || res.data;
  },
  endShift: async (location: { latitude: number; longitude: number; accuracyMeters: number }) => {
    const res = await api.post('/v1/alerts/officer/shifts/end', location);
    return res.data?.data || res.data;
  },

  uploadMedia: async (fileUri: string, fileName = "photo.jpg", fileType = "image/jpeg"): Promise<string> => {
    const formData = new FormData();
    formData.append("image", {
      uri: fileUri,
      name: fileName,
      type: fileType,
    } as unknown as Blob);

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

  checkNearbyAlerts: async (lat: number, lng: number, radius = 200): Promise<Alert[]> => {
    const res = await api.get(`/v1/alerts/nearby-check?lat=${lat}&lng=${lng}&radius=${radius}`);
    return res.data?.data || res.data || [];
  },

  confirmAlert: async (id: string): Promise<Alert> => {
    const res = await api.post(`/v1/alerts/${id}/confirm`);
    return res.data?.data || res.data;
  },

};


