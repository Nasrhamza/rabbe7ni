# ADR 0009: Phase 1 technical service topology

- Status: Accepted
- Date: 2026-07-26

## Context

The approved architecture requires separate administration, merchant, customer mobile, API, AI,
analytics and notification-worker deployables. Phase 1 must make those boundaries concrete without
prematurely implementing Rabbehni business capabilities.

## Decision

Create seven applications in one Nx/pnpm monorepo. Use Next.js for both web shells, Expo Development
Build for mobile, NestJS with Fastify for Node HTTP processes, FastAPI for the Python AI shell,
Prisma/PostgreSQL for operational persistence, Redis/BullMQ for jobs and ClickHouse for analytical
readiness. Cross-cutting Node concerns are implemented as internal workspace packages.

Every server exposes only technical status, liveness, readiness and API documentation. The
notification worker exposes an HTTP health process but registers no job processor.

## Consequences

- Each future business capability has an explicit deployment destination.
- Technical health can be tested before domain implementation begins.
- Multiple deployables increase build and operational overhead.
- A committed pnpm lockfile and generated Prisma client are prerequisites for reproducible builds.
- Business modules require later ADRs and cannot be inferred from these technical shells.
