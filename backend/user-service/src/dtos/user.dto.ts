import { z } from 'zod';
import { UserRole } from '@ecoalert/shared';

export const updateProfileSchema = z.object({
  fullName: z.string().min(1).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  avatar: z.string().url().or(z.literal('')).optional(),
});
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  oldPassword: z.string(),
  newPassword: z.string().min(6),
});
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;

export const changeRoleSchema = z.object({
  role: z.string().transform((val) => val.toUpperCase()),
});
export type ChangeRoleDto = z.infer<typeof changeRoleSchema>;

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(1),
  phone: z.string().optional().or(z.literal('')),
  role: z.string().optional(),
});
export type CreateUserDto = z.infer<typeof createUserSchema>;

