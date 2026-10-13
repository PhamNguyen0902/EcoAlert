import { api } from "./client";
import type { PaginatedResult } from "../types";
import type { NotificationItem } from "../types/notification";

const endpoint = "/v1/notifications"; // API_BASE_URL already includes /api.
export const notificationService = {
  getNotifications: async (
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<NotificationItem>> => {
    const res = await api.get(endpoint, { params: { page, limit } });
    return res.data?.data ?? res.data;
  },
  getUnreadCount: async (): Promise<number> => {
    const res = await api.get(`${endpoint}/unread-count`);
    const data = res.data?.data ?? res.data;
    return data.count;
  },
  markAsRead: async (id: string): Promise<NotificationItem> => {
    const res = await api.patch(`${endpoint}/${encodeURIComponent(id)}/read`);
    return res.data?.data ?? res.data;
  },
  markAllAsRead: async (): Promise<void> => {
    await api.patch(`${endpoint}/mark-all-read`);
  },
  deleteNotification: async (id: string): Promise<void> => {
    await api.delete(`${endpoint}/${encodeURIComponent(id)}`);
  },
};
