import { AlertCategory, Severity } from '../enums';

/** Result mode of the single OpenRouter incident-analysis request. */
export type AiAnalysisMode = 'TEXT_ONLY' | 'IMAGE_AND_TEXT' | 'FAILED';
export type AiPipelineVersion = 'openrouter-multimodal-v1';
export type AiClassificationStatus = 'AI_SUGGESTED' | 'UNCLASSIFIED';
export type AiSuggestionConfidenceTier = 'HIGH_CONFIDENCE' | 'REVIEW_REQUIRED' | 'UNCLASSIFIED';
export type AiDisplayConfidenceSource = 'CATEGORY' | 'SEMANTIC' | 'NONE';

/**
 * User-visible interpretation returned directly by OpenRouter. It intentionally
 * has no detector, bounding-box, or secondary-analysis fields.
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
  semanticModel: string;
  pipelineVersion: AiPipelineVersion;
}

/** Event payload published after AI processing; a failed request preserves the report. */
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
}
