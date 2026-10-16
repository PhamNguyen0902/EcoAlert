import { z } from 'zod';

const bbox = z.tuple([z.number().finite(), z.number().finite(), z.number().finite(), z.number().finite()]);
const source = z.object({
  model_id: z.string().min(1).max(100),
  original_class_name: z.string().min(1).max(100),
  original_class_id: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1),
  bbox,
});

export const visionDetectionSchema = z.object({
  materialClass: z.string().trim().min(1).max(100),
  suggestedCategory: z.string().trim().max(100).optional(),
  confidence: z.number().min(0).max(1),
  bbox,
  model_id: z.string().max(100).optional(),
  original_class_name: z.string().max(100).optional(),
  original_class_id: z.number().int().nonnegative().optional(),
  needs_review: z.boolean().optional(),
  sources: z.array(source).optional(),
});

export const visionEvidenceSchema = z.object({
  imageUrl: z.string().url(),
  status: z.enum(['ok', 'no_detection', 'error', 'skipped_not_applicable']),
  detections: z.array(visionDetectionSchema),
  requiresManualReview: z.boolean(),
  degraded: z.boolean().optional(),
  model_errors: z.record(z.string()).optional(),
});
