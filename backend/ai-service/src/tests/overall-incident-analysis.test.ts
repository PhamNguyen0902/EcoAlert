import assert from 'node:assert/strict';
import test from 'node:test';
import { AlertCategory, Severity } from '@ecoalert/shared';
import { parseIncidentAnalysis } from '../services/openrouter.service';
import { buildCompactVisionEvidence, formatVisionEvidenceLines } from '../services/vision-evidence.service';

const semanticPayload = (overrides: Record<string, unknown> = {}) => JSON.stringify({
  isIncident: true,
  incidentConfidence: 0.92,
  category: 'illegal_dumping',
  categoryConfidence: 0.88,
  severity: 'medium',
  severityScore: 52,
  severityConfidence: 0.81,
  overallSummary: 'The image plausibly shows accumulated waste in a public area. The report and visible objects support environmental review.',
  shortReason: 'Multiple visible waste objects are consistent with the report.',
  visionEvidenceUsed: ['plastic_bag × 3', 'plastic_bottle × 2'],
  ...overrides,
});

test('canonical and supported display-name categories normalize to EcoAlert codes', () => {
  assert.equal(parseIncidentAnalysis(semanticPayload()).category, AlertCategory.ILLEGAL_DUMPING);
  assert.equal(parseIncidentAnalysis(semanticPayload({ category: 'Waste' })).category, AlertCategory.ILLEGAL_DUMPING);
  assert.equal(parseIncidentAnalysis(semanticPayload({ category: 'FLOOD' })).category, AlertCategory.FLOODING);
});

test('unsupported and low-confidence categories become UNCLASSIFIED', () => {
  assert.equal(parseIncidentAnalysis(semanticPayload({ category: 'road_environment' })).category, 'UNCLASSIFIED');
  assert.equal(parseIncidentAnalysis(semanticPayload({ category: null })).category, 'UNCLASSIFIED');
  const lowConfidence = parseIncidentAnalysis(semanticPayload({ categoryConfidence: 0.42 }));
  assert.equal(lowConfidence.classificationStatus, 'UNCLASSIFIED');
  assert.equal(lowConfidence.categoryConfidence, 0.42);
});

test('invalid JSON is rejected for the caller to handle safely', () => {
  assert.throws(() => parseIncidentAnalysis('not-json'));
});

test('compact Vision evidence aggregates counts and highest confidence without bounding boxes', () => {
  const evidence = buildCompactVisionEvidence({
    status: 'COMPLETED', detectorModel: 'ecoalert-waste-yolo26n-v1.pt', imageWidth: 100, imageHeight: 100,
    detections: [
      { classId: 0, label: 'plastic_bottle', confidence: 0.81, bbox: { x: 1, y: 1, width: 3, height: 3 }, normalizedBbox: { x: 0.01, y: 0.01, width: 0.03, height: 0.03 } },
      { classId: 0, label: 'plastic_bottle', confidence: 0.91, bbox: { x: 2, y: 2, width: 3, height: 3 }, normalizedBbox: { x: 0.02, y: 0.02, width: 0.03, height: 0.03 } },
      { classId: 1, label: 'plastic_bag', confidence: 0.86, bbox: { x: 3, y: 3, width: 3, height: 3 }, normalizedBbox: { x: 0.03, y: 0.03, width: 0.03, height: 0.03 } },
    ],
    objectCounts: [{ label: 'plastic_bottle', count: 2 }, { label: 'plastic_bag', count: 1 }], totalDetectedObjects: 3,
    visibleWasteCoverage: null, detectorConfidence: 0.86, segmentationConfidence: null,
    processingTimeMs: 1, detectionTimeMs: 1, segmentationTimeMs: 0, annotationTimeMs: 0, warnings: [],
  });
  assert.deepEqual(evidence.objects, [
    { type: 'plastic_bottle', count: 2, maxConfidence: 0.91 },
    { type: 'plastic_bag', count: 1, maxConfidence: 0.86 },
  ]);
  assert.deepEqual(formatVisionEvidenceLines(evidence), ['plastic_bottle × 2 (max 91%)', 'plastic_bag × 1 (max 86%)']);
  assert.equal(JSON.stringify(evidence).includes('bbox'), false);
});

test('zero detections remain valid evidence for a semantic flooding interpretation', () => {
  const result = parseIncidentAnalysis(semanticPayload({
    category: AlertCategory.FLOODING,
    categoryConfidence: 0.89,
    overallSummary: 'The image plausibly shows flooding on a public road. Standing water may affect travel.',
    shortReason: 'The scene and report describe road flooding; waste detections are not required for this category.',
    visionEvidenceUsed: [],
    severity: Severity.MEDIUM,
  }));
  assert.equal(result.category, AlertCategory.FLOODING);
  assert.equal(result.classificationStatus, 'AI_SUGGESTED');
});
