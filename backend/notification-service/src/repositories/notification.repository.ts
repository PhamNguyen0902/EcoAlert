import { Notification, INotification } from '../models/notification.model';

export class NotificationRepository {
  async create(data: Partial<INotification>): Promise<INotification> {
    const notification = new Notification(data);
    return notification.save();
  }

  async createOnce(data: Partial<INotification> & { recipientId: string; eventId: string }): Promise<INotification> {
    return Notification.findOneAndUpdate(
      { recipientId: data.recipientId, eventId: data.eventId },
      { $setOnInsert: data },
      { returnDocument: 'after', upsert: true, runValidators: true },
    );
  }

  async findByRecipient(recipientId: string): Promise<INotification[]> {
    return Notification.find({ recipientId }).sort({ createdAt: -1 });
  }

  async markAsRead(id: string): Promise<INotification | null> {
    return Notification.findByIdAndUpdate(id, { isRead: true }, { returnDocument: 'after' });
  }
}

export const notificationRepository = new NotificationRepository();
