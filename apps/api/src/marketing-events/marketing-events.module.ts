import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { AutomationsModule } from "../automations/automations.module.js";
import { MarketingEventsController } from "./marketing-events.controller.js";
import {
  MARKETING_EVENTS_QUEUE,
  MarketingEventsProcessor,
  MarketingEventsQueue,
} from "./marketing-events.queue.js";
import { MarketingEventsRepository } from "./marketing-events.repository.js";
import { MarketingEventsService } from "./marketing-events.service.js";

@Module({
  imports: [BullModule.registerQueue({ name: MARKETING_EVENTS_QUEUE }), AutomationsModule],
  controllers: [MarketingEventsController],
  providers: [
    MarketingEventsRepository,
    MarketingEventsService,
    MarketingEventsQueue,
    MarketingEventsProcessor,
  ],
})
export class MarketingEventsModule {}
