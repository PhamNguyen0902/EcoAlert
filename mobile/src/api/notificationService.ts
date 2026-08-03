import { api } from "./client";
import type { ApiResponse, Notification, PaginatedResult } from "../types";

export const notificationService = {
  getNotifications: async (page = 1, limit = 30): Promise<PaginatedResult<Notification>> => {
    const response = await api.get<ApiResponse<PaginatedResult<Notification>>>("/v1/notifications", {
      params: { page, limit },
    });
    return response.data.data;
  },

  getUnreadCount: async (): Promise<number> => {
    const response = await api.get<ApiResponse<{ count: number }>>("/v1/notifications/unread-count");
    return response.data.data.count;
  },

  markAsRead: async (id: string): Promise<Notification> => {
    const response = await api.patch<ApiResponse<Notification>>(`/v1/notifications/${id}/read`);
    return response.data.data;
  },

  markAllAsRead: async (): Promise<void> => {
    await api.patch("/v1/notifications/mark-all-read");
  },
};
