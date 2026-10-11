import { Notification, INotification } from "../models/notification.model";

export class NotificationRepository {
  async create(data: Partial<INotification>): Promise<INotification> {
    const notification = new Notification(data);
    return notification.save();
  }

  async createOnce(
    data: Partial<INotification> & { recipientId: string; eventId: string },
  ): Promise<INotification | null> {
    try {
      const result = await Notification.findOneAndUpdate(
        { recipientId: data.recipientId, eventId: data.eventId },
        {
          $setOnInsert: {
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        {
          returnDocument: "after",
          upsert: true,
          runValidators: true,
          includeResultMetadata: true,
          timestamps: false,
        },
      );
      return result.lastErrorObject?.updatedExisting ? null : result.value;
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      return null; // A concurrent delivery already persisted and emitted this recipient/event.
    }
  }

  async findByRecipient(recipientId: string): Promise<INotification[]> {
    return Notification.find({ recipientId }).sort({ createdAt: -1 });
  }
}

export const notificationRepository = new NotificationRepository();
