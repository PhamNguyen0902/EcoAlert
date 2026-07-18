import { Router } from 'express';
import { alertController } from '../controllers/alert.controller';
import { validate } from '../middlewares/validate.middleware';
import { createAlertSchema, updateAlertStatusSchema } from '../dtos/alert.dto';
import { asyncHandler } from '@ecoalert/shared';

const router = Router();

// Middleware to check authentication (x-user-id)
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.headers['x-user-id']) return res.status(401).json({ success: false, message: 'Unauthorized' });
  next();
};

router.use(requireAuth);

router.post('/', validate(createAlertSchema), asyncHandler(alertController.createAlert));
router.get('/', asyncHandler(alertController.getAlerts));
router.get('/:id', asyncHandler(alertController.getAlertById));
router.patch('/:id/status', validate(updateAlertStatusSchema), asyncHandler(alertController.updateStatus));

export default router;
