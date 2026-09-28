import { AlertCategory, Severity } from '../enums';
import type { VisionPipeline } from '../utils/vision-pipeline';

// chế độ phân tích của yêu cầu xử lý sự cố openrouter
export type AiAnalysisMode = 'TEXT_ONLY' | 'IMAGE_AND_TEXT' | 'FAILED';
export type AiPipelineVersion = 'openrouter-multimodal-v1';
export type AiClassificationStatus = 'AI_SUGGESTED' | 'UNCLASSIFIED';
export type AiSuggestionConfidenceTier = 'HIGH_CONFIDENCE' | 'REVIEW_REQUIRED' | 'UNCLASSIFIED';
export type AiDisplayConfidenceSource = 'CATEGORY' | 'SEMANTIC' | 'NONE';

export type AiAnalysisStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type WasteScale = 'VERY_SMALL' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'VERY_LARGE';

export interface IVisualMassEstimate {
  available: boolean;
  minKg: number | null;
  maxKg: number | null;
  mostLikelyKg: number | null;
  confidence: number | null;
  scale: WasteScale | null;
  reasoningSummary: string | null;
  limitations: string[];
}

export interface IVisionEvidence {
  imageUrl: string;
  status: 'ok' | 'no_detection' | 'error' | 'skipped_not_applicable';
  detections: Array<{ materialClass: string; suggestedCategory?: string; confidence: number; bbox: [number, number, number, number] }>;
  requiresManualReview: boolean;
}

// kết quả phân tích tổng quan do mô hình ai trả về phục vụ hiển thị trực tiếp cho người dùng
export interface IAiOverallAnalysis {
  isIncident: boolean;
  incidentConfidence: number;
  categorySuggestion: AlertCategory | null;
  categoryConfidence: number;
  classificationStatus: AiClassificationStatus;
  confidenceTier: AiSuggestionConfidenceTier;
  severity: Severity;
  severityScore: number;
  severityConfidence: number;
  overallSummary: string;
  shortReason: string;
  massEstimate: IVisualMassEstimate;
  semanticModel: string;
  pipelineVersion: AiPipelineVersion;
  analysisPipeline?: VisionPipeline;
}

// dữ liệu sự kiện phát ra sau khi phân tích ai hoàn tất luôn bảo toàn báo cáo ngay cả khi lỗi
export interface IAiAnalysisCompletedData {
  alertId: string;
  analysisId: string;
  category: AlertCategory | 'UNCLASSIFIED';
  severity: Severity | null;
  confidence: number | null;
  displayConfidenceSource?: AiDisplayConfidenceSource;
  summary: string | null;
  reasoningSummary: string | null;
  analysisMode: AiAnalysisMode;
  provider: 'openrouter';
  model: string;
  pipelineVersion?: AiPipelineVersion;
  overallAnalysis?: IAiOverallAnalysis;
  processingTimeMs?: number;
  failureReason?: string;
  analysisPipeline?: VisionPipeline;
  visionEvidence?: IVisionEvidence[];
}
