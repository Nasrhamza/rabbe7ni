import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { parseDto } from "../common/validation.js";
import {
  achievementRuleSchema,
  awardBadgeSchema,
  badgeCategorySchema,
  badgeCollectionSchema,
  badgeIdSchema,
  badgeListSchema,
  badgeSchema,
  revokeBadgeSchema,
  updateBadgeSchema,
} from "./dto.js";
import { BadgesRepository } from "./badges.repository.js";

@Injectable()
export class BadgesService {
  constructor(@Inject(BadgesRepository) private readonly badges: BadgesRepository) {}
  categories() {
    return this.badges.listCategories();
  }
  createCategory(input: never) {
    return this.badges.createCategory(parseDto(badgeCategorySchema, input));
  }
  list(input: never = {} as never) {
    return this.badges.listBadges(parseDto(badgeListSchema, input));
  }
  create(input: never) {
    return this.badges.createBadge(parseDto(badgeSchema, input));
  }
  async update(id: string, input: never) {
    const result = await this.badges.updateBadge(
      parseDto(badgeIdSchema, id),
      parseDto(updateBadgeSchema, input),
    );
    if (!result) throw new NotFoundException("Badge not found or outside scope");
    return result;
  }
  createRule(input: never) {
    return this.badges.createAchievementRule(parseDto(achievementRuleSchema, input));
  }
  award(input: never) {
    return this.badges.award(parseDto(awardBadgeSchema, input));
  }
  async revoke(id: string, input: never) {
    const dto = parseDto(revokeBadgeSchema, input);
    const result = await this.badges.revoke(parseDto(badgeIdSchema, id), dto.reason);
    if (!result) throw new NotFoundException("Badge award not found or outside scope");
    return result;
  }
  async collection(input: never) {
    const result = await this.badges.collection(parseDto(badgeCollectionSchema, input));
    if (!result) throw new NotFoundException("Customer not found or outside scope");
    return result;
  }
}
