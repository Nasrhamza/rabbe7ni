import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  SegmentMembershipAction,
  SegmentType,
  type MarketingStatus,
  type Prisma,
  type TenantTransaction,
} from "@rabbehni/database";
import { TenantTransactionService } from "@rabbehni/database/nest";

import { appendDomainChange } from "../common/events/append-domain-change.js";
import { pageResult, pageWindow } from "../common/pagination.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import type { SegmentList, SegmentRule } from "./dto.js";
import { consentAllowsMarketing, evaluateSegmentRule, type SegmentFacts } from "./rule-engine.js";

type SegmentInput = {
  organizationId: string;
  code: string;
  name: string;
  description?: string | undefined;
  type: SegmentType;
  status: MarketingStatus;
  rules: SegmentRule;
  schedule?: string | undefined;
  timezone: string;
};
type SegmentUpdate = { [Key in keyof SegmentInput]?: SegmentInput[Key] | undefined };

@Injectable()
export class SegmentsRepository {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(TenantTransactionService) private readonly transactions: TenantTransactionService,
  ) {}

  list(input: SegmentList) {
    const tenantId = this.context.tenantId();
    const access = this.context.authenticatedPrincipal().access;
    const where = {
      tenantId,
      ...(!access.tenantWide ? { organizationId: { in: [...access.organizationIds] } } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.type ? { type: input.type } : {}),
      ...(input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: "insensitive" as const } },
              { code: { contains: input.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    return this.transactions.run(tenantId, async (transaction) => {
      const [items, total] = await Promise.all([
        transaction.customerSegment.findMany({
          where,
          ...pageWindow(input),
          orderBy: { [input.sortBy]: input.sortDirection },
          include: { _count: { select: { memberships: true, campaignSegments: true } } },
        }),
        transaction.customerSegment.count({ where }),
      ]);
      return pageResult(items, total, input);
    });
  }

  get(id: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const segment = await transaction.customerSegment.findUnique({
        where: { id },
        include: {
          memberships: {
            take: 100,
            orderBy: { joinedAt: "desc" },
            include: { customer: { select: { id: true, displayName: true, email: true } } },
          },
          membershipHistory: { take: 100, orderBy: { occurredAt: "desc" } },
          _count: { select: { memberships: true, campaignSegments: true } },
        },
      });
      return segment && this.context.canAccessOrganization(segment.organizationId) ? segment : null;
    });
  }

  create(input: SegmentInput) {
    this.assertOrganization(input.organizationId);
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      try {
        const segment = await transaction.customerSegment.create({
          data: {
            tenantId,
            organizationId: input.organizationId,
            code: input.code,
            name: input.name,
            type: input.type,
            status: input.status,
            timezone: input.timezone,
            rules: input.rules as Prisma.InputJsonValue,
            ...(input.description ? { description: input.description } : {}),
            ...(input.schedule ? { schedule: input.schedule } : {}),
          } as Prisma.CustomerSegmentUncheckedCreateInput,
        });
        await appendDomainChange(transaction, tenantId, request, {
          action: "segment.create",
          eventType: "marketing.segment.created.v1",
          entityType: "customer_segment",
          entityId: segment.id,
          payload: { type: segment.type, status: segment.status },
        });
        return segment;
      } catch (error) {
        if (this.isUniqueViolation(error))
          throw new ConflictException("Segment code already exists");
        throw error;
      }
    });
  }

  update(id: string, input: SegmentUpdate) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const current = await transaction.customerSegment.findUnique({ where: { id } });
      if (!current || !this.context.canAccessOrganization(current.organizationId)) return null;
      if (input.organizationId) this.assertOrganization(input.organizationId);
      const segment = await transaction.customerSegment.update({
        where: { id },
        data: {
          ...input,
          ...(input.rules ? { rules: input.rules as Prisma.InputJsonValue } : {}),
        } as Prisma.CustomerSegmentUncheckedUpdateInput,
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "segment.update",
        eventType: "marketing.segment.updated.v1",
        entityType: "customer_segment",
        entityId: segment.id,
        payload: { type: segment.type, status: segment.status },
      });
      return segment;
    });
  }

  preview(organizationId: string, rules: SegmentRule, limit: number) {
    this.assertOrganization(organizationId);
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const matches = await this.matchingCustomers(transaction, organizationId, rules);
      return {
        estimatedSize: matches.length,
        sample: matches.slice(0, limit).map(({ customer }) => ({
          id: customer.id,
          displayName: customer.displayName,
          email: customer.email,
          locale: customer.locale,
          status: customer.status,
        })),
      };
    });
  }

  refresh(id: string) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${tenantId}:segment:${id}`}))`;
      const segment = await transaction.customerSegment.findUnique({ where: { id } });
      if (!segment || !this.context.canAccessOrganization(segment.organizationId)) return null;
      if (segment.type !== SegmentType.DYNAMIC) {
        throw new BadRequestException("Only dynamic segments can be recalculated");
      }
      const matches = await this.matchingCustomers(
        transaction,
        segment.organizationId,
        segment.rules as unknown as SegmentRule,
      );
      const next = new Set(matches.map(({ customer }) => customer.id));
      const current = await transaction.segmentMembership.findMany({
        where: { segmentId: id },
        select: { customerId: true },
      });
      const previous = new Set(current.map(({ customerId }) => customerId));
      const joined = [...next].filter((customerId) => !previous.has(customerId));
      const left = [...previous].filter((customerId) => !next.has(customerId));

      if (joined.length > 0) {
        await transaction.segmentMembership.createMany({
          data: joined.map((customerId) => ({
            tenantId,
            segmentId: id,
            customerId,
            source: "RULE",
          })),
          skipDuplicates: true,
        });
      }
      if (left.length > 0) {
        await transaction.segmentMembership.deleteMany({
          where: { segmentId: id, customerId: { in: left } },
        });
      }
      if (joined.length + left.length > 0) {
        await transaction.segmentMembershipHistory.createMany({
          data: [
            ...joined.map((customerId) => ({
              tenantId,
              segmentId: id,
              customerId,
              action: SegmentMembershipAction.JOINED,
              reason: "DYNAMIC_REFRESH",
            })),
            ...left.map((customerId) => ({
              tenantId,
              segmentId: id,
              customerId,
              action: SegmentMembershipAction.LEFT,
              reason: "DYNAMIC_REFRESH",
            })),
          ],
        });
      }
      const refreshed = await transaction.customerSegment.update({
        where: { id },
        data: { estimatedSize: next.size, lastRefreshedAt: new Date() },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "segment.refresh",
        eventType: "marketing.segment.refreshed.v1",
        entityType: "customer_segment",
        entityId: id,
        payload: { size: next.size, joined: joined.length, left: left.length },
      });
      return { segment: refreshed, joined: joined.length, left: left.length };
    });
  }

  replaceStaticMembers(id: string, customerIds: readonly string[]) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const segment = await transaction.customerSegment.findUnique({ where: { id } });
      if (!segment || !this.context.canAccessOrganization(segment.organizationId)) return null;
      if (segment.type !== SegmentType.STATIC) {
        throw new BadRequestException("Only static segment membership can be edited manually");
      }
      const validCustomers = await transaction.customer.findMany({
        where: { id: { in: [...customerIds] }, organizationId: segment.organizationId },
        select: { id: true },
      });
      if (validCustomers.length !== new Set(customerIds).size) {
        throw new BadRequestException("One or more customers are outside the segment organization");
      }
      const existing = await transaction.segmentMembership.findMany({
        where: { segmentId: id },
        select: { customerId: true },
      });
      const next = new Set(customerIds);
      const previous = new Set(existing.map(({ customerId }) => customerId));
      const joined = [...next].filter((customerId) => !previous.has(customerId));
      const left = [...previous].filter((customerId) => !next.has(customerId));
      await transaction.segmentMembership.deleteMany({ where: { segmentId: id } });
      if (next.size > 0) {
        await transaction.segmentMembership.createMany({
          data: [...next].map((customerId) => ({
            tenantId,
            segmentId: id,
            customerId,
            source: "STATIC",
          })),
        });
      }
      if (joined.length + left.length > 0) {
        await transaction.segmentMembershipHistory.createMany({
          data: [
            ...joined.map((customerId) => ({
              tenantId,
              segmentId: id,
              customerId,
              action: SegmentMembershipAction.JOINED,
              reason: "MANUAL_REPLACE",
            })),
            ...left.map((customerId) => ({
              tenantId,
              segmentId: id,
              customerId,
              action: SegmentMembershipAction.LEFT,
              reason: "MANUAL_REPLACE",
            })),
          ],
        });
      }
      const updated = await transaction.customerSegment.update({
        where: { id },
        data: { estimatedSize: next.size, lastRefreshedAt: new Date() },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "segment.members.replace",
        eventType: "marketing.segment.refreshed.v1",
        entityType: "customer_segment",
        entityId: id,
        payload: { size: next.size, joined: joined.length, left: left.length },
      });
      return updated;
    });
  }

  private async matchingCustomers(
    transaction: TenantTransaction,
    organizationId: string,
    rules: SegmentRule,
  ) {
    const customers = await transaction.customer.findMany({
      where: { organizationId, status: { not: "ARCHIVED" } },
      include: {
        activities: { orderBy: { occurredAt: "desc" }, take: 200 },
        pointsEntries: {
          select: { points: true, merchantId: true, branchId: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
        rewardRedemptions: { select: { id: true } },
        qrTransactions: {
          select: { id: true, merchantId: true, branchId: true, occurredAt: true },
          orderBy: { occurredAt: "desc" },
        },
        gamificationProfile: { include: { currentLevel: true } },
        challengeEnrollments: { where: { status: "COMPLETED" }, select: { id: true } },
        badges: { where: { revokedAt: null }, select: { id: true } },
        customerStreaks: { select: { currentStreak: true } },
      },
    });
    const now = Date.now();
    return customers
      .filter((customer) =>
        consentAllowsMarketing(customer.consents, customer.communicationPreferences),
      )
      .map((customer) => {
        const latestActivity = customer.activities[0]?.occurredAt;
        const latestPoint = customer.pointsEntries[0];
        const latestQr = customer.qrTransactions[0];
        const lastAt =
          latestActivity && latestActivity > (latestQr?.occurredAt ?? new Date(0))
            ? latestActivity
            : (latestQr?.occurredAt ?? customer.createdAt);
        const age = customer.birthDate
          ? Math.max(
              0,
              Math.floor((now - customer.birthDate.getTime()) / (365.2425 * 24 * 60 * 60 * 1000)),
            )
          : null;
        const facts: SegmentFacts = {
          "profile.locale": customer.locale,
          "profile.status": customer.status,
          "profile.country": customer.locale.split("-")[1] ?? null,
          "profile.age": age,
          "scope.branchId": latestPoint?.branchId ?? latestQr?.branchId ?? null,
          "scope.merchantId": latestPoint?.merchantId ?? latestQr?.merchantId ?? null,
          "loyalty.balance": customer.pointsEntries.reduce((sum, entry) => sum + entry.points, 0),
          "reward.redemptions": customer.rewardRedemptions.length,
          "qr.transactions": customer.qrTransactions.length,
          "behavior.purchases": customer.activities.filter((item) => item.type === "purchase")
            .length,
          "behavior.visits": customer.activities.filter((item) =>
            ["visit", "check_in", "qr.scan"].includes(item.type),
          ).length,
          "gamification.challenges": customer.challengeEnrollments.length,
          "gamification.badges": customer.badges.length,
          "gamification.xp": customer.gamificationProfile?.totalXp ?? 0,
          "gamification.level": customer.gamificationProfile?.currentLevel?.level ?? 0,
          "gamification.streak": Math.max(
            0,
            ...customer.customerStreaks.map(({ currentStreak }) => currentStreak),
          ),
          "activity.daysSinceLast": Math.floor((now - lastAt.getTime()) / 86_400_000),
          "activity.inactiveDays": Math.floor((now - lastAt.getTime()) / 86_400_000),
        };
        return { customer, facts };
      })
      .filter(({ facts }) => evaluateSegmentRule(rules, facts));
  }

  private assertOrganization(organizationId: string): void {
    if (!this.context.canAccessOrganization(organizationId)) {
      throw new NotFoundException("Organization not found or outside scope");
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    );
  }
}
