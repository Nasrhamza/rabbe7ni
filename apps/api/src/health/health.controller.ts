import { InjectQueue } from "@nestjs/bullmq";
import { Controller, Get, Inject } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { HealthCheck, HealthCheckService, MemoryHealthIndicator } from "@nestjs/terminus";
import { pingRedis, type RedisClient } from "@rabbehni/cache";
import { REDIS_CLIENT } from "@rabbehni/cache/nest";
import { buildTechnicalStatus } from "@rabbehni/contracts";
import { PrismaService } from "@rabbehni/database/nest";
import { TECHNICAL_API_QUEUE } from "@rabbehni/queue";
import type { Queue } from "bullmq";

import { Public } from "../common/security.js";

@ApiTags("health")
@Public()
@Controller({
  path: "health",
  version: "1",
})
export class HealthController {
  constructor(
    @Inject(HealthCheckService) private readonly health: HealthCheckService,
    @Inject(MemoryHealthIndicator) private readonly memory: MemoryHealthIndicator,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
    @InjectQueue(TECHNICAL_API_QUEUE) private readonly queue: Queue,
  ) {}

  @Get("live")
  @ApiOperation({ summary: "Process liveness probe" })
  live() {
    return buildTechnicalStatus("api");
  }

  @Get("ready")
  @HealthCheck()
  @ApiOperation({ summary: "Service readiness probe" })
  ready() {
    return this.health.check([
      () => this.memory.checkHeap("memory_heap", 512 * 1024 * 1024),
      () => this.memory.checkRSS("memory_rss", 1024 * 1024 * 1024),
      async () => {
        await this.prisma.ping();
        return { postgres: { status: "up" as const } };
      },
      async () => {
        await pingRedis(this.redis);
        return { redis: { status: "up" as const } };
      },
      async () => {
        await this.queue.waitUntilReady();
        return { bullmq: { status: "up" as const } };
      },
    ]);
  }
}
