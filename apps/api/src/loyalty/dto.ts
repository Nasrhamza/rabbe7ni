import { LoyaltyProgramStatus } from "@rabbehni/database";
import { z } from "zod";

import { paginationSchema } from "../common/pagination.js";

const jsonObject = z.record(z.string(), z.unknown());
const positiveInt = z.coerce.number().int().positive();

export const loyaltyProgramIdSchema = z.uuid();
export const loyaltyRuleIdSchema = z.uuid();
const loyaltyProgramFieldsSchema = z.object({
  organizationId: z.uuid(),
  code: z.string().trim().min(2).max(64),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1_000).optional(),
  pointsLabel: z.string().trim().min(1).max(40).default("points"),
  status: z.enum(LoyaltyProgramStatus).default(LoyaltyProgramStatus.DRAFT),
  expirationDays: positiveInt.optional(),
  minimumEarnPoints: positiveInt.default(1),
  maximumEarnPoints: positiveInt.optional(),
  minimumRedeemPoints: positiveInt.default(1),
  maximumRedeemPoints: positiveInt.optional(),
  appliesToAllMerchants: z.boolean().default(true),
  appliesToAllBranches: z.boolean().default(true),
  merchantIds: z.array(z.uuid()).default([]),
  branchIds: z.array(z.uuid()).default([]),
  settings: jsonObject.default({}),
});
export const createLoyaltyProgramSchema = loyaltyProgramFieldsSchema.superRefine(
  (value, context) => {
    if (value.maximumEarnPoints && value.maximumEarnPoints < value.minimumEarnPoints) {
      context.addIssue({ code: "custom", path: ["maximumEarnPoints"], message: "Invalid range" });
    }
    if (value.maximumRedeemPoints && value.maximumRedeemPoints < value.minimumRedeemPoints) {
      context.addIssue({ code: "custom", path: ["maximumRedeemPoints"], message: "Invalid range" });
    }
  },
);
export const updateLoyaltyProgramSchema = loyaltyProgramFieldsSchema
  .omit({ organizationId: true, code: true, status: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");
export const loyaltyProgramStatusSchema = z.object({
  status: z.enum([
    LoyaltyProgramStatus.DRAFT,
    LoyaltyProgramStatus.ACTIVE,
    LoyaltyProgramStatus.SUSPENDED,
  ]),
});
export const loyaltyProgramListSchema = paginationSchema.extend({
  organizationId: z.uuid().optional(),
  merchantId: z.uuid().optional(),
  branchId: z.uuid().optional(),
  status: z.enum(LoyaltyProgramStatus).optional(),
  includeArchived: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .default(false),
  sortBy: z.enum(["code", "name", "status", "createdAt"]).default("name"),
});
export const createEarningRuleSchema = z.object({
  code: z.string().trim().min(2).max(64),
  name: z.string().trim().min(1).max(200),
  eventType: z.string().trim().min(1).max(80),
  points: positiveInt,
  multiplier: z.coerce.number().positive().default(1),
  minimumAmount: z.coerce.number().nonnegative().optional(),
  maximumPoints: positiveInt.optional(),
  priority: z.coerce.number().int().default(100),
  active: z.boolean().default(true),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  conditions: jsonObject.default({}),
});
export const updateEarningRuleSchema = createEarningRuleSchema
  .omit({ code: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");
export const createRedemptionRuleSchema = z.object({
  code: z.string().trim().min(2).max(64),
  name: z.string().trim().min(1).max(200),
  minimumPoints: positiveInt.default(1),
  maximumPoints: positiveInt.optional(),
  incrementPoints: positiveInt.default(1),
  active: z.boolean().default(true),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  conditions: jsonObject.default({}),
});
export const updateRedemptionRuleSchema = createRedemptionRuleSchema
  .omit({ code: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export type CreateLoyaltyProgramDto = z.output<typeof createLoyaltyProgramSchema>;
export type UpdateLoyaltyProgramDto = z.output<typeof updateLoyaltyProgramSchema>;
export type LoyaltyProgramStatusDto = z.output<typeof loyaltyProgramStatusSchema>;
export type LoyaltyProgramListDto = z.input<typeof loyaltyProgramListSchema>;
export type LoyaltyProgramList = z.output<typeof loyaltyProgramListSchema>;
export type CreateEarningRuleDto = z.output<typeof createEarningRuleSchema>;
export type UpdateEarningRuleDto = z.output<typeof updateEarningRuleSchema>;
export type CreateRedemptionRuleDto = z.output<typeof createRedemptionRuleSchema>;
export type UpdateRedemptionRuleDto = z.output<typeof updateRedemptionRuleSchema>;
