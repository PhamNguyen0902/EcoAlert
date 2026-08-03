import { Router } from 'express';
import multer from 'multer';
import { uploadController } from '../controllers/upload.controller';
import { asyncHandler, BadRequestError } from '@ecoalert/shared';
import { timingSafeEqual } from 'crypto';

const router = Router();

// Multer in-memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new BadRequestError('Only images are allowed'));
    }
  }
});

// Middleware to check authentication (x-user-id) via Gateway
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.headers['x-user-id']) return res.status(401).json({ success: false, message: 'Unauthorized' });
  next();
};

const requireInternalAuth = (req: any, res: any, next: any) => {
  const expected = process.env.INTERNAL_GATEWAY_SHARED_SECRET || '';
  const supplied = String(req.headers['x-internal-service-token'] || '');
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  if (
    !expected ||
    expectedBuffer.length !== suppliedBuffer.length ||
    !timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
};

router.post(
  '/upload',
  requireAuth,
  upload.single('image'),
  asyncHandler(uploadController.upload)
);
router.post(
  '/internal/vision-upload',
  requireInternalAuth,
  upload.single('image'),
  asyncHandler(uploadController.uploadVisionAnnotation.bind(uploadController)),
);
export default router;
