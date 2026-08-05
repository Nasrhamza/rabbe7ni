import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";

import { AuditService } from "../audit/audit.service.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import { AuthRepository } from "./auth.repository.js";
import type { AuthenticatedPrincipal, RabbehniTokenClaims } from "./auth.types.js";
import type { CustomerRegistrationDto, MerchantRegistrationDto } from "./dto.js";
import { KeycloakActionsService } from "./keycloak-actions.service.js";
import { OidcService } from "./oidc.service.js";
import { SessionCryptoService } from "./session-crypto.service.js";

interface RequestFingerprint {
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

interface SessionCookieOptions {
  readonly httpOnly: true;
  readonly maxAge: number;
  readonly path: "/";
  readonly sameSite: "lax";
  readonly secure: boolean;
}

@Injectable()
export class AuthService {
  readonly sessionCookieName: string;
  readonly transactionCookieName = "rabbehni_oidc_transaction";
  private readonly allowedRedirectUris: ReadonlySet<string>;
  private readonly callbackUrl: string;
  private readonly absoluteTtlSeconds: number;
  private readonly idleTtlSeconds: number;
  private readonly secureCookies: boolean;
  private readonly customerSignupTenantId: string;
  private readonly customerSignupOrganizationId: string;

  constructor(
    @Inject(ConfigService) config: ConfigService,
    @Inject(AuthRepository) private readonly repository: AuthRepository,
    @Inject(OidcService) private readonly oidc: OidcService,
    @Inject(SessionCryptoService) private readonly crypto: SessionCryptoService,
    @Inject(KeycloakActionsService) private readonly keycloakActions: KeycloakActionsService,
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {
    this.sessionCookieName = config.getOrThrow<string>("SESSION_COOKIE_NAME");
    this.callbackUrl = config.getOrThrow<string>("OIDC_CALLBACK_URL");
    this.allowedRedirectUris = new Set(
      config
        .getOrThrow<string>("OIDC_ALLOWED_REDIRECT_URIS")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    );
    this.absoluteTtlSeconds = config.getOrThrow<number>("SESSION_ABSOLUTE_TTL_SECONDS");
    this.idleTtlSeconds = config.getOrThrow<number>("SESSION_IDLE_TTL_SECONDS");
    this.secureCookies = config.getOrThrow<boolean>("AUTH_COOKIE_SECURE");
    this.customerSignupTenantId = config.getOrThrow<string>("CUSTOMER_SIGNUP_TENANT_ID");
    this.customerSignupOrganizationId = config.getOrThrow<string>(
      "CUSTOMER_SIGNUP_ORGANIZATION_ID",
    );
  }

  get sessionCookieOptions(): SessionCookieOptions {
    return {
      httpOnly: true,
      maxAge: this.absoluteTtlSeconds,
      path: "/",
      sameSite: "lax",
      secure: this.secureCookies,
    };
  }

  get transactionCookieOptions() {
    return {
      httpOnly: true as const,
      maxAge: 600,
      path: "/v1/auth",
      sameSite: "lax" as const,
      secure: this.secureCookies,
    };
  }

  async startLogin(
    redirectUri: string,
    locale?: string,
  ): Promise<{ authorizationUrl: string; transactionCookie: string }> {
    this.assertAllowedRedirectUri(redirectUri);
    const state = this.crypto.randomToken(24);
    const verifier = this.crypto.randomToken(48);
    const codeChallenge = createHash("sha256").update(verifier).digest("base64url");
    const authorizationUrl = await this.oidc.authorizationUrl({
      redirectUri: this.callbackUrl,
      state,
      codeChallenge,
      ...(locale ? { locale } : {}),
    });
    return {
      authorizationUrl,
      transactionCookie: this.crypto.sealLoginTransaction({
        state,
        verifier,
        redirectUri,
      }),
    };
  }

  async completeLogin(
    code: string,
    state: string,
    transactionCookie: string,
    fingerprint: RequestFingerprint,
  ): Promise<{
    redirectUri: string;
    sessionCookie: string;
    principal: AuthenticatedPrincipal;
  }> {
    const transaction = this.crypto.openLoginTransaction(transactionCookie);
    if (transaction.state !== state) {
      throw new UnauthorizedException("The OIDC state does not match");
    }
    this.assertAllowedRedirectUri(transaction.redirectUri);
    const tokenSet = await this.oidc.exchangeCode(code, this.callbackUrl, transaction.verifier);
    if (!tokenSet.refresh_token) {
      throw new UnauthorizedException("The identity provider did not issue a refresh token");
    }
    const claims = await this.oidc.validateAccessToken(tokenSet.access_token);
    const principal = await this.repository.resolveTokenPrincipal(claims, "session");
    const rawSessionToken = this.crypto.randomToken(32);
    const encryptedRefreshToken = this.crypto.encrypt(tokenSet.refresh_token);
    const now = Date.now();
    await this.repository.createSession({
      tenantId: principal.tenantId,
      userId: principal.userId,
      sessionTokenHash: this.crypto.hash(rawSessionToken),
      refreshTokenCiphertext: encryptedRefreshToken.ciphertext,
      refreshTokenIv: encryptedRefreshToken.iv,
      refreshTokenTag: encryptedRefreshToken.tag,
      expiresAt: new Date(now + this.absoluteTtlSeconds * 1_000),
      idleExpiresAt: new Date(now + this.idleTtlSeconds * 1_000),
      ...fingerprint,
    });
    this.context.bindIdentity(principal);
    await this.audit.record({
      action: "authentication.login",
      entityType: "user",
      entityId: principal.userId,
      metadata: { method: "oidc.authorization_code" },
      ...fingerprint,
    });
    return {
      redirectUri: transaction.redirectUri,
      sessionCookie: this.crypto.signSessionCookie(principal.tenantId, rawSessionToken),
      principal,
    };
  }

  async authenticateBearer(token: string): Promise<AuthenticatedPrincipal> {
    const claims = await this.oidc.validateAccessToken(token);
    return this.repository.resolveTokenPrincipal(claims, "bearer");
  }

  async authenticateSession(cookie: string): Promise<AuthenticatedPrincipal> {
    const { tenantId, token } = this.crypto.verifySessionCookie(cookie);
    const session = await this.repository.findSession(tenantId, this.crypto.hash(token));
    this.assertActiveSession(session);
    const principal = await this.repository.resolveSessionPrincipal(tenantId, session.userId);
    await this.repository.touchSession(
      tenantId,
      session.id,
      new Date(Date.now() + this.idleTtlSeconds * 1_000),
    );
    return principal;
  }

  async refreshSession(cookie: string): Promise<AuthenticatedPrincipal> {
    const { tenantId, token } = this.crypto.verifySessionCookie(cookie);
    const session = await this.repository.findSession(tenantId, this.crypto.hash(token));
    this.assertActiveSession(session);
    const currentRefreshToken = this.crypto.decrypt({
      ciphertext: session.refreshTokenCiphertext,
      iv: session.refreshTokenIv,
      tag: session.refreshTokenTag,
    });
    const tokenSet = await this.oidc.refresh(currentRefreshToken);
    const claims = await this.oidc.validateAccessToken(tokenSet.access_token);
    this.assertTokenTenant(claims, tenantId);
    const principal = await this.repository.resolveTokenPrincipal(claims, "session");
    if (principal.userId !== session.userId) {
      throw new UnauthorizedException("The refreshed identity does not match the session");
    }
    const encryptedRefreshToken = this.crypto.encrypt(
      tokenSet.refresh_token ?? currentRefreshToken,
    );
    await this.repository.rotateSession(tenantId, session.id, {
      refreshTokenCiphertext: encryptedRefreshToken.ciphertext,
      refreshTokenIv: encryptedRefreshToken.iv,
      refreshTokenTag: encryptedRefreshToken.tag,
      idleExpiresAt: new Date(Date.now() + this.idleTtlSeconds * 1_000),
    });
    this.context.bindIdentity(principal);
    await this.audit.record({
      action: "authentication.refresh",
      entityType: "auth_session",
      entityId: session.id,
      metadata: { rotated: Boolean(tokenSet.refresh_token) },
    });
    return principal;
  }

  async logout(cookie: string | undefined): Promise<void> {
    if (!cookie) {
      return;
    }
    try {
      const { tenantId, token } = this.crypto.verifySessionCookie(cookie);
      const session = await this.repository.findSession(tenantId, this.crypto.hash(token));
      if (!session || session.revokedAt) {
        return;
      }
      const principal = await this.repository.resolveSessionPrincipal(tenantId, session.userId);
      const refreshToken = this.crypto.decrypt({
        ciphertext: session.refreshTokenCiphertext,
        iv: session.refreshTokenIv,
        tag: session.refreshTokenTag,
      });
      await Promise.all([
        this.repository.revokeSession(tenantId, session.id),
        this.oidc.revoke(refreshToken),
      ]);
      this.context.bindIdentity(principal);
      await this.audit.record({
        action: "authentication.logout",
        entityType: "auth_session",
        entityId: session.id,
      });
    } catch {
      return;
    }
  }

  async requestPasswordReset(email: string, redirectUri?: string): Promise<void> {
    if (redirectUri) {
      this.assertAllowedRedirectUri(redirectUri);
    }
    await this.keycloakActions.requestPasswordReset(email.trim().toLowerCase(), redirectUri);
  }

  async requestEmailVerification(
    principal: AuthenticatedPrincipal,
    redirectUri?: string,
  ): Promise<void> {
    if (redirectUri) {
      this.assertAllowedRedirectUri(redirectUri);
    }
    await this.keycloakActions.requestEmailVerification(principal.email, redirectUri);
    await this.audit.record({
      action: "authentication.email_verification_requested",
      entityType: "user",
      entityId: principal.userId,
    });
  }

  twoFactorStatus(principal: AuthenticatedPrincipal) {
    return this.keycloakActions.twoFactorStatus(principal.email);
  }

  async requestTwoFactorSetup(
    principal: AuthenticatedPrincipal,
    redirectUri?: string,
  ): Promise<void> {
    if (redirectUri) this.assertAllowedRedirectUri(redirectUri);
    await this.keycloakActions.requestTwoFactorSetup(principal.email, redirectUri);
    await this.audit.record({
      action: "authentication.two_factor_setup_requested",
      entityType: "user",
      entityId: principal.userId,
    });
  }

  async registerCustomer(input: CustomerRegistrationDto) {
    const scope = await this.repository.customerSignupScope(
      this.customerSignupTenantId,
      this.customerSignupOrganizationId,
    );
    if (!scope) {
      throw new BadRequestException("Customer registration is not available");
    }
    const externalSubject = await this.keycloakActions.createCustomerIdentity({
      displayName: input.displayName,
      email: input.email,
      locale: input.locale,
      password: input.password,
      tenantId: scope.tenantId,
    });
    try {
      const registered = await this.repository.registerCustomer({
        ...scope,
        displayName: input.displayName,
        email: input.email,
        externalSubject,
        locale: input.locale,
        phone: input.phone,
        ...(input.referralCode ? { referralCode: input.referralCode } : {}),
      });
      if (!registered) {
        throw new BadRequestException("An account already exists for this email");
      }
      return {
        registered: true,
        customerId: registered.customerId,
        requiresEmailVerification: true,
      };
    } catch (error) {
      await this.keycloakActions.deleteIdentity(externalSubject);
      throw error;
    }
  }

  /**
   * Registers a merchant and provisions its workspace.
   *
   * The Keycloak identity has to exist before the database transaction, because the owner user row
   * stores its subject. That puts one side effect outside the transaction, so a database failure
   * would otherwise strand an orphan identity that permanently blocks the email address from
   * registering again. The catch deletes it, mirroring customer registration.
   */
  async registerMerchant(input: MerchantRegistrationDto) {
    const externalSubject = await this.keycloakActions.createOwnerIdentity({
      displayName: input.ownerName,
      email: input.ownerEmail,
      locale: input.locale,
      password: input.password,
      tenantId: "pending",
    });
    try {
      const workspace = await this.repository.provisionMerchantWorkspace({
        workspaceSlug: input.workspaceSlug,
        businessName: input.businessName,
        legalName: input.legalName ?? input.businessName,
        countryCode: input.countryCode,
        timezone: input.timezone,
        currency: input.currency,
        locale: input.locale,
        branchName: input.branchName ?? input.businessName,
        planCode: input.planCode,
        ownerName: input.ownerName,
        ownerEmail: input.ownerEmail,
        ownerPhone: input.ownerPhone,
        externalSubject,
      });
      // The identity was created before the tenant id existed; bind it now so the token carries
      // the tenant claim the authentication guard requires.
      await this.keycloakActions.assignTenant(externalSubject, workspace.tenantId);
      return {
        registered: true,
        tenantId: workspace.tenantId,
        slug: workspace.slug,
        merchantId: workspace.merchantId,
        trialEndsAt: workspace.trialEndsAt.toISOString(),
        requiresEmailVerification: true,
      };
    } catch (error) {
      await this.keycloakActions.deleteIdentity(externalSubject);
      throw error;
    }
  }

  isWorkspaceSlugAvailable(slug: string) {
    return this.repository.isWorkspaceSlugAvailable(slug);
  }

  private assertAllowedRedirectUri(redirectUri: string): void {
    if (!this.allowedRedirectUris.has(redirectUri)) {
      throw new BadRequestException("The redirect URI is not allowed");
    }
  }

  private assertTokenTenant(claims: RabbehniTokenClaims, tenantId: string): void {
    if (claims.tenant_id !== tenantId) {
      throw new ForbiddenException("The refreshed token belongs to another tenant");
    }
  }

  private assertActiveSession(
    session: {
      readonly id: string;
      readonly userId: string;
      readonly expiresAt: Date;
      readonly idleExpiresAt: Date;
      readonly revokedAt: Date | null;
      readonly refreshTokenCiphertext: string;
      readonly refreshTokenIv: string;
      readonly refreshTokenTag: string;
    } | null,
  ): asserts session is NonNullable<typeof session> {
    const now = Date.now();
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= now ||
      session.idleExpiresAt.getTime() <= now
    ) {
      throw new UnauthorizedException("The session is missing, expired or revoked");
    }
  }
}
