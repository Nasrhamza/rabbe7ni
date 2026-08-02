# Phase 1 technical foundation

## Outcome

Phase 1 turns the approved architecture into an executable technical skeleton. It defines all
application processes, shared technical packages, local infrastructure, health contracts,
observability bootstrap and delivery gates without implementing a business use case.

## Application boundaries

| Application           | Runtime                | Technical responsibility in Phase 1                                |
| --------------------- | ---------------------- | ------------------------------------------------------------------ |
| `admin-web`           | Next.js                | Administration status page and HTTP health route                   |
| `merchant-web`        | Next.js                | Merchant status page and HTTP health route                         |
| `customer-mobile`     | Expo Development Build | Native technical status screen                                     |
| `api`                 | NestJS + Fastify       | Versioned technical status, OpenAPI and dependency health          |
| `ai-service`          | FastAPI                | Technical health, validated settings, JSON logs and OTel bootstrap |
| `analytics-service`   | NestJS + Fastify       | Technical status and ClickHouse readiness                          |
| `notification-worker` | NestJS + Fastify       | Technical health server and BullMQ readiness                       |

The worker intentionally registers no processor. The analytics service performs no ingestion or KPI
calculation. The AI service contains no feature extraction, training, inference or recommendation
code.

## Shared packages

- `config` validates runtime contracts with Zod.
- `contracts` owns the transport-neutral technical status shape.
- `database` owns Prisma construction, connection lifecycle and a technical ping.
- `cache` owns the ioredis client, connection lifecycle and a technical ping.
- `queue` owns BullMQ connection parsing and technical queue names.
- `logger` owns request identifiers, structured Pino fields and secret redaction.
- `nestjs-platform` owns CORS, URI versioning, Fastify security plugins and OpenAPI setup.
- `observability` owns the Node OpenTelemetry SDK bootstrap and shutdown handle.

These packages contain no domain entity or business rule.

## Runtime dependency checks

Liveness proves that the process can answer. Readiness proves that mandatory technical dependencies
are reachable:

- API: process memory, PostgreSQL through Prisma, Redis and BullMQ;
- analytics service: process memory and ClickHouse;
- notification worker: process memory and BullMQ;
- web and AI shells: process health only.

Dependency failures affect readiness and must not be hidden by a successful liveness response.

## Environment contracts

`.env.example` is the canonical local inventory. Node service environments are parsed before Nest
completes startup. FastAPI settings are parsed through `pydantic-settings`. Secrets are examples for
local development only and must be replaced by a secret manager outside local environments.

## Delivery and validation

`tools/validate-foundation.mjs` checks the application/package inventory, Nx registration, JSON
configuration, workspace links, Dockerfiles, Compose services, documentation and absence of
forbidden business module directories without accessing a package registry.

Full lint, type, unit, build, Prisma and container checks require installed dependencies, generated
Prisma code, a lockfile and Docker. CI uses frozen dependency resolution.

## Explicit exclusions

Phase 1 does not implement authentication, authorization, tenant resolution, organisation or
franchise behavior, commerce or outlet behavior, loyalty, visits, QR, rewards, gamification, Smart
Habits, campaigns, marketing automation, payment, notifications, reporting, analytics business
logic, churn prediction or recommendations.
