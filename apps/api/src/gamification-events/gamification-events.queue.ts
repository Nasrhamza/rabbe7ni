import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Injectable } from "@nestjs/common";
import type { Job, Queue } from "bullmq";
import { randomUUID } from "node:crypto";

import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import type { ConsumeGamificationEvent } from "./dto.js";
import { GamificationEventsService } from "./gamification-events.service.js";

export const GAMIFICATION_EVENTS_QUEUE = "gamification-events";

@Injectable()
export class GamificationEventQueue {
  constructor(@InjectQueue(GAMIFICATION_EVENTS_QUEUE) private readonly queue: Queue) {}
  enqueue(tenantId: string, event: ConsumeGamificationEvent) {
    return this.queue.add(
      "consume",
      { tenantId, event },
      {
        jobId: `${tenantId}:${event.eventId}`.replaceAll(":", "-"),
        attempts: 8,
        backoff: { type: "exponential", delay: 1_000 },
        removeOnComplete: 1_000,
        removeOnFail: 5_000,
      },
    );
  }
}

@Processor(GAMIFICATION_EVENTS_QUEUE)
export class GamificationEventProcessor extends WorkerHost {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(GamificationEventsService)
    private readonly events: GamificationEventsService,
  ) {
    super();
  }

  process(job: Job<{ tenantId: string; event: ConsumeGamificationEvent }>) {
    const requestId = randomUUID();
    return this.context.run(
      {
        requestId,
        correlationId: requestId,
        tenantId: job.data.tenantId,
        principal: {
          subject: "gamification-event-worker",
          userId: "00000000-0000-4000-8000-000000000000",
          tenantId: job.data.tenantId,
          membershipId: "00000000-0000-4000-8000-000000000000",
          email: "events@rabbehni.local",
          displayName: "Gamification Event Worker",
          locale: "en",
          permissions: ["gamification.process", "challenge.process", "streak.process"],
          roles: ["system"],
          access: {
            organizationIds: [],
            franchiseIds: [],
            merchantIds: [],
            branchIds: [],
            tenantWide: true,
          },
          authMethod: "bearer",
        },
      },
      () => this.events.process(job.data.event),
    );
  }
}
