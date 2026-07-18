import amqp from 'amqplib';
import { envConfig } from '../config/env.config';
import { createLogger, IEventMessage, EVENTS } from '@ecoalert/shared';
import { notificationService } from './notification.service';

const logger = createLogger('notification-service');

class RabbitMQService {
  private connection: any;
  private channel: any;

  async connect() {
    try {
      this.connection = await amqp.connect(envConfig.rabbitMqUrl);
      this.channel = await this.connection.createChannel();
      
      await this.channel.assertExchange('ecoalert_exchange', 'topic', { durable: true });
      
      const q = await this.channel.assertQueue('notification_service_queue', { durable: true });
      await this.channel.bindQueue(q.queue, 'ecoalert_exchange', EVENTS.IMAGE_ANALYZED);
      await this.channel.bindQueue(q.queue, 'ecoalert_exchange', EVENTS.ALERT_UPDATED);
      
      this.channel.consume(q.queue, async (msg: any) => {
        if (msg) {
          try {
            const event: IEventMessage<any> = JSON.parse(msg.content.toString());
            await this.handleEvent(event);
            this.channel.ack(msg);
          } catch (error) {
            logger.error('Error processing Notification msg', error);
            this.channel.nack(msg, false, false);
          }
        }
      });
      
      logger.info('Connected to RabbitMQ and listening to notification_service_queue');
    } catch (error) {
      logger.error('RabbitMQ Connection Error:', error);
      setTimeout(() => this.connect(), 5000);
    }
  }

  async handleEvent(event: IEventMessage<any>) {
    const data = event.data;
    
    if (event.eventType === EVENTS.IMAGE_ANALYZED) {
      await notificationService.notifyCitizen(
        'System', 
        'Alert Analyzed', 
        `Alert ${data.alertId} has been analyzed. Category: ${data.category}, Priority: ${data.suggestedPriority}`
      );
      await notificationService.notifyOfficers(
        data.category,
        `New ${data.suggestedPriority} priority alert ${data.alertId} needs verification.`
      );
    } else if (event.eventType === EVENTS.ALERT_UPDATED) {
      await notificationService.notifyCitizen(
        data.citizenId,
        'Alert Status Update',
        `Your alert ${data._id} is now ${data.status}`
      );
    }
  }
}

export const rabbitMQService = new RabbitMQService();
