import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import type { Queue } from "bullmq";

export const NOTIFICATION_DELIVERY_QUEUE = "notification-delivery";
export const NOTIFICATION_DEAD_LETTER_QUEUE = "notification-dead-letter";

@Injectable()
export class NotificationQueue {
  constructor(
    @InjectQueue(NOTIFICATION_DELIVERY_QUEUE) private readonly deliveryQueue: Queue,
    @InjectQueue(NOTIFICATION_DEAD_LETTER_QUEUE) private readonly deadLetterQueue: Queue,
  ) {}

  enqueue(tenantId: string, deliveryId: string, scheduledAt: Date) {
    return this.deliveryQueue.add(
      "deliver",
      { tenantId, deliveryId },
      {
        jobId: `notification-${tenantId}-${deliveryId}`,
        delay: Math.max(0, scheduledAt.getTime() - Date.now()),
        attempts: 5,
        backoff: { type: "exponential", delay: 2_000 },
        removeOnComplete: 1_000,
        removeOnFail: 5_000,
      },
    );
  }

  retry(tenantId: string, deliveryId: string) {
    return this.deliveryQueue.add(
      "deliver",
      { tenantId, deliveryId },
      {
        jobId: `notification-retry-${tenantId}-${deliveryId}-${Date.now()}`,
        attempts: 5,
        backoff: { type: "exponential", delay: 2_000 },
      },
    );
  }

  deadLetter(tenantId: string, deliveryId: string, reason: string) {
    return this.deadLetterQueue.add(
      "dead-letter",
      { tenantId, deliveryId, reason },
      { jobId: `notification-dlq-${tenantId}-${deliveryId}` },
    );
  }
}
