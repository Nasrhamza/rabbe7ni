import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { parseAnalyticsEnvironment } from "@rabbehni/config";
import { createLoggerHttpOptions } from "@rabbehni/logger";
import { DatabaseModule } from "@rabbehni/database/nest";
import { LoggerModule } from "nestjs-pino";

import { ClickHouseModule } from "./clickhouse.module.js";
import { HealthModule } from "./health/health.module.js";
import { SystemController } from "./system.controller.js";
import { AnalyticsModule } from "./analytics/analytics.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      validate: parseAnalyticsEnvironment,
    }),
    LoggerModule.forRoot({
      pinoHttp: createLoggerHttpOptions("analytics-service"),
    }),
    ClickHouseModule,
    DatabaseModule,
    AnalyticsModule,
    HealthModule,
  ],
  controllers: [SystemController],
})
export class AnalyticsServiceModule {}
