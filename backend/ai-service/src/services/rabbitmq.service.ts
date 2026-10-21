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
  citizenId?: string;
  title?: string;
  description?: string;
  mediaUrls?: string[];
  visionEvidence?: IVisionEvidence[];
}

// tạo chuỗi tóm tắt thông tin các vùng nhận diện rác thải của báo cáo
const buildReportVisionSummary = (evidence: AlertCreatedData['visionEvidence']): string | undefined => {
  if (!evidence?.length) return undefined;
  const validEvidence = evidence.filter((item) => item && typeof item.imageUrl === 'string');
  return [
    `YOLO đã kiểm tra ${validEvidence.length} ảnh độc lập; không cộng số vùng giữa ảnh như số vật thể duy nhất và không gộp confidence.`,
    ...validEvidence.map((item, index) => {
      const classes = new Map<string, number>();
      for (const detection of item.detections) classes.set(detection.materialClass, (classes.get(detection.materialClass) || 0) + 1);
      const labels = [...classes.entries()].slice(0, 12).map(([name, count]) => `${name}: ${count} vùng`).join(', ');
      return `Ảnh ${index + 1}: trạng thái ${item.status}; ${item.detections.length} vùng phát hiện${labels ? ` (${labels})` : ''}.`;
    }),
  ].join('\n');
};

export interface AlertCreatedProcessorDependencies {
  analyze: (input: MultimodalInput) => Promise<MultimodalAnalysisResult>;
  publish: (
    routingKey: string,
    data: IAiAnalysisCompletedData & { citizenId?: string; title?: string },
    correlationId: string,
  ) => Promise<void>;
  detectWaste?: (imageUrl: string) => Promise<IVisionEvidence>;
}

// gửi ảnh sang dịch vụ đa phương tiện để phân tích nhận diện rác thải
const detectWasteFromMedia = async (imageUrl: string): Promise<IVisionEvidence> => {
  const response = await axios.post(`${process.env.MEDIA_SERVICE_URL || 'http://media-service:3003'}/analyze-url`, { imageUrl }, { timeout: 25_000 });
  const data = response.data?.data;
  return { imageUrl, ...data.aiAnalysis } as IVisionEvidence;
};

// trả về đối tượng ước tính khối lượng rác trống khi không phát hiện rác
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
  // nhận sự kiện tạo báo cáo phân tích bất đồng bộ và luôn phát kết quả có trạng thái rõ ràng
  const alert = event.data;
  if (!alert?._id) throw new Error('alert.created event is missing data._id');

  let analysis: MultimodalAnalysisResult;
  let preservedVisionEvidence: IVisionEvidence[] | undefined;
  try {
    // Every original evidence image gets an independent Vision result. Semantic routing
    // still decides whether those detections influence the final incident analysis.
    const urls = alert.mediaUrls?.filter((url) => typeof url === 'string' && url.length > 0).slice(0, 6) ?? [];
    let visionEvidence: IVisionEvidence[];

    if (alert.visionEvidence && alert.visionEvidence.length > 0) {
      visionEvidence = alert.visionEvidence;
    } else {
      visionEvidence = await Promise.all(urls.map(async (url): Promise<IVisionEvidence> => {
        try { return await (dependencies.detectWaste || detectWasteFromMedia)(url); }
        catch (error) {
          logger.warn('Vision failed for one evidence image', { alertId: alert._id, imageIndex: urls.indexOf(url), error: error instanceof Error ? error.message : 'unknown' });
          return { imageUrl: url, status: 'error', detections: [], requiresManualReview: true };
        }
      }));
    }
    preservedVisionEvidence = visionEvidence;
    analysis = await dependencies.analyze({
      alertId: alert._id,
      title: alert.title,
      description: alert.description || '',
      imageUrls: urls,
      reportVisionSummary: undefined,
    });
    const pipeline = resolveVisionPipeline(analysis.category);
    logger.info('Vision pipeline resolved', { alertId: alert._id, category: analysis.category, pipeline, reason: pipeline === 'WASTE_DETECTION' ? 'Waste-related category' : 'Category is not waste related' });

    if (pipeline === 'WASTE_DETECTION') {
      // gửi yêu cầu ngữ nghĩa lần hai kết hợp minh chứng nhận diện rác thải hợp lệ cho kết quả tổng quan
      analysis = await dependencies.analyze({ alertId: alert._id, title: alert.title, description: alert.description || '', imageUrls: urls, reportVisionSummary: buildReportVisionSummary(visionEvidence) });
      analysis.analysisPipeline = pipeline;
      analysis.visionEvidence = visionEvidence;
    } else {
      analysis.analysisPipeline = pipeline;
      analysis.visionEvidence = visionEvidence;
      if (analysis.overallAnalysis) analysis.overallAnalysis.massEstimate = noWasteMassEstimate();
    }
  } catch (error) {
    // không làm gián đoạn báo cáo khi nhà cung cấp lỗi hệ thống sẽ đánh dấu tạm thời chờ xử lý
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
      ...(preservedVisionEvidence ? { visionEvidence: preservedVisionEvidence } : {}),
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
      citizenId: alert.citizenId,
      title: alert.title,
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
