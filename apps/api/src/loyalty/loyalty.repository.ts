import { Inject, Injectable } from "@nestjs/common";
import { LoyaltyProgramStatus, type Prisma, type TenantTransaction } from "@rabbehni/database";
import { TenantTransactionService } from "@rabbehni/database/nest";

import { appendDomainChange } from "../common/events/append-domain-change.js";
import { pageResult, pageWindow } from "../common/pagination.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import type {
  CreateEarningRuleDto,
  CreateLoyaltyProgramDto,
  CreateRedemptionRuleDto,
  LoyaltyProgramList,
  UpdateEarningRuleDto,
  UpdateLoyaltyProgramDto,
  UpdateRedemptionRuleDto,
} from "./dto.js";

@Injectable()
export class LoyaltyRepository {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(TenantTransactionService) private readonly transactions: TenantTransactionService,
  ) {}

  create(input: CreateLoyaltyProgramDto) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      if (!this.context.canAccessOrganization(input.organizationId)) return null;
      if (!(await this.validApplicability(transaction, input.organizationId, input))) return null;
      const program = await transaction.loyaltyProgram.create({
        data: {
          tenantId,
          organizationId: input.organizationId,
          code: input.code,
          name: input.name,
          pointsLabel: input.pointsLabel ?? "points",
          status: input.status ?? LoyaltyProgramStatus.DRAFT,
          minimumEarnPoints: input.minimumEarnPoints ?? 1,
          minimumRedeemPoints: input.minimumRedeemPoints ?? 1,
          appliesToAllMerchants: input.appliesToAllMerchants ?? true,
          appliesToAllBranches: input.appliesToAllBranches ?? true,
          settings: (input.settings ?? {}) as Prisma.InputJsonValue,
          ...(input.description ? { description: input.description } : {}),
          ...(input.expirationDays ? { expirationDays: input.expirationDays } : {}),
          ...(input.maximumEarnPoints ? { maximumEarnPoints: input.maximumEarnPoints } : {}),
          ...(input.maximumRedeemPoints ? { maximumRedeemPoints: input.maximumRedeemPoints } : {}),
          ...(input.status === LoyaltyProgramStatus.ACTIVE ? { activatedAt: new Date() } : {}),
        },
      });
      await this.replaceApplicability(
        transaction,
        program.id,
        program.organizationId,
        input.merchantIds ?? [],
        input.branchIds ?? [],
      );
      await appendDomainChange(transaction, tenantId, request, {
        action: "loyalty-program.create",
        eventType: "loyalty.program.created.v1",
        entityType: "loyalty_program",
        entityId: program.id,
        payload: { organizationId: program.organizationId },
      });
      return program;
    });
  }

  list(input: LoyaltyProgramList) {
    const tenantId = this.context.tenantId();
    const access = this.context.authenticatedPrincipal().access;
    const and: Prisma.LoyaltyProgramWhereInput[] = [];
    if (input.merchantId) {
      and.push({
        OR: [
          { appliesToAllMerchants: true },
          { merchants: { some: { merchantId: input.merchantId } } },
        ],
      });
    }
    if (input.branchId) {
      and.push({
        OR: [{ appliesToAllBranches: true }, { branches: { some: { branchId: input.branchId } } }],
      });
    }
    if (input.search) {
      and.push({
        OR: [
          { code: { contains: input.search, mode: "insensitive" } },
          { name: { contains: input.search, mode: "insensitive" } },
        ],
      });
    }
    const where: Prisma.LoyaltyProgramWhereInput = {
      tenantId,
      ...(!access.tenantWide ? { organizationId: { in: [...access.organizationIds] } } : {}),
      ...(!input.includeArchived ? { status: { not: LoyaltyProgramStatus.ARCHIVED } } : {}),
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(and.length ? { AND: and } : {}),
    };
    return this.transactions.run(tenantId, async (transaction) => {
      const [items, total] = await Promise.all([
        transaction.loyaltyProgram.findMany({
          where,
          ...pageWindow(input),
          orderBy: { [input.sortBy]: input.sortDirection },
          include: {
            _count: { select: { earningRules: true, redemptionRules: true, rewards: true } },
          },
        }),
        transaction.loyaltyProgram.count({ where }),
      ]);
      return pageResult(items, total, input);
    });
  }

  findById(id: string) {
    const tenantId = this.context.tenantId();
    const access = this.context.authenticatedPrincipal().access;
    return this.transactions.run(tenantId, (transaction) =>
      transaction.loyaltyProgram.findFirst({
        where: {
          id,
          ...(!access.tenantWide ? { organizationId: { in: [...access.organizationIds] } } : {}),
        },
        include: {
          earningRules: { orderBy: [{ priority: "asc" }, { name: "asc" }] },
          redemptionRules: { orderBy: { name: "asc" } },
          merchants: { include: { merchant: { select: { id: true, displayName: true } } } },
          branches: { include: { branch: { select: { id: true, name: true } } } },
          _count: { select: { pointsEntries: true, rewards: true } },
        },
      }),
    );
  }

  update(id: string, input: UpdateLoyaltyProgramDto) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const existing = await this.scopedProgram(transaction, id);
      if (!existing || existing.status === LoyaltyProgramStatus.ARCHIVED) return null;
      if (!(await this.validApplicability(transaction, existing.organizationId, input)))
        return null;
      const {
        merchantIds,
        branchIds,
        settings,
        appliesToAllMerchants,
        appliesToAllBranches,
        ...fields
      } = input;
      const updateFields = Object.fromEntries(
        Object.entries(fields).filter(([, value]) => value !== undefined),
      ) as Prisma.LoyaltyProgramUncheckedUpdateInput;
      const program = await transaction.loyaltyProgram.update({
        where: { id },
        data: {
          ...updateFields,
          ...(settings ? { settings: settings as Prisma.InputJsonValue } : {}),
          ...(appliesToAllMerchants !== undefined ? { appliesToAllMerchants } : {}),
          ...(appliesToAllBranches !== undefined ? { appliesToAllBranches } : {}),
        },
      });
      if (merchantIds || branchIds) {
        const current = await transaction.loyaltyProgram.findUnique({
          where: { id },
          include: { merchants: true, branches: true },
        });
        await this.replaceApplicability(
          transaction,
          id,
          existing.organizationId,
          merchantIds ?? current?.merchants.map((item) => item.merchantId) ?? [],
          branchIds ?? current?.branches.map((item) => item.branchId) ?? [],
        );
      }
      await appendDomainChange(transaction, tenantId, request, {
        action: "loyalty-program.update",
        eventType: "loyalty.program.updated.v1",
        entityType: "loyalty_program",
        entityId: id,
      });
      return program;
    });
  }

  changeStatus(id: string, status: LoyaltyProgramStatus) {
    const data: Prisma.LoyaltyProgramUpdateInput = {
      status,
      ...(status === LoyaltyProgramStatus.ACTIVE ? { activatedAt: new Date() } : {}),
      ...(status === LoyaltyProgramStatus.SUSPENDED ? { suspendedAt: new Date() } : {}),
    };
    return this.mutate(id, `loyalty-program.${status.toLowerCase()}`, data);
  }
  archive(id: string) {
    return this.mutate(id, "loyalty-program.archive", {
      status: LoyaltyProgramStatus.ARCHIVED,
      archivedAt: new Date(),
    });
  }

  createEarningRule(programId: string, input: CreateEarningRuleDto) {
    return this.ruleMutation(programId, "earning", async (transaction, tenantId) =>
      transaction.earningRule.create({
        data: {
          tenantId,
          programId,
          code: input.code,
          name: input.name,
          eventType: input.eventType,
          points: input.points,
          multiplier: input.multiplier ?? 1,
          priority: input.priority ?? 100,
          active: input.active ?? true,
          conditions: (input.conditions ?? {}) as Prisma.InputJsonValue,
          ...(input.minimumAmount !== undefined ? { minimumAmount: input.minimumAmount } : {}),
          ...(input.maximumPoints ? { maximumPoints: input.maximumPoints } : {}),
          ...(input.startsAt ? { startsAt: input.startsAt } : {}),
          ...(input.endsAt ? { endsAt: input.endsAt } : {}),
        },
      }),
    );
  }
  updateEarningRule(programId: string, ruleId: string, input: UpdateEarningRuleDto) {
    return this.ruleMutation(programId, "earning", (transaction) =>
      transaction.earningRule.update({
        where: { id: ruleId },
        data: Object.fromEntries(
          Object.entries(input).filter(([, value]) => value !== undefined),
        ) as Prisma.EarningRuleUncheckedUpdateInput,
      }),
    );
  }
  createRedemptionRule(programId: string, input: CreateRedemptionRuleDto) {
    return this.ruleMutation(programId, "redemption", async (transaction, tenantId) =>
      transaction.redemptionRule.create({
        data: {
          tenantId,
          programId,
          code: input.code,
          name: input.name,
          minimumPoints: input.minimumPoints ?? 1,
          incrementPoints: input.incrementPoints ?? 1,
          active: input.active ?? true,
          conditions: (input.conditions ?? {}) as Prisma.InputJsonValue,
          ...(input.maximumPoints ? { maximumPoints: input.maximumPoints } : {}),
          ...(input.startsAt ? { startsAt: input.startsAt } : {}),
          ...(input.endsAt ? { endsAt: input.endsAt } : {}),
        },
      }),
    );
  }
  updateRedemptionRule(programId: string, ruleId: string, input: UpdateRedemptionRuleDto) {
    return this.ruleMutation(programId, "redemption", (transaction) =>
      transaction.redemptionRule.update({
        where: { id: ruleId },
        data: Object.fromEntries(
          Object.entries(input).filter(([, value]) => value !== undefined),
        ) as Prisma.RedemptionRuleUncheckedUpdateInput,
      }),
    );
  }

  private async scopedProgram(transaction: TenantTransaction, id: string) {
    const access = this.context.authenticatedPrincipal().access;
    return transaction.loyaltyProgram.findFirst({
      where: {
        id,
        ...(!access.tenantWide ? { organizationId: { in: [...access.organizationIds] } } : {}),
      },
    });
  }
  private mutate(id: string, action: string, data: Prisma.LoyaltyProgramUpdateInput) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const existing = await this.scopedProgram(transaction, id);
      if (!existing) return null;
      const program = await transaction.loyaltyProgram.update({ where: { id }, data });
      await appendDomainChange(transaction, tenantId, request, {
        action,
        eventType: "loyalty.program.status-changed.v1",
        entityType: "loyalty_program",
        entityId: id,
        payload: { previousStatus: existing.status, status: program.status },
      });
      return program;
    });
  }
  private ruleMutation<T>(
    programId: string,
    kind: "earning" | "redemption",
    operation: (transaction: TenantTransaction, tenantId: string) => Promise<T>,
  ) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      if (!(await this.scopedProgram(transaction, programId))) return null;
      const rule = await operation(transaction, tenantId);
      const id = (rule as { id: string }).id;
      await appendDomainChange(transaction, tenantId, request, {
        action: `loyalty-${kind}-rule.upsert`,
        eventType: `loyalty.${kind}-rule.changed.v1`,
        entityType: `${kind}_rule`,
        entityId: id,
        payload: { programId },
      });
      return rule;
    });
  }
  private async validApplicability(
    transaction: TenantTransaction,
    organizationId: string,
    input: {
      merchantIds?: readonly string[] | undefined;
      branchIds?: readonly string[] | undefined;
    },
  ) {
    const merchantIds = input.merchantIds ?? [];
    const branchIds = input.branchIds ?? [];
    const [merchants, branches] = await Promise.all([
      transaction.merchant.count({
        where: { id: { in: [...merchantIds] }, organizationId, status: { not: "ARCHIVED" } },
      }),
      transaction.branch.count({
        where: { id: { in: [...branchIds] }, organizationId, status: { not: "ARCHIVED" } },
      }),
    ]);
    return merchants === new Set(merchantIds).size && branches === new Set(branchIds).size;
  }
  private async replaceApplicability(
    transaction: TenantTransaction,
    programId: string,
    organizationId: string,
    merchantIds: readonly string[],
    branchIds: readonly string[],
  ) {
    const tenantId = this.context.tenantId();
    const branches = await transaction.branch.findMany({
      where: { id: { in: [...branchIds] } },
      select: { id: true, merchantId: true },
    });
    await Promise.all([
      transaction.programMerchant.deleteMany({ where: { programId } }),
      transaction.programBranch.deleteMany({ where: { programId } }),
    ]);
    if (merchantIds.length) {
      await transaction.programMerchant.createMany({
        data: [...new Set(merchantIds)].map((merchantId) => ({
          tenantId,
          programId,
          merchantId,
          organizationId,
        })),
      });
    }
    if (branches.length) {
      await transaction.programBranch.createMany({
        data: branches.map((branch) => ({
          tenantId,
          programId,
          branchId: branch.id,
          merchantId: branch.merchantId,
          organizationId,
        })),
      });
    }
  }
}
