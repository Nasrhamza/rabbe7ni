import { ConflictException, Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@rabbehni/database";
import { TenantTransactionService } from "@rabbehni/database/nest";

import { appendDomainChange } from "../common/events/append-domain-change.js";
import { pageResult, pageWindow } from "../common/pagination.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import type { ManualVisitDto, ReverseVisitDto, VisitList } from "./dto.js";

interface QrVisitInput {
  readonly customerId: string;
  readonly merchantId: string;
  readonly branchId: string;
  readonly qrTransactionId: string;
  readonly metadata?: Record<string, unknown>;
}

@Injectable()
export class VisitsRepository {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(TenantTransactionService) private readonly transactions: TenantTransactionService,
  ) {}

  list(input: VisitList) {
    const tenantId = this.context.tenantId();
    const access = this.context.authenticatedPrincipal().access;
    const where: Prisma.CustomerVisitWhereInput = {
      ...(!access.tenantWide ? { organizationId: { in: [...access.organizationIds] } } : {}),
      ...(input.customerId ? { customerId: input.customerId } : {}),
      ...(input.merchantId ? { merchantId: input.merchantId } : {}),
      ...(input.branchId ? { branchId: input.branchId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.from || input.to
        ? {
            visitedAt: {
              ...(input.from ? { gte: input.from } : {}),
              ...(input.to ? { lte: input.to } : {}),
            },
          }
        : {}),
    };
    return this.transactions.run(tenantId, async (transaction) => {
      const [items, total] = await Promise.all([
        transaction.customerVisit.findMany({
          where,
          ...pageWindow(input),
          orderBy: { [input.sortBy]: input.sortDirection },
          include: {
            customer: { select: { id: true, displayName: true } },
            merchant: { select: { id: true, displayName: true } },
            branch: { select: { id: true, name: true } },
          },
        }),
        transaction.customerVisit.count({ where }),
      ]);
      return pageResult(items, total, input);
    });
  }

  createManual(input: ManualVisitDto) {
    return this.create({ ...input, source: "MANUAL" });
  }

  createFromQr(input: QrVisitInput) {
    return this.create({
      ...input,
      idempotencyKey: `qr-visit:${input.qrTransactionId}`,
      source: "QR",
    });
  }

  reverse(id: string, input: ReverseVisitDto) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const access = this.context.authenticatedPrincipal().access;
      const visit = await transaction.customerVisit.findFirst({
        where: {
          id,
          ...(!access.tenantWide ? { organizationId: { in: [...access.organizationIds] } } : {}),
        },
      });
      if (!visit) return null;
      if (visit.status === "REVERSED") return visit;
      const updated = await transaction.customerVisit.update({
        where: { id },
        data: {
          status: "REVERSED",
          reversedAt: new Date(),
          metadata: {
            ...(visit.metadata as Record<string, unknown>),
            reversalReason: input.reason,
          },
        },
      });
      await transaction.customerActivity.create({
        data: {
          tenantId,
          customerId: visit.customerId,
          type: "visit.reversed",
          referenceId: id,
          metadata: { reason: input.reason },
        },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "visit.reverse",
        eventType: "customers.visit.reversed.v1",
        entityType: "customer_visit",
        entityId: id,
        payload: { reason: input.reason },
      });
      return updated;
    });
  }

  private create(
    input: (ManualVisitDto | QrVisitInput) & { idempotencyKey: string; source: string },
  ) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const [customer, merchant, branch] = await Promise.all([
        transaction.customer.findUnique({ where: { id: input.customerId } }),
        transaction.merchant.findUnique({ where: { id: input.merchantId } }),
        transaction.branch.findUnique({ where: { id: input.branchId } }),
      ]);
      if (!customer || !merchant || !branch) return null;
      if (
        customer.organizationId !== merchant.organizationId ||
        branch.organizationId !== merchant.organizationId ||
        branch.merchantId !== merchant.id
      ) {
        throw new ConflictException(
          "Customer, merchant and branch must share the same organization",
        );
      }
      if (!this.context.canAccessOrganization(customer.organizationId)) return null;
      const qrTransactionId = "qrTransactionId" in input ? input.qrTransactionId : undefined;
      const existing = qrTransactionId
        ? await transaction.customerVisit.findUnique({ where: { qrTransactionId } })
        : await transaction.customerVisit.findFirst({
            where: {
              source: input.source,
              metadata: { path: ["idempotencyKey"], equals: input.idempotencyKey },
            },
          });
      if (existing) return existing;
      const visit = await transaction.customerVisit.create({
        data: {
          tenantId,
          organizationId: customer.organizationId,
          customerId: customer.id,
          merchantId: merchant.id,
          branchId: branch.id,
          source: input.source,
          metadata: {
            ...input.metadata,
            idempotencyKey: input.idempotencyKey,
          } as Prisma.InputJsonValue,
          ...(qrTransactionId ? { qrTransactionId } : {}),
        },
      });
      await transaction.customerActivity.create({
        data: {
          tenantId,
          customerId: customer.id,
          type: "visit",
          referenceId: visit.id,
          metadata: { merchantId: merchant.id, branchId: branch.id, source: input.source },
        },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "visit.validate",
        eventType: "customers.visit.validated.v1",
        entityType: "customer_visit",
        entityId: visit.id,
        payload: {
          customerId: customer.id,
          merchantId: merchant.id,
          branchId: branch.id,
          source: input.source,
        },
      });
      return visit;
    });
  }
}
