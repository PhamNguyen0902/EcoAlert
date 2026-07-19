import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  recipientId: string; // 'system', 'officers', or userId
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>({
  recipientId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
