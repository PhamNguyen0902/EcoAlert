import { z } from 'zod';
import { UserRole } from '@ecoalert/shared';

export const updateProfileSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().optional(),
  avatar: z.string().url().optional(),
});
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  oldPassword: z.string(),
  newPassword: z.string().min(6),
});
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;

export const changeRoleSchema = z.object({
  role: z.nativeEnum(UserRole),
});
export type ChangeRoleDto = z.infer<typeof changeRoleSchema>;
