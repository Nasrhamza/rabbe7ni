import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { VersioningType } from "@nestjs/common";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export interface HttpFoundationOptions {
  readonly description: string;
  readonly title: string;
  readonly version: string;
}

export async function configureHttpFoundation(
  app: NestFastifyApplication,
  options: HttpFoundationOptions,
): Promise<void> {
  app.enableCors({
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    origin: process.env.CORS_ORIGINS?.split(",") ?? [
      "http://localhost:3000",
      "http://localhost:3002",
    ],
  });
  app.enableVersioning({
    defaultVersion: "1",
    type: VersioningType.URI,
  });

  await app.register(helmet, {
    contentSecurityPolicy: process.env.NODE_ENV === "production",
  });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  const documentConfig = new DocumentBuilder()
    .setTitle(options.title)
    .setDescription(options.description)
    .setVersion(options.version)
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, documentConfig));
}
