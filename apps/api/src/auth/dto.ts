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

const passwordSchema = z
  .string()
  .min(10)
  .max(128)
  .regex(/[a-z]/u, "Password must contain a lowercase letter")
  .regex(/[A-Z]/u, "Password must contain an uppercase letter")
  .regex(/[0-9]/u, "Password must contain a number")
  .regex(/[^A-Za-z0-9]/u, "Password must contain a special character");

export const workspaceSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(48)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/u, "Use lowercase letters, numbers and hyphens only");

export const slugAvailabilitySchema = z.object({ slug: workspaceSlugSchema });

/**
 * Public merchant self-registration. A merchant has no tenant yet, so this payload carries
 * everything needed to provision one: the workspace identity, the business itself, its first
 * branch and the owner account.
 */
export const merchantRegistrationSchema = z.object({
  workspaceSlug: workspaceSlugSchema,
  businessName: z.string().trim().min(2).max(160),
  legalName: z.string().trim().min(2).max(160).optional(),
  countryCode: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase()),
  timezone: z.string().trim().min(3).max(64).default("Africa/Tunis"),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase())
    .default("TND"),
  locale: z.enum(["ar", "fr", "en"]).default("ar"),
  branchName: z.string().trim().min(2).max(160).optional(),
  planCode: z.string().trim().min(2).max(64).default("starter"),
  ownerName: z.string().trim().min(2).max(120),
  ownerEmail: z.email().transform((value) => value.trim().toLowerCase()),
  ownerPhone: z.string().trim().min(8).max(24),
  password: passwordSchema,
  acceptsTerms: z.literal(true, { error: "The terms of service must be accepted" }),
});

export type LoginQuery = z.infer<typeof loginQuerySchema>;
export type CallbackQuery = z.infer<typeof callbackQuerySchema>;
export type PasswordResetDto = z.infer<typeof passwordResetSchema>;
export type EmailVerificationDto = z.infer<typeof emailVerificationSchema>;
export type CustomerRegistrationDto = z.infer<typeof customerRegistrationSchema>;
export type MerchantRegistrationDto = z.output<typeof merchantRegistrationSchema>;
export type SlugAvailabilityDto = z.output<typeof slugAvailabilitySchema>;
