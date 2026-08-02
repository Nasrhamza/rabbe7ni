import { createClient } from "@clickhouse/client";
import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { CLICKHOUSE_CLIENT } from "./clickhouse.constants.js";

@Global()
@Module({
  providers: [
    {
      provide: CLICKHOUSE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createClient({
          application: "analytics-service",
          database: config.getOrThrow<string>("CLICKHOUSE_DATABASE"),
          password: config.getOrThrow<string>("CLICKHOUSE_PASSWORD"),
          url: config.getOrThrow<string>("CLICKHOUSE_URL"),
          username: config.getOrThrow<string>("CLICKHOUSE_USER"),
        }),
    },
  ],
  exports: [CLICKHOUSE_CLIENT],
})
export class ClickHouseModule {}
