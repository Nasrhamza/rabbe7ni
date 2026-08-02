import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import { LoyaltyProgramStatus, PointsEntryType, type Prisma } from "@rabbehni/database";
import { TenantTransactionService } from "@rabbehni/database/nest";

import { appendDomainChange } from "../common/events/append-domain-change.js";
import { pageResult, pageWindow } from "../common/pagination.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import type { PointsList } from "./dto.js";

export interface PointsOperation {
  readonly customerId: string;
  readonly programId: string;
  readonly merchantId?: string | undefined;
  readonly branchId?: string | undefined;
  readonly type: PointsEntryType;
  readonly points: number;
  readonly idempotencyKey: string;
  readonly referenceType?: string | undefined;
  readonly referenceId?: string | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

@Injectable()
export class PointsRepository {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(TenantTransactionService) private readonly transactions: TenantTransactionService,
  ) {}

  post(input: PointsOperation) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      await transaction.$queryRaw`
        SELECT true AS locked
        FROM pg_advisory_xact_lock(
          hashtextextended(${`${tenantId}:${input.customerId}:${input.programId}`}, 0)
        )
      `;
      const replay = await transaction.pointsLedgerEntry.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: input.idempotencyKey } },
      });
      if (replay) {
        const balance = await this.sumBalance(transaction, input.customerId, input.programId);
        return { entry: replay, balance, idempotent: true };
      }
      const [customer, program] = await Promise.all([
        transaction.customer.findUnique({ where: { id: input.customerId } }),
        transaction.loyaltyProgram.findUnique({
          where: { id: input.programId },
          include: { merchants: true, branches: true },
        }),
      ]);
      if (
        !customer ||
        !program ||
        customer.organizationId !== program.organizationId ||
        !this.context.canAccessOrganization(program.organizationId)
      ) {
        throw new BadRequestException("Customer and program must share an authorized organization");
      }
      if (customer.status !== "ACTIVE" || program.status !== LoyaltyProgramStatus.ACTIVE) {
        throw new ConflictException("Customer and loyalty program must be active");
      }
      await this.assertApplicability(transaction, program, input.merchantId, input.branchId);
      this.assertThreshold(program, input);
      const currentBalance = await this.sumBalance(transaction, input.customerId, input.programId);
      const nextBalance = currentBalance + input.points;
      if (nextBalance < 0) throw new ConflictException("Insufficient points balance");
      const expiresAt =
        input.type === PointsEntryType.EARN && program.expirationDays
          ? new Date(Date.now() + program.expirationDays * 86_400_000)
          : undefined;
      const entry = await transaction.pointsLedgerEntry.create({
        data: {
          tenantId,
          organizationId: program.organizationId,
          programId: program.id,
          customerId: customer.id,
          type: input.type,
          points: input.points,
          idempotencyKey: input.idempotencyKey,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
          ...(input.merchantId ? { merchantId: input.merchantId } : {}),
          ...(input.branchId ? { branchId: input.branchId } : {}),
          ...(input.referenceType ? { referenceType: input.referenceType } : {}),
          ...(input.referenceId ? { referenceId: input.referenceId } : {}),
          ...(expiresAt ? { expiresAt } : {}),
          ...(request.actorId ? { createdByUserId: request.actorId } : {}),
        },
      });
      await transaction.customerActivity.create({
        data: {
          tenantId,
          customerId: customer.id,
          type: `points.${input.type.toLowerCase()}`,
          referenceId: entry.id,
          metadata: {
            points: input.points,
            balance: nextBalance,
            ...(input.referenceType ? { referenceType: input.referenceType } : {}),
            ...(typeof input.metadata?.source === "string"
              ? { source: input.metadata.source }
              : {}),
          },
        },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: `points.${input.type.toLowerCase()}`,
        eventType: "loyalty.points.posted.v1",
        entityType: "points_ledger_entry",
        entityId: entry.id,
        payload: {
          customerId: customer.id,
          programId: program.id,
          points: input.points,
          balance: nextBalance,
        },
      });
      return { entry, balance: nextBalance, idempotent: false };
    });
  }

  reverse(entryId: string, idempotencyKey: string, reason: string) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const source = await transaction.pointsLedgerEntry.findUnique({ where: { id: entryId } });
      if (!source || !this.context.canAccessOrganization(source.organizationId)) return null;
      await transaction.$queryRaw`
        SELECT true AS locked
        FROM pg_advisory_xact_lock(
          hashtextextended(${`${tenantId}:${source.customerId}:${source.programId}`}, 0)
        )
      `;
      const replay = await transaction.pointsLedgerEntry.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      });
      if (replay) {
        return {
          entry: replay,
          balance: await this.sumBalance(transaction, source.customerId, source.programId),
          idempotent: true,
        };
      }
      if (source.type === PointsEntryType.REVERSE) {
        throw new BadRequestException("A reversal cannot be reversed");
      }
      const existingReversal = await transaction.pointsLedgerEntry.findFirst({
        where: { sourceEntryId: source.id },
      });
      if (existingReversal) throw new ConflictException("The entry is already reversed");
      const currentBalance = await this.sumBalance(
        transaction,
        source.customerId,
        source.programId,
      );
      const nextBalance = currentBalance - source.points;
      if (nextBalance < 0) {
        throw new ConflictException("Reversal would create an unauthorized negative balance");
      }
      const reversal = await transaction.pointsLedgerEntry.create({
        data: {
          tenantId,
          organizationId: source.organizationId,
          programId: source.programId,
          customerId: source.customerId,
          merchantId: source.merchantId,
          branchId: source.branchId,
          type: PointsEntryType.REVERSE,
          points: -source.points,
          idempotencyKey,
          sourceEntryId: source.id,
          referenceType: "reversal",
          referenceId: source.id,
          metadata: { reason },
          ...(request.actorId ? { createdByUserId: request.actorId } : {}),
        },
      });
      await transaction.customerActivity.create({
        data: {
          tenantId,
          customerId: source.customerId,
          type: "points.reverse",
          referenceId: reversal.id,
          metadata: { sourceEntryId: source.id, points: reversal.points, balance: nextBalance },
        },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "points.reverse",
        eventType: "loyalty.points.reversed.v1",
        entityType: "points_ledger_entry",
        entityId: reversal.id,
        payload: { sourceEntryId: source.id, balance: nextBalance },
      });
      return { entry: reversal, balance: nextBalance, idempotent: false };
    });
  }

  balance(customerId: string, programId?: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const customer = await transaction.customer.findUnique({ where: { id: customerId } });
      const principal = this.context.authenticatedPrincipal();
      if (
        !customer ||
        !this.context.canAccessOrganization(customer.organizationId) ||
        (!principal.permissions.includes("points.read") && customer.userId !== principal.userId)
      )
        return null;
      if (programId) {
        return {
          customerId,
          programId,
          balance: await this.sumBalance(transaction, customerId, programId),
        };
      }
      const groups = await transaction.pointsLedgerEntry.groupBy({
        by: ["programId"],
        where: { customerId },
        _sum: { points: true },
      });
      return {
        customerId,
        balances: groups.map((group) => ({
          programId: group.programId,
          balance: group._sum.points ?? 0,
        })),
      };
    });
  }

  list(input: PointsList) {
    const tenantId = this.context.tenantId();
    const access = this.context.authenticatedPrincipal().access;
    const where: Prisma.PointsLedgerEntryWhereInput = {
      tenantId,
      ...(!access.tenantWide ? { organizationId: { in: [...access.organizationIds] } } : {}),
      ...(input.customerId ? { customerId: input.customerId } : {}),
      ...(input.programId ? { programId: input.programId } : {}),
      ...(input.merchantId ? { merchantId: input.merchantId } : {}),
      ...(input.branchId ? { branchId: input.branchId } : {}),
      ...(input.type ? { type: input.type } : {}),
    };
    return this.transactions.run(tenantId, async (transaction) => {
      const [items, total] = await Promise.all([
        transaction.pointsLedgerEntry.findMany({
          where,
          ...pageWindow(input),
          orderBy: { [input.sortBy]: input.sortDirection },
          include: {
            customer: { select: { id: true, displayName: true } },
            program: { select: { id: true, name: true, pointsLabel: true } },
          },
        }),
        transaction.pointsLedgerEntry.count({ where }),
      ]);
      return pageResult(items, total, input);
    });
  }

  private async sumBalance(
    transaction: Prisma.TransactionClient,
    customerId: string,
    programId: string,
  ) {
    const result = await transaction.pointsLedgerEntry.aggregate({
      where: { customerId, programId },
      _sum: { points: true },
    });
    return result._sum.points ?? 0;
  }
  private assertThreshold(
    program: {
      minimumEarnPoints: number;
      maximumEarnPoints: number | null;
      minimumRedeemPoints: number;
      maximumRedeemPoints: number | null;
    },
    input: PointsOperation,
  ) {
    const absolute = Math.abs(input.points);
    if (input.type === PointsEntryType.EARN) {
      if (
        absolute < program.minimumEarnPoints ||
        (program.maximumEarnPoints && absolute > program.maximumEarnPoints)
      ) {
        throw new BadRequestException("Earn points are outside the configured thresholds");
      }
    }
    if (input.type === PointsEntryType.REDEEM) {
      if (
        absolute < program.minimumRedeemPoints ||
        (program.maximumRedeemPoints && absolute > program.maximumRedeemPoints)
      ) {
        throw new BadRequestException("Redeem points are outside the configured thresholds");
      }
    }
  }
  private async assertApplicability(
    transaction: Prisma.TransactionClient,
    program: {
      id: string;
      organizationId: string;
      appliesToAllMerchants: boolean;
      appliesToAllBranches: boolean;
      merchants: readonly { merchantId: string }[];
      branches: readonly { branchId: string }[];
    },
    merchantId?: string,
    branchId?: string,
  ) {
    if (branchId) {
      const branch = await transaction.branch.findUnique({ where: { id: branchId } });
      if (
        !branch ||
        branch.organizationId !== program.organizationId ||
        (merchantId && branch.merchantId !== merchantId) ||
        (!program.appliesToAllBranches &&
          !program.branches.some((item) => item.branchId === branchId))
      ) {
        throw new BadRequestException("Branch is outside program applicability");
      }
    }
    if (
      merchantId &&
      !program.appliesToAllMerchants &&
      !program.merchants.some((item) => item.merchantId === merchantId)
    ) {
      throw new BadRequestException("Merchant is outside program applicability");
    }
  }
}
