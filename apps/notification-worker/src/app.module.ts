import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { parseNotificationWorkerEnvironment } from "@rabbehni/config";
import { DatabaseModule } from "@rabbehni/database/nest";
import { createLoggerHttpOptions } from "@rabbehni/logger";
import { redisConnectionOptions } from "@rabbehni/queue";
import { LoggerModule } from "nestjs-pino";

import { HealthModule } from "./health/health.module.js";
import {
  NOTIFICATION_DEAD_LETTER_QUEUE,
  NOTIFICATION_DELIVERY_QUEUE,
  NotificationDeadLetterProcessor,
  NotificationDeliveryProcessor,
} from "./delivery/notification-delivery.processor.js";
import { DevelopmentNotificationProvider } from "./delivery/notification-provider.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      validate: parseNotificationWorkerEnvironment,
    }),
    LoggerModule.forRoot({
      pinoHttp: createLoggerHttpOptions("notification-worker"),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: redisConnectionOptions(config.getOrThrow<string>("REDIS_URL")),
        prefix: config.get<string>("BULLMQ_PREFIX", "rabbehni"),
      }),
    }),
    DatabaseModule,
    BullModule.registerQueue(
      { name: NOTIFICATION_DELIVERY_QUEUE },
      { name: NOTIFICATION_DEAD_LETTER_QUEUE },
    ),
    HealthModule,
  ],
  providers: [
    DevelopmentNotificationProvider,
    NotificationDeliveryProcessor,
    NotificationDeadLetterProcessor,
  ],
})
export class NotificationWorkerModule {}
