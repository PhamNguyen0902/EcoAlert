import assert from 'node:assert/strict';
import test from 'node:test';
import { AlertCategory, IAiAnalysisCompletedData, Severity } from '@ecoalert/shared';
import { alertRepository } from '../repositories/alert.repository';
import { rabbitMQService } from '../services/rabbitmq.service';
import { alertService } from '../services/alert.service';
import { aiAnalysisCompletedSchema } from '../services/rabbitmq.service';
import { Alert } from '../models/alert.model';

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
    assert.equal(capturedUpdate.$set.category, 'UNCLASSIFIED');
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

test('overall semantic analysis persists canonical category suggestion and concise summary', async () => {
  const multimodal: IAiAnalysisCompletedData = {
    ...analysis(),
    category: AlertCategory.ILLEGAL_DUMPING,
    confidence: 0.88,
    analysisMode: 'FULL_MULTIMODAL',
    pipelineVersion: 'multimodal-v2',
    overallAnalysis: {
      isIncident: true,
      incidentConfidence: 0.91,
      categorySuggestion: AlertCategory.ILLEGAL_DUMPING,
      categoryConfidence: 0.88,
      classificationStatus: 'AI_SUGGESTED',
      confidenceTier: 'HIGH_CONFIDENCE',
      severity: Severity.HIGH,
      severityScore: 65,
      severityConfidence: 0.82,
      overallSummary: 'The image plausibly shows accumulated waste in a public area. The report supports environmental review.',
      shortReason: 'Visible waste objects and the report are consistent with illegal dumping.',
      overallSummaryLocalized: {
        vi: 'Ảnh cho thấy rác tập kết ở khu vực công cộng và cần được xem xét môi trường.',
        en: 'The image plausibly shows accumulated waste in a public area and requires environmental review.',
      },
      shortReasonLocalized: {
        vi: 'Các vật thể rác nhìn thấy phù hợp với nội dung báo cáo.',
        en: 'Visible waste objects are consistent with the report.',
      },
      visionEvidenceUsed: ['plastic_bag × 3', 'plastic_bottle × 2'],
      semanticModel: 'openai/gpt-4o-mini',
      pipelineVersion: 'multimodal-v2',
    },
  };
  assert.equal(aiAnalysisCompletedSchema.parse(multimodal).overallAnalysis?.categorySuggestion, AlertCategory.ILLEGAL_DUMPING);

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
    assert.equal(capturedUpdate.$set.classification.aiSuggestedCategory, AlertCategory.ILLEGAL_DUMPING);
    assert.equal(capturedUpdate.$set.aiOverallAnalysis.overallSummary, multimodal.overallAnalysis?.overallSummary);
    assert.equal(capturedUpdate.$set.aiOverallAnalysis.overallSummaryLocalized.vi, multimodal.overallAnalysis?.overallSummaryLocalized?.vi);
    assert.equal(capturedUpdate.$set.category, 'UNCLASSIFIED');
  } finally {
    repository.findById = originalFindById;
    repository.findOneAndUpdate = originalFindOneAndUpdate;
    rabbit.publishEvent = originalPublish;
  }
});

test('UNCLASSIFIED semantic analysis never forces a final incident category', async () => {
  const safe = aiAnalysisCompletedSchema.parse({
    ...analysis(),
    category: 'UNCLASSIFIED',
    confidence: 0.2,
    pipelineVersion: 'multimodal-v2',
    overallAnalysis: {
      isIncident: false, incidentConfidence: 0.2, categorySuggestion: null, categoryConfidence: 0.2,
      classificationStatus: 'UNCLASSIFIED', confidenceTier: 'UNCLASSIFIED', severity: Severity.LOW,
      severityScore: 10, severityConfidence: 0.6,
      overallSummary: 'The image does not provide enough evidence to identify an environmental incident.',
      shortReason: 'The available evidence is insufficient for a category suggestion.',
      visionEvidenceUsed: [], semanticModel: 'openai/gpt-4o-mini', pipelineVersion: 'multimodal-v2',
    },
  });
  assert.equal(safe.category, 'UNCLASSIFIED');
  assert.equal(safe.overallAnalysis?.classificationStatus, 'UNCLASSIFIED');
});

