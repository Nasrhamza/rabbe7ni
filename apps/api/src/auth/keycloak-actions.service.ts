import { ConfigService } from "@nestjs/config";
import { ConflictException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";

import { OidcService } from "./oidc.service.js";

interface KeycloakUser {
  readonly id: string;
  readonly email?: string;
  readonly totp?: boolean;
}

interface CustomerIdentityInput {
  readonly displayName: string;
  readonly email: string;
  readonly locale: string;
  readonly password: string;
  readonly tenantId: string;
}

interface IdentityInput extends CustomerIdentityInput {
  /** Written to the Keycloak `portal` attribute so the realm can branch on account type. */
  readonly portal: "customer" | "merchant";
}

@Injectable()
export class KeycloakActionsService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly webClientId: string;
  private readonly adminUsersUrl: string;

  constructor(
    @Inject(ConfigService) config: ConfigService,
    @Inject(OidcService) private readonly oidc: OidcService,
  ) {
    this.clientId = config.getOrThrow<string>("KEYCLOAK_ADMIN_CLIENT_ID");
    this.clientSecret = config.getOrThrow<string>("KEYCLOAK_ADMIN_CLIENT_SECRET");
    this.webClientId = config.getOrThrow<string>("OIDC_CLIENT_ID");
    const issuer = new URL(config.getOrThrow<string>("OIDC_ISSUER_URL"));
    const backchannelIssuer = new URL(config.get<string>("OIDC_BACKCHANNEL_URL") ?? issuer);
    const pathParts = issuer.pathname.split("/").filter(Boolean);
    const realm = pathParts.at(-1);
    if (!realm) {
      throw new Error("OIDC_ISSUER_URL must contain a realm name");
    }
    this.adminUsersUrl = new URL(
      `/admin/realms/${realm}/users`,
      backchannelIssuer.origin,
    ).toString();
  }

  requestPasswordReset(email: string, redirectUri?: string): Promise<void> {
    return this.executeActions(email, ["UPDATE_PASSWORD"], redirectUri);
  }

  requestEmailVerification(email: string, redirectUri?: string): Promise<void> {
    return this.executeActions(email, ["VERIFY_EMAIL"], redirectUri);
  }

  requestTwoFactorSetup(email: string, redirectUri?: string): Promise<void> {
    return this.executeActions(email, ["CONFIGURE_TOTP"], redirectUri);
  }

  async twoFactorStatus(email: string): Promise<{ enabled: boolean }> {
    const user = await this.findUser(email);
    return { enabled: Boolean(user?.totp) };
  }

  createCustomerIdentity(input: CustomerIdentityInput): Promise<string> {
    return this.createIdentity({ ...input, portal: "customer" });
  }

  createOwnerIdentity(input: CustomerIdentityInput): Promise<string> {
    return this.createIdentity({ ...input, portal: "merchant" });
  }

  private async createIdentity(input: IdentityInput): Promise<string> {
    const token = await this.adminToken();
    const names = input.displayName.trim().split(/\s+/u);
    const response = await fetch(this.adminUsersUrl, {
      body: JSON.stringify({
        username: input.email,
        email: input.email,
        firstName: names[0] ?? input.displayName,
        lastName: names.slice(1).join(" ") || undefined,
        enabled: true,
        emailVerified: false,
        attributes: {
          tenant_id: [input.tenantId],
          locale: [input.locale],
          portal: [input.portal],
        },
        credentials: [{ type: "password", value: input.password, temporary: false }],
        requiredActions: ["VERIFY_EMAIL"],
      }),
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      method: "POST",
      signal: AbortSignal.timeout(8_000),
    }).catch(() => undefined);
    if (response?.status === 409) {
      throw new ConflictException("An account already exists for this email");
    }
    if (!response?.ok) {
      throw new ServiceUnavailableException(
        `Keycloak could not create the ${input.portal} identity`,
      );
    }
    const location = response.headers.get("location");
    const userId = location?.split("/").filter(Boolean).at(-1);
    if (!userId) {
      throw new ServiceUnavailableException(
        `Keycloak returned an invalid ${input.portal} identity`,
      );
    }
    return userId;
  }

  /**
   * Binds an existing identity to a tenant.
   *
   * Merchant registration creates the identity before the tenant id exists, so the `tenant_id`
   * attribute is filled in afterwards. Keycloak replaces the whole attribute map on update, so the
   * current representation is read first and merged — a bare write would drop `locale` and
   * `portal`, and the authentication guard reads all three.
   */
  async assignTenant(userId: string, tenantId: string): Promise<void> {
    const token = await this.adminToken();
    const userUrl = `${this.adminUsersUrl}/${encodeURIComponent(userId)}`;
    const current = await fetch(userUrl, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(6_000),
    }).catch(() => undefined);
    if (!current?.ok) {
      throw new ServiceUnavailableException("Keycloak could not load the identity to bind");
    }
    const representation = (await current.json()) as { attributes?: Record<string, unknown> };
    const response = await fetch(userUrl, {
      body: JSON.stringify({
        attributes: { ...(representation.attributes ?? {}), tenant_id: [tenantId] },
      }),
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      method: "PUT",
      signal: AbortSignal.timeout(8_000),
    }).catch(() => undefined);
    if (!response?.ok) {
      throw new ServiceUnavailableException("Keycloak could not bind the identity to its tenant");
    }
  }

  async deleteIdentity(userId: string): Promise<void> {
    const token = await this.adminToken().catch(() => undefined);
    if (!token) return;
    await fetch(`${this.adminUsersUrl}/${encodeURIComponent(userId)}`, {
      headers: { authorization: `Bearer ${token}` },
      method: "DELETE",
      signal: AbortSignal.timeout(6_000),
    }).catch(() => undefined);
  }

  private async executeActions(
    email: string,
    actions: readonly string[],
    redirectUri?: string,
  ): Promise<void> {
    const token = await this.adminToken();
    const user = await this.findUser(email, token);
    if (!user) {
      return;
    }

    const actionUrl = new URL(`${this.adminUsersUrl}/${user.id}/execute-actions-email`);
    actionUrl.searchParams.set("client_id", this.webClientId);
    actionUrl.searchParams.set("lifespan", "900");
    if (redirectUri) {
      actionUrl.searchParams.set("redirect_uri", redirectUri);
    }
    const actionResponse = await fetch(actionUrl, {
      body: JSON.stringify(actions),
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      method: "PUT",
      signal: AbortSignal.timeout(8_000),
    }).catch(() => undefined);
    if (!actionResponse?.ok) {
      throw new ServiceUnavailableException("Keycloak could not dispatch the account action");
    }
  }

  private async findUser(email: string, existingToken?: string): Promise<KeycloakUser | undefined> {
    const token = existingToken ?? (await this.adminToken());
    const usersUrl = new URL(this.adminUsersUrl);
    usersUrl.searchParams.set("email", email);
    usersUrl.searchParams.set("exact", "true");
    const usersResponse = await fetch(usersUrl, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(6_000),
    }).catch(() => undefined);
    if (!usersResponse?.ok) {
      throw new ServiceUnavailableException("The identity action service is unavailable");
    }
    const users = (await usersResponse.json()) as KeycloakUser[];
    return users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
  }

  private async adminToken(): Promise<string> {
    const discovery = await this.oidc.discovery();
    const response = await fetch(this.oidc.backchannelEndpoint(discovery.token_endpoint), {
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "client_credentials",
      }),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
      signal: AbortSignal.timeout(6_000),
    }).catch(() => undefined);
    if (!response?.ok) {
      throw new ServiceUnavailableException("The Keycloak action client is unavailable");
    }
    const result = (await response.json()) as { access_token?: unknown };
    if (typeof result.access_token !== "string") {
      throw new ServiceUnavailableException("Keycloak returned an invalid action token");
    }
    return result.access_token;
  }
}
