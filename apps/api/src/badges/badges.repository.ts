import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import {
  BadgeVisibility,
  GamificationStatus,
  type Prisma,
  type TenantTransaction,
} from "@rabbehni/database";
import type { BadgeRarity } from "@rabbehni/database";
import { TenantTransactionService } from "@rabbehni/database/nest";

import { appendDomainChange } from "../common/events/append-domain-change.js";
import { pageResult, pageWindow } from "../common/pagination.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import type { AwardBadge, BadgeCollection, BadgeList } from "./dto.js";

@Injectable()
export class BadgesRepository {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(TenantTransactionService) private readonly transactions: TenantTransactionService,
  ) {}

  createCategory(input: {
    organizationId: string;
    code: string;
    name: string;
    description?: string | undefined;
  }) {
    this.assertOrganization(input.organizationId);
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.badgeCategory.create({
        data: {
          tenantId,
          organizationId: input.organizationId,
          code: input.code,
          name: input.name,
          ...(input.description ? { description: input.description } : {}),
        },
      }),
    );
  }

  listCategories() {
    const tenantId = this.context.tenantId();
    const access = this.context.authenticatedPrincipal().access;
    return this.transactions.run(tenantId, (transaction) =>
      transaction.badgeCategory.findMany({
        where: {
          tenantId,
          ...(!access.tenantWide ? { organizationId: { in: [...access.organizationIds] } } : {}),
        },
        orderBy: { name: "asc" },
      }),
    );
  }

  createBadge(input: {
    organizationId: string;
    categoryId?: string | undefined;
    code: string;
    name: string;
    description?: string | undefined;
    rarity: BadgeRarity;
    visibility: BadgeVisibility;
    status: GamificationStatus;
    iconUrl?: string | undefined;
    metadata: Readonly<Record<string, unknown>>;
  }) {
    this.assertOrganization(input.organizationId);
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      if (input.categoryId) {
        const category = await transaction.badgeCategory.findUnique({
          where: { id: input.categoryId },
        });
        if (!category || category.organizationId !== input.organizationId) {
          throw new BadRequestException("Badge category is outside the organization");
        }
      }
      const badge = await transaction.badge.create({
        data: {
          tenantId,
          organizationId: input.organizationId,
          code: input.code,
          name: input.name,
          rarity: input.rarity,
          visibility: input.visibility,
          status: input.status,
          metadata: input.metadata as Prisma.InputJsonValue,
          ...(input.categoryId ? { categoryId: input.categoryId } : {}),
          ...(input.description ? { description: input.description } : {}),
          ...(input.iconUrl ? { iconUrl: input.iconUrl } : {}),
        },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "gamification.badge.create",
        eventType: "gamification.badge.created.v1",
        entityType: "badge",
        entityId: badge.id,
        payload: { rarity: badge.rarity, visibility: badge.visibility },
      });
      return badge;
    });
  }

  updateBadge(id: string, input: Record<string, unknown>) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const current = await transaction.badge.findUnique({ where: { id } });
      if (!current || !this.context.canAccessOrganization(current.organizationId)) return null;
      const organizationId =
        typeof input.organizationId === "string" ? input.organizationId : current.organizationId;
      this.assertOrganization(organizationId);
      if (typeof input.categoryId === "string") {
        const category = await transaction.badgeCategory.findUnique({
          where: { id: input.categoryId },
        });
        if (!category || category.organizationId !== organizationId) {
          throw new BadRequestException("Badge category is outside the organization");
        }
      }
      const badge = await transaction.badge.update({
        where: { id },
        data: input as Prisma.BadgeUpdateInput,
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "gamification.badge.update",
        eventType: "gamification.badge.updated.v1",
        entityType: "badge",
        entityId: badge.id,
        payload: { status: badge.status },
      });
      return badge;
    });
  }

  listBadges(input: BadgeList) {
    const tenantId = this.context.tenantId();
    const access = this.context.authenticatedPrincipal().access;
    const where: Prisma.BadgeWhereInput = {
      tenantId,
      ...(!access.tenantWide ? { organizationId: { in: [...access.organizationIds] } } : {}),
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.rarity ? { rarity: input.rarity } : {}),
    };
    return this.transactions.run(tenantId, async (transaction) => {
      const [items, total] = await Promise.all([
        transaction.badge.findMany({
          where,
          ...pageWindow(input),
          orderBy: { [input.sortBy]: input.sortDirection },
          include: { category: true, achievementRules: true },
        }),
        transaction.badge.count({ where }),
      ]);
      return pageResult(items, total, input);
    });
  }

  createAchievementRule(input: {
    badgeId: string;
    code: string;
    eventType: string;
    target: number;
    status: GamificationStatus;
    conditions: Readonly<Record<string, unknown>>;
  }) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const badge = await transaction.badge.findUnique({ where: { id: input.badgeId } });
      if (!badge || !this.context.canAccessOrganization(badge.organizationId)) {
        throw new BadRequestException("Badge not found or outside scope");
      }
      const rule = await transaction.achievementRule.create({
        data: {
          tenantId,
          ...input,
          conditions: input.conditions as Prisma.InputJsonValue,
        },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "gamification.achievement_rule.create",
        eventType: "gamification.achievement-rule.created.v1",
        entityType: "achievement_rule",
        entityId: rule.id,
        payload: { badgeId: badge.id, eventType: rule.eventType, target: rule.target },
      });
      return rule;
    });
  }

  award(input: AwardBadge) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, (transaction) =>
      this.awardInTransaction(transaction, tenantId, request, input),
    );
  }

  processAchievementEvent(input: {
    eventId: string;
    eventType: string;
    customerId: string;
    delta: number;
  }) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const customer = await transaction.customer.findUnique({ where: { id: input.customerId } });
      if (!customer || !this.context.canAccessOrganization(customer.organizationId)) return [];
      const rules = await transaction.achievementRule.findMany({
        where: {
          eventType: input.eventType,
          status: GamificationStatus.ACTIVE,
          badge: { organizationId: customer.organizationId },
        },
        include: { badge: true },
      });
      const results = [];
      for (const rule of rules) {
        await transaction.$queryRaw`
          SELECT true AS locked
          FROM pg_advisory_xact_lock(
            hashtextextended(${`${tenantId}:achievement:${rule.id}:${customer.id}`}, 0)
          )
        `;
        const current = await transaction.achievementProgress.findUnique({
          where: {
            tenantId_ruleId_customerId: {
              tenantId,
              ruleId: rule.id,
              customerId: customer.id,
            },
          },
        });
        if (current?.lastEventId === input.eventId) {
          results.push({ ruleId: rule.id, progress: current.progress, idempotent: true });
          continue;
        }
        const progress = Math.min(rule.target, (current?.progress ?? 0) + input.delta);
        const achievement = await transaction.achievementProgress.upsert({
          where: {
            tenantId_ruleId_customerId: {
              tenantId,
              ruleId: rule.id,
              customerId: customer.id,
            },
          },
          update: {
            progress,
            lastEventId: input.eventId,
            ...(progress >= rule.target && !current?.completedAt
              ? { completedAt: new Date() }
              : {}),
          },
          create: {
            tenantId,
            ruleId: rule.id,
            customerId: customer.id,
            progress,
            lastEventId: input.eventId,
            ...(progress >= rule.target ? { completedAt: new Date() } : {}),
          },
        });
        const award =
          progress >= rule.target
            ? await this.awardInTransaction(transaction, tenantId, request, {
                customerId: customer.id,
                badgeId: rule.badgeId,
                idempotencyKey: `achievement:${rule.id}:${customer.id}`,
                metadata: { achievementRuleId: rule.id },
              })
            : null;
        results.push({ ruleId: rule.id, progress: achievement.progress, award });
      }
      return results;
    });
  }

  async awardInTransaction(
    transaction: TenantTransaction,
    tenantId: string,
    request: ReturnType<TenantContextStore["current"]>,
    input: AwardBadge,
  ) {
    const replay = await transaction.customerBadge.findUnique({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: input.idempotencyKey } },
    });
    if (replay) return { award: replay, idempotent: true };
    const [customer, badge] = await Promise.all([
      transaction.customer.findUnique({ where: { id: input.customerId } }),
      transaction.badge.findUnique({ where: { id: input.badgeId } }),
    ]);
    if (
      !customer ||
      !badge ||
      customer.organizationId !== badge.organizationId ||
      badge.status !== GamificationStatus.ACTIVE ||
      !this.context.canAccessOrganization(customer.organizationId)
    ) {
      throw new BadRequestException(
        "Customer and active badge must share an authorized organization",
      );
    }
    const existing = await transaction.customerBadge.findUnique({
      where: {
        tenantId_customerId_badgeId: {
          tenantId,
          customerId: customer.id,
          badgeId: badge.id,
        },
      },
    });
    if (existing && !existing.revokedAt) return { award: existing, idempotent: true };
    if (existing?.revokedAt) {
      throw new ConflictException("A revoked badge requires an explicit authorized restoration");
    }
    const award = await transaction.customerBadge.create({
      data: {
        tenantId,
        customerId: customer.id,
        badgeId: badge.id,
        idempotencyKey: input.idempotencyKey,
        metadata: input.metadata as Prisma.InputJsonValue,
      },
    });
    await appendDomainChange(transaction, tenantId, request, {
      action: "gamification.badge.award",
      eventType: "gamification.badge.earned.v1",
      entityType: "customer_badge",
      entityId: award.id,
      payload: { customerId: customer.id, badgeId: badge.id, rarity: badge.rarity },
    });
    return { award, idempotent: false };
  }

  revoke(id: string, reason: string) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    if (!request.actorId) throw new ConflictException("Badge revocation requires an actor");
    const actorId = request.actorId;
    return this.transactions.run(tenantId, async (transaction) => {
      const current = await transaction.customerBadge.findUnique({
        where: { id },
        include: { badge: true },
      });
      if (!current || !this.context.canAccessOrganization(current.badge.organizationId))
        return null;
      if (current.revokedAt) return current;
      const badge = await transaction.customerBadge.update({
        where: { id },
        data: {
          revokedAt: new Date(),
          revokedByUserId: actorId,
          revocationReason: reason,
        },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "gamification.badge.revoke",
        eventType: "gamification.badge.revoked.v1",
        entityType: "customer_badge",
        entityId: badge.id,
        payload: { reason, customerId: badge.customerId, badgeId: badge.badgeId },
      });
      return badge;
    });
  }

  collection(input: BadgeCollection) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const customer = await transaction.customer.findUnique({ where: { id: input.customerId } });
      if (!customer || !this.canReadCustomer(customer)) return null;
      const [badges, progress] = await Promise.all([
        transaction.badge.findMany({
          where: {
            tenantId,
            organizationId: customer.organizationId,
            status: GamificationStatus.ACTIVE,
            ...(this.isSelf(customer) ? {} : { visibility: BadgeVisibility.VISIBLE }),
          },
          include: {
            customers: { where: { customerId: customer.id } },
            achievementRules: true,
          },
          orderBy: { name: "asc" },
        }),
        transaction.achievementProgress.findMany({
          where: { customerId: customer.id },
        }),
      ]);
      const progressByRule = new Map(progress.map((item) => [item.ruleId, item]));
      const items = badges
        .map((badge) => {
          const award = badge.customers[0];
          const rule = badge.achievementRules[0];
          const achievement = rule ? progressByRule.get(rule.id) : undefined;
          return {
            ...badge,
            customers: undefined,
            achievementRules: undefined,
            earned: Boolean(award && !award.revokedAt),
            earnedAt: award?.earnedAt ?? null,
            progress: achievement?.progress ?? (award ? 100 : 0),
            target: rule?.target ?? 100,
          };
        })
        .filter((item) => input.includeLocked || item.earned);
      const start = (input.page - 1) * input.pageSize;
      return pageResult(items.slice(start, start + input.pageSize), items.length, input);
    });
  }

  private assertOrganization(organizationId: string) {
    if (!this.context.canAccessOrganization(organizationId)) {
      throw new BadRequestException("Organization is outside the authorized boundary");
    }
  }

  private isSelf(customer: { userId: string | null }) {
    return customer.userId === this.context.authenticatedPrincipal().userId;
  }

  private canReadCustomer(customer: { organizationId: string; userId: string | null }) {
    const principal = this.context.authenticatedPrincipal();
    return (
      (principal.permissions.includes("badge.read") &&
        this.context.canAccessOrganization(customer.organizationId)) ||
      this.isSelf(customer)
    );
  }
}
