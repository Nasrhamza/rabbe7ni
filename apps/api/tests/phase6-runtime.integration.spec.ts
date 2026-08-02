import { ConflictException } from "@nestjs/common";
import {
  ChallengeCadence,
  ChallengeRewardType,
  ChallengeStatus,
  ChallengeType,
  ChallengeValidation,
  createPrismaClient,
  GamificationProgressSource,
  GamificationStatus,
  HabitCadence,
  LeaderboardMetric,
  LeaderboardPeriod,
  LeaderboardScope,
  TenantTransactionManager,
  XpEntryType,
} from "@rabbehni/database";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { AuthenticatedPrincipal } from "../src/auth/auth.types.js";
import { BadgesRepository } from "../src/badges/badges.repository.js";
import { ChallengesRepository } from "../src/challenges/challenges.repository.js";
import { ChallengesService } from "../src/challenges/challenges.service.js";
import { GamificationRepository } from "../src/gamification/gamification.repository.js";
import { GamificationEventsRepository } from "../src/gamification-events/gamification-events.repository.js";
import { GamificationEventsService } from "../src/gamification-events/gamification-events.service.js";
import { HabitsRepository } from "../src/habits/habits.repository.js";
import { HabitsService } from "../src/habits/habits.service.js";
import { LeaderboardsRepository } from "../src/leaderboards/leaderboards.repository.js";
import { PointsRepository } from "../src/points/points.repository.js";
import { TenantContextStore } from "../src/tenancy/tenant-context.store.js";

const connectionString = process.env.TEST_DATABASE_URL;
const integrationSuite = connectionString ? describe : describe.skip;

