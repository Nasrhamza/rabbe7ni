import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { parseDto } from "../common/validation.js";
import {
  createEarningRuleSchema,
  createLoyaltyProgramSchema,
  createRedemptionRuleSchema,
  loyaltyProgramIdSchema,
  loyaltyProgramListSchema,
  loyaltyProgramStatusSchema,
  loyaltyRuleIdSchema,
  updateEarningRuleSchema,
  updateLoyaltyProgramSchema,
  updateRedemptionRuleSchema,
} from "./dto.js";
import { LoyaltyRepository } from "./loyalty.repository.js";

@Injectable()
export class LoyaltyService {
  constructor(@Inject(LoyaltyRepository) private readonly loyalty: LoyaltyRepository) {}
  async create(input: never) {
    return this.require(await this.loyalty.create(parseDto(createLoyaltyProgramSchema, input)));
  }
  list(input: never = {} as never) {
    return this.loyalty.list(parseDto(loyaltyProgramListSchema, input));
  }
  async get(id: string) {
    return this.require(await this.loyalty.findById(parseDto(loyaltyProgramIdSchema, id)));
  }
  async update(id: string, input: never) {
    return this.require(
      await this.loyalty.update(
        parseDto(loyaltyProgramIdSchema, id),
        parseDto(updateLoyaltyProgramSchema, input),
      ),
    );
  }
  async status(id: string, input: never) {
    const dto = parseDto(loyaltyProgramStatusSchema, input);
    return this.require(
      await this.loyalty.changeStatus(parseDto(loyaltyProgramIdSchema, id), dto.status),
    );
  }
  async archive(id: string) {
    return this.require(await this.loyalty.archive(parseDto(loyaltyProgramIdSchema, id)));
  }
  async createEarningRule(programId: string, input: never) {
    return this.require(
      await this.loyalty.createEarningRule(
        parseDto(loyaltyProgramIdSchema, programId),
        parseDto(createEarningRuleSchema, input),
      ),
    );
  }
  async updateEarningRule(programId: string, ruleId: string, input: never) {
    return this.require(
      await this.loyalty.updateEarningRule(
        parseDto(loyaltyProgramIdSchema, programId),
        parseDto(loyaltyRuleIdSchema, ruleId),
        parseDto(updateEarningRuleSchema, input),
      ),
    );
  }
  async createRedemptionRule(programId: string, input: never) {
    return this.require(
      await this.loyalty.createRedemptionRule(
        parseDto(loyaltyProgramIdSchema, programId),
        parseDto(createRedemptionRuleSchema, input),
      ),
    );
  }
  async updateRedemptionRule(programId: string, ruleId: string, input: never) {
    return this.require(
      await this.loyalty.updateRedemptionRule(
        parseDto(loyaltyProgramIdSchema, programId),
        parseDto(loyaltyRuleIdSchema, ruleId),
        parseDto(updateRedemptionRuleSchema, input),
      ),
    );
  }
  private require<T>(value: T | null): T {
    if (!value) throw new NotFoundException("Loyalty resource not found or outside scope");
    return value;
  }
}
