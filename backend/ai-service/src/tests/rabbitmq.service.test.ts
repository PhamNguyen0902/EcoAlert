import assert from 'node:assert/strict';
import test from 'node:test';
import { AlertCategory, EVENTS, IEventMessage, Severity } from '@ecoalert/shared';
import {
  AlertCreatedProcessorDependencies,
  settleAlertCreatedMessage,
} from '../services/rabbitmq.service';

const createMessage = () => {
  const event: IEventMessage<unknown> = {
    eventId: 'alert-created-event-1',
    eventType: EVENTS.ALERT_CREATED,
    timestamp: new Date(0).toISOString(),
    source: 'alert-service',
    correlationId: 'correlation-1',
    data: {
      _id: '507f1f77bcf86cd799439011',
      title: 'Roadside dumping',
      description: 'Construction waste was dumped beside homes.',
      mediaUrls: ['https://example.com/evidence.jpg'],
    },
  };
  return { content: Buffer.from(JSON.stringify(event)) } as any;
};

test('RabbitMQ acknowledges only after analysis is published', async () => {
  const order: string[] = [];
  let publishedData: any;
  let analysisInput: any;
  const channel = {
    ack: () => order.push('ack'),
    nack: () => order.push('nack'),
  };
  const dependencies: AlertCreatedProcessorDependencies = {
    analyze: async (input) => {
      order.push('analyze');
      analysisInput = input;
      return {
        category: AlertCategory.ILLEGAL_CONSTRUCTION_WASTE,
        severity: Severity.HIGH,
        confidence: 0,
        summary: 'Construction debris was dumped near homes.',
        reasoningSummary: 'The report identifies construction waste in a residential area.',
        analysisMode: 'vision',
        provider: 'openrouter',
        model: 'openai/gpt-4o-mini',
      };
    },
    publish: async (routingKey, data, correlationId) => {
      order.push('publish');
      assert.equal(routingKey, EVENTS.IMAGE_ANALYZED);
      assert.equal(correlationId, 'correlation-1');
      publishedData = data;
    },
  };

  const result = await settleAlertCreatedMessage(
    createMessage(),
    channel as any,
    dependencies,
  );

  assert.deepEqual(order, ['analyze', 'publish', 'ack']);
  assert.equal(result.acknowledged, true);
  assert.equal(publishedData.analysisId, 'alert-created-event-1');
  assert.equal(publishedData.confidence, 0);
  assert.equal(analysisInput.imageUrl, 'https://example.com/evidence.jpg');
  assert.equal(analysisInput.title, 'Roadside dumping');
});

test('RabbitMQ publishes a VISION_ONLY result with null semantic fields for persistence', async () => {
  let publishedData: any;
  const channel = { ack: () => undefined, nack: () => undefined };
  const dependencies: AlertCreatedProcessorDependencies = {
    analyze: async () => ({
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
    }),
    publish: async (_routingKey, data) => { publishedData = data; },
  };

  const result = await settleAlertCreatedMessage(createMessage(), channel as any, dependencies);

  assert.equal(result.acknowledged, true);
  assert.equal(publishedData.analysisMode, 'VISION_ONLY');
  assert.equal(publishedData.confidence, null);
  assert.equal(publishedData.fusion.severityScore, null);
  assert.equal(publishedData.vision.totalDetectedObjects, 14);
});

test('provider failure is rejected without requeue and never acknowledged', async () => {
  const calls: Array<unknown[]> = [];
  const channel = {
    ack: () => calls.push(['ack']),
    nack: (...args: unknown[]) => calls.push(['nack', ...args.slice(1)]),
  };
  const dependencies: AlertCreatedProcessorDependencies = {
    analyze: async () => {
      throw new Error('provider unavailable');
    },
    publish: async () => {
      calls.push(['publish']);
    },
  };

  const result = await settleAlertCreatedMessage(
    createMessage(),
    channel as any,
    dependencies,
  );

  assert.equal(result.acknowledged, false);
  assert.equal(calls.some(([name]) => name === 'ack'), false);
  assert.equal(calls.some(([name]) => name === 'publish'), false);
  assert.deepEqual(calls[0], ['nack', false, false]);
});
