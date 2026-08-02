import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  ChallengeEnrollmentStatus,
  GamificationStatus,
  LeaderboardMetric,
  LeaderboardPeriod,
  LeaderboardScope,
  type Prisma,
  type TenantTransaction,
} from "@rabbehni/database";
import { TenantTransactionService } from "@rabbehni/database/nest";

import { appendDomainChange } from "../common/events/append-domain-change.js";
import { pageResult, pageWindow } from "../common/pagination.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import type { LeaderboardConfigInput, LeaderboardList, LeaderboardResults } from "./dto.js";

@Injectable()
export class LeaderboardsRepository {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(TenantTransactionService) private readonly transactions: TenantTransactionService,
  ) {}

  create(input: LeaderboardConfigInput) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      await this.resolveOrganization(transaction, input.scope, input.scopeId);
      const config = await transaction.leaderboardConfig.create({
        data: {
          tenantId,
          code: input.code,
          name: input.name,
          scope: input.scope,
          period: input.period,
          metric: input.metric,
          status: input.status,
          maxEntries: input.maxEntries,
          anonymizeOptedOut: input.anonymizeOptedOut,
          schedule: input.schedule,
          ...(input.scopeId ? { scopeId: input.scopeId } : {}),
        },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "gamification.leaderboard.create",
        eventType: "gamification.leaderboard-config.created.v1",
        entityType: "leaderboard_config",
        entityId: config.id,
        payload: { scope: config.scope, metric: config.metric, period: config.period },
      });
      return config;
    });
  }

  update(id: string, input: Record<string, unknown>) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const current = await transaction.leaderboardConfig.findUnique({ where: { id } });
      if (!current) return null;
      const scope =
        typeof input.scope === "string" ? (input.scope as LeaderboardScope) : current.scope;
      const scopeId =
        typeof input.scopeId === "string"
          ? input.scopeId
          : input.scopeId === null
            ? undefined
            : (current.scopeId ?? undefined);
      await this.resolveOrganization(transaction, scope, scopeId);
      return transaction.leaderboardConfig.update({
        where: { id },
        data: input as Prisma.LeaderboardConfigUpdateInput,
      });
    });
  }

  list(input: LeaderboardList) {
    const tenantId = this.context.tenantId();
    const where: Prisma.LeaderboardConfigWhereInput = {
      tenantId,
      ...(input.scope ? { scope: input.scope } : {}),
      ...(input.period ? { period: input.period } : {}),
      ...(input.metric ? { metric: input.metric } : {}),
      ...(input.status ? { status: input.status } : {}),
    };
    return this.transactions.run(tenantId, async (transaction) => {
      const [items, total] = await Promise.all([
        transaction.leaderboardConfig.findMany({
          where,
          ...pageWindow(input),
          orderBy: { [input.sortBy]: input.sortDirection },
          include: { snapshots: { orderBy: { generatedAt: "desc" }, take: 1 } },
        }),
        transaction.leaderboardConfig.count({ where }),
      ]);
      return pageResult(items, total, input);
    });
  }

  publicConfigs() {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.leaderboardConfig.findMany({
        where: { tenantId, status: GamificationStatus.ACTIVE },
        select: {
          id: true,
          code: true,
          name: true,
          scope: true,
          period: true,
          metric: true,
        },
        orderBy: { name: "asc" },
      }),
    );
  }

  snapshot(configId: string, at: Date) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const config = await transaction.leaderboardConfig.findUnique({
        where: { id: configId },
      });
      if (!config || config.status !== GamificationStatus.ACTIVE) return null;
      const organizationId = await this.resolveOrganization(
        transaction,
        config.scope,
        config.scopeId ?? undefined,
      );
      const { start, end } = this.periodWindow(config.period, at);
      const idempotencyKey = `leaderboard:${config.id}:${start.toISOString()}:${end.toISOString()}`;
      const replay = await transaction.leaderboardSnapshot.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
        include: { entries: { orderBy: { rank: "asc" } } },
      });
      if (replay) return { snapshot: replay, idempotent: true };

      const customers = await transaction.customer.findMany({
        where: {
          tenantId,
          status: "ACTIVE",
          ...(organizationId ? { organizationId } : {}),
        },
        select: {
          id: true,
          displayName: true,
          gamificationProfile: {
            select: {
              leaderboardOptOut: true,
              anonymizeOnLeaderboard: true,
              leaderboardAlias: true,
            },
          },
        },
      });
      const customerIds = customers.map((customer) => customer.id);
      const scoreByCustomer = await this.scores(
        transaction,
        config.metric,
        customerIds,
        start,
        end,
      );
      const ranked = customers
        .flatMap((customer) => {
          const profile = customer.gamificationProfile;
          if (profile?.leaderboardOptOut && !config.anonymizeOptedOut) return [];
          const anonymized =
            Boolean(profile?.leaderboardOptOut) || Boolean(profile?.anonymizeOnLeaderboard);
          return [
            {
              customerId: customer.id,
              score: scoreByCustomer.get(customer.id) ?? 0,
              displayName: anonymized
                ? (profile?.leaderboardAlias ?? `Member ${customer.id.slice(0, 6)}`)
                : customer.displayName,
              anonymized,
              tieBreaker: customer.id,
            },
          ];
        })
        .sort(
          (left, right) =>
            right.score - left.score || left.tieBreaker.localeCompare(right.tieBreaker),
        )
        .slice(0, config.maxEntries);

      const createdSnapshot = await transaction.leaderboardSnapshot.create({
        data: {
          tenantId,
          configId: config.id,
          periodStart: start,
          periodEnd: end,
          idempotencyKey,
        },
      });
      await transaction.leaderboardEntry.createMany({
        data: ranked.map((entry, index) => ({
          tenantId,
          snapshotId: createdSnapshot.id,
          ...entry,
          rank: index + 1,
        })),
      });
      const snapshot = await transaction.leaderboardSnapshot.findUniqueOrThrow({
        where: { id: createdSnapshot.id },
        include: { entries: { orderBy: { rank: "asc" } } },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "gamification.leaderboard.snapshot",
        eventType: "gamification.leaderboard.snapshot-generated.v1",
        entityType: "leaderboard_snapshot",
        entityId: snapshot.id,
        payload: {
          configId: config.id,
          periodStart: start.toISOString(),
          periodEnd: end.toISOString(),
          entries: snapshot.entries.length,
        },
      });
      return { snapshot, idempotent: false };
    });
  }

  results(configId: string, input: LeaderboardResults) {
    const tenantId = this.context.tenantId();
    const principal = this.context.authenticatedPrincipal();
    return this.transactions.run(tenantId, async (transaction) => {
      const config = await transaction.leaderboardConfig.findUnique({ where: { id: configId } });
      if (!config) return null;
      const snapshot = input.snapshotId
        ? await transaction.leaderboardSnapshot.findFirst({
            where: { id: input.snapshotId, configId },
          })
        : await transaction.leaderboardSnapshot.findFirst({
            where: { configId },
            orderBy: { generatedAt: "desc" },
          });
      if (!snapshot) return { config, snapshot: null, ...pageResult([], 0, input) };
      const customer = input.customerId
        ? await transaction.customer.findUnique({ where: { id: input.customerId } })
        : null;
      if (
        customer &&
        customer.userId !== principal.userId &&
        !principal.permissions.includes("leaderboard.read")
      ) {
        throw new BadRequestException("Cannot inspect another customer's ranking");
      }
      const where: Prisma.LeaderboardEntryWhereInput = {
        snapshotId: snapshot.id,
        ...(input.customerId ? { customerId: input.customerId } : {}),
      };
      const [items, total] = await Promise.all([
        transaction.leaderboardEntry.findMany({
          where,
          ...pageWindow(input),
          orderBy: { rank: input.sortDirection },
        }),
        transaction.leaderboardEntry.count({ where }),
      ]);
      return { config, snapshot, ...pageResult(items, total, input) };
    });
  }

  private async scores(
    transaction: TenantTransaction,
    metric: LeaderboardMetric,
    customerIds: string[],
    start: Date,
    end: Date,
  ) {
    const scores = new Map<string, number>();
    if (customerIds.length === 0) return scores;
    if (metric === LeaderboardMetric.XP) {
      const groups = await transaction.xpLedgerEntry.groupBy({
        by: ["customerId"],
        where: { customerId: { in: customerIds }, createdAt: { gte: start, lt: end } },
        _sum: { xp: true },
      });
      groups.forEach((group) => scores.set(group.customerId, group._sum.xp ?? 0));
    }
    if (metric === LeaderboardMetric.POINTS) {
      const groups = await transaction.pointsLedgerEntry.groupBy({
        by: ["customerId"],
        where: { customerId: { in: customerIds }, createdAt: { gte: start, lt: end } },
        _sum: { points: true },
      });
      groups.forEach((group) => scores.set(group.customerId, group._sum.points ?? 0));
    }
    if (metric === LeaderboardMetric.CHALLENGES) {
      const groups = await transaction.challengeEnrollment.groupBy({
        by: ["customerId"],
        where: {
          customerId: { in: customerIds },
          status: ChallengeEnrollmentStatus.COMPLETED,
          completedAt: { gte: start, lt: end },
        },
        _count: { _all: true },
      });
      groups.forEach((group) => scores.set(group.customerId, group._count._all));
    }
    if (metric === LeaderboardMetric.STREAK) {
      const groups = await transaction.customerStreak.groupBy({
        by: ["customerId"],
        where: { customerId: { in: customerIds } },
        _max: { currentStreak: true },
      });
      groups.forEach((group) => scores.set(group.customerId, group._max.currentStreak ?? 0));
    }
    return scores;
  }

  private async resolveOrganization(
    transaction: TenantTransaction,
    scope: LeaderboardScope,
    scopeId?: string,
  ): Promise<string | undefined> {
    if (scope === LeaderboardScope.TENANT) return undefined;
    if (!scopeId) throw new BadRequestException(`${scope} leaderboard requires a scopeId`);
    if (scope === LeaderboardScope.ORGANIZATION) {
      const organization = await transaction.organization.findUnique({ where: { id: scopeId } });
      if (!organization || !this.context.canAccessOrganization(organization.id)) {
        throw new BadRequestException("Leaderboard organization is outside scope");
      }
      return organization.id;
    }
    const entity =
      scope === LeaderboardScope.FRANCHISE
        ? await transaction.franchise.findUnique({ where: { id: scopeId } })
        : scope === LeaderboardScope.MERCHANT
          ? await transaction.merchant.findUnique({ where: { id: scopeId } })
          : await transaction.branch.findUnique({ where: { id: scopeId } });
    if (!entity || !this.context.canAccessOrganization(entity.organizationId)) {
      throw new BadRequestException(`Leaderboard ${scope.toLowerCase()} is outside scope`);
    }
    return entity.organizationId;
  }

  private periodWindow(period: LeaderboardPeriod, at: Date) {
    if (period === LeaderboardPeriod.ALL_TIME) {
      return { start: new Date(0), end: new Date("9999-12-31T23:59:59.999Z") };
    }
    const start = new Date(at);
    start.setUTCHours(0, 0, 0, 0);
    if (period === LeaderboardPeriod.WEEKLY) {
      const day = start.getUTCDay() || 7;
      start.setUTCDate(start.getUTCDate() - day + 1);
    }
    if (period === LeaderboardPeriod.MONTHLY) start.setUTCDate(1);
    const end = new Date(start);
    if (period === LeaderboardPeriod.DAILY) end.setUTCDate(end.getUTCDate() + 1);
    if (period === LeaderboardPeriod.WEEKLY) end.setUTCDate(end.getUTCDate() + 7);
    if (period === LeaderboardPeriod.MONTHLY) end.setUTCMonth(end.getUTCMonth() + 1);
    return { start, end };
  }
}
