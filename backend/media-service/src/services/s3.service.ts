import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { AppError } from '@ecoalert/shared';
import { randomUUID } from 'crypto';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

export class S3Service {
  async uploadImage(file: Express.Multer.File, folder = 'ecoalert/alerts') {

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
      throw err;
    }
  }
}

export const s3Service = new S3Service();
