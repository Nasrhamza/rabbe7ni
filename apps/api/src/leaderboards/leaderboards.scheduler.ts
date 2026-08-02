import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Injectable } from "@nestjs/common";
import type { Job, Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";
import { randomUUID } from "node:crypto";

import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import { LeaderboardsRepository } from "./leaderboards.repository.js";

export const LEADERBOARD_QUEUE = "leaderboards";

@Injectable()
export class LeaderboardScheduler {
  constructor(@InjectQueue(LEADERBOARD_QUEUE) private readonly queue: Queue) {}

  schedule(tenantId: string, configId: string, pattern: string) {
    return this.queue.upsertJobScheduler(
      `leaderboard:${tenantId}:${configId}`,
      { pattern },
      {
        name: "snapshot",
        data: { tenantId, configId },
        opts: { removeOnComplete: 100, removeOnFail: 500 },
      },
    );
  }
}

@Processor(LEADERBOARD_QUEUE)
export class LeaderboardProcessor extends WorkerHost {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(LeaderboardsRepository) private readonly leaderboards: LeaderboardsRepository,
  ) {
    super();
  }

  process(job: Job<{ tenantId: string; configId: string }>) {
    const requestId = randomUUID();
    return this.context.run(
      {
        requestId,
        correlationId: requestId,
        tenantId: job.data.tenantId,
        principal: {
          subject: "leaderboard-scheduler",
          userId: "00000000-0000-4000-8000-000000000000",
          tenantId: job.data.tenantId,
          membershipId: "00000000-0000-4000-8000-000000000000",
          email: "scheduler@rabbehni.local",
          displayName: "Leaderboard Scheduler",
          locale: "en",
          permissions: ["leaderboard.process"],
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
      () => this.leaderboards.snapshot(job.data.configId, new Date()),
    );
  }
}
