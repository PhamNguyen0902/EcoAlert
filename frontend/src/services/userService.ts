import { api } from "./api";
import type { User, PaginatedResult } from "@/types";

export interface UserFilters {
  role?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const userService = {
  //lấy danh sách người dùng kèm phân trang và lọc theo vai trò
  getUsers: async (
    filters: UserFilters = {},
  ): Promise<PaginatedResult<User>> => {
    const params = new URLSearchParams();
    if (filters.page) params.append("page", String(filters.page));
    if (filters.limit) params.append("limit", String(filters.limit));
    if (filters.role && filters.role !== "ALL")
      params.append("role", filters.role);
    if (filters.search) params.append("search", filters.search);
    const res = await api.get(`/v1/users?${params.toString()}`);
    return res.data.data;
  },
  //cập nhật phân quyền vai trò
  changeRole: async (userId: string, role: string): Promise<User> => {
    const res = await api.patch(`/v1/users/${userId}/role`, { role });
    return res.data.data;
  },
  toggleStatus: async (userId: string, isActive: boolean): Promise<User> => {
    const res = await api.patch(`/v1/users/${userId}/status`, { isActive });
    return res.data.data;
  },
};
