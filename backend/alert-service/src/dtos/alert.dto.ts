import { z } from "zod";
import { AlertStatus, AlertCategory, Severity } from "@ecoalert/shared";
import { visionEvidenceSchema } from './vision.schema';

const categorySchema = z.nativeEnum(AlertCategory);
const imageValidationSchema = z.object({
  decision: z.enum(["VALID", "UNCERTAIN", "INVALID", "UNAVAILABLE"]),
  isEnvironmentalIncident: z.boolean().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  suggestedCategory: categorySchema.nullable().optional(),
  reason: z.string().trim().min(1).max(500),
  model: z.string().trim().max(200).nullable().optional(),
  validatedAt: z.string().datetime().or(z.date()),
});

const citizenClassificationSchema = z
  .object({
    selectedCategory: categorySchema.optional(),
    decision: z.enum(["CONFIRM", "CORRECT"]).optional(),
  })
  .optional();

const captureMetadataSchema = z.object({
  method: z.literal("LIVE_CAMERA"),
  capturedAt: z.string().datetime(),
  gpsAccuracyMeters: z.number().finite().nonnegative().max(10_000),
  gpsCapturedAt: z.string().datetime().optional(),
  locationSource: z.literal("DEVICE_GPS"),
});

const fieldEvidenceSchema = z.object({
  photoId: z.string().trim().min(1).max(100).optional(),
  isPrimary: z.boolean().optional(),
  originalUrl: z.string().url(),
  originalOwnershipProof: z.string().optional(),
  displayUrl: z.string().url().optional(),
  displayOwnershipProof: z.string().optional(),
  capturedAt: z.string().datetime(),
  gpsAccuracyMeters: z.number().finite().nonnegative().max(10_000),
  gpsCapturedAt: z.string().datetime().optional(),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

//backend kiểm tra  payload ở đây
export const createAlertSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(10),
  category: categorySchema.optional(),
  categories: z.array(categorySchema).max(12).optional(),
  severity: z.nativeEnum(Severity).or(z.string()).optional(),
  mediaUrls: z.array(z.string().url()).min(1).max(6),
  clientReportId: z.string().trim().min(8).max(100).optional(),
  // This records client context only; it is not proof that the evidence is valid.
  captureMetadata: captureMetadataSchema.optional(),
  fieldEvidence: z.array(fieldEvidenceSchema).max(6).optional(),
  visionEvidence: z.array(visionEvidenceSchema).max(6).optional(),
  location: z.object({
    type: z.literal("Point"),
    coordinates: z.tuple([z.number(), z.number()]), // [longitude, latitude]
  }),
  address: z.string().trim().min(1).max(500).optional(),
  isAnonymous: z.boolean().optional(),
  voiceNoteUrl: z.string().url().optional().or(z.string().optional()),
  imageValidation: imageValidationSchema.optional(),
  classification: citizenClassificationSchema,
}).superRefine((value, context) => {
  if (value.clientReportId && (value.fieldEvidence?.length || 0) > 5) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['fieldEvidence'], message: 'Field report supports at most five images' });
  }
  if (value.clientReportId && (!value.fieldEvidence || value.fieldEvidence.length !== value.mediaUrls.length || value.fieldEvidence.filter(item => item.isPrimary).length !== 1)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['fieldEvidence'], message: 'Field report requires one signed evidence record per image and exactly one primary image' });
  }
  if (value.clientReportId && value.fieldEvidence?.length && new Set(value.mediaUrls).size !== value.mediaUrls.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['mediaUrls'], message: 'Duplicate evidence image URL' });
  }
  if (value.clientReportId && value.fieldEvidence?.length &&
      new Set(value.fieldEvidence.map(item => item.originalUrl)).size !== value.fieldEvidence.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['fieldEvidence'], message: 'Each field image must reference a distinct original URL' });
  }
  const photoIds = value.fieldEvidence?.map(item => item.photoId).filter(Boolean) || [];
  if (new Set(photoIds).size !== photoIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['fieldEvidence'], message: 'Duplicate photo ID' });
  }
  if (value.clientReportId && value.fieldEvidence?.length && value.fieldEvidence.length !== value.mediaUrls.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['fieldEvidence'], message: 'Every original media URL needs its own field evidence' });
  }
  if ((value.fieldEvidence?.filter(item => item.isPrimary).length || 0) > 1) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['fieldEvidence'], message: 'Only one image can be primary' });
  }
  const primary = value.fieldEvidence?.find(item => item.isPrimary);
  if (value.clientReportId) value.fieldEvidence?.forEach((item, index) => {
    if (!item.photoId) context.addIssue({ code: z.ZodIssueCode.custom, path: ['fieldEvidence', index, 'photoId'], message: 'Each field image needs a stable photo ID' });
    if (item.latitude === undefined || item.longitude === undefined || !item.gpsCapturedAt) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['fieldEvidence', index], message: 'Each field image needs its own GPS coordinates and fix time' });
    }
    if (item.gpsAccuracyMeters > 50) context.addIssue({ code: z.ZodIssueCode.custom, path: ['fieldEvidence', index, 'gpsAccuracyMeters'], message: 'Field GPS accuracy exceeds 50m' });
    if (item.gpsCapturedAt && Math.abs(Date.parse(item.capturedAt) - Date.parse(item.gpsCapturedAt)) > 5 * 60_000)
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['fieldEvidence', index, 'gpsCapturedAt'], message: 'Field GPS fix is stale' });
  });
  if (primary && ((primary.latitude !== undefined && primary.latitude !== value.location.coordinates[1]) ||
      (primary.longitude !== undefined && primary.longitude !== value.location.coordinates[0]))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['fieldEvidence'], message: 'Primary image GPS must match report location' });
  }
  value.fieldEvidence?.forEach((evidence, index) => {
    if (!value.mediaUrls.includes(evidence.originalUrl)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fieldEvidence', index, 'originalUrl'],
        message: 'Field evidence originalUrl must be included in mediaUrls',
      });
    }
  });
});
export type CreateAlertDto = z.infer<typeof createAlertSchema>;

