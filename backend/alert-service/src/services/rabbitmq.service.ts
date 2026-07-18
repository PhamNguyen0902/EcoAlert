import amqp from 'amqplib';
import { envConfig } from '../config/env.config';
import { createLogger, IEventMessage, EVENTS } from '@ecoalert/shared';

const logger = createLogger('alert-service');

class RabbitMQService {
  private connection: any;
  private channel: any;

  async connect() {
    try {
      this.connection = await amqp.connect(envConfig.rabbitMqUrl);
      this.channel = await this.connection.createChannel();
      
      await this.channel.assertExchange('ecoalert_exchange', 'topic', { durable: true });
      
      // Consume alert.analyzed
      const q = await this.channel.assertQueue('alert_service_queue', { durable: true });
      await this.channel.bindQueue(q.queue, 'ecoalert_exchange', EVENTS.IMAGE_ANALYZED);
      
      this.channel.consume(q.queue, async (msg: any) => {
        if (msg) {
          try {
            const event: IEventMessage<any> = JSON.parse(msg.content.toString());
            const data = event.data;
            const { alertService } = require('./alert.service');
            await alertService.internalUpdateAiResult(data.alertId, data.category, data.confidence, data.suggestedPriority);
            logger.info(`Alert ${data.alertId} updated with AI results`);
            this.channel.ack(msg);
          } catch (error) {
            logger.error('Error processing alert.analyzed', error);
            this.channel.nack(msg, false, false);
          }
        }
      });
      
      logger.info('Connected to RabbitMQ');
    } catch (error) {
      logger.error('RabbitMQ Connection Error:', error);
      setTimeout(() => this.connect(), 5000); // Retry after 5s
    }
  }

  async publishEvent<T>(routingKey: string, data: T) {
    if (!this.channel) return;
    const event: IEventMessage<T> = {
      eventId: Date.now().toString(),
      eventType: routingKey,
      timestamp: new Date().toISOString(),
      source: 'alert-service',
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
