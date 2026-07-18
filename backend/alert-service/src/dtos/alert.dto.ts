import { z } from 'zod';
import { AlertStatus, AlertCategory, Severity } from '@ecoalert/shared';

export const createAlertSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(10),
  mediaUrls: z.array(z.string().url()).optional(),
  location: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number(), z.number()]) // [longitude, latitude]
  }),
  address: z.string().optional()
});
export type CreateAlertDto = z.infer<typeof createAlertSchema>;

export const updateAlertStatusSchema = z.object({
  status: z.nativeEnum(AlertStatus)
});
export type UpdateAlertStatusDto = z.infer<typeof updateAlertStatusSchema>;

export const assignOfficerSchema = z.object({
  officerId: z.string()
});
export type AssignOfficerDto = z.infer<typeof assignOfficerSchema>;
