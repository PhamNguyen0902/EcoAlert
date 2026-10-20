import type { Alert, AlertCategory, ImageValidation, Severity, PreSubmitSemanticResult, VisualMassEstimate, VisionDetectionMetadata } from "../../shared/types";
// khoảng cách sai số gps tối đa cho phép đối với báo cáo tác nghiệp hiện trường là năm mươi mét
export const MAX_FIELD_GPS_ACCURACY_METERS = 50;
export const MAX_FIELD_REPORT_PHOTOS = 5;
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
  id?: string;
  location?: FieldReportLocationDraft;
  originalLocalUri: string;
  displayLocalUri?: string;
  originalUploadedUrl?: string;
  originalOwnershipProof?: string;
  displayUploadedUrl?: string;
  displayOwnershipProof?: string;
  capturedAt: string;
  width?: number;
  height?: number;
  uploadState?: "IDLE" | "UPLOADING" | "UPLOADED" | "FAILED";
  visionState?: "IDLE" | "PROCESSING" | "OK" | "NO_DETECTION" | "FAILED";
  detections?: WasteDetectionDraft[];
  visionRequiresManualReview?: boolean;
  analysisIdentity?: string;
  analysis?: FieldReportImageValidationDraft;
  semanticStage?: "IDLE" | "PROCESSING" | "COMPLETE" | "FAILED";
  uploadError?: string;
  visionError?: string;
}
// cấu trúc dữ liệu đối tượng rác thải do mô hình ai phát hiện
export interface WasteDetectionDraft extends VisionDetectionMetadata {
  label: string;
  count?: number;
  confidence?: number;
  bbox?: [number, number, number, number];
}
// cấu trúc dữ liệu kết quả kiểm định ảnh từ mô hình AI
export type ImageValidationState = "IDLE" | "PROCESSING" | "VALID" | "INVALID" | "UNAVAILABLE";

export interface FieldReportImageValidationDraft {
  state: ImageValidationState;
  visionState?: FieldReportCaptureDraft["visionState"];
  semanticStage?: FieldReportCaptureDraft["semanticStage"];
  isWasteRelated?: boolean;
  detectedObjects: WasteDetectionDraft[];
  visionRequiresManualReview?: boolean;
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
  id: string;
  location?: FieldReportLocationDraft;
  photos: FieldReportCaptureDraft[];
  primaryPhotoId?: string;
  capture?: FieldReportCaptureDraft;
  imageValidation: FieldReportImageValidationDraft;
  title: string;
  description: string;
  createdAlert?: Alert;
  completedAt?: string;
}

export const createEmptyFieldReportDraft = (): FieldReportDraft => ({
  id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
  photos: [],
  imageValidation: { state: "IDLE", detectedObjects: [] },
  title: "",
  description: "",
});
