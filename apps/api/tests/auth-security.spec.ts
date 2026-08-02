import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthenticationGuard } from "../src/auth/authentication.guard.js";
import { AuthorizationGuard } from "../src/auth/authorization.guard.js";
import type { AuthService } from "../src/auth/auth.service.js";
import type { AuthenticatedPrincipal, AuthenticatedRequest } from "../src/auth/auth.types.js";
import { SessionCryptoService } from "../src/auth/session-crypto.service.js";
import { REQUIRED_PERMISSIONS } from "../src/common/security.js";
import { TenantContextStore } from "../src/tenancy/tenant-context.store.js";

const principal: AuthenticatedPrincipal = {
  subject: "subject",
  userId: "10000000-0000-4000-8000-000000000006",
  tenantId: "10000000-0000-4000-8000-000000000001",
  membershipId: "10000000-0000-4000-8000-000000000007",
  email: "owner@demo.rabbehni.local",
  displayName: "Rabbehni Demo Owner",
  locale: "fr-TN",
  permissions: ["tenant.read", "tenant.manage"],
  roles: ["owner"],
  access: {
    organizationIds: ["10000000-0000-4000-8000-000000000002"],
    franchiseIds: [],
    merchantIds: [],
    branchIds: [],
    tenantWide: true,
  },
  authMethod: "session",
};

function executionContext(request: AuthenticatedRequest, handler = () => undefined) {
  return {
    getClass: () => class ProtectedController {},
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe("SessionCryptoService", () => {
  const crypto = new SessionCryptoService(
    new ConfigService({
      SESSION_ENCRYPTION_KEY: "a-secure-test-encryption-key-with-32-chars",
      SESSION_SIGNING_SECRET: "a-secure-test-signing-secret-with-32-chars",
    }),
  );

  it("encrypts OIDC transactions and rejects tampering", () => {
    const transaction = crypto.sealLoginTransaction({
      state: "state",
      verifier: "verifier",
      redirectUri: "http://localhost:3000/auth/callback",
    });
    expect(crypto.openLoginTransaction(transaction)).toMatchObject({
      state: "state",
      verifier: "verifier",
    });
    expect(() => crypto.openLoginTransaction(`${transaction}tampered`)).toThrow();
  });

  it("signs tenant-bound opaque session cookies", () => {
    const cookie = crypto.signSessionCookie(principal.tenantId, "opaque-token");
    expect(crypto.verifySessionCookie(cookie)).toEqual({
      tenantId: principal.tenantId,
      token: "opaque-token",
    });
    expect(() => crypto.verifySessionCookie(cookie.replace("opaque", "changed"))).toThrow();
  });
});

describe("AuthorizationGuard", () => {
  it("allows all required database permissions", () => {
    const handler = () => undefined;
    Reflect.defineMetadata(REQUIRED_PERMISSIONS, ["tenant.read"], handler);
    const guard = new AuthorizationGuard(new Reflector());
    expect(guard.canActivate(executionContext({ headers: {}, principal }, handler))).toBe(true);
  });

  it("fails closed when a permission is missing", () => {
    const handler = () => undefined;
    Reflect.defineMetadata(REQUIRED_PERMISSIONS, ["audit.delete"], handler);
    const guard = new AuthorizationGuard(new Reflector());
    expect(() => guard.canActivate(executionContext({ headers: {}, principal }, handler))).toThrow(
      ForbiddenException,
    );
  });
});

describe("AuthenticationGuard tenant binding", () => {
  let context: TenantContextStore;

  beforeEach(() => {
    context = new TenantContextStore();
  });

  it("derives actor and tenant from the validated session", async () => {
    const auth = {
      authenticateSession: vi.fn().mockResolvedValue(principal),
    } as unknown as AuthService;
    const guard = new AuthenticationGuard(
      new Reflector(),
      new ConfigService({ SESSION_COOKIE_NAME: "rabbehni_session" }),
      auth,
      context,
    );
    const request: AuthenticatedRequest = {
      cookies: { rabbehni_session: "opaque" },
      headers: {},
    };
    await context.run(
      {
        correlationId: "10000000-0000-4000-8000-000000000002",
        requestId: "10000000-0000-4000-8000-000000000003",
      },
      async () => {
        await expect(guard.canActivate(executionContext(request))).resolves.toBe(true);
        expect(context.current()).toMatchObject({
          actorId: principal.userId,
          tenantId: principal.tenantId,
        });
        expect(request.principal).toEqual(principal);
      },
    );
  });

  it("rejects a client-requested tenant that differs from the identity", async () => {
    const auth = {
      authenticateSession: vi.fn().mockResolvedValue(principal),
    } as unknown as AuthService;
    const guard = new AuthenticationGuard(
      new Reflector(),
      new ConfigService({ SESSION_COOKIE_NAME: "rabbehni_session" }),
      auth,
      context,
    );
    await context.run(
      {
        correlationId: "10000000-0000-4000-8000-000000000002",
        requestId: "10000000-0000-4000-8000-000000000003",
        requestedTenantId: "20000000-0000-4000-8000-000000000001",
      },
      async () => {
        await expect(
          guard.canActivate(
            executionContext({
              cookies: { rabbehni_session: "opaque" },
              headers: {},
            }),
          ),
        ).rejects.toThrow(ForbiddenException);
      },
    );
  });
});
