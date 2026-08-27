import assert from 'node:assert/strict';
import test from 'node:test';
import { AlertCategory, EVENTS, IEventMessage, Severity } from '@ecoalert/shared';
import { AlertCreatedProcessorDependencies, settleAlertCreatedMessage } from '../services/rabbitmq.service';

const message = (): any => ({ content: Buffer.from(JSON.stringify({
  eventId: 'created-1', eventType: EVENTS.ALERT_CREATED, timestamp: new Date(0).toISOString(),
  source: 'alert-service', correlationId: 'correlation-1',
  data: { _id: 'alert-1', title: 'Rác ven đường', description: 'Có rác ở vỉa hè.', mediaUrls: ['https://example.com/evidence.jpg'] },
} satisfies IEventMessage<unknown>)) });

test('publishes the direct OpenRouter result before acknowledging the report event', async () => {
  const order: string[] = [];
  let published: any;
  const dependencies: AlertCreatedProcessorDependencies = {
    analyze: async () => ({
      category: AlertCategory.ILLEGAL_DUMPING, severity: Severity.HIGH, confidence: 0.8,
      displayConfidenceSource: 'CATEGORY', summary: 'Rác tập trung ven đường.', reasoningSummary: 'Ảnh và mô tả phù hợp.',
      analysisMode: 'IMAGE_AND_TEXT', provider: 'openrouter', model: 'openai/gpt-4o-mini',
      pipelineVersion: 'openrouter-multimodal-v1', processingTimeMs: 12,
    }),
    publish: async (routingKey, data) => { order.push('publish'); assert.equal(routingKey, EVENTS.AI_ANALYZED); published = data; },
  };
  const result = await settleAlertCreatedMessage(message(), { ack: () => order.push('ack'), nack: () => order.push('nack') } as any, dependencies);
  assert.equal(result.acknowledged, true);
  assert.deepEqual(order, ['publish', 'ack']);
  assert.equal(published.analysisMode, 'IMAGE_AND_TEXT');
});

test('publishes FAILED instead of dropping a report when OpenRouter is unavailable', async () => {
  let published: any;
  const dependencies: AlertCreatedProcessorDependencies = {
    analyze: async () => { throw new Error('provider unavailable'); },
    publish: async (_routingKey, data) => { published = data; },
  };
  const result = await settleAlertCreatedMessage(message(), { ack: () => undefined, nack: () => assert.fail('must not nack a provider outage') } as any, dependencies);
  assert.equal(result.acknowledged, true);
  assert.equal(published.analysisMode, 'FAILED');
  assert.equal(published.confidence, null);
  assert.match(published.failureReason, /OpenRouter/);
});
