import "reflect-metadata";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { startObservability } from "@rabbehni/observability";

async function bootstrap(): Promise<void> {
  const telemetry = startObservability("notification-worker");
  const [
    { Logger },
    { NestFactory },
    { FastifyAdapter },
    { configureHttpFoundation },
    { Logger: PinoLogger },
    { NotificationWorkerModule },
  ] = await Promise.all([
    import("@nestjs/common"),
    import("@nestjs/core"),
    import("@nestjs/platform-fastify"),
    import("@rabbehni/nestjs-platform"),
    import("nestjs-pino"),
    import("./app.module.js"),
  ]);
  const app = await NestFactory.create<NestFastifyApplication>(
    NotificationWorkerModule,
    new FastifyAdapter({ trustProxy: true }),
    { bufferLogs: true },
  );

  app.useLogger(app.get(PinoLogger));
  app.enableShutdownHooks();
  await configureHttpFoundation(app, {
    description:
      "Queue-based notification delivery worker with provider abstraction, retries and dead-letter handling.",
    title: "Rabbehni Notification Worker",
    version: "0.0.0",
  });

  const port = Number.parseInt(process.env.NOTIFICATION_WORKER_PORT ?? "4101", 10);
  await app.listen(port, "0.0.0.0");
  Logger.log(`Notification worker health server listening on ${port}`, "Bootstrap");

  const shutdownTelemetry = (): void => {
    void telemetry.shutdown();
  };
  process.once("SIGINT", shutdownTelemetry);
  process.once("SIGTERM", shutdownTelemetry);
}

void bootstrap();
