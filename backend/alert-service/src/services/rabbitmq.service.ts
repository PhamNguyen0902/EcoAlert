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

const overallAnalysisSchema = z.object({
  isIncident: z.boolean(),
  incidentConfidence: z.number().min(0).max(1),
  categorySuggestion: z.nativeEnum(AlertCategory).nullable(),
  categoryConfidence: z.number().min(0).max(1),
  classificationStatus: z.enum(['AI_SUGGESTED', 'UNCLASSIFIED']),
  confidenceTier: z.enum(['HIGH_CONFIDENCE', 'REVIEW_REQUIRED', 'UNCLASSIFIED']),
  severity: z.nativeEnum(Severity),
  severityScore: z.number().min(0).max(100),
  severityConfidence: z.number().min(0).max(1),
  overallSummary: z.string().trim().min(1).max(800),
  shortReason: z.string().trim().min(1).max(500),
  semanticModel: z.string().trim().min(1).max(200),
  pipelineVersion: z.literal('openrouter-multimodal-v1'),
}).strict();

/** Chỉ nhận payload OpenRouter đã khai báo, tránh dữ liệu AI dư thừa đi vào workflow. */
export const aiAnalysisCompletedSchema = z.object({
  alertId: z.string().min(1),
  analysisId: z.string().min(1),
  category: z.nativeEnum(AlertCategory).or(z.literal('UNCLASSIFIED')),
  severity: z.nativeEnum(Severity).nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  displayConfidenceSource: z.enum(['CATEGORY', 'SEMANTIC', 'NONE']).optional(),
  summary: z.string().trim().min(1).max(800).nullable(),
  reasoningSummary: z.string().trim().min(1).max(500).nullable(),
  analysisMode: z.enum(['TEXT_ONLY', 'IMAGE_AND_TEXT', 'FAILED']),
  provider: z.literal('openrouter'),
  model: z.string().trim().min(1),
  pipelineVersion: z.literal('openrouter-multimodal-v1').optional(),
  overallAnalysis: overallAnalysisSchema.optional(),
  processingTimeMs: z.number().int().nonnegative().optional(),
  failureReason: z.string().trim().min(1).max(500).optional(),
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
      await this.channel.bindQueue(queue.queue, 'ecoalert_exchange', EVENTS.AI_ANALYZED);
      await this.channel.prefetch(1);

      this.channel.consume(queue.queue, async (message) => {
        if (!message || !this.channel) return;
        try {
          const event = JSON.parse(message.content.toString()) as IEventMessage<unknown>;
          const data: IAiAnalysisCompletedData = aiAnalysisCompletedSchema.parse(event.data);
          const { alertService } = require('./alert.service');
          const updatedAlert = await alertService.internalUpdateAiResult(data.alertId, data);
          if (!updatedAlert) throw new Error('AI analysis target alert was not found or could not be updated');
          logger.info(`Alert ${data.alertId} persisted AI analysis ${data.analysisId}`);
          this.channel.ack(message);
        } catch (error) {
          logger.error('Failed to process ai.analyzed; message rejected without requeue', {
            errorType: error instanceof Error ? error.name : 'UnknownError',
            ...(error instanceof z.ZodError
              ? { validationIssues: error.issues.slice(0, 5).map((issue) => ({ path: issue.path.join('.') || '<root>', code: issue.code, message: issue.message })) }
              : {}),
          });
          this.channel.nack(message, false, false);
        }
      });
      logger.info('Connected to RabbitMQ');
    } catch (error) {
      logger.error('RabbitMQ connection failed', { errorType: error instanceof Error ? error.name : 'UnknownError' });
      setTimeout(() => this.connect(), 5000);
    }
  }

  async publishEvent<T>(routingKey: string, data: T, correlationId?: string) {
    if (!this.channel) throw new Error('RabbitMQ channel is unavailable');
    const event: IEventMessage<T> = {
      eventId: randomUUID(), eventType: routingKey, timestamp: new Date().toISOString(),
      source: 'alert-service', correlationId: correlationId || randomUUID(), data,
    };
    this.channel.publish('ecoalert_exchange', routingKey, Buffer.from(JSON.stringify(event)), { persistent: true });
    logger.info(`Published event: ${routingKey}`);
  }
}

export const rabbitMQService = new RabbitMQService();
