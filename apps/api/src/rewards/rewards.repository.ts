import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import {
  PointsEntryType,
  RewardRedemptionStatus,
  RewardStatus,
  type Prisma,
  type TenantTransaction,
} from "@rabbehni/database";
import { TenantTransactionService } from "@rabbehni/database/nest";

import { appendDomainChange } from "../common/events/append-domain-change.js";
import { pageResult, pageWindow } from "../common/pagination.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import type {
  CreateRewardCategoryDto,
  CreateRewardDto,
  RedeemRewardDto,
  RedemptionList,
  RewardList,
  UpdateRewardDto,
} from "./dto.js";

@Injectable()
export class RewardsRepository {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(TenantTransactionService) private readonly transactions: TenantTransactionService,
  ) {}

  createCategory(input: CreateRewardCategoryDto) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      if (!this.context.canAccessOrganization(input.organizationId)) return null;
      const category = await transaction.rewardCategory.create({
        data: {
          tenantId,
          organizationId: input.organizationId,
          code: input.code,
          name: input.name,
          ...(input.description ? { description: input.description } : {}),
        },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "reward-category.create",
        eventType: "rewards.category.created.v1",
        entityType: "reward_category",
        entityId: category.id,
      });
      return category;
    });
  }

  listCategories(organizationId?: string) {
    const tenantId = this.context.tenantId();
    const access = this.context.authenticatedPrincipal().access;
    return this.transactions.run(tenantId, (transaction) =>
      transaction.rewardCategory.findMany({
        where: {
          archivedAt: null,
          ...(!access.tenantWide ? { organizationId: { in: [...access.organizationIds] } } : {}),
          ...(organizationId ? { organizationId } : {}),
        },
        orderBy: { name: "asc" },
      }),
    );
  }

  create(input: CreateRewardDto) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      if (!this.context.canAccessOrganization(input.organizationId)) return null;
      const program = await transaction.loyaltyProgram.findUnique({
        where: { id: input.programId },
      });
      if (!program || program.organizationId !== input.organizationId) return null;
      if (!(await this.validApplicability(transaction, input.organizationId, input))) return null;
      if (input.categoryId) {
        const category = await transaction.rewardCategory.findUnique({
          where: { id: input.categoryId },
        });
        if (!category || category.organizationId !== input.organizationId) return null;
      }
      const reward = await transaction.reward.create({
        data: {
          tenantId,
          organizationId: input.organizationId,
          programId: input.programId,
          code: input.code,
          name: input.name,
          status: input.status,
          pointsCost: input.pointsCost,
          unlimitedStock: input.unlimitedStock,
          eligibilityRules: input.eligibilityRules as Prisma.InputJsonValue,
          appliesToAllMerchants: input.appliesToAllMerchants,
          appliesToAllBranches: input.appliesToAllBranches,
          ...(input.categoryId ? { categoryId: input.categoryId } : {}),
          ...(input.description ? { description: input.description } : {}),
          ...(input.stockQuantity !== undefined ? { stockQuantity: input.stockQuantity } : {}),
          ...(input.startsAt ? { startsAt: input.startsAt } : {}),
          ...(input.endsAt ? { endsAt: input.endsAt } : {}),
        },
      });
      await this.replaceApplicability(
        transaction,
        reward.id,
        reward.organizationId,
        input.merchantIds,
        input.branchIds,
      );
      await appendDomainChange(transaction, tenantId, request, {
        action: "reward.create",
        eventType: "rewards.reward.created.v1",
        entityType: "reward",
        entityId: reward.id,
        payload: { programId: reward.programId, pointsCost: reward.pointsCost },
      });
      return reward;
    });
  }

  list(input: RewardList) {
    const tenantId = this.context.tenantId();
    const access = this.context.authenticatedPrincipal().access;
    const and: Prisma.RewardWhereInput[] = [];
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
    const where: Prisma.RewardWhereInput = {
      tenantId,
      ...(!access.tenantWide ? { organizationId: { in: [...access.organizationIds] } } : {}),
      ...(!input.includeArchived ? { status: { not: RewardStatus.ARCHIVED } } : {}),
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      ...(input.programId ? { programId: input.programId } : {}),
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(and.length ? { AND: and } : {}),
    };
    return this.transactions.run(tenantId, async (transaction) => {
      const [items, total] = await Promise.all([
        transaction.reward.findMany({
          where,
          ...pageWindow(input),
          orderBy: { [input.sortBy]: input.sortDirection },
          include: {
            category: { select: { id: true, name: true } },
            program: { select: { id: true, name: true, pointsLabel: true } },
            _count: { select: { redemptions: true } },
          },
        }),
        transaction.reward.count({ where }),
      ]);
      return pageResult(items, total, input);
    });
  }

  findById(id: string) {
    const tenantId = this.context.tenantId();
    const access = this.context.authenticatedPrincipal().access;
    return this.transactions.run(tenantId, (transaction) =>
      transaction.reward.findFirst({
        where: {
          id,
          ...(!access.tenantWide ? { organizationId: { in: [...access.organizationIds] } } : {}),
        },
        include: {
          category: true,
          program: true,
          merchants: { include: { merchant: { select: { id: true, displayName: true } } } },
          branches: { include: { branch: { select: { id: true, name: true } } } },
          _count: { select: { redemptions: true } },
        },
      }),
    );
  }

  update(id: string, input: UpdateRewardDto) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const existing = await this.scopedReward(transaction, id);
      if (!existing || existing.status === RewardStatus.ARCHIVED) return null;
      if (!(await this.validApplicability(transaction, existing.organizationId, input)))
        return null;
      if (input.categoryId) {
        const category = await transaction.rewardCategory.findUnique({
          where: { id: input.categoryId },
        });
        if (!category || category.organizationId !== existing.organizationId) return null;
      }
      const { merchantIds, branchIds, eligibilityRules, ...fields } = input;
      const updateFields = Object.fromEntries(
        Object.entries(fields).filter(([, value]) => value !== undefined),
      ) as Prisma.RewardUncheckedUpdateInput;
      const reward = await transaction.reward.update({
        where: { id },
        data: {
          ...updateFields,
          ...(eligibilityRules
            ? { eligibilityRules: eligibilityRules as Prisma.InputJsonValue }
            : {}),
        },
      });
      if (merchantIds || branchIds) {
        const current = await transaction.reward.findUnique({
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
        action: "reward.update",
        eventType: "rewards.reward.updated.v1",
        entityType: "reward",
        entityId: id,
      });
      return reward;
    });
  }

  changeStatus(id: string, status: RewardStatus) {
    return this.mutate(id, `reward.${status.toLowerCase()}`, { status });
  }
  updateStock(id: string, stockQuantity: number, unlimitedStock?: boolean) {
    return this.mutate(id, "reward.stock.update", {
      stockQuantity,
      ...(unlimitedStock !== undefined ? { unlimitedStock } : {}),
    });
  }
  archive(id: string) {
    return this.mutate(id, "reward.archive", {
      status: RewardStatus.ARCHIVED,
      archivedAt: new Date(),
    });
  }

  redeem(input: RedeemRewardDto) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const replay = await transaction.rewardRedemption.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: input.idempotencyKey } },
      });
      if (replay) return { redemption: replay, idempotent: true };
      const [customer, reward] = await Promise.all([
        transaction.customer.findUnique({ where: { id: input.customerId } }),
        transaction.reward.findUnique({
          where: { id: input.rewardId },
          include: { program: true, merchants: true, branches: true },
        }),
      ]);
      if (
        !customer ||
        !reward ||
        customer.organizationId !== reward.organizationId ||
        !this.context.canAccessOrganization(reward.organizationId)
      ) {
        throw new BadRequestException("Customer and reward must share an authorized organization");
      }
      await transaction.$queryRaw`
        SELECT true AS locked
        FROM pg_advisory_xact_lock(
          hashtextextended(${`${tenantId}:${customer.id}:${reward.programId}`}, 0)
        )
      `;
      const secondReplay = await transaction.rewardRedemption.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: input.idempotencyKey } },
      });
      if (secondReplay) return { redemption: secondReplay, idempotent: true };
      this.assertRewardAvailable(reward, customer.status, input);
      const pointsSpent = reward.pointsCost * input.quantity;
      const balanceResult = await transaction.pointsLedgerEntry.aggregate({
        where: { customerId: customer.id, programId: reward.programId },
        _sum: { points: true },
      });
      const currentBalance = balanceResult._sum.points ?? 0;
      if (currentBalance < pointsSpent) throw new ConflictException("Insufficient points balance");
      if (!reward.unlimitedStock) {
        const reserved = await transaction.reward.updateMany({
          where: { id: reward.id, stockQuantity: { gte: input.quantity } },
          data: { stockQuantity: { decrement: input.quantity } },
        });
        if (reserved.count !== 1) throw new ConflictException("Reward stock is insufficient");
      }
      const pointsEntry = await transaction.pointsLedgerEntry.create({
        data: {
          tenantId,
          organizationId: reward.organizationId,
          programId: reward.programId,
          customerId: customer.id,
          ...(input.merchantId ? { merchantId: input.merchantId } : {}),
          ...(input.branchId ? { branchId: input.branchId } : {}),
          type: PointsEntryType.REDEEM,
          points: -pointsSpent,
          idempotencyKey: `reward:${input.idempotencyKey}`,
          referenceType: "reward",
          referenceId: reward.id,
          metadata: input.metadata as Prisma.InputJsonValue,
          ...(request.actorId ? { createdByUserId: request.actorId } : {}),
        },
      });
      const redemption = await transaction.rewardRedemption.create({
        data: {
          tenantId,
          organizationId: reward.organizationId,
          programId: reward.programId,
          customerId: customer.id,
          rewardId: reward.id,
          ...(input.merchantId ? { merchantId: input.merchantId } : {}),
          ...(input.branchId ? { branchId: input.branchId } : {}),
          pointsEntryId: pointsEntry.id,
          quantity: input.quantity,
          pointsSpent,
          status: RewardRedemptionStatus.COMPLETED,
          idempotencyKey: input.idempotencyKey,
          metadata: input.metadata as Prisma.InputJsonValue,
          redeemedAt: new Date(),
        },
      });
      await transaction.customerActivity.create({
        data: {
          tenantId,
          customerId: customer.id,
          type: "reward.redeemed",
          referenceId: redemption.id,
          metadata: { rewardId: reward.id, pointsSpent },
        },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "reward.redeem",
        eventType: "rewards.redemption.completed.v1",
        entityType: "reward_redemption",
        entityId: redemption.id,
        payload: {
          customerId: customer.id,
          rewardId: reward.id,
          pointsSpent,
          balance: currentBalance - pointsSpent,
        },
      });
      return { redemption, balance: currentBalance - pointsSpent, idempotent: false };
    });
  }

  grantInstant(input: RedeemRewardDto) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const replay = await transaction.rewardRedemption.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: input.idempotencyKey } },
      });
      if (replay) return { redemption: replay, idempotent: true };

      const [customer, reward] = await Promise.all([
        transaction.customer.findUnique({ where: { id: input.customerId } }),
        transaction.reward.findUnique({
          where: { id: input.rewardId },
          include: { program: true, merchants: true, branches: true },
        }),
      ]);
      if (
        !customer ||
        !reward ||
        customer.organizationId !== reward.organizationId ||
        !this.context.canAccessOrganization(reward.organizationId)
      ) {
        throw new BadRequestException("Customer and reward must share an authorized organization");
      }

      await transaction.$queryRaw`
        SELECT true AS locked
        FROM pg_advisory_xact_lock(
          hashtextextended(${`${tenantId}:${customer.id}:${reward.programId}`}, 0)
        )
      `;
      const secondReplay = await transaction.rewardRedemption.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: input.idempotencyKey } },
      });
      if (secondReplay) return { redemption: secondReplay, idempotent: true };

      this.assertRewardAvailable(reward, customer.status, input);
      if (!reward.unlimitedStock) {
        const reserved = await transaction.reward.updateMany({
          where: { id: reward.id, stockQuantity: { gte: input.quantity } },
          data: { stockQuantity: { decrement: input.quantity } },
        });
        if (reserved.count !== 1) throw new ConflictException("Reward stock is insufficient");
      }

      const sponsoredPoints = reward.pointsCost * input.quantity;
      const balanceResult = await transaction.pointsLedgerEntry.aggregate({
        where: { customerId: customer.id, programId: reward.programId },
        _sum: { points: true },
      });
      const currentBalance = balanceResult._sum.points ?? 0;
      await transaction.pointsLedgerEntry.create({
        data: {
          tenantId,
          organizationId: reward.organizationId,
          programId: reward.programId,
          customerId: customer.id,
          ...(input.merchantId ? { merchantId: input.merchantId } : {}),
          ...(input.branchId ? { branchId: input.branchId } : {}),
          type: PointsEntryType.EARN,
          points: sponsoredPoints,
          idempotencyKey: `instant-funding:${input.idempotencyKey}`,
          referenceType: "instant_reward_funding",
          referenceId: reward.id,
          metadata: { ...input.metadata, sponsored: true },
          ...(request.actorId ? { createdByUserId: request.actorId } : {}),
        },
      });
      const pointsEntry = await transaction.pointsLedgerEntry.create({
        data: {
          tenantId,
          organizationId: reward.organizationId,
          programId: reward.programId,
          customerId: customer.id,
          ...(input.merchantId ? { merchantId: input.merchantId } : {}),
          ...(input.branchId ? { branchId: input.branchId } : {}),
          type: PointsEntryType.REDEEM,
          points: -sponsoredPoints,
          idempotencyKey: `instant-redeem:${input.idempotencyKey}`,
          referenceType: "instant_reward",
          referenceId: reward.id,
          metadata: { ...input.metadata, sponsored: true },
          ...(request.actorId ? { createdByUserId: request.actorId } : {}),
        },
      });
      const redemption = await transaction.rewardRedemption.create({
        data: {
          tenantId,
          organizationId: reward.organizationId,
          programId: reward.programId,
          customerId: customer.id,
          rewardId: reward.id,
          ...(input.merchantId ? { merchantId: input.merchantId } : {}),
          ...(input.branchId ? { branchId: input.branchId } : {}),
          pointsEntryId: pointsEntry.id,
          quantity: input.quantity,
          pointsSpent: 0,
          status: RewardRedemptionStatus.COMPLETED,
          idempotencyKey: input.idempotencyKey,
          metadata: { ...input.metadata, sponsored: true, nominalPointsCost: sponsoredPoints },
          redeemedAt: new Date(),
        },
      });
      await transaction.customerActivity.create({
        data: {
          tenantId,
          customerId: customer.id,
          type: "reward.instant-granted",
          referenceId: redemption.id,
          metadata: { rewardId: reward.id, rewardName: reward.name, sponsoredPoints },
        },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "reward.instant-grant",
        eventType: "rewards.instant-grant.completed.v1",
        entityType: "reward_redemption",
        entityId: redemption.id,
        payload: { customerId: customer.id, rewardId: reward.id, sponsoredPoints },
      });
      return { redemption, balance: currentBalance, idempotent: false };
    });
  }

  reverseRedemption(
    id: string,
    idempotencyKey: string,
    reason: string,
    status: "CANCELED" | "REVERSED",
  ) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const redemption = await transaction.rewardRedemption.findUnique({
        where: { id },
        include: { reward: true, pointsEntry: true },
      });
      if (!redemption || !this.context.canAccessOrganization(redemption.organizationId))
        return null;
      await transaction.$queryRaw`
        SELECT true AS locked
        FROM pg_advisory_xact_lock(
          hashtextextended(${`${tenantId}:${redemption.customerId}:${redemption.programId}`}, 0)
        )
      `;
      const replay = await transaction.pointsLedgerEntry.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      });
      if (replay) return { redemption, reversalEntry: replay, idempotent: true };
      if (
        redemption.status === RewardRedemptionStatus.CANCELED ||
        redemption.status === RewardRedemptionStatus.REVERSED
      ) {
        throw new ConflictException("Redemption is already canceled or reversed");
      }
      const reversal = await transaction.pointsLedgerEntry.create({
        data: {
          tenantId,
          organizationId: redemption.organizationId,
          programId: redemption.programId,
          customerId: redemption.customerId,
          merchantId: redemption.merchantId,
          branchId: redemption.branchId,
          type: PointsEntryType.REVERSE,
          points: redemption.pointsSpent,
          idempotencyKey,
          sourceEntryId: redemption.pointsEntryId,
          referenceType: "reward_redemption_reversal",
          referenceId: redemption.id,
          metadata: { reason, targetStatus: status },
          ...(request.actorId ? { createdByUserId: request.actorId } : {}),
        },
      });
      const updated = await transaction.rewardRedemption.update({
        where: { id },
        data: {
          status,
          reversalEntryId: reversal.id,
          ...(status === RewardRedemptionStatus.CANCELED
            ? { canceledAt: new Date() }
            : { reversedAt: new Date() }),
        },
      });
      if (!redemption.reward.unlimitedStock) {
        await transaction.reward.update({
          where: { id: redemption.rewardId },
          data: { stockQuantity: { increment: redemption.quantity } },
        });
      }
      await transaction.customerActivity.create({
        data: {
          tenantId,
          customerId: redemption.customerId,
          type: status === RewardRedemptionStatus.CANCELED ? "reward.canceled" : "reward.reversed",
          referenceId: redemption.id,
          metadata: { pointsRestored: redemption.pointsSpent, reason },
        },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: `reward-redemption.${status.toLowerCase()}`,
        eventType: "rewards.redemption.reversed.v1",
        entityType: "reward_redemption",
        entityId: redemption.id,
        payload: { reversalEntryId: reversal.id, pointsRestored: redemption.pointsSpent },
      });
      return { redemption: updated, reversalEntry: reversal, idempotent: false };
    });
  }

  listRedemptions(input: RedemptionList) {
    const tenantId = this.context.tenantId();
    const access = this.context.authenticatedPrincipal().access;
    const where: Prisma.RewardRedemptionWhereInput = {
      tenantId,
      ...(!access.tenantWide ? { organizationId: { in: [...access.organizationIds] } } : {}),
      ...(input.customerId ? { customerId: input.customerId } : {}),
      ...(input.rewardId ? { rewardId: input.rewardId } : {}),
      ...(input.status ? { status: input.status } : {}),
    };
    return this.transactions.run(tenantId, async (transaction) => {
      const [items, total] = await Promise.all([
        transaction.rewardRedemption.findMany({
          where,
          ...pageWindow(input),
          orderBy: { [input.sortBy]: input.sortDirection },
          include: {
            customer: { select: { id: true, displayName: true } },
            reward: { select: { id: true, name: true } },
          },
        }),
        transaction.rewardRedemption.count({ where }),
      ]);
      return pageResult(items, total, input);
    });
  }

  private async scopedReward(transaction: TenantTransaction, id: string) {
    const access = this.context.authenticatedPrincipal().access;
    return transaction.reward.findFirst({
      where: {
        id,
        ...(!access.tenantWide ? { organizationId: { in: [...access.organizationIds] } } : {}),
      },
    });
  }
  private mutate(id: string, action: string, data: Prisma.RewardUpdateInput) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      if (!(await this.scopedReward(transaction, id))) return null;
      const reward = await transaction.reward.update({ where: { id }, data });
      await appendDomainChange(transaction, tenantId, request, {
        action,
        eventType: "rewards.reward.changed.v1",
        entityType: "reward",
        entityId: id,
        payload: { status: reward.status, stockQuantity: reward.stockQuantity },
      });
      return reward;
    });
  }
  private assertRewardAvailable(
    reward: {
      status: RewardStatus;
      startsAt: Date | null;
      endsAt: Date | null;
      unlimitedStock: boolean;
      stockQuantity: number | null;
      appliesToAllMerchants: boolean;
      appliesToAllBranches: boolean;
      merchants: readonly { merchantId: string }[];
      branches: readonly { branchId: string }[];
    },
    customerStatus: string,
    input: RedeemRewardDto,
  ) {
    const now = new Date();
    if (customerStatus !== "ACTIVE" || reward.status !== RewardStatus.ACTIVE) {
      throw new ConflictException("Customer and reward must be active");
    }
    if ((reward.startsAt && reward.startsAt > now) || (reward.endsAt && reward.endsAt <= now)) {
      throw new ConflictException("Reward is outside its availability window");
    }
    if (!reward.unlimitedStock && (reward.stockQuantity ?? 0) < input.quantity) {
      throw new ConflictException("Reward stock is insufficient");
    }
    if (
      input.merchantId &&
      !reward.appliesToAllMerchants &&
      !reward.merchants.some((item) => item.merchantId === input.merchantId)
    ) {
      throw new BadRequestException("Merchant is outside reward applicability");
    }
    if (
      input.branchId &&
      !reward.appliesToAllBranches &&
      !reward.branches.some((item) => item.branchId === input.branchId)
    ) {
      throw new BadRequestException("Branch is outside reward applicability");
    }
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
    rewardId: string,
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
      transaction.rewardMerchant.deleteMany({ where: { rewardId } }),
      transaction.rewardBranch.deleteMany({ where: { rewardId } }),
    ]);
    if (merchantIds.length) {
      await transaction.rewardMerchant.createMany({
        data: [...new Set(merchantIds)].map((merchantId) => ({
          tenantId,
          rewardId,
          merchantId,
          organizationId,
        })),
      });
    }
    if (branches.length) {
      await transaction.rewardBranch.createMany({
        data: branches.map((branch) => ({
          tenantId,
          rewardId,
          branchId: branch.id,
          merchantId: branch.merchantId,
          organizationId,
        })),
      });
    }
  }
}
