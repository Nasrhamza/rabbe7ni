import type { JWTPayload } from "jose";

export interface RabbehniTokenClaims extends JWTPayload {
  readonly sub: string;
  readonly email?: string;
  readonly email_verified?: boolean;
  readonly name?: string;
  readonly preferred_username?: string;
  readonly locale?: string;
  readonly tenant_id?: string;
}

export interface AuthenticatedPrincipal {
  readonly subject: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly membershipId: string;
  readonly email: string;
  readonly displayName: string;
  readonly locale: string;
  readonly permissions: readonly string[];
  readonly roles: readonly string[];
  readonly access: {
    readonly organizationIds: readonly string[];
    readonly franchiseIds: readonly string[];
    readonly merchantIds: readonly string[];
    readonly branchIds: readonly string[];
    readonly tenantWide: boolean;
  };
  readonly authMethod: "bearer" | "session";
}

export interface AuthenticatedRequest {
  readonly headers: Readonly<Record<string, string | readonly string[] | undefined>>;
  readonly cookies?: Readonly<Record<string, string | undefined>>;
  readonly ip?: string;
  readonly query?: unknown;
  readonly body?: unknown;
  principal?: AuthenticatedPrincipal;
}

export interface OidcTokenSet {
  readonly access_token: string;
  readonly refresh_token?: string;
  readonly id_token?: string;
  readonly expires_in: number;
  readonly refresh_expires_in?: number;
  readonly token_type: string;
}

export interface OidcDiscoveryDocument {
  readonly issuer?: string;
  readonly authorization_endpoint: string;
  readonly token_endpoint: string;
  readonly jwks_uri: string;
  readonly end_session_endpoint?: string;
  readonly revocation_endpoint?: string;
}
