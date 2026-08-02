# Rabbehni

Rabbehni is a multi-tenant, culturally adaptive loyalty platform. The repository contains the
approved technical and domain foundation through Phase 9, including tenant-isolated loyalty,
gamification, marketing automation, analytics, reporting and the SaaS commercial layer.

## Repository map

```text
apps/
  admin-web/            Next.js administration status shell
  merchant-web/         Next.js merchant status shell
  customer-mobile/      Expo Development Build customer shell
  api/                  NestJS + Fastify modular core API
  ai-service/           FastAPI technical AI-service shell
  analytics-service/    NestJS + Fastify ClickHouse readiness shell
  notification-worker/  NestJS + Fastify BullMQ notification delivery worker
packages/
  cache/                 Redis client and Nest lifecycle module
  config/                Zod environment contracts
  contracts/             Transport-neutral technical contracts
  database/              Prisma schema, migrations, RLS and Nest lifecycle module
  logger/                Structured Pino HTTP logging
  nestjs-platform/       Shared Fastify, security and OpenAPI bootstrap
  observability/         Node OpenTelemetry bootstrap
  queue/                 BullMQ connection and technical queue contracts
```

Infrastructure definitions live under `infra/`, architecture documentation under `docs/`, and the
dependency-free repository validator under `tools/validate-foundation.mjs`.

## Prerequisites

- Node.js 24
- pnpm 11
- Python 3.14
- Docker Desktop with Compose v2

## Setup

```powershell
Copy-Item .env.example .env
pnpm install
pnpm db:generate
pnpm db:migrate:deploy
pnpm --filter @rabbehni/database seed
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".\apps\ai-service[dev]"
```

Start infrastructure and containerized application shells:

```powershell
pnpm infra:up
```

Start host-run Node services, then mobile and AI separately:

```powershell
pnpm dev
pnpm dev:mobile
pnpm dev:ai
```

The customer mobile app uses an Expo Development Build. Generate the native development client with
`pnpm --filter @rabbehni/customer-mobile android` or the corresponding `ios` command.

## Technical endpoints

| Component           | Technical endpoint                                                         |
| ------------------- | -------------------------------------------------------------------------- |
| Admin web           | `http://localhost:3001` and `/health`                                      |
| Merchant web        | `http://localhost:3002` and `/health`                                      |
| API                 | `http://localhost:4000/v1`, `/docs`, `/v1/health/live`, `/v1/health/ready` |
| AI service          | `http://localhost:8000/docs`, `/health/live`, `/health/ready`              |
| Analytics service   | `http://localhost:4100/v1`, `/docs`, `/v1/health/live`, `/v1/health/ready` |
| Notification worker | `http://localhost:4101/docs`, `/v1/health/live`, `/v1/health/ready`        |

Readiness checks cover technical dependencies: PostgreSQL/Prisma, Redis, BullMQ and ClickHouse.
The notification worker consumes delivery jobs through a provider abstraction. Phase 9 also
includes plan entitlements, usage quotas, PFE sandbox billing, tenant white-label configuration and
localization.

## Quality gates

The dependency-free foundation validation is:

```powershell
pnpm validate:static
```

Once dependencies and generated Prisma code are available, the full gates are:

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:validate
```

CI performs a frozen pnpm install, installs the Python service, generates Prisma, and runs the full
validation chain. A committed `pnpm-lock.yaml` is therefore required before CI and Docker builds can
succeed.

## Phase boundary

Phase 9 completes the SaaS commercial and tenant-personalization layer. Payments remain strictly
inside the PFE sandbox: no real provider, card data or money movement is connected. See
[Phase 9 commercial and white-label architecture](docs/architecture/phase-9-commercial-white-label.md).