integrationSuite("Phase 6 PostgreSQL gamification runtime", () => {
  const prisma = createPrismaClient(
    connectionString ?? "postgresql://unused:unused@127.0.0.1:1/unused",
  );
  const transactions = new TenantTransactionManager(prisma);
  const context = new TenantContextStore();
  const gamification = new GamificationRepository(context, transactions);
  const badges = new BadgesRepository(context, transactions);
  const points = new PointsRepository(context, transactions);
  const challenges = new ChallengesRepository(context, transactions);
  const challengeService = new ChallengesService(challenges, points, gamification, badges);
  const habits = new HabitsRepository(context, transactions);
  const habitService = new HabitsService(habits, points, gamification, badges);
  const leaderboards = new LeaderboardsRepository(context, transactions);
  const eventReceipts = new GamificationEventsRepository(context, transactions);
  const gamificationEvents = new GamificationEventsService(
    eventReceipts,
    gamification,
    challenges,
    challengeService,
    habits,
    habitService,
    badges,
  );

  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const organizationId = randomUUID();
  const customerId = randomUUID();
  const secondCustomerId = randomUUID();
  const thirdCustomerId = randomUUID();
  const programId = randomUUID();
  const badgeId = randomUUID();
  const challengeId = randomUUID();
  const challengeRewardId = randomUUID();
  const habitId = randomUUID();
  const streakRuleId = randomUUID();
  const leaderboardId = randomUUID();

  const principal = (tenantId: string): AuthenticatedPrincipal => ({
    subject: randomUUID(),
    userId: randomUUID(),
    tenantId,
    membershipId: randomUUID(),
    email: "phase6@example.com",
    displayName: "Phase 6",
    locale: "en",
    permissions: [
      "gamification.read",
      "gamification.manage",
      "gamification.process",
      "gamification.adjust",
      "challenge.read",
      "challenge.manage",
      "challenge.process",
      "challenge.validate",
      "habit.read",
      "habit.manage",
      "streak.read",
      "streak.manage",
      "streak.process",
      "badge.read",
      "badge.manage",
      "badge.award",
      "badge.revoke",
      "leaderboard.read",
      "leaderboard.manage",
      "leaderboard.process",
      "points.read",
      "points.adjust",
    ],
    roles: ["phase6-test"],
    access: {
      organizationIds: tenantId === tenantA ? [organizationId] : [],
      franchiseIds: [],
      merchantIds: [],
      branchIds: [],
      tenantWide: true,
    },
    authMethod: "session",
  });

  function runAs<T>(tenantId: string, operation: () => Promise<T>): Promise<T> {
    return context.run(
      {
        tenantId,
        principal: principal(tenantId),
        requestId: randomUUID(),
        correlationId: randomUUID(),
      },
      operation,
    );
  }

  beforeAll(async () => {
    await prisma.$connect();
    await transactions.run(tenantA, async (transaction) => {
      await transaction.tenant.create({
        data: { id: tenantA, slug: `phase6-a-${tenantA}`, region: "TEST", status: "ACTIVE" },
      });
      await transaction.organization.create({
        data: {
          id: organizationId,
          tenantId: tenantA,
          code: "PHASE6",
          legalName: "Phase 6",
          displayName: "Phase 6",
          countryCode: "FR",
          timezone: "Europe/Paris",
          status: "ACTIVE",
        },
      });
      for (const [id, name] of [
        [customerId, "Gamification Customer"],
        [secondCustomerId, "Alpha Equal"],
        [thirdCustomerId, "Zulu Equal"],
      ] as const) {
        await transaction.customer.create({
          data: {
            id,
            tenantId: tenantA,
            organizationId,
            displayName: name,
            status: "ACTIVE",
          },
        });
      }
      await transaction.loyaltyProgram.create({
        data: {
          id: programId,
          tenantId: tenantA,
          organizationId,
          code: "PHASE6-POINTS",
          name: "Phase 6 Points",
          status: "ACTIVE",
          minimumEarnPoints: 1,
          minimumRedeemPoints: 1,
        },
      });
      await transaction.gamificationConfig.create({
        data: {
          tenantId: tenantA,
          active: true,
          defaultTimezone: "Europe/Paris",
          allowManualCorrection: true,
        },
      });
      await transaction.levelDefinition.createMany({
        data: [
          {
            tenantId: tenantA,
            code: "L1",
            name: "Level 1",
            level: 1,
            xpThreshold: 0,
            status: GamificationStatus.ACTIVE,
          },
          {
            tenantId: tenantA,
            code: "L2",
            name: "Level 2",
            level: 2,
            xpThreshold: 150,
            status: GamificationStatus.ACTIVE,
          },
        ],
      });
      await transaction.badge.create({
        data: {
          id: badgeId,
          tenantId: tenantA,
          organizationId,
          code: "RUNTIME",
          name: "Runtime Badge",
          status: GamificationStatus.ACTIVE,
        },
      });
      await transaction.challenge.create({
        data: {
          id: challengeId,
          tenantId: tenantA,
          organizationId,
          code: "RUNTIME",
          name: "Runtime Challenge",
          type: ChallengeType.INDIVIDUAL,
          cadence: ChallengeCadence.ONE_TIME,
          status: ChallengeStatus.ACTIVE,
          validationMode: ChallengeValidation.AUTOMATIC,
          objectiveType: "runtime.event",
          target: 2,
          startAt: new Date(Date.now() - 60_000),
          endAt: new Date(Date.now() + 86_400_000),
        },
      });
      await transaction.challengeReward.create({
        data: {
          id: challengeRewardId,
          tenantId: tenantA,
          challengeId,
          type: ChallengeRewardType.XP,
          amount: 50,
        },
      });
      await transaction.challengeEnrollment.create({
        data: { tenantId: tenantA, challengeId, customerId },
      });
      await transaction.habit.create({
        data: {
          id: habitId,
          tenantId: tenantA,
          organizationId,
          code: "DAILY",
          name: "Daily Runtime",
          cadence: HabitCadence.DAILY,
          status: GamificationStatus.ACTIVE,
          objectiveType: "runtime.event",
          target: 1,
          timezone: "Europe/Paris",
          graceDays: 1,
          freezeAllowance: 1,
        },
      });
      await transaction.customerHabit.create({
        data: {
          tenantId: tenantA,
          habitId,
          customerId,
          freezesRemaining: 1,
        },
      });
      await transaction.streakRule.create({
        data: {
          id: streakRuleId,
          tenantId: tenantA,
          organizationId,
          code: "RUNTIME-STREAK",
          name: "Runtime Streak",
          qualifyingEvent: "runtime.event",
          status: GamificationStatus.ACTIVE,
          timezone: "Europe/Paris",
          graceDays: 1,
          freezeAllowance: 1,
        },
      });
      await transaction.leaderboardConfig.create({
        data: {
          id: leaderboardId,
          tenantId: tenantA,
          code: "XP-ALL",
          name: "All-time XP",
          scope: LeaderboardScope.ORGANIZATION,
          scopeId: organizationId,
          period: LeaderboardPeriod.ALL_TIME,
          metric: LeaderboardMetric.XP,
          status: GamificationStatus.ACTIVE,
          anonymizeOptedOut: true,
        },
      });
    });
    await transactions.run(tenantB, (transaction) =>
      transaction.tenant.create({
        data: { id: tenantB, slug: `phase6-b-${tenantB}`, region: "TEST", status: "ACTIVE" },
      }),
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("serializes XP awards and makes idempotency exact", async () => {
    const operation = {
      customerId,
      xp: 100,
      type: XpEntryType.AWARD,
      idempotencyKey: `xp:${randomUUID()}`,
    };
    const [first, replay] = await Promise.all([
      runAs(tenantA, () => gamification.postXp(operation)),
      runAs(tenantA, () => gamification.postXp(operation)),
    ]);
    expect(new Set([first.entry.id, replay.entry.id]).size).toBe(1);
    expect([first.idempotent, replay.idempotent].filter(Boolean)).toHaveLength(1);

    await Promise.all([
      runAs(tenantA, () =>
        gamification.postXp({
          customerId,
          xp: 50,
          type: XpEntryType.AWARD,
          idempotencyKey: `xp:${randomUUID()}`,
        }),
      ),
      runAs(tenantA, () =>
        gamification.postXp({
          customerId,
          xp: 50,
          type: XpEntryType.AWARD,
          idempotencyKey: `xp:${randomUUID()}`,
        }),
      ),
    ]);
    const profile = await transactions.run(tenantA, (transaction) =>
      transaction.customerGamificationProfile.findUniqueOrThrow({
        where: { tenantId_customerId: { tenantId: tenantA, customerId } },
        include: { currentLevel: true },
      }),
    );
    expect(profile.totalXp).toBe(200);
    expect(profile.currentLevel?.level).toBe(2);
  });

  it("tracks challenge progress once and prevents duplicate reward grants", async () => {
    const firstKey = `challenge:${randomUUID()}`;
    const first = await runAs(tenantA, () =>
      challengeService.progress(challengeId, {
        customerId,
        delta: 1,
        idempotencyKey: firstKey,
        source: GamificationProgressSource.EVENT,
        metadata: {},
      } as never),
    );
    const replay = await runAs(tenantA, () =>
      challengeService.progress(challengeId, {
        customerId,
        delta: 1,
        idempotencyKey: firstKey,
        source: GamificationProgressSource.EVENT,
        metadata: {},
      } as never),
    );
    expect(first.enrollment.progress).toBe(1);
    expect(replay.idempotent).toBe(true);

    const completed = await runAs(tenantA, () =>
      challengeService.progress(challengeId, {
        customerId,
        delta: 1,
        idempotencyKey: `challenge:${randomUUID()}`,
        source: GamificationProgressSource.EVENT,
        metadata: {},
      } as never),
    );
    expect(completed.enrollment.status).toBe("COMPLETED");
    const grants = await transactions.run(tenantA, (transaction) =>
      transaction.challengeRewardGrant.findMany({
        where: { challengeId, customerId },
      }),
    );
    expect(grants).toHaveLength(1);
  });

  it("calculates habit and standalone streaks by timezone-aware local dates", async () => {
    await runAs(tenantA, () =>
      habitService.progress(habitId, {
        customerId,
        progress: 1,
        idempotencyKey: `habit:${randomUUID()}`,
        source: GamificationProgressSource.CHECK_IN,
        occurredAt: new Date("2026-03-28T23:30:00Z"),
      } as never),
    );
    const second = await runAs(tenantA, () =>
      habitService.progress(habitId, {
        customerId,
        progress: 1,
        idempotencyKey: `habit:${randomUUID()}`,
        source: GamificationProgressSource.CHECK_IN,
        occurredAt: new Date("2026-03-29T22:30:00Z"),
      } as never),
    );
    expect(second.customerHabit?.currentStreak).toBe(2);
    const duplicateKey = `streak:${randomUUID()}`;
    const streak = await runAs(tenantA, () =>
      habits.qualifyStreak(streakRuleId, {
        customerId,
        idempotencyKey: duplicateKey,
        occurredAt: new Date("2026-03-29T22:30:00Z"),
      }),
    );
    const replay = await runAs(tenantA, () =>
      habits.qualifyStreak(streakRuleId, {
        customerId,
        idempotencyKey: duplicateKey,
        occurredAt: new Date("2026-03-29T22:30:00Z"),
      }),
    );
    expect(streak.streak?.currentStreak).toBe(1);
    expect(replay.idempotent).toBe(true);
  });

  it("awards one badge after achievement progress reaches its target", async () => {
    const ruleId = randomUUID();
    await transactions.run(tenantA, (transaction) =>
      transaction.achievementRule.create({
        data: {
          id: ruleId,
          tenantId: tenantA,
          badgeId,
          code: `ACH-${ruleId}`,
          eventType: "runtime.achievement",
          target: 2,
          status: GamificationStatus.ACTIVE,
        },
      }),
    );
    await runAs(tenantA, () =>
      badges.processAchievementEvent({
        eventId: randomUUID(),
        eventType: "runtime.achievement",
        customerId,
        delta: 1,
      }),
    );
    const completed = await runAs(tenantA, () =>
      badges.processAchievementEvent({
        eventId: randomUUID(),
        eventType: "runtime.achievement",
        customerId,
        delta: 1,
      }),
    );
    expect(completed[0]).toMatchObject({ progress: 2 });
    const awards = await transactions.run(tenantA, (transaction) =>
      transaction.customerBadge.findMany({ where: { customerId, badgeId } }),
    );
    expect(awards).toHaveLength(1);
  });

  it("consumes existing events reliably and idempotently", async () => {
    const ruleId = randomUUID();
    await transactions.run(tenantA, (transaction) =>
      transaction.xpRule.create({
        data: {
          id: ruleId,
          tenantId: tenantA,
          organizationId,
          code: `EVENT-${ruleId}`,
          name: "Event XP",
          eventType: "runtime.bus",
          xp: 15,
          status: GamificationStatus.ACTIVE,
        },
      }),
    );
    const event = {
      eventId: randomUUID(),
      eventType: "runtime.bus",
      customerId,
      occurredAt: new Date(),
      delta: 1,
      payload: { source: "phase5-outbox" },
    };
    const first = await runAs(tenantA, () => gamificationEvents.process(event));
    const replay = await runAs(tenantA, () => gamificationEvents.process(event));
    expect(first.idempotent).toBe(false);
    expect(replay.idempotent).toBe(true);
    const [receipts, entries] = await transactions.run(tenantA, (transaction) =>
      Promise.all([
        transaction.gamificationEventReceipt.findMany({ where: { eventId: event.eventId } }),
        transaction.xpLedgerEntry.findMany({
          where: { idempotencyKey: `event:${event.eventId}:xp:${ruleId}` },
        }),
      ]),
    );
    expect(receipts).toHaveLength(1);
    expect(receipts[0]?.status).toBe("PROCESSED");
    expect(entries).toHaveLength(1);
  });

  it("generates deterministic, private and idempotent leaderboard snapshots", async () => {
    await Promise.all([
      runAs(tenantA, () =>
        gamification.postXp({
          customerId: secondCustomerId,
          xp: 100,
          type: XpEntryType.AWARD,
          idempotencyKey: `equal:${randomUUID()}`,
        }),
      ),
      runAs(tenantA, () =>
        gamification.postXp({
          customerId: thirdCustomerId,
          xp: 100,
          type: XpEntryType.AWARD,
          idempotencyKey: `equal:${randomUUID()}`,
        }),
      ),
    ]);
    await transactions.run(tenantA, (transaction) =>
      transaction.customerGamificationProfile.update({
        where: {
          tenantId_customerId: { tenantId: tenantA, customerId: thirdCustomerId },
        },
        data: {
          leaderboardOptOut: true,
          anonymizeOnLeaderboard: true,
          leaderboardAlias: "Private member",
        },
      }),
    );
    const at = new Date("2026-07-27T12:00:00Z");
    const first = await runAs(tenantA, () => leaderboards.snapshot(leaderboardId, at));
    const replay = await runAs(tenantA, () => leaderboards.snapshot(leaderboardId, at));
    expect(first?.snapshot.entries.map((entry) => entry.rank)).toEqual(
      first?.snapshot.entries.map((_, index) => index + 1),
    );
    expect(first?.snapshot.entries.some((entry) => entry.displayName === "Private member")).toBe(
      true,
    );
    expect(replay?.idempotent).toBe(true);
    const equals = first?.snapshot.entries.filter(
      (entry) => entry.customerId === secondCustomerId || entry.customerId === thirdCustomerId,
    );
    expect(equals?.map((entry) => entry.customerId)).toEqual(
      [secondCustomerId, thirdCustomerId].sort(),
    );
  });

  it("enforces append-only XP and hides all Phase 6 rows cross-tenant", async () => {
    const entry = await transactions.run(tenantA, (transaction) =>
      transaction.xpLedgerEntry.findFirstOrThrow({ where: { customerId } }),
    );
    await expect(
      transactions.run(tenantA, (transaction) =>
        transaction.xpLedgerEntry.update({ where: { id: entry.id }, data: { xp: 999_999 } }),
      ),
    ).rejects.toThrow("append-only");

    const visible = await transactions.run(tenantB, (transaction) =>
      Promise.all([
        transaction.xpLedgerEntry.findMany(),
        transaction.challenge.findMany(),
        transaction.habit.findMany(),
        transaction.customerBadge.findMany(),
        transaction.leaderboardSnapshot.findMany(),
      ]),
    );
    expect(visible.every((rows) => rows.length === 0)).toBe(true);
  });

  it("blocks unauthorized negative XP corrections", async () => {
    await expect(
      runAs(tenantA, () =>
        gamification.postXp({
          customerId: secondCustomerId,
          xp: -1_000,
          type: XpEntryType.ADJUST,
          idempotencyKey: `negative:${randomUUID()}`,
          authorizedCorrection: true,
        }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
