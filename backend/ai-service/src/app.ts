import express from 'express';
import cors from 'cors';
import { createLogger, errorResponse } from '@ecoalert/shared';
import { z } from 'zod';
import {
  analyzeIncidentWithOpenRouter,
  safeOpenRouterErrorMetadata,
} from './services/openrouter.service';
import { validateIncidentImage } from './services/image-validation.service';

const logger = createLogger('ai-service');

const app = express();
app.use(cors());
app.use(express.json({ limit: '32kb' }));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'ai-service' });
});

const visionDetectionClassSchema = z.object({
  materialClass: z.string().trim().min(1).max(120),
  count: z.number().int().nonnegative().max(10_000),
  averageConfidence: z.number().min(0).max(1),
}).strict();

const visionSummarySchema = z.object({
  objectCount: z.number().int().nonnegative().max(10_000),
  dominantClass: z.string().trim().min(1).max(120).optional(),
  averageConfidence: z.number().min(0).max(1).optional(),
  classes: z.array(visionDetectionClassSchema).max(30).optional(),
}).strict();

const semanticAnalysisRequestSchema = z.object({
  imageUrl: z.string().url().max(2_048),
  title: z.string().trim().max(500).optional(),
  description: z.string().trim().max(5_000).optional(),
  visionSummary: visionSummarySchema.optional(),
}).strict();

const parseSemanticAnalysisInput = (body: unknown) => {
  const parsed = semanticAnalysisRequestSchema.safeParse(body);
  if (!parsed.success) return null;
  return {
    ...parsed.data,
    description: parsed.data.description || '',
  };
};

/** Direct OpenRouter analysis endpoint used by the gateway. */
app.post('/analyze', async (req, res) => {
  try {
    const input = parseSemanticAnalysisInput(req.body);
    if (!input) {
      return res.status(400).json({ success: false, message: 'Dữ liệu phân tích ảnh không hợp lệ.' });
    }
    const result = await analyzeIncidentWithOpenRouter(input);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    logger.error('Direct AI analysis failed', safeOpenRouterErrorMetadata(error));
    res.status(503).json({ success: false, message: 'Dịch vụ phân tích AI tạm thời không khả dụng.' });
  }
});

app.post('/validate-image', async (req, res) => {
  const input = parseSemanticAnalysisInput(req.body);
  if (!input) {
    return res.status(400).json({ success: false, message: 'Vui lòng cung cấp imageUrl hợp lệ.' });
  }

  try {
    // Keep the report-creation validation flow compatible with existing callers
    // that only send imageUrl. The Vision upload flow always sends visionSummary.
    if (!input.visionSummary && !input.title && !input.description) {
      const validation = await validateIncidentImage(input.imageUrl);
      return res.status(200).json({ success: true, data: validation });
    }

    // This endpoint is invoked after Media Service returns YOLO detections.
    // OpenRouter receives the public image itself plus only the compact summary.
    const result = await analyzeIncidentWithOpenRouter(input);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logger.error('Vision semantic analysis failed', safeOpenRouterErrorMetadata(error));
    return res.status(503).json({ success: false, message: 'Không thể hoàn tất AI Vision semantic analysis.' });
  }
});

app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) =>
  res.status(500).json(errorResponse('Dịch vụ AI tạm thời không khả dụng.')),
);

export { app };
