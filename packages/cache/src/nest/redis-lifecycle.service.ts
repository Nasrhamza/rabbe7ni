import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import type { Redis } from "ioredis";

import { REDIS_CLIENT } from "./cache.constants.js";

@Injectable()
export class RedisLifecycleService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    if (this.redis.status === "end") {
      return;
    }

    if (this.redis.status === "wait") {
      this.redis.disconnect();
      return;
    }

    await this.redis.quit();
  }
}
