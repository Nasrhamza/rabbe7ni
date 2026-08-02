import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { CustomerStatus, GameStatus, type Prisma } from "@rabbehni/database";
import { TenantTransactionService } from "@rabbehni/database/nest";
import { randomInt } from "node:crypto";

import { appendDomainChange } from "../common/events/append-domain-change.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import type { CreateGameDto, GameStatusDto, ReplaceGamePrizesDto, UpdateGameDto } from "./dto.js";

@Injectable()
export class GamesRepository {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(TenantTransactionService) private readonly transactions: TenantTransactionService,
  ) {}

  list(management: boolean) {
    return management ? this.listForManagement() : this.listForCurrentCustomer();
  }

  get(id: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const game = await this.findAccessibleGame(transaction, id);
      if (!game) return null;
      return transaction.gameConfiguration.findUnique({
        where: { id },
        include: {
          organization: { select: { id: true, displayName: true } },
          program: { select: { id: true, name: true } },
          prizes: { orderBy: { probabilityWeight: "desc" } },
          _count: { select: { plays: true } },
        },
      });
    });
  }

  private listForManagement() {
    const tenantId = this.context.tenantId();
    const access = this.context.authenticatedPrincipal().access;
    return this.transactions.run(tenantId, async (transaction) => ({
      mode: "MANAGEMENT" as const,
      items: await transaction.gameConfiguration.findMany({
        where: {
          ...(!access.tenantWide ? { organizationId: { in: [...access.organizationIds] } } : {}),
          status: { not: GameStatus.ARCHIVED },
        },
        include: {
          prizes: { orderBy: { probabilityWeight: "desc" } },
          _count: { select: { plays: true } },
        },
        orderBy: [{ type: "asc" }, { name: "asc" }],
      }),
    }));
  }

  private listForCurrentCustomer() {
    const tenantId = this.context.tenantId();
    const principal = this.context.authenticatedPrincipal();
    return this.transactions.run(tenantId, async (transaction) => {
      const customer = await transaction.customer.findFirst({
        where: { userId: principal.userId, status: CustomerStatus.ACTIVE },
      });
      if (!customer) throw new NotFoundException("Active customer profile not found");

      const now = new Date();
      const games = await transaction.gameConfiguration.findMany({
        where: {
          organizationId: customer.organizationId,
          status: GameStatus.ACTIVE,
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
          AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
        },
        include: { prizes: { where: { active: true }, orderBy: { probabilityWeight: "desc" } } },
        orderBy: { type: "asc" },
      });
      const recent = await transaction.gamePlay.findMany({
        where: { customerId: customer.id },
        include: { game: true, prize: true },
        orderBy: { playedAt: "desc" },
        take: 20,
      });
      return {
        customerId: customer.id,
        games: games.map((game) => {
          const plays = recent.filter((play) => play.gameId === game.id);
          const lastPlay = plays[0];
          const nextAvailableAt = lastPlay
            ? new Date(lastPlay.playedAt.getTime() + game.cooldownMinutes * 60_000)
            : null;
          const dayStart = new Date(now);
          dayStart.setHours(0, 0, 0, 0);
          const playsToday = plays.filter((play) => play.playedAt >= dayStart).length;
          return {
            id: game.id,
            code: game.code,
            type: game.type,
            title: game.name,
            description: game.description ?? "",
            actionLabel:
              game.type === "SPIN_WHEEL"
                ? "Tourner la roue"
                : game.type === "SCRATCH_CARD"
                  ? "Gratter la carte"
                  : "Ouvrir le coffre",
            prizes: game.prizes.map((prize) => ({
              code: prize.code,
              label: prize.label,
              points: prize.points,
              color: prize.color,
              type: prize.type,
            })),
            eligible:
              playsToday < game.dailyLimit &&
              (!nextAvailableAt || nextAvailableAt.getTime() <= now.getTime()),
            nextAvailableAt,
            playsRemainingToday: Math.max(0, game.dailyLimit - playsToday),
          };
        }),
        history: recent.map((play) => ({
          id: play.id,
          playedAt: play.playedAt,
          gameCode: play.game.code,
          gameType: play.game.type,
          prizeCode: play.prize.code,
          prizeLabel: play.prize.label,
          points: play.pointsAwarded,
          color: play.prize.color,
          status: "COMPLETED" as const,
        })),
      };
    });
  }

  create(input: CreateGameDto) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      if (!this.context.canAccessOrganization(input.organizationId)) return null;
      const program = await transaction.loyaltyProgram.findFirst({
        where: { id: input.programId, organizationId: input.organizationId },
      });
      if (!program) return null;
      const game = await transaction.gameConfiguration.create({
        data: {
          tenantId,
          organizationId: input.organizationId,
          programId: input.programId,
          code: input.code,
          type: input.type,
          name: input.name,
          cooldownMinutes: input.cooldownMinutes,
          dailyLimit: input.dailyLimit,
          settings: input.settings as Prisma.InputJsonValue,
          ...(input.description ? { description: input.description } : {}),
          ...(input.startsAt ? { startsAt: input.startsAt } : {}),
          ...(input.endsAt ? { endsAt: input.endsAt } : {}),
        },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "game.create",
        eventType: "gamification.game.created.v1",
        entityType: "game_configuration",
        entityId: game.id,
        payload: { code: game.code, type: game.type },
      });
      return game;
    });
  }

  update(id: string, input: UpdateGameDto) {
    return this.mutate(id, "game.update", input as Prisma.GameConfigurationUpdateInput);
  }

  changeStatus(id: string, input: GameStatusDto) {
    return this.mutate(id, "game.status", {
      status: input.status,
      ...(input.status === GameStatus.ARCHIVED ? { archivedAt: new Date() } : {}),
    });
  }

  replacePrizes(id: string, input: ReplaceGamePrizesDto) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const game = await this.findAccessibleGame(transaction, id);
      if (!game) return null;
      for (const candidate of input.prizes) {
        if (candidate.rewardId) {
          const reward = await transaction.reward.findFirst({
            where: { id: candidate.rewardId, organizationId: game.organizationId },
          });
          if (!reward)
            throw new ConflictException(
              `Reward ${candidate.rewardId} is outside the game organization`,
            );
        }
      }
      await transaction.gamePrize.updateMany({ where: { gameId: id }, data: { active: false } });
      for (const candidate of input.prizes) {
        await transaction.gamePrize.upsert({
          where: { tenantId_gameId_code: { tenantId, gameId: id, code: candidate.code } },
          create: {
            tenantId,
            gameId: id,
            code: candidate.code,
            label: candidate.label,
            type: candidate.type,
            points: candidate.points,
            probabilityWeight: candidate.probabilityWeight,
            color: candidate.color,
            active: candidate.active,
            metadata: candidate.metadata as Prisma.InputJsonValue,
            ...(candidate.rewardId ? { rewardId: candidate.rewardId } : {}),
            ...(candidate.discountPercent ? { discountPercent: candidate.discountPercent } : {}),
            ...(candidate.stockQuantity !== undefined
              ? { stockQuantity: candidate.stockQuantity }
              : {}),
          },
          update: {
            label: candidate.label,
            type: candidate.type,
            points: candidate.points,
            probabilityWeight: candidate.probabilityWeight,
            color: candidate.color,
            active: candidate.active,
            rewardId: candidate.rewardId ?? null,
            discountPercent: candidate.discountPercent ?? null,
            stockQuantity: candidate.stockQuantity ?? null,
            metadata: candidate.metadata as Prisma.InputJsonValue,
          },
        });
      }
      await appendDomainChange(transaction, tenantId, request, {
        action: "game.prizes.replace",
        eventType: "gamification.game.prizes-configured.v1",
        entityType: "game_configuration",
        entityId: id,
        payload: { prizeCount: input.prizes.length },
      });
      return transaction.gameConfiguration.findUnique({ where: { id }, include: { prizes: true } });
    });
  }

  reserve(code: string, idempotencyKey: string) {
    const tenantId = this.context.tenantId();
    const principal = this.context.authenticatedPrincipal();
    return this.transactions.run(tenantId, async (transaction) => {
      await transaction.$queryRaw`
        SELECT true AS locked FROM pg_advisory_xact_lock(
          hashtextextended(${`${tenantId}:${principal.userId}:${code}`}, 0)
        )
      `;
      const customer = await transaction.customer.findFirst({
        where: { userId: principal.userId, status: CustomerStatus.ACTIVE },
      });
      if (!customer) throw new NotFoundException("Active customer profile not found");

      const replay = await transaction.gamePlay.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
        include: { game: true, prize: true, customer: true, program: true },
      });
      if (replay)
        return {
          play: replay,
          game: replay.game,
          prize: replay.prize,
          customer: replay.customer,
          program: replay.program,
          idempotent: true,
        };

      const now = new Date();
      const game = await transaction.gameConfiguration.findFirst({
        where: {
          code,
          organizationId: customer.organizationId,
          status: GameStatus.ACTIVE,
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
          AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
        },
        include: { prizes: { where: { active: true } } },
      });
      if (!game) throw new NotFoundException("Active game not found for this customer");

      const lastPlay = await transaction.gamePlay.findFirst({
        where: { gameId: game.id, customerId: customer.id },
        orderBy: { playedAt: "desc" },
      });
      if (lastPlay && lastPlay.playedAt.getTime() + game.cooldownMinutes * 60_000 > now.getTime()) {
        throw new ConflictException("Game cooldown is still active");
      }
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      const playsToday = await transaction.gamePlay.count({
        where: { gameId: game.id, customerId: customer.id, playedAt: { gte: dayStart } },
      });
      if (playsToday >= game.dailyLimit) throw new ConflictException("Daily game limit reached");

      const candidates = game.prizes.filter(
        (prize) => prize.stockQuantity === null || prize.stockQuantity > 0,
      );
      if (candidates.length === 0)
        throw new ConflictException("No game prize is currently available");
      const prize = this.pickPrize(candidates);
      if (prize.stockQuantity !== null) {
        const decremented = await transaction.gamePrize.updateMany({
          where: { id: prize.id, stockQuantity: { gt: 0 } },
          data: { stockQuantity: { decrement: 1 } },
        });
        if (decremented.count !== 1)
          throw new ConflictException("Selected prize is no longer available");
      }
      const play = await transaction.gamePlay.create({
        data: {
          tenantId,
          gameId: game.id,
          prizeId: prize.id,
          programId: game.programId,
          customerId: customer.id,
          idempotencyKey,
          pointsAwarded: prize.points,
          metadata: { gameType: game.type, prizeType: prize.type },
        },
      });
      await transaction.customerActivity.create({
        data: {
          tenantId,
          customerId: customer.id,
          type: `game.${game.code}.played`,
          referenceId: play.id,
          metadata: { gameType: game.type, prizeType: prize.type, prizeLabel: prize.label },
        },
      });
      return { play, game, prize, customer, program: { id: game.programId }, idempotent: false };
    });
  }

  private mutate(id: string, action: string, data: Prisma.GameConfigurationUpdateInput) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const game = await this.findAccessibleGame(transaction, id);
      if (!game) return null;
      const updated = await transaction.gameConfiguration.update({ where: { id }, data });
      await appendDomainChange(transaction, tenantId, request, {
        action,
        eventType: "gamification.game.updated.v1",
        entityType: "game_configuration",
        entityId: id,
      });
      return updated;
    });
  }

  private findAccessibleGame(transaction: Prisma.TransactionClient, id: string) {
    const access = this.context.authenticatedPrincipal().access;
    return transaction.gameConfiguration.findFirst({
      where: {
        id,
        ...(!access.tenantWide ? { organizationId: { in: [...access.organizationIds] } } : {}),
      },
    });
  }

  private pickPrize<T extends { probabilityWeight: number }>(prizes: readonly T[]): T {
    const total = prizes.reduce((sum, prize) => sum + prize.probabilityWeight, 0);
    let draw = randomInt(1, total + 1);
    for (const prize of prizes) {
      draw -= prize.probabilityWeight;
      if (draw <= 0) return prize;
    }
    return prizes[0]!;
  }
}
