
import { api } from "./api";
import type {
  Alert,
  CreateAlertData,
  PaginatedResult,
  RegisterData,
  ResolutionInput,
} from "@/types";

// nhóm dịch vụ xác thực tài khoản
export const authService = {
  // gửi thông tin đăng nhập tài khoản
  login: async (data: { email: string; password: string }) => {
    const res = await api.post("/v1/auth/login", data);
    return res.data;
  },
  // gửi thông tin đăng ký tài khoản mới
  register: async (data: RegisterData) => {
    const res = await api.post("/v1/auth/register", data);
    return res.data;
  },
  // gửi yêu cầu đăng xuất khỏi hệ thống
  logout: async (refreshToken?: string) => {
    const res = await api.post("/v1/auth/logout", { refreshToken });
    return res.data;
  },
};

// nhóm dịch vụ quản lý và xử lý sự cố môi trường
export const alertService = {
  // lấy danh sách sự cố có phân trang và bộ lọc tìm kiếm
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
  // lấy thông tin chi tiết một sự cố theo mã định danh
  getAlert: async (id: string): Promise<Alert> => {
    const res = await api.get(`/v1/alerts/${id}`);
    return res.data.data;
  },
  // lấy danh sách nhiệm vụ được giao cho cán bộ
  getOfficerTasks: async (
    page = 1,
    limit = 10,
    status?: string,
  ): Promise<PaginatedResult<Alert>> => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (status) params.set("status", status);
    const res = await api.get(`/v1/alerts/officer/tasks?${params}`);
    return res.data.data;
  },
  // quản trị viên phân công sự cố cho cán bộ phụ trách
  assignOfficer: async (id: string, officerId: string): Promise<Alert> => {
    const res = await api.post(`/v1/alerts/${id}/assign`, { officerId });
    return res.data.data;
  },
  // cán bộ cập nhật bắt đầu tiến hành xử lý sự cố
  startHandling: async (id: string): Promise<Alert> => {
    const res = await api.post(`/v1/alerts/${id}/start`);
    return res.data.data;
  },
  // cán bộ xác nhận vị trí đã có mặt tại hiện trường
  confirmArrival: async (
    id: string,
    location: { latitude?: number; longitude?: number; accuracy?: number } = {},
  ): Promise<Alert> => {
    const res = await api.post(`/v1/alerts/${id}/arrival`, location);
    return res.data.data;
  },
  // cán bộ gửi thông tin và minh chứng hoàn tất xử lý
  resolveIncident: async (
    id: string,
    data: ResolutionInput,
  ): Promise<Alert> => {
    const res = await api.post(`/v1/alerts/${id}/resolution`, data);
    return res.data.data;
  },
  // quản trị viên phê duyệt và chính thức đóng sự cố
  closeIncident: async (id: string, reviewNote?: string): Promise<Alert> => {
    const res = await api.post(`/v1/alerts/${id}/close`, { reviewNote });
    return res.data.data;
  },
  // gửi đường dẫn ảnh sang dịch vụ trí tuệ nhân tạo để kiểm tra
  validateImage: async (imageUrl: string) => {
    const res = await api.post("/v1/ai/validate-image", { imageUrl });
    return res.data.data;
  },
  // quản trị viên xác nhận hoặc điều chỉnh danh mục phân loại sự cố
  reviewClassification: async (
    id: string,
    category?: string,
  ): Promise<Alert> => {
    const res = await api.post(`/v1/alerts/${id}/classification/review`, {
      category,
    });
    return res.data.data;
  },
  // lấy danh sách cán bộ cùng tình trạng ca trực và khối lượng công việc
  getOfficerAvailability: async () => {
    const res = await api.get("/v1/alerts/officers/availability");
    return res.data.data;
  },
  // người dân gửi báo cáo sự cố môi trường mới
  createAlert: async (data: CreateAlertData) => {
    const res = await api.post("/v1/alerts", data);
    return res.data.data;
  },
  // cập nhật trạng thái tiến trình của sự cố
  updateStatus: async (id: string, status: string) => {
    const res = await api.patch(`/v1/alerts/${id}/status`, { status });
    return res.data.data;
  },
  // xóa báo cáo sự cố khỏi hệ thống
  deleteAlert: async (id: string) => {
    const res = await api.delete(`/v1/alerts/${id}`);
    return res.data.data;
  },
  // tải tệp hình ảnh lên máy chủ lưu trữ kèm theo dõi tiến trình
  uploadMedia: async (
    file: File,
    onProgress?: (percentage: number) => void,
  ): Promise<string> => {
    const formData = new FormData();
    formData.append("image", file);
    const res = await api.post("/v1/media/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event) => {
        if (event.total && onProgress)
          onProgress(Math.round((event.loaded / event.total) * 100));
      },
    });
    return res.data.data.url;
  },
  // chỉnh sửa thông tin nội dung của báo cáo sự cố
  updateAlert: async (id: string, data: Partial<CreateAlertData>) => {
    const res = await api.patch(`/v1/alerts/${id}`, data);
    return res.data.data;
  },
  // lưu ghi chú nội bộ của cán bộ vào sự cố
  addOfficerNote: async (id: string, note: string) => {
    const res = await api.post(`/v1/alerts/${id}/note`, { note });
    return res.data.data;
  },
  // khôi phục lại báo cáo sự cố đã bị xóa
  restoreAlert: async (id: string) => {
    const res = await api.patch(`/v1/alerts/${id}/restore`);
    return res.data.data;
  },
};

// nhóm dịch vụ bản đồ và xử lý không gian địa lý
export const gisService = {
  // lấy danh sách sự cố xung quanh tọa độ theo bán kính mét
  getNearby: async (lng: number, lat: number, maxDistance = 5000) => {
    const res = await api.get(
      `/v1/gis/nearby?lng=${lng}&lat=${lat}&maxDistance=${maxDistance}`,
    );
    return res.data.data;
  },
  // lấy danh sách sự cố theo bán kính km phục vụ vẽ bản đồ
  getRadius: async (lng: number, lat: number, radius = 5) => {
    const res = await api.get(
      `/v1/gis/radius?lng=${lng}&lat=${lat}&radius=${radius}`,
    );
    return res.data.data;
  },
};