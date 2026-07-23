import { api } from "./api";
import type { User, Alert, PaginatedResult, CreateAlertData, RegisterData } from "@/types";

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
  uploadMedia: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("image", file);
    const res = await api.post("/v1/media/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
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
