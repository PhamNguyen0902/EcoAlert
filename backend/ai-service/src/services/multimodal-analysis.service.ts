import {
  createLogger,
  IAiAnalysisCompletedData,
  resolveOverallAiConfidence,
} from '@ecoalert/shared';
import { envConfig } from '../config/env.config';
import {
  analyzeIncidentWithOpenRouter,
  IncidentAnalysisInput,
  IncidentAnalysisResult,
} from './openrouter.service';
import {
  analyzeImageWithVision,
  safeVisionErrorMetadata,
} from './vision-client.service';
import { fuseIncidentEvidence } from './vision-fusion.service';
import { UNCLASSIFIED_CATEGORY } from './category-normalizer.service';
import { buildCompactVisionEvidence, formatVisionEvidenceLines } from './vision-evidence.service';

const logger = createLogger('ai-service');

export type MultimodalAnalysisResult = Omit<IAiAnalysisCompletedData, 'alertId' | 'analysisId'>;

export interface MultimodalInput extends IncidentAnalysisInput {
  alertId?: string;
}

export interface MultimodalDependencies {
  analyzeSemantic: (input: IncidentAnalysisInput) => Promise<IncidentAnalysisResult>;
  analyzeVision: typeof analyzeImageWithVision;
  visionEnabled: boolean;
}

