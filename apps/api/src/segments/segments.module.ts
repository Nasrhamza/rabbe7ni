import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { SegmentsController } from "./segments.controller.js";
import { SegmentsRepository } from "./segments.repository.js";
import { SEGMENT_QUEUE, SegmentRefreshProcessor, SegmentScheduler } from "./segments.scheduler.js";
import { SegmentsService } from "./segments.service.js";

@Module({
  imports: [BullModule.registerQueue({ name: SEGMENT_QUEUE })],
  controllers: [SegmentsController],
  providers: [SegmentsRepository, SegmentsService, SegmentScheduler, SegmentRefreshProcessor],
  exports: [SegmentsRepository, SegmentsService],
})
export class SegmentsModule {}
