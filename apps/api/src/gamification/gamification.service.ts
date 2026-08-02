import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { parseDto } from "../common/validation.js";
import {
  adjustXpSchema,
  awardXpSchema,
  createLevelSchema,
  createXpRuleSchema,
  gamificationConfigSchema,
  gamificationIdSchema,
  privacySchema,
  profileQuerySchema,
  reverseXpSchema,
  updateLevelSchema,
  updateXpRuleSchema,
  xpListSchema,
} from "./dto.js";
import { GamificationRepository } from "./gamification.repository.js";

@Injectable()
export class GamificationService {
  constructor(
    @Inject(GamificationRepository) private readonly gamification: GamificationRepository,
  ) {}

  config() {
    return this.gamification.getConfig();
  }
  updateConfig(input: never) {
    return this.gamification.upsertConfig(parseDto(gamificationConfigSchema, input));
  }
  rules() {
    return this.gamification.listRules();
  }
  createRule(input: never) {
    return this.gamification.createRule(parseDto(createXpRuleSchema, input));
  }
  async updateRule(id: string, input: never) {
    const result = await this.gamification.updateRule(
      parseDto(gamificationIdSchema, id),
      parseDto(updateXpRuleSchema, input),
    );
    if (!result) throw new NotFoundException("XP rule not found or outside scope");
    return result;
  }
  levels() {
    return this.gamification.listLevels();
  }
  createLevel(input: never) {
    return this.gamification.createLevel(parseDto(createLevelSchema, input));
  }
  async updateLevel(id: string, input: never) {
    const result = await this.gamification.updateLevel(
      parseDto(gamificationIdSchema, id),
      parseDto(updateLevelSchema, input),
    );
    if (!result) throw new NotFoundException("Level not found");
    return result;
  }
  award(input: never) {
    return this.gamification.award(parseDto(awardXpSchema, input));
  }
  adjust(input: never) {
    return this.gamification.adjust(parseDto(adjustXpSchema, input));
  }
  async reverse(id: string, input: never) {
    const dto = parseDto(reverseXpSchema, input);
    const result = await this.gamification.reverse(
      parseDto(gamificationIdSchema, id),
      dto.idempotencyKey,
      dto.reason,
    );
    if (!result) throw new NotFoundException("XP entry not found or outside scope");
    return result;
  }
  async profile(input: never) {
    const dto = parseDto(profileQuerySchema, input);
    const result = await this.gamification.profile(dto.customerId);
    if (!result) throw new NotFoundException("Customer profile not found or outside scope");
    return result;
  }
  async privacy(input: never) {
    const result = await this.gamification.updatePrivacy(parseDto(privacySchema, input));
    if (!result) throw new NotFoundException("Customer profile not found or outside scope");
    return result;
  }
  transactions(input: never = {} as never) {
    return this.gamification.listXp(parseDto(xpListSchema, input));
  }
}
