import { CustomerStatus } from "@rabbehni/database";
import { z } from "zod";

import { paginationSchema } from "../common/pagination.js";

const jsonObject = z.record(z.string(), z.unknown());

export const customerIdSchema = z.uuid();
export const createCustomerSchema = z.object({
  organizationId: z.uuid(),
  externalReference: z.string().trim().min(1).max(120).optional(),
  email: z.email().optional(),
  phone: z.string().trim().min(4).max(40).optional(),
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  displayName: z.string().trim().min(1).max(200),
  locale: z.string().trim().min(2).max(20).default("en"),
  birthDate: z.coerce.date().optional(),
  preferences: jsonObject.default({}),
  communicationPreferences: jsonObject.default({}),
  consents: jsonObject.default({}),
});
export const updateCustomerSchema = createCustomerSchema
  .omit({ organizationId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");
export const customerStatusSchema = z.object({
  status: z.enum([CustomerStatus.ACTIVE, CustomerStatus.SUSPENDED]),
});
export const customerPreferencesSchema = z
  .object({
    locale: z.string().trim().min(2).max(20).optional(),
    preferences: jsonObject.optional(),
    communicationPreferences: jsonObject.optional(),
    consents: jsonObject.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one preference is required");
export const customerProfileSchema = z
  .object({
    displayName: z.string().trim().min(2).max(200).optional(),
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    phone: z.string().trim().min(4).max(40).optional(),
    locale: z.enum(["fr-TN", "ar-TN", "en"]).optional(),
    preferredCurrency: z.enum(["TND", "EUR", "USD", "AED"]).optional(),
    avatarKey: z.enum(["default", "woman", "man", "merchant"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one profile field is required");
export const referralCodeSchema = z
  .string()
  .trim()
  .min(6)
  .max(24)
  .transform((value) => value.toUpperCase());
export const customerListSchema = paginationSchema.extend({
  organizationId: z.uuid().optional(),
  status: z.enum(CustomerStatus).optional(),
  includeArchived: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .default(false),
  sortBy: z.enum(["displayName", "email", "status", "createdAt"]).default("displayName"),
});

export type CreateCustomerDto = z.output<typeof createCustomerSchema>;
export type UpdateCustomerDto = z.output<typeof updateCustomerSchema>;
export type CustomerStatusDto = z.output<typeof customerStatusSchema>;
export type CustomerPreferencesDto = z.output<typeof customerPreferencesSchema>;
export type CustomerProfileDto = z.output<typeof customerProfileSchema>;
export type CustomerListDto = z.input<typeof customerListSchema>;
export type CustomerList = z.output<typeof customerListSchema>;
