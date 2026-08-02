import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CampaignMetricType, CampaignStatus, type Prisma } from "@rabbehni/database";
import { TenantTransactionService } from "@rabbehni/database/nest";
import { randomUUID } from "node:crypto";

import { appendDomainChange } from "../common/events/append-domain-change.js";
import { pageResult, pageWindow } from "../common/pagination.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import type { CampaignCreate, CampaignList, CampaignUpdate } from "./dto.js";

const transitions: Readonly<Record<CampaignStatus, readonly CampaignStatus[]>> = {
  DRAFT: [CampaignStatus.REVIEW, CampaignStatus.ARCHIVED],
  REVIEW: [CampaignStatus.APPROVED, CampaignStatus.DRAFT, CampaignStatus.CANCELLED],
  APPROVED: [CampaignStatus.SCHEDULED, CampaignStatus.CANCELLED],
  SCHEDULED: [CampaignStatus.RUNNING, CampaignStatus.PAUSED, CampaignStatus.CANCELLED],
  RUNNING: [CampaignStatus.PAUSED, CampaignStatus.COMPLETED, CampaignStatus.CANCELLED],
  PAUSED: [CampaignStatus.SCHEDULED, CampaignStatus.RUNNING, CampaignStatus.CANCELLED],
  COMPLETED: [CampaignStatus.ARCHIVED],
  CANCELLED: [CampaignStatus.ARCHIVED],
  ARCHIVED: [],
};

