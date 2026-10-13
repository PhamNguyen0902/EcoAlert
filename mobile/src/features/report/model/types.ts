import type { Alert, AlertCategory, ImageValidation, Severity, PreSubmitSemanticResult, VisualMassEstimate } from "../../../shared/types/index";
// khoảng cách sai số gps tối đa cho phép đối với báo cáo tác nghiệp hiện trường là năm mươi mét
export const MAX_FIELD_GPS_ACCURACY_METERS = 50;
// cấu trúc dữ liệu vị trí gps ghi nhận tại hiện trường
export interface FieldReportLocationDraft {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  address: string;
  capturedAt: string;
  source: "DEVICE_GPS";
}
// cấu trúc dữ liệu ảnh chụp trực tiếp từ camera hiện trường
export interface FieldReportCaptureDraft {
  originalLocalUri: string;
  displayLocalUri?: string;
  originalUploadedUrl?: string;
  displayUploadedUrl?: string;
  capturedAt: string;
  width?: number;
  height?: number;
}
// cấu trúc dữ liệu đối tượng rác thải do mô hình ai phát hiện
export interface WasteDetectionDraft {
  label: string;
  count?: number;
  confidence?: number;
  bbox?: [number, number, number, number];
}
// cấu trúc dữ liệu kết quả kiểm định ảnh từ mô hình AI
export type ImageValidationState = "IDLE" | "PROCESSING" | "VALID" | "INVALID" | "UNAVAILABLE";

export interface FieldReportImageValidationDraft {
  state: ImageValidationState;
  isWasteRelated?: boolean;
  detectedObjects: WasteDetectionDraft[];
  suggestedCategory?: AlertCategory | null;
  severity?: Severity | null;
  summary?: string | null;
  reason?: string | null;
  backendValidation?: ImageValidation;
  semanticState?: "COMPLETE" | "UNCLASSIFIED" | "TEXT_ONLY" | "UNAVAILABLE";
  semanticError?: string | null;
  categoryConfidence?: number | null;
  yoloConfidence?: number | null;
  analysisMode?: PreSubmitSemanticResult["analysisMode"];
  massEstimate?: VisualMassEstimate;
  semanticResult?: PreSubmitSemanticResult;
  userSelectedCategory?: AlertCategory;
}
// cấu trúc dữ liệu toàn bộ bản nháp báo cáo hiện trường
export interface FieldReportDraft {
  location?: FieldReportLocationDraft;
  capture?: FieldReportCaptureDraft;
  imageValidation: FieldReportImageValidationDraft;
  title: string;
  description: string;
  createdAlert?: Alert;
}

export const createEmptyFieldReportDraft = (): FieldReportDraft => ({
  imageValidation: { state: "IDLE", detectedObjects: [] },
  title: "",
  description: "",
});
