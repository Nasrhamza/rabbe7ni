import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { BadgesModule } from "../badges/badges.module.js";
import { ChallengesModule } from "../challenges/challenges.module.js";
import { GamificationModule } from "../gamification/gamification.module.js";
import { HabitsModule } from "../habits/habits.module.js";
import { GamificationEventsController } from "./gamification-events.controller.js";
import {
  GAMIFICATION_EVENTS_QUEUE,
  GamificationEventProcessor,
  GamificationEventQueue,
} from "./gamification-events.queue.js";
import { GamificationEventsRepository } from "./gamification-events.repository.js";
import { GamificationEventsService } from "./gamification-events.service.js";

@Module({
  imports: [
    BullModule.registerQueue({ name: GAMIFICATION_EVENTS_QUEUE }),
    GamificationModule,
    ChallengesModule,
    HabitsModule,
    BadgesModule,
  ],
  controllers: [GamificationEventsController],
  providers: [
    GamificationEventsRepository,
    GamificationEventsService,
    GamificationEventQueue,
    GamificationEventProcessor,
  ],
})
export class GamificationEventsModule {}
