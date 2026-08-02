import { GamificationStatus, XpEntryType } from "@rabbehni/database";
import { z } from "zod";

import { paginationSchema } from "../common/pagination.js";

const jsonObject = z.record(z.string(), z.unknown());

export const gamificationConfigSchema = z.object({
  active: z.boolean().default(true),
  defaultTimezone: z.string().trim().min(1).max(100).default("UTC"),
  allowManualCorrection: z.boolean().default(false),
  settings: jsonObject.default({}),
});

export const createXpRuleSchema = z.object({
  organizationId: z.uuid(),
  code: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional(),
  eventType: z.string().trim().min(2).max(120),
  xp: z.coerce.number().int().positive().max(1_000_000),
  priority: z.coerce.number().int().min(0).max(10_000).default(100),
  status: z.enum(GamificationStatus).default(GamificationStatus.DRAFT),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  conditions: jsonObject.default({}),
});

export const updateXpRuleSchema = createXpRuleSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const createLevelSchema = z.object({
  code: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(160),
  level: z.coerce.number().int().positive(),
  xpThreshold: z.coerce.number().int().min(0),
  status: z.enum(GamificationStatus).default(GamificationStatus.ACTIVE),
  benefits: jsonObject.default({}),
  metadata: jsonObject.default({}),
});

export const updateLevelSchema = createLevelSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

const xpOperationSchema = z.object({
  customerId: z.uuid(),
  xp: z.coerce.number().int().positive().max(1_000_000),
  idempotencyKey: z.string().trim().min(8).max(200),
  referenceType: z.string().trim().max(80).optional(),
  referenceId: z.string().trim().max(200).optional(),
  ruleId: z.uuid().optional(),
  metadata: jsonObject.default({}),
});

export const awardXpSchema = xpOperationSchema;
export const adjustXpSchema = xpOperationSchema.omit({ xp: true, ruleId: true }).extend({
  xp: z.coerce
    .number()
    .int()
    .refine((value) => value !== 0, "XP cannot be zero"),
  reason: z.string().trim().min(3).max(500),
  authorizedCorrection: z.boolean().default(true),
});

export const reverseXpSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(200),
  reason: z.string().trim().min(3).max(500),
});

export const profileQuerySchema = z.object({ customerId: z.uuid() });
export const privacySchema = z.object({
  customerId: z.uuid(),
  leaderboardOptOut: z.boolean(),
  anonymizeOnLeaderboard: z.boolean().default(false),
  leaderboardAlias: z.string().trim().min(2).max(80).optional(),
});

export const xpListSchema = paginationSchema.extend({
  customerId: z.uuid().optional(),
  ruleId: z.uuid().optional(),
  type: z.enum(XpEntryType).optional(),
  sortBy: z.enum(["createdAt", "xp", "type"]).default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export const gamificationIdSchema = z.uuid();

export type XpList = z.output<typeof xpListSchema>;
export type AwardXp = z.output<typeof awardXpSchema>;
export type AdjustXp = z.output<typeof adjustXpSchema>;
export type PrivacyUpdate = z.output<typeof privacySchema>;
