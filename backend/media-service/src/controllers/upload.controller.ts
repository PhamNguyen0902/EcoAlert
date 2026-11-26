import { Request, Response } from "express";
import { s3Service } from "../services/s3.service";
import { visionService } from "../services/vision.service";
import { successResponse, BadRequestError, signMediaOwnership } from "@ecoalert/shared";
import axios from "axios";

const ALLOWED_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const detectImageType = (buffer: Buffer): { mime: string; ext: string } | null => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: "image/png", ext: "png" };
  }
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
};

const validateAllowedImageUrl = (rawUrl: string): URL => {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new BadRequestError("A valid HTTPS imageUrl is required");
  }
  if (parsed.protocol !== "https:") {
    throw new BadRequestError("Only HTTPS image URLs are allowed");
  }
  const hostname = parsed.hostname.toLowerCase();
  const allowedHosts = new Set(
    (process.env.ALLOWED_IMAGE_HOSTS || "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );
  const bucket = process.env.AWS_S3_BUCKET_NAME?.trim().toLowerCase();
  const region = process.env.AWS_REGION?.trim().toLowerCase();
  const s3Host = bucket && region ? `${bucket}.s3.${region}.amazonaws.com` : null;
  if (s3Host) allowedHosts.add(s3Host);

  if (allowedHosts.size === 0 || !allowedHosts.has(hostname)) {
    throw new BadRequestError("Image URL host is not allowed");
  }
  if (s3Host && hostname === s3Host && !parsed.pathname.startsWith("/ecoalert/")) {
    throw new BadRequestError("Image URL path is not allowed");
  }
  return parsed;
};

export class UploadController {
  // tải ảnh minh chứng lên kho lưu trữ đám mây
  async upload(req: Request, res: Response) {
    if (!req.file) {
      throw new BadRequestError("No image file provided");
    }
    const detected = detectImageType(req.file.buffer);
    if (!detected) {
      throw new BadRequestError("Invalid or unsupported image file (only JPEG, PNG, WEBP allowed)");
    }
    const idempotencyKey = typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey : undefined;
    if (idempotencyKey && !/^[a-zA-Z0-9:_-]{8,160}$/.test(idempotencyKey))
      throw new BadRequestError('Invalid media idempotency key');
    const safeFile = {
      ...req.file,
      mimetype: detected.mime,
      originalname: `upload.${detected.ext}`,
    };
    const imageUrl = await s3Service.uploadImage(safeFile, 'ecoalert/alerts', String(req.headers['x-user-id']), idempotencyKey);
    const ownershipProof = (process.env.SERVICE_AUTH_SECRET || process.env.JWT_SECRET || '').length >= 16
      ? signMediaOwnership(String(req.headers['x-user-id']), imageUrl) : undefined;
    const aiAnalysis = { status: 'skipped_not_applicable', detections: [], requiresManualReview: false };

    res.status(200).json(
      successResponse(
        {
          url: imageUrl,
          ...(ownershipProof ? { ownershipProof } : {}),
          aiAnalysis,
        },
        "Image uploaded and analyzed successfully"
      )
    );
  }

  // tải ảnh từ đường dẫn từ xa và gửi sang dịch vụ thị giác yolo để nhận diện
  async analyzeRemoteImage(req: Request, res: Response) {
    const imageUrl = typeof req.body?.imageUrl === 'string' ? req.body.imageUrl.trim() : '';
    if (!imageUrl) throw new BadRequestError('A valid HTTPS imageUrl is required');
    validateAllowedImageUrl(imageUrl);

    const response = await axios.get<ArrayBuffer>(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 15_000,
      maxRedirects: 0,
      maxContentLength: 10 * 1024 * 1024,
      maxBodyLength: 10 * 1024 * 1024,
    });
    const rawContentType = String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_IMAGE_MIMES.has(rawContentType)) {
      throw new BadRequestError('Remote URL did not return a supported image Content-Type');
    }
    const buffer = Buffer.from(response.data);
    const detected = detectImageType(buffer);
    if (!detected) {
      throw new BadRequestError('Remote file is not a valid JPEG, PNG, or WEBP image');
    }
    const aiAnalysis = await visionService.predict({
      buffer,
      originalname: `report-image.${detected.ext}`,
      mimetype: detected.mime,
    } as Express.Multer.File);
    res.status(200).json(successResponse({ imageUrl, aiAnalysis }, 'Waste image analyzed successfully'));
  }
}

export const uploadController = new UploadController();
