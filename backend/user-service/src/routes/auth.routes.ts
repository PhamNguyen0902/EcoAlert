import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate.middleware';
import { registerSchema, loginSchema, refreshTokenSchema } from '../dtos/auth.dto';
import { requireAuth } from '../middlewares/auth.middleware';
import { asyncHandler } from '@ecoalert/shared';

const router = Router();

router.post('/register', validate(registerSchema), asyncHandler(authController.register));
router.post('/login', validate(loginSchema), asyncHandler(authController.login));
router.post('/refresh-token', validate(refreshTokenSchema), asyncHandler(authController.refreshToken));
router.post('/logout', requireAuth, asyncHandler(authController.logout));

export default router;
