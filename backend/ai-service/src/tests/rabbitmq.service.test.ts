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
