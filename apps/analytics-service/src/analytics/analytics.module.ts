import { Module } from "@nestjs/common";

import { AnalyticsController } from "./analytics.controller.js";
import { AnalyticsRepository } from "./analytics.repository.js";
import { BackfillService } from "./backfill.service.js";

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsRepository, BackfillService],
  exports: [AnalyticsRepository],
})
export class AnalyticsModule {}
