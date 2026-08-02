import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey, type JWTPayload } from "jose";

import type { OidcDiscoveryDocument, OidcTokenSet, RabbehniTokenClaims } from "./auth.types.js";

@Injectable()
export class OidcService {
  private readonly issuer: string;
  private readonly backchannelIssuer: string;
  private readonly clientId: string;
  private readonly audience: string;
  private discoveryCache?: OidcDiscoveryDocument;
  private jwks?: JWTVerifyGetKey;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.issuer = config.getOrThrow<string>("OIDC_ISSUER_URL").replace(/\/$/u, "");
    this.backchannelIssuer = (config.get<string>("OIDC_BACKCHANNEL_URL") ?? this.issuer).replace(
      /\/$/u,
      "",
    );
    this.clientId = config.getOrThrow<string>("OIDC_CLIENT_ID");
    this.audience = config.getOrThrow<string>("OIDC_AUDIENCE");
  }

  async discovery(): Promise<OidcDiscoveryDocument> {
    if (this.discoveryCache) {
      return this.discoveryCache;
    }
    const response = await fetch(`${this.backchannelIssuer}/.well-known/openid-configuration`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    }).catch(() => undefined);
    if (!response?.ok) {
      throw new ServiceUnavailableException("The identity provider is unavailable");
    }
    const document = (await response.json()) as OidcDiscoveryDocument;
    if (document.issuer && document.issuer.replace(/\/$/u, "") !== this.issuer) {
      throw new ServiceUnavailableException(
        "The identity provider issuer does not match OIDC_ISSUER_URL",
      );
    }
    this.discoveryCache = document;
    this.jwks = createRemoteJWKSet(new URL(this.backchannelEndpoint(document.jwks_uri)), {
      timeoutDuration: 5_000,
      cooldownDuration: 30_000,
    });
    return document;
  }

  async authorizationUrl(input: {
    redirectUri: string;
    state: string;
    codeChallenge: string;
    locale?: string;
  }): Promise<string> {
    const discovery = await this.discovery();
    const url = new URL(discovery.authorization_endpoint);
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("redirect_uri", input.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid profile email");
    url.searchParams.set("state", input.state);
    url.searchParams.set("code_challenge", input.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    if (input.locale) {
      url.searchParams.set("ui_locales", input.locale);
    }
    return url.toString();
  }

  async exchangeCode(code: string, redirectUri: string, verifier: string): Promise<OidcTokenSet> {
    const discovery = await this.discovery();
    return this.tokenRequest(this.backchannelEndpoint(discovery.token_endpoint), {
      client_id: this.clientId,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });
  }

  async refresh(refreshToken: string): Promise<OidcTokenSet> {
    const discovery = await this.discovery();
    return this.tokenRequest(this.backchannelEndpoint(discovery.token_endpoint), {
      client_id: this.clientId,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
  }

  async revoke(refreshToken: string): Promise<void> {
    const discovery = await this.discovery();
    if (!discovery.revocation_endpoint) {
      return;
    }
    await fetch(this.backchannelEndpoint(discovery.revocation_endpoint), {
      body: new URLSearchParams({
        client_id: this.clientId,
        token: refreshToken,
        token_type_hint: "refresh_token",
      }),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
      signal: AbortSignal.timeout(5_000),
    }).catch(() => undefined);
  }

  async validateAccessToken(token: string): Promise<RabbehniTokenClaims> {
    await this.discovery();
    if (!this.jwks) {
      throw new ServiceUnavailableException("The identity provider keys are unavailable");
    }
    try {
      const result = await jwtVerify(token, this.jwks, {
        audience: this.audience,
        issuer: this.issuer,
        requiredClaims: ["sub", "exp", "iat"],
      });
      return this.assertClaims(result.payload);
    } catch {
      throw new UnauthorizedException("The access token is invalid or expired");
    }
  }

  private assertClaims(payload: JWTPayload): RabbehniTokenClaims {
    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      throw new UnauthorizedException("The access token subject is missing");
    }
    return payload as RabbehniTokenClaims;
  }

  backchannelEndpoint(endpoint: string): string {
    const source = new URL(endpoint);
    const backchannel = new URL(this.backchannelIssuer);
    source.protocol = backchannel.protocol;
    source.host = backchannel.host;
    return source.toString();
  }

  private async tokenRequest(
    endpoint: string,
    values: Readonly<Record<string, string>>,
  ): Promise<OidcTokenSet> {
    const response = await fetch(endpoint, {
      body: new URLSearchParams(values),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
      signal: AbortSignal.timeout(8_000),
    }).catch(() => undefined);
    if (!response?.ok) {
      throw new UnauthorizedException("The identity provider rejected the token request");
    }
    const result = (await response.json()) as Partial<OidcTokenSet>;
    if (
      typeof result.access_token !== "string" ||
      typeof result.expires_in !== "number" ||
      typeof result.token_type !== "string"
    ) {
      throw new UnauthorizedException("The identity provider returned an invalid token set");
    }
    return result as OidcTokenSet;
  }
}
