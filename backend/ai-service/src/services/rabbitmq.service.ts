import amqp from 'amqplib';
import { randomUUID } from 'crypto';
import { envConfig } from '../config/env.config';
import {
  createLogger,
  EVENTS,
  IAiAnalysisCompletedData,
  IEventMessage,
} from '@ecoalert/shared';
import {
  analyzeIncidentWithOpenRouter,
  IncidentAnalysisInput,
  IncidentAnalysisResult,
  safeOpenRouterErrorMetadata,
} from './openrouter.service';

const logger = createLogger('ai-service');

interface AlertCreatedData {
  _id: string;
  title?: string;
  description?: string;
  mediaUrls?: string[];
}

export interface AlertCreatedProcessorDependencies {
  analyze: (input: IncidentAnalysisInput) => Promise<IncidentAnalysisResult>;
  publish: (
    routingKey: string,
    data: IAiAnalysisCompletedData,
    correlationId: string,
  ) => Promise<void>;
}

interface SettlementChannel {
  ack: (message: amqp.ConsumeMessage) => void;
  nack: (
    message: amqp.ConsumeMessage,
    allUpTo: boolean,
    requeue: boolean,
  ) => void;
}

export const processAlertCreatedEvent = async (
  event: IEventMessage<AlertCreatedData>,
  dependencies: AlertCreatedProcessorDependencies,
) => {
  const alert = event.data;
  if (!alert?._id) throw new Error('alert.created event is missing data._id');

  const analysis = await dependencies.analyze({
    title: alert.title,
    description: alert.description || '',
    imageUrl: alert.mediaUrls?.find((url) => typeof url === 'string' && url.length > 0),
  });

  await dependencies.publish(
    EVENTS.IMAGE_ANALYZED,
    {
      alertId: alert._id,
      analysisId: event.eventId,
      ...analysis,
    },
    event.correlationId,
  );
};

export const settleAlertCreatedMessage = async (
  message: amqp.ConsumeMessage,
  channel: SettlementChannel,
  dependencies: AlertCreatedProcessorDependencies,
) => {
  try {
    const event = JSON.parse(
      message.content.toString(),
    ) as IEventMessage<AlertCreatedData>;
    await processAlertCreatedEvent(event, dependencies);
    channel.ack(message);
    return { acknowledged: true as const };
  } catch (error) {
    channel.nack(message, false, false);
    return { acknowledged: false as const, error };
  }
};

class RabbitMQService {
  private connection: amqp.ChannelModel | undefined;
  private channel: amqp.Channel | undefined;

  async connect() {
    try {
      this.connection = await amqp.connect(envConfig.rabbitMqUrl);
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange('ecoalert_exchange', 'topic', { durable: true });

      const queue = await this.channel.assertQueue('ai_service_queue', { durable: true });
      await this.channel.bindQueue(queue.queue, 'ecoalert_exchange', EVENTS.ALERT_CREATED);
      await this.channel.prefetch(1);

      this.channel.consume(queue.queue, async (message) => {
        if (!message || !this.channel) return;

        const result = await settleAlertCreatedMessage(message, this.channel, {
          analyze: analyzeIncidentWithOpenRouter,
          publish: (routingKey, data, correlationId) =>
            this.publishEvent(routingKey, data, correlationId),
        });

        if (!result.acknowledged) {
          logger.error(
            'Failed to process alert.created; message rejected without requeue',
            safeOpenRouterErrorMetadata(result.error),
          );
        }
      });

      logger.info('Connected to RabbitMQ and listening to ai_service_queue');
    } catch (error) {
      logger.error('RabbitMQ connection failed', {
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });
      setTimeout(() => this.connect(), 5000);
    }
  }

  async publishEvent<T>(routingKey: string, data: T, correlationId?: string) {
    if (!this.channel) throw new Error('RabbitMQ channel is unavailable');

    const event: IEventMessage<T> = {
      eventId: randomUUID(),
      eventType: routingKey,
      timestamp: new Date().toISOString(),
      source: 'ai-service',
      correlationId: correlationId || randomUUID(),
      data,
    };

    this.channel.publish(
      'ecoalert_exchange',
      routingKey,
      Buffer.from(JSON.stringify(event)),
      { persistent: true },
    );
    logger.info(`Published event: ${routingKey}`);
  }
}

export const rabbitMQService = new RabbitMQService();
