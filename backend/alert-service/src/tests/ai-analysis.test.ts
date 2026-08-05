import assert from 'node:assert/strict';
import test from 'node:test';
import { AlertCategory, IAiAnalysisCompletedData, Severity } from '@ecoalert/shared';
import { alertRepository } from '../repositories/alert.repository';
import { rabbitMQService } from '../services/rabbitmq.service';
import { alertService } from '../services/alert.service';
import { aiAnalysisCompletedSchema } from '../services/rabbitmq.service';

const analysis = (): IAiAnalysisCompletedData => ({
  alertId: '507f1f77bcf86cd799439011',
  analysisId: 'analysis-event-1',
  category: AlertCategory.ILLEGAL_DUMPING,
  severity: Severity.HIGH,
  confidence: 0,
  summary: 'Waste was dumped beside a residential road.',
  reasoningSummary: 'The report explicitly describes roadside dumping near homes.',
  analysisMode: 'text',
  provider: 'openrouter',
  model: 'openai/gpt-4o-mini',
});

test('AI event validation accepts confidence zero and rejects arbitrary enum values', () => {
  const valid = aiAnalysisCompletedSchema.parse(analysis());
  assert.equal(valid.confidence, 0);
  assert.throws(() => aiAnalysisCompletedSchema.parse({
    ...analysis(),
    category: 'invented_category',
  }));
  assert.throws(() => aiAnalysisCompletedSchema.parse({
    ...analysis(),
    severity: 'normal',
  }));
});

test('AI event validation rejects generic detector evidence', () => {
  assert.throws(() => aiAnalysisCompletedSchema.parse({
    ...analysis(),
    analysisMode: 'FULL_MULTIMODAL',
    pipelineVersion: 'multimodal-v1',
    vision: {
      status: 'COMPLETED', detectorModel: 'yolo26n.pt',
      detections: [{
        classId: 0, label: 'person', confidence: 0.9,
        bbox: { x: 0, y: 0, width: 10, height: 10 },
        normalizedBbox: { x: 0, y: 0, width: 0.5, height: 1 },
      }],
      objectCounts: [{ label: 'person', count: 1 }], totalDetectedObjects: 1,
      visibleWasteCoverage: null, detectorConfidence: 0.9,
      segmentationConfidence: null, processingTimeMs: 20,
      detectionTimeMs: 12, segmentationTimeMs: 0, annotationTimeMs: 5, warnings: [],
    },
  }));
});

test('valid category, severity, confidence, and metadata are included in persistence update', async () => {
  const repository = alertRepository as any;
  const rabbit = rabbitMQService as any;
  const originalFindById = repository.findById;
  const originalFindOneAndUpdate = repository.findOneAndUpdate;
  const originalPublish = rabbit.publishEvent;
  let capturedUpdate: any;

  try {
    repository.findById = async () => ({
      _id: analysis().alertId,
      status: 'pending',
      aiAnalysisId: undefined,
    });
    repository.findOneAndUpdate = async (_filter: unknown, update: unknown) => {
      capturedUpdate = update;
      return { _id: analysis().alertId, ...(update as any).$set };
    };
    rabbit.publishEvent = async () => undefined;

    const updated = await alertService.internalUpdateAiResult(
      analysis().alertId,
      analysis(),
    );

    assert.ok(updated);
    assert.equal(capturedUpdate.$set.category, AlertCategory.ILLEGAL_DUMPING);
    assert.equal(capturedUpdate.$set.severity, Severity.HIGH);
    assert.equal(capturedUpdate.$set.aiConfidence, 0);
    assert.equal(capturedUpdate.$set.aiAnalysisId, 'analysis-event-1');
    assert.equal(capturedUpdate.$set.aiSummary, analysis().summary);
    assert.equal(capturedUpdate.$set.aiReasoningSummary, analysis().reasoningSummary);
  } finally {
    repository.findById = originalFindById;
    repository.findOneAndUpdate = originalFindOneAndUpdate;
    rabbit.publishEvent = originalPublish;
  }
});

test('replaying the same analysis ID does not issue another database update', async () => {
  const repository = alertRepository as any;
  const originalFindById = repository.findById;
  const originalFindOneAndUpdate = repository.findOneAndUpdate;
  let updateCalls = 0;

  try {
    repository.findById = async () => ({
      _id: analysis().alertId,
      status: 'ai_analyzing',
      aiAnalysisId: analysis().analysisId,
    });
    repository.findOneAndUpdate = async () => {
      updateCalls += 1;
      return null;
    };

    const result = await alertService.internalUpdateAiResult(
      analysis().alertId,
      analysis(),
    );

    assert.ok(result);
    assert.equal(updateCalls, 0);
  } finally {
    repository.findById = originalFindById;
    repository.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test('structured multimodal evidence is validated and included in the additive update', async () => {
  const multimodal: IAiAnalysisCompletedData = {
    ...analysis(),
    analysisMode: 'FULL_MULTIMODAL',
    pipelineVersion: 'multimodal-v1',
    vision: {
      status: 'COMPLETED', detectorModel: 'ecoalert-waste-yolo26n-v1.pt', detections: [], objectCounts: [],
      totalDetectedObjects: 0, visibleWasteCoverage: null, detectorConfidence: null,
      segmentationConfidence: null, processingTimeMs: 20,
      detectionTimeMs: 12, segmentationTimeMs: 0, annotationTimeMs: 5, warnings: [],
    },
    fusion: {
      version: 'vision-fusion-v1', mode: 'FULL_MULTIMODAL', severityScore: 65,
      severityFactors: [{ factor: 'semantic_severity', score: 65, evidenceSource: 'semantic', explanation: 'High baseline.' }],
      explanations: ['High baseline.'], semanticConfidence: 0, visionConfidence: null,
      fusionConfidence: 0,
      processingTimeMs: 1,
    },
  };
  assert.equal(aiAnalysisCompletedSchema.parse(multimodal).vision?.detectorModel, 'ecoalert-waste-yolo26n-v1.pt');

  const repository = alertRepository as any;
  const rabbit = rabbitMQService as any;
  const originalFindById = repository.findById;
  const originalFindOneAndUpdate = repository.findOneAndUpdate;
  const originalPublish = rabbit.publishEvent;
  let capturedUpdate: any;
  try {
    repository.findById = async () => ({ _id: multimodal.alertId, status: 'pending' });
    repository.findOneAndUpdate = async (_filter: unknown, update: unknown) => {
      capturedUpdate = update;
      return { _id: multimodal.alertId };
    };
    rabbit.publishEvent = async () => undefined;
    await alertService.internalUpdateAiResult(multimodal.alertId, multimodal);
    assert.equal(capturedUpdate.$set.aiPipelineVersion, 'multimodal-v1');
    assert.equal(capturedUpdate.$set.aiVision.detectorModel, 'ecoalert-waste-yolo26n-v1.pt');
    assert.equal(capturedUpdate.$set.aiFusion.severityScore, 65);
  } finally {
    repository.findById = originalFindById;
    repository.findOneAndUpdate = originalFindOneAndUpdate;
    rabbit.publishEvent = originalPublish;
  }
});
