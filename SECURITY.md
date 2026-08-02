# Security policy

## Reporting

Do not disclose a suspected vulnerability in a public issue. Report it privately to the project
owner with the affected component, reproduction steps and potential impact.

## Phase 1 security baseline

- No credentials are committed.
- Development credentials in `.env.example` are local-only and intentionally obvious.
- Keycloak provides the OIDC boundary; application authorization remains server-side.
- PostgreSQL Row-Level Security is mandatory for future tenant-scoped tables.
- Logs redact authorization, cookie and set-cookie headers.
- Public APIs use TLS outside local development.
- Webhooks and asynchronous messages require signature or broker authentication and idempotency.
- Security-relevant actions must produce immutable audit records.

## Unsupported configurations

- Exposing development Keycloak, MinIO, Redis, NATS or databases directly to the internet.
- Reusing `.env.example` credentials outside local development.
- Running the application database role with superuser or `BYPASSRLS`.
- Logging tokens, passwords, payment payloads or raw customer profiles.
