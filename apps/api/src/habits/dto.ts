import {
  ChallengeRewardType,
  GamificationProgressSource,
  GamificationStatus,
  HabitCadence,
} from "@rabbehni/database";
import { z } from "zod";

import { paginationSchema } from "../common/pagination.js";

const jsonObject = z.record(z.string(), z.unknown());
const milestoneSchema = z
  .object({
    streakThreshold: z.coerce.number().int().positive(),
    rewardType: z.enum(ChallengeRewardType),
    rewardAmount: z.coerce.number().int().positive().optional(),
    badgeId: z.uuid().optional(),
    loyaltyProgramId: z.uuid().optional(),
  })
  .superRefine((value, context) => {
    if (value.rewardType === ChallengeRewardType.BADGE && !value.badgeId) {
      context.addIssue({ code: "custom", message: "Badge milestone requires badgeId" });
    }
    if (
      value.rewardType === ChallengeRewardType.POINTS &&
      (!value.rewardAmount || !value.loyaltyProgramId)
    ) {
      context.addIssue({
        code: "custom",
        message: "Points milestone requires rewardAmount and loyaltyProgramId",
      });
    }
    if (value.rewardType === ChallengeRewardType.XP && !value.rewardAmount) {
      context.addIssue({ code: "custom", message: "XP milestone requires rewardAmount" });
    }
  });

export const createHabitSchema = z.object({
  organizationId: z.uuid(),
  code: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional(),
  cadence: z.enum(HabitCadence).default(HabitCadence.DAILY),
  status: z.enum(GamificationStatus).default(GamificationStatus.DRAFT),
  objectiveType: z.string().trim().min(2).max(120),
  target: z.coerce.number().int().positive().default(1),
  timezone: z.string().trim().min(1).max(100).optional(),
  graceDays: z.coerce.number().int().min(0).max(31).default(0),
  freezeAllowance: z.coerce.number().int().min(0).max(365).default(0),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  conditions: jsonObject.default({}),
  milestones: z.array(milestoneSchema).max(100).default([]),
});

export const updateHabitSchema = createHabitSchema
  .omit({ milestones: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const habitListSchema = paginationSchema.extend({
  organizationId: z.uuid().optional(),
  customerId: z.uuid().optional(),
  status: z.enum(GamificationStatus).optional(),
  cadence: z.enum(HabitCadence).optional(),
  sortBy: z.enum(["createdAt", "name", "cadence"]).default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export const enrollHabitSchema = z.object({ customerId: z.uuid() });
export const habitProgressSchema = z.object({
  customerId: z.uuid(),
  progress: z.coerce.number().int().positive().default(1),
  idempotencyKey: z.string().trim().min(8).max(200),
  source: z.enum(GamificationProgressSource).default(GamificationProgressSource.CHECK_IN),
  occurredAt: z.coerce.date().default(() => new Date()),
  referenceType: z.string().trim().max(80).optional(),
  referenceId: z.string().trim().max(200).optional(),
});

export const streakRuleSchema = z.object({
  organizationId: z.uuid(),
  code: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(160),
  qualifyingEvent: z.string().trim().min(2).max(120),
  status: z.enum(GamificationStatus).default(GamificationStatus.DRAFT),
  timezone: z.string().trim().min(1).max(100).optional(),
  graceDays: z.coerce.number().int().min(0).max(31).default(0),
  freezeAllowance: z.coerce.number().int().min(0).max(365).default(0),
  conditions: jsonObject.default({}),
});

export const qualifyStreakSchema = z.object({
  customerId: z.uuid(),
  idempotencyKey: z.string().trim().min(8).max(200),
  occurredAt: z.coerce.date().default(() => new Date()),
});

export const habitCalendarSchema = paginationSchema.extend({
  customerId: z.uuid(),
  habitId: z.uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sortBy: z.enum(["occurredAt", "localDate"]).default("occurredAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export const habitIdSchema = z.uuid();

export type CreateHabit = z.output<typeof createHabitSchema>;
export type HabitList = z.output<typeof habitListSchema>;
export type HabitProgress = z.output<typeof habitProgressSchema>;
export type HabitCalendar = z.output<typeof habitCalendarSchema>;
export type StreakRuleInput = z.output<typeof streakRuleSchema>;
export type QualifyStreak = z.output<typeof qualifyStreakSchema>;
