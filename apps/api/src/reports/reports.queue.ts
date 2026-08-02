import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { forwardRef, Inject, Injectable } from "@nestjs/common";
import type { Job, Queue } from "bullmq";
import { randomUUID } from "node:crypto";

import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import { ReportsService } from "./reports.service.js";

export const REPORT_QUEUE = "analytics-reports";

type ReportProcessorService = Pick<ReportsService, "run" | "process">;

@Injectable()
export class ReportQueue {
  constructor(@InjectQueue(REPORT_QUEUE) private readonly queue: Queue) {}

  enqueue(tenantId: string, executionId: string) {
    return this.queue.add(
      "generate",
      { tenantId, executionId },
      {
        jobId: `report:${tenantId}:${executionId}`,
        attempts: 5,
        backoff: { type: "exponential", delay: 2_000 },
        removeOnComplete: 1_000,
        removeOnFail: 5_000,
      },
    );
  }

  schedule(
    tenantId: string,
    definitionId: string,
    frequency: "DAILY" | "WEEKLY" | "MONTHLY",
    timezone: string,
  ) {
    const pattern =
      frequency === "DAILY" ? "0 8 * * *" : frequency === "WEEKLY" ? "0 8 * * 1" : "0 8 1 * *";
    return this.queue.upsertJobScheduler(
      `report-schedule:${tenantId}:${definitionId}`,
      { pattern, tz: timezone },
      { name: "schedule", data: { tenantId, definitionId } },
    );
  }
}

@Processor(REPORT_QUEUE)
export class ReportProcessor extends WorkerHost {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(forwardRef(() => ReportsService)) private readonly reports: ReportProcessorService,
  ) {
    super();
  }

  process(job: Job<{ tenantId: string; executionId?: string; definitionId?: string }>) {
    const requestId = randomUUID();
    return this.context.run(
      {
        requestId,
        correlationId: requestId,
        tenantId: job.data.tenantId,
        principal: {
          subject: "report-worker",
          userId: "00000000-0000-4000-8000-000000000000",
          tenantId: job.data.tenantId,
          membershipId: "00000000-0000-4000-8000-000000000000",
          email: "reports@rabbehni.local",
          displayName: "Report Worker",
          locale: "en",
          permissions: ["report.manage", "analytics.read", "notification.send"],
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
      async () => {
        if (job.name === "schedule" && job.data.definitionId) {
          return this.reports.run(job.data.definitionId);
        }
        if (!job.data.executionId) throw new Error("REPORT_EXECUTION_ID_REQUIRED");
        return this.reports.process(job.data.executionId, job);
      },
    );
  }
}
