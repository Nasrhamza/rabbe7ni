import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";

import {
  ANALYTICS_AI_QUEUE,
  AnalyticsAiProcessor,
  AnalyticsAiQueue,
} from "./analytics-ai.queue.js";
import { AnalyticsController } from "./analytics.controller.js";
import { AnalyticsGateway } from "./analytics.gateway.js";
import { AnalyticsService } from "./analytics.service.js";

@Module({
  imports: [BullModule.registerQueue({ name: ANALYTICS_AI_QUEUE })],
  controllers: [AnalyticsController],
  providers: [AnalyticsGateway, AnalyticsService, AnalyticsAiQueue, AnalyticsAiProcessor],
  exports: [AnalyticsGateway],
})
export class AnalyticsModule {}
