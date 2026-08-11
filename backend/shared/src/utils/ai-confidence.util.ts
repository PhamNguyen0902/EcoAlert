import type {
  AiAnalysisMode,
  AiDisplayConfidenceSource,
  IAiFusionAnalysis,
  IAiOverallAnalysis,
} from '../interfaces/ai-analysis.interface';

export interface AiDisplayConfidence {
  value: number | null;
  source: AiDisplayConfidenceSource;
}

export interface AiConfidenceResolutionInput {
  analysisMode?: AiAnalysisMode | null;
  confidence?: number | null;
  fusion?: Pick<IAiFusionAnalysis, 'fusionConfidence'> | null;
  overallAnalysis?: Pick<IAiOverallAnalysis, 'categoryConfidence' | 'incidentConfidence'> | null;
}

const usableConfidence = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

/**
 * Sole precedence policy for the incident-level confidence displayed outside
 * Vision evidence. Detector confidence never participates in this result.
 */
export const resolveOverallAiConfidence = (
  input: AiConfidenceResolutionInput,
): AiDisplayConfidence => {
  if (input.analysisMode === 'VISION_ONLY' || input.analysisMode === 'FAILED') {
    return { value: null, source: 'NONE' };
  }

  if (input.analysisMode === 'FULL_MULTIMODAL' && usableConfidence(input.fusion?.fusionConfidence)) {
    return { value: input.fusion.fusionConfidence, source: 'FUSION' };
  }
  if (usableConfidence(input.overallAnalysis?.categoryConfidence)) {
    return { value: input.overallAnalysis.categoryConfidence, source: 'CATEGORY' };
  }
  if (usableConfidence(input.overallAnalysis?.incidentConfidence)) {
    return { value: input.overallAnalysis.incidentConfidence, source: 'SEMANTIC' };
  }
  if (usableConfidence(input.confidence)) {
    // Compatibility for semantic v1/text records with one stored confidence.
    return { value: input.confidence, source: 'CATEGORY' };
  }
  return { value: null, source: 'NONE' };
};
