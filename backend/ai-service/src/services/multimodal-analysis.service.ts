import {
  IAiAnalysisCompletedData,
  resolveOverallAiConfidence,
} from '@ecoalert/shared';
import {
  analyzeIncidentWithOpenRouter,
  IncidentAnalysisInput,
  IncidentAnalysisResult,
} from './openrouter.service';
import { UNCLASSIFIED_CATEGORY } from './category-normalizer.service';

export type MultimodalAnalysisResult = Omit<IAiAnalysisCompletedData, 'alertId' | 'analysisId'>;

export interface MultimodalInput extends IncidentAnalysisInput {
  alertId?: string;
}

export interface MultimodalDependencies {
  analyze: (input: IncidentAnalysisInput) => Promise<IncidentAnalysisResult>;
}

/** Gửi trực tiếp text và ảnh (nếu có) tới OpenRouter, không qua bước nhận diện phụ. */
export const analyzeMultimodalIncident = async (
  input: MultimodalInput,
  dependencies: Partial<MultimodalDependencies> = {},
): Promise<MultimodalAnalysisResult> => {
  const startedAt = Date.now();
  const result = await (dependencies.analyze || analyzeIncidentWithOpenRouter)(input);
  // Chuẩn hóa phản hồi model thành hợp đồng chung mà Alert Service lưu xuống MongoDB.
  const overallAnalysis = {
    isIncident: result.isIncident,
    incidentConfidence: result.incidentConfidence,
    categorySuggestion: result.category === UNCLASSIFIED_CATEGORY ? null : result.category,
    categoryConfidence: result.categoryConfidence,
    classificationStatus: result.classificationStatus,
    confidenceTier: result.confidenceTier,
    severity: result.severity,
    severityScore: result.severityScore,
    severityConfidence: result.severityConfidence,
    overallSummary: result.overallSummary,
    shortReason: result.shortReason,
    semanticModel: result.model,
    pipelineVersion: 'openrouter-multimodal-v1' as const,
  };
  const displayConfidence = resolveOverallAiConfidence({
    analysisMode: result.analysisMode,
    confidence: result.confidence,
    overallAnalysis,
  });

  return {
    category: result.category,
    severity: result.severity,
    confidence: displayConfidence.value,
    displayConfidenceSource: displayConfidence.source,
    summary: result.summary,
    reasoningSummary: result.reasoningSummary,
    analysisMode: result.analysisMode,
    provider: 'openrouter',
    model: result.model,
    pipelineVersion: 'openrouter-multimodal-v1',
    overallAnalysis,
    processingTimeMs: Date.now() - startedAt,
  };
};
