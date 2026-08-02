import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  GamificationStatus,
  XpEntryType,
  type Prisma,
  type TenantTransaction,
} from "@rabbehni/database";
import { TenantTransactionService } from "@rabbehni/database/nest";

import { appendDomainChange } from "../common/events/append-domain-change.js";
import { pageResult, pageWindow } from "../common/pagination.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import type { AdjustXp, AwardXp, PrivacyUpdate, XpList } from "./dto.js";

export interface XpPostInput {
  readonly customerId: string;
  readonly xp: number;
  readonly idempotencyKey: string;
  readonly type: XpEntryType;
  readonly ruleId?: string | undefined;
  readonly referenceType?: string | undefined;
  readonly referenceId?: string | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
  readonly authorizedCorrection?: boolean | undefined;
}

@Injectable()
export class GamificationRepository {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(TenantTransactionService) private readonly transactions: TenantTransactionService,
  ) {}

  getConfig() {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.gamificationConfig.findUnique({ where: { tenantId } }),
    );
  }

  upsertConfig(input: {
    active: boolean;
    defaultTimezone: string;
    allowManualCorrection: boolean;
    settings: Readonly<Record<string, unknown>>;
  }) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const config = await transaction.gamificationConfig.upsert({
        where: { tenantId },
        update: {
          ...input,
          settings: input.settings as Prisma.InputJsonValue,
        },
        create: {
          tenantId,
          ...input,
          settings: input.settings as Prisma.InputJsonValue,
        },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "gamification.config.update",
        eventType: "gamification.config.updated.v1",
        entityType: "gamification_config",
        entityId: config.id,
        payload: { active: config.active, timezone: config.defaultTimezone },
      });
      return config;
    });
  }

  listRules() {
    const tenantId = this.context.tenantId();
    const access = this.context.authenticatedPrincipal().access;
    return this.transactions.run(tenantId, (transaction) =>
      transaction.xpRule.findMany({
        where: {
          tenantId,
          ...(!access.tenantWide ? { organizationId: { in: [...access.organizationIds] } } : {}),
        },
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      }),
    );
  }

  rulesForEvent(customerId: string, eventType: string, occurredAt: Date) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const customer = await transaction.customer.findUnique({ where: { id: customerId } });
      if (!customer || !this.context.canAccessOrganization(customer.organizationId)) return [];
      return transaction.xpRule.findMany({
        where: {
          organizationId: customer.organizationId,
          eventType,
          status: GamificationStatus.ACTIVE,
          OR: [{ startsAt: null }, { startsAt: { lte: occurredAt } }],
          AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: occurredAt } }] }],
        },
        orderBy: { priority: "asc" },
      });
    });
  }

  createRule(input: {
    organizationId: string;
    code: string;
    name: string;
    description?: string | undefined;
    eventType: string;
    xp: number;
    priority: number;
    status: GamificationStatus;
    startsAt?: Date | undefined;
    endsAt?: Date | undefined;
    conditions: Readonly<Record<string, unknown>>;
  }) {
    this.assertOrganization(input.organizationId);
    if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) {
      throw new BadRequestException("Rule end date must be after its start date");
    }
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const rule = await transaction.xpRule.create({
        data: {
          tenantId,
          organizationId: input.organizationId,
          code: input.code,
          name: input.name,
          eventType: input.eventType,
          xp: input.xp,
          priority: input.priority,
          status: input.status,
          conditions: input.conditions as Prisma.InputJsonValue,
          ...(input.description ? { description: input.description } : {}),
          ...(input.startsAt ? { startsAt: input.startsAt } : {}),
          ...(input.endsAt ? { endsAt: input.endsAt } : {}),
        },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "gamification.xp_rule.create",
        eventType: "gamification.xp-rule.created.v1",
        entityType: "xp_rule",
        entityId: rule.id,
        payload: { eventType: rule.eventType, xp: rule.xp },
      });
      return rule;
    });
  }

  updateRule(id: string, input: Record<string, unknown>) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const current = await transaction.xpRule.findUnique({ where: { id } });
      if (!current || !this.context.canAccessOrganization(current.organizationId)) return null;
      if (
        typeof input.organizationId === "string" &&
        !this.context.canAccessOrganization(input.organizationId)
      ) {
        throw new BadRequestException("Organization is outside the authorized boundary");
      }
      const updated = await transaction.xpRule.update({
        where: { id },
        data: input as Prisma.XpRuleUpdateInput,
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "gamification.xp_rule.update",
        eventType: "gamification.xp-rule.updated.v1",
        entityType: "xp_rule",
        entityId: id,
        payload: { status: updated.status },
      });
      return updated;
    });
  }

  listLevels() {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.levelDefinition.findMany({ where: { tenantId }, orderBy: { level: "asc" } }),
    );
  }

  createLevel(input: {
    code: string;
    name: string;
    level: number;
    xpThreshold: number;
    status: GamificationStatus;
    benefits: Readonly<Record<string, unknown>>;
    metadata: Readonly<Record<string, unknown>>;
  }) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      await this.assertLevelThreshold(transaction, input.level, input.xpThreshold);
      const level = await transaction.levelDefinition.create({
        data: {
          tenantId,
          ...input,
          benefits: input.benefits as Prisma.InputJsonValue,
          metadata: input.metadata as Prisma.InputJsonValue,
        },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "gamification.level.create",
        eventType: "gamification.level.created.v1",
        entityType: "level_definition",
        entityId: level.id,
        payload: { level: level.level, xpThreshold: level.xpThreshold },
      });
      return level;
    });
  }

  updateLevel(id: string, input: Record<string, unknown>) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const current = await transaction.levelDefinition.findUnique({ where: { id } });
      if (!current) return null;
      const nextLevel = typeof input.level === "number" ? input.level : current.level;
      const nextThreshold =
        typeof input.xpThreshold === "number" ? input.xpThreshold : current.xpThreshold;
      await this.assertLevelThreshold(transaction, nextLevel, nextThreshold, id);
      const level = await transaction.levelDefinition.update({
        where: { id },
        data: input as Prisma.LevelDefinitionUpdateInput,
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "gamification.level.update",
        eventType: "gamification.level.updated.v1",
        entityType: "level_definition",
        entityId: id,
        payload: { level: level.level, xpThreshold: level.xpThreshold },
      });
      return level;
    });
  }

  award(input: AwardXp) {
    return this.postXp({
      ...input,
      type: XpEntryType.AWARD,
    });
  }

  adjust(input: AdjustXp) {
    return this.postXp({
      ...input,
      type: XpEntryType.ADJUST,
      metadata: { ...input.metadata, reason: input.reason },
      authorizedCorrection: input.authorizedCorrection,
    });
  }

  postXp(input: XpPostInput) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      await this.lockCustomer(transaction, tenantId, input.customerId);
      const replay = await transaction.xpLedgerEntry.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: input.idempotencyKey } },
      });
      if (replay) return this.xpResult(transaction, replay, true);

      const [customer, config, rule] = await Promise.all([
        transaction.customer.findUnique({ where: { id: input.customerId } }),
        transaction.gamificationConfig.findUnique({ where: { tenantId } }),
        input.ruleId ? transaction.xpRule.findUnique({ where: { id: input.ruleId } }) : null,
      ]);
      if (!customer || !this.context.canAccessOrganization(customer.organizationId)) {
        throw new NotFoundException("Customer not found or outside scope");
      }
      if (customer.status !== "ACTIVE" || !config?.active) {
        throw new ConflictException("Customer and gamification configuration must be active");
      }
      if (
        rule &&
        (rule.status !== GamificationStatus.ACTIVE ||
          rule.organizationId !== customer.organizationId ||
          (rule.startsAt && rule.startsAt > new Date()) ||
          (rule.endsAt && rule.endsAt <= new Date()))
      ) {
        throw new ConflictException("XP rule is not active or applicable");
      }

      const currentXp = await this.sumXp(transaction, input.customerId);
      const nextXp = currentXp + input.xp;
      if (nextXp < 0) throw new ConflictException("XP balance cannot be negative");

      const previousLevel = await this.levelForXp(transaction, currentXp);
      const nextLevel = await this.levelForXp(transaction, nextXp);
      if ((nextLevel?.level ?? 0) < (previousLevel?.level ?? 0) && !input.authorizedCorrection) {
        throw new ConflictException(
          "Level progression cannot decrease without correction authority",
        );
      }

      const entry = await transaction.xpLedgerEntry.create({
        data: {
          tenantId,
          organizationId: customer.organizationId,
          customerId: customer.id,
          type: input.type,
          xp: input.xp,
          idempotencyKey: input.idempotencyKey,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
          ...(input.ruleId ? { ruleId: input.ruleId } : {}),
          ...(input.referenceType ? { referenceType: input.referenceType } : {}),
          ...(input.referenceId ? { referenceId: input.referenceId } : {}),
          ...(request.actorId ? { createdByUserId: request.actorId } : {}),
        },
      });
      await this.updateProfileAndLevel(
        transaction,
        customer.id,
        customer.organizationId,
        nextXp,
        previousLevel,
        nextLevel,
        input.idempotencyKey,
        input.authorizedCorrection ?? false,
      );
      await transaction.customerActivity.create({
        data: {
          tenantId,
          customerId: customer.id,
          type: "gamification.xp_awarded",
          referenceId: entry.id,
          metadata: { xp: input.xp, totalXp: nextXp, level: nextLevel?.level ?? 0 },
        },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: `gamification.xp.${input.type.toLowerCase()}`,
        eventType: "gamification.xp.awarded.v1",
        entityType: "xp_ledger_entry",
        entityId: entry.id,
        payload: {
          customerId: customer.id,
          xp: input.xp,
          totalXp: nextXp,
          level: nextLevel?.level ?? 0,
        },
      });
      return { entry, totalXp: nextXp, level: nextLevel, idempotent: false };
    });
  }

  reverse(entryId: string, idempotencyKey: string, reason: string) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const source = await transaction.xpLedgerEntry.findUnique({ where: { id: entryId } });
      if (!source || !this.context.canAccessOrganization(source.organizationId)) return null;
      await this.lockCustomer(transaction, tenantId, source.customerId);
      const replay = await transaction.xpLedgerEntry.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      });
      if (replay) return this.xpResult(transaction, replay, true);
      if (source.type === XpEntryType.REVERSE || source.sourceEntryId) {
        throw new BadRequestException("A reversal cannot be reversed");
      }
      const existing = await transaction.xpLedgerEntry.findFirst({
        where: { sourceEntryId: source.id },
      });
      if (existing) throw new ConflictException("XP entry has already been reversed");

      const currentXp = await this.sumXp(transaction, source.customerId);
      const nextXp = currentXp - source.xp;
      if (nextXp < 0) throw new ConflictException("XP reversal would create a negative balance");
      const previousLevel = await this.levelForXp(transaction, currentXp);
      const nextLevel = await this.levelForXp(transaction, nextXp);
      const reversal = await transaction.xpLedgerEntry.create({
        data: {
          tenantId,
          organizationId: source.organizationId,
          customerId: source.customerId,
          type: XpEntryType.REVERSE,
          xp: -source.xp,
          idempotencyKey,
          sourceEntryId: source.id,
          referenceType: "xp_reversal",
          referenceId: source.id,
          metadata: { reason },
          ...(request.actorId ? { createdByUserId: request.actorId } : {}),
        },
      });
      await this.updateProfileAndLevel(
        transaction,
        source.customerId,
        source.organizationId,
        nextXp,
        previousLevel,
        nextLevel,
        idempotencyKey,
        true,
      );
      await appendDomainChange(transaction, tenantId, request, {
        action: "gamification.xp.reverse",
        eventType: "gamification.xp.reversed.v1",
        entityType: "xp_ledger_entry",
        entityId: reversal.id,
        payload: { sourceEntryId: source.id, customerId: source.customerId, totalXp: nextXp },
      });
      return { entry: reversal, totalXp: nextXp, level: nextLevel, idempotent: false };
    });
  }

  profile(customerId: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const customer = await transaction.customer.findUnique({ where: { id: customerId } });
      if (!customer || !this.canReadCustomer(customer)) return null;
      const profile = await transaction.customerGamificationProfile.findUnique({
        where: { tenantId_customerId: { tenantId, customerId } },
        include: { currentLevel: true },
      });
      const nextLevel = await transaction.levelDefinition.findFirst({
        where: {
          tenantId,
          status: GamificationStatus.ACTIVE,
          xpThreshold: { gt: profile?.totalXp ?? 0 },
        },
        orderBy: { xpThreshold: "asc" },
      });
      return {
        customer: { id: customer.id, displayName: customer.displayName },
        profile: profile ?? {
          customerId,
          totalXp: 0,
          currentLevel: null,
          leaderboardOptOut: false,
          anonymizeOnLeaderboard: false,
        },
        nextLevel,
      };
    });
  }

  updatePrivacy(input: PrivacyUpdate) {
    const tenantId = this.context.tenantId();
    const principal = this.context.authenticatedPrincipal();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const customer = await transaction.customer.findUnique({ where: { id: input.customerId } });
      if (
        !customer ||
        (!principal.permissions.includes("gamification.manage") &&
          customer.userId !== principal.userId)
      ) {
        return null;
      }
      const profile = await transaction.customerGamificationProfile.upsert({
        where: { tenantId_customerId: { tenantId, customerId: customer.id } },
        update: {
          leaderboardOptOut: input.leaderboardOptOut,
          anonymizeOnLeaderboard: input.anonymizeOnLeaderboard,
          ...(input.leaderboardAlias
            ? { leaderboardAlias: input.leaderboardAlias }
            : { leaderboardAlias: null }),
        },
        create: {
          tenantId,
          organizationId: customer.organizationId,
          customerId: customer.id,
          leaderboardOptOut: input.leaderboardOptOut,
          anonymizeOnLeaderboard: input.anonymizeOnLeaderboard,
          ...(input.leaderboardAlias ? { leaderboardAlias: input.leaderboardAlias } : {}),
        },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "gamification.privacy.update",
        eventType: "gamification.privacy.updated.v1",
        entityType: "customer_gamification_profile",
        entityId: profile.id,
        payload: {
          leaderboardOptOut: profile.leaderboardOptOut,
          anonymizeOnLeaderboard: profile.anonymizeOnLeaderboard,
        },
      });
      return profile;
    });
  }

  listXp(input: XpList) {
    const tenantId = this.context.tenantId();
    const access = this.context.authenticatedPrincipal().access;
    const where: Prisma.XpLedgerEntryWhereInput = {
      tenantId,
      ...(!access.tenantWide ? { organizationId: { in: [...access.organizationIds] } } : {}),
      ...(input.customerId ? { customerId: input.customerId } : {}),
      ...(input.ruleId ? { ruleId: input.ruleId } : {}),
      ...(input.type ? { type: input.type } : {}),
    };
    return this.transactions.run(tenantId, async (transaction) => {
      const [items, total] = await Promise.all([
        transaction.xpLedgerEntry.findMany({
          where,
          ...pageWindow(input),
          orderBy: { [input.sortBy]: input.sortDirection },
          include: {
            customer: { select: { id: true, displayName: true } },
            rule: { select: { id: true, name: true } },
          },
        }),
        transaction.xpLedgerEntry.count({ where }),
      ]);
      return pageResult(items, total, input);
    });
  }

  private assertOrganization(organizationId: string) {
    if (!this.context.canAccessOrganization(organizationId)) {
      throw new BadRequestException("Organization is outside the authorized boundary");
    }
  }

  private canReadCustomer(customer: { organizationId: string; userId: string | null }) {
    const principal = this.context.authenticatedPrincipal();
    return (
      (this.context.canAccessOrganization(customer.organizationId) &&
        principal.permissions.includes("gamification.read")) ||
      customer.userId === principal.userId
    );
  }

  private async assertLevelThreshold(
    transaction: TenantTransaction,
    level: number,
    threshold: number,
    excludingId?: string,
  ) {
    const tenantId = this.context.tenantId();
    const previous = await transaction.levelDefinition.findFirst({
      where: {
        tenantId,
        level: { lt: level },
        ...(excludingId ? { id: { not: excludingId } } : {}),
      },
      orderBy: { level: "desc" },
    });
    const next = await transaction.levelDefinition.findFirst({
      where: {
        tenantId,
        level: { gt: level },
        ...(excludingId ? { id: { not: excludingId } } : {}),
      },
      orderBy: { level: "asc" },
    });
    if (
      (previous && previous.xpThreshold >= threshold) ||
      (next && next.xpThreshold <= threshold)
    ) {
      throw new BadRequestException("Level XP thresholds must increase monotonically");
    }
  }

  private lockCustomer(transaction: TenantTransaction, tenantId: string, customerId: string) {
    return transaction.$queryRaw`
      SELECT true AS locked
      FROM pg_advisory_xact_lock(hashtextextended(${`${tenantId}:xp:${customerId}`}, 0))
    `;
  }

  private async sumXp(transaction: TenantTransaction, customerId: string) {
    const result = await transaction.xpLedgerEntry.aggregate({
      where: { customerId },
      _sum: { xp: true },
    });
    return result._sum.xp ?? 0;
  }

  private levelForXp(transaction: TenantTransaction, xp: number) {
    return transaction.levelDefinition.findFirst({
      where: {
        status: GamificationStatus.ACTIVE,
        xpThreshold: { lte: xp },
      },
      orderBy: { xpThreshold: "desc" },
    });
  }

  private async updateProfileAndLevel(
    transaction: TenantTransaction,
    customerId: string,
    organizationId: string,
    totalXp: number,
    previousLevel: { id: string; level: number } | null,
    nextLevel: { id: string; level: number } | null,
    idempotencyKey: string,
    authorizedCorrection: boolean,
  ) {
    const tenantId = this.context.tenantId();
    await transaction.customerGamificationProfile.upsert({
      where: { tenantId_customerId: { tenantId, customerId } },
      update: { totalXp, currentLevelId: nextLevel?.id ?? null },
      create: {
        tenantId,
        organizationId,
        customerId,
        totalXp,
        ...(nextLevel ? { currentLevelId: nextLevel.id } : {}),
      },
    });
    if ((previousLevel?.level ?? 0) !== (nextLevel?.level ?? 0) && nextLevel) {
      const history = await transaction.customerLevelHistory.create({
        data: {
          tenantId,
          customerId,
          fromLevel: previousLevel?.level ?? null,
          toLevel: nextLevel.level,
          xpAtChange: totalXp,
          reason: authorizedCorrection ? "authorized_correction" : "automatic_progression",
          authorizedCorrection,
          idempotencyKey: `level:${idempotencyKey}`,
        },
      });
      await appendDomainChange(transaction, tenantId, this.context.current(), {
        action: "gamification.level.reached",
        eventType: "gamification.level.reached.v1",
        entityType: "customer_level_history",
        entityId: history.id,
        payload: { customerId, level: nextLevel.level, totalXp },
      });
    }
  }

  private async xpResult<T extends { customerId: string }>(
    transaction: TenantTransaction,
    entry: T,
    idempotent: boolean,
  ) {
    const totalXp = await this.sumXp(transaction, entry.customerId);
    return { entry, totalXp, level: await this.levelForXp(transaction, totalXp), idempotent };
  }
}
