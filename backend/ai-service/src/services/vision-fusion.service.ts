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

const isWasteCategory = (category?: AlertCategory | 'UNCLASSIFIED') =>
  category === AlertCategory.ILLEGAL_DUMPING || category === AlertCategory.ILLEGAL_CONSTRUCTION_WASTE;

const determineVisionSupport = (
  semantic?: IncidentAnalysisResult,
  vision?: IAiVisionAnalysis,
): IAiFusionAnalysis['visionSupport'] => {
  if (!semantic || !vision || vision.status !== 'COMPLETED') return 'NOT_APPLICABLE';
  if (!isWasteCategory(semantic.category)) return 'NOT_APPLICABLE';
  if (vision.totalDetectedObjects >= 3) return 'STRONG';
  if (vision.totalDetectedObjects > 0) return 'PARTIAL';
  return 'NONE';
};

export const fuseIncidentEvidence = (
  semantic: IncidentAnalysisResult | undefined,
  vision: IAiVisionAnalysis | undefined,
): { severity: Severity | null; fusion: IAiFusionAnalysis } => {
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
  const semanticConfidence = semantic?.incidentConfidence ?? null;
  const visionConfidence = vision?.detectorConfidence ?? null;
  let fusionConfidence: number | null = null;
  let mode: IAiFusionAnalysis['mode'];
  if (semantic && vision) {
    mode = 'FULL_MULTIMODAL';
  } else if (semantic) {
    mode = 'SEMANTIC_ONLY';
  } else if (vision) {
    mode = 'VISION_ONLY';
  } else {
    mode = 'FAILED';
  }

  const explanations = factors.map((factor) => factor.explanation);
  if (vision && vision.visibleWasteCoverage === null) {
    explanations.push('Pixel coverage was not scored because segmentation evidence is unavailable.');
  }
  const visionSupport = determineVisionSupport(semantic, vision);
  if (visionSupport === 'STRONG') explanations.push('Detected EcoAlert waste objects strongly support the semantic waste interpretation.');
  if (visionSupport === 'PARTIAL') explanations.push('Detected EcoAlert waste objects provide partial support for the semantic waste interpretation.');
  if (visionSupport === 'NONE') explanations.push('No EcoAlert waste objects were detected; the semantic waste interpretation remains advisory and requires human review.');
  return {
    // Vision evidence can support review, but does not independently establish
    // an incident-level severity without semantic analysis.
    severity: semantic ? severityFromScore(score) : null,
    fusion: {
      version: 'vision-fusion-v2',
      mode,
      wasteType,
      severityScore: semantic ? score : null,
      severityFactors: factors,
      explanations,
      semanticConfidence,
      visionConfidence,
      // The current fusion layer reconciles severity/evidence only; it does
      // not calculate a distinct cross-signal confidence metric.
      fusionConfidence,
      visionSupport,
      processingTimeMs: Date.now() - startedAt,
    },
  };
};
