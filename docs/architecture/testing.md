# Testing strategy

## Test layers

1. Static formatting and lint checks.
2. Strict TypeScript/Python type checks.
3. Unit tests for policies and pure domain logic.
4. Integration tests with real PostgreSQL, Redis and NATS.
5. Contract tests for HTTP and events.
6. End-to-end web and API tests.
7. Mobile end-to-end tests on emulators and real devices.
8. Tenant isolation and authorization negative tests.
9. Load, resilience and security tests.

## Phase 1 gates

- Prettier.
- ESLint and Ruff.
- TypeScript and mypy.
- Vitest and pytest.
- Next.js, NestJS, Expo and FastAPI compilation.
- Prisma validation and client generation.
- Dependency-free repository structure and manifest validation.
- Docker Compose configuration and container image builds.

Until the lockfile and Docker runtime are available, the dependency-free static validator is the
authoritative local gate. It does not replace the full gates in CI.

## Phase 2 gates

- Prisma format, validation and client generation.
- Migration deployment and idempotent seed against PostgreSQL.
- Unit tests for tenant context, DTO invariants and domain service event publication.
- PostgreSQL integration tests through the non-owner application role. Set `TEST_DATABASE_URL` to
  enable the suite; it is skipped with an explicit runtime blocker when PostgreSQL is unavailable.
- All Phase 1 formatting, linting, type checking, test, build and static foundation gates.

## Critical invariants

- No cross-tenant access. Phase 2 enforces this in composite foreign keys, repositories and RLS.
- No double check-in, game outcome, reward grant or redemption.
- Point and reward ledgers reconcile.
- Event consumers are idempotent.
- Analytics aggregates reconcile with operational events.
- Probability distributions satisfy configured tolerances.
- Arabic RTL works in web, mobile and PDF output.
