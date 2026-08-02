# Phase 2 core domain and database foundation

## Scope

Phase 2 implements the transactional foundation for users, tenants, organizations, franchises,
merchants, branches, staff, memberships, roles, permissions, plans, subscriptions, tenant settings,
audit logs and an outbox for technical events.

It intentionally contains no authentication flow, loyalty, QR, gamification, campaigns, provider
payments or AI business logic.

## Ownership and hierarchy

| Entity         | Ownership     | Cardinality and boundary                                      |
| -------------- | ------------- | ------------------------------------------------------------- |
| User           | Platform      | Global identity profile; may join several tenants             |
| Tenant         | Platform root | Security, data isolation and subscription boundary            |
| Organization   | Tenant        | Exactly one organization per tenant in Phase 2                |
| Franchise      | Organization  | Optional network grouping for merchants                       |
| Merchant       | Organization  | Commerce; optionally belongs to one franchise                 |
| Branch         | Merchant      | Physical or operational point of sale                         |
| Membership     | Tenant        | Connects a user to the tenant organization                    |
| Staff          | Tenant        | Operational assignment, optionally scoped to merchant/branch  |
| Role           | Tenant        | Tenant-local role with organization, merchant or branch scope |
| Permission     | Platform      | Global immutable permission catalogue                         |
| Plan           | Platform      | Global subscription entitlement definition                    |
| Subscription   | Tenant        | Tenant history and current entitlement state                  |
| Tenant setting | Tenant        | Versioned namespaced JSON configuration                       |
| Audit log      | Tenant        | Append-oriented security and domain audit record              |
| Outbox event   | Tenant        | Durable technical event awaiting publication                  |

## Tenant enforcement

The enforcement path is:

1. request middleware creates an asynchronous request context;
2. tenant-scoped services never accept `tenant_id` from their DTO;
3. repositories read the active tenant from `TenantContextStore`;
4. `TenantTransactionService` starts a Prisma transaction and sets the PostgreSQL local setting;
5. every tenant table has forced RLS with matching `USING` and `WITH CHECK` predicates;
6. composite foreign keys include `tenant_id` for hierarchical relationships;
7. the API uses a non-owner, non-superuser database role; migrations use the direct owner URL.

Global `users`, `permissions` and `plans` are not tenant-owned. They are only accessed by their
own control-plane repositories and are never exposed through an unrestricted tenant query.

## Transaction and event rule

The outbox schema is the durable technical event foundation. Phase 2 services emit versioned
technical event names and correlation identifiers. A later delivery worker may publish pending
outbox rows; no business broker consumer is introduced in this phase.

## Runtime database roles

- `DIRECT_DATABASE_URL` is reserved for migrations and administrative maintenance.
- `DATABASE_URL` uses `POSTGRES_APP_USER`, which does not own tables and cannot bypass RLS.
- `TEST_DATABASE_URL` must also use a non-owner role so the isolation integration suite is
  meaningful.

The Docker initialization script creates the application login and default table privileges on a
fresh PostgreSQL volume.
