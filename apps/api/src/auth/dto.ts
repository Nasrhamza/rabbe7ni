import { z } from "zod";

export const loginQuerySchema = z.object({
  redirect_uri: z.string().url(),
  locale: z.string().min(2).max(16).optional(),
});

export const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(16),
});

export const passwordResetSchema = z.object({
  email: z.email(),
  redirectUri: z.string().url().optional(),
});

export const emailVerificationSchema = z.object({
  redirectUri: z.string().url().optional(),
});

export const customerRegistrationSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  email: z.email().transform((value) => value.trim().toLowerCase()),
  phone: z.string().trim().min(8).max(24),
  password: z
    .string()
    .min(10)
    .max(128)
    .regex(/[a-z]/u, "Password must contain a lowercase letter")
    .regex(/[A-Z]/u, "Password must contain an uppercase letter")
    .regex(/[0-9]/u, "Password must contain a number")
    .regex(/[^A-Za-z0-9]/u, "Password must contain a special character"),
  locale: z.enum(["fr-TN", "ar-TN", "en"]).default("fr-TN"),
  referralCode: z
    .string()
    .trim()
    .min(6)
    .max(24)
    .transform((value) => value.toUpperCase())
    .optional(),
});

export type LoginQuery = z.infer<typeof loginQuerySchema>;
export type CallbackQuery = z.infer<typeof callbackQuerySchema>;
export type PasswordResetDto = z.infer<typeof passwordResetSchema>;
export type EmailVerificationDto = z.infer<typeof emailVerificationSchema>;
export type CustomerRegistrationDto = z.infer<typeof customerRegistrationSchema>;
