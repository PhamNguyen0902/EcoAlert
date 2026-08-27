import assert from 'node:assert/strict';
import test from 'node:test';
import { AlertCategory, IAiAnalysisCompletedData, Severity } from '@ecoalert/shared';
import { alertRepository } from '../repositories/alert.repository';
import { rabbitMQService } from '../services/rabbitmq.service';
import { aiAnalysisCompletedSchema } from '../services/rabbitmq.service';
import { alertService } from '../services/alert.service';

const analysis = (): IAiAnalysisCompletedData => ({
  alertId: '507f1f77bcf86cd799439011', analysisId: 'analysis-1', category: AlertCategory.ILLEGAL_DUMPING,
  severity: Severity.HIGH, confidence: 0.82, displayConfidenceSource: 'CATEGORY',
  summary: 'Rác tập trung ven đường.', reasoningSummary: 'Ảnh và mô tả phù hợp.',
  analysisMode: 'IMAGE_AND_TEXT', provider: 'openrouter', model: 'openai/gpt-4o-mini', pipelineVersion: 'openrouter-multimodal-v1',
  overallAnalysis: {
    isIncident: true, incidentConfidence: 0.86, categorySuggestion: AlertCategory.ILLEGAL_DUMPING,
    categoryConfidence: 0.82, classificationStatus: 'AI_SUGGESTED', confidenceTier: 'HIGH_CONFIDENCE',
    severity: Severity.HIGH, severityScore: 70, severityConfidence: 0.8,
    overallSummary: 'Rác tập trung ven đường.', shortReason: 'Ảnh và mô tả phù hợp.',
    semanticModel: 'openai/gpt-4o-mini', pipelineVersion: 'openrouter-multimodal-v1',
  },
});

test('accepts the direct OpenRouter payload and rejects removed properties', () => {
  assert.equal(aiAnalysisCompletedSchema.parse(analysis()).analysisMode, 'IMAGE_AND_TEXT');
  assert.throws(() => aiAnalysisCompletedSchema.parse({ ...analysis(), deprecatedPayload: {} }));
});

test('persists FAILED analysis as unavailable while keeping the report pending', async () => {
  const repository = alertRepository as any;
  const rabbit = rabbitMQService as any;
  const originalFindById = repository.findById;
  const originalFindOneAndUpdate = repository.findOneAndUpdate;
  const originalPublish = rabbit.publishEvent;
  let update: any;
  try {
    repository.findById = async () => ({ _id: analysis().alertId, status: 'pending' });
    repository.findOneAndUpdate = async (_filter: unknown, value: unknown) => { update = value; return { _id: analysis().alertId }; };
    rabbit.publishEvent = async () => undefined;
    await alertService.internalUpdateAiResult(analysis().alertId, {
      ...analysis(), category: 'UNCLASSIFIED', severity: null, confidence: null, summary: null, reasoningSummary: null,
      analysisMode: 'FAILED', model: 'unavailable', overallAnalysis: undefined,
      displayConfidenceSource: 'NONE', failureReason: 'Dịch vụ OpenRouter tạm thời không khả dụng.',
    });
    assert.equal(update.$set.aiConfidence, null);
    assert.equal(update.$set.aiFailureReason, 'Dịch vụ OpenRouter tạm thời không khả dụng.');
    assert.equal(update.$set.status, 'pending');
  } finally {
    repository.findById = originalFindById;
    repository.findOneAndUpdate = originalFindOneAndUpdate;
    rabbit.publishEvent = originalPublish;
  }
});
