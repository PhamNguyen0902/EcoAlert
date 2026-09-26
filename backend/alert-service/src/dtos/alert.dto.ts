import { z } from "zod";
import { AlertStatus, AlertCategory, Severity } from "@ecoalert/shared";

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

const visionDetectionSchema = z.object({
  materialClass: z.string().trim().min(1).max(100),
  suggestedCategory: z.string().trim().max(100).optional(),
  confidence: z.number().min(0).max(1),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
});

const visionEvidenceSchema = z.object({
  imageUrl: z.string().url(),
  status: z.enum(['ok', 'no_detection', 'error', 'skipped_not_applicable']),
  detections: z.array(visionDetectionSchema).max(300),
  requiresManualReview: z.boolean(),
});
//backend kiểm tra  payload ở đây
export const createAlertSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(10),
  category: categorySchema.optional(),
  categories: z.array(categorySchema).max(12).optional(),
  severity: z.nativeEnum(Severity).or(z.string()).optional(),
  mediaUrls: z.array(z.string().url()).min(1).max(6),
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
});
export type CreateAlertDto = z.infer<typeof createAlertSchema>;

export const updateAlertStatusSchema = z.object({
  status: z.nativeEnum(AlertStatus),
});
export type UpdateAlertStatusDto = z.infer<typeof updateAlertStatusSchema>;

export const assignOfficerSchema = z.object({
  officerId: z.string().trim().min(1, "Officer is required"),
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
