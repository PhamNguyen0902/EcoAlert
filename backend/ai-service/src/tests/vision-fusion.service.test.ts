import assert from 'node:assert/strict';
import test from 'node:test';
import { AlertCategory, IAiVisionAnalysis, Severity } from '@ecoalert/shared';
import { fuseIncidentEvidence, severityFromScore } from '../services/vision-fusion.service';

const semantic = {
  category: AlertCategory.ILLEGAL_DUMPING,
  severity: Severity.MEDIUM,
  confidence: 0.9,
  summary: 'Dumped waste.',
  reasoningSummary: 'The report describes dumped waste.',
  analysisMode: 'vision' as const,
  provider: 'openrouter' as const,
  model: 'openai/gpt-4o-mini',
};

const vision = (overrides: Partial<IAiVisionAnalysis> = {}): IAiVisionAnalysis => ({
  status: 'COMPLETED',
  detectorModel: 'yolo26n.pt',
  detections: [],
  objectCounts: [],
  totalDetectedObjects: 0,
  visibleWasteCoverage: null,
  detectorConfidence: 0.8,
  segmentationConfidence: null,
  processingTimeMs: 100,
  detectionTimeMs: 70,
  segmentationTimeMs: 0,
  annotationTimeMs: 20,
  warnings: [],
  ...overrides,
});

test('severity score thresholds are deterministic', () => {
  assert.equal(severityFromScore(24), Severity.LOW);
  assert.equal(severityFromScore(25), Severity.MEDIUM);
  assert.equal(severityFromScore(50), Severity.HIGH);
  assert.equal(severityFromScore(75), Severity.CRITICAL);
});

test('full multimodal fusion preserves separate confidence and exact factors', () => {
  const result = fuseIncidentEvidence(semantic, vision({
    totalDetectedObjects: 12,
    visibleWasteCoverage: 0.3,
  }));
  assert.equal(result.fusion.mode, 'FULL_MULTIMODAL');
  assert.equal(result.fusion.severityScore, 51);
  assert.equal(result.severity, Severity.HIGH);
  assert.equal(result.fusion.semanticConfidence, 0.9);
  assert.equal(result.fusion.visionConfidence, 0.8);
  assert.equal(result.fusion.fusionConfidence, 0.8775);
  assert.deepEqual(result.fusion.severityFactors.map((item) => item.score), [40, 6, 5]);
});

test('box area is never substituted when segmentation coverage is unavailable', () => {
  const result = fuseIncidentEvidence(semantic, vision({ visibleWasteCoverage: null }));
  assert.equal(result.fusion.severityScore, 40);
  assert.ok(result.fusion.explanations.some((text) => text.includes('not scored')));
});

test('vision-only confidence is capped for the general pretrained detector', () => {
  const result = fuseIncidentEvidence(undefined, vision({ detectorConfidence: 0.99 }));
  assert.equal(result.fusion.mode, 'VISION_ONLY');
  assert.equal(result.confidence, 0.6);
});

test('dominant waste type uses detector evidence without altering exact object counts', () => {
  const evidence = vision({
    totalDetectedObjects: 5,
    objectCounts: [{ label: 'plastic_bottle', count: 3 }, { label: 'metal_can', count: 2 }],
    detections: [
      ...Array.from({ length: 3 }, () => ({ wasteType: 'PLASTIC_WASTE', maskAreaPixels: 100 })),
      ...Array.from({ length: 2 }, () => ({ wasteType: 'METAL_WASTE', maskAreaPixels: 50 })),
    ] as any,
  });
  const result = fuseIncidentEvidence(semantic, evidence);
  assert.equal(result.fusion.wasteType, 'PLASTIC_WASTE');
  assert.equal(evidence.totalDetectedObjects, 5);
  assert.deepEqual(evidence.objectCounts, [
    { label: 'plastic_bottle', count: 3 },
    { label: 'metal_can', count: 2 },
  ]);
});
