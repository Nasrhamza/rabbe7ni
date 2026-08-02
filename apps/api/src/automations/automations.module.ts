import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { BadgesModule } from "../badges/badges.module.js";
import { GamificationModule } from "../gamification/gamification.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { PointsModule } from "../points/points.module.js";
import { AutomationsController } from "./automations.controller.js";
import {
  AUTOMATION_DEAD_LETTER_QUEUE,
  AUTOMATION_QUEUE,
  AutomationProcessor,
  AutomationQueue,
} from "./automations.queue.js";
import { AutomationsRepository } from "./automations.repository.js";
import { AutomationRunner } from "./automations.runner.js";
import {
  AUTOMATION_SCHEDULER_QUEUE,
  AutomationScheduler,
  ScheduledAutomationProcessor,
} from "./automations.scheduler.js";
import { AutomationsService } from "./automations.service.js";

@Module({
  imports: [
    BullModule.registerQueue(
      { name: AUTOMATION_QUEUE },
      { name: AUTOMATION_DEAD_LETTER_QUEUE },
      { name: AUTOMATION_SCHEDULER_QUEUE },
    ),
    NotificationsModule,
    PointsModule,
    GamificationModule,
    BadgesModule,
  ],
  controllers: [AutomationsController],
  providers: [
    AutomationsRepository,
    AutomationsService,
    AutomationQueue,
    AutomationRunner,
    AutomationProcessor,
    AutomationScheduler,
    ScheduledAutomationProcessor,
  ],
  exports: [AutomationsRepository, AutomationsService, AutomationQueue],
})
export class AutomationsModule {}
