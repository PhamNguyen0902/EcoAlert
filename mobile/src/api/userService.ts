import { api } from "./client";
import type { PaginatedResult, User, CreateUserData, AuditLog } from "../types";

const OFFICER_PAGE_SIZE = 100;

const getOfficerPage = async (page: number): Promise<PaginatedResult<User>> => {
  const res = await api.get("/v1/users", {
    params: { page, limit: OFFICER_PAGE_SIZE, role: "OFFICER" },
  });
  return res.data?.data || res.data;
};

export const userService = {
  getOfficers: async (): Promise<User[]> => {
    const firstPage = await getOfficerPage(1);
    const officers = [...(firstPage.items || [])];

    for (let page = 2; page <= (firstPage.totalPages || 1); page += 1) {
      const nextPage = await getOfficerPage(page);
      officers.push(...(nextPage.items || []));
    }

    return officers;
  },

  getUsers: async (
    page = 1,
    limit = 10,
    role?: string,
    search?: string
  ): Promise<PaginatedResult<User>> => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (role && role !== "ALL") params.append("role", role);
    if (search) params.append("search", search);
    const res = await api.get(`/v1/users?${params.toString()}`);
    return res.data?.data || res.data;
  },

  getUserById: async (id: string): Promise<User> => {
    const res = await api.get(`/v1/users/${id}`);
    return res.data?.data || res.data;
  },

  createUser: async (data: CreateUserData): Promise<User> => {
    const res = await api.post("/v1/users", data);
    return res.data?.data || res.data;
  },

  changeRole: async (id: string, role: string): Promise<User> => {
    const res = await api.patch(`/v1/users/${id}/role`, { role });
    return res.data?.data || res.data;
  },

  toggleStatus: async (id: string, isActive: boolean): Promise<User> => {
    const res = await api.patch(`/v1/users/${id}/status`, { isActive });
    return res.data?.data || res.data;
  },

  deleteUser: async (id: string): Promise<any> => {
    const res = await api.delete(`/v1/users/${id}`);
    return res.data?.data || res.data;
  },

  getAuditLogs: async (
    page = 1,
    limit = 20,
    search?: string
  ): Promise<PaginatedResult<AuditLog>> => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.append("search", search);
    const res = await api.get(`/v1/users/audit-logs?${params.toString()}`);
    return res.data?.data || res.data;
  },

  updateProfile: async (
    data: Partial<Pick<User, "fullName" | "phone" | "avatar">>
  ): Promise<User> => {
    const res = await api.patch("/v1/users/profile", data);
    return res.data?.data || res.data;
  },

  changePassword: async (data: { oldPassword: string; newPassword: string }): Promise<any> => {
    const res = await api.patch("/v1/users/change-password", data);
    return res.data?.data || res.data;
  },
};

