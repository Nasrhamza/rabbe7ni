import {
  ForbiddenException,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { IS_PUBLIC_ROUTE, REQUIRED_ENTITLEMENT } from "../common/security.js";
import { SubscriptionsRepository } from "./subscriptions.repository.js";

@Injectable()
export class PlanEntitlementGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(SubscriptionsRepository) private readonly subscriptions: SubscriptionsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const featureKey = this.reflector.getAllAndOverride<string>(REQUIRED_ENTITLEMENT, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!featureKey) return true;
    if (!(await this.subscriptions.hasEntitlement(featureKey))) {
      throw new ForbiddenException(`Plan entitlement required: ${featureKey}`);
    }
    return true;
  }
}
