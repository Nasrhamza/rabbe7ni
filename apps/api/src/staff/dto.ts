import { StaffStatus } from "@rabbehni/database";
import { z } from "zod";

import { paginationSchema } from "../common/pagination.js";

export const staffIdSchema = z.uuid();
export const inviteStaffSchema = z
  .object({
    email: z.email().transform((value) => value.trim().toLowerCase()),
    displayName: z.string().trim().min(1).max(200),
    locale: z.string().trim().min(2).max(20).default("en"),
    organizationId: z.uuid(),
    franchiseId: z.uuid().optional(),
    merchantId: z.uuid().optional(),
    branchId: z.uuid().optional(),
    employeeCode: z.string().trim().max(64).optional(),
    jobTitle: z.string().trim().max(120).optional(),
    roleIds: z.array(z.uuid()).min(1).max(20),
  })
  .superRefine((value, context) => {
    if (value.branchId && !value.merchantId) {
      context.addIssue({
        code: "custom",
        path: ["merchantId"],
        message: "merchantId is required when branchId is provided",
      });
    }
    if (value.merchantId && !value.organizationId) {
      context.addIssue({
        code: "custom",
        path: ["organizationId"],
        message: "organizationId is required for merchant assignments",
      });
    }
  });

export const updateStaffAssignmentSchema = z
  .object({
    organizationId: z.uuid(),
    franchiseId: z.uuid().nullable().optional(),
    merchantId: z.uuid().nullable().optional(),
    branchId: z.uuid().nullable().optional(),
    employeeCode: z.string().trim().max(64).nullable().optional(),
    jobTitle: z.string().trim().max(120).nullable().optional(),
  })
  .refine((value) => !value.branchId || Boolean(value.merchantId), {
    path: ["merchantId"],
    message: "merchantId is required when branchId is provided",
  });
export const assignStaffRolesSchema = z.object({
  roleIds: z.array(z.uuid()).min(1).max(20),
});
export const staffStatusSchema = z.object({
  status: z.enum([StaffStatus.ACTIVE, StaffStatus.SUSPENDED, StaffStatus.REMOVED]),
});
export const staffListSchema = paginationSchema.extend({
  organizationId: z.uuid().optional(),
  franchiseId: z.uuid().optional(),
  merchantId: z.uuid().optional(),
  branchId: z.uuid().optional(),
  status: z.enum(StaffStatus).optional(),
  includeRemoved: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .default(false),
  sortBy: z.enum(["createdAt", "status", "jobTitle"]).default("createdAt"),
});

export type InviteStaffDto = z.input<typeof inviteStaffSchema>;
export type UpdateStaffAssignmentDto = z.input<typeof updateStaffAssignmentSchema>;
export type AssignStaffRolesDto = z.input<typeof assignStaffRolesSchema>;
export type StaffStatusDto = z.input<typeof staffStatusSchema>;
export type StaffListDto = z.input<typeof staffListSchema>;
export type StaffList = z.output<typeof staffListSchema>;
