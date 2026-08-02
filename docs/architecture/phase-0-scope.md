# Phase 0 scope

## Included

- Nx and pnpm monorepo structure.
- Next.js, NestJS/Fastify, Expo and FastAPI application shells.
- Prisma 7 PostgreSQL generator and client factory.
- Technical contracts, environment validation and OpenTelemetry bootstrap.
- Local infrastructure definitions for PostgreSQL, Redis, NATS JetStream, Keycloak, ClickHouse,
  MinIO, OpenTelemetry Collector, Prometheus, Loki, Tempo and Grafana.
- Health probes and OpenAPI foundations.
- Formatting, linting, type checking, testing, builds and CI.
- Container build definitions.
- Architecture documentation and ADRs.

## Explicitly excluded

- Tenant, organisation, franchise, commerce or user domain entities.
- Authentication screens and role assignment logic.
- QR generation or check-in workflows.
- Loyalty programs, point ledgers, rewards or redemptions.
- Gamification and Smart Habits.
- Campaigns and marketing automation.
- Payments, subscriptions and invoicing workflows.
- Analytical event tables and dashboards.
- Churn models, recommendations and cultural adaptation algorithms.
- White-label user interfaces.

## Exit criteria

- All application shells compile.
- Unit tests and static checks pass.
- Prisma schema validates and client generation succeeds without business models.
- Docker Compose files parse when Docker is available.
- CI describes the same checks used locally.
- The repository documents architecture, boundaries, security and operation.
