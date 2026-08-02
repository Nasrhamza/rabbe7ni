import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Injectable } from "@nestjs/common";
import type { Job, Queue } from "bullmq";
import { randomUUID } from "node:crypto";

import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import { SegmentsRepository } from "./segments.repository.js";

export const SEGMENT_QUEUE = "segment-refresh";

@Injectable()
export class SegmentScheduler {
  constructor(@InjectQueue(SEGMENT_QUEUE) private readonly queue: Queue) {}

  schedule(tenantId: string, segmentId: string, pattern: string) {
    return this.queue.upsertJobScheduler(
      `segment:${tenantId}:${segmentId}`,
      { pattern },
      {
        name: "refresh",
        data: { tenantId, segmentId },
        opts: { attempts: 5, backoff: { type: "exponential", delay: 2_000 } },
      },
    );
  }

  unschedule(tenantId: string, segmentId: string) {
    return this.queue.removeJobScheduler(`segment:${tenantId}:${segmentId}`);
  }
}

@Processor(SEGMENT_QUEUE)
export class SegmentRefreshProcessor extends WorkerHost {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(SegmentsRepository) private readonly segments: SegmentsRepository,
  ) {
    super();
  }

  process(job: Job<{ tenantId: string; segmentId: string }>) {
    const requestId = randomUUID();
    return this.context.run(
      {
        requestId,
        correlationId: requestId,
        tenantId: job.data.tenantId,
        principal: {
          subject: "segment-scheduler",
          userId: "00000000-0000-4000-8000-000000000000",
          tenantId: job.data.tenantId,
          membershipId: "00000000-0000-4000-8000-000000000000",
          email: "segments@rabbehni.local",
          displayName: "Segment Scheduler",
          locale: "en",
          permissions: ["segment.manage"],
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
      () => this.segments.refresh(job.data.segmentId),
    );
  }
}