test('VISION_ONLY preserves null semantic confidence and severity while retaining detector evidence', async () => {
  const visionOnly: IAiAnalysisCompletedData = {
    ...analysis(),
    category: 'UNCLASSIFIED',
    severity: null,
    confidence: null,
    displayConfidenceSource: 'NONE',
    summary: null,
    reasoningSummary: null,
    analysisMode: 'VISION_ONLY',
    provider: 'vision-service',
    model: 'ecoalert-waste-yolo26n-v1.pt',
    pipelineVersion: 'multimodal-v2',
    vision: {
      status: 'COMPLETED', detectorModel: 'ecoalert-waste-yolo26n-v1.pt',
      detections: [], objectCounts: [{ label: 'plastic_bag', count: 14 }], totalDetectedObjects: 14,
      visibleWasteCoverage: null, detectorConfidence: 0.63, segmentationConfidence: null,
      processingTimeMs: 20, detectionTimeMs: 12, segmentationTimeMs: 0, annotationTimeMs: 5, warnings: [],
    },
    fusion: {
      version: 'vision-fusion-v2', mode: 'VISION_ONLY', severityScore: null, severityFactors: [],
      explanations: [], semanticConfidence: null, visionConfidence: 0.63, fusionConfidence: null,
      processingTimeMs: 1,
    },
  };
  assert.equal(aiAnalysisCompletedSchema.parse(visionOnly).confidence, null);

  const repository = alertRepository as any;
  const rabbit = rabbitMQService as any;
  const originalFindById = repository.findById;
  const originalFindOneAndUpdate = repository.findOneAndUpdate;
  const originalPublish = rabbit.publishEvent;
  let capturedUpdate: any;
  try {
    repository.findById = async () => ({ _id: visionOnly.alertId, status: 'pending' });
    repository.findOneAndUpdate = async (_filter: unknown, update: unknown) => {
      capturedUpdate = update;
      return { _id: visionOnly.alertId };
    };
    rabbit.publishEvent = async () => undefined;
    await alertService.internalUpdateAiResult(visionOnly.alertId, visionOnly);
    assert.equal(capturedUpdate.$set.category, 'UNCLASSIFIED');
    assert.equal(capturedUpdate.$set.aiConfidence, null);
    assert.equal(capturedUpdate.$set.aiConfidenceSource, 'NONE');
    assert.equal(capturedUpdate.$set.classification.aiConfidence, null);
    assert.equal(capturedUpdate.$set.severity, null);
    assert.equal(capturedUpdate.$set.aiSummary, null);
    assert.equal(capturedUpdate.$set.aiVision.detectorConfidence, 0.63);
    assert.match(capturedUpdate.$push.timeline.note, /Semantic confidence: Not available/);
    assert.doesNotMatch(capturedUpdate.$push.timeline.note, /Confidence: 0%/);
  } finally {
    repository.findById = originalFindById;
    repository.findOneAndUpdate = originalFindOneAndUpdate;
    rabbit.publishEvent = originalPublish;
  }
});

test('VISION_ONLY fusion evidence with no semantic severity score is valid for Mongo persistence', () => {
  const alert = new Alert({
    title: 'Roadside waste',
    description: 'A citizen reported visible roadside waste.',
    citizenId: 'citizen-1',
    mediaUrls: ['https://example.com/evidence.jpg'],
    location: { type: 'Point', coordinates: [106.7, 10.7] },
    aiFusion: {
      version: 'vision-fusion-v2',
      mode: 'VISION_ONLY',
      severityScore: null,
      severityFactors: [],
      explanations: [],
      semanticConfidence: null,
      visionConfidence: 0.63,
      fusionConfidence: null,
      processingTimeMs: 1,
    },
  });

  const validationError = alert.validateSync();
  assert.equal(validationError?.errors['aiFusion.severityScore'], undefined);
});
