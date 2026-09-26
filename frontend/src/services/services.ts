
import { api } from "./api";
import type {
  Alert,
  CreateAlertData,
  ImageValidation,
  PaginatedResult,
  RegisterData,
  ResolutionInput,
} from "@/types";

export type WasteScale =
  | "VERY_SMALL"
  | "SMALL"
  | "MEDIUM"
  | "LARGE"
  | "VERY_LARGE";

export interface VisualMassEstimate {
  available: boolean;
  minKg: number | null;
  maxKg: number | null;
  mostLikelyKg: number | null;
  confidence: number | null;
  scale: WasteScale | null;
  reasoningSummary: string | null;
  limitations: string[];
}

export interface VisionDetection {
  materialClass: string;
  suggestedCategory: string;
  confidence: number;
  bbox: [number, number, number, number];
}

export interface VisionDetectionClassSummary {
  materialClass: string;
  count: number;
  averageConfidence: number;
}

export interface VisionDetectionSummary {
  objectCount: number;
  dominantClass?: string;
  averageConfidence?: number;
  classes?: VisionDetectionClassSummary[];
}

export interface VisionAnalysis {
  status: "ok" | "no_detection" | "error" | "skipped_not_applicable";
  detections: VisionDetection[];
  requiresManualReview: boolean;

  // Optional because /v1/media/upload may still return YOLO-only data.
  // If the backend orchestrator merges OpenRouter output here, the UI can use it directly.
  massEstimate?: VisualMassEstimate;
}

export interface VisionSemanticAnalysis {
  category?: string;
  severity?: string;
  confidence?: number;
  summary?: string;
  reasoningSummary?: string;

  isIncident?: boolean;
  incidentConfidence?: number;
  categoryConfidence?: number;
  severityScore?: number;
  severityConfidence?: number;

  overallSummary?: string;
  shortReason?: string;

  analysisMode?: "TEXT_ONLY" | "IMAGE_AND_TEXT";
  provider?: string;
  model?: string;
  semanticProcessingTimeMs?: number;

  massEstimate: VisualMassEstimate;
}

export interface MediaUploadResult {
  url: string;
  aiAnalysis: VisionAnalysis;

  // Enriched by /v1/ai/validate-image after upload.
  semanticAnalysis?: VisionSemanticAnalysis;

  // YOLO upload remains usable even when the semantic OpenRouter step fails.
  semanticAnalysisError?: string;
}

export interface UploadMediaWithVisionOptions {
  /**
   * true (default): upload -> YOLO -> OpenRouter semantic analysis.
   * false: upload -> YOLO only.
   */
  includeSemanticAnalysis?: boolean;
}

export interface ValidateImageInput {
  imageUrl: string;
  title?: string;
  description?: string;
  visionSummary?: VisionDetectionSummary;
}

export const buildVisionDetectionSummary = (
  detections: VisionDetection[],
): VisionDetectionSummary => {
  const groups = new Map<string, { count: number; confidenceTotal: number }>();
  let confidenceTotal = 0;

  for (const detection of detections) {
    const materialClass = detection.materialClass?.trim();
    if (!materialClass) continue;

    const confidence = Math.max(0, Math.min(1, detection.confidence));
    const current = groups.get(materialClass) ?? { count: 0, confidenceTotal: 0 };
    groups.set(materialClass, {
      count: current.count + 1,
      confidenceTotal: current.confidenceTotal + confidence,
    });
    confidenceTotal += confidence;
  }

  const classes = Array.from(groups.entries())
    .map(([materialClass, group]) => ({
      materialClass,
      count: group.count,
      averageConfidence: group.confidenceTotal / group.count,
    }))
    .sort((a, b) => b.count - a.count || b.averageConfidence - a.averageConfidence);
  const objectCount = classes.reduce((total, group) => total + group.count, 0);

  return {
    objectCount,
    dominantClass: classes[0]?.materialClass,
    averageConfidence: objectCount > 0 ? confidenceTotal / objectCount : undefined,
    classes,
  };
};

const getServiceErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) return error.message;

  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = (error as {
      response?: { data?: { message?: unknown } };
    }).response;

    const message = response?.data?.message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }

  return "Không thể hoàn tất bước phân tích AI Vision.";
};

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
  // Gửi URL ảnh sang AI Service/OpenRouter để phân tích ngữ nghĩa và ước tính khối lượng.
  // Endpoint này chạy SAU bước upload + YOLO để UI có thể hiển thị cả detection và massEstimate.
  // Legacy report-creation validation: sends only imageUrl and receives the
  // image-validation contract (VALID / UNCERTAIN / INVALID).
  validateImageForReport: async (
    imageUrl: string,
  ): Promise<ImageValidation> => {
    const res = await api.post("/v1/ai/validate-image", { imageUrl });
    return res.data.data;
  },
  // Semantic Vision analysis: sends the YOLO summary so OpenRouter can inspect
  // the image and return an independent visual mass estimate.
  validateImage: async (
    input: ValidateImageInput,
  ): Promise<VisionSemanticAnalysis> => {
    const res = await api.post("/v1/ai/validate-image", input);
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
  // Upload stores evidence; the backend worker decides whether YOLO applies after semantic classification.
  uploadMedia: async (
    file: File,
    onProgress?: (percentage: number) => void,
  ): Promise<string> => {
    const result = await alertService.uploadMediaWithVision(
      file,
      onProgress,
      { includeSemanticAnalysis: false },
    );
    return result.url;
  },

  /**
   * Luồng Vision dành cho màn hình phân tích:
   *
   * 1. POST /v1/media/upload
   *    -> lưu ảnh
   *    -> Vision Service / YOLO11n
   *    -> trả url + aiAnalysis.detections
   *
   * 2. POST /v1/ai/validate-image
   *    -> OpenRouter nhìn toàn cảnh ảnh
   *    -> trả massEstimate + category/severity/summary
   *
   * Không tính kg ở frontend từ số detection.
   */
  uploadMediaWithVision: async (
    file: File,
    onProgress?: (percentage: number) => void,
    options: UploadMediaWithVisionOptions = {},
  ): Promise<MediaUploadResult> => {
    const formData = new FormData();
    formData.append("image", file);

    const uploadResponse = await api.post("/v1/media/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event) => {
        if (event.total && onProgress) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      },
    });

    const uploadResult = uploadResponse.data.data as MediaUploadResult;
    const includeSemanticAnalysis =
      options.includeSemanticAnalysis ?? true;

    if (!includeSemanticAnalysis || !uploadResult.url) {
      return uploadResult;
    }

    try {
      const semanticAnalysis = await alertService.validateImage({
        imageUrl: uploadResult.url,
        visionSummary: buildVisionDetectionSummary(uploadResult.aiAnalysis.detections),
      });

      if (import.meta.env.DEV) {
        console.debug("[EcoAlert Vision]", {
          upload: uploadResult.aiAnalysis,
          semantic: semanticAnalysis,
        });
      }

      return {
        ...uploadResult,
        semanticAnalysis,
      };
    } catch (error) {
      // Không làm mất kết quả YOLO chỉ vì OpenRouter lỗi.
      // UI vẫn hiển thị detection và thông báo bước semantic chưa thành công.
      return {
        ...uploadResult,
        semanticAnalysisError: getServiceErrorMessage(error),
      };
    }
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
