import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PointsEntryType } from "@rabbehni/database";

import { parseDto } from "../common/validation.js";
import { PointsService } from "../points/points.service.js";
import { RewardsService } from "../rewards/rewards.service.js";
import {
  createGameSchema,
  gameCodeSchema,
  gameStatusSchema,
  playGameSchema,
  replaceGamePrizesSchema,
  updateGameSchema,
} from "./dto.js";
import { GamesRepository } from "./games.repository.js";

@Injectable()
export class GamesService {
  constructor(
    @Inject(GamesRepository) private readonly games: GamesRepository,
    @Inject(PointsService) private readonly points: PointsService,
    @Inject(RewardsService) private readonly rewards: RewardsService,
  ) {}

  list(management = false) {
    return this.games.list(management);
  }

  async get(id: string) {
    const result = await this.games.get(id);
    if (!result) throw new NotFoundException("Game not found in the authorized scope");
    return result;
  }

  async create(input: unknown) {
    const result = await this.games.create(parseDto(createGameSchema, input));
    if (!result)
      throw new NotFoundException("Program or organization not found in the authorized scope");
    return result;
  }

  async update(id: string, input: unknown) {
    const result = await this.games.update(id, parseDto(updateGameSchema, input));
    if (!result) throw new NotFoundException("Game not found in the authorized scope");
    return result;
  }

  async changeStatus(id: string, input: unknown) {
    const result = await this.games.changeStatus(id, parseDto(gameStatusSchema, input));
    if (!result) throw new NotFoundException("Game not found in the authorized scope");
    return result;
  }

  async replacePrizes(id: string, input: unknown) {
    const result = await this.games.replacePrizes(id, parseDto(replaceGamePrizesSchema, input));
    if (!result) throw new NotFoundException("Game not found in the authorized scope");
    return result;
  }

  async play(rawCode: string, input: unknown) {
    const code = parseDto(gameCodeSchema, rawCode);
    const dto = parseDto(playGameSchema, input);
    const reservation = await this.games.reserve(code, dto.idempotencyKey);
    let balance: number | undefined;
    let operation: unknown;

    if (reservation.prize.type === "POINTS") {
      const awarded = await this.points.postOperation({
        customerId: reservation.customer.id,
        programId: reservation.program.id,
        type: PointsEntryType.EARN,
        points: reservation.prize.points,
        idempotencyKey: `game:${reservation.play.id}`,
        referenceType: "game_play",
        referenceId: reservation.play.id,
        metadata: {
          gameCode: reservation.game.code,
          gameType: reservation.game.type,
          prizeCode: reservation.prize.code,
          source: "customer-game-center",
        },
      });
      balance = awarded.balance;
      operation = awarded.entry;
    } else if (
      (reservation.prize.type === "REWARD" || reservation.prize.type === "DISCOUNT") &&
      reservation.prize.rewardId
    ) {
      operation = await this.rewards.grantInstant({
        customerId: reservation.customer.id,
        rewardId: reservation.prize.rewardId,
        quantity: 1,
        idempotencyKey: `game:${reservation.play.id}`,
        metadata: {
          gameCode: reservation.game.code,
          gameType: reservation.game.type,
          prizeCode: reservation.prize.code,
          source: "customer-game-center",
        },
      } as never);
    }

    return {
      playId: reservation.play.id,
      gameCode: reservation.game.code,
      gameType: reservation.game.type,
      prize: {
        code: reservation.prize.code,
        label: reservation.prize.label,
        type: reservation.prize.type,
        points: reservation.prize.points,
        color: reservation.prize.color,
      },
      operation,
      balance,
      idempotent: reservation.idempotent,
    };
  }
}
