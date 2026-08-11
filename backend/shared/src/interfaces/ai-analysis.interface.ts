import { AlertCategory, Severity } from '../enums';

export type AiAnalysisMode =
  | 'text'
  | 'vision'
  | 'text_fallback'
  | 'FULL_MULTIMODAL'
  | 'SEMANTIC_ONLY'
  | 'VISION_ONLY'
  | 'FAILED';

export type AiPipelineVersion = 'multimodal-v1' | 'multimodal-v2';
export type AiClassificationStatus = 'AI_SUGGESTED' | 'UNCLASSIFIED';
export type AiSuggestionConfidenceTier = 'HIGH_CONFIDENCE' | 'REVIEW_REQUIRED' | 'UNCLASSIFIED';
export type AiVisionSupport = 'STRONG' | 'PARTIAL' | 'NONE' | 'NOT_APPLICABLE';
export type AiDisplayConfidenceSource = 'FUSION' | 'CATEGORY' | 'SEMANTIC' | 'NONE';

export type AiVisionStatus = 'COMPLETED' | 'FAILED' | 'SKIPPED' | 'UNAVAILABLE';

export type AiWasteType =
  | 'PLASTIC_WASTE'
  | 'ORGANIC_WASTE'
  | 'CONSTRUCTION_WASTE'
  | 'HAZARDOUS_WASTE'
  | 'METAL_WASTE'
  | 'GLASS_WASTE'
  | 'PAPER_WASTE'
  | 'E_WASTE'
  | 'MIXED_WASTE'
  | 'OTHER';

export interface IAiBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IAiVisionDetection {
  classId: number;
  label: string;
  confidence: number;
  bbox: IAiBoundingBox;
  normalizedBbox: IAiBoundingBox;
  wasteType?: AiWasteType;
  maskAreaPixels?: number;
  maskCoverage?: number;
}

export interface IAiObjectCount {
  label: string;
  count: number;
}

export interface IAiVisionAnalysis {
  status: AiVisionStatus;
  detectorModel: string;
  segmenterModel?: string;
  imageWidth?: number;
  imageHeight?: number;
  detections: IAiVisionDetection[];
  objectCounts: IAiObjectCount[];
  totalDetectedObjects: number;
  visibleWasteCoverage: number | null;
  detectorConfidence: number | null;
  segmentationConfidence: number | null;
  annotatedImageUrl?: string;
  processingTimeMs: number;
  detectionTimeMs: number;
  segmentationTimeMs: number;
  annotationTimeMs: number;
  warnings: string[];
}

export interface IAiSeverityFactor {
  factor: 'semantic_severity' | 'visible_waste_coverage' | 'object_count' | 'hazardous_waste';
  score: number;
  evidenceSource: 'semantic' | 'vision';
  explanation: string;
}

export interface IAiFusionAnalysis {
  version: 'vision-fusion-v1' | 'vision-fusion-v2';
  mode: Extract<AiAnalysisMode, 'FULL_MULTIMODAL' | 'SEMANTIC_ONLY' | 'VISION_ONLY' | 'FAILED'>;
  wasteType?: AiWasteType;
  severityScore: number | null;
  severityFactors: IAiSeverityFactor[];
  explanations: string[];
  semanticConfidence: number | null;
  visionConfidence: number | null;
  fusionConfidence: number | null;
  visionSupport?: AiVisionSupport;
  processingTimeMs: number;
}

/**
 * Concise, user-visible semantic interpretation. Vision detections remain in
 * IAiVisionAnalysis so object-level evidence is never confused with incident
 * classification.
 */
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
  visionEvidenceUsed: string[];
  semanticModel: string;
  pipelineVersion: 'multimodal-v2';
}

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
  provider: 'openrouter' | 'vision-service';
  model: string;
  pipelineVersion?: AiPipelineVersion;
  overallAnalysis?: IAiOverallAnalysis;
  vision?: IAiVisionAnalysis;
  fusion?: IAiFusionAnalysis;
  semanticProcessingTimeMs?: number;
  totalProcessingTimeMs?: number;
}
