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
  async uploadImage(file: Express.Multer.File, folder: string = 'ecoalert/alerts'): Promise<string> {
    try {
      const fileExtension = file.originalname.split('.').pop() || 'jpg';
      const key = `${folder}/${randomUUID()}.${fileExtension}`;
      const bucketName = process.env.AWS_S3_BUCKET_NAME;

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await s3Client.send(command);

      return `https://${bucketName}.s3.${process.env.AWS_REGION || 'ap-southeast-1'}.amazonaws.com/${key}`;
    } catch (error: any) {
      console.error('S3 Upload Error:', error);
      throw new AppError('Failed to upload image to AWS S3', 500);
    }
  }
}

export const s3Service = new S3Service();
