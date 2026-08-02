import { MarketingStatus, SegmentType } from "@rabbehni/database";
import { z } from "zod";

import { paginationSchema } from "../common/pagination.js";

const operatorSchema = z.enum([
  "EQ",
  "NEQ",
  "IN",
  "NOT_IN",
  "GT",
  "GTE",
  "LT",
  "LTE",
  "CONTAINS",
  "EXISTS",
]);

const allowedFields = z.enum([
  "profile.locale",
  "profile.status",
  "profile.country",
  "profile.age",
  "scope.branchId",
  "scope.merchantId",
  "loyalty.balance",
  "reward.redemptions",
  "qr.transactions",
  "behavior.purchases",
  "behavior.visits",
  "gamification.challenges",
  "gamification.badges",
  "gamification.xp",
  "gamification.level",
  "gamification.streak",
  "activity.daysSinceLast",
  "activity.inactiveDays",
]);

type RuleNode = {
  combinator: "AND" | "OR";
  conditions: Array<
    | {
        field: z.infer<typeof allowedFields>;
        operator: z.infer<typeof operatorSchema>;
        value?: unknown;
      }
    | RuleNode
  >;
};

const conditionSchema = z.object({
  field: allowedFields,
  operator: operatorSchema,
  value: z.unknown().optional(),
});

export const segmentRuleSchema: z.ZodType<RuleNode> = z.lazy(() =>
  z.object({
    combinator: z.enum(["AND", "OR"]),
    conditions: z.array(z.union([conditionSchema, segmentRuleSchema])).max(50),
  }),
);

export const createSegmentSchema = z.object({
  organizationId: z.uuid(),
  code: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional(),
  type: z.enum(SegmentType),
  status: z.enum(MarketingStatus).default(MarketingStatus.DRAFT),
  rules: segmentRuleSchema.default({ combinator: "AND", conditions: [] } as never),
  schedule: z.string().trim().min(5).max(100).optional(),
  timezone: z.string().trim().min(1).max(100).default("UTC"),
});

export const updateSegmentSchema = createSegmentSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const segmentListSchema = paginationSchema.extend({
  status: z.enum(MarketingStatus).optional(),
  type: z.enum(SegmentType).optional(),
  search: z.string().trim().max(120).optional(),
  sortBy: z.enum(["createdAt", "name", "estimatedSize", "lastRefreshedAt"]).default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export const segmentPreviewSchema = z.object({
  organizationId: z.uuid(),
  rules: segmentRuleSchema,
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const staticMembershipSchema = z.object({
  customerIds: z.array(z.uuid()).min(1).max(5_000),
});

export const idSchema = z.uuid();

export type SegmentList = z.output<typeof segmentListSchema>;
export type SegmentRule = z.output<typeof segmentRuleSchema>;
