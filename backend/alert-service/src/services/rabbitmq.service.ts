import amqp from 'amqplib';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { envConfig } from '../config/env.config';
import {
  AlertCategory,
  createLogger,
  EVENTS,
  IAiAnalysisCompletedData,
  IEventMessage,
  Severity,
} from '@ecoalert/shared';

const logger = createLogger('alert-service');

export const aiAnalysisCompletedSchema = z.object({
  alertId: z.string().min(1),
  analysisId: z.string().min(1),
  category: z.nativeEnum(AlertCategory),
  severity: z.nativeEnum(Severity),
  confidence: z.number().min(0).max(1),
  summary: z.string().trim().min(1).max(500),
  reasoningSummary: z.string().trim().min(1).max(500),
  analysisMode: z.enum(['text', 'vision', 'text_fallback']),
  provider: z.literal('openrouter'),
  model: z.string().trim().min(1),
}).strict();

class RabbitMQService {
  private connection: amqp.ChannelModel | undefined;
  private channel: amqp.Channel | undefined;

  async connect() {
    try {
      this.connection = await amqp.connect(envConfig.rabbitMqUrl);
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange('ecoalert_exchange', 'topic', { durable: true });

      const queue = await this.channel.assertQueue('alert_service_queue', { durable: true });
      await this.channel.bindQueue(queue.queue, 'ecoalert_exchange', EVENTS.IMAGE_ANALYZED);
      await this.channel.prefetch(1);

      this.channel.consume(queue.queue, async (message) => {
        if (!message || !this.channel) return;

        try {
          const event = JSON.parse(
            message.content.toString(),
          ) as IEventMessage<unknown>;
          const data: IAiAnalysisCompletedData = aiAnalysisCompletedSchema.parse(event.data);
          const { alertService } = require('./alert.service');

          const updatedAlert = await alertService.internalUpdateAiResult(data.alertId, data);
          if (!updatedAlert) {
            throw new Error('AI analysis target alert was not found or could not be updated');
          }

          logger.info(`Alert ${data.alertId} persisted AI analysis ${data.analysisId}`);
          this.channel.ack(message);
        } catch (error) {
          logger.error('Failed to process image.analyzed; message rejected without requeue', {
            errorType: error instanceof Error ? error.name : 'UnknownError',
          });
          this.channel.nack(message, false, false);
        }
      });

      logger.info('Connected to RabbitMQ');
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
      source: 'alert-service',
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
