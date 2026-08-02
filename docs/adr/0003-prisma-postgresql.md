# ADR-0003: Prisma 7 over PostgreSQL

- Status: Accepted
- Date: 2026-07-26

## Context

PostgreSQL is the approved operational database. The project requires type-safe access, explicit
migrations and the ability to use native SQL for RLS, partitioning and performance.

## Decision

Use Prisma 7 with the `prisma-client` generator, explicit output directory and PostgreSQL driver
adapter. Review generated migrations and add native SQL where required.

## Consequences

- Type-safe schema-first client.
- Generated code is explicit and reproducible.
- RLS and advanced PostgreSQL features require reviewed migration SQL.
- Prisma Client generation is a mandatory build step.

## Alternatives considered

Drizzle was initially recommended for its direct SQL and RLS representation but was explicitly
replaced by Prisma after architecture approval. TypeORM was not selected because its entity and
runtime model offer less predictable control for this design.
