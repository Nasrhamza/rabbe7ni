import { Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { IS_PUBLIC_ROUTE } from "../common/security.js";
import { TenantContextStore } from "./tenant-context.store.js";

@Injectable()
export class TenantIsolationGuard implements CanActivate {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  canActivate(executionContext: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
      executionContext.getHandler(),
      executionContext.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    this.context.tenantId();
    return true;
  }
}
