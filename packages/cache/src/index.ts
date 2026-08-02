import { Redis } from "ioredis";

export type RedisClient = Redis;

export function createRedisClient(url: string, connectionName: string): Redis {
  return new Redis(url, {
    connectionName,
    enableReadyCheck: true,
    lazyConnect: true,
    maxRetriesPerRequest: 2,
  });
}

export async function pingRedis(client: Redis): Promise<void> {
  if (client.status === "wait") {
    await client.connect();
  }
  await client.ping();
}
