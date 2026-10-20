import { api } from "./client";
import { Alert, PaginatedResult, CreateAlertData, Category, ResolutionInput, PreSubmitSemanticResult, PreSubmitVisionResult } from "../types";

const postMediaUpload = async (fileUri: string, fileName: string, fileType: string, idempotencyKey?: string): Promise<{ url?: string; ownershipProof?: string }> => {
  const formData = new FormData();
  formData.append("image", { uri: fileUri, name: fileName, type: fileType } as unknown as Blob);
  if (idempotencyKey) formData.append("idempotencyKey", idempotencyKey);
  const res = await api.post("/v1/media/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
  return res.data?.data || res.data;
};

export const alertService = {
  // Paginate only when necessary: counts/map cover all authorized tasks.
  getAllOfficerTasks: async (): Promise<PaginatedResult<Alert>> => {
    const first = await alertService.getOfficerTasks(1, 100);
    const items = [...first.items];
    for (let page = 2; items.length < first.total; page++) {
      const next = await alertService.getOfficerTasks(page, 100);
      if (!next.items.length) break;
      items.push(...next.items);
    }
    return { ...first, items: Array.from(new Map(items.map(item => [item._id, item])).values()) };
  },
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

  uploadFieldMedia: async (fileUri: string, fileName = "photo.jpg", fileType = "image/jpeg", idempotencyKey?: string): Promise<{ url: string; ownershipProof: string }> => {
    const payload = await postMediaUpload(fileUri, fileName, fileType, idempotencyKey);
    if (!payload?.url || !/^https?:\/\//i.test(payload.url)) throw new Error("INVALID_UPLOAD_RESPONSE");
    if (!payload?.ownershipProof) throw new Error("MEDIA_OWNERSHIP_PROOF_MISSING");
    return { url: payload.url, ownershipProof: payload.ownershipProof };
  },

  uploadMedia: async (fileUri: string, fileName = "photo.jpg", fileType = "image/jpeg"): Promise<string> =>
    (await postMediaUpload(fileUri, fileName, fileType)).url || "",

  analyzeUploadedImage: async (imageUrl: string): Promise<PreSubmitVisionResult> => {
    const res = await api.post("/v1/media/analyze-url", { imageUrl }, { timeout: 60_000 });
    const payload = res.data?.data || res.data;
    const vision = payload?.aiAnalysis;
    if (!vision || !["ok", "no_detection", "error"].includes(vision.status) || !Array.isArray(vision.detections)
      || typeof vision.requiresManualReview !== "boolean"
      || vision.detections.some((item: PreSubmitVisionResult["detections"][number]) =>
        typeof item.materialClass !== "string" || !item.materialClass.trim()
        || !Number.isFinite(item.confidence) || item.confidence < 0 || item.confidence > 1
        || !Array.isArray(item.bbox) || item.bbox.length !== 4 || !item.bbox.every(Number.isFinite)
        || item.bbox[2] < item.bbox[0] || item.bbox[3] < item.bbox[1])) throw new Error("INVALID_VISION_RESPONSE");
    if (vision.status === "no_detection" && vision.detections.length) throw new Error("INVALID_VISION_RESPONSE");
    if (vision.status === "error") throw Object.assign(new Error("VISION_UNAVAILABLE"), { code: vision.errorCode || "VISION_UNAVAILABLE" });
    return { ...vision, imageUrl: payload.imageUrl || imageUrl };
  },

  validateImageSemantics: async (
    imageUrl: string,
    input: { title?: string; description?: string } = {},
  ): Promise<PreSubmitSemanticResult> => {
    const res = await api.post("/v1/ai/validate-image", {
      imageUrl,
      title: input.title || "Báo cáo rác hiện trường",
      description: input.description || "Ảnh được chụp trực tiếp trong luồng báo cáo rác EcoAlert.",
    }, { timeout: 60_000 });
    if (res.data?.success === false) throw new Error("INVALID_SEMANTIC_RESPONSE");
    return res.data?.data || res.data;
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


