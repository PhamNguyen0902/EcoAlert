import { api } from "./api";
import type {
  Alert,
  Category,
  CreateAlertData,
  PaginatedResult,
  RegisterData,
  ResolutionInput,
  User,
} from "@/types";

export const authService = {
  login: async (data: { email: string; password: string }) => {
    const res = await api.post("/v1/auth/login", data);
    return res.data;
  },
  register: async (data: RegisterData) => {
    const res = await api.post("/v1/auth/register", data);
    return res.data;
  },
  logout: async (refreshToken?: string) => {
    const res = await api.post("/v1/auth/logout", { refreshToken });
    return res.data;
  },
};

export const alertService = {
  getAlerts: async (
    page = 1,
    limit = 10,
    filters: Record<string, string> = {},
  ): Promise<PaginatedResult<Alert>> => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...filters,
    });
    const res = await api.get(`/v1/alerts?${params}`);
    return res.data.data;
  },
  getAlert: async (id: string): Promise<Alert> => {
    const res = await api.get(`/v1/alerts/${id}`);
    return res.data.data;
  },
  getOfficerTasks: async (
    page = 1,
    limit = 10,
    status?: string,
  ): Promise<PaginatedResult<Alert>> => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) params.set('status', status);
    const res = await api.get(`/v1/alerts/officer/tasks?${params}`);
    return res.data.data;
  },
  assignOfficer: async (id: string, officerId: string): Promise<Alert> => {
    const res = await api.post(`/v1/alerts/${id}/assign`, { officerId });
    return res.data.data;
  },
  startHandling: async (id: string): Promise<Alert> => {
    const res = await api.post(`/v1/alerts/${id}/start`);
    return res.data.data;
  },
  confirmArrival: async (
    id: string,
    location: { latitude?: number; longitude?: number; accuracy?: number } = {},
  ): Promise<Alert> => {
    const res = await api.post(`/v1/alerts/${id}/arrival`, location);
    return res.data.data;
  },
  resolveIncident: async (id: string, data: ResolutionInput): Promise<Alert> => {
    const res = await api.post(`/v1/alerts/${id}/resolution`, data);
    return res.data.data;
  },
  closeIncident: async (id: string, reviewNote?: string): Promise<Alert> => {
    const res = await api.post(`/v1/alerts/${id}/close`, { reviewNote });
    return res.data.data;
  },
  createAlert: async (data: CreateAlertData) => {
    const res = await api.post("/v1/alerts", data);
    return res.data.data;
  },
  updateStatus: async (id: string, status: string) => {
    const res = await api.patch(`/v1/alerts/${id}/status`, { status });
    return res.data.data;
  },
  deleteAlert: async (id: string) => {
    const res = await api.delete(`/v1/alerts/${id}`);
    return res.data.data;
  },
  uploadMedia: async (file: File, onProgress?: (percentage: number) => void): Promise<string> => {
    const formData = new FormData();
    formData.append("image", file);
    const res = await api.post("/v1/media/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event) => {
        if (event.total && onProgress) onProgress(Math.round((event.loaded / event.total) * 100));
      },
    });
    return res.data.data.url;
  },
  updateAlert: async (id: string, data: Partial<CreateAlertData>) => {
    const res = await api.patch(`/v1/alerts/${id}`, data);
    return res.data.data;
  },
  addOfficerNote: async (id: string, note: string) => {
    const res = await api.post(`/v1/alerts/${id}/note`, { note });
    return res.data.data;
  },
  restoreAlert: async (id: string) => {
    const res = await api.patch(`/v1/alerts/${id}/restore`);
    return res.data.data;
  },
};

export const notificationService = {
  getNotifications: async (page = 1, limit = 20) => {
    const res = await api.get(`/v1/notifications?page=${page}&limit=${limit}`);
    return res.data.data;
  },
  getUnreadCount: async (): Promise<number> => {
    const res = await api.get("/v1/notifications/unread-count");
    return res.data.data.count;
  },
  markAsRead: async (id: string) => {
    const res = await api.patch(`/v1/notifications/${id}/read`);
    return res.data.data;
  },
  markAllAsRead: async () => {
    const res = await api.patch("/v1/notifications/mark-all-read");
    return res.data.data;
  },
  deleteNotification: async (id: string) => {
    const res = await api.delete(`/v1/notifications/${id}`);
    return res.data.data;
  },
};

export const userService = {
  getProfile: async (): Promise<User> => {
    const res = await api.get("/v1/users/profile");
    return res.data.data;
  },
  updateProfile: async (
    data: Partial<Pick<User, "fullName" | "phone" | "avatar">>,
  ) => {
    const res = await api.patch("/v1/users/profile", data);
    return res.data.data;
  },
  changePassword: async (data: {
    oldPassword: string;
    newPassword: string;
  }) => {
    const res = await api.patch("/v1/users/change-password", data);
    return res.data.data;
  },
  getUsers: async (page = 1, limit = 10, role?: string, search?: string): Promise<PaginatedResult<User>> => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (role && role !== 'all') params.append('role', role);
    if (search) params.append('search', search);
    const res = await api.get(`/v1/users?${params}`);
    return res.data.data;
  },
  getUserById: async (id: string): Promise<User> => {
    const res = await api.get(`/v1/users/${id}`);
    return res.data.data;
  },
  changeRole: async (id: string, role: string) => {
    const res = await api.patch(`/v1/users/${id}/role`, { role });
    return res.data.data;
  },
  toggleStatus: async (id: string, isActive: boolean) => {
    const res = await api.patch(`/v1/users/${id}/status`, { isActive });
    return res.data.data;
  },
  deleteUser: async (id: string) => {
    const res = await api.delete(`/v1/users/${id}`);
    return res.data.data;
  },
  createUser: async (data: { email: string; password?: string; fullName: string; phone?: string; role?: string }) => {
    const res = await api.post('/v1/users', data);
    return res.data.data;
  },
  getAuditLogs: async (page = 1, limit = 20, search?: string) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.append('search', search);
    const res = await api.get(`/v1/users/audit-logs?${params}`);
    return res.data.data;
  },
};

export const gisService = {
  getNearby: async (lng: number, lat: number, maxDistance = 5000) => {
    const res = await api.get(
      `/v1/gis/nearby?lng=${lng}&lat=${lat}&maxDistance=${maxDistance}`,
    );
    return res.data.data;
  },
  getRadius: async (lng: number, lat: number, radius = 5) => {
    const res = await api.get(
      `/v1/gis/radius?lng=${lng}&lat=${lat}&radius=${radius}`,
    );
    return res.data.data;
  },
};

export const categoryService = {
  getCategories: async (includeInactive = false) => {
    const res = await api.get(`/v1/alerts/categories?includeInactive=${includeInactive}`);
    return res.data.data;
  },
  createCategory: async (data: Partial<Category>) => {
    const res = await api.post('/v1/alerts/categories', data);
    return res.data.data;
  },
  updateCategory: async (id: string, data: Partial<Category>) => {
    const res = await api.patch(`/v1/alerts/categories/${id}`, data);
    return res.data.data;
  },
  deleteCategory: async (id: string) => {
    const res = await api.delete(`/v1/alerts/categories/${id}`);
    return res.data.data;
  },
};

