import { Global, Module } from "@nestjs/common";

import { createRedisClient } from "../index.js";
import { REDIS_CLIENT } from "./cache.constants.js";
import { RedisLifecycleService } from "./redis-lifecycle.service.js";

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => {
        const redisUrl = process.env.REDIS_URL;
        if (!redisUrl) {
          throw new Error("REDIS_URL is required to initialize Redis");
        }

        return createRedisClient(redisUrl, process.env.OTEL_SERVICE_NAME ?? "rabbehni-service");
      },
    },
    RedisLifecycleService,
  ],
  exports: [REDIS_CLIENT],
})
export class CacheModule {}
