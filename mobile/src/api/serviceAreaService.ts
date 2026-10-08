import { api } from "./client";
import type { PaginatedResult } from "../types";
export interface OfficerServiceArea {
  _id: string;
  code: string;
  name: string;
  administrativeLevel: "WARD" | "DISTRICT" | "CUSTOM";
  parentCode?: string;
  isActive: boolean;
  priority: number;
}
export const serviceAreaService = {
  async mine(page: number): Promise<PaginatedResult<OfficerServiceArea>> {
    const response = await api.get<{
      data: PaginatedResult<OfficerServiceArea>;
    }>(`/v1/gis/service-areas/mine?page=${page}&limit=20`);
    return response.data.data;
  },
};
