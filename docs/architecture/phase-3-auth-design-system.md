# Phase 3 authentication, authorization and design-system foundation

## Scope

Phase 3 introduces Keycloak OIDC authentication, database-backed RBAC, authenticated tenant
propagation, opaque browser sessions and the shared Rabbehni design system. It deliberately
contains no loyalty, QR, reward, gamification, campaign, analytics, payment or AI business screen.

## Authentication topology

- Web applications use the API as an OIDC backend-for-frontend.
- The API starts Authorization Code + PKCE, owns the callback, and stores only an opaque,
  signed session identifier in an `HttpOnly`, `SameSite=Lax` cookie.
- Refresh tokens are encrypted with AES-256-GCM before storage in the tenant-owned
  `auth_sessions` table.
- Mobile uses Authorization Code + PKCE directly through Expo AuthSession and stores tokens in
  the operating-system secure store.
- Bearer tokens are validated against Keycloak remote JWKs with issuer and audience checks.
- Logout revokes the database session and attempts refresh-token revocation at Keycloak.
- Password reset and email verification are Keycloak execute-action flows. Local development uses
  Mailpit as the SMTP sink; production must provide an authenticated SMTP service.

## Authorization and tenant enforcement

1. request middleware creates only request and correlation context;
2. client tenant headers are treated as an optional assertion, never an authority;
3. the authentication guard validates the session or bearer token;
4. the OIDC `tenant_id` claim selects a single active database membership;
5. actor, tenant, roles and permissions are bound to asynchronous request context;
6. the tenant isolation guard fails closed without that authenticated context;
7. the authorization guard evaluates `@RequirePermissions` against database RBAC;
8. every repository operation remains inside a transaction that sets
   `app.current_tenant_id`, so PostgreSQL forced RLS is the final boundary.

## Session security

- Session identifiers and PKCE material use cryptographically secure random bytes.
- Session identifiers are stored only as SHA-256 hashes.
- Cookie tenant context is HMAC-signed and still verified against the RLS-scoped session row.
- Absolute expiry, idle expiry, revocation time and refresh rotation are persisted.
- Login, refresh, logout and verification requests create tenant-scoped audit records.
- Helmet secure headers and Fastify rate limiting remain global API controls.

## Design system

`@rabbehni/design-system` owns semantic color, radius, spacing, motion and typography tokens plus
web and React Native primitives.

- Admin: premium minimalism, disciplined Bento composition and restrained Acrylic.
- Merchant: Bento composition with moderate Liquid Glass.
- Customer mobile: Liquid Glass, Aurora depth and spatial surfaces.
- Authentication: editorial minimalism, Aurora atmosphere and readable glass panels.

The system supports responsive layouts, semantic focus states, reduced motion, RTL/LTR, automatic
light/dark mode and white-label overrides through CSS custom properties and universal tokens.
