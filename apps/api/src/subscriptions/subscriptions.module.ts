import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { TenancyModule } from "../tenancy/tenancy.module.js";
import { PlanEntitlementGuard } from "./plan-entitlement.guard.js";
import { SubscriptionsController } from "./subscriptions.controller.js";
import { SubscriptionsRepository } from "./subscriptions.repository.js";
import { SubscriptionsService } from "./subscriptions.service.js";

@Module({
  imports: [TenancyModule],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsRepository,
    SubscriptionsService,
    PlanEntitlementGuard,
    { provide: APP_GUARD, useExisting: PlanEntitlementGuard },
  ],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
