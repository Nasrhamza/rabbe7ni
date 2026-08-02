import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Injectable } from "@nestjs/common";
import type { Job, Queue } from "bullmq";
import { randomUUID } from "node:crypto";

import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import { AutomationQueue } from "./automations.queue.js";
import { AutomationsRepository } from "./automations.repository.js";

export const AUTOMATION_SCHEDULER_QUEUE = "marketing-automation-scheduler";

@Injectable()
export class AutomationScheduler {
  constructor(@InjectQueue(AUTOMATION_SCHEDULER_QUEUE) private readonly queue: Queue) {}

  schedule(tenantId: string, workflowId: string, pattern: string) {
    return this.queue.upsertJobScheduler(
      `automation-schedule:${tenantId}:${workflowId}`,
      { pattern },
      {
        name: "trigger",
        data: { tenantId, workflowId },
        opts: { attempts: 8, backoff: { type: "exponential", delay: 2_000 } },
      },
    );
  }

  unschedule(tenantId: string, workflowId: string) {
    return this.queue.removeJobScheduler(`automation-schedule:${tenantId}:${workflowId}`);
  }
}

@Processor(AUTOMATION_SCHEDULER_QUEUE)
export class ScheduledAutomationProcessor extends WorkerHost {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(AutomationsRepository) private readonly automations: AutomationsRepository,
    @Inject(AutomationQueue) private readonly queue: AutomationQueue,
  ) {
    super();
  }

  process(job: Job<{ tenantId: string; workflowId: string }>) {
    const requestId = randomUUID();
    return this.context.run(
      {
        requestId,
        correlationId: requestId,
        tenantId: job.data.tenantId,
        principal: {
          subject: "scheduled-automation-worker",
          userId: "00000000-0000-4000-8000-000000000000",
          tenantId: job.data.tenantId,
          membershipId: "00000000-0000-4000-8000-000000000000",
          email: "scheduled-automations@rabbehni.local",
          displayName: "Scheduled Automation Worker",
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
      async () => {
        const executions = await this.automations.beginScheduled(
          job.data.workflowId,
          new Date(job.timestamp),
        );
        await Promise.all(
          executions.map((execution) => this.queue.enqueue(execution.tenantId, execution.id)),
        );
        return { executions: executions.length };
      },
    );
  }
}
