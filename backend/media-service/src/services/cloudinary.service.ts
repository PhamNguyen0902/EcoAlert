import { cloudinary } from '../config/cloudinary.config';
import streamifier from 'streamifier';
import { AppError } from '@ecoalert/shared';

export class CloudinaryService {
  async uploadImage(fileBuffer: Buffer, folder: string = 'ecoalert'): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder },
        (error, result) => {
          if (error || !result) {
            reject(new AppError('Failed to upload image to Cloudinary', 500));
          } else {
            resolve(result.secure_url);
          }
        }
      );
      streamifier.createReadStream(fileBuffer).pipe(uploadStream);
    });
  }
}

export const cloudinaryService = new CloudinaryService();
