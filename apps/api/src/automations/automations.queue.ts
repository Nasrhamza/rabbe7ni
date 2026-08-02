import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Injectable } from "@nestjs/common";
import type { Job, Queue } from "bullmq";
import { randomUUID } from "node:crypto";

import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import { AutomationsRepository } from "./automations.repository.js";
import { AutomationRunner } from "./automations.runner.js";

export const AUTOMATION_QUEUE = "marketing-automation";
export const AUTOMATION_DEAD_LETTER_QUEUE = "marketing-automation-dead-letter";

@Injectable()
export class AutomationQueue {
  constructor(
    @InjectQueue(AUTOMATION_QUEUE) private readonly queue: Queue,
    @InjectQueue(AUTOMATION_DEAD_LETTER_QUEUE) private readonly deadLetterQueue: Queue,
  ) {}

  enqueue(tenantId: string, executionId: string, runAt = new Date()) {
    return this.queue.add(
      "run",
      { tenantId, executionId },
      {
        jobId: `automation-${tenantId}-${executionId}-${runAt.getTime()}`,
        delay: Math.max(0, runAt.getTime() - Date.now()),
        attempts: 8,
        backoff: { type: "exponential", delay: 2_000 },
        removeOnComplete: 1_000,
        removeOnFail: 5_000,
      },
    );
  }

  deadLetter(tenantId: string, executionId: string, reason: string) {
    return this.deadLetterQueue.add(
      "dead-letter",
      { tenantId, executionId, reason },
      { jobId: `automation-dlq-${tenantId}-${executionId}` },
    );
  }
}

@Processor(AUTOMATION_QUEUE)
export class AutomationProcessor extends WorkerHost {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(AutomationRunner) private readonly runner: AutomationRunner,
    @Inject(AutomationsRepository) private readonly automations: AutomationsRepository,
    @Inject(AutomationQueue) private readonly queue: AutomationQueue,
  ) {
    super();
  }

  process(job: Job<{ tenantId: string; executionId: string }>) {
    const requestId = randomUUID();
    return this.context.run(
      {
        requestId,
        correlationId: requestId,
        tenantId: job.data.tenantId,
        principal: {
          subject: "automation-worker",
          userId: "00000000-0000-4000-8000-000000000000",
          tenantId: job.data.tenantId,
          membershipId: "00000000-0000-4000-8000-000000000000",
          email: "automations@rabbehni.local",
          displayName: "Automation Worker",
          locale: "en",
          permissions: [
            "automation.process",
            "notification.send",
            "points.adjust",
            "gamification.process",
            "badge.award",
          ],
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
        try {
          const result = await this.runner.run(job.data.executionId);
          if (result.waitUntil) {
            await this.queue.enqueue(job.data.tenantId, job.data.executionId, result.waitUntil);
          } else if (!result.completed) {
            await this.queue.enqueue(job.data.tenantId, job.data.executionId);
          }
          return result;
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          const deadLetter = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
          await this.automations.fail(job.data.executionId, reason, deadLetter);
          if (deadLetter) {
            await this.queue.deadLetter(job.data.tenantId, job.data.executionId, reason);
          }
          throw error;
        }
      },
    );
  }
}
