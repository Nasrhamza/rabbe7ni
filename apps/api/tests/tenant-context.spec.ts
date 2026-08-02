import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { TenantContextStore } from "../src/tenancy/tenant-context.store.js";
import { TenantIsolationGuard } from "../src/tenancy/tenant-isolation.guard.js";

describe("TenantContextStore", () => {
  it("propagates the tenant through asynchronous work", async () => {
    const store = new TenantContextStore();

    await store.run(
      {
        tenantId: "10000000-0000-4000-8000-000000000001",
        correlationId: "10000000-0000-4000-8000-000000000002",
        requestId: "10000000-0000-4000-8000-000000000003",
      },
      async () => {
        await Promise.resolve();
        expect(store.tenantId()).toBe("10000000-0000-4000-8000-000000000001");
      },
    );
  });

  it("fails closed when no tenant is active", () => {
    const store = new TenantContextStore();
    const guard = new TenantIsolationGuard(store, new Reflector());
    const executionContext = {
      getClass: () => TenantIsolationGuard,
      getHandler: () => TenantIsolationGuard.prototype.canActivate,
    } as unknown as ExecutionContext;

    expect(() =>
      store.run(
        {
          correlationId: "10000000-0000-4000-8000-000000000002",
          requestId: "10000000-0000-4000-8000-000000000003",
        },
        () => guard.canActivate(executionContext),
      ),
    ).toThrow("A tenant context is required");
  });
});
