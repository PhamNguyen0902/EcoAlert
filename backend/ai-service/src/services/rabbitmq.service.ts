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
}

export interface AlertCreatedProcessorDependencies {
  analyze: (input: MultimodalInput) => Promise<MultimodalAnalysisResult>;
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
  // Nhận alert.created, phân tích bất đồng bộ và luôn phát một kết quả có trạng thái rõ ràng.
  const alert = event.data;
  if (!alert?._id) throw new Error('alert.created event is missing data._id');

  let analysis: MultimodalAnalysisResult;
  try {
    analysis = await dependencies.analyze({
      alertId: alert._id,
      title: alert.title,
      description: alert.description || '',
      imageUrl: alert.mediaUrls?.find((url) => typeof url === 'string' && url.length > 0),
    });
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
