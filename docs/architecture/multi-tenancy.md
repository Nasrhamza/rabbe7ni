# Multi-tenancy

## Tenant definition

A `Tenant` is the security, billing and operational isolation root. In Phase 2 each tenant owns
exactly one `Organization`, while a person may be a member of several tenants. Every tenant-scoped
request has exactly one active tenant context.

## Storage model

- Shared PostgreSQL database.
- Schemas grouped by technical/domain ownership, never one schema per tenant.
- Every tenant-owned row receives `tenant_id NOT NULL`.
- Composite uniqueness and indexes start with `tenant_id` where appropriate.
- Row-Level Security is enabled and forced on every tenant-owned table.
- The normal application role cannot own tables and cannot have `BYPASSRLS`.
- Tenant-owned foreign keys include `tenant_id`, preventing a child row from referencing a parent
  in another tenant.

## Context resolution

Authentication is deliberately outside Phase 2. The current technical middleware accepts UUID
context headers from the trusted ingress boundary. When authentication is introduced, the API must
reconcile:

1. custom domain/subdomain;
2. OIDC organisation claim;
3. active application membership;
4. region, commerce or outlet scope;
5. target resource tenant.

The caller never selects an unrestricted `tenant_id` body field. Repositories obtain it only from
`TenantContextStore`, then open a transaction that calls
`set_config('app.current_tenant_id', tenant_id, true)` before any tenant query.

## Core hierarchy

1. `Tenant` is the database isolation and subscription boundary.
2. `Organization` is the legal and administrative entity; it has a one-to-one relation with the
   tenant in Phase 2.
3. `Franchise` is an optional commercial network owned by the organization.
4. `Merchant` is a commerce owned by the organization and may belong to one franchise.
5. `Branch` is a physical or operational point of sale owned by one merchant.

Composite database constraints ensure that franchise, merchant, branch, membership and staff
assignments cannot cross those boundaries.

## Propagation

The tenant identifier is mandatory in:

- operational rows;
- event envelopes;
- queue jobs;
- Redis key namespaces;
- object-store paths;
- ClickHouse rows;
- report metadata;
- AI features, predictions and explanations;
- audit events.

## Franchise boundary

A franchisor organisation may link to independently operated franchisee organisations through an
explicit membership record. Aggregate access is the default. Access to customer-level data requires
an explicit delegation and a documented legal basis.

## Isolation tests

- The Phase 2 PostgreSQL integration suite verifies that an unfiltered query only returns the active
  tenant and that a cross-tenant insert is rejected by RLS.
- Same natural identifier in two tenants does not collide because uniqueness begins with
  `tenant_id`.
- A future token from tenant A cannot read, infer, mutate, export or cache tenant B.
- Background jobs cannot run without tenant context.
- Super Admin endpoints use an explicit privileged path and produce audit records.
- Object URLs and reports cannot cross tenant boundaries.