@Injectable()
export class CampaignsRepository {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(TenantTransactionService) private readonly transactions: TenantTransactionService,
  ) {}

  list(input: CampaignList) {
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
        transaction.campaign.findMany({
          where,
          ...pageWindow(input),
          orderBy: { [input.sortBy]: input.sortDirection },
          include: {
            segments: { include: { segment: { select: { id: true, name: true } } } },
            _count: { select: { deliveries: true, metrics: true } },
          },
        }),
        transaction.campaign.count({ where }),
      ]);
      return pageResult(items, total, input);
    });
  }

  get(id: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const campaign = await transaction.campaign.findUnique({
        where: { id },
        include: {
          segments: { include: { segment: true } },
          applicability: true,
          metrics: { orderBy: { occurredAt: "desc" }, take: 100 },
          _count: { select: { deliveries: true } },
        },
      });
      return campaign && this.context.canAccessOrganization(campaign.organizationId)
        ? campaign
        : null;
    });
  }

  create(input: CampaignCreate) {
    this.assertOrganization(input.organizationId);
    this.assertTimezone(input.timezone);
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      await this.validateTargets(
        transaction,
        input.organizationId,
        input.segmentIds,
        input.applicability,
      );
      try {
        const created = await transaction.campaign.create({
          data: {
            tenantId,
            organizationId: input.organizationId,
            code: input.code,
            name: input.name,
            type: input.type,
            timezone: input.timezone,
            frequencyCap: input.frequencyCap,
            frequencyWindowHours: input.frequencyWindowHours,
            requiresApproval: input.requiresApproval,
            settings: input.settings as Prisma.InputJsonValue,
            ...(input.description ? { description: input.description } : {}),
            ...(input.startsAt ? { startsAt: input.startsAt } : {}),
            ...(input.endsAt ? { endsAt: input.endsAt } : {}),
          },
        });
        await transaction.campaignSegment.createMany({
          data: input.segmentIds.map((segmentId) => ({
            tenantId,
            campaignId: created.id,
            segmentId,
          })),
        });
        if (input.applicability.length > 0) {
          await transaction.campaignApplicability.createMany({
            data: input.applicability.map((scope) => ({
              tenantId,
              campaignId: created.id,
              ...(scope.organizationId ? { organizationId: scope.organizationId } : {}),
              ...(scope.franchiseId ? { franchiseId: scope.franchiseId } : {}),
              ...(scope.merchantId ? { merchantId: scope.merchantId } : {}),
              ...(scope.branchId ? { branchId: scope.branchId } : {}),
            })),
          });
        }
        const campaign = await transaction.campaign.findUniqueOrThrow({
          where: { id: created.id },
          include: { segments: true, applicability: true },
        });
        await appendDomainChange(transaction, tenantId, request, {
          action: "campaign.create",
          eventType: "marketing.campaign.created.v1",
          entityType: "campaign",
          entityId: campaign.id,
          payload: { type: campaign.type, status: campaign.status },
        });
        return campaign;
      } catch (error) {
        if (this.isUniqueViolation(error)) {
          throw new ConflictException("Campaign code already exists");
        }
        throw error;
      }
    });
  }

  duplicate(id: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const source = await transaction.campaign.findUnique({
        where: { id },
        include: { segments: true, applicability: true },
      });
      if (!source || !this.context.canAccessOrganization(source.organizationId)) return null;
      const suffix = randomUUID().slice(0, 8);
      const campaign = await transaction.campaign.create({
        data: {
          tenantId,
          organizationId: source.organizationId,
          code: `${source.code}-COPY-${suffix}`.slice(0, 80),
          name: `${source.name} (copy)`,
          description: source.description,
          type: source.type,
          status: CampaignStatus.DRAFT,
          timezone: source.timezone,
          frequencyCap: source.frequencyCap,
          frequencyWindowHours: source.frequencyWindowHours,
          requiresApproval: source.requiresApproval,
          settings: source.settings as Prisma.InputJsonValue,
        },
      });
      if (source.segments.length > 0) {
        await transaction.campaignSegment.createMany({
          data: source.segments.map(({ segmentId }) => ({
            tenantId,
            campaignId: campaign.id,
            segmentId,
          })),
        });
      }
      if (source.applicability.length > 0) {
        await transaction.campaignApplicability.createMany({
          data: source.applicability.map(
            ({ organizationId, franchiseId, merchantId, branchId }) => ({
              tenantId,
              campaignId: campaign.id,
              organizationId,
              franchiseId,
              merchantId,
              branchId,
            }),
          ),
        });
      }
      return transaction.campaign.findUniqueOrThrow({
        where: { id: campaign.id },
        include: { segments: true, applicability: true },
      });
    });
  }

  update(id: string, input: CampaignUpdate) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const current = await transaction.campaign.findUnique({ where: { id } });
      if (!current || !this.context.canAccessOrganization(current.organizationId)) return null;
      if (current.status !== CampaignStatus.DRAFT && current.status !== CampaignStatus.REVIEW) {
        throw new BadRequestException("Only draft or review campaigns can be edited");
      }
      const organizationId = input.organizationId ?? current.organizationId;
      this.assertOrganization(organizationId);
      if (input.timezone) this.assertTimezone(input.timezone);
      await this.validateTargets(
        transaction,
        organizationId,
        input.segmentIds ?? [],
        input.applicability ?? [],
        input.segmentIds === undefined,
        input.applicability === undefined,
      );
      const { segmentIds, applicability, settings, ...scalar } = input;
      await transaction.campaign.update({
        where: { id },
        data: {
          ...scalar,
          ...(settings ? { settings: settings as Prisma.InputJsonValue } : {}),
        } as Prisma.CampaignUncheckedUpdateInput,
      });
      if (segmentIds) {
        await transaction.campaignSegment.deleteMany({ where: { campaignId: id } });
        await transaction.campaignSegment.createMany({
          data: segmentIds.map((segmentId) => ({ tenantId, campaignId: id, segmentId })),
        });
      }
      if (applicability) {
        await transaction.campaignApplicability.deleteMany({ where: { campaignId: id } });
        await transaction.campaignApplicability.createMany({
          data: applicability.map((scope) => ({
            tenantId,
            campaignId: id,
            ...(scope.organizationId ? { organizationId: scope.organizationId } : {}),
            ...(scope.franchiseId ? { franchiseId: scope.franchiseId } : {}),
            ...(scope.merchantId ? { merchantId: scope.merchantId } : {}),
            ...(scope.branchId ? { branchId: scope.branchId } : {}),
          })),
        });
      }
      const campaign = await transaction.campaign.findUniqueOrThrow({
        where: { id },
        include: { segments: true, applicability: true },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "campaign.update",
        eventType: "marketing.campaign.updated.v1",
        entityType: "campaign",
        entityId: id,
        payload: { status: campaign.status },
      });
      return campaign;
    });
  }

  transition(id: string, next: CampaignStatus) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${tenantId}:campaign:${id}`}))`;
      const current = await transaction.campaign.findUnique({ where: { id } });
      if (!current || !this.context.canAccessOrganization(current.organizationId)) return null;
      if (!transitions[current.status].includes(next)) {
        throw new BadRequestException(`Invalid campaign transition: ${current.status} -> ${next}`);
      }
      if (next === CampaignStatus.APPROVED && current.requiresApproval) {
        const principal = this.context.authenticatedPrincipal();
        if (!principal.permissions.includes("campaign.approve")) {
          throw new BadRequestException("Campaign approval permission is required");
        }
      }
      const now = new Date();
      const campaign = await transaction.campaign.update({
        where: { id },
        data: {
          status: next,
          ...(next === CampaignStatus.APPROVED
            ? { approvedAt: now, approvedById: request.actorId }
            : {}),
          ...(next === CampaignStatus.ARCHIVED ? { archivedAt: now } : {}),
        },
      });
      const eventType =
        next === CampaignStatus.RUNNING
          ? "marketing.campaign.started.v1"
          : next === CampaignStatus.COMPLETED
            ? "marketing.campaign.completed.v1"
            : "marketing.campaign.status-changed.v1";
      await appendDomainChange(transaction, tenantId, request, {
        action: `campaign.${next.toLowerCase()}`,
        eventType,
        entityType: "campaign",
        entityId: id,
        payload: { from: current.status, to: next },
      });
      return campaign;
    });
  }

  schedule(id: string, startsAt: Date, endsAt: Date | undefined, timezone: string) {
    this.assertTimezone(timezone);
    if (startsAt <= new Date())
      throw new BadRequestException("Campaign start must be in the future");
    if (endsAt && endsAt <= startsAt) {
      throw new BadRequestException("Campaign end must be after campaign start");
    }
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const current = await transaction.campaign.findUnique({ where: { id } });
      if (!current || !this.context.canAccessOrganization(current.organizationId)) return null;
      if (current.status !== CampaignStatus.APPROVED && current.status !== CampaignStatus.PAUSED) {
        throw new BadRequestException("Campaign must be approved or paused before scheduling");
      }
      const campaign = await transaction.campaign.update({
        where: { id },
        data: {
          startsAt,
          timezone,
          status: CampaignStatus.SCHEDULED,
          ...(endsAt ? { endsAt } : {}),
        },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "campaign.schedule",
        eventType: "marketing.campaign.scheduled.v1",
        entityType: "campaign",
        entityId: id,
        payload: { startsAt: startsAt.toISOString(), timezone },
      });
      return campaign;
    });
  }

  metrics(id: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const campaign = await transaction.campaign.findUnique({ where: { id } });
      if (!campaign || !this.context.canAccessOrganization(campaign.organizationId)) return null;
      const grouped = await transaction.campaignMetric.groupBy({
        by: ["type"],
        where: { campaignId: id },
        _sum: { value: true },
      });
      return Object.fromEntries(
        Object.values(CampaignMetricType).map((type) => [
          type.toLowerCase(),
          grouped.find((item) => item.type === type)?._sum.value ?? 0,
        ]),
      );
    });
  }

  recordMetric(
    campaignId: string,
    type: CampaignMetricType,
    eventId: string,
    customerId?: string,
    metadata: Readonly<Record<string, unknown>> = {},
  ) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.campaignMetric.upsert({
        where: {
          tenantId_campaignId_type_eventId: { tenantId, campaignId, type, eventId },
        },
        update: {},
        create: {
          tenantId,
          campaignId,
          type,
          eventId,
          ...(customerId ? { customerId } : {}),
          metadata: metadata as Prisma.InputJsonValue,
        },
      }),
    );
  }

  private async validateTargets(
    transaction: Parameters<Parameters<TenantTransactionService["run"]>[1]>[0],
    organizationId: string,
    segmentIds: readonly string[],
    scopes: readonly {
      organizationId?: string | undefined;
      franchiseId?: string | undefined;
      merchantId?: string | undefined;
      branchId?: string | undefined;
    }[],
    skipSegments = false,
    skipScopes = false,
  ): Promise<void> {
    const tenantId = this.context.tenantId();
    if (!skipSegments) {
      const count = await transaction.customerSegment.count({
        where: { id: { in: [...segmentIds] }, organizationId },
      });
      if (count !== new Set(segmentIds).size) {
        throw new BadRequestException("One or more segments are outside the campaign organization");
      }
    }
    if (skipScopes || scopes.length === 0) return;
    for (const scope of scopes) {
      const valid = scope.organizationId
        ? await transaction.organization.count({ where: { id: scope.organizationId, tenantId } })
        : scope.franchiseId
          ? await transaction.franchise.count({ where: { id: scope.franchiseId, organizationId } })
          : scope.merchantId
            ? await transaction.merchant.count({ where: { id: scope.merchantId, organizationId } })
            : scope.branchId
              ? await transaction.branch.count({ where: { id: scope.branchId, organizationId } })
              : 0;
      if (valid !== 1) {
        throw new BadRequestException("Campaign applicability is outside tenant or organization");
      }
    }
  }

  private assertOrganization(organizationId: string): void {
    if (!this.context.canAccessOrganization(organizationId)) {
      throw new NotFoundException("Organization not found or outside scope");
    }
  }

  private assertTimezone(timezone: string): void {
    try {
      new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
    } catch {
      throw new BadRequestException("Invalid IANA timezone");
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
