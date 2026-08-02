import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Injectable } from "@nestjs/common";
import type { Job, Queue } from "bullmq";
import { randomUUID } from "node:crypto";

import { parseDto } from "../common/validation.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import { AnalyticsService } from "./analytics.service.js";
import { insightSchema } from "./dto.js";

export const ANALYTICS_AI_QUEUE = "analytics-ai";

@Injectable()
export class AnalyticsAiQueue {
  constructor(
    @InjectQueue(ANALYTICS_AI_QUEUE) private readonly queue: Queue,
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
  ) {}

  async enqueue(input: unknown) {
    const dto = parseDto(insightSchema, input);
    const tenantId = this.context.tenantId();
    const job = await this.queue.add(
      "analyze",
      { tenantId, input: dto },
      {
        jobId: `ai:${tenantId}:${dto.idempotencyKey}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 1_000 },
        removeOnComplete: 1_000,
        removeOnFail: 5_000,
      },
    );
    return { jobId: job.id, status: "QUEUED" as const };
  }
}

@Processor(ANALYTICS_AI_QUEUE)
export class AnalyticsAiProcessor extends WorkerHost {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(AnalyticsService) private readonly analytics: AnalyticsService,
  ) {
    super();
  }

  process(job: Job<{ tenantId: string; input: unknown }>) {
    const requestId = randomUUID();
    return this.context.run(
      {
        requestId,
        correlationId: requestId,
        tenantId: job.data.tenantId,
        principal: {
          subject: "analytics-ai-worker",
          userId: "00000000-0000-4000-8000-000000000000",
          tenantId: job.data.tenantId,
          membershipId: "00000000-0000-4000-8000-000000000000",
          email: "ai-worker@rabbehni.local",
          displayName: "Analytics AI Worker",
          locale: "en",
          permissions: ["analytics.read", "ai.request"],
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
      () => this.analytics.insight(job.data.input as never),
    );
  }
}
