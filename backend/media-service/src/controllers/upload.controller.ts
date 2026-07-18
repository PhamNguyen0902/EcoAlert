import { Request, Response } from 'express';
import { cloudinaryService } from '../services/cloudinary.service';
import { successResponse, BadRequestError } from '@ecoalert/shared';

export class UploadController {
  async upload(req: Request, res: Response) {
    if (!req.file) {
      throw new BadRequestError('No image file provided');
    }

    // Process upload
    const secureUrl = await cloudinaryService.uploadImage(req.file.buffer, 'ecoalert/alerts');
    
    res.status(200).json(successResponse({ url: secureUrl }, 'Image uploaded successfully'));
  }
}

export const uploadController = new UploadController();
