import {
  AlertCategory,
  AiWasteType,
  IAiFusionAnalysis,
  IAiSeverityFactor,
  IAiVisionAnalysis,
  Severity,
} from '@ecoalert/shared';
import { IncidentAnalysisResult } from './openrouter.service';

const SEMANTIC_BASE: Record<Severity, number> = {
  [Severity.LOW]: 15,
  [Severity.MEDIUM]: 40,
  [Severity.HIGH]: 65,
  [Severity.CRITICAL]: 90,
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export const severityFromScore = (score: number): Severity => {
  if (score >= 75) return Severity.CRITICAL;
  if (score >= 50) return Severity.HIGH;
  if (score >= 25) return Severity.MEDIUM;
  return Severity.LOW;
};

const deriveWasteType = (
  semantic?: IncidentAnalysisResult,
  vision?: IAiVisionAnalysis,
): AiWasteType | undefined => {
  const weights = new Map<AiWasteType, number>();
  for (const detection of vision?.detections || []) {
    if (!detection.wasteType) continue;
    weights.set(
      detection.wasteType,
      (weights.get(detection.wasteType) || 0) + (detection.maskAreaPixels || 1),
    );
  }
  const ranked = [...weights.entries()].sort((left, right) => right[1] - left[1]);
  if (ranked.length === 1) return ranked[0][0];
  if (ranked.length > 1) {
    const total = ranked.reduce((sum, [, weight]) => sum + weight, 0);
    return ranked[0][1] / total >= 0.6 ? ranked[0][0] : 'MIXED_WASTE';
  }
  if (semantic?.category === AlertCategory.ILLEGAL_CONSTRUCTION_WASTE) {
    return 'CONSTRUCTION_WASTE';
  }
  if (semantic?.category === AlertCategory.ILLEGAL_DUMPING) return 'OTHER';
  return undefined;
};

export const fuseIncidentEvidence = (
  semantic: IncidentAnalysisResult | undefined,
  vision: IAiVisionAnalysis | undefined,
): { severity: Severity; confidence: number; fusion: IAiFusionAnalysis } => {
  const startedAt = Date.now();
  const factors: IAiSeverityFactor[] = [];
  let score = 0;
  if (semantic) {
    const semanticScore = SEMANTIC_BASE[semantic.severity];
    score += semanticScore;
    factors.push({
      factor: 'semantic_severity',
      score: semanticScore,
      evidenceSource: 'semantic',
      explanation: `Semantic analysis established a ${semantic.severity} severity baseline.`,
    });
  }

  const coverage = vision?.visibleWasteCoverage;
  if (coverage !== null && coverage !== undefined) {
    const contribution = coverage >= 0.5 ? 10 : coverage >= 0.25 ? 6 : coverage >= 0.1 ? 3 : 0;
    if (contribution > 0) {
      score += contribution;
      factors.push({
        factor: 'visible_waste_coverage',
        score: contribution,
        evidenceSource: 'vision',
        explanation: `Segmented potential waste covers ${(coverage * 100).toFixed(1)}% of visible pixels.`,
      });
    }
  }

  const count = vision?.totalDetectedObjects || 0;
  const countContribution = count >= 20 ? 8 : count >= 10 ? 5 : count >= 3 ? 2 : 0;
  if (countContribution > 0) {
    score += countContribution;
    factors.push({
      factor: 'object_count',
      score: countContribution,
      evidenceSource: 'vision',
      explanation: `The detector found ${count} visible objects.`,
    });
  }

  const wasteType = deriveWasteType(semantic, vision);
  if (wasteType === 'HAZARDOUS_WASTE') {
    score += 10;
    factors.push({
      factor: 'hazardous_waste',
      score: 10,
      evidenceSource: 'vision',
      explanation: 'A hazardous-waste class was detected by the configured detector.',
    });
  }

  score = Math.round(clamp(score, 0, 100));
  const semanticConfidence = semantic?.confidence ?? null;
  const visionConfidence = vision?.detectorConfidence ?? null;
  let fusionConfidence: number;
  let mode: IAiFusionAnalysis['mode'];
  if (semantic && vision) {
    // Vision is capped because the shipped detector is a general COCO baseline.
    fusionConfidence = clamp(semantic.confidence * 0.85 + Math.min(visionConfidence || 0, 0.75) * 0.15);
    mode = 'FULL_MULTIMODAL';
  } else if (semantic) {
    fusionConfidence = semantic.confidence;
    mode = 'SEMANTIC_ONLY';
  } else if (vision) {
    fusionConfidence = Math.min(visionConfidence || 0, 0.6);
    mode = 'VISION_ONLY';
  } else {
    fusionConfidence = 0;
    mode = 'FAILED';
  }

  const explanations = factors.map((factor) => factor.explanation);
  if (vision && vision.visibleWasteCoverage === null) {
    explanations.push('Pixel coverage was not scored because segmentation evidence is unavailable.');
  }
  return {
    severity: severityFromScore(score),
    confidence: Number(fusionConfidence.toFixed(4)),
    fusion: {
      version: 'vision-fusion-v1',
      mode,
      wasteType,
      severityScore: score,
      severityFactors: factors,
      explanations,
      semanticConfidence,
      visionConfidence,
      fusionConfidence: Number(fusionConfidence.toFixed(4)),
      processingTimeMs: Date.now() - startedAt,
    },
  };
};
