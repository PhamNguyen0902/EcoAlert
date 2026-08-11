import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveOverallAiConfidence } from '@ecoalert/shared';

test('FULL_MULTIMODAL prefers a real fusion metric without using detector confidence', () => {
  const result = resolveOverallAiConfidence({
    analysisMode: 'FULL_MULTIMODAL',
    fusion: { fusionConfidence: 0.84 },
    overallAnalysis: { categoryConfidence: 0.88, incidentConfidence: 0.9 },
  });
  assert.deepEqual(result, { value: 0.84, source: 'FUSION' });
});

test('SEMANTIC_ONLY uses category confidence', () => {
  assert.deepEqual(resolveOverallAiConfidence({
    analysisMode: 'SEMANTIC_ONLY',
    overallAnalysis: { categoryConfidence: 0.85, incidentConfidence: 0.9 },
  }), { value: 0.85, source: 'CATEGORY' });
});

test('VISION_ONLY leaves top-level confidence unavailable even with detector evidence', () => {
  assert.deepEqual(resolveOverallAiConfidence({
    analysisMode: 'VISION_ONLY',
    confidence: 0.63,
    fusion: { fusionConfidence: 0.63 },
  }), { value: null, source: 'NONE' });
});

test('a real model confidence zero remains a measured zero', () => {
  assert.deepEqual(resolveOverallAiConfidence({ analysisMode: 'SEMANTIC_ONLY', confidence: 0 }), {
    value: 0,
    source: 'CATEGORY',
  });
});

test('null confidence remains unavailable', () => {
  assert.deepEqual(resolveOverallAiConfidence({ analysisMode: 'SEMANTIC_ONLY', confidence: null }), {
    value: null,
    source: 'NONE',
  });
});
