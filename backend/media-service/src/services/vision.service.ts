import axios from 'axios';
import FormData from 'form-data';
import { createLogger } from '@ecoalert/shared';

const logger = createLogger('media-service');

export interface DetectionResult {
  materialClass: string;
  suggestedCategory: string;
  confidence: number;
  bbox: number[];
}

export interface VisionPredictionResponse {
  status: string;
  detections: DetectionResult[];
  requiresManualReview: boolean;
}

export class VisionService {
  private visionUrl: string;

  constructor() {
    this.visionUrl = process.env.VISION_SERVICE_URL || 'http://localhost:8001';
  }

  async predict(file: Express.Multer.File): Promise<VisionPredictionResponse | null> {
    try {
      const formData = new FormData();
      formData.append('file', file.buffer, {
        filename: file.originalname || 'upload.jpg',
        contentType: file.mimetype,
      });

      const response = await axios.post<VisionPredictionResponse>(
        `${this.visionUrl}/predict`,
        formData,
        {
          headers: formData.getHeaders(),
          timeout: 10000, // Timeout sau 10s
        }
      );

      return response.data;
    } catch (error: any) {
      logger.error('Failed to call vision-service:', error.message);
      // Trả về fallback để không chặn luồng upload nếu vision-service gặp sự cố
      return {
        status: 'error',
        detections: [],
        requiresManualReview: true,
      };
    }
  }
}

export const visionService = new VisionService();