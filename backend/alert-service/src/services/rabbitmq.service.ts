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

const ecoAlertClassNames = [
  'plastic_bottle', 'plastic_bag', 'plastic_cup',
  'metal_can', 'cardboard', 'glass_bottle',
] as const;
const ecoAlertClassSchema = z.enum(ecoAlertClassNames);

const boundingBoxSchema = z.object({
  x: z.number().nonnegative(), y: z.number().nonnegative(),
  width: z.number().nonnegative(), height: z.number().nonnegative(),
}).strict();
const wasteTypeSchema = z.enum([
  'PLASTIC_WASTE', 'ORGANIC_WASTE', 'CONSTRUCTION_WASTE', 'HAZARDOUS_WASTE',
  'METAL_WASTE', 'GLASS_WASTE', 'PAPER_WASTE', 'E_WASTE', 'MIXED_WASTE', 'OTHER',
]);
const visionDetectionSchema = z.object({
  classId: z.number().int().min(0).max(ecoAlertClassNames.length - 1),
  label: ecoAlertClassSchema,
  confidence: z.number().min(0).max(1),
  bbox: boundingBoxSchema,
  normalizedBbox: boundingBoxSchema,
  wasteType: wasteTypeSchema.optional(),
  maskAreaPixels: z.number().int().nonnegative().optional(),
  maskCoverage: z.number().min(0).max(1).optional(),
}).strict().superRefine((detection, context) => {
  if (ecoAlertClassNames[detection.classId] !== detection.label) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Vision class ID and label do not match the EcoAlert V1 taxonomy',
      path: ['label'],
    });
  }
});

const visionSchema = z.object({
  status: z.enum(['COMPLETED', 'FAILED', 'SKIPPED', 'UNAVAILABLE']),
  detectorModel: z.string().refine(
    (value) => value.replace(/\\/g, '/').split('/').pop() === 'ecoalert-waste-yolo26n-v1.pt',
    'Unexpected Vision detector model',
  ),
  segmenterModel: z.string().min(1).optional(),
  imageWidth: z.number().int().positive().optional(),
  imageHeight: z.number().int().positive().optional(),
  detections: z.array(visionDetectionSchema),
  objectCounts: z.array(z.object({ label: ecoAlertClassSchema, count: z.number().int().nonnegative() }).strict()),
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
  version: z.enum(['vision-fusion-v1', 'vision-fusion-v2']),
  mode: z.enum(['FULL_MULTIMODAL', 'SEMANTIC_ONLY', 'VISION_ONLY', 'FAILED']),
  wasteType: wasteTypeSchema.optional(),
  severityScore: z.number().min(0).max(100).nullable(),
  severityFactors: z.array(z.object({
    factor: z.enum(['semantic_severity', 'visible_waste_coverage', 'object_count', 'hazardous_waste']),
    score: z.number(), evidenceSource: z.enum(['semantic', 'vision']), explanation: z.string().min(1),
  }).strict()),
  explanations: z.array(z.string()),
  semanticConfidence: z.number().min(0).max(1).nullable(),
  visionConfidence: z.number().min(0).max(1).nullable(),
  fusionConfidence: z.number().min(0).max(1).nullable(),
  visionSupport: z.enum(['STRONG', 'PARTIAL', 'NONE', 'NOT_APPLICABLE']).optional(),
  processingTimeMs: z.number().int().nonnegative(),
}).strict();
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
  overallSummaryLocalized: z.object({
    vi: z.string().trim().min(1).max(800),
    en: z.string().trim().min(1).max(800),
  }).strict().optional(),
  shortReasonLocalized: z.object({
    vi: z.string().trim().min(1).max(500),
    en: z.string().trim().min(1).max(500),
  }).strict().optional(),
  visionEvidenceUsed: z.array(z.string().trim().min(1).max(120)).max(6),
  semanticModel: z.string().trim().min(1).max(200),
  pipelineVersion: z.literal('multimodal-v2'),
}).strict();

export const aiAnalysisCompletedSchema = z.object({
  alertId: z.string().min(1),
  analysisId: z.string().min(1),
  category: z.nativeEnum(AlertCategory).or(z.literal('UNCLASSIFIED')),
  severity: z.nativeEnum(Severity).nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  displayConfidenceSource: z.enum(['FUSION', 'CATEGORY', 'SEMANTIC', 'NONE']).optional(),
  summary: z.string().trim().min(1).max(500).nullable(),
  reasoningSummary: z.string().trim().min(1).max(500).nullable(),
  analysisMode: z.enum(['text', 'vision', 'text_fallback', 'FULL_MULTIMODAL', 'SEMANTIC_ONLY', 'VISION_ONLY', 'FAILED']),
  provider: z.enum(['openrouter', 'vision-service']),
  model: z.string().trim().min(1),
  pipelineVersion: z.enum(['multimodal-v1', 'multimodal-v2']).optional(),
  overallAnalysis: overallAnalysisSchema.optional(),
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
            ...(error instanceof z.ZodError
              ? {
                  validationIssues: error.issues.slice(0, 5).map((issue) => ({
                    path: issue.path.join('.') || '<root>',
                    code: issue.code,
                    message: issue.message,
                  })),
                }
              : {}),
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
