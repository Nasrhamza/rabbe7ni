import {
  BillingInterval,
  CustomDomainStatus,
  PlanStatus,
  SubscriptionStatus,
} from "@rabbehni/database";
import { z } from "zod";

const idempotencyKey = z.string().trim().min(8).max(128);
const color = z.string().regex(/^#[0-9a-f]{6}$/iu, "Expected a six-digit hexadecimal color");
const code = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9._-]*$/iu);
const jsonObject = z.record(z.string(), z.unknown());

export const createPlanSchema = z.object({
  code,
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  status: z.enum(PlanStatus).default(PlanStatus.DRAFT),
  currency: z
    .string()
    .length(3)
    .transform((value) => value.toUpperCase()),
  monthlyPriceMinor: z.number().int().nonnegative(),
  annualPriceMinor: z.number().int().nonnegative(),
  transactionFeeBasisPoints: z.number().int().min(0).max(10_000).default(0),
  trialDays: z.number().int().min(0).max(90).default(14),
  sortOrder: z.number().int().min(0).default(0),
  features: z
    .array(
      z.object({
        featureKey: code,
        enabled: z.boolean().default(true),
        configuration: jsonObject.default({}),
      }),
    )
    .default([]),
  quotas: z
    .array(
      z.object({
        metricKey: code,
        limitValue: z.number().int().nonnegative(),
        period: z.enum(["DAY", "MONTH", "LIFETIME"]).default("MONTH"),
      }),
    )
    .default([]),
});

export const updatePlanSchema = createPlanSchema.partial();

export const startTrialSchema = z.object({
  planId: z.uuid(),
  billingInterval: z.enum(BillingInterval).default(BillingInterval.MONTHLY),
  idempotencyKey,
});

export const lifecycleSchema = z.object({
  idempotencyKey,
  reason: z.string().trim().min(3).max(300).optional(),
  atPeriodEnd: z.boolean().default(false),
});

export const changePlanSchema = lifecycleSchema.extend({
  planId: z.uuid(),
});

export const checkoutSchema = z.object({
  subscriptionId: z.uuid(),
  idempotencyKey,
});

export const checkoutConfirmationSchema = z.object({
  checkoutToken: z.string().min(32),
  outcome: z.enum(["SUCCEEDED", "FAILED"]),
  idempotencyKey,
  failureCode: z.string().trim().max(80).optional(),
});

export const sandboxWebhookSchema = z.object({
  tenantId: z.uuid(),
  eventId: idempotencyKey,
  paymentIntentId: z.uuid(),
  outcome: z.enum(["SUCCEEDED", "FAILED"]),
  failureCode: z.string().trim().max(80).optional(),
});

export const usageSchema = z.object({
  subscriptionId: z.uuid().optional(),
  metricKey: code,
  quantity: z.number().int().positive(),
  idempotencyKey,
  referenceType: z.string().trim().max(80).optional(),
  referenceId: z.string().trim().max(160).optional(),
  metadata: jsonObject.default({}),
});

export const quotaOverrideSchema = z.object({
  metricKey: code,
  limitValue: z.number().int().nonnegative(),
  reason: z.string().trim().min(3).max(300),
  expiresAt: z.coerce.date().optional(),
});

export const whiteLabelSchema = z.object({
  productName: z.string().trim().min(2).max(80),
  logoUrl: z.string().url().nullable().optional(),
  faviconUrl: z.string().url().nullable().optional(),
  primaryColor: color,
  secondaryColor: color,
  fontFamily: z.enum(["Inter", "Manrope", "IBM Plex Sans", "Noto Sans Arabic"]),
  emailSenderName: z.string().trim().min(2).max(80),
  emailReplyTo: z.email().nullable().optional(),
  emailFooter: z.string().trim().max(500).nullable().optional(),
  themeMode: z.enum(["LIGHT", "DARK", "SYSTEM"]).default("LIGHT"),
});

export const localizationSchema = z
  .object({
    defaultLanguage: z.enum(["fr", "en", "ar"]),
    enabledLanguages: z.array(z.enum(["fr", "en", "ar"])).min(1),
    countries: z.array(z.string().length(2)).min(1),
    currencies: z.array(z.string().length(3)).min(1),
    timezones: z.array(z.string().min(3)).min(1),
    dateFormat: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]),
    timeFormat: z.enum(["12h", "24h"]),
    numberLocale: z.string().min(2).max(20),
    direction: z.enum(["LTR", "RTL"]),
  })
  .superRefine((value, context) => {
    if (!value.enabledLanguages.includes(value.defaultLanguage)) {
      context.addIssue({
        code: "custom",
        message: "Default language must be enabled",
        path: ["defaultLanguage"],
      });
    }
    value.timezones.forEach((timezone, index) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
      } catch {
        context.addIssue({
          code: "custom",
          message: "Invalid IANA timezone",
          path: ["timezones", index],
        });
      }
    });
  });

export const customDomainSchema = z.object({
  hostname: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^(?!-)(?:[a-z0-9-]+\.)+[a-z]{2,}$/u, "Invalid hostname"),
});

export const customDomainStatusSchema = z.object({
  status: z.enum(CustomDomainStatus),
});

export const createSubscriptionSchema = z
  .object({
    planId: z.uuid(),
    status: z.enum(SubscriptionStatus).default(SubscriptionStatus.TRIALING),
    billingInterval: z.enum(BillingInterval).default(BillingInterval.MONTHLY),
    startsAt: z.coerce.date(),
    trialEndsAt: z.coerce.date().optional(),
    currentPeriodEndsAt: z.coerce.date().optional(),
    idempotencyKey: idempotencyKey.default(() => crypto.randomUUID()),
  })
  .refine((value) => !value.trialEndsAt || value.trialEndsAt >= value.startsAt, {
    path: ["trialEndsAt"],
    message: "trialEndsAt must be on or after startsAt",
  })
  .refine((value) => !value.currentPeriodEndsAt || value.currentPeriodEndsAt >= value.startsAt, {
    path: ["currentPeriodEndsAt"],
    message: "currentPeriodEndsAt must be on or after startsAt",
  });

export type CreatePlanDto = z.output<typeof createPlanSchema>;
export type UpdatePlanDto = z.output<typeof updatePlanSchema>;
export type StartTrialDto = z.output<typeof startTrialSchema>;
export type LifecycleDto = z.output<typeof lifecycleSchema>;
export type ChangePlanDto = z.output<typeof changePlanSchema>;
export type CheckoutDto = z.output<typeof checkoutSchema>;
export type CheckoutConfirmationDto = z.output<typeof checkoutConfirmationSchema>;
export type SandboxWebhookDto = z.output<typeof sandboxWebhookSchema>;
export type UsageDto = z.output<typeof usageSchema>;
export type QuotaOverrideDto = z.output<typeof quotaOverrideSchema>;
export type WhiteLabelDto = z.output<typeof whiteLabelSchema>;
export type LocalizationDto = z.output<typeof localizationSchema>;
export type CustomDomainDto = z.output<typeof customDomainSchema>;
export type CreateSubscriptionInput = z.input<typeof createSubscriptionSchema>;
export type CreateSubscriptionDto = z.output<typeof createSubscriptionSchema>;
