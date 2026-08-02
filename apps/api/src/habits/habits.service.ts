import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ChallengeRewardType, PointsEntryType, XpEntryType } from "@rabbehni/database";

import { BadgesRepository } from "../badges/badges.repository.js";
import { parseDto } from "../common/validation.js";
import { GamificationRepository } from "../gamification/gamification.repository.js";
import { PointsRepository } from "../points/points.repository.js";
import {
  createHabitSchema,
  enrollHabitSchema,
  habitCalendarSchema,
  habitIdSchema,
  habitListSchema,
  habitProgressSchema,
  qualifyStreakSchema,
  streakRuleSchema,
  updateHabitSchema,
} from "./dto.js";
import { HabitsRepository } from "./habits.repository.js";

@Injectable()
export class HabitsService {
  constructor(
    @Inject(HabitsRepository) private readonly habits: HabitsRepository,
    @Inject(PointsRepository) private readonly points: PointsRepository,
    @Inject(GamificationRepository) private readonly gamification: GamificationRepository,
    @Inject(BadgesRepository) private readonly badges: BadgesRepository,
  ) {}
  create(input: never) {
    return this.habits.create(parseDto(createHabitSchema, input));
  }
  list(input: never = {} as never) {
    return this.habits.list(parseDto(habitListSchema, input));
  }
  async detail(id: string) {
    const result = await this.habits.detail(parseDto(habitIdSchema, id));
    if (!result) throw new NotFoundException("Habit not found or outside scope");
    return result;
  }
  update(id: string, input: never) {
    return this.habits.update(parseDto(habitIdSchema, id), parseDto(updateHabitSchema, input));
  }
  enroll(id: string, input: never) {
    const dto = parseDto(enrollHabitSchema, input);
    return this.habits.enroll(parseDto(habitIdSchema, id), dto.customerId);
  }
  async progress(id: string, input: never) {
    const result = await this.habits.progress(
      parseDto(habitIdSchema, id),
      parseDto(habitProgressSchema, input),
    );
    const grants = [];
    for (const milestone of result.milestones) {
      const key = `habit:${result.customerHabit?.id}:milestone:${milestone.id}`;
      if (
        milestone.rewardType === ChallengeRewardType.POINTS &&
        milestone.rewardAmount &&
        milestone.loyaltyProgramId
      ) {
        grants.push(
          await this.points.post({
            customerId: result.completion.customerId,
            programId: milestone.loyaltyProgramId,
            type: PointsEntryType.EARN,
            points: milestone.rewardAmount,
            idempotencyKey: key,
            referenceType: "habit_milestone",
            referenceId: milestone.id,
          }),
        );
      }
      if (milestone.rewardType === ChallengeRewardType.XP && milestone.rewardAmount) {
        grants.push(
          await this.gamification.postXp({
            customerId: result.completion.customerId,
            type: XpEntryType.AWARD,
            xp: milestone.rewardAmount,
            idempotencyKey: key,
            referenceType: "habit_milestone",
            referenceId: milestone.id,
          }),
        );
      }
      if (milestone.rewardType === ChallengeRewardType.BADGE && milestone.badgeId) {
        grants.push(
          await this.badges.award({
            customerId: result.completion.customerId,
            badgeId: milestone.badgeId,
            idempotencyKey: key,
            metadata: { habitMilestoneId: milestone.id },
          }),
        );
      }
    }
    return { ...result, grants };
  }
  async calendar(input: never) {
    const result = await this.habits.calendar(parseDto(habitCalendarSchema, input));
    if (!result) throw new NotFoundException("Customer not found or outside scope");
    return result;
  }
  createStreakRule(input: never) {
    return this.habits.createStreakRule(parseDto(streakRuleSchema, input));
  }
  streakRules() {
    return this.habits.listStreakRules();
  }
  qualifyStreak(id: string, input: never) {
    return this.habits.qualifyStreak(
      parseDto(habitIdSchema, id),
      parseDto(qualifyStreakSchema, input),
    );
  }
  async customerStreaks(id: string) {
    const result = await this.habits.customerStreaks(parseDto(habitIdSchema, id));
    if (!result) throw new NotFoundException("Customer not found or outside scope");
    return result;
  }
}
