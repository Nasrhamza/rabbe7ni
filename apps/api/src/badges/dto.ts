import { BadgeRarity, BadgeVisibility, GamificationStatus } from "@rabbehni/database";
import { z } from "zod";

import { paginationSchema } from "../common/pagination.js";

const jsonObject = z.record(z.string(), z.unknown());

export const badgeCategorySchema = z.object({
  organizationId: z.uuid(),
  code: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional(),
});

export const badgeSchema = z.object({
  organizationId: z.uuid(),
  categoryId: z.uuid().optional(),
  code: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional(),
  rarity: z.enum(BadgeRarity).default(BadgeRarity.COMMON),
  visibility: z.enum(BadgeVisibility).default(BadgeVisibility.VISIBLE),
  status: z.enum(GamificationStatus).default(GamificationStatus.DRAFT),
  iconUrl: z.url().optional(),
  metadata: jsonObject.default({}),
});

export const updateBadgeSchema = badgeSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const achievementRuleSchema = z.object({
  badgeId: z.uuid(),
  code: z.string().trim().min(2).max(80),
  eventType: z.string().trim().min(2).max(120),
  target: z.coerce.number().int().positive(),
  status: z.enum(GamificationStatus).default(GamificationStatus.DRAFT),
  conditions: jsonObject.default({}),
});

export const awardBadgeSchema = z.object({
  customerId: z.uuid(),
  badgeId: z.uuid(),
  idempotencyKey: z.string().trim().min(8).max(200),
  metadata: jsonObject.default({}),
});

export const revokeBadgeSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const badgeListSchema = paginationSchema.extend({
  organizationId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
  status: z.enum(GamificationStatus).optional(),
  rarity: z.enum(BadgeRarity).optional(),
  sortBy: z.enum(["createdAt", "name", "rarity"]).default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export const badgeCollectionSchema = paginationSchema.extend({
  customerId: z.uuid(),
  includeLocked: z.coerce.boolean().default(true),
  sortBy: z.enum(["earnedAt", "progress"]).default("earnedAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export const badgeIdSchema = z.uuid();

export type BadgeList = z.output<typeof badgeListSchema>;
export type BadgeCollection = z.output<typeof badgeCollectionSchema>;
export type AwardBadge = z.output<typeof awardBadgeSchema>;
