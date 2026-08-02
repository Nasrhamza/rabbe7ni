import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  ChallengeEnrollmentStatus,
  ChallengeRewardType,
  PointsEntryType,
  XpEntryType,
} from "@rabbehni/database";

import { BadgesRepository } from "../badges/badges.repository.js";
import { parseDto } from "../common/validation.js";
import { GamificationRepository } from "../gamification/gamification.repository.js";
import { PointsRepository } from "../points/points.repository.js";
import {
  addChallengeRewardSchema,
  addChallengeScopeSchema,
  challengeIdSchema,
  challengeListSchema,
  createChallengeSchema,
  enrollChallengeSchema,
  progressChallengeSchema,
  updateChallengeSchema,
  validateChallengeSchema,
} from "./dto.js";
import { ChallengesRepository } from "./challenges.repository.js";

@Injectable()
export class ChallengesService {
  constructor(
    @Inject(ChallengesRepository) private readonly challenges: ChallengesRepository,
    @Inject(PointsRepository) private readonly points: PointsRepository,
    @Inject(GamificationRepository) private readonly gamification: GamificationRepository,
    @Inject(BadgesRepository) private readonly badges: BadgesRepository,
  ) {}

  create(input: never) {
    return this.challenges.create(parseDto(createChallengeSchema, input));
  }
  list(input: never = {} as never) {
    return this.challenges.list(parseDto(challengeListSchema, input));
  }
  async detail(id: string) {
    const result = await this.challenges.detail(parseDto(challengeIdSchema, id));
    if (!result) throw new NotFoundException("Challenge not found or outside scope");
    return result;
  }
  async update(id: string, input: never) {
    const result = await this.challenges.update(
      parseDto(challengeIdSchema, id),
      parseDto(updateChallengeSchema, input),
    );
    if (!result) throw new NotFoundException("Challenge not found or outside scope");
    return result;
  }
  addScope(id: string, input: never) {
    return this.challenges.addScope(
      parseDto(challengeIdSchema, id),
      parseDto(addChallengeScopeSchema, input),
    );
  }
  addReward(id: string, input: never) {
    return this.challenges.addReward(
      parseDto(challengeIdSchema, id),
      parseDto(addChallengeRewardSchema, input),
    );
  }
  enroll(id: string, input: never) {
    const dto = parseDto(enrollChallengeSchema, input);
    return this.challenges.enroll(parseDto(challengeIdSchema, id), dto.customerId);
  }
  async progress(id: string, input: never) {
    const result = await this.challenges.progress(
      parseDto(challengeIdSchema, id),
      parseDto(progressChallengeSchema, input),
    );
    const grants = await this.deliverRewards(result.enrollment, result.rewards);
    return { ...result, grants };
  }
  async validate(enrollmentId: string, input: never) {
    const dto = parseDto(validateChallengeSchema, input);
    const result = await this.challenges.validate(
      parseDto(challengeIdSchema, enrollmentId),
      dto.approved,
      dto.reason,
    );
    if (!result) throw new NotFoundException("Challenge enrollment not found or outside scope");
    const grants = await this.deliverRewards(result.enrollment, result.rewards);
    return { ...result, grants };
  }
  async cancelEnrollment(id: string) {
    const result = await this.challenges.setEnrollmentStatus(
      parseDto(challengeIdSchema, id),
      ChallengeEnrollmentStatus.CANCELED,
    );
    if (!result) throw new NotFoundException("Challenge enrollment not found or outside scope");
    return result;
  }
  expireDue() {
    return this.challenges.expireDue(new Date());
  }

  private async deliverRewards(
    enrollment: { id: string; challengeId: string; customerId: string },
    rewards: readonly {
      id: string;
      type: ChallengeRewardType;
      amount: number | null;
      badgeId: string | null;
      loyaltyProgramId: string | null;
      metadata: unknown;
    }[],
  ) {
    const grants = [];
    for (const reward of rewards) {
      const idempotencyKey = `challenge:${enrollment.id}:${reward.id}`;
      let pointsEntryId: string | undefined;
      let xpEntryId: string | undefined;
      let customerBadgeId: string | undefined;
      if (reward.type === ChallengeRewardType.POINTS && reward.amount && reward.loyaltyProgramId) {
        const result = await this.points.post({
          customerId: enrollment.customerId,
          programId: reward.loyaltyProgramId,
          type: PointsEntryType.EARN,
          points: reward.amount,
          idempotencyKey,
          referenceType: "challenge_reward",
          referenceId: enrollment.challengeId,
          metadata: { challengeRewardId: reward.id },
        });
        pointsEntryId = result.entry.id;
      }
      if (reward.type === ChallengeRewardType.XP && reward.amount) {
        const result = await this.gamification.postXp({
          customerId: enrollment.customerId,
          type: XpEntryType.AWARD,
          xp: reward.amount,
          idempotencyKey,
          referenceType: "challenge_reward",
          referenceId: enrollment.challengeId,
          metadata: { challengeRewardId: reward.id },
        });
        xpEntryId = result.entry.id;
      }
      if (reward.type === ChallengeRewardType.BADGE && reward.badgeId) {
        const result = await this.badges.award({
          customerId: enrollment.customerId,
          badgeId: reward.badgeId,
          idempotencyKey,
          metadata: { challengeId: enrollment.challengeId, challengeRewardId: reward.id },
        });
        customerBadgeId = result.award.id;
      }
      grants.push(
        await this.challenges.recordGrant({
          challengeId: enrollment.challengeId,
          rewardId: reward.id,
          enrollmentId: enrollment.id,
          customerId: enrollment.customerId,
          idempotencyKey,
          ...(pointsEntryId ? { pointsEntryId } : {}),
          ...(xpEntryId ? { xpEntryId } : {}),
          ...(customerBadgeId ? { customerBadgeId } : {}),
        }),
      );
    }
    return grants;
  }
}
