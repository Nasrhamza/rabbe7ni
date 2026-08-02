import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { NotificationsController } from "./notifications.controller.js";
import {
  NOTIFICATION_DEAD_LETTER_QUEUE,
  NOTIFICATION_DELIVERY_QUEUE,
  NotificationQueue,
} from "./notifications.queue.js";
import { NotificationsRepository } from "./notifications.repository.js";
import { NotificationsService } from "./notifications.service.js";

@Module({
  imports: [
    BullModule.registerQueue(
      { name: NOTIFICATION_DELIVERY_QUEUE },
      { name: NOTIFICATION_DEAD_LETTER_QUEUE },
    ),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsRepository, NotificationsService, NotificationQueue],
  exports: [NotificationsRepository, NotificationsService, NotificationQueue],
})
export class NotificationsModule {}
