import { NextFunction, Request, Response, Router } from 'express';
import { alertController } from '../controllers/alert.controller';
import { categoryController } from '../controllers/category.controller';
import { validate } from '../middlewares/validate.middleware';
import {
  addOfficerNoteSchema,
  assignOfficerSchema,
  closeAlertSchema,
  confirmArrivalSchema,
  createAlertSchema,
  resolveAlertSchema,
  reviewClassificationSchema,
  shiftLocationSchema,
  updateAlertSchema,
  updateAlertStatusSchema,
} from '../dtos/alert.dto';
import { asyncHandler } from '@ecoalert/shared';

const router = Router();

// Middleware to check authentication (x-user-id)
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.headers['x-user-id']) return res.status(401).json({ success: false, message: 'Unauthorized' });
  next();
};

router.use(requireAuth);

// Category Routes
router.get('/categories', asyncHandler(categoryController.getCategories));
router.get('/categories/:id', asyncHandler(categoryController.getCategoryById));
router.post('/categories', asyncHandler(categoryController.createCategory));
router.patch('/categories/:id', asyncHandler(categoryController.updateCategory));
router.delete('/categories/:id', asyncHandler(categoryController.deleteCategory));

// Alert Routes
router.get('/nearby-check', asyncHandler(alertController.checkNearbyAlerts));
router.post('/officer/shifts/start', validate(shiftLocationSchema), asyncHandler(alertController.startShift));
router.post('/officer/shifts/end', validate(shiftLocationSchema), asyncHandler(alertController.endShift));
router.get('/officer/shifts/current', asyncHandler(alertController.getCurrentShift));
router.get('/officer/shifts/history', asyncHandler(alertController.getShiftHistory));
router.get('/officers/availability', asyncHandler(alertController.getOfficerAvailability));
router.post('/', validate(createAlertSchema), asyncHandler(alertController.createAlert));
router.get('/', asyncHandler(alertController.getAlerts));
router.get('/officer/tasks', asyncHandler(alertController.getOfficerTasks));
router.get('/:id', asyncHandler(alertController.getAlertById));
router.post('/:id/confirm', asyncHandler(alertController.confirmAlert));
router.patch('/:id', validate(updateAlertSchema), asyncHandler(alertController.updateAlert));
router.patch('/:id/status', validate(updateAlertStatusSchema), asyncHandler(alertController.updateStatus));
router.post('/:id/classification/review', validate(reviewClassificationSchema), asyncHandler(alertController.reviewClassification));
router.post('/:id/assign', validate(assignOfficerSchema), asyncHandler(alertController.assignOfficer));
router.post('/:id/start', asyncHandler(alertController.startHandling));
router.post('/:id/arrival', validate(confirmArrivalSchema), asyncHandler(alertController.confirmArrival));
router.post('/:id/resolution', validate(resolveAlertSchema), asyncHandler(alertController.resolveIncident));
router.post('/:id/close', validate(closeAlertSchema), asyncHandler(alertController.closeIncident));
router.post('/:id/note', validate(addOfficerNoteSchema), asyncHandler(alertController.addOfficerNote));
router.patch('/:id/restore', asyncHandler(alertController.restoreAlert));
router.delete('/:id', asyncHandler(alertController.deleteAlert));

export default router;


