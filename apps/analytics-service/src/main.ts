import "reflect-metadata";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { startObservability } from "@rabbehni/observability";

async function bootstrap(): Promise<void> {
  const telemetry = startObservability("analytics-service");
  const [
    { Logger },
    { NestFactory },
    { FastifyAdapter },
    { configureHttpFoundation },
    { Logger: PinoLogger },
    { AnalyticsServiceModule },
  ] = await Promise.all([
    import("@nestjs/common"),
    import("@nestjs/core"),
    import("@nestjs/platform-fastify"),
    import("@rabbehni/nestjs-platform"),
    import("nestjs-pino"),
    import("./app.module.js"),
  ]);
  const app = await NestFactory.create<NestFastifyApplication>(
    AnalyticsServiceModule,
    new FastifyAdapter({ trustProxy: true }),
    { bufferLogs: true },
  );

  app.useLogger(app.get(PinoLogger));
  app.enableShutdownHooks();
  await configureHttpFoundation(app, {
    description:
      "Tenant-isolated canonical ingestion, ClickHouse aggregation and real Rabbehni operational metrics.",
    title: "Rabbehni Analytics Service",
    version: "8.0.0",
  });

  const port = Number.parseInt(process.env.ANALYTICS_PORT ?? "4100", 10);
  await app.listen(port, "0.0.0.0");
  Logger.log(`Analytics service listening on ${port}`, "Bootstrap");

  const shutdownTelemetry = (): void => {
    void telemetry.shutdown();
  };
  process.once("SIGINT", shutdownTelemetry);
  process.once("SIGTERM", shutdownTelemetry);
}

void bootstrap();
