import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { requireVerifiedRoles } from '@ecoalert/shared';

const router = Router();
router.use(requireVerifiedRoles(['CITIZEN', 'OFFICER', 'ADMIN']));

router.get('/', notificationController.getNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.patch('/mark-all-read', notificationController.markAllAsRead);
router.patch('/:id/read', notificationController.markAsRead);
router.delete('/:id', notificationController.deleteNotification);

export default router;
