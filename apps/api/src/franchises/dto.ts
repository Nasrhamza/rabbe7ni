import { FranchiseStatus } from "@rabbehni/database";
import { z } from "zod";

import { paginationSchema } from "../common/pagination.js";

const settingsSchema = z.record(z.string(), z.unknown());

export const franchiseIdSchema = z.uuid();

export const createFranchiseSchema = z.object({
  organizationId: z.uuid(),
  code: z.string().trim().min(2).max(64),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
  status: z.enum(FranchiseStatus).default(FranchiseStatus.ACTIVE),
  settings: settingsSchema.default({}),
});

export const updateFranchiseSchema = createFranchiseSchema
  .omit({ organizationId: true, code: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const updateFranchiseSettingsSchema = z.object({ settings: settingsSchema });
export const franchiseStatusSchema = z.object({
  status: z.enum([FranchiseStatus.ACTIVE, FranchiseStatus.SUSPENDED]),
});
export const franchiseListSchema = paginationSchema.extend({
  organizationId: z.uuid().optional(),
  status: z.enum(FranchiseStatus).optional(),
  includeArchived: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .default(false),
  sortBy: z.enum(["code", "name", "status", "createdAt"]).default("name"),
});

export type CreateFranchiseDto = z.input<typeof createFranchiseSchema>;
export type UpdateFranchiseDto = z.input<typeof updateFranchiseSchema>;
export type UpdateFranchiseSettingsDto = z.input<typeof updateFranchiseSettingsSchema>;
export type FranchiseStatusDto = z.input<typeof franchiseStatusSchema>;
export type FranchiseListDto = z.input<typeof franchiseListSchema>;
export type FranchiseList = z.output<typeof franchiseListSchema>;
