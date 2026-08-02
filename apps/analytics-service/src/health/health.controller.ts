import { type ClickHouseClient } from "@clickhouse/client";
import { Controller, Get, Inject } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { HealthCheck, HealthCheckService, MemoryHealthIndicator } from "@nestjs/terminus";
import { buildTechnicalStatus } from "@rabbehni/contracts";

import { CLICKHOUSE_CLIENT } from "../clickhouse.constants.js";

@ApiTags("health")
@Controller({ path: "health", version: "1" })
export class HealthController {
  constructor(
    @Inject(HealthCheckService) private readonly health: HealthCheckService,
    @Inject(MemoryHealthIndicator) private readonly memory: MemoryHealthIndicator,
    @Inject(CLICKHOUSE_CLIENT) private readonly clickhouse: ClickHouseClient,
  ) {}

  @Get("live")
  @ApiOperation({ summary: "Analytics service liveness" })
  live() {
    return buildTechnicalStatus("analytics-service");
  }

  @Get("ready")
  @HealthCheck()
  @ApiOperation({ summary: "Analytics ClickHouse readiness" })
  ready() {
    return this.health.check([
      () => this.memory.checkHeap("memory_heap", 512 * 1024 * 1024),
      async () => {
        const result = await this.clickhouse.ping();
        if (!result.success) {
          throw new Error("ClickHouse ping was unsuccessful");
        }
        return { clickhouse: { status: "up" as const } };
      },
    ]);
  }
}
