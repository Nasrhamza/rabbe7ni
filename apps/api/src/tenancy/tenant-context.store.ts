import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";

import type { AuthenticatedPrincipal } from "../auth/auth.types.js";

export interface TenantRequestContext {
  readonly requestId: string;
  readonly correlationId: string;
  readonly requestedTenantId?: string;
  tenantId?: string;
  actorId?: string;
  principal?: AuthenticatedPrincipal;
}

@Injectable()
export class TenantContextStore {
  private readonly storage = new AsyncLocalStorage<TenantRequestContext>();

  run<T>(context: TenantRequestContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  current(): TenantRequestContext {
    const context = this.storage.getStore();
    if (!context) {
      throw new Error("Request context is not available");
    }
    return context;
  }

  tenantId(): string {
    const tenantId = this.current().tenantId;
    if (!tenantId) {
      throw new Error("A tenant context is required for this operation");
    }
    return tenantId;
  }

  authenticatedPrincipal(): AuthenticatedPrincipal {
    const principal = this.current().principal;
    if (!principal) {
      throw new Error("An authenticated principal is required for this operation");
    }
    return principal;
  }

  canAccessOrganization(organizationId: string): boolean {
    const principal = this.authenticatedPrincipal();
    return principal.access.tenantWide || principal.access.organizationIds.includes(organizationId);
  }

  bindIdentity(principal: AuthenticatedPrincipal): void {
    const context = this.current();
    context.actorId = principal.userId;
    context.principal = principal;
    context.tenantId = principal.tenantId;
  }
}
