import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  GamificationStatus,
  HabitCadence,
  type Prisma,
  type TenantTransaction,
} from "@rabbehni/database";
import type { ChallengeRewardType } from "@rabbehni/database";
import { TenantTransactionService } from "@rabbehni/database/nest";

import { appendDomainChange } from "../common/events/append-domain-change.js";
import { pageResult, pageWindow } from "../common/pagination.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import type {
  CreateHabit,
  HabitCalendar,
  HabitList,
  HabitProgress,
  QualifyStreak,
  StreakRuleInput,
} from "./dto.js";
import { dateFromLocalKey, localDateKey, streakTransition, weeklyPeriodKey } from "./timezone.js";

@Injectable()
export class HabitsRepository {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(TenantTransactionService) private readonly transactions: TenantTransactionService,
  ) {}

  create(input: CreateHabit) {
    this.assertOrganization(input.organizationId);
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) {
        throw new BadRequestException("Habit end date must be after start date");
      }
      await this.validateMilestones(transaction, input.organizationId, input.milestones);
      const habit = await transaction.habit.create({
        data: {
          tenantId,
          organizationId: input.organizationId,
          code: input.code,
          name: input.name,
          cadence: input.cadence,
          status: input.status,
          objectiveType: input.objectiveType,
          target: input.target,
          graceDays: input.graceDays,
          freezeAllowance: input.freezeAllowance,
          conditions: input.conditions as Prisma.InputJsonValue,
          ...(input.description ? { description: input.description } : {}),
          ...(input.timezone ? { timezone: input.timezone } : {}),
          ...(input.startsAt ? { startsAt: input.startsAt } : {}),
          ...(input.endsAt ? { endsAt: input.endsAt } : {}),
          milestones: {
            createMany: {
              data: input.milestones.map((milestone) => ({
                tenantId,
                streakThreshold: milestone.streakThreshold,
                rewardType: milestone.rewardType,
                ...(milestone.rewardAmount ? { rewardAmount: milestone.rewardAmount } : {}),
                ...(milestone.badgeId ? { badgeId: milestone.badgeId } : {}),
                ...(milestone.loyaltyProgramId
                  ? { loyaltyProgramId: milestone.loyaltyProgramId }
                  : {}),
              })),
            },
          },
        },
        include: { milestones: true },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "gamification.habit.create",
        eventType: "gamification.habit.created.v1",
        entityType: "habit",
        entityId: habit.id,
        payload: { cadence: habit.cadence, target: habit.target },
      });
      return habit;
    });
  }

  update(id: string, input: Record<string, unknown>) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const habit = await this.authorizedHabit(transaction, id);
      const startsAt = input.startsAt instanceof Date ? input.startsAt : habit.startsAt;
      const endsAt = input.endsAt instanceof Date ? input.endsAt : habit.endsAt;
      if (startsAt && endsAt && endsAt <= startsAt) {
        throw new BadRequestException("Habit end date must be after start date");
      }
      return transaction.habit.update({
        where: { id },
        data: input as Prisma.HabitUpdateInput,
      });
    });
  }

  list(input: HabitList) {
    const tenantId = this.context.tenantId();
    const principal = this.context.authenticatedPrincipal();
    const where: Prisma.HabitWhereInput = {
      tenantId,
      ...(!principal.access.tenantWide
        ? { organizationId: { in: [...principal.access.organizationIds] } }
        : {}),
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.cadence ? { cadence: input.cadence } : {}),
      ...(input.customerId ? { customers: { some: { customerId: input.customerId } } } : {}),
    };
    return this.transactions.run(tenantId, async (transaction) => {
      const [items, total] = await Promise.all([
        transaction.habit.findMany({
          where,
          ...pageWindow(input),
          orderBy: { [input.sortBy]: input.sortDirection },
          include: {
            milestones: true,
            ...(input.customerId
              ? { customers: { where: { customerId: input.customerId } } }
              : { _count: { select: { customers: true } } }),
          },
        }),
        transaction.habit.count({ where }),
      ]);
      return pageResult(items, total, input);
    });
  }

  matchingHabitsForEvent(customerId: string, eventType: string, occurredAt: Date) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const customer = await transaction.customer.findUnique({ where: { id: customerId } });
      if (!customer || !this.context.canAccessOrganization(customer.organizationId)) return [];
      return transaction.habit.findMany({
        where: {
          organizationId: customer.organizationId,
          objectiveType: eventType,
          status: GamificationStatus.ACTIVE,
          OR: [{ startsAt: null }, { startsAt: { lte: occurredAt } }],
          AND: [
            { OR: [{ endsAt: null }, { endsAt: { gt: occurredAt } }] },
            { customers: { some: { customerId, active: true } } },
          ],
        },
        select: { id: true },
      });
    });
  }

  matchingStreakRulesForEvent(customerId: string, eventType: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const customer = await transaction.customer.findUnique({ where: { id: customerId } });
      if (!customer || !this.context.canAccessOrganization(customer.organizationId)) return [];
      return transaction.streakRule.findMany({
        where: {
          organizationId: customer.organizationId,
          qualifyingEvent: eventType,
          status: GamificationStatus.ACTIVE,
        },
        select: { id: true },
      });
    });
  }

  detail(id: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const habit = await transaction.habit.findUnique({
        where: { id },
        include: {
          milestones: true,
          customers: {
            include: { customer: { select: { id: true, displayName: true } } },
            orderBy: { updatedAt: "desc" },
            take: 200,
          },
        },
      });
      return habit && this.context.canAccessOrganization(habit.organizationId) ? habit : null;
    });
  }

  enroll(habitId: string, customerId: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const [habit, customer] = await Promise.all([
        this.authorizedHabit(transaction, habitId),
        transaction.customer.findUnique({ where: { id: customerId } }),
      ]);
      if (!customer || customer.organizationId !== habit.organizationId) {
        throw new BadRequestException("Customer is outside habit organization");
      }
      return transaction.customerHabit.upsert({
        where: { tenantId_habitId_customerId: { tenantId, habitId, customerId } },
        update: { active: true },
        create: {
          tenantId,
          habitId,
          customerId,
          freezesRemaining: habit.freezeAllowance,
        },
      });
    });
  }

  progress(habitId: string, input: HabitProgress) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      await transaction.$queryRaw`
        SELECT true AS locked
        FROM pg_advisory_xact_lock(
          hashtextextended(${`${tenantId}:habit:${habitId}:${input.customerId}`}, 0)
        )
      `;
      const replay = await transaction.habitCompletion.findUnique({
        where: {
          tenantId_idempotencyKey: { tenantId, idempotencyKey: input.idempotencyKey },
        },
      });
      if (replay) {
        return {
          completion: replay,
          customerHabit: await transaction.customerHabit.findUnique({
            where: { id: replay.customerHabitId },
          }),
          milestones: [],
          idempotent: true,
        };
      }
      const habit = await this.authorizedHabit(transaction, habitId);
      this.assertHabitActive(habit, input.occurredAt);
      let customerHabit = await transaction.customerHabit.findUnique({
        where: {
          tenantId_habitId_customerId: {
            tenantId,
            habitId,
            customerId: input.customerId,
          },
        },
      });
      if (!customerHabit?.active) throw new ConflictException("Customer is not enrolled in habit");
      const timezone = await this.resolveTimezone(transaction, habit.timezone);
      const localKey = localDateKey(input.occurredAt, timezone);
      const periodKey = habit.cadence === HabitCadence.DAILY ? localKey : weeklyPeriodKey(localKey);
      const previousProgress =
        customerHabit.currentPeriodKey === periodKey ? customerHabit.currentPeriodProgress : 0;
      const progress = Math.min(habit.target, previousProgress + input.progress);
      const completed = progress >= habit.target;
      let nextStreak = {
        currentStreak: customerHabit.currentStreak,
        longestStreak: customerHabit.longestStreak,
        freezesRemaining: customerHabit.freezesRemaining,
        action: "PROGRESS",
      };
      if (completed && previousProgress < habit.target) {
        nextStreak = streakTransition({
          previousLocalKey: customerHabit.lastQualifiedLocalDate
            ? customerHabit.lastQualifiedLocalDate.toISOString().slice(0, 10)
            : undefined,
          currentLocalKey: localKey,
          currentStreak: customerHabit.currentStreak,
          longestStreak: customerHabit.longestStreak,
          graceDays: habit.graceDays,
          freezesRemaining: customerHabit.freezesRemaining,
        });
      }
      const completion = await transaction.habitCompletion.create({
        data: {
          tenantId,
          habitId,
          customerHabitId: customerHabit.id,
          customerId: input.customerId,
          source: input.source,
          localDate: dateFromLocalKey(localKey),
          periodKey,
          progress,
          completed,
          timezone,
          idempotencyKey: input.idempotencyKey,
          occurredAt: input.occurredAt,
          ...(input.referenceType ? { referenceType: input.referenceType } : {}),
          ...(input.referenceId ? { referenceId: input.referenceId } : {}),
        },
      });
      customerHabit = await transaction.customerHabit.update({
        where: { id: customerHabit.id },
        data: {
          currentPeriodKey: periodKey,
          currentPeriodProgress: progress,
          currentStreak: nextStreak.currentStreak,
          longestStreak: nextStreak.longestStreak,
          freezesRemaining: nextStreak.freezesRemaining,
          ...(completed && previousProgress < habit.target
            ? { lastQualifiedLocalDate: dateFromLocalKey(localKey) }
            : {}),
        },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: completed ? "gamification.habit.complete" : "gamification.habit.progress",
        eventType: completed
          ? "gamification.habit.completed.v1"
          : "gamification.habit.progress-updated.v1",
        entityType: "customer_habit",
        entityId: customerHabit.id,
        payload: {
          habitId,
          customerId: input.customerId,
          progress,
          streak: nextStreak.currentStreak,
          timezone,
          localDate: localKey,
        },
      });
      const milestones =
        completed && previousProgress < habit.target
          ? await transaction.habitMilestone.findMany({
              where: {
                habitId,
                streakThreshold: { lte: nextStreak.currentStreak },
                AND: [{ streakThreshold: { gt: customerHabit.currentStreak - 1 } }],
              },
            })
          : [];
      return { completion, customerHabit, milestones, idempotent: false };
    });
  }

  calendar(input: HabitCalendar) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const customer = await transaction.customer.findUnique({ where: { id: input.customerId } });
      if (!customer || !this.canReadCustomer(customer)) return null;
      const where: Prisma.HabitCompletionWhereInput = {
        customerId: input.customerId,
        ...(input.habitId ? { habitId: input.habitId } : {}),
        ...(input.from || input.to
          ? {
              occurredAt: {
                ...(input.from ? { gte: input.from } : {}),
                ...(input.to ? { lte: input.to } : {}),
              },
            }
          : {}),
      };
      const [items, total] = await Promise.all([
        transaction.habitCompletion.findMany({
          where,
          ...pageWindow(input),
          orderBy: { [input.sortBy]: input.sortDirection },
          include: { habit: { select: { id: true, name: true, cadence: true } } },
        }),
        transaction.habitCompletion.count({ where }),
      ]);
      return pageResult(items, total, input);
    });
  }

  createStreakRule(input: StreakRuleInput) {
    this.assertOrganization(input.organizationId);
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.streakRule.create({
        data: {
          tenantId,
          organizationId: input.organizationId,
          code: input.code,
          name: input.name,
          qualifyingEvent: input.qualifyingEvent,
          status: input.status,
          graceDays: input.graceDays,
          freezeAllowance: input.freezeAllowance,
          conditions: input.conditions as Prisma.InputJsonValue,
          ...(input.timezone ? { timezone: input.timezone } : {}),
        },
      }),
    );
  }

  listStreakRules() {
    const tenantId = this.context.tenantId();
    const access = this.context.authenticatedPrincipal().access;
    return this.transactions.run(tenantId, (transaction) =>
      transaction.streakRule.findMany({
        where: {
          tenantId,
          ...(!access.tenantWide ? { organizationId: { in: [...access.organizationIds] } } : {}),
        },
        include: { _count: { select: { customerStreaks: true } } },
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  qualifyStreak(ruleId: string, input: QualifyStreak) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      await transaction.$queryRaw`
        SELECT true AS locked
        FROM pg_advisory_xact_lock(
          hashtextextended(${`${tenantId}:streak:${ruleId}:${input.customerId}`}, 0)
        )
      `;
      const replay = await transaction.streakHistory.findUnique({
        where: {
          tenantId_idempotencyKey: { tenantId, idempotencyKey: input.idempotencyKey },
        },
      });
      if (replay) return { history: replay, idempotent: true };
      const [rule, customer, config] = await Promise.all([
        transaction.streakRule.findUnique({ where: { id: ruleId } }),
        transaction.customer.findUnique({ where: { id: input.customerId } }),
        transaction.gamificationConfig.findUnique({ where: { tenantId } }),
      ]);
      if (
        !rule ||
        !customer ||
        rule.organizationId !== customer.organizationId ||
        rule.status !== GamificationStatus.ACTIVE ||
        !this.context.canAccessOrganization(rule.organizationId)
      ) {
        throw new BadRequestException("Active streak rule and customer must share organization");
      }
      const timezone = rule.timezone ?? config?.defaultTimezone ?? "UTC";
      const localKey = localDateKey(input.occurredAt, timezone);
      let streak = await transaction.customerStreak.findUnique({
        where: {
          tenantId_streakRuleId_customerId: {
            tenantId,
            streakRuleId: ruleId,
            customerId: customer.id,
          },
        },
      });
      const transition = streakTransition({
        previousLocalKey: streak?.lastQualifiedLocalDate?.toISOString().slice(0, 10),
        currentLocalKey: localKey,
        currentStreak: streak?.currentStreak ?? 0,
        longestStreak: streak?.longestStreak ?? 0,
        graceDays: rule.graceDays,
        freezesRemaining: streak?.freezesRemaining ?? rule.freezeAllowance,
      });
      streak = await transaction.customerStreak.upsert({
        where: {
          tenantId_streakRuleId_customerId: {
            tenantId,
            streakRuleId: ruleId,
            customerId: customer.id,
          },
        },
        update: {
          currentStreak: transition.currentStreak,
          longestStreak: transition.longestStreak,
          freezesRemaining: transition.freezesRemaining,
          lastQualifiedLocalDate: dateFromLocalKey(localKey),
        },
        create: {
          tenantId,
          streakRuleId: ruleId,
          customerId: customer.id,
          currentStreak: transition.currentStreak,
          longestStreak: transition.longestStreak,
          freezesRemaining: transition.freezesRemaining,
          lastQualifiedLocalDate: dateFromLocalKey(localKey),
        },
      });
      const history = await transaction.streakHistory.create({
        data: {
          tenantId,
          customerStreakId: streak.id,
          streakRuleId: ruleId,
          customerId: customer.id,
          localDate: dateFromLocalKey(localKey),
          previousStreak:
            transition.action === "DUPLICATE_DAY"
              ? transition.currentStreak
              : transition.action === "RESET"
                ? 0
                : Math.max(0, transition.currentStreak - 1),
          currentStreak: transition.currentStreak,
          action: transition.action,
          idempotencyKey: input.idempotencyKey,
          occurredAt: input.occurredAt,
        },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "gamification.streak.update",
        eventType: "gamification.streak.updated.v1",
        entityType: "customer_streak",
        entityId: streak.id,
        payload: {
          customerId: customer.id,
          ruleId,
          currentStreak: streak.currentStreak,
          longestStreak: streak.longestStreak,
          action: transition.action,
          localDate: localKey,
          timezone,
        },
      });
      return { streak, history, idempotent: false };
    });
  }

  customerStreaks(customerId: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const customer = await transaction.customer.findUnique({ where: { id: customerId } });
      if (!customer || !this.canReadCustomer(customer)) return null;
      return transaction.customerStreak.findMany({
        where: { customerId },
        include: { rule: true, history: { orderBy: { occurredAt: "desc" }, take: 60 } },
        orderBy: { currentStreak: "desc" },
      });
    });
  }

  private async resolveTimezone(transaction: TenantTransaction, configured?: string | null) {
    if (configured) return configured;
    const config = await transaction.gamificationConfig.findUnique({
      where: { tenantId: this.context.tenantId() },
    });
    return config?.defaultTimezone ?? "UTC";
  }

  private async authorizedHabit(transaction: TenantTransaction, id: string) {
    const habit = await transaction.habit.findUnique({ where: { id } });
    if (!habit || !this.context.canAccessOrganization(habit.organizationId)) {
      throw new NotFoundException("Habit not found or outside scope");
    }
    return habit;
  }

  private assertHabitActive(
    habit: { status: GamificationStatus; startsAt: Date | null; endsAt: Date | null },
    occurredAt: Date,
  ) {
    if (
      habit.status !== GamificationStatus.ACTIVE ||
      (habit.startsAt && habit.startsAt > occurredAt) ||
      (habit.endsAt && habit.endsAt <= occurredAt)
    ) {
      throw new ConflictException("Habit is not active for this occurrence");
    }
  }

  private assertOrganization(organizationId: string) {
    if (!this.context.canAccessOrganization(organizationId)) {
      throw new BadRequestException("Organization is outside the authorized boundary");
    }
  }

  private canReadCustomer(customer: { organizationId: string; userId: string | null }) {
    const principal = this.context.authenticatedPrincipal();
    return (
      (principal.permissions.includes("habit.read") &&
        this.context.canAccessOrganization(customer.organizationId)) ||
      customer.userId === principal.userId
    );
  }

  private async validateMilestones(
    transaction: TenantTransaction,
    organizationId: string,
    milestones: readonly {
      rewardType: ChallengeRewardType;
      badgeId?: string | undefined;
      loyaltyProgramId?: string | undefined;
    }[],
  ) {
    for (const milestone of milestones) {
      if (milestone.badgeId) {
        const badge = await transaction.badge.findUnique({ where: { id: milestone.badgeId } });
        if (!badge || badge.organizationId !== organizationId) {
          throw new BadRequestException("Habit milestone badge is outside organization");
        }
      }
      if (milestone.loyaltyProgramId) {
        const program = await transaction.loyaltyProgram.findUnique({
          where: { id: milestone.loyaltyProgramId },
        });
        if (!program || program.organizationId !== organizationId) {
          throw new BadRequestException("Habit milestone program is outside organization");
        }
      }
    }
  }
}
