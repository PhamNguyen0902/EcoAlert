import { Request, Response } from "express";
import { s3Service } from "../services/s3.service";
import { visionService } from "../services/vision.service";
import { successResponse, BadRequestError } from "@ecoalert/shared";

export class UploadController {
  async upload(req: Request, res: Response) {
    if (!req.file) {
      throw new BadRequestError("No image file provided");
    }

    // Chạy song song: vừa upload ảnh lên S3, vừa gửi buffer sang vision-service
    const [imageUrl, aiAnalysis] = await Promise.all([
      s3Service.uploadImage(req.file),
      visionService.predict(req.file),
    ]);

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
}

export const uploadController = new UploadController();