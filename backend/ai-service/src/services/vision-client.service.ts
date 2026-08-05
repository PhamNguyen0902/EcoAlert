import axios from 'axios';
import { z } from 'zod';
import { createLogger, IAiVisionAnalysis } from '@ecoalert/shared';
import { envConfig } from '../config/env.config';

const logger = createLogger('ai-service');

export interface VisionErrorMetadata {
  errorType: string;
  status?: number;
  errorCode?: string;
  validationIssues?: Array<{
    path: string;
    code: string;
    message: string;
  }>;
}

export const safeVisionErrorMetadata = (error: unknown): VisionErrorMetadata => {
  const metadata: VisionErrorMetadata = {
    errorType: error instanceof Error ? error.name : 'UnknownError',
  };
  if (axios.isAxiosError(error)) {
    if (error.response?.status !== undefined) metadata.status = error.response.status;
    if (error.code) metadata.errorCode = error.code;
  }
  if (error instanceof z.ZodError) {
    metadata.validationIssues = error.issues.slice(0, 5).map((issue) => ({
      path: issue.path.join('.') || '<root>',
      code: issue.code,
      message: issue.message,
    }));
  }
  return metadata;
};

export const ECOALERT_DETECTOR_MODEL = 'ecoalert-waste-yolo26n-v1.pt';
export const ECOALERT_CLASS_NAMES = [
  'plastic_bottle',
  'plastic_bag',
  'plastic_cup',
  'metal_can',
  'cardboard',
  'glass_bottle',
] as const;

const ecoAlertClassSchema = z.enum(ECOALERT_CLASS_NAMES);

const bboxSchema = z.object({
  x: z.number().nonnegative(),
  y: z.number().nonnegative(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
}).strict();

const wasteTypeSchema = z.enum([
  'PLASTIC_WASTE', 'ORGANIC_WASTE', 'CONSTRUCTION_WASTE', 'HAZARDOUS_WASTE',
  'METAL_WASTE', 'GLASS_WASTE', 'PAPER_WASTE', 'E_WASTE', 'MIXED_WASTE', 'OTHER',
]);

const detectionSchema = z.object({
  classId: z.number().int().min(0).max(ECOALERT_CLASS_NAMES.length - 1),
  label: ecoAlertClassSchema,
  confidence: z.number().min(0).max(1),
  bbox: bboxSchema,
  normalizedBbox: bboxSchema,
  wasteType: wasteTypeSchema.nullable().optional(),
  maskAreaPixels: z.number().int().nonnegative().nullable().optional(),
  maskCoverage: z.number().min(0).max(1).nullable().optional(),
}).strict().superRefine((detection, context) => {
  if (ECOALERT_CLASS_NAMES[detection.classId] !== detection.label) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Vision class ID and label do not match the EcoAlert V1 taxonomy',
      path: ['label'],
    });
  }
});

const visionResponseSchema = z.object({
  status: z.literal('COMPLETED'),
  detectorModel: z.string().refine(
    (value) => value.replace(/\\/g, '/').split('/').pop() === ECOALERT_DETECTOR_MODEL,
    'Vision Service returned an unexpected detector model',
  ),
  segmenterModel: z.string().min(1).nullable().optional(),
  imageWidth: z.number().int().positive(),
  imageHeight: z.number().int().positive(),
  detections: z.array(detectionSchema),
  objectCounts: z.array(z.object({
    label: ecoAlertClassSchema,
    count: z.number().int().nonnegative(),
  }).strict()),
  totalDetectedObjects: z.number().int().nonnegative(),
  visibleWasteCoverage: z.number().min(0).max(1).nullable(),
  detectorConfidence: z.number().min(0).max(1).nullable(),
  segmentationConfidence: z.null(),
  annotatedImageBase64: z.string().min(1).nullable().optional(),
  annotatedImageContentType: z.literal('image/jpeg').nullable().optional(),
  processingTimeMs: z.number().int().nonnegative(),
  detectionTimeMs: z.number().int().nonnegative(),
  segmentationTimeMs: z.number().int().nonnegative(),
  annotationTimeMs: z.number().int().nonnegative(),
  warnings: z.array(z.string()),
}).strict().superRefine((result, context) => {
  if (result.totalDetectedObjects !== result.detections.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Vision totalDetectedObjects does not match detections',
      path: ['totalDetectedObjects'],
    });
  }
  const detectionCounts = new Map<string, number>();
  for (const detection of result.detections) {
    detectionCounts.set(detection.label, (detectionCounts.get(detection.label) || 0) + 1);
  }
  const seenLabels = new Set<string>();
  for (const count of result.objectCounts) {
    if (seenLabels.has(count.label) || detectionCounts.get(count.label) !== count.count) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Vision objectCounts does not match detections',
        path: ['objectCounts'],
      });
      break;
    }
    seenLabels.add(count.label);
  }
  if (seenLabels.size !== detectionCounts.size) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Vision objectCounts is incomplete',
      path: ['objectCounts'],
    });
  }
});

