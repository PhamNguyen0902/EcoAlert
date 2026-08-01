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
