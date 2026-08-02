import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { AnalyticsModule } from "../analytics/analytics.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { ReportsController } from "./reports.controller.js";
import { REPORT_QUEUE, ReportProcessor, ReportQueue } from "./reports.queue.js";
import { ReportsRepository } from "./reports.repository.js";
import { ReportsService } from "./reports.service.js";

@Module({
  imports: [BullModule.registerQueue({ name: REPORT_QUEUE }), AnalyticsModule, NotificationsModule],
  controllers: [ReportsController],
  providers: [ReportsRepository, ReportsService, ReportQueue, ReportProcessor],
})
export class ReportsModule {}
