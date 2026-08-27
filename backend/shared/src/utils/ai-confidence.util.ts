import type {
  AiAnalysisMode,
  AiDisplayConfidenceSource,
  IAiOverallAnalysis,
} from '../interfaces/ai-analysis.interface';

export interface AiDisplayConfidence {
  value: number | null;
  source: AiDisplayConfidenceSource;
}

export interface AiConfidenceResolutionInput {
  analysisMode?: AiAnalysisMode | null;
  confidence?: number | null;
  overallAnalysis?: Pick<IAiOverallAnalysis, 'categoryConfidence' | 'incidentConfidence'> | null;
}

const usableConfidence = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

/** Chooses the direct OpenRouter confidence shown at incident level. */
export const resolveOverallAiConfidence = (
  input: AiConfidenceResolutionInput,
): AiDisplayConfidence => {
  if (input.analysisMode === 'FAILED') return { value: null, source: 'NONE' };
  if (usableConfidence(input.overallAnalysis?.categoryConfidence)) {
    return { value: input.overallAnalysis.categoryConfidence, source: 'CATEGORY' };
  }
  if (usableConfidence(input.overallAnalysis?.incidentConfidence)) {
    return { value: input.overallAnalysis.incidentConfidence, source: 'SEMANTIC' };
  }
  if (usableConfidence(input.confidence)) return { value: input.confidence, source: 'CATEGORY' };
  return { value: null, source: 'NONE' };
};
