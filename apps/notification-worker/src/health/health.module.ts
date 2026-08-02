import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { TECHNICAL_NOTIFICATION_QUEUE } from "@rabbehni/queue";

import { HealthController } from "./health.controller.js";

@Module({
  imports: [
    TerminusModule,
    BullModule.registerQueue({
      name: TECHNICAL_NOTIFICATION_QUEUE,
    }),
  ],
  controllers: [HealthController],
})
export class HealthModule {}
