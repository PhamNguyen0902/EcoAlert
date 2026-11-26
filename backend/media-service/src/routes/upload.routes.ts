import { Router } from 'express';
import multer from 'multer';
import { uploadController } from '../controllers/upload.controller';
import {
  asyncHandler,
  BadRequestError,
  requireInternalService,
  requireVerifiedRoles,
} from '@ecoalert/shared';

const router = Router();
const ALLOWED_UPLOAD_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Multer in-memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_UPLOAD_MIMES.has(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new BadRequestError('Only JPEG, PNG, and WEBP images are allowed'));
    }
  }
});

const requireAuthenticatedUser = requireVerifiedRoles(['CITIZEN', 'OFFICER', 'ADMIN']);
const requireInternalCaller = requireInternalService(['ai-service', 'alert-service']);

const requireUploadOrInternalAuth = (req: any, res: any, next: any) => {
  if (req.get('x-service-signature')) {
    return requireInternalCaller(req, res, next);
  }
  return requireAuthenticatedUser(req, res, next);
};

router.post(
  '/upload',
  requireAuthenticatedUser,
  upload.single('image'),
  asyncHandler(uploadController.upload)
);
// Route phân tích ảnh từ xa: hỗ trợ cả cuộc gọi nội bộ (HMAC) và client đã xác thực JWT với URL S3 hợp lệ.
router.post('/analyze-url', requireUploadOrInternalAuth, asyncHandler(uploadController.analyzeRemoteImage));
export default router;
