import assert from 'node:assert/strict';
import test from 'node:test';
import { AlertCategory, EVENTS, IEventMessage, Severity } from '@ecoalert/shared';
import { AlertCreatedProcessorDependencies, settleAlertCreatedMessage } from '../services/rabbitmq.service';

const message = (): any => ({ content: Buffer.from(JSON.stringify({
  eventId: 'created-1', eventType: EVENTS.ALERT_CREATED, timestamp: new Date(0).toISOString(),
  source: 'alert-service', correlationId: 'correlation-1',
  data: { _id: 'alert-1', citizenId: 'citizen-1', title: 'Rác ven đường', description: 'Có rác ở vỉa hè.', mediaUrls: ['https://example.com/evidence.jpg'] },
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
    detectWaste: async (imageUrl) => ({ imageUrl, status: 'ok', detections: [], requiresManualReview: false }),
    publish: async (routingKey, data) => { order.push('publish'); assert.equal(routingKey, EVENTS.AI_ANALYZED); published = data; },
  };
  const result = await settleAlertCreatedMessage(message(), { ack: () => order.push('ack'), nack: () => order.push('nack') } as any, dependencies);
  assert.equal(result.acknowledged, true);
  assert.deepEqual(order, ['publish', 'ack']);
  assert.equal(published.analysisMode, 'IMAGE_AND_TEXT');
  assert.equal(published.citizenId, 'citizen-1');
  assert.equal(published.title, 'Rác ven đường');
  assert.equal(published.alertId, 'alert-1');
});

test('routes flooding to semantic-only while retaining independent photo detection', async () => {
  let detectionCalled = false;
  let published: any;
  const dependencies: AlertCreatedProcessorDependencies = {
    analyze: async () => ({ category: AlertCategory.FLOODING, severity: Severity.HIGH, confidence: 0.8, displayConfidenceSource: 'CATEGORY', summary: 'Ngập nước.', reasoningSummary: 'Nước ảnh hưởng giao thông.', analysisMode: 'IMAGE_AND_TEXT', provider: 'openrouter', model: 'openai/gpt-4o-mini', pipelineVersion: 'openrouter-multimodal-v1' }),
    detectWaste: async (imageUrl) => { detectionCalled = true; return { imageUrl, status: 'no_detection', detections: [], requiresManualReview: false }; },
    publish: async (_routingKey, data) => { published = data; },
  };
  const result = await settleAlertCreatedMessage(message(), { ack: () => undefined, nack: () => assert.fail('must not nack') } as any, dependencies);
  assert.equal(result.acknowledged, true);
  assert.equal(detectionCalled, true);
  assert.equal(published.analysisPipeline, 'SEMANTIC_ONLY');
  assert.equal(published.visionEvidence?.[0]?.status, 'no_detection');
});

test('publishes FAILED instead of dropping a report when OpenRouter is unavailable', async () => {
  let published: any;
  const dependencies: AlertCreatedProcessorDependencies = {
    analyze: async () => { throw new Error('provider unavailable'); },
    detectWaste: async (imageUrl) => ({ imageUrl, status: 'error', detections: [], requiresManualReview: true }),
    publish: async (_routingKey, data) => { published = data; },
  };
  const result = await settleAlertCreatedMessage(message(), { ack: () => undefined, nack: () => assert.fail('must not nack a provider outage') } as any, dependencies);
  assert.equal(result.acknowledged, true);
  assert.equal(published.analysisMode, 'FAILED');
  assert.equal(published.confidence, null);
  assert.match(published.failureReason, /OpenRouter/);
});

test('one failed photo does not discard another photo detection', async () => {
  let published: any;
  const event = JSON.parse(message().content.toString());
  event.data.mediaUrls = ['https://example.com/one.jpg', 'https://example.com/two.jpg'];
  const dependencies: AlertCreatedProcessorDependencies = {
    analyze: async () => ({ category: AlertCategory.ILLEGAL_DUMPING, severity: Severity.HIGH, confidence: 0.8,
      displayConfidenceSource: 'CATEGORY', summary: 'Điểm rác.', reasoningSummary: 'Có rác.', analysisMode: 'IMAGE_AND_TEXT',
      provider: 'openrouter', model: 'test', pipelineVersion: 'openrouter-multimodal-v1' }),
    detectWaste: async (url) => {
      if (url.endsWith('one.jpg')) throw new Error('Vision timeout');
      return { imageUrl: url, status: 'ok', detections: [], requiresManualReview: false };
    },
    publish: async (_key, data) => { published = data; },
  };
  const result = await settleAlertCreatedMessage({ content: Buffer.from(JSON.stringify(event)) } as any,
    { ack: () => undefined, nack: () => assert.fail('one image must not nack report') } as any, dependencies);
  assert.equal(result.acknowledged, true);
  assert.deepEqual(published.visionEvidence.map((item: any) => item.status), ['error', 'ok']);
});

test('reuses precomputed visionEvidence from mobile capture without re-running YOLO detection', async () => {
  let detectCalls = 0;
  let published: any;
  const event = JSON.parse(message().content.toString());
  const frozenEvidence = [{
    imageUrl: 'https://example.com/evidence.jpg',
    status: 'ok' as const,
    detections: [{ materialClass: 'plastic_bag', confidence: 0.94, bbox: [10, 20, 120, 180] as [number, number, number, number] }],
    requiresManualReview: false,
  }];
  event.data.visionEvidence = frozenEvidence;
  const dependencies: AlertCreatedProcessorDependencies = {
    analyze: async () => ({
      category: AlertCategory.ILLEGAL_DUMPING, severity: Severity.HIGH, confidence: 0.85,
      displayConfidenceSource: 'CATEGORY', summary: 'Túi rác nhựa ven đường.', reasoningSummary: 'Ảnh khớp hiện trường.',
      analysisMode: 'IMAGE_AND_TEXT', provider: 'openrouter', model: 'openai/gpt-4o-mini', pipelineVersion: 'openrouter-multimodal-v1',
    }),
    detectWaste: async () => {
      detectCalls++;
      throw new Error('detectWaste must not be called when visionEvidence is already provided');
    },
    publish: async (_key, data) => { published = data; },
  };
  const result = await settleAlertCreatedMessage(
    { content: Buffer.from(JSON.stringify(event)) } as any,
    { ack: () => undefined, nack: () => assert.fail('must not nack') } as any,
    dependencies,
  );
  assert.equal(result.acknowledged, true);
  assert.equal(detectCalls, 0);
  assert.deepEqual(published.visionEvidence, frozenEvidence);
});