export const analyzeMultimodalIncident = async (
  input: MultimodalInput,
  dependencies: Partial<MultimodalDependencies> = {},
): Promise<MultimodalAnalysisResult> => {
  const pipelineStartedAt = Date.now();
  const analyzeSemantic = dependencies.analyzeSemantic || analyzeIncidentWithOpenRouter;
  const analyzeVision = dependencies.analyzeVision || analyzeImageWithVision;
  const visionEnabled = dependencies.visionEnabled ?? envConfig.visionAiEnabled;

  if (!visionEnabled) {
    const semanticOnly = await analyzeSemantic(input);
    const displayConfidence = resolveOverallAiConfidence({
      analysisMode: semanticOnly.analysisMode,
      confidence: semanticOnly.confidence,
    });
    return {
      ...semanticOnly,
      confidence: displayConfidence.value,
      displayConfidenceSource: displayConfidence.source,
      totalProcessingTimeMs: Date.now() - pipelineStartedAt,
    };
  }

  let vision: Awaited<ReturnType<typeof analyzeImageWithVision>> | undefined;
  let visionFailure: unknown;
  if (input.imageUrl) {
    try {
      vision = await analyzeVision({ alertId: input.alertId, imageUrl: input.imageUrl });
      logger.info('Vision analysis complete', {
        alertId: input.alertId,
        objects: vision.totalDetectedObjects,
        detectorModel: vision.detectorModel,
      });
    } catch (error) {
      visionFailure = error;
    }
  } else {
    visionFailure = new Error('No incident image was supplied');
  }
  if (visionFailure) {
    logger.warn('Vision analysis branch failed; semantic fallback may be used', {
      alertId: input.alertId,
      ...safeVisionErrorMetadata(visionFailure),
    });
  }

  // Semantic synthesis starts after Vision so the GPT request receives compact
  // object evidence, never raw Python payloads or bounding boxes.
  const compactVisionEvidence = buildCompactVisionEvidence(vision);
  let semantic: IncidentAnalysisResult | undefined;
  let semanticFailure: unknown;
  try {
    semantic = await analyzeSemantic({ ...input, visionEvidence: compactVisionEvidence });
    logger.info('Semantic incident synthesis complete', {
      alertId: input.alertId,
      category: semantic.category,
      categoryConfidence: semantic.categoryConfidence,
      classificationStatus: semantic.classificationStatus,
    });
  } catch (error) {
    semanticFailure = error;
  }

  if (!semantic && !vision) {
    const semanticError = semanticFailure || new Error('Semantic analysis returned no result');
    const visionError = visionFailure || new Error('Vision analysis returned no result');
    throw new AggregateError(
      [semanticError, visionError],
      'Semantic and vision analysis both failed',
    );
  }

  const fused = fuseIncidentEvidence(semantic, vision);
  if (semantic) {
    const overallAnalysis = {
      isIncident: semantic.isIncident,
      incidentConfidence: semantic.incidentConfidence,
      categorySuggestion: semantic.category === UNCLASSIFIED_CATEGORY ? null : semantic.category,
      categoryConfidence: semantic.categoryConfidence,
      classificationStatus: semantic.classificationStatus,
      confidenceTier: semantic.confidenceTier,
      severity: semantic.severity,
      severityScore: semantic.severityScore,
      severityConfidence: semantic.severityConfidence,
      overallSummary: semantic.overallSummary,
      shortReason: semantic.shortReason,
      // Trust the server-produced compact evidence, not an arbitrary LLM list.
      visionEvidenceUsed: formatVisionEvidenceLines(compactVisionEvidence),
      semanticModel: semantic.model,
      pipelineVersion: 'multimodal-v2' as const,
    };
    const displayConfidence = resolveOverallAiConfidence({
      analysisMode: fused.fusion.mode,
      confidence: semantic.confidence,
      fusion: fused.fusion,
      overallAnalysis,
    });
    logger.info('AI analysis confidence state', {
      alertId: input.alertId,
      mode: fused.fusion.mode,
      semanticAvailable: true,
      visionAvailable: Boolean(vision),
      categoryConfidence: semantic.categoryConfidence,
      detectorConfidence: vision?.detectorConfidence ?? null,
      displayConfidence: displayConfidence.value,
      displayConfidenceSource: displayConfidence.source,
    });
    return {
      category: semantic.category,
      severity: fused.severity,
      confidence: displayConfidence.value,
      displayConfidenceSource: displayConfidence.source,
      summary: semantic.summary,
      reasoningSummary: semantic.reasoningSummary,
      analysisMode: fused.fusion.mode,
      provider: semantic.provider,
      model: semantic.model,
      pipelineVersion: 'multimodal-v2',
      vision: vision || {
        status: input.imageUrl ? 'FAILED' : 'SKIPPED',
        detectorModel: 'ecoalert-waste-yolo26n-v1.pt',
        detections: [],
        objectCounts: [],
        totalDetectedObjects: 0,
        visibleWasteCoverage: null,
        detectorConfidence: null,
        segmentationConfidence: null,
        processingTimeMs: 0,
        detectionTimeMs: 0,
        segmentationTimeMs: 0,
        annotationTimeMs: 0,
        warnings: [input.imageUrl ? 'Vision analysis failed; semantic analysis was retained.' : 'No image was supplied.'],
      },
      fusion: fused.fusion,
      overallAnalysis,
      ...(semantic.semanticProcessingTimeMs !== undefined
        ? { semanticProcessingTimeMs: semantic.semanticProcessingTimeMs }
        : {}),
      totalProcessingTimeMs: Date.now() - pipelineStartedAt,
    };
  }

  logger.info('AI analysis confidence state', {
    alertId: input.alertId,
    mode: 'VISION_ONLY',
    semanticAvailable: false,
    visionAvailable: true,
    categoryConfidence: null,
    detectorConfidence: vision?.detectorConfidence ?? null,
    displayConfidence: null,
    displayConfidenceSource: 'NONE',
  });
  return {
    category: UNCLASSIFIED_CATEGORY,
    severity: fused.severity,
    // Vision detector confidence must never masquerade as an incident-category
    // confidence when semantic synthesis is unavailable.
    confidence: null,
    displayConfidenceSource: 'NONE',
    // Semantic text is absent rather than fabricated. Clients render a local
    // availability status from analysisMode and retain Vision evidence below.
    summary: null,
    reasoningSummary: null,
    analysisMode: 'VISION_ONLY',
    provider: 'vision-service',
    model: vision!.detectorModel,
    pipelineVersion: 'multimodal-v2',
    vision,
    fusion: fused.fusion,
    totalProcessingTimeMs: Date.now() - pipelineStartedAt,
  };
};