export const updateAlertStatusSchema = z.object({
  status: z.nativeEnum(AlertStatus),
});
export type UpdateAlertStatusDto = z.infer<typeof updateAlertStatusSchema>;

export const assignOfficerSchema = z.object({
  officerId: z.string().trim().min(1, "Officer is required"),
  overrideConfirmed: z.boolean().optional(),
  assignmentReason: z.string().trim().min(5).max(1000).optional(),
});
export type AssignOfficerDto = z.infer<typeof assignOfficerSchema>;

export const shiftLocationSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracyMeters: z.number().finite().nonnegative(),
});
export type ShiftLocationDto = z.infer<typeof shiftLocationSchema>;

export const confirmArrivalSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracyMeters: z.number().finite().nonnegative(),
});
export type ConfirmArrivalDto = z.infer<typeof confirmArrivalSchema>;

export const resolutionEvidenceSchema = z.object({
  mediaId: z.string().trim().min(1).optional(),
  url: z.string().url(),
  capturedAt: z.string().datetime().optional(),
  location: z
    .object({
      latitude: z.number().finite().min(-90).max(90),
      longitude: z.number().finite().min(-180).max(180),
      accuracyMeters: z.number().finite().nonnegative(),
    })
    .optional(),
});

export const resolveAlertSchema = z.object({
  resolutionSummary: z
    .string()
    .trim()
    .min(1, "Resolution summary is required")
    .max(4000),
  treatmentMethod: z
    .string()
    .trim()
    .min(1, "Treatment method is required")
    .max(4000),
  materialsUsed: z.string().trim().max(2000).optional(),
  additionalNotes: z.string().trim().max(4000).optional(),
  evidence: z
    .array(resolutionEvidenceSchema)
    .min(1, "At least one after-treatment image is required")
    .max(20),
});
export type ResolveAlertDto = z.infer<typeof resolveAlertSchema>;

export const closeAlertSchema = z.object({
  reviewNote: z.string().trim().max(4000).optional(),
});
export type CloseAlertDto = z.infer<typeof closeAlertSchema>;

export const reviewClassificationSchema = z.object({
  category: categorySchema.optional(),
});
export type ReviewClassificationDto = z.infer<
  typeof reviewClassificationSchema
>;

export const updateAlertSchema = z.object({
  title: z.string().min(5).optional(),
  description: z.string().min(10).optional(),
  mediaUrls: z.array(z.string()).optional(),
  location: z
    .object({
      type: z.literal("Point"),
      coordinates: z.tuple([z.number(), z.number()]),
    })
    .optional(),
  address: z.string().optional(),
  category: z.nativeEnum(AlertCategory).optional(),
  categories: z.array(categorySchema).max(12).optional(),
  severity: z.nativeEnum(Severity).optional(),
});
export type UpdateAlertDto = z.infer<typeof updateAlertSchema>;

export const addOfficerNoteSchema = z.object({
  note: z.string().min(1, "Note cannot be empty").max(2000, "Note too long"),
});
export type AddOfficerNoteDto = z.infer<typeof addOfficerNoteSchema>;
