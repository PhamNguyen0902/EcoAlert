import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { AppError, createLogger, HTTP_STATUS } from '@ecoalert/shared';
import { randomUUID } from 'crypto';

const logger = createLogger('media-service');
// Dịch vụ S3 để quản lý việc tải lên hình ảnh sự cố môi trường lên Amazon S3.
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

export class S3Service {
  async uploadImage(file: Express.Multer.File, folder = 'ecoalert/alerts') {
    const requiredSettings = [
      'AWS_REGION',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'AWS_S3_BUCKET_NAME',
    ];
    const missingSettings = requiredSettings.filter((setting) => !process.env[setting]);

    if (missingSettings.length > 0) {
      throw new AppError(
        `Media storage is not configured (${missingSettings.join(', ')})`,
        HTTP_STATUS.SERVICE_UNAVAILABLE,
      );
    }

    try {
      const fileExtension = file.originalname.split('.').pop() || 'jpg';
      const key = `${folder}/${randomUUID()}.${fileExtension}`;

      const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      const result = await s3Client.send(command);

      return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown S3 upload error');
      logger.error('S3 image upload failed', { name: error.name, message: error.message });
      throw err;
    }
  }
}

export const s3Service = new S3Service();
