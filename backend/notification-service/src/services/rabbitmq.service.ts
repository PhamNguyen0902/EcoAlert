import amqp from 'amqplib';
import { envConfig } from '../config/env.config';
import { createLogger, IEventMessage, EVENTS } from '@ecoalert/shared';
import { notificationService } from './notification.service';
import { socketService } from './socket.service';

const logger = createLogger('notification-service');

interface AlertEventData {
  _id?: string;
  alertId?: string;
  title?: string;
  citizenId?: string;
  assignedOfficerId?: string;
  status?: string;
  category?: string;
  suggestedPriority?: string;
  workflowNotificationHandled?: boolean;
}

class RabbitMQService {
  private connection: unknown;
  private channel: amqp.Channel | undefined;

  async connect() {
    try {
      this.connection = await amqp.connect(envConfig.rabbitMqUrl);
      this.channel = await (this.connection as amqp.ChannelModel).createChannel();
      await this.channel.assertExchange('ecoalert_exchange', 'topic', { durable: true });

      const queue = await this.channel.assertQueue('notification_service_queue', { durable: true });
      const eventNames = [
        EVENTS.ALERT_CREATED,
        EVENTS.IMAGE_ANALYZED,
        EVENTS.ALERT_UPDATED,
        EVENTS.OFFICER_ASSIGNED,
        EVENTS.ALERT_STARTED,
        EVENTS.ALERT_ARRIVED,
        EVENTS.ALERT_RESOLVED,
        EVENTS.ALERT_CLOSED,
      ];
      await Promise.all(eventNames.map((eventName) =>
        this.channel?.bindQueue(queue.queue, 'ecoalert_exchange', eventName),
      ));

      this.channel.consume(queue.queue, async (message) => {
        if (!message || !this.channel) return;
        try {
          const event: IEventMessage<AlertEventData> = JSON.parse(message.content.toString());
          await this.handleEvent(event);
          this.channel.ack(message);
        } catch (error) {
          logger.error('Error processing notification message', error);
          this.channel.nack(message, false, false);
        }
      });

      logger.info('Connected to RabbitMQ and listening to notification_service_queue');
    } catch (error) {
      logger.error('RabbitMQ Connection Error:', error);
      setTimeout(() => this.connect(), 5000);
    }
  }

  async handleEvent(event: IEventMessage<AlertEventData>) {
    const data = event.data;
    const incidentId = data.alertId || data._id || 'incident';
    const incidentLabel = data.title ? `“${data.title}”` : incidentId;

    // Broadcast generic realtime event to all connected clients
    socketService.emitToAll('realtime:event', {
      type: event.eventType,
      data,
      eventId: event.eventId,
      timestamp: new Date().toISOString(),
    });

    switch (event.eventType) {
      case EVENTS.ALERT_CREATED:
        socketService.emitToAll('alert:created', data);
        break;

      case EVENTS.IMAGE_ANALYZED:
        socketService.emitToAll('image:analyzed', data);
        socketService.emitToAll('alert:updated', data);
        await notificationService.notifyCitizen(
          'System',
          'Alert Analyzed',
          `Alert ${incidentId} has been analyzed. Category: ${data.category}, Priority: ${data.suggestedPriority}`,
          event.eventId,
        );
        await notificationService.notifyOfficers(
          data.category || 'unclassified',
          `New ${data.suggestedPriority || ''} priority alert ${incidentId} needs verification.`,
          event.eventId,
        );
        break;
      case EVENTS.OFFICER_ASSIGNED:
        socketService.emitToAll('alert:updated', data);
        if (data.assignedOfficerId) {
          socketService.emitToRoom(`user:${data.assignedOfficerId}`, 'officer:assigned', data);
          await notificationService.notifyOfficer(
            data.assignedOfficerId,
            'New incident assigned',
            `Incident ${incidentLabel} has been assigned to you.`,
            event.eventId,
          );
        }
        break;
      case EVENTS.ALERT_STARTED:
        socketService.emitToAll('alert:updated', data);
        if (data.citizenId) {
          await notificationService.notifyCitizen(
            data.citizenId,
            'Officer started handling your report',
            `An Officer has started handling incident ${incidentLabel}.`,
            event.eventId,
          );
        }
        break;
      case EVENTS.ALERT_ARRIVED:
        socketService.emitToAll('alert:updated', data);
        if (data.citizenId) {
          await notificationService.notifyCitizen(
            data.citizenId,
            'Officer arrived at the scene',
            `The assigned Officer has arrived for incident ${incidentLabel}.`,
            event.eventId,
          );
        }
        break;
      case EVENTS.ALERT_RESOLVED:
        socketService.emitToAll('alert:updated', data);
        if (data.citizenId) {
          await notificationService.notifyCitizen(
            data.citizenId,
            'Incident resolved',
            `Incident ${incidentLabel} has been marked as resolved and is awaiting Admin review.`,
            event.eventId,
          );
        }
        await notificationService.notifyAdmins(
          'Incident ready for review',
          `Resolved incident ${incidentLabel} is ready to be reviewed and closed.`,
          event.eventId,
        );
        break;
      case EVENTS.ALERT_CLOSED:
        socketService.emitToAll('alert:updated', data);
        if (data.citizenId) {
          await notificationService.notifyCitizen(
            data.citizenId,
            'Incident closed',
            `Incident ${incidentLabel} was reviewed and closed by an Admin.`,
            event.eventId,
          );
        }
        if (data.assignedOfficerId) {
          await notificationService.notifyOfficer(
            data.assignedOfficerId,
            'Incident closed',
            `Incident ${incidentLabel} was reviewed and closed by an Admin.`,
            event.eventId,
          );
        }
        break;
      case EVENTS.ALERT_UPDATED:
        if (!data.workflowNotificationHandled) {
          socketService.emitToAll('alert:updated', data);
          if (data.citizenId) {
            await notificationService.notifyCitizen(
              data.citizenId,
              'Alert Status Update',
              `Your alert ${incidentId} is now ${data.status}`,
              event.eventId,
            );
          }
        }
        break;
      default:
        break;
    }
  }
}

export const rabbitMQService = new RabbitMQService();
