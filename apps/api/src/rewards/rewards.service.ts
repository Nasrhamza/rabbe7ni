import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { RewardRedemptionStatus } from "@rabbehni/database";
import { z } from "zod";

import { parseDto } from "../common/validation.js";
import {
  createRewardCategorySchema,
  createRewardSchema,
  redeemRewardSchema,
  redemptionListSchema,
  reverseRedemptionSchema,
  rewardIdSchema,
  rewardListSchema,
  rewardRedemptionIdSchema,
  rewardStatusSchema,
  rewardStockSchema,
  updateRewardSchema,
} from "./dto.js";
import { RewardsRepository } from "./rewards.repository.js";

@Injectable()
export class RewardsService {
  constructor(@Inject(RewardsRepository) private readonly rewards: RewardsRepository) {}
  async createCategory(input: never) {
    return this.require(
      await this.rewards.createCategory(parseDto(createRewardCategorySchema, input)),
    );
  }
  listCategories(organizationId?: string) {
    return this.rewards.listCategories(
      organizationId ? parseDto(z.uuid(), organizationId) : undefined,
    );
  }
  async create(input: never) {
    return this.require(await this.rewards.create(parseDto(createRewardSchema, input)));
  }
  list(input: never = {} as never) {
    return this.rewards.list(parseDto(rewardListSchema, input));
  }
  async get(id: string) {
    return this.require(await this.rewards.findById(parseDto(rewardIdSchema, id)));
  }
  async update(id: string, input: never) {
    return this.require(
      await this.rewards.update(parseDto(rewardIdSchema, id), parseDto(updateRewardSchema, input)),
    );
  }
  async status(id: string, input: never) {
    const dto = parseDto(rewardStatusSchema, input);
    return this.require(await this.rewards.changeStatus(parseDto(rewardIdSchema, id), dto.status));
  }
  async stock(id: string, input: never) {
    const dto = parseDto(rewardStockSchema, input);
    return this.require(
      await this.rewards.updateStock(
        parseDto(rewardIdSchema, id),
        dto.stockQuantity,
        dto.unlimitedStock,
      ),
    );
  }
  async archive(id: string) {
    return this.require(await this.rewards.archive(parseDto(rewardIdSchema, id)));
  }
  redeem(input: never) {
    return this.rewards.redeem(parseDto(redeemRewardSchema, input));
  }
  grantInstant(input: never) {
    return this.rewards.grantInstant(parseDto(redeemRewardSchema, input));
  }
  listRedemptions(input: never = {} as never) {
    return this.rewards.listRedemptions(parseDto(redemptionListSchema, input));
  }
  async cancel(id: string, input: never) {
    return this.reverse(id, input, RewardRedemptionStatus.CANCELED);
  }
  async reverse(
    id: string,
    input: never,
    status: "CANCELED" | "REVERSED" = RewardRedemptionStatus.REVERSED,
  ) {
    const dto = parseDto(reverseRedemptionSchema, input);
    return this.require(
      await this.rewards.reverseRedemption(
        parseDto(rewardRedemptionIdSchema, id),
        dto.idempotencyKey,
        dto.reason,
        status,
      ),
    );
  }
  private require<T>(value: T | null): T {
    if (!value) throw new NotFoundException("Reward resource not found or outside scope");
    return value;
  }
}
