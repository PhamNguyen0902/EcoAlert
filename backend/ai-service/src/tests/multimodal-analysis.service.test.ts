import assert from 'node:assert/strict';
import test from 'node:test';
import { AlertCategory, Severity } from '@ecoalert/shared';
import { analyzeMultimodalIncident } from '../services/multimodal-analysis.service';

const input = { alertId: 'alert-1', title: 'Waste', description: 'Waste on road', imageUrl: 'https://example.com/a.jpg' };
const semantic = async () => ({
  category: AlertCategory.ILLEGAL_DUMPING,
  severity: Severity.MEDIUM,
  confidence: 0.8,
  summary: 'Waste is visible.',
  reasoningSummary: 'Report and image describe dumping.',
  isIncident: true,
  incidentConfidence: 0.8,
  categoryConfidence: 0.8,
  classificationStatus: 'AI_SUGGESTED' as const,
  confidenceTier: 'HIGH_CONFIDENCE' as const,
  severityScore: 45,
  severityConfidence: 0.8,
  overallSummary: 'Waste is visible beside the road.',
  shortReason: 'The report and image support roadside dumping.',
  visionEvidenceUsed: [],
  analysisMode: 'vision' as const,
  provider: 'openrouter' as const,
  model: 'openai/gpt-4o-mini',
});
const vision = async () => ({
  status: 'COMPLETED' as const,
  detectorModel: 'ecoalert-waste-yolo26n-v1.pt',
  detections: [], objectCounts: [], totalDetectedObjects: 0,
  visibleWasteCoverage: null, detectorConfidence: null,
  segmentationConfidence: null, processingTimeMs: 10, warnings: [],
  detectionTimeMs: 6, segmentationTimeMs: 0, annotationTimeMs: 2,
});

test('disabled rollout preserves the existing semantic contract', async () => {
  const result = await analyzeMultimodalIncident(input, {
    visionEnabled: false, analyzeSemantic: semantic, analyzeVision: vision,
  });
  assert.equal(result.analysisMode, 'vision');
  assert.equal(result.pipelineVersion, undefined);
});

test('both successful branches produce a full multimodal result', async () => {
  const result = await analyzeMultimodalIncident(input, {
    visionEnabled: true, analyzeSemantic: semantic, analyzeVision: vision,
  });
  assert.equal(result.analysisMode, 'FULL_MULTIMODAL');
  assert.equal(result.vision?.status, 'COMPLETED');
  assert.equal(result.fusion?.semanticConfidence, 0.8);
  assert.equal(result.overallAnalysis?.categorySuggestion, AlertCategory.ILLEGAL_DUMPING);
  assert.equal(result.overallAnalysis?.visionEvidenceUsed.length, 0);
  assert.equal('isIncident' in result, false);
  assert.equal('overallSummary' in result, false);
});

test('Vision object evidence is supplied to semantic synthesis before fusion', async () => {
  let receivedObjects = 0;
  const result = await analyzeMultimodalIncident(input, {
    visionEnabled: true,
    analyzeVision: async () => ({
      ...(await vision()),
      totalDetectedObjects: 3,
      detectorConfidence: 0.86,
      detections: [
        ...Array.from({ length: 2 }, () => ({ classId: 1, label: 'plastic_bag', confidence: 0.86, bbox: { x: 0, y: 0, width: 1, height: 1 }, normalizedBbox: { x: 0, y: 0, width: 1, height: 1 } })),
        { classId: 0, label: 'plastic_bottle', confidence: 0.81, bbox: { x: 0, y: 0, width: 1, height: 1 }, normalizedBbox: { x: 0, y: 0, width: 1, height: 1 } },
      ],
      objectCounts: [{ label: 'plastic_bag', count: 2 }, { label: 'plastic_bottle', count: 1 }],
    }),
    analyzeSemantic: async (semanticInput) => {
      receivedObjects = semanticInput.visionEvidence?.totalObjects || 0;
      return semantic();
    },
  });
  assert.equal(receivedObjects, 3);
  assert.deepEqual(result.overallAnalysis?.visionEvidenceUsed, ['plastic_bag × 2 (max 86%)', 'plastic_bottle × 1 (max 81%)']);
});

test('zero Vision detections plus semantic flooding remains FULL_MULTIMODAL', async () => {
  const result = await analyzeMultimodalIncident(input, {
    visionEnabled: true,
    analyzeVision: vision,
    analyzeSemantic: async () => ({
      ...(await semantic()),
      category: AlertCategory.FLOODING,
      categoryConfidence: 0.89,
      confidence: 0.89,
      overallSummary: 'Flooding is visible on the public road.',
      summary: 'Flooding is visible on the public road.',
    }),
  });
  assert.equal(result.analysisMode, 'FULL_MULTIMODAL');
  assert.equal(result.category, AlertCategory.FLOODING);
  assert.deepEqual(result.overallAnalysis?.visionEvidenceUsed, []);
});

test('vision failure preserves semantic analysis as a semantic-only result', async () => {
  const result = await analyzeMultimodalIncident(input, {
    visionEnabled: true,
    analyzeSemantic: semantic,
    analyzeVision: async () => { throw new Error('Vision timeout'); },
  });
  assert.equal(result.analysisMode, 'SEMANTIC_ONLY');
  assert.equal(result.vision?.status, 'FAILED');
  assert.equal(result.vision?.detectorModel, 'ecoalert-waste-yolo26n-v1.pt');
  assert.equal(result.fusion?.semanticConfidence, 0.8);
  assert.equal(result.fusion?.visionConfidence, null);
});

test('semantic failure preserves Vision evidence without fabricating incident confidence or severity', async () => {
  const result = await analyzeMultimodalIncident(input, {
    visionEnabled: true,
    analyzeSemantic: async () => { throw new Error('GPT unavailable'); },
    analyzeVision: async () => ({
      ...(await vision()),
      detectorConfidence: 0.63,
      totalDetectedObjects: 14,
      objectCounts: [{ label: 'plastic_bag', count: 14 }],
      detections: Array.from({ length: 14 }, () => ({
        classId: 1, label: 'plastic_bag', confidence: 0.63,
        bbox: { x: 0, y: 0, width: 1, height: 1 }, normalizedBbox: { x: 0, y: 0, width: 1, height: 1 },
      })),
    }),
  });
  assert.equal(result.analysisMode, 'VISION_ONLY');
  assert.equal(result.category, 'UNCLASSIFIED');
  assert.equal(result.confidence, null);
  assert.equal(result.displayConfidenceSource, 'NONE');
  assert.equal(result.severity, null);
  assert.equal(result.fusion?.fusionConfidence, null);
  assert.equal(result.vision?.detectorConfidence, 0.63);
  assert.equal(result.vision?.objectCounts[0]?.count, 14);
  assert.equal(result.overallAnalysis, undefined);
});

test('both branch failures reject the analysis', async () => {
  await assert.rejects(() => analyzeMultimodalIncident(input, {
    visionEnabled: true,
    analyzeSemantic: async () => { throw new Error('GPT unavailable'); },
    analyzeVision: async () => { throw new Error('Vision unavailable'); },
  }), AggregateError);
});
