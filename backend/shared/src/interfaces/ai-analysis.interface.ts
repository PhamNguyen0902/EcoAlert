import { AlertCategory, Severity } from '../enums';

export type AiAnalysisMode =
  | 'text'
  | 'vision'
  | 'text_fallback'
  | 'FULL_MULTIMODAL'
  | 'SEMANTIC_ONLY'
  | 'VISION_ONLY'
  | 'FAILED';

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
  version: 'vision-fusion-v1';
  mode: Extract<AiAnalysisMode, 'FULL_MULTIMODAL' | 'SEMANTIC_ONLY' | 'VISION_ONLY' | 'FAILED'>;
  wasteType?: AiWasteType;
  severityScore: number;
  severityFactors: IAiSeverityFactor[];
  explanations: string[];
  semanticConfidence: number | null;
  visionConfidence: number | null;
  fusionConfidence: number;
  processingTimeMs: number;
}

export interface IAiAnalysisCompletedData {
  alertId: string;
  analysisId: string;
  category: AlertCategory;
  severity: Severity;
  confidence: number;
  summary: string;
  reasoningSummary: string;
  analysisMode: AiAnalysisMode;
  provider: 'openrouter' | 'vision-service';
  model: string;
  pipelineVersion?: 'multimodal-v1';
  vision?: IAiVisionAnalysis;
  fusion?: IAiFusionAnalysis;
  semanticProcessingTimeMs?: number;
  totalProcessingTimeMs?: number;
}
