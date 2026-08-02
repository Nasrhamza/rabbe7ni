import { Inject, Injectable } from "@nestjs/common";
import { OrganizationStatus, type Prisma } from "@rabbehni/database";
import { TenantTransactionService } from "@rabbehni/database/nest";

import { appendDomainChange } from "../common/events/append-domain-change.js";
import { pageResult, pageWindow } from "../common/pagination.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import type {
  CreateOrganizationDto,
  OrganizationList,
  UpdateOrganizationDto,
  UpdateOrganizationSettingsDto,
} from "./dto.js";

@Injectable()
export class OrganizationsRepository {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(TenantTransactionService)
    private readonly transactions: TenantTransactionService,
  ) {}

  create(input: CreateOrganizationDto) {
    const request = this.context.current();
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const organization = await transaction.organization.create({
        data: {
          tenantId,
          code: input.code,
          legalName: input.legalName,
          displayName: input.displayName,
          countryCode: input.countryCode,
          timezone: input.timezone,
          status: input.status ?? OrganizationStatus.DRAFT,
          settings: (input.settings ?? {}) as Prisma.InputJsonValue,
          ...(input.registrationNumber ? { registrationNumber: input.registrationNumber } : {}),
          ...(input.taxIdentifier ? { taxIdentifier: input.taxIdentifier } : {}),
          ...(input.status === OrganizationStatus.ACTIVE ? { activatedAt: new Date() } : {}),
        },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "organization.create",
        eventType: "organizations.organization.created.v1",
        entityType: "organization",
        entityId: organization.id,
        payload: { code: organization.code, status: organization.status },
      });
      return organization;
    });
  }

  list(input: OrganizationList) {
    const tenantId = this.context.tenantId();
    const principal = this.context.authenticatedPrincipal();
    const window = pageWindow(input);
    const where: Prisma.OrganizationWhereInput = {
      tenantId,
      ...(!principal.access.tenantWide
        ? { id: { in: [...principal.access.organizationIds] } }
        : {}),
      ...(!input.includeArchived ? { status: { not: OrganizationStatus.ARCHIVED } } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.search
        ? {
            OR: [
              { code: { contains: input.search, mode: "insensitive" } },
              { displayName: { contains: input.search, mode: "insensitive" } },
              { legalName: { contains: input.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    return this.transactions.run(tenantId, async (transaction) => {
      const [items, total] = await Promise.all([
        transaction.organization.findMany({
          where,
          ...window,
          orderBy: { [input.sortBy]: input.sortDirection },
        }),
        transaction.organization.count({ where }),
      ]);
      return pageResult(items, total, input);
    });
  }

  findById(id: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.organization.findFirst({
        where: {
          ...(this.context.authenticatedPrincipal().access.tenantWide
            ? { id }
            : {
                AND: [
                  { id },
                  {
                    id: {
                      in: [...this.context.authenticatedPrincipal().access.organizationIds],
                    },
                  },
                ],
              }),
        },
        include: {
          _count: {
            select: { franchises: true, merchants: true, branches: true, staff: true },
          },
        },
      }),
    );
  }

  update(id: string, input: UpdateOrganizationDto) {
    const data = Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    ) as Prisma.OrganizationUpdateInput;
    if (input.settings) data.settings = input.settings as Prisma.InputJsonValue;
    return this.mutate(id, "organization.update", "organizations.organization.updated.v1", data);
  }

  updateSettings(id: string, input: UpdateOrganizationSettingsDto) {
    return this.mutate(
      id,
      "organization.settings.update",
      "organizations.organization.settings-updated.v1",
      { settings: input.settings as Prisma.InputJsonValue },
    );
  }

  changeStatus(id: string, status: OrganizationStatus) {
    const now = new Date();
    return this.mutate(
      id,
      `organization.${status.toLowerCase()}`,
      "organizations.organization.status-changed.v1",
      {
        status,
        ...(status === OrganizationStatus.ACTIVE
          ? { activatedAt: now, suspendedAt: null }
          : status === OrganizationStatus.SUSPENDED
            ? { suspendedAt: now }
            : {}),
      },
    );
  }

  archive(id: string) {
    return this.mutate(id, "organization.archive", "organizations.organization.archived.v1", {
      status: OrganizationStatus.ARCHIVED,
      archivedAt: new Date(),
    });
  }

  private mutate(
    id: string,
    action: string,
    eventType: string,
    data: Prisma.OrganizationUpdateInput,
  ) {
    const request = this.context.current();
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const principal = this.context.authenticatedPrincipal();
      const existing = await transaction.organization.findFirst({
        where: {
          ...(principal.access.tenantWide
            ? { id }
            : { AND: [{ id }, { id: { in: [...principal.access.organizationIds] } }] }),
        },
      });
      if (!existing) {
        return null;
      }
      const organization = await transaction.organization.update({ where: { id }, data });
      await appendDomainChange(transaction, tenantId, request, {
        action,
        eventType,
        entityType: "organization",
        entityId: id,
        payload: { previousStatus: existing.status, status: organization.status },
      });
      return organization;
    });
  }
}
