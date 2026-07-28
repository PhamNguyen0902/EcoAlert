import { api } from "./client";
import { Category, CreateCategoryData } from "../types";

export const categoryService = {
  getCategories: async (includeInactive = true): Promise<Category[]> => {
    const res = await api.get(`/v1/alerts/categories?includeInactive=${includeInactive}`);
    return res.data?.data || res.data || [];
  },

  createCategory: async (data: CreateCategoryData): Promise<Category> => {
    const res = await api.post("/v1/alerts/categories", data);
    return res.data?.data || res.data;
  },

  updateCategory: async (id: string, data: Partial<CreateCategoryData>): Promise<Category> => {
    const res = await api.patch(`/v1/alerts/categories/${id}`, data);
    return res.data?.data || res.data;
  },

  deleteCategory: async (id: string): Promise<any> => {
    const res = await api.delete(`/v1/alerts/categories/${id}`);
    return res.data?.data || res.data;
  },
};
