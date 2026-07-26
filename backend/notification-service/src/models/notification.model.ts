import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  recipientId: string; // 'system', 'officers', or userId
  eventId?: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>({
  recipientId: { type: String, required: true, index: true },
  eventId: { type: String },
  title: { type: String, required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

notificationSchema.index(
  { recipientId: 1, eventId: 1 },
  {
    unique: true,
    partialFilterExpression: { eventId: { $type: 'string' } },
    name: 'recipient_event_unique',
  },
);

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
