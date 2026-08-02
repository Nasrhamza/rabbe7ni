# ADR-0004: Shared database with tenant column and RLS

- Status: Accepted
- Date: 2026-07-26

## Context

Rabbehni must scale to many organisations while preserving strict data isolation and manageable
migrations.

## Decision

Use shared PostgreSQL schemas with `tenant_id` on every tenant-owned row, application authorization
and PostgreSQL Row-Level Security. Schemas represent domains, not tenants.

## Consequences

- One migration path for all tenants.
- Efficient shared infrastructure and cross-tenant platform aggregates.
- Every query, job, event and cache key must propagate tenant context.
- RLS policies and privileged database roles require dedicated security tests.
