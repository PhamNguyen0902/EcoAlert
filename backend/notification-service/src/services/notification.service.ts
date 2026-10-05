import { createLogger } from '@ecoalert/shared';
import { notificationRepository } from '../repositories/notification.repository';
import { socketService } from './socket.service';

const logger = createLogger('notification-service');

export class NotificationService {
  private async notifyRecipient(
    recipientId: string,
    title: string,
    message: string,
    eventId?: string,
    alertId?: string,
  ) {
    if (!recipientId) return;
    const notification = eventId
      ? await notificationRepository.createOnce({ recipientId, title, message, eventId, ...(alertId ? { alertId } : {}) })
      : await notificationRepository.create({ recipientId, title, message, ...(alertId ? { alertId } : {}) });
    logger.info(`[NOTIFICATION_SAVED] To: ${recipientId} | Title: ${title}`);
    return notification;
  }

  async notifyCitizen(userId: string, title: string, message: string, eventId?: string, alertId?: string) {
    const notification = await this.notifyRecipient(userId, title, message, eventId, alertId);
    if (notification) socketService.emitToRoom(`user:${userId}`, 'notification:created', { notificationId: notification._id, alertId });
  }

  async notifyOfficer(userId: string, title: string, message: string, eventId?: string) {
    await this.notifyRecipient(userId, title, message, eventId);
  }

  async notifyOfficers(category: string, message: string, eventId?: string) {
    await this.notifyRecipient('officers', `Officer Alert: ${category}`, message, eventId);
  }

  async notifyAdmins(title: string, message: string, eventId?: string) {
    await this.notifyRecipient('admins', title, message, eventId);
  }
}

export const notificationService = new NotificationService();
