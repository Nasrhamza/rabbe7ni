import { MerchantStatus } from "@rabbehni/database";
import { z } from "zod";

import { paginationSchema } from "../common/pagination.js";

const optionalCountryCode = z
  .string()
  .trim()
  .length(2)
  .transform((value) => value.toUpperCase())
  .optional();
const settingsSchema = z.record(z.string(), z.unknown());

export const merchantIdSchema = z.uuid();

export const createMerchantSchema = z.object({
  organizationId: z.uuid(),
  franchiseId: z.uuid().optional(),
  code: z.string().trim().min(2).max(64),
  legalName: z.string().trim().min(1).max(255),
  displayName: z.string().trim().min(1).max(200),
  status: z.enum(MerchantStatus).default(MerchantStatus.DRAFT),
  contactEmail: z.email().optional(),
  contactPhone: z.string().trim().max(40).optional(),
  website: z.url().optional(),
  addressLine: z.string().trim().max(500).optional(),
  city: z.string().trim().max(120).optional(),
  countryCode: optionalCountryCode,
  timezone: z.string().trim().max(64).optional(),
  locale: z.string().trim().max(20).optional(),
  settings: settingsSchema.default({}),
});

export const updateMerchantSchema = createMerchantSchema
  .omit({ organizationId: true, code: true, status: true })
  .partial()
  .extend({ franchiseId: z.uuid().nullable().optional() })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const updateMerchantSettingsSchema = z.object({ settings: settingsSchema });
export const merchantStatusSchema = z.object({
  status: z.enum([MerchantStatus.DRAFT, MerchantStatus.ACTIVE, MerchantStatus.SUSPENDED]),
});
export const merchantListSchema = paginationSchema.extend({
  organizationId: z.uuid().optional(),
  franchiseId: z.uuid().optional(),
  status: z.enum(MerchantStatus).optional(),
  includeArchived: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .default(false),
  sortBy: z.enum(["code", "displayName", "status", "createdAt"]).default("displayName"),
});

export type CreateMerchantDto = z.input<typeof createMerchantSchema>;
export type UpdateMerchantDto = z.input<typeof updateMerchantSchema>;
export type UpdateMerchantSettingsDto = z.input<typeof updateMerchantSettingsSchema>;
export type MerchantStatusDto = z.input<typeof merchantStatusSchema>;
export type MerchantListDto = z.input<typeof merchantListSchema>;
export type MerchantList = z.output<typeof merchantListSchema>;
