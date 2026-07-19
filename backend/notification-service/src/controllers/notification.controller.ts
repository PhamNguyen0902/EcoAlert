import { Request, Response } from 'express';
import { Notification } from '../models/notification.model';
import { successResponse, errorResponse, paginatedResponse } from '@ecoalert/shared';

export class NotificationController {
  async getNotifications(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const role = req.headers['x-user-role'] as string;
      
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const query = {
        $or: [
          { recipientId: userId },
          { recipientId: 'system' }
        ]
      };
      
      if (role === 'OFFICER' || role === 'ADMIN') {
        query.$or.push({ recipientId: 'officers' });
      }

      const total = await Notification.countDocuments(query);
      const items = await Notification.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      res.status(200).json(paginatedResponse(items, total, page, limit));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message));
    }
  }

  async getUnreadCount(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const role = req.headers['x-user-role'] as string;
      
      const query = {
        isRead: false,
        $or: [
          { recipientId: userId },
          { recipientId: 'system' }
        ]
      };
      
      if (role === 'OFFICER' || role === 'ADMIN') {
        query.$or.push({ recipientId: 'officers' });
      }

      const count = await Notification.countDocuments(query);
      res.status(200).json(successResponse({ count }));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message));
    }
  }

  async markAsRead(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const notification = await Notification.findByIdAndUpdate(id, { isRead: true }, { new: true });
      if (!notification) {
        return res.status(404).json(errorResponse('Notification not found'));
      }
      res.status(200).json(successResponse(notification, 'Marked as read'));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message));
    }
  }

  async markAllAsRead(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const role = req.headers['x-user-role'] as string;
      
      const query = {
        isRead: false,
        $or: [
          { recipientId: userId },
          { recipientId: 'system' }
        ]
      };
      
      if (role === 'OFFICER' || role === 'ADMIN') {
        query.$or.push({ recipientId: 'officers' });
      }

      await Notification.updateMany(query, { isRead: true });
      res.status(200).json(successResponse(null, 'All marked as read'));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message));
    }
  }

  async deleteNotification(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await Notification.findByIdAndDelete(id);
      res.status(200).json(successResponse(null, 'Notification deleted'));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message));
    }
  }
}

export const notificationController = new NotificationController();
