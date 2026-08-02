import {
  GamificationStatus,
  LeaderboardMetric,
  LeaderboardPeriod,
  LeaderboardScope,
} from "@rabbehni/database";
import { z } from "zod";

import { paginationSchema } from "../common/pagination.js";

const leaderboardConfigBaseSchema = z.object({
  code: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(160),
  scope: z.enum(LeaderboardScope),
  scopeId: z.uuid().optional(),
  period: z.enum(LeaderboardPeriod),
  metric: z.enum(LeaderboardMetric),
  status: z.enum(GamificationStatus).default(GamificationStatus.DRAFT),
  maxEntries: z.coerce.number().int().min(1).max(10_000).default(100),
  anonymizeOptedOut: z.boolean().default(true),
  schedule: z.string().trim().min(5).max(120).default("0 * * * *"),
});

export const leaderboardConfigSchema = leaderboardConfigBaseSchema.superRefine((value, context) => {
  if (value.scope === LeaderboardScope.TENANT && value.scopeId) {
    context.addIssue({ code: "custom", message: "Tenant scope does not accept scopeId" });
  }
  if (value.scope !== LeaderboardScope.TENANT && !value.scopeId) {
    context.addIssue({ code: "custom", message: `${value.scope} scope requires scopeId` });
  }
});

export const updateLeaderboardConfigSchema = leaderboardConfigBaseSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const leaderboardListSchema = paginationSchema.extend({
  scope: z.enum(LeaderboardScope).optional(),
  period: z.enum(LeaderboardPeriod).optional(),
  metric: z.enum(LeaderboardMetric).optional(),
  status: z.enum(GamificationStatus).optional(),
  sortBy: z.enum(["createdAt", "name", "period"]).default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export const leaderboardResultsSchema = paginationSchema.extend({
  customerId: z.uuid().optional(),
  snapshotId: z.uuid().optional(),
  sortDirection: z.enum(["asc", "desc"]).default("asc"),
});

export const generateLeaderboardSchema = z.object({
  at: z.coerce.date().default(() => new Date()),
});

export const leaderboardIdSchema = z.uuid();

export type LeaderboardConfigInput = z.output<typeof leaderboardConfigSchema>;
export type LeaderboardList = z.output<typeof leaderboardListSchema>;
export type LeaderboardResults = z.output<typeof leaderboardResultsSchema>;
