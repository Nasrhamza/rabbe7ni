import { BranchStatus } from "@rabbehni/database";
import { z } from "zod";

import { paginationSchema } from "../common/pagination.js";

const settingsSchema = z.record(z.string(), z.unknown());
const countryCodeSchema = z
  .string()
  .trim()
  .length(2)
  .transform((value) => value.toUpperCase());
const currencySchema = z
  .string()
  .trim()
  .length(3)
  .transform((value) => value.toUpperCase());

export const branchIdSchema = z.uuid();
export const createBranchSchema = z.object({
  merchantId: z.uuid(),
  franchiseId: z.uuid().optional(),
  code: z.string().trim().min(2).max(64),
  name: z.string().trim().min(1).max(200),
  addressLine: z.string().trim().max(500).optional(),
  addressLine2: z.string().trim().max(500).optional(),
  city: z.string().trim().max(120).optional(),
  region: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().max(30).optional(),
  countryCode: countryCodeSchema,
  timezone: z.string().trim().min(1).max(64),
  locale: z.string().trim().min(2).max(20).default("en"),
  currency: currencySchema,
  phone: z.string().trim().max(40).optional(),
  email: z.email().optional(),
  status: z.enum(BranchStatus).default(BranchStatus.ACTIVE),
  settings: settingsSchema.default({}),
  openingHours: settingsSchema.default({}),
});

export const updateBranchSchema = createBranchSchema
  .omit({ code: true, status: true })
  .partial()
  .extend({ franchiseId: z.uuid().nullable().optional() })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");
export const branchStatusSchema = z.object({
  status: z.enum([BranchStatus.ACTIVE, BranchStatus.SUSPENDED]),
});
export const branchListSchema = paginationSchema.extend({
  organizationId: z.uuid().optional(),
  franchiseId: z.uuid().optional(),
  merchantId: z.uuid().optional(),
  status: z.enum(BranchStatus).optional(),
  includeArchived: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .default(false),
  sortBy: z.enum(["code", "name", "city", "status", "createdAt"]).default("name"),
});

export type CreateBranchDto = z.input<typeof createBranchSchema>;
export type UpdateBranchDto = z.input<typeof updateBranchSchema>;
export type BranchStatusDto = z.input<typeof branchStatusSchema>;
export type BranchListDto = z.input<typeof branchListSchema>;
export type BranchList = z.output<typeof branchListSchema>;
