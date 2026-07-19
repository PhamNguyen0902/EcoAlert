import { Request, Response } from 'express';
import { cloudinaryService } from '../services/cloudinary.service';
import { successResponse, BadRequestError } from '@ecoalert/shared';
import { Media } from '../models/media.model';

export class UploadController {
  async upload(req: Request, res: Response) {
    if (!req.file) {
      throw new BadRequestError('No image file provided');
    }
    const citizenId = req.headers['x-user-id'] as string;

    // Process upload
    const secureUrl = await cloudinaryService.uploadImage(req.file.buffer, 'ecoalert/alerts');
    
    const media = new Media({
      url: secureUrl,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: citizenId || 'system'
    });
    await media.save();

    res.status(200).json(successResponse({ url: secureUrl, mediaId: media._id }, 'Image uploaded successfully'));
  }
}

export const uploadController = new UploadController();
