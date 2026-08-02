import { RewardStatus } from "@rabbehni/database";
import { z } from "zod";

import { paginationSchema } from "../common/pagination.js";

const jsonObject = z.record(z.string(), z.unknown());
const positiveInt = z.coerce.number().int().positive();

export const rewardIdSchema = z.uuid();
export const rewardRedemptionIdSchema = z.uuid();
export const createRewardCategorySchema = z.object({
  organizationId: z.uuid(),
  code: z.string().trim().min(2).max(64),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1_000).optional(),
});
export const createRewardSchema = z.object({
  organizationId: z.uuid(),
  programId: z.uuid(),
  categoryId: z.uuid().optional(),
  code: z.string().trim().min(2).max(64),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2_000).optional(),
  status: z.enum(RewardStatus).default(RewardStatus.DRAFT),
  pointsCost: positiveInt,
  stockQuantity: z.coerce.number().int().nonnegative().optional(),
  unlimitedStock: z.boolean().default(false),
  eligibilityRules: jsonObject.default({}),
  appliesToAllMerchants: z.boolean().default(true),
  appliesToAllBranches: z.boolean().default(true),
  merchantIds: z.array(z.uuid()).default([]),
  branchIds: z.array(z.uuid()).default([]),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
});
export const updateRewardSchema = createRewardSchema
  .omit({ organizationId: true, programId: true, code: true, status: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");
export const rewardStatusSchema = z.object({
  status: z.enum([RewardStatus.DRAFT, RewardStatus.ACTIVE, RewardStatus.SUSPENDED]),
});
export const rewardStockSchema = z.object({
  stockQuantity: z.coerce.number().int().nonnegative(),
  unlimitedStock: z.boolean().optional(),
});
export const rewardListSchema = paginationSchema.extend({
  organizationId: z.uuid().optional(),
  programId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
  merchantId: z.uuid().optional(),
  branchId: z.uuid().optional(),
  status: z.enum(RewardStatus).optional(),
  includeArchived: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .default(false),
  sortBy: z.enum(["name", "pointsCost", "stockQuantity", "status", "createdAt"]).default("name"),
});
export const redeemRewardSchema = z.object({
  customerId: z.uuid(),
  rewardId: z.uuid(),
  merchantId: z.uuid().optional(),
  branchId: z.uuid().optional(),
  quantity: positiveInt.default(1),
  idempotencyKey: z.string().trim().min(8).max(200),
  metadata: jsonObject.default({}),
});
export const reverseRedemptionSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(200),
  reason: z.string().trim().min(3).max(500),
});
export const redemptionListSchema = paginationSchema.extend({
  customerId: z.uuid().optional(),
  rewardId: z.uuid().optional(),
  status: z.enum(["PENDING", "COMPLETED", "CANCELED", "REVERSED"]).optional(),
  sortBy: z.enum(["createdAt", "pointsSpent", "status"]).default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateRewardCategoryDto = z.output<typeof createRewardCategorySchema>;
export type CreateRewardDto = z.output<typeof createRewardSchema>;
export type UpdateRewardDto = z.output<typeof updateRewardSchema>;
export type RewardList = z.output<typeof rewardListSchema>;
export type RedeemRewardDto = z.output<typeof redeemRewardSchema>;
export type ReverseRedemptionDto = z.output<typeof reverseRedemptionSchema>;
export type RedemptionList = z.output<typeof redemptionListSchema>;
