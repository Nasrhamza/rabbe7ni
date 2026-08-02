import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Injectable } from "@nestjs/common";
import type { Job, Queue } from "bullmq";
import { randomUUID } from "node:crypto";

import type { MarketingDomainEvent } from "../automations/dto.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import { MarketingEventsService } from "./marketing-events.service.js";

export const MARKETING_EVENTS_QUEUE = "marketing-events";

@Injectable()
export class MarketingEventsQueue {
  constructor(@InjectQueue(MARKETING_EVENTS_QUEUE) private readonly queue: Queue) {}

  enqueue(tenantId: string, event: MarketingDomainEvent) {
    return this.queue.add(
      "consume",
      { tenantId, event },
      {
        jobId: `marketing-event-${tenantId}-${event.eventId}`.replaceAll(":", "-"),
        attempts: 8,
        backoff: { type: "exponential", delay: 2_000 },
        removeOnComplete: 1_000,
        removeOnFail: 5_000,
      },
    );
  }
}

@Processor(MARKETING_EVENTS_QUEUE)
export class MarketingEventsProcessor extends WorkerHost {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(MarketingEventsService) private readonly events: MarketingEventsService,
  ) {
    super();
  }

  process(job: Job<{ tenantId: string; event: MarketingDomainEvent }>) {
    const requestId = randomUUID();
    return this.context.run(
      {
        requestId,
        correlationId: requestId,
        tenantId: job.data.tenantId,
        principal: {
          subject: "marketing-event-worker",
          userId: "00000000-0000-4000-8000-000000000000",
          tenantId: job.data.tenantId,
          membershipId: "00000000-0000-4000-8000-000000000000",
          email: "marketing-events@rabbehni.local",
          displayName: "Marketing Event Worker",
          locale: "en",
          permissions: ["automation.process"],
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
