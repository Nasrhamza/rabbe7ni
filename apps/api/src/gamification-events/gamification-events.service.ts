import { Inject, Injectable } from "@nestjs/common";

import { BadgesRepository } from "../badges/badges.repository.js";
import { ChallengesRepository } from "../challenges/challenges.repository.js";
import { ChallengesService } from "../challenges/challenges.service.js";
import { parseDto } from "../common/validation.js";
import { GamificationRepository } from "../gamification/gamification.repository.js";
import { HabitsRepository } from "../habits/habits.repository.js";
import { HabitsService } from "../habits/habits.service.js";
import { consumeGamificationEventSchema, type ConsumeGamificationEvent } from "./dto.js";
import { GamificationEventsRepository } from "./gamification-events.repository.js";

@Injectable()
export class GamificationEventsService {
  constructor(
    @Inject(GamificationEventsRepository)
    private readonly receipts: GamificationEventsRepository,
    @Inject(GamificationRepository)
    private readonly gamification: GamificationRepository,
    @Inject(ChallengesRepository)
    private readonly challenges: ChallengesRepository,
    @Inject(ChallengesService)
    private readonly challengeService: ChallengesService,
    @Inject(HabitsRepository)
    private readonly habits: HabitsRepository,
    @Inject(HabitsService)
    private readonly habitService: HabitsService,
    @Inject(BadgesRepository)
    private readonly badges: BadgesRepository,
  ) {}

  consume(input: never) {
    return this.process(parseDto(consumeGamificationEventSchema, input));
  }

  async process(event: ConsumeGamificationEvent) {
    const started = await this.receipts.begin(event);
    if (started.processed) {
      return { receipt: started.receipt, idempotent: true, effects: [] };
    }
    try {
      const effects: unknown[] = [];
      const xpRules = await this.gamification.rulesForEvent(
        event.customerId,
        event.eventType,
        event.occurredAt,
      );
      for (const rule of xpRules) {
        effects.push(
          await this.gamification.award({
            customerId: event.customerId,
            ruleId: rule.id,
            xp: rule.xp,
            idempotencyKey: `event:${event.eventId}:xp:${rule.id}`,
            referenceType: event.eventType,
            referenceId: event.eventId,
            metadata: event.payload,
          }),
        );
      }

      const challenges = await this.challenges.matchingForEvent(
        event.customerId,
        event.eventType,
        event.occurredAt,
      );
      for (const challenge of challenges) {
        effects.push(
          await this.challengeService.progress(challenge.id, {
            customerId: event.customerId,
            delta: event.delta,
            idempotencyKey: `event:${event.eventId}:challenge:${challenge.id}`,
            source: "EVENT",
            referenceType: event.eventType,
            referenceId: event.eventId,
            metadata: event.payload,
          } as never),
        );
      }

      const habits = await this.habits.matchingHabitsForEvent(
        event.customerId,
        event.eventType,
        event.occurredAt,
      );
      for (const habit of habits) {
        effects.push(
          await this.habitService.progress(habit.id, {
            customerId: event.customerId,
            progress: event.delta,
            idempotencyKey: `event:${event.eventId}:habit:${habit.id}`,
            source: "EVENT",
            occurredAt: event.occurredAt,
            referenceType: event.eventType,
            referenceId: event.eventId,
          } as never),
        );
      }

      const streakRules = await this.habits.matchingStreakRulesForEvent(
        event.customerId,
        event.eventType,
      );
      for (const rule of streakRules) {
        effects.push(
          await this.habits.qualifyStreak(rule.id, {
            customerId: event.customerId,
            idempotencyKey: `event:${event.eventId}:streak:${rule.id}`,
            occurredAt: event.occurredAt,
          }),
        );
      }

      effects.push(
        ...(await this.badges.processAchievementEvent({
          eventId: event.eventId,
          eventType: event.eventType,
          customerId: event.customerId,
          delta: event.delta,
        })),
      );
      const receipt = await this.receipts.complete(started.receipt.id);
      return { receipt, idempotent: false, effects };
    } catch (error) {
      await this.receipts.fail(started.receipt.id, error);
      throw error;
    }
  }
}
