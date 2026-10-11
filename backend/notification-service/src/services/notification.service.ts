import { notificationRepository } from "../repositories/notification.repository";
import { socketService } from "./socket.service";
import {
  NotificationContent,
  safeAlertTitle,
} from "../utils/notification-content";

export class NotificationService {
  async notify(
    recipientId: string,
    content: NotificationContent,
    eventId: string,
    alertId?: string,
    alertTitle?: string,
    eventType?: string,
  ) {
    if (!recipientId || !eventId) return;
    const notification = await notificationRepository.createOnce({
      recipientId,
      ...content,
      eventId,
      ...(alertId ? { alertId } : {}),
      alertTitle: safeAlertTitle(alertTitle),
      eventType,
    });
    if (!notification) return;
    const room =
      recipientId === "admins" ? "role:ADMIN" : `user:${recipientId}`;
    // Emit only IDs after persistence. The authenticated API supplies localized presentation.
    socketService.emitToRoom(room, "notification:created", {
      notificationId: notification._id,
      alertId,
    });
    return notification;
  }
}
export const notificationService = new NotificationService();
