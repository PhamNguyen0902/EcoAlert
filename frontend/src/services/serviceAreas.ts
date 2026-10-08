import { api } from "./api";
import type { PaginatedResult } from "@/types";
export type AreaGeometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };
export interface ServiceArea {
  _id: string;
  code: string;
  name: string;
  administrativeLevel: "WARD" | "DISTRICT" | "CUSTOM";
  parentCode?: string;
  geometry: AreaGeometry;
  assignedOfficerIds: string[];
  isActive: boolean;
  priority: number;
}
export type AreaInput = Omit<ServiceArea, "_id">;
export interface AreaOfficer {
  officer: {
    _id: string;
    fullName: string;
    email: string;
    role: string;
    isActive: boolean;
    isDeleted: boolean;
  };
  shiftStatus: "ON_SHIFT" | "OFF_SHIFT";
  activeTaskCount: number;
  assignedCount: number;
  inProgressCount: number;
  workloadLevel: string;
  eligible?: boolean;
  exclusion?: string;
}
export interface AssignmentPreview {
  reason: string;
  match?: {
    area: ServiceArea | null;
    overlaps: Array<{
      _id: string;
      code: string;
      name: string;
      priority: number;
    }>;
  };
  candidates?: AreaOfficer[];
  selectedOfficerId?: string;
}
export const assignmentReasonLabel = (reason?: string) =>
  ({
    AUTO_ASSIGNED: "Có cán bộ đủ điều kiện",
    AREA_NOT_FOUND: "Chưa cấu hình khu vực tại vị trí này",
    NO_OFFICER_IN_AREA: "Khu vực chưa có cán bộ",
    NO_ACTIVE_SHIFT: "Không có cán bộ đang trong ca",
    CAPACITY_REACHED: "Các cán bộ đã đạt giới hạn nhiệm vụ",
    NO_ELIGIBLE_OFFICER: "Không có tài khoản cán bộ đủ điều kiện",
    ALREADY_ASSIGNED: "Báo cáo đã được phân công",
    NOT_VERIFIED: "Báo cáo chưa được xác minh",
    DEPENDENCY_UNAVAILABLE:
      "Dịch vụ khu vực hoặc cán bộ tạm thời không khả dụng",
    INVALID_LOCATION: "Tọa độ báo cáo không hợp lệ",
    DISABLED: "Phân công tự động đang tắt",
    ASSIGNMENT_BUSY: "Đang có lượt phân công khác; vui lòng thử lại",
  })[reason || ""] || "Chờ phân công";
export const serviceAreas = {
  async overlaps(id: string) {
    const r = await api.get(`/v1/gis/service-areas/${id}/overlaps`);
    return r.data.data as Array<{
      _id: string;
      code: string;
      name: string;
      priority: number;
    }>;
  },
  async list(page = 1) {
    const r = await api.get(`/v1/gis/service-areas?page=${page}&limit=20`);
    return r.data.data as PaginatedResult<ServiceArea>;
  },
  async save(input: AreaInput, id?: string) {
    const r = id
      ? await api.patch(`/v1/gis/service-areas/${id}`, input)
      : await api.post("/v1/gis/service-areas", input);
    return r.data.data as ServiceArea;
  },
  async deactivate(id: string) {
    await api.delete(`/v1/gis/service-areas/${id}`);
  },
  async availability() {
    const r = await api.get("/v1/alerts/officers/availability");
    return r.data.data as AreaOfficer[];
  },
  async preview(id: string) {
    const r = await api.get(`/v1/alerts/${id}/assignment-preview`);
    return r.data.data as AssignmentPreview;
  },
  async autoAssign(id: string) {
    const r = await api.post(`/v1/alerts/${id}/auto-assign`);
    return r.data.data as {
      assigned: boolean;
      reason: string;
      officerId?: string;
    };
  },
};
