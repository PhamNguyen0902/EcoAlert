import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { validate } from '../middlewares/validate.middleware';
import { updateProfileSchema, changePasswordSchema, changeRoleSchema } from '../dtos/user.dto';
import { requireAuth, requireRoles } from '../middlewares/auth.middleware';
import { asyncHandler, UserRole } from '@ecoalert/shared';

const router = Router();

router.use(requireAuth);

router.get('/profile', asyncHandler(userController.getMe));
router.patch('/profile', validate(updateProfileSchema), asyncHandler(userController.updateProfile));
router.patch('/change-password', validate(changePasswordSchema), asyncHandler(userController.changePassword));

router.use(requireRoles([UserRole.ADMIN]));
router.get('/', asyncHandler(userController.listUsers));
router.get('/:id', asyncHandler(userController.getUserById));
router.patch('/:id/role', validate(changeRoleSchema), asyncHandler(userController.changeRole));
router.patch('/:id/status', asyncHandler(userController.toggleStatus));
router.delete('/:id', asyncHandler(userController.deleteUser));

export default router;
