import { createLogger } from '@ecoalert/shared';
import { notificationRepository } from '../repositories/notification.repository';

const logger = createLogger('notification-service');

export class NotificationService {
  async notifyCitizen(userId: string, title: string, message: string) {
    await notificationRepository.create({
      recipientId: userId,
      title,
      message,
    });
    logger.info(`[NOTIFICATION_SAVED] To: Citizen ${userId} | Title: ${title} | Msg: ${message}`);
  }

  async notifyOfficers(category: string, message: string) {
    await notificationRepository.create({
      recipientId: 'officers',
      title: `Officer Alert: ${category}`,
      message,
    });
    logger.info(`[NOTIFICATION_SAVED] To: Officers handling ${category} | Msg: ${message}`);
  }
}

export const notificationService = new NotificationService();
