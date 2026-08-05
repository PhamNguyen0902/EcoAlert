import { AlertCategory, createLogger, IAiAnalysisCompletedData } from '@ecoalert/shared';
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
    return {
      ...semanticOnly,
      totalProcessingTimeMs: Date.now() - pipelineStartedAt,
    };
  }

  const semanticPromise = analyzeSemantic(input);
  const visionPromise = input.imageUrl
    ? analyzeVision({ alertId: input.alertId, imageUrl: input.imageUrl })
    : Promise.reject(new Error('No incident image was supplied'));
  const [semanticResult, visionResult] = await Promise.allSettled([
    semanticPromise,
    visionPromise,
  ]);
  const semantic = semanticResult.status === 'fulfilled' ? semanticResult.value : undefined;
  const vision = visionResult.status === 'fulfilled' ? visionResult.value : undefined;

  if (visionResult.status === 'rejected') {
    logger.warn('Vision analysis branch failed; semantic fallback may be used', {
      alertId: input.alertId,
      ...safeVisionErrorMetadata(visionResult.reason),
    });
  }

  if (!semantic && !vision) {
    const semanticError = semanticResult.status === 'rejected'
      ? semanticResult.reason
      : new Error('Semantic analysis returned no result');
    const visionError = visionResult.status === 'rejected'
      ? visionResult.reason
      : new Error('Vision analysis returned no result');
    throw new AggregateError(
      [semanticError, visionError],
      'Semantic and vision analysis both failed',
    );
  }

  const fused = fuseIncidentEvidence(semantic, vision);
  if (semantic) {
    return {
      ...semantic,
      severity: fused.severity,
      confidence: fused.confidence,
      analysisMode: fused.fusion.mode,
      pipelineVersion: 'multimodal-v1',
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
      ...(semantic.semanticProcessingTimeMs !== undefined
        ? { semanticProcessingTimeMs: semantic.semanticProcessingTimeMs }
        : {}),
      totalProcessingTimeMs: Date.now() - pipelineStartedAt,
    };
  }

  return {
    category: AlertCategory.OTHER,
    severity: fused.severity,
    confidence: fused.confidence,
    summary: `Computer vision detected ${vision!.totalDetectedObjects} visible object(s); semantic classification was unavailable.`,
    reasoningSummary: 'This cautious vision-only result requires human review and does not infer incident intent.',
    analysisMode: 'VISION_ONLY',
    provider: 'vision-service',
    model: vision!.detectorModel,
    pipelineVersion: 'multimodal-v1',
    vision,
    fusion: fused.fusion,
    totalProcessingTimeMs: Date.now() - pipelineStartedAt,
  };
};
