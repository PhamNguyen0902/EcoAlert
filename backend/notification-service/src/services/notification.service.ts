import { createLogger } from '@ecoalert/shared';
import { notificationRepository } from '../repositories/notification.repository';

const logger = createLogger('notification-service');

export class NotificationService {
  private async notifyRecipient(
    recipientId: string,
    title: string,
    message: string,
    eventId?: string,
  ) {
    if (!recipientId) return;
    if (eventId) {
      await notificationRepository.createOnce({ recipientId, title, message, eventId });
    } else {
      await notificationRepository.create({ recipientId, title, message });
    }
    logger.info(`[NOTIFICATION_SAVED] To: ${recipientId} | Title: ${title}`);
  }

  async notifyCitizen(userId: string, title: string, message: string, eventId?: string) {
    await this.notifyRecipient(userId, title, message, eventId);
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
