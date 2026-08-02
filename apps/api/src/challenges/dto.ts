import {
  ChallengeCadence,
  ChallengeRewardType,
  ChallengeStatus,
  ChallengeType,
  ChallengeValidation,
  GamificationProgressSource,
  LeaderboardScope,
} from "@rabbehni/database";
import { z } from "zod";

import { paginationSchema } from "../common/pagination.js";

const jsonObject = z.record(z.string(), z.unknown());
const applicabilitySchema = z.object({
  scope: z.enum(LeaderboardScope),
  targetId: z.uuid(),
});
const rewardSchema = z
  .object({
    type: z.enum(ChallengeRewardType),
    amount: z.coerce.number().int().positive().optional(),
    badgeId: z.uuid().optional(),
    loyaltyProgramId: z.uuid().optional(),
    metadata: jsonObject.default({}),
  })
  .superRefine((value, context) => {
    if (value.type === ChallengeRewardType.BADGE && !value.badgeId) {
      context.addIssue({ code: "custom", message: "Badge rewards require badgeId" });
    }
    if (value.type === ChallengeRewardType.POINTS && (!value.amount || !value.loyaltyProgramId)) {
      context.addIssue({
        code: "custom",
        message: "Points rewards require amount and loyaltyProgramId",
      });
    }
    if (value.type === ChallengeRewardType.XP && !value.amount) {
      context.addIssue({ code: "custom", message: "XP rewards require amount" });
    }
  });

const challengeBaseSchema = z.object({
  organizationId: z.uuid(),
  code: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional(),
  type: z.enum(ChallengeType).default(ChallengeType.INDIVIDUAL),
  cadence: z.enum(ChallengeCadence).default(ChallengeCadence.ONE_TIME),
  status: z.enum(ChallengeStatus).default(ChallengeStatus.DRAFT),
  validationMode: z.enum(ChallengeValidation).default(ChallengeValidation.AUTOMATIC),
  objectiveType: z.string().trim().min(2).max(120),
  target: z.coerce.number().int().positive(),
  eligibility: jsonObject.default({}),
  recurrence: jsonObject.default({}),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  autoEnroll: z.boolean().default(false),
});

export const createChallengeSchema = challengeBaseSchema
  .extend({
    applicability: z.array(applicabilitySchema).max(200).default([]),
    rewards: z.array(rewardSchema).max(10).default([]),
  })
  .refine((value) => value.endAt > value.startAt, {
    message: "Challenge end date must be after its start date",
    path: ["endAt"],
  });

export const updateChallengeSchema = challengeBaseSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const challengeListSchema = paginationSchema.extend({
  organizationId: z.uuid().optional(),
  status: z.enum(ChallengeStatus).optional(),
  type: z.enum(ChallengeType).optional(),
  cadence: z.enum(ChallengeCadence).optional(),
  objectiveType: z.string().trim().max(120).optional(),
  customerId: z.uuid().optional(),
  sortBy: z.enum(["createdAt", "startAt", "endAt", "name"]).default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export const enrollChallengeSchema = z.object({
  customerId: z.uuid(),
});

export const progressChallengeSchema = z.object({
  customerId: z.uuid(),
  delta: z.coerce.number().int().positive(),
  idempotencyKey: z.string().trim().min(8).max(200),
  source: z.enum(GamificationProgressSource).default(GamificationProgressSource.EVENT),
  referenceType: z.string().trim().max(80).optional(),
  referenceId: z.string().trim().max(200).optional(),
  metadata: jsonObject.default({}),
});

export const validateChallengeSchema = z.object({
  approved: z.boolean(),
  reason: z.string().trim().min(3).max(500),
});

export const addChallengeRewardSchema = rewardSchema;
export const addChallengeScopeSchema = applicabilitySchema;
export const challengeIdSchema = z.uuid();

export type ChallengeList = z.output<typeof challengeListSchema>;
export type CreateChallenge = z.output<typeof createChallengeSchema>;
export type ChallengeProgress = z.output<typeof progressChallengeSchema>;
export type ChallengeRewardInput = z.output<typeof rewardSchema>;
