import { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";

import type { AuditService } from "../src/audit/audit.service.js";
import type { AuthRepository } from "../src/auth/auth.repository.js";
import { AuthService } from "../src/auth/auth.service.js";
import type { AuthenticatedPrincipal } from "../src/auth/auth.types.js";
import type { KeycloakActionsService } from "../src/auth/keycloak-actions.service.js";
import type { OidcService } from "../src/auth/oidc.service.js";
import { SessionCryptoService } from "../src/auth/session-crypto.service.js";
import { TenantContextStore } from "../src/tenancy/tenant-context.store.js";

const principal: AuthenticatedPrincipal = {
  subject: "10000000-0000-4000-8000-000000000006",
  userId: "10000000-0000-4000-8000-000000000006",
  tenantId: "10000000-0000-4000-8000-000000000001",
  membershipId: "10000000-0000-4000-8000-000000000007",
  email: "owner@demo.rabbehni.local",
  displayName: "Rabbehni Demo Owner",
  locale: "fr-TN",
  permissions: ["tenant.read"],
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

function fixture() {
  const config = new ConfigService({
    AUTH_COOKIE_SECURE: false,
    CUSTOMER_SIGNUP_ORGANIZATION_ID: "10000000-0000-4000-8000-000000000002",
    CUSTOMER_SIGNUP_TENANT_ID: "10000000-0000-4000-8000-000000000001",
    OIDC_ALLOWED_REDIRECT_URIS:
      "http://localhost:3000/auth/callback,http://localhost:3002/auth/callback",
    OIDC_CALLBACK_URL: "http://localhost:4000/v1/auth/callback",
    SESSION_ABSOLUTE_TTL_SECONDS: 3600,
    SESSION_COOKIE_NAME: "rabbehni_session",
    SESSION_ENCRYPTION_KEY: "a-secure-test-encryption-key-with-32-chars",
    SESSION_IDLE_TTL_SECONDS: 900,
    SESSION_SIGNING_SECRET: "a-secure-test-signing-secret-with-32-chars",
  });
  const crypto = new SessionCryptoService(config);
  const repository = {
    createSession: vi.fn().mockResolvedValue({ id: "session-id" }),
    customerSignupScope: vi.fn().mockResolvedValue({
      organizationId: "10000000-0000-4000-8000-000000000002",
      tenantId: "10000000-0000-4000-8000-000000000001",
    }),
    findSession: vi.fn(),
    resolveSessionPrincipal: vi.fn().mockResolvedValue(principal),
    resolveTokenPrincipal: vi.fn().mockResolvedValue(principal),
    revokeSession: vi.fn().mockResolvedValue(undefined),
    registerCustomer: vi.fn().mockResolvedValue({
      customerId: "10000000-0000-4000-8000-000000000099",
      userId: "10000000-0000-4000-8000-000000000098",
    }),
    rotateSession: vi.fn().mockResolvedValue(undefined),
    touchSession: vi.fn().mockResolvedValue(undefined),
  };
  const oidc = {
    authorizationUrl: vi.fn().mockResolvedValue("http://keycloak/authorize"),
    exchangeCode: vi.fn().mockResolvedValue({
      access_token: "access-token",
      expires_in: 300,
      refresh_token: "refresh-token",
      token_type: "Bearer",
    }),
    refresh: vi.fn().mockResolvedValue({
      access_token: "refreshed-access-token",
      expires_in: 300,
      refresh_token: "rotated-refresh-token",
      token_type: "Bearer",
    }),
    revoke: vi.fn().mockResolvedValue(undefined),
    validateAccessToken: vi.fn().mockResolvedValue({
      sub: principal.subject,
      tenant_id: principal.tenantId,
    }),
  };
  const actions = {
    createCustomerIdentity: vi.fn().mockResolvedValue("keycloak-customer-id"),
    deleteIdentity: vi.fn().mockResolvedValue(undefined),
    requestEmailVerification: vi.fn().mockResolvedValue(undefined),
    requestPasswordReset: vi.fn().mockResolvedValue(undefined),
  };
  const context = new TenantContextStore();
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const service = new AuthService(
    config,
    repository as unknown as AuthRepository,
    oidc as unknown as OidcService,
    crypto,
    actions as unknown as KeycloakActionsService,
    context,
    audit as unknown as AuditService,
  );
  return { actions, audit, context, crypto, oidc, repository, service };
}

const requestContext = {
  correlationId: "10000000-0000-4000-8000-000000000002",
  requestId: "10000000-0000-4000-8000-000000000003",
};

describe("AuthService", () => {
  it("creates a state-bound PKCE login transaction only for allowed redirects", async () => {
    const { crypto, oidc, service } = fixture();
    const result = await service.startLogin("http://localhost:3000/auth/callback", "fr");
    expect(result.authorizationUrl).toBe("http://keycloak/authorize");
    expect(crypto.openLoginTransaction(result.transactionCookie)).toMatchObject({
      redirectUri: "http://localhost:3000/auth/callback",
    });
    expect(oidc.authorizationUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        redirectUri: "http://localhost:4000/v1/auth/callback",
      }),
    );
    await expect(service.startLogin("https://attacker.example/callback")).rejects.toThrow();
  });

  it("exchanges the code, persists an encrypted session and records login", async () => {
    const { audit, context, crypto, repository, service } = fixture();
    const start = await service.startLogin("http://localhost:3000/auth/callback");
    const transaction = crypto.openLoginTransaction(start.transactionCookie);
    const result = await context.run(requestContext, () =>
      service.completeLogin("code", transaction.state, start.transactionCookie, {
        ipAddress: "127.0.0.1",
      }),
    );
    expect(result.principal).toEqual(principal);
    expect(crypto.verifySessionCookie(result.sessionCookie).tenantId).toBe(principal.tenantId);
    expect(repository.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: principal.tenantId,
        userId: principal.userId,
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "authentication.login" }),
    );
  });

  it("rotates refresh tokens and keeps the identity inside the same tenant", async () => {
    const { audit, context, crypto, repository, service } = fixture();
    const encrypted = crypto.encrypt("refresh-token");
    repository.findSession.mockResolvedValue({
      id: "session-id",
      userId: principal.userId,
      expiresAt: new Date(Date.now() + 60_000),
      idleExpiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      refreshTokenCiphertext: encrypted.ciphertext,
      refreshTokenIv: encrypted.iv,
      refreshTokenTag: encrypted.tag,
    });
    const cookie = crypto.signSessionCookie(principal.tenantId, "opaque-token");
    await context.run(requestContext, () => service.refreshSession(cookie));
    expect(repository.rotateSession).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "authentication.refresh" }),
    );
  });

  it("delegates password reset and verified-email actions to Keycloak", async () => {
    const { actions, audit, context, service } = fixture();
    await service.requestPasswordReset(
      "Owner@Demo.Rabbehni.Local",
      "http://localhost:3000/auth/callback",
    );
    expect(actions.requestPasswordReset).toHaveBeenCalledWith(
      "owner@demo.rabbehni.local",
      "http://localhost:3000/auth/callback",
    );
    await context.run(requestContext, () =>
      service.requestEmailVerification(principal, "http://localhost:3000/auth/callback"),
    );
    expect(actions.requestEmailVerification).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "authentication.email_verification_requested" }),
    );
  });

  it("creates a tenant-scoped mobile customer identity and domain account", async () => {
    const { actions, repository, service } = fixture();
    await expect(
      service.registerCustomer({
        displayName: "Nour Ben Salem",
        email: "nour@example.test",
        phone: "+216 20 000 000",
        password: "Rabbehni-Mobile-2026!",
        locale: "fr-TN",
      }),
    ).resolves.toEqual({
      customerId: "10000000-0000-4000-8000-000000000099",
      registered: true,
      requiresEmailVerification: true,
    });
    expect(actions.createCustomerIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "nour@example.test",
        tenantId: principal.tenantId,
      }),
    );
    expect(repository.registerCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        externalSubject: "keycloak-customer-id",
        organizationId: principal.access.organizationIds[0],
        tenantId: principal.tenantId,
      }),
    );
  });

  it("rolls back the Keycloak identity when domain registration fails", async () => {
    const { actions, repository, service } = fixture();
    repository.registerCustomer.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(
      service.registerCustomer({
        displayName: "Nour Ben Salem",
        email: "nour@example.test",
        phone: "+216 20 000 000",
        password: "Rabbehni-Mobile-2026!",
        locale: "fr-TN",
      }),
    ).rejects.toThrow("database unavailable");
    expect(actions.deleteIdentity).toHaveBeenCalledTimes(1);
    expect(actions.deleteIdentity).toHaveBeenCalledWith("keycloak-customer-id");
  });
});
