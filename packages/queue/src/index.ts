import type { ConnectionOptions } from "bullmq";

export const TECHNICAL_API_QUEUE = "technical.api-readiness";
export const TECHNICAL_NOTIFICATION_QUEUE = "technical.notification-readiness";

export function redisConnectionOptions(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  const databasePath = url.pathname.replace(/^\//, "");
  const database = databasePath ? Number.parseInt(databasePath, 10) : 0;

  return {
    db: Number.isNaN(database) ? 0 : database,
    host: url.hostname,
    port: url.port ? Number.parseInt(url.port, 10) : 6379,
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
  };
}
