import { cloudinary } from '../config/cloudinary.config';
import streamifier from 'streamifier';
import { AppError } from '@ecoalert/shared';

export class CloudinaryService {
  async uploadImage(
    fileBuffer: Buffer,
    folder = 'ecoalert'
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder },
        (error, result) => {
          if (error) {
            console.error("Cloudinary Error:", error);
            return reject(error);
          }

          if (!result) {
            return reject(new Error("No upload result"));
          }

          resolve(result.secure_url);
        }
        
      );

      streamifier.createReadStream(fileBuffer).pipe(uploadStream);
    });
  }
}

export const cloudinaryService = new CloudinaryService();