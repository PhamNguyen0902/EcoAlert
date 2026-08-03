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

const boundingBoxSchema = z.object({
  x: z.number().nonnegative(), y: z.number().nonnegative(),
  width: z.number().nonnegative(), height: z.number().nonnegative(),
}).strict();
const wasteTypeSchema = z.enum([
  'PLASTIC_WASTE', 'ORGANIC_WASTE', 'CONSTRUCTION_WASTE', 'HAZARDOUS_WASTE',
  'METAL_WASTE', 'GLASS_WASTE', 'PAPER_WASTE', 'E_WASTE', 'MIXED_WASTE', 'OTHER',
]);
const visionSchema = z.object({
  status: z.enum(['COMPLETED', 'FAILED', 'SKIPPED', 'UNAVAILABLE']),
  detectorModel: z.string().min(1),
  segmenterModel: z.string().min(1).optional(),
  imageWidth: z.number().int().positive().optional(),
  imageHeight: z.number().int().positive().optional(),
  detections: z.array(z.object({
    classId: z.number().int().nonnegative(), label: z.string().min(1),
    confidence: z.number().min(0).max(1), bbox: boundingBoxSchema,
    normalizedBbox: boundingBoxSchema, wasteType: wasteTypeSchema.optional(),
    maskAreaPixels: z.number().int().nonnegative().optional(),
    maskCoverage: z.number().min(0).max(1).optional(),
  }).strict()),
  objectCounts: z.array(z.object({ label: z.string().min(1), count: z.number().int().nonnegative() }).strict()),
  totalDetectedObjects: z.number().int().nonnegative(),
  visibleWasteCoverage: z.number().min(0).max(1).nullable(),
  detectorConfidence: z.number().min(0).max(1).nullable(),
  segmentationConfidence: z.number().min(0).max(1).nullable(),
  annotatedImageUrl: z.string().url().optional(),
  processingTimeMs: z.number().int().nonnegative(),
  detectionTimeMs: z.number().int().nonnegative(),
  segmentationTimeMs: z.number().int().nonnegative(),
  annotationTimeMs: z.number().int().nonnegative(),
  warnings: z.array(z.string()),
}).strict();
const fusionSchema = z.object({
  version: z.literal('vision-fusion-v1'),
  mode: z.enum(['FULL_MULTIMODAL', 'SEMANTIC_ONLY', 'VISION_ONLY', 'FAILED']),
  wasteType: wasteTypeSchema.optional(),
  severityScore: z.number().min(0).max(100),
  severityFactors: z.array(z.object({
    factor: z.enum(['semantic_severity', 'visible_waste_coverage', 'object_count', 'hazardous_waste']),
    score: z.number(), evidenceSource: z.enum(['semantic', 'vision']), explanation: z.string().min(1),
  }).strict()),
  explanations: z.array(z.string()),
  semanticConfidence: z.number().min(0).max(1).nullable(),
  visionConfidence: z.number().min(0).max(1).nullable(),
  fusionConfidence: z.number().min(0).max(1),
  processingTimeMs: z.number().int().nonnegative(),
}).strict();

export const aiAnalysisCompletedSchema = z.object({
  alertId: z.string().min(1),
  analysisId: z.string().min(1),
  category: z.nativeEnum(AlertCategory),
  severity: z.nativeEnum(Severity),
  confidence: z.number().min(0).max(1),
  summary: z.string().trim().min(1).max(500),
  reasoningSummary: z.string().trim().min(1).max(500),
  analysisMode: z.enum(['text', 'vision', 'text_fallback', 'FULL_MULTIMODAL', 'SEMANTIC_ONLY', 'VISION_ONLY', 'FAILED']),
  provider: z.enum(['openrouter', 'vision-service']),
  model: z.string().trim().min(1),
  pipelineVersion: z.literal('multimodal-v1').optional(),
  vision: visionSchema.optional(),
  fusion: fusionSchema.optional(),
  semanticProcessingTimeMs: z.number().int().nonnegative().optional(),
  totalProcessingTimeMs: z.number().int().nonnegative().optional(),
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
