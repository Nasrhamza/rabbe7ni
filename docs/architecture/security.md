# Security architecture

## Trust boundaries

- Public clients terminate through a CDN/WAF and TLS.
- Keycloak authenticates identities through OIDC Authorization Code + PKCE.
- The API resolves application permissions and resource scopes.
- Internal services use authenticated broker/network channels.
- Databases and observability services remain private.

## Authentication and authorization

- One Keycloak realm per environment, not per tenant.
- Public web/mobile clients use PKCE and hold no client secret.
- Short access tokens and revocable sessions.
- Application authorization verifies membership, tenant and resource scope.
- Super Admin, regional and tenant privileges remain separate.

## Data protection

- Secrets come from an environment-specific secret manager.
- TLS is required in transit outside local development.
- Storage encryption is enabled by the cloud provider.
- Sensitive fields require classification before schema introduction.
- Logs and traces cannot contain tokens, passwords, payment data or raw personal profiles.

## Abuse resistance

- Rate limits at edge and application levels.
- Idempotency for check-ins, games, rewards, payments and webhooks.
- Cryptographic randomness for future game outcomes.
- Signed short-lived QR payloads and anti-replay state.
- Immutable audit records for privileged or value-bearing actions.

## Phase 2 note

The imported Keycloak realm still contains technical clients only; authentication flows remain out
of scope. The approved application authorization data model now includes memberships, tenant-local
roles and a global permission catalogue. PostgreSQL tenant tables use forced RLS, composite
tenant-aware foreign keys and a non-owner runtime login.