export interface VisionClientInput {
  alertId?: string;
  imageUrl: string;
}

export interface VisionClientDependencies {
  postVision?: typeof axios.post;
  postMedia?: typeof axios.post;
}

const uploadAnnotation = async (
  imageBase64: string,
  alertId: string | undefined,
  postMedia: typeof axios.post,
): Promise<string | undefined> => {
  if (!envConfig.internalGatewaySecret) {
    logger.warn('Annotated image upload skipped because the internal service secret is absent');
    return undefined;
  }
  const bytes = Buffer.from(imageBase64, 'base64');
  const form = new FormData();
  form.append(
    'image',
    new Blob([Uint8Array.from(bytes)], { type: 'image/jpeg' }),
    'vision-analysis.jpg',
  );
  if (alertId) form.append('alertId', alertId);
  const response = await postMedia(
    `${envConfig.mediaServiceUrl}/internal/vision-upload`,
    form,
    {
      timeout: 15_000,
      maxBodyLength: 10 * 1024 * 1024,
      headers: { 'x-internal-service-token': envConfig.internalGatewaySecret },
    },
  );
  const url = response.data?.data?.url;
  return typeof url === 'string' && url.length > 0 ? url : undefined;
};

export const analyzeImageWithVision = async (
  input: VisionClientInput,
  dependencies: VisionClientDependencies = {},
): Promise<IAiVisionAnalysis> => {
  if (!envConfig.internalGatewaySecret) {
    throw new Error('Vision internal authentication is not configured');
  }
  const postVision = dependencies.postVision || axios.post;
  const postMedia = dependencies.postMedia || axios.post;
  const request = () => postVision(
    `${envConfig.visionServiceUrl}/internal/v1/analyze`,
    {
      imageUrl: input.imageUrl,
      incidentId: input.alertId,
      segmentationEnabled: envConfig.visionSegmentationEnabled,
    },
    {
      timeout: envConfig.visionTimeoutMs,
      maxContentLength: 15 * 1024 * 1024,
      headers: { 'x-internal-service-token': envConfig.internalGatewaySecret },
    },
  );
  let response;
  try {
    response = await request();
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    const transient = axios.isAxiosError(error) && (status === undefined || status >= 500);
    if (!transient) throw error;
    logger.warn('Transient Vision request failed; retrying once', { status });
    try {
      response = await request();
    } catch (retryError) {
      logger.warn('Vision request failed after retry', safeVisionErrorMetadata(retryError));
      throw retryError;
    }
  }
  const parsed = visionResponseSchema.parse(response.data);
  let annotatedImageUrl: string | undefined;
  if (parsed.annotatedImageBase64) {
    try {
      annotatedImageUrl = await uploadAnnotation(
        parsed.annotatedImageBase64,
        input.alertId,
        postMedia,
      );
    } catch (error) {
      logger.warn('Annotated image upload failed; structured vision evidence is retained', {
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });
    }
  }

  return {
    status: 'COMPLETED',
    detectorModel: parsed.detectorModel,
    segmenterModel: parsed.segmenterModel || undefined,
    imageWidth: parsed.imageWidth,
    imageHeight: parsed.imageHeight,
    detections: parsed.detections.map((item) => ({
      ...item,
      wasteType: item.wasteType || undefined,
      maskAreaPixels: item.maskAreaPixels ?? undefined,
      maskCoverage: item.maskCoverage ?? undefined,
    })),
    objectCounts: parsed.objectCounts,
    totalDetectedObjects: parsed.totalDetectedObjects,
    visibleWasteCoverage: parsed.visibleWasteCoverage,
    detectorConfidence: parsed.detectorConfidence,
    segmentationConfidence: null,
    annotatedImageUrl,
    processingTimeMs: parsed.processingTimeMs,
    detectionTimeMs: parsed.detectionTimeMs,
    segmentationTimeMs: parsed.segmentationTimeMs,
    annotationTimeMs: parsed.annotationTimeMs,
    warnings: parsed.warnings,
  };
};
