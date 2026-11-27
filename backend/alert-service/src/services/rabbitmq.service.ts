import amqp from 'amqplib';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { visionEvidenceSchema } from '../dtos/vision.schema';
import { envConfig } from '../config/env.config';
import {
  AlertCategory,
  createLogger,
  createResilientRabbitMQConnector,
  EVENTS,
  IAiAnalysisCompletedData,
  IEventMessage,
  Severity,
} from '@ecoalert/shared';

// Dịch vụ RabbitMQ để quản lý kết nối và xử lý các sự kiện liên quan đến AI.
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
  massEstimate: z.object({
    available: z.boolean(),
    minKg: z.number().min(0).nullable(),
    maxKg: z.number().min(0).nullable(),
    mostLikelyKg: z.number().min(0).nullable(),
    confidence: z.number().min(0).max(1).nullable(),
    scale: z.enum(['VERY_SMALL', 'SMALL', 'MEDIUM', 'LARGE', 'VERY_LARGE']).nullable(),
    reasoningSummary: z.string().trim().max(600).nullable(),
    limitations: z.array(z.string().trim().min(1).max(250)).max(5),
  }).strict(),
  semanticModel: z.string().trim().min(1).max(200),
  pipelineVersion: z.literal('openrouter-multimodal-v1'),
}).strict();

/** Chỉ nhận payload OpenRouter đã khai báo, tránh dữ liệu AI dư thừa đi vào workflow. */
export const aiAnalysisCompletedSchema = z.object({
  alertId: z.string().min(1),
  analysisId: z.string().min(1),
  citizenId: z.string().min(1).optional(),
  title: z.string().optional(),
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
  analysisPipeline: z.enum(['WASTE_DETECTION', 'SEMANTIC_ONLY']).optional(),
  visionEvidence: z.array(visionEvidenceSchema).optional(),
  overallAnalysis: overallAnalysisSchema.optional(),
  processingTimeMs: z.number().int().nonnegative().optional(),
  failureReason: z.string().trim().min(1).max(500).optional(),
}).strict();

class RabbitMQService {
  private readonly connector = createResilientRabbitMQConnector<
    amqp.ChannelModel,
    amqp.ConfirmChannel
  >({
    connect: () => amqp.connect(envConfig.rabbitMqUrl),
    createChannel: (connection) => connection.createConfirmChannel(),
    queueName: 'alert_service_queue',
    dlqName: 'alert_service_dlq',
    logger,
    onConnected: async (channel, queue) => {
      await channel.bindQueue(queue, 'ecoalert_exchange', EVENTS.AI_ANALYZED);
      await channel.prefetch(1);

      channel.consume(queue, async (message) => {
        const activeChannel = this.connector.getChannel();
        if (!message || !activeChannel) return;
        try {
          const event = JSON.parse(message.content.toString()) as IEventMessage<unknown>;
          const data: IAiAnalysisCompletedData = aiAnalysisCompletedSchema.parse(event.data);
          const { alertService } = require('./alert.service');
          const updatedAlert = await alertService.internalUpdateAiResult(data.alertId, data);
          if (!updatedAlert) throw new Error('AI analysis target alert was not found or could not be updated');
          logger.info(`Alert ${data.alertId} persisted AI analysis ${data.analysisId}`);
          activeChannel.ack(message);
        } catch (error) {
          logger.error('Failed to process ai.analyzed; message rejected without requeue', {
            errorType: error instanceof Error ? error.name : 'UnknownError',
            ...(error instanceof z.ZodError
              ? { validationIssues: error.issues.slice(0, 5).map((issue) => ({ path: issue.path.join('.') || '<root>', code: issue.code, message: issue.message })) }
              : {}),
          });
          activeChannel.nack(message, false, false);
        }
      });
      logger.info('Connected to RabbitMQ');
    },
  });

  async connect() {
    await this.connector.connect();
  }

  async publishEvent<T>(routingKey: string, data: T, correlationId?: string, eventId: string = randomUUID()) {
    const channel = this.connector.getChannel();
    if (!channel) throw new Error('RabbitMQ channel is unavailable');
    const event: IEventMessage<T> = {
      eventId, eventType: routingKey, timestamp: new Date().toISOString(),
      source: 'alert-service', correlationId: correlationId || randomUUID(), data,
    };
    await new Promise<void>((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('RabbitMQ confirmation timed out')),5000);
      try {channel.publish('ecoalert_exchange', routingKey, Buffer.from(JSON.stringify(event)), { persistent: true }, error=>{clearTimeout(timer);error?reject(error):resolve();});}
      catch(error){clearTimeout(timer);reject(error);}
    });
    logger.info(`Published event: ${routingKey}`);
  }
}

export const rabbitMQService = new RabbitMQService();
