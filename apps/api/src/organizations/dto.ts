import { OrganizationStatus } from "@rabbehni/database";
import { z } from "zod";

import { paginationSchema } from "../common/pagination.js";

const settingsSchema = z.record(z.string(), z.unknown());

export const organizationIdSchema = z.uuid();

export const createOrganizationSchema = z.object({
  code: z.string().trim().min(2).max(64),
  legalName: z.string().trim().min(1).max(255),
  displayName: z.string().trim().min(1).max(200),
  registrationNumber: z.string().trim().max(100).optional(),
  taxIdentifier: z.string().trim().max(100).optional(),
  countryCode: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase()),
  timezone: z.string().trim().min(1).max(64),
  status: z.enum(OrganizationStatus).default(OrganizationStatus.DRAFT),
  settings: settingsSchema.default({}),
});

export const updateOrganizationSchema = createOrganizationSchema
  .omit({ code: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const updateOrganizationSettingsSchema = z.object({
  settings: settingsSchema,
});

export const organizationStatusSchema = z.object({
  status: z.enum([
    OrganizationStatus.DRAFT,
    OrganizationStatus.ACTIVE,
    OrganizationStatus.SUSPENDED,
  ]),
});

export const organizationListSchema = paginationSchema.extend({
  status: z.enum(OrganizationStatus).optional(),
  includeArchived: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .default(false),
  sortBy: z.enum(["code", "displayName", "status", "createdAt"]).default("displayName"),
});

export type CreateOrganizationDto = z.input<typeof createOrganizationSchema>;
export type UpdateOrganizationDto = z.input<typeof updateOrganizationSchema>;
export type UpdateOrganizationSettingsDto = z.input<typeof updateOrganizationSettingsSchema>;
export type OrganizationStatusDto = z.input<typeof organizationStatusSchema>;
export type OrganizationListDto = z.input<typeof organizationListSchema>;
export type OrganizationList = z.output<typeof organizationListSchema>;
