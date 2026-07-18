import amqp from 'amqplib';
import { envConfig } from '../config/env.config';
import { createLogger, IEventMessage, EVENTS } from '@ecoalert/shared';
import { geminiService } from './gemini.service';

const logger = createLogger('ai-service');

class RabbitMQService {
  private connection: any;
  private channel: any;

  async connect() {
    try {
      this.connection = await amqp.connect(envConfig.rabbitMqUrl);
      this.channel = await this.connection.createChannel();
      
      await this.channel.assertExchange('ecoalert_exchange', 'topic', { durable: true });
      
      // Setup Queue
      const q = await this.channel.assertQueue('ai_service_queue', { durable: true });
      await this.channel.bindQueue(q.queue, 'ecoalert_exchange', EVENTS.ALERT_CREATED);
      
      this.channel.consume(q.queue, async (msg: any) => {
        if (msg) {
          try {
            const event: IEventMessage<any> = JSON.parse(msg.content.toString());
            await this.handleAlertCreated(event.data);
            this.channel.ack(msg);
          } catch (error) {
            logger.error('Error processing message', error);
            this.channel.nack(msg, false, false);
          }
        }
      });
      
      logger.info('Connected to RabbitMQ and listening to ai_service_queue');
    } catch (error) {
      logger.error('RabbitMQ Connection Error:', error);
      setTimeout(() => this.connect(), 5000); // Retry
    }
  }
  
  async handleAlertCreated(alertData: any) {
    if (alertData.mediaUrls && alertData.mediaUrls.length > 0) {
      logger.info(`Analyzing image for alert ${alertData._id}`);
      const analysis = await geminiService.analyzeImage(alertData.mediaUrls[0]);
      
      // Publish the result
      this.publishEvent(EVENTS.IMAGE_ANALYZED, {
        alertId: alertData._id,
        ...analysis
      });
    }
  }

  async publishEvent<T>(routingKey: string, data: T) {
    if (!this.channel) return;
    const event: IEventMessage<T> = {
      eventId: Date.now().toString(),
      eventType: routingKey,
      timestamp: new Date().toISOString(),
      source: 'ai-service',
      correlationId: `corr-${Date.now()}`,
      data
    };
    
    this.channel.publish(
      'ecoalert_exchange',
      routingKey,
      Buffer.from(JSON.stringify(event)),
      { persistent: true }
    );
    logger.info(`Published event: ${routingKey}`);
  }
}

export const rabbitMQService = new RabbitMQService();
