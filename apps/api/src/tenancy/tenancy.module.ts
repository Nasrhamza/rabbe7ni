import {
  Global,
  Module,
  type MiddlewareConsumer,
  type NestModule,
  RequestMethod,
} from "@nestjs/common";

import {
  OutboxTechnicalEventPublisher,
  TechnicalEventPublisher,
} from "../common/events/technical-event.publisher.js";
import { TenancyRepository } from "./tenancy.repository.js";
import { TenancyController } from "./tenancy.controller.js";
import { TenancyService } from "./tenancy.service.js";
import { TenantContextMiddleware } from "./tenant-context.middleware.js";
import { TenantContextStore } from "./tenant-context.store.js";
import { TenantIsolationGuard } from "./tenant-isolation.guard.js";

@Global()
@Module({
  controllers: [TenancyController],
  providers: [
    TenantContextStore,
    TenantContextMiddleware,
    TenantIsolationGuard,
    TenancyRepository,
    TenancyService,
    OutboxTechnicalEventPublisher,
    {
      provide: TechnicalEventPublisher,
      useExisting: OutboxTechnicalEventPublisher,
    },
  ],
  exports: [TenantContextStore, TenantIsolationGuard, TenancyService, TechnicalEventPublisher],
})
export class TenancyModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantContextMiddleware).forRoutes({ path: "*", method: RequestMethod.ALL });
  }
}
