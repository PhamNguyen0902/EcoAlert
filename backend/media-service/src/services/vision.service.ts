import axios from 'axios';
import FormData from 'form-data';
import { createLogger } from '@ecoalert/shared';

const logger = createLogger('media-service');

export interface DetectionResult {
  materialClass: string;
  suggestedCategory: string;
  confidence: number;
  bbox: number[];
  model_id?: string;
  original_class_name?: string;
  original_class_id?: number;
  needs_review?: boolean;
  sources?: Array<{ model_id: string; original_class_name: string; original_class_id: number; confidence: number; bbox: number[] }>;
}

export interface VisionPredictionResponse {
  status: string;
  detections: DetectionResult[];
  requiresManualReview: boolean;
  degraded?: boolean;
  model_errors?: Record<string, string>;
  errorCode?: string;
}

export class VisionService {
  private visionUrl: string;
  private maxRetries: number;
  private baseDelayMs: number;

  constructor(options?: { maxRetries?: number; baseDelayMs?: number }) {
    this.visionUrl = process.env.VISION_SERVICE_URL || 'http://localhost:8001';
    this.maxRetries = Math.max(0, options?.maxRetries ?? 2);
    this.baseDelayMs = Math.max(0, options?.baseDelayMs ?? 300);
  }

  async predict(file: Express.Multer.File): Promise<VisionPredictionResponse | null> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
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
            timeout: 40000,
          }
        );

        if (!response.data || !['ok', 'no_detection', 'error'].includes(response.data.status)
          || !Array.isArray(response.data.detections) || typeof response.data.requiresManualReview !== 'boolean') {
          return { status: 'error', detections: [], requiresManualReview: true, errorCode: 'INVALID_VISION_RESPONSE' };
        }
        return response.data;
      } catch (error: any) {
        const status = error?.response?.status;
        if (status === 503 && attempt < this.maxRetries) {
          const retryAfterRaw =
            error.response?.headers?.['retry-after'] ?? error.response?.headers?.['Retry-After'];
          const retryAfterSec = Number.parseFloat(String(retryAfterRaw ?? ''));
          const delayMs =
            Number.isFinite(retryAfterSec) && retryAfterSec > 0
              ? Math.min(2_000, Math.max(50, Math.round(retryAfterSec * 1000)))
              : Math.min(2_000, this.baseDelayMs * (attempt + 1));
          logger.warn('Vision service returned 503 busy; retrying', {
            attempt: attempt + 1,
            maxRetries: this.maxRetries,
            delayMs,
          });
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        logger.error('Failed to call vision-service', { code: error.code, status });
        // Trả về fallback để không chặn luồng upload nếu vision-service gặp sự cố
        return {
          status: 'error',
          detections: [],
          requiresManualReview: true,
          errorCode: error.code === 'ECONNABORTED' ? 'VISION_TIMEOUT' : 'VISION_UNAVAILABLE',
        };
      }
    }
    return {
      status: 'error',
      detections: [],
      requiresManualReview: true,
      errorCode: 'VISION_UNAVAILABLE',
    };
  }
}

export const visionService = new VisionService();
