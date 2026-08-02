import { Inject, Injectable } from "@nestjs/common";
import { FranchiseStatus, type Prisma } from "@rabbehni/database";
import { TenantTransactionService } from "@rabbehni/database/nest";

import { appendDomainChange } from "../common/events/append-domain-change.js";
import { pageResult, pageWindow } from "../common/pagination.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import type {
  CreateFranchiseDto,
  FranchiseList,
  UpdateFranchiseDto,
  UpdateFranchiseSettingsDto,
} from "./dto.js";

@Injectable()
export class FranchisesRepository {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(TenantTransactionService)
    private readonly transactions: TenantTransactionService,
  ) {}

  create(input: CreateFranchiseDto) {
    const request = this.context.current();
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const organization = await transaction.organization.findUnique({
        where: { id: input.organizationId },
      });
      if (
        !organization ||
        organization.status === "ARCHIVED" ||
        !this.context.canAccessOrganization(organization.id)
      )
        return null;
      const franchise = await transaction.franchise.create({
        data: {
          tenantId,
          organizationId: input.organizationId,
          code: input.code,
          name: input.name,
          status: input.status ?? FranchiseStatus.ACTIVE,
          settings: (input.settings ?? {}) as Prisma.InputJsonValue,
          ...(input.description ? { description: input.description } : {}),
        },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "franchise.create",
        eventType: "franchises.franchise.created.v1",
        entityType: "franchise",
        entityId: franchise.id,
        payload: { organizationId: franchise.organizationId, status: franchise.status },
      });
      return franchise;
    });
  }

  list(input: FranchiseList) {
    const tenantId = this.context.tenantId();
    const principal = this.context.authenticatedPrincipal();
    const where: Prisma.FranchiseWhereInput = {
      tenantId,
      ...(!principal.access.tenantWide
        ? { organizationId: { in: [...principal.access.organizationIds] } }
        : {}),
      ...(!input.includeArchived ? { status: { not: FranchiseStatus.ARCHIVED } } : {}),
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.search
        ? {
            OR: [
              { code: { contains: input.search, mode: "insensitive" } },
              { name: { contains: input.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    return this.transactions.run(tenantId, async (transaction) => {
      const [items, total] = await Promise.all([
        transaction.franchise.findMany({
          where,
          ...pageWindow(input),
          orderBy: { [input.sortBy]: input.sortDirection },
          include: { organization: { select: { id: true, displayName: true } } },
        }),
        transaction.franchise.count({ where }),
      ]);
      return pageResult(items, total, input);
    });
  }

  findById(id: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.franchise.findFirst({
        where: {
          id,
          ...(!this.context.authenticatedPrincipal().access.tenantWide
            ? {
                organizationId: {
                  in: [...this.context.authenticatedPrincipal().access.organizationIds],
                },
              }
            : {}),
        },
        include: {
          organization: { select: { id: true, displayName: true } },
          _count: { select: { merchants: true, branches: true, staff: true } },
        },
      }),
    );
  }

  update(id: string, input: UpdateFranchiseDto) {
    const data = Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    ) as Prisma.FranchiseUpdateInput;
    if (input.settings) data.settings = input.settings as Prisma.InputJsonValue;
    return this.mutate(id, "franchise.update", "franchises.franchise.updated.v1", data);
  }

  updateSettings(id: string, input: UpdateFranchiseSettingsDto) {
    return this.mutate(
      id,
      "franchise.settings.update",
      "franchises.franchise.settings-updated.v1",
      {
        settings: input.settings as Prisma.InputJsonValue,
      },
    );
  }

  changeStatus(id: string, status: FranchiseStatus) {
    return this.mutate(
      id,
      `franchise.${status.toLowerCase()}`,
      "franchises.franchise.status-changed.v1",
      {
        status,
      },
    );
  }

  archive(id: string) {
    return this.mutate(id, "franchise.archive", "franchises.franchise.archived.v1", {
      status: FranchiseStatus.ARCHIVED,
      archivedAt: new Date(),
    });
  }

  private mutate(id: string, action: string, eventType: string, data: Prisma.FranchiseUpdateInput) {
    const request = this.context.current();
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const principal = this.context.authenticatedPrincipal();
      const existing = await transaction.franchise.findFirst({
        where: {
          id,
          ...(!principal.access.tenantWide
            ? { organizationId: { in: [...principal.access.organizationIds] } }
            : {}),
        },
      });
      if (!existing) return null;
      const franchise = await transaction.franchise.update({ where: { id }, data });
      await appendDomainChange(transaction, tenantId, request, {
        action,
        eventType,
        entityType: "franchise",
        entityId: id,
        payload: { previousStatus: existing.status, status: franchise.status },
      });
      return franchise;
    });
  }
}
