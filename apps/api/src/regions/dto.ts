import { RegionStatus } from "@rabbehni/database";
import { z } from "zod";

import { paginationSchema } from "../common/pagination.js";

const id = z.uuid();
const countryCode = z
  .string()
  .trim()
  .length(2)
  .transform((value) => value.toUpperCase());
const currency = z
  .string()
  .trim()
  .length(3)
  .transform((value) => value.toUpperCase());

export const regionIdSchema = id;
export const countryIdSchema = id;

export const countryListSchema = paginationSchema.extend({
  active: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  sortBy: z.enum(["code", "name", "createdAt"]).default("name"),
});

export const createCountrySchema = z.object({
  code: countryCode,
  name: z.string().trim().min(2).max(120),
  defaultLocale: z.string().trim().min(2).max(35),
  defaultCurrency: currency,
  active: z.boolean().default(true),
});

export const updateCountrySchema = createCountrySchema
  .omit({ code: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const regionListSchema = paginationSchema.extend({
  countryId: id.optional(),
  status: z.enum(RegionStatus).optional(),
  includeArchived: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .default(false),
  sortBy: z.enum(["code", "name", "status", "createdAt"]).default("name"),
});

export const createRegionSchema = z.object({
  countryId: id,
  code: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(160),
  timezone: z.string().trim().min(2).max(100),
  locale: z.string().trim().min(2).max(35),
  currency,
  status: z.enum(RegionStatus).default(RegionStatus.ACTIVE),
  culturalProfile: z.record(z.string().max(80), z.unknown()).default({}),
});

export const updateRegionSchema = createRegionSchema
  .omit({ code: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const regionStatusSchema = z.object({
  status: z.enum([RegionStatus.ACTIVE, RegionStatus.INACTIVE]),
});

export const assignRegionAdminSchema = z.object({ userId: id });

export type CountryList = z.output<typeof countryListSchema>;
export type CreateCountry = z.output<typeof createCountrySchema>;
export type UpdateCountry = z.output<typeof updateCountrySchema>;
export type RegionList = z.output<typeof regionListSchema>;
export type CreateRegion = z.output<typeof createRegionSchema>;
export type UpdateRegion = z.output<typeof updateRegionSchema>;
