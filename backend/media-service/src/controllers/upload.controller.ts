import { Request, Response } from "express";
import { s3Service } from "../services/s3.service";
import { successResponse, BadRequestError } from "@ecoalert/shared";

export class UploadController {
  async upload(req: Request, res: Response) {
    if (!req.file) {
      throw new BadRequestError("No image file provided");
    }

    const imageUrl = await s3Service.uploadImage(req.file);
    res
      .status(200)
      .json(successResponse({ url: imageUrl }, "Image uploaded successfully"));
  }
}

export const uploadController = new UploadController();
