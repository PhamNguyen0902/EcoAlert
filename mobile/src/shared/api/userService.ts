import { api } from './client';
import type { PaginatedResult, User } from '../types';

const OFFICER_PAGE_SIZE = 100;

const getOfficerPage = async (page: number): Promise<PaginatedResult<User>> => {
  const res = await api.get('/v1/users', {
    params: { page, limit: OFFICER_PAGE_SIZE, role: 'OFFICER' },
  });
  return res.data?.data || res.data;
};

export const userService = {
  // Tải Officer cho phần hiển thị người được phân công trong chi tiết báo cáo.
  getOfficers: async (): Promise<User[]> => {
    const firstPage = await getOfficerPage(1);
    const officers = [...(firstPage.items || [])];
    for (let page = 2; page <= (firstPage.totalPages || 1); page += 1) {
      const nextPage = await getOfficerPage(page);
      officers.push(...(nextPage.items || []));
    }
    return officers;
  },

  getUserById: async (id: string): Promise<User> => {
    const res = await api.get(`/v1/users/${id}`);
    return res.data?.data || res.data;
  },
};
