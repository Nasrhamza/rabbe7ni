import { RoleScope } from "@rabbehni/database";
import { z } from "zod";

const codeSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9_-]*$/u);

export const createTenantSchema = z.object({
  slug: codeSchema,
  region: z.string().trim().min(2).max(32),
  defaultLocale: z.string().trim().min(2).max(35).default("en"),
  defaultCurrency: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase()),
});

export const createMembershipSchema = z.object({
  organizationId: z.uuid(),
  userId: z.uuid(),
});

export const createRoleSchema = z.object({
  code: codeSchema,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  scope: z.enum(RoleScope).default(RoleScope.ORGANIZATION),
  permissionIds: z.array(z.uuid()).default([]),
});

export const setTenantSettingSchema = z.object({
  namespace: codeSchema,
  key: codeSchema,
  value: z.json(),
  updatedById: z.uuid().optional(),
});

export type CreateTenantDto = z.input<typeof createTenantSchema>;
export type CreateMembershipDto = z.input<typeof createMembershipSchema>;
export type CreateRoleDto = z.input<typeof createRoleSchema>;
export type SetTenantSettingDto = z.input<typeof setTenantSettingSchema>;
