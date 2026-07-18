import amqp from 'amqplib';
import { envConfig } from '../config/env.config';
import { createLogger, IEventMessage, EVENTS } from '@ecoalert/shared';
import { gisService } from './gis.service';

const logger = createLogger('gis-service');

class RabbitMQService {
  private connection: any;
  private channel: any;

  async connect() {
    try {
      this.connection = await amqp.connect(envConfig.rabbitMqUrl);
      this.channel = await this.connection.createChannel();
      
      await this.channel.assertExchange('ecoalert_exchange', 'topic', { durable: true });
      
      const q = await this.channel.assertQueue('gis_service_queue', { durable: true });
      // Listen to both created and updated to keep the map in sync
      await this.channel.bindQueue(q.queue, 'ecoalert_exchange', EVENTS.ALERT_CREATED);
      await this.channel.bindQueue(q.queue, 'ecoalert_exchange', EVENTS.ALERT_UPDATED);
      
      this.channel.consume(q.queue, async (msg: any) => {
        if (msg) {
          try {
            const event: IEventMessage<any> = JSON.parse(msg.content.toString());
            await gisService.saveLocation(event.data);
            this.channel.ack(msg);
          } catch (error) {
            logger.error('Error processing GIS msg', error);
            this.channel.nack(msg, false, false);
          }
        }
      });
      
      logger.info('Connected to RabbitMQ and listening to gis_service_queue');
    } catch (error) {
      logger.error('RabbitMQ Connection Error:', error);
      setTimeout(() => this.connect(), 5000);
    }
  }
}

export const rabbitMQService = new RabbitMQService();
