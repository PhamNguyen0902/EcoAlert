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
  analysisMode: 'vision' as const,
  provider: 'openrouter' as const,
  model: 'openai/gpt-4o-mini',
});
const vision = async () => ({
  status: 'COMPLETED' as const,
  detectorModel: 'yolo26n.pt',
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
});

test('semantic failure degrades to cautious vision-only review', async () => {
  const result = await analyzeMultimodalIncident(input, {
    visionEnabled: true,
    analyzeSemantic: async () => { throw new Error('GPT unavailable'); },
    analyzeVision: async () => ({ ...(await vision()), detectorConfidence: 0.95 }),
  });
  assert.equal(result.analysisMode, 'VISION_ONLY');
  assert.equal(result.category, AlertCategory.OTHER);
  assert.equal(result.confidence, 0.6);
});

test('both branch failures reject the analysis', async () => {
  await assert.rejects(() => analyzeMultimodalIncident(input, {
    visionEnabled: true,
    analyzeSemantic: async () => { throw new Error('GPT unavailable'); },
    analyzeVision: async () => { throw new Error('Vision unavailable'); },
  }), AggregateError);
});
