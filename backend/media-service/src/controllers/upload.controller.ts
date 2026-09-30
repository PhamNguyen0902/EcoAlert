import { Request, Response } from "express";
import { s3Service } from "../services/s3.service";
import { visionService } from "../services/vision.service";
import { successResponse, BadRequestError } from "@ecoalert/shared";
import axios from "axios";

export class UploadController {
  // tải ảnh minh chứng lên kho lưu trữ đám mây
  async upload(req: Request, res: Response) {
    if (!req.file) {
      throw new BadRequestError("No image file provided");
    }

    const imageUrl = await s3Service.uploadImage(req.file);
    const aiAnalysis = { status: 'skipped_not_applicable', detections: [], requiresManualReview: false };

    res.status(200).json(
      successResponse(
        {
          url: imageUrl,
          aiAnalysis,
        },
        "Image uploaded and analyzed successfully"
      )
    );
  }

  // tải ảnh từ đường dẫn từ xa và gửi sang dịch vụ thị giác yolo để nhận diện
  async analyzeRemoteImage(req: Request, res: Response) {
    const imageUrl = typeof req.body?.imageUrl === 'string' ? req.body.imageUrl : '';
    if (!/^https?:\/\//i.test(imageUrl)) throw new BadRequestError('A public imageUrl is required');
    const response = await axios.get<ArrayBuffer>(imageUrl, { responseType: 'arraybuffer', timeout: 15_000 });
    const mimeType = String(response.headers['content-type'] || 'image/jpeg').split(';')[0];
    if (!mimeType.startsWith('image/')) throw new BadRequestError('Remote URL is not an image');
    const aiAnalysis = await visionService.predict({
      buffer: Buffer.from(response.data),
      originalname: new URL(imageUrl).pathname.split('/').pop() || 'report-image.jpg',
      mimetype: mimeType,
    } as Express.Multer.File);
    res.status(200).json(successResponse({ imageUrl, aiAnalysis }, 'Waste image analyzed successfully'));
  }
}

export const uploadController = new UploadController();
