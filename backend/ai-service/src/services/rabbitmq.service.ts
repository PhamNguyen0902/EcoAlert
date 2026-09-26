import amqp from 'amqplib';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { envConfig } from '../config/env.config';
import {
  createLogger,
  EVENTS,
  IAiAnalysisCompletedData,
  IEventMessage,
  IVisionEvidence,
  resolveVisionPipeline,
} from '@ecoalert/shared';
import {
  safeOpenRouterErrorMetadata,
} from './openrouter.service';
import { AiTask } from './ai-task-router';
import {
  analyzeMultimodalIncident,
  MultimodalAnalysisResult,
  MultimodalInput,
} from './multimodal-analysis.service';

const logger = createLogger('ai-service');

interface AlertCreatedData {
  _id: string;
  title?: string;
  description?: string;
  mediaUrls?: string[];
  visionEvidence?: Array<{
    imageUrl: string;
    status: 'ok' | 'no_detection' | 'error' | 'skipped_not_applicable';
    detections: Array<{ materialClass: string; confidence: number }>;
    requiresManualReview: boolean;
  }>;
}

const buildReportVisionSummary = (evidence: AlertCreatedData['visionEvidence']): string | undefined => {
  if (!evidence?.length) return undefined;
  const validEvidence = evidence.filter((item) => item && typeof item.imageUrl === 'string');
  const regions = validEvidence.reduce((total, item) => total + item.detections.length, 0);
  const classes = new Map<string, { regions: number; confidenceTotal: number }>();
  for (const item of validEvidence) for (const detection of item.detections) {
    const current = classes.get(detection.materialClass) ?? { regions: 0, confidenceTotal: 0 };
    classes.set(detection.materialClass, { regions: current.regions + 1, confidenceTotal: current.confidenceTotal + detection.confidence });
  }
  const classLines = Array.from(classes.entries()).sort((a, b) => b[1].regions - a[1].regions)
    .slice(0, 12).map(([name, value]) => `- ${name}: ${value.regions} vùng phát hiện, confidence TB ${(value.confidenceTotal / value.regions).toFixed(3)}`);
  return [
    `YOLO evidence cấp báo cáo: ${validEvidence.length} ảnh, ${regions} vùng phát hiện trên các ảnh (không phải số vật thể duy nhất).`,
    ...validEvidence.map((item, index) => `Ảnh ${index + 1}: ${item.detections.length} vùng phát hiện; trạng thái ${item.status}.`),
    ...classLines,
  ].join('\n');
};

export interface AlertCreatedProcessorDependencies {
  analyze: (input: MultimodalInput) => Promise<MultimodalAnalysisResult>;
  publish: (
    routingKey: string,
    data: IAiAnalysisCompletedData,
    correlationId: string,
  ) => Promise<void>;
  detectWaste?: (imageUrl: string) => Promise<IVisionEvidence>;
}

const detectWasteFromMedia = async (imageUrl: string): Promise<IVisionEvidence> => {
  const response = await axios.post(`${process.env.MEDIA_SERVICE_URL || 'http://media-service:3003'}/analyze-url`, { imageUrl }, { timeout: 25_000 });
  const data = response.data?.data;
  return { imageUrl, ...data.aiAnalysis } as IVisionEvidence;
};

const noWasteMassEstimate = () => ({ available: false, minKg: null, maxKg: null, mostLikelyKg: null, confidence: null, scale: null, reasoningSummary: null, limitations: [] });

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
  // Nhận alert.created, phân tích bất đồng bộ và luôn phát một kết quả có trạng thái rõ ràng.
  const alert = event.data;
  if (!alert?._id) throw new Error('alert.created event is missing data._id');

  let analysis: MultimodalAnalysisResult;
  try {
    // First classify the report semantically. Never send an unknown/non-waste report to YOLO.
    analysis = await dependencies.analyze({
      alertId: alert._id,
      title: alert.title,
      description: alert.description || '',
      imageUrls: alert.mediaUrls?.filter((url) => typeof url === 'string' && url.length > 0).slice(0, 6),
      reportVisionSummary: undefined,
    });
    const pipeline = resolveVisionPipeline(analysis.category);
    logger.info('Vision pipeline resolved', { alertId: alert._id, category: analysis.category, pipeline, reason: pipeline === 'WASTE_DETECTION' ? 'Waste-related category' : 'Category is not waste related' });

    if (pipeline === 'WASTE_DETECTION') {
      const urls = alert.mediaUrls?.filter((url) => typeof url === 'string' && url.length > 0).slice(0, 6) ?? [];
      const visionEvidence = await Promise.all(urls.map((url) => (dependencies.detectWaste || detectWasteFromMedia)(url)));
      // A second semantic request incorporates only valid waste evidence for the report-level result.
      analysis = await dependencies.analyze({ alertId: alert._id, title: alert.title, description: alert.description || '', imageUrls: urls, reportVisionSummary: buildReportVisionSummary(visionEvidence) });
      analysis.analysisPipeline = pipeline;
      analysis.visionEvidence = visionEvidence;
    } else {
      analysis.analysisPipeline = pipeline;
      if (analysis.overallAnalysis) analysis.overallAnalysis.massEstimate = noWasteMassEstimate();
    }
  } catch (error) {
    // Không làm mất báo cáo khi nhà cung cấp lỗi; Alert Service sẽ hiển thị AI unavailable.
    const failureReason = 'Dịch vụ OpenRouter tạm thời không khả dụng; báo cáo vẫn đang chờ nhân viên xử lý.';
    logger.warn(`AI analysis failed for alert ${alert._id}`, {
      ...safeOpenRouterErrorMetadata(error),
      task: AiTask.INCIDENT_ANALYSIS,
    });
    analysis = {
      category: 'UNCLASSIFIED',
      severity: null,
      confidence: null,
      displayConfidenceSource: 'NONE',
      summary: null,
      reasoningSummary: null,
      analysisMode: 'FAILED',
      provider: 'openrouter',
      model: 'unavailable',
      pipelineVersion: 'openrouter-multimodal-v1',
      failureReason,
    };
  }

  logger.info(`Analyzed alert ${alert._id}`, {
    provider: analysis.provider,
    task: AiTask.INCIDENT_ANALYSIS,
    model: analysis.model,
    analysisMode: analysis.analysisMode,
    pipelineVersion: analysis.pipelineVersion,
    processingTimeMs: analysis.processingTimeMs,
  });

  await dependencies.publish(
    EVENTS.AI_ANALYZED,
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
          analyze: analyzeMultimodalIncident,
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
