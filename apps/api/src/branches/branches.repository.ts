import { Inject, Injectable } from "@nestjs/common";
import { BranchStatus, type Prisma } from "@rabbehni/database";
import { TenantTransactionService } from "@rabbehni/database/nest";

import { appendDomainChange } from "../common/events/append-domain-change.js";
import { pageResult, pageWindow } from "../common/pagination.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import type { BranchList, CreateBranchDto, UpdateBranchDto } from "./dto.js";

@Injectable()
export class BranchesRepository {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(TenantTransactionService) private readonly transactions: TenantTransactionService,
  ) {}

  create(input: CreateBranchDto) {
    const request = this.context.current();
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const merchant = await transaction.merchant.findUnique({ where: { id: input.merchantId } });
      if (
        !merchant ||
        merchant.status === "ARCHIVED" ||
        !this.context.canAccessOrganization(merchant.organizationId)
      )
        return null;
      const franchiseId = input.franchiseId ?? merchant.franchiseId;
      if (merchant.franchiseId && input.franchiseId && merchant.franchiseId !== input.franchiseId) {
        return null;
      }
      if (franchiseId) {
        const franchise = await transaction.franchise.findUnique({ where: { id: franchiseId } });
        if (
          !franchise ||
          franchise.organizationId !== merchant.organizationId ||
          franchise.status === "ARCHIVED"
        ) {
          return null;
        }
      }
      const branch = await transaction.branch.create({
        data: {
          tenantId,
          organizationId: merchant.organizationId,
          merchantId: merchant.id,
          code: input.code,
          name: input.name,
          countryCode: input.countryCode,
          timezone: input.timezone,
          locale: input.locale ?? "en",
          currency: input.currency,
          status: input.status ?? BranchStatus.ACTIVE,
          settings: (input.settings ?? {}) as Prisma.InputJsonValue,
          openingHours: (input.openingHours ?? {}) as Prisma.InputJsonValue,
          ...(franchiseId ? { franchiseId } : {}),
          ...(input.addressLine ? { addressLine: input.addressLine } : {}),
          ...(input.addressLine2 ? { addressLine2: input.addressLine2 } : {}),
          ...(input.city ? { city: input.city } : {}),
          ...(input.region ? { region: input.region } : {}),
          ...(input.postalCode ? { postalCode: input.postalCode } : {}),
          ...(input.phone ? { phone: input.phone } : {}),
          ...(input.email ? { email: input.email } : {}),
        },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "branch.create",
        eventType: "branches.branch.created.v1",
        entityType: "branch",
        entityId: branch.id,
        payload: {
          organizationId: branch.organizationId,
          merchantId: branch.merchantId,
          franchiseId: branch.franchiseId,
        },
      });
      return branch;
    });
  }

  list(input: BranchList) {
    const tenantId = this.context.tenantId();
    const principal = this.context.authenticatedPrincipal();
    const where: Prisma.BranchWhereInput = {
      tenantId,
      ...(!principal.access.tenantWide
        ? { organizationId: { in: [...principal.access.organizationIds] } }
        : {}),
      ...(!input.includeArchived ? { status: { not: BranchStatus.ARCHIVED } } : {}),
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      ...(input.franchiseId ? { franchiseId: input.franchiseId } : {}),
      ...(input.merchantId ? { merchantId: input.merchantId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.search
        ? {
            OR: [
              { code: { contains: input.search, mode: "insensitive" } },
              { name: { contains: input.search, mode: "insensitive" } },
              { city: { contains: input.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    return this.transactions.run(tenantId, async (transaction) => {
      const [items, total] = await Promise.all([
        transaction.branch.findMany({
          where,
          ...pageWindow(input),
          orderBy: { [input.sortBy]: input.sortDirection },
          include: {
            merchant: { select: { id: true, displayName: true } },
            franchise: { select: { id: true, name: true } },
          },
        }),
        transaction.branch.count({ where }),
      ]);
      return pageResult(items, total, input);
    });
  }

  findById(id: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.branch.findFirst({
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
          merchant: { select: { id: true, displayName: true } },
          franchise: { select: { id: true, name: true } },
          _count: { select: { staff: true } },
        },
      }),
    );
  }

  update(id: string, input: UpdateBranchDto) {
    const request = this.context.current();
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const principal = this.context.authenticatedPrincipal();
      const existing = await transaction.branch.findFirst({
        where: {
          id,
          ...(!principal.access.tenantWide
            ? { organizationId: { in: [...principal.access.organizationIds] } }
            : {}),
        },
      });
      if (!existing) return null;
      const merchantId = input.merchantId ?? existing.merchantId;
      const merchant = await transaction.merchant.findUnique({ where: { id: merchantId } });
      if (!merchant || merchant.status === "ARCHIVED") return null;
      const requestedFranchise =
        input.franchiseId === undefined ? existing.franchiseId : input.franchiseId;
      const franchiseId = requestedFranchise ?? merchant.franchiseId;
      if (merchant.franchiseId && franchiseId && merchant.franchiseId !== franchiseId) return null;
      if (franchiseId) {
        const franchise = await transaction.franchise.findUnique({ where: { id: franchiseId } });
        if (!franchise || franchise.organizationId !== merchant.organizationId) return null;
      }
      const {
        merchantId: _merchantId,
        franchiseId: _franchiseId,
        settings,
        openingHours,
        ...fields
      } = input;
      const updateFields = Object.fromEntries(
        Object.entries(fields).filter(([, value]) => value !== undefined),
      ) as Prisma.BranchUncheckedUpdateInput;
      const branch = await transaction.branch.update({
        where: { id },
        data: {
          ...updateFields,
          organizationId: merchant.organizationId,
          merchantId,
          franchiseId,
          ...(settings ? { settings: settings as Prisma.InputJsonValue } : {}),
          ...(openingHours ? { openingHours: openingHours as Prisma.InputJsonValue } : {}),
        },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "branch.update",
        eventType: "branches.branch.updated.v1",
        entityType: "branch",
        entityId: id,
        payload: { merchantId: branch.merchantId, franchiseId: branch.franchiseId },
      });
      return branch;
    });
  }

  changeStatus(id: string, status: BranchStatus) {
    return this.mutate(id, `branch.${status.toLowerCase()}`, "branches.branch.status-changed.v1", {
      status,
    });
  }

  archive(id: string) {
    return this.mutate(id, "branch.archive", "branches.branch.archived.v1", {
      status: BranchStatus.ARCHIVED,
      archivedAt: new Date(),
    });
  }

  private mutate(id: string, action: string, eventType: string, data: Prisma.BranchUpdateInput) {
    const request = this.context.current();
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const principal = this.context.authenticatedPrincipal();
      const existing = await transaction.branch.findFirst({
        where: {
          id,
          ...(!principal.access.tenantWide
            ? { organizationId: { in: [...principal.access.organizationIds] } }
            : {}),
        },
      });
      if (!existing) return null;
      const branch = await transaction.branch.update({ where: { id }, data });
      await appendDomainChange(transaction, tenantId, request, {
        action,
        eventType,
        entityType: "branch",
        entityId: id,
        payload: { previousStatus: existing.status, status: branch.status },
      });
      return branch;
    });
  }
}
