import { Inject, Injectable } from "@nestjs/common";
import { MerchantStatus, type Prisma } from "@rabbehni/database";
import { TenantTransactionService } from "@rabbehni/database/nest";

import { appendDomainChange } from "../common/events/append-domain-change.js";
import { pageResult, pageWindow } from "../common/pagination.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import type {
  CreateMerchantDto,
  MerchantList,
  UpdateMerchantDto,
  UpdateMerchantSettingsDto,
} from "./dto.js";

@Injectable()
export class MerchantsRepository {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(TenantTransactionService)
    private readonly transactions: TenantTransactionService,
  ) {}

  create(input: CreateMerchantDto) {
    const request = this.context.current();
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const [organization, franchise] = await Promise.all([
        transaction.organization.findUnique({ where: { id: input.organizationId } }),
        input.franchiseId
          ? transaction.franchise.findUnique({ where: { id: input.franchiseId } })
          : Promise.resolve(null),
      ]);
      if (
        !organization ||
        organization.status === "ARCHIVED" ||
        !this.context.canAccessOrganization(organization.id) ||
        (input.franchiseId &&
          (!franchise ||
            franchise.organizationId !== input.organizationId ||
            franchise.status === "ARCHIVED"))
      ) {
        return null;
      }
      const status = input.status ?? MerchantStatus.DRAFT;
      const merchant = await transaction.merchant.create({
        data: {
          tenantId,
          organizationId: input.organizationId,
          code: input.code,
          legalName: input.legalName,
          displayName: input.displayName,
          status,
          settings: (input.settings ?? {}) as Prisma.InputJsonValue,
          ...(input.franchiseId ? { franchiseId: input.franchiseId } : {}),
          ...(input.contactEmail ? { contactEmail: input.contactEmail } : {}),
          ...(input.contactPhone ? { contactPhone: input.contactPhone } : {}),
          ...(input.website ? { website: input.website } : {}),
          ...(input.addressLine ? { addressLine: input.addressLine } : {}),
          ...(input.city ? { city: input.city } : {}),
          ...(input.countryCode ? { countryCode: input.countryCode } : {}),
          ...(input.timezone ? { timezone: input.timezone } : {}),
          ...(input.locale ? { locale: input.locale } : {}),
          ...(status === MerchantStatus.ACTIVE ? { activatedAt: new Date() } : {}),
        },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "merchant.create",
        eventType: "merchants.merchant.created.v1",
        entityType: "merchant",
        entityId: merchant.id,
        payload: {
          organizationId: merchant.organizationId,
          franchiseId: merchant.franchiseId,
          status: merchant.status,
        },
      });
      return merchant;
    });
  }

  list(input: MerchantList) {
    const tenantId = this.context.tenantId();
    const principal = this.context.authenticatedPrincipal();
    const where: Prisma.MerchantWhereInput = {
      tenantId,
      ...(!principal.access.tenantWide
        ? { organizationId: { in: [...principal.access.organizationIds] } }
        : {}),
      ...(!input.includeArchived ? { status: { not: MerchantStatus.ARCHIVED } } : {}),
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      ...(input.franchiseId ? { franchiseId: input.franchiseId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.search
        ? {
            OR: [
              { code: { contains: input.search, mode: "insensitive" } },
              { displayName: { contains: input.search, mode: "insensitive" } },
              { legalName: { contains: input.search, mode: "insensitive" } },
              { contactEmail: { contains: input.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    return this.transactions.run(tenantId, async (transaction) => {
      const [items, total] = await Promise.all([
        transaction.merchant.findMany({
          where,
          ...pageWindow(input),
          orderBy: { [input.sortBy]: input.sortDirection },
          include: {
            organization: { select: { id: true, displayName: true } },
            franchise: { select: { id: true, name: true } },
            _count: { select: { branches: true, staff: true } },
          },
        }),
        transaction.merchant.count({ where }),
      ]);
      return pageResult(items, total, input);
    });
  }

  findById(id: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.merchant.findFirst({
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
          franchise: { select: { id: true, name: true } },
          branches: { where: { status: { not: "ARCHIVED" } }, orderBy: { name: "asc" } },
          _count: { select: { staff: true } },
        },
      }),
    );
  }

  update(id: string, input: UpdateMerchantDto) {
    const data = Object.fromEntries(
      Object.entries(input).filter(([key, value]) => key !== "franchiseId" && value !== undefined),
    ) as Prisma.MerchantUpdateInput;
    if (input.settings) data.settings = input.settings as Prisma.InputJsonValue;
    if (input.franchiseId === null) data.franchise = { disconnect: true };
    if (input.franchiseId) data.franchise = { connect: { id: input.franchiseId } };
    return this.mutate(
      id,
      "merchant.update",
      "merchants.merchant.updated.v1",
      data,
      input.franchiseId,
    );
  }

  updateSettings(id: string, input: UpdateMerchantSettingsDto) {
    return this.mutate(id, "merchant.settings.update", "merchants.merchant.settings-updated.v1", {
      settings: input.settings as Prisma.InputJsonValue,
    });
  }

  changeStatus(id: string, status: MerchantStatus) {
    const now = new Date();
    return this.mutate(
      id,
      `merchant.${status.toLowerCase()}`,
      "merchants.merchant.status-changed.v1",
      {
        status,
        ...(status === MerchantStatus.ACTIVE
          ? { activatedAt: now, suspendedAt: null }
          : status === MerchantStatus.SUSPENDED
            ? { suspendedAt: now }
            : {}),
      },
    );
  }

  archive(id: string) {
    return this.mutate(id, "merchant.archive", "merchants.merchant.archived.v1", {
      status: MerchantStatus.ARCHIVED,
      archivedAt: new Date(),
    });
  }

  private mutate(
    id: string,
    action: string,
    eventType: string,
    data: Prisma.MerchantUpdateInput,
    requestedFranchiseId?: string | null,
  ) {
    const request = this.context.current();
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const principal = this.context.authenticatedPrincipal();
      const existing = await transaction.merchant.findFirst({
        where: {
          id,
          ...(!principal.access.tenantWide
            ? { organizationId: { in: [...principal.access.organizationIds] } }
            : {}),
        },
      });
      if (!existing) return null;
      if (requestedFranchiseId) {
        const franchise = await transaction.franchise.findUnique({
          where: { id: requestedFranchiseId },
        });
        if (
          !franchise ||
          franchise.organizationId !== existing.organizationId ||
          franchise.status === "ARCHIVED"
        ) {
          return null;
        }
      }
      const merchant = await transaction.merchant.update({ where: { id }, data });
      await appendDomainChange(transaction, tenantId, request, {
        action,
        eventType,
        entityType: "merchant",
        entityId: id,
        payload: { previousStatus: existing.status, status: merchant.status },
      });
      return merchant;
    });
  }
}
