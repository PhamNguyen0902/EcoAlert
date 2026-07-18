import { createLogger } from '@ecoalert/shared';

const logger = createLogger('notification-service');

export class NotificationService {
  async notifyCitizen(userId: string, title: string, message: string) {
    logger.info(`[NOTIFICATION_SENT] To: Citizen ${userId} | Title: ${title} | Msg: ${message}`);
  }

  async notifyOfficers(category: string, message: string) {
    logger.info(`[NOTIFICATION_SENT] To: Officers handling ${category} | Msg: ${message}`);
  }
}

export const notificationService = new NotificationService();
