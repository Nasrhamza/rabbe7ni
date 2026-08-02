import { describe, expect, it } from "vitest";

import { badgeSchema } from "../src/badges/dto.js";
import { createChallengeSchema } from "../src/challenges/dto.js";
import { adjustXpSchema, createLevelSchema } from "../src/gamification/dto.js";
import { createHabitSchema } from "../src/habits/dto.js";
import { leaderboardConfigSchema } from "../src/leaderboards/dto.js";

const organizationId = "10000000-0000-4000-8000-000000000002";

describe("Phase 6 DTO invariants", () => {
  it("rejects invalid challenge dates and incomplete rewards", () => {
    const result = createChallengeSchema.safeParse({
      organizationId,
      code: "BAD",
      name: "Bad dates",
      objectiveType: "event",
      target: 1,
      startAt: "2026-07-30T00:00:00Z",
      endAt: "2026-07-29T00:00:00Z",
      rewards: [{ type: "POINTS", amount: 10 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero XP corrections and accepts monotonic level data", () => {
    expect(
      adjustXpSchema.safeParse({
        customerId: organizationId,
        xp: 0,
        reason: "Invalid",
        idempotencyKey: "validation-key",
      }).success,
    ).toBe(false);
    expect(
      createLevelSchema.safeParse({
        code: "GOLD",
        name: "Gold",
        level: 3,
        xpThreshold: 3000,
      }).success,
    ).toBe(true);
  });

  it("validates habit milestone reward requirements", () => {
    expect(
      createHabitSchema.safeParse({
        organizationId,
        code: "DAILY",
        name: "Daily",
        objectiveType: "event",
        milestones: [{ streakThreshold: 7, rewardType: "BADGE" }],
      }).success,
    ).toBe(false);
  });

  it("requires scoped leaderboard identifiers and valid badge metadata", () => {
    expect(
      leaderboardConfigSchema.safeParse({
        code: "ORG",
        name: "Organization",
        scope: "ORGANIZATION",
        period: "WEEKLY",
        metric: "XP",
      }).success,
    ).toBe(false);
    expect(
      badgeSchema.safeParse({
        organizationId,
        code: "FIRST",
        name: "First",
        rarity: "RARE",
        visibility: "HIDDEN",
      }).success,
    ).toBe(true);
  });
});
