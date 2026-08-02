# ADR-0006: Keycloak as the identity provider

- Status: Accepted
- Date: 2026-07-26

## Context

The platform requires email verification, password recovery, 2FA and session administration across
web and mobile.

## Decision

Use Keycloak through OIDC Authorization Code + PKCE. Use one realm per environment. Keep domain
membership and resource authorization in Rabbehni.

## Consequences

- Authentication flows are delegated to a mature provider.
- Application authorization remains explicit and tenant-aware.
- Keycloak becomes a critical dependency requiring backup and upgrade planning.
- White-label identity screens require controlled theming.
