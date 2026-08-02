import "reflect-metadata";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { startObservability } from "@rabbehni/observability";

async function bootstrap(): Promise<void> {
  const telemetry = startObservability("api");
  const [
    { Logger },
    { NestFactory },
    { FastifyAdapter },
    { default: cookie },
    { configureHttpFoundation },
    { Logger: PinoLogger },
    { AppModule },
  ] = await Promise.all([
    import("@nestjs/common"),
    import("@nestjs/core"),
    import("@nestjs/platform-fastify"),
    import("@fastify/cookie"),
    import("@rabbehni/nestjs-platform"),
    import("nestjs-pino"),
    import("./app.module.js"),
  ]);
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      trustProxy: true,
    }),
    {
      bufferLogs: true,
    },
  );

  app.useLogger(app.get(PinoLogger));
  app.enableShutdownHooks();
  await app.register(cookie);
  await configureHttpFoundation(app, {
    description: "Rabbehni authentication, authorization and tenant-isolation foundation.",
    title: "Rabbehni API",
    version: process.env.SERVICE_VERSION ?? "0.0.0",
  });

  const port = Number.parseInt(process.env.API_PORT ?? "4000", 10);
  await app.listen(port, "0.0.0.0");
  Logger.log(`API listening on http://localhost:${port}`, "Bootstrap");

  const shutdownTelemetry = (): void => {
    void telemetry.shutdown();
  };
  process.once("SIGINT", shutdownTelemetry);
  process.once("SIGTERM", shutdownTelemetry);
}

void bootstrap();
