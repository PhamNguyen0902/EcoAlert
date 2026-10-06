export interface NotificationItem {
  _id: string;
  recipientId: string;
  /** RabbitMQ deduplication key, NOT a report ID. */
  eventId?: string;
  /** Present on newly created report-workflow notifications. */
  alertId?: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}
