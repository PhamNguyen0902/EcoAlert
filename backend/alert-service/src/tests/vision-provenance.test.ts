import test from 'node:test';
import assert from 'node:assert/strict';
import { visionEvidenceSchema } from '../dtos/vision.schema';
import { Alert } from '../models/alert.model';

test('report validation and persistence keep sources without requiring a DB migration', () => {
  const evidence = { imageUrl: 'https://example.com/image.jpg', status: 'ok', requiresManualReview: true,
    degraded: true, model_errors: { ecoalert_general: 'failed' }, detections: [{
      materialClass: 'plastic', suggestedCategory: 'other', confidence: .81, bbox: [0, 1, 20, 30],
      model_id: 'asian_waste', original_class_name: 'Plastic', original_class_id: 7, needs_review: true,
      sources: [{ model_id: 'asian_waste', original_class_name: 'Plastic', original_class_id: 7, confidence: .81, bbox: [0, 1, 20, 30] }],
    }] };
  const parsed = visionEvidenceSchema.parse(evidence);
  assert.deepEqual(parsed, evidence);
  const document = new Alert({ visionEvidence: [parsed] });
  const value = document.toObject({ flattenMaps: true }).visionEvidence![0];
  assert.equal(value.detections[0].model_id, 'asian_waste');
  assert.equal(value.detections[0].sources![0].original_class_id, 7);
  assert.equal(value.detections[0].confidence, .81);
  assert.equal(value.model_errors!.ecoalert_general, 'failed');
});

test('legacy evidence still validates without metadata', () => {
  const value = visionEvidenceSchema.parse({ imageUrl: 'https://example.com/image.jpg', status: 'ok',
    requiresManualReview: false, detections: [{ materialClass: 'plastic_bottle', confidence: .9, bbox: [0, 0, 10, 10] }] });
  assert.equal(value.detections[0].model_id, undefined);
});
