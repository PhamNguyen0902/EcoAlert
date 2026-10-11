import { Request, Response } from "express";
import { Notification } from "../models/notification.model";
import {
  successResponse,
  errorResponse,
  paginatedResponse,
} from "@ecoalert/shared";
import { formatNotificationContent } from "../utils/notification-content";
import {
  Recipient,
  visibleQuery,
  unreadQuery,
  sharedRecipients,
  isReadFor,
} from "../utils/notification-access";

const identity = (req: Request): Recipient => ({
  userId: req.headers["x-user-id"] as string,
  role: req.headers["x-user-role"] as string,
});
const present = (record: any, userId: string, role: string) => {
  const { readBy, dismissedBy, ...data } = record.toObject
    ? record.toObject()
    : record;
  return {
    ...data,
    ...formatNotificationContent({ ...data, recipientRole: role }),
    isRead: isReadFor(record, userId),
  };
};
const failed = (res: Response) =>
  res
    .status(500)
    .json(errorResponse("Chưa cập nhật được thông báo. Vui lòng thử lại."));
const missing = (res: Response) =>
  res.status(404).json(errorResponse("Không tìm thấy thông báo."));
const validId = (id: string) => /^[a-f\d]{24}$/i.test(id);
export class NotificationController {
  async getNotifications(req: Request, res: Response) {
    try {
      const who = identity(req);
      const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
      const limit = Math.min(
        100,
        Math.max(1, Math.floor(Number(req.query.limit) || 20)),
      );
      const query = visibleQuery(who);
      const total = await Notification.countDocuments(query);
      const records = await Notification.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
      res.status(200).json(
        paginatedResponse(
          records.map((item) => present(item, who.userId, who.role)),
          total,
          page,
          limit,
        ),
      );
    } catch {
      failed(res);
    }
  }
  async getUnreadCount(req: Request, res: Response) {
    try {
      res
        .status(200)
        .json(
          successResponse({
            count: await Notification.countDocuments(
              unreadQuery(identity(req)),
            ),
          }),
        );
    } catch {
      failed(res);
    }
  }
  async markAsRead(req: Request, res: Response) {
    try {
      if (!validId(req.params.id)) return missing(res);
      const who = identity(req);
      const query = { _id: req.params.id, ...visibleQuery(who) };
      let notification = await Notification.findOneAndUpdate(
        { ...query, recipientId: who.userId },
        { $set: { isRead: true } },
        { returnDocument: "after" },
      );
      if (!notification)
        notification = await Notification.findOneAndUpdate(
          {
            ...query,
            recipientId: {
              $in: visibleQuery(who).recipientId.$in.filter((id) =>
                sharedRecipients.includes(id),
              ),
            },
          },
          { $addToSet: { readBy: who.userId } },
          { returnDocument: "after" },
        );
      if (!notification) return missing(res);
      res
        .status(200)
        .json(
          successResponse(
            present(notification, who.userId, who.role),
            "Đã đánh dấu đã đọc.",
          ),
        );
    } catch {
      failed(res);
    }
  }
  async markAllAsRead(req: Request, res: Response) {
    try {
      const who = identity(req);
      await Notification.updateMany(
        { ...visibleQuery(who), recipientId: who.userId },
        { $set: { isRead: true } },
      );
      await Notification.updateMany(
        {
          ...visibleQuery(who),
          recipientId: {
            $in: visibleQuery(who).recipientId.$in.filter((id) =>
              sharedRecipients.includes(id),
            ),
          },
        },
        { $addToSet: { readBy: who.userId } },
      );
      res.status(200).json(successResponse(null, "Đã đánh dấu tất cả đã đọc."));
    } catch {
      failed(res);
    }
  }
  async deleteNotification(req: Request, res: Response) {
    try {
      if (!validId(req.params.id)) return missing(res);
      const who = identity(req);
      // Dismiss, don't destroy history; shared records remain visible to other recipients.
      const notification = await Notification.findOneAndUpdate(
        { _id: req.params.id, ...visibleQuery(who) },
        { $addToSet: { dismissedBy: who.userId } },
        { returnDocument: "after" },
      );
      if (!notification) return missing(res);
      res
        .status(200)
        .json(
          successResponse(null, "Đã xóa thông báo khỏi danh sách của bạn."),
        );
    } catch {
      failed(res);
    }
  }
}
export const notificationController = new NotificationController();
