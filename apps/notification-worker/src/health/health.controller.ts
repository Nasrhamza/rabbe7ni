import { InjectQueue } from "@nestjs/bullmq";
import { Controller, Get, Inject } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { HealthCheck, HealthCheckService, MemoryHealthIndicator } from "@nestjs/terminus";
import { buildTechnicalStatus } from "@rabbehni/contracts";
import { TECHNICAL_NOTIFICATION_QUEUE } from "@rabbehni/queue";
import type { Queue } from "bullmq";

@ApiTags("health")
@Controller({ path: "health", version: "1" })
export class HealthController {
  constructor(
    @Inject(HealthCheckService) private readonly health: HealthCheckService,
    @Inject(MemoryHealthIndicator) private readonly memory: MemoryHealthIndicator,
    @InjectQueue(TECHNICAL_NOTIFICATION_QUEUE) private readonly queue: Queue,
  ) {}

  @Get("live")
  @ApiOperation({ summary: "Notification worker liveness" })
  live() {
    return buildTechnicalStatus("notification-worker");
  }

  @Get("ready")
  @HealthCheck()
  @ApiOperation({ summary: "Notification worker BullMQ readiness" })
  ready() {
    return this.health.check([
      () => this.memory.checkHeap("memory_heap", 512 * 1024 * 1024),
      async () => {
        await this.queue.waitUntilReady();
        return { bullmq: { status: "up" as const } };
      },
    ]);
  }
}
