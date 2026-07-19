import { api } from './api';

export const authService = {
  login: async (data: any) => {
    const res = await api.post('/v1/auth/login', data);
    return res.data;
  },
  register: async (data: any) => {
    const res = await api.post('/v1/auth/register', data);
    return res.data;
  }
};

export const alertService = {
  getAlerts: async (page = 1, limit = 10, filters = {}) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit), ...filters });
    const res = await api.get(`/v1/alerts?${params}`);
    return res.data.data;
  },
  getAlert: async (id: string) => {
    const res = await api.get(`/v1/alerts/${id}`);
    return res.data.data;
  },
  createAlert: async (data: any) => {
    const res = await api.post('/v1/alerts', data);
    return res.data.data;
  },
  updateStatus: async (id: string, status: string) => {
    const res = await api.patch(`/v1/alerts/${id}/status`, { status });
    return res.data.data;
  },
  uploadMedia: async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await api.post('/v1/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data.data.url;
  }
};

export const notificationService = {
  getNotifications: async (page = 1, limit = 20) => {
    const res = await api.get(`/v1/notifications?page=${page}&limit=${limit}`);
    return res.data.data;
  },
  getUnreadCount: async () => {
    const res = await api.get('/v1/notifications/unread-count');
    return res.data.data.count;
  },
  markAsRead: async (id: string) => {
    const res = await api.patch(`/v1/notifications/${id}/read`);
    return res.data.data;
  },
  markAllAsRead: async () => {
    const res = await api.patch('/v1/notifications/mark-all-read');
    return res.data.data;
  },
  deleteNotification: async (id: string) => {
    const res = await api.delete(`/v1/notifications/${id}`);
    return res.data.data;
  }
};
