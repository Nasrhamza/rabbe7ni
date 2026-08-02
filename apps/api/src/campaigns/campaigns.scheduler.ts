import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Injectable } from "@nestjs/common";
import { CampaignStatus } from "@rabbehni/database";
import type { Job, Queue } from "bullmq";
import { randomUUID } from "node:crypto";

import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import { CampaignsRepository } from "./campaigns.repository.js";

export const CAMPAIGN_QUEUE = "campaign-scheduler";

@Injectable()
export class CampaignScheduler {
  constructor(@InjectQueue(CAMPAIGN_QUEUE) private readonly queue: Queue) {}

  schedule(tenantId: string, campaignId: string, startsAt: Date, endsAt?: Date) {
    const options = (name: "start" | "complete", at: Date) => ({
      name,
      data: { tenantId, campaignId, action: name },
      opts: {
        jobId: `campaign-${tenantId}-${campaignId}-${name}`,
        delay: Math.max(0, at.getTime() - Date.now()),
        attempts: 8,
        backoff: { type: "exponential" as const, delay: 2_000 },
        removeOnComplete: 1_000,
        removeOnFail: 5_000,
      },
    });
    const start = options("start", startsAt);
    const jobs = [this.queue.add(start.name, start.data, start.opts)];
    if (endsAt) {
      const complete = options("complete", endsAt);
      jobs.push(this.queue.add(complete.name, complete.data, complete.opts));
    }
    return Promise.all(jobs);
  }
}

@Processor(CAMPAIGN_QUEUE)
export class CampaignStartProcessor extends WorkerHost {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(CampaignsRepository) private readonly campaigns: CampaignsRepository,
  ) {
    super();
  }

  process(job: Job<{ tenantId: string; campaignId: string; action: "start" | "complete" }>) {
    const requestId = randomUUID();
    return this.context.run(
      {
        requestId,
        correlationId: requestId,
        tenantId: job.data.tenantId,
        principal: {
          subject: "campaign-scheduler",
          userId: "00000000-0000-4000-8000-000000000000",
          tenantId: job.data.tenantId,
          membershipId: "00000000-0000-4000-8000-000000000000",
          email: "campaigns@rabbehni.local",
          displayName: "Campaign Scheduler",
          locale: "en",
          permissions: ["campaign.manage", "campaign.approve"],
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
      () =>
        this.campaigns.transition(
          job.data.campaignId,
          job.data.action === "complete" ? CampaignStatus.COMPLETED : CampaignStatus.RUNNING,
        ),
    );
  }
}
