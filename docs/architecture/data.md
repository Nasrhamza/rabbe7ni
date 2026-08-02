# Data architecture

## Operational store

PostgreSQL is the transactional source of truth. Prisma 7 is the approved application data access
layer.

Phase 1 provides the client and lifecycle foundation. Phase 2 adds:

- the approved core domain `schema.prisma`;
- explicit generated-client output;
- a PostgreSQL driver adapter;
- NestJS connection lifecycle and readiness ping;
- separate runtime and migration connection variables;
- a reviewed initial migration with integrity constraints and forced RLS;
- an idempotent platform/demo seed;
- a tenant transaction manager that sets transaction-local RLS context.

## Prisma policy

- `prisma migrate dev` is local-development only.
- `prisma migrate deploy` is used in controlled environments.
- Generated migrations are reviewed as SQL.
- Native PostgreSQL features, including RLS and partitioning, may use reviewed custom SQL.
- Destructive migration warnings must not be bypassed automatically.
- Production application and migration roles are distinct.

## Event consistency

State changes that publish technical events use:

1. an operational transaction;
2. an outbox row written by the same Prisma transaction;
3. an asynchronous publisher;
4. idempotent consumers;
5. reconciliation and replay.

Direct dual writes to PostgreSQL and NATS/ClickHouse are forbidden.

## Analytical store

ClickHouse is a derived, rebuildable read store. It does not authorize or settle operational
transactions. Events must include schema version, tenant, correlation, occurrence time and stable
event identifier.

## Redis

Redis may hold cache, locks, rate limits, QR nonces and job state. It is never the sole durable source
for a financial, loyalty, visit or reward fact.

## Object storage

Tenant paths use immutable identifiers:

```text
tenants/{tenantId}/assets/...
tenants/{tenantId}/reports/...
tenants/{tenantId}/models/...
```

Private objects require short-lived signed URLs and access checks before URL generation.
