import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  fullName: z.string().optional(),
  phone: z.string().optional(),
});
export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});
export type LoginDto = z.infer<typeof loginSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});
export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;

export const confirmOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4, "OTP code must be at least 4 characters").max(10),
});
export type ConfirmOtpDto = z.infer<typeof confirmOtpSchema>;

export const resendOtpSchema = z.object({
  email: z.string().email(),
});
export type ResendOtpDto = z.infer<typeof resendOtpSchema>;
