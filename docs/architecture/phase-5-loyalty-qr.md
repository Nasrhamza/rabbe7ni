# Phase 5 — Customer, loyalty, rewards and QR

## Module boundaries

- `customers`: tenant-scoped profile, consent, communication preferences, lifecycle and append-only activity timeline.
- `loyalty`: program lifecycle, thresholds, expiration policy, earning/redemption rules and organization/merchant/branch applicability.
- `points`: append-only signed ledger entries, derived balances, advisory-lock concurrency control, idempotency and compensating reversals.
- `rewards`: catalog, categories, stock, applicability and atomic redemption/reversal with the points ledger.
- `qr`: signed expiring customer tokens, hashed persistence, single-use claim, scan history and orchestration of earn/redeem operations.

## Ledger invariants

The balance is never accepted from a client and is not stored as an authoritative mutable field. It is calculated as `SUM(points_ledger_entries.points)` for a customer and program. Every mutation:

1. opens a tenant-bound PostgreSQL transaction;
2. acquires a transaction advisory lock for `tenant + customer + program`;
3. checks the tenant-wide idempotency key;
4. calculates the current balance from the ledger;
5. rejects unauthorized negative results;
6. appends one immutable entry, customer activity, audit log and outbox event.

Database triggers reject `UPDATE` and `DELETE` on ledger, customer activity and QR transaction evidence.

## Reward redemption

Redemption validates customer/program/reward organization alignment, active dates, applicability, eligibility boundary, points balance and stock. The points debit, redemption and stock decrement share one transaction. Cancellation and reversal append a compensating `REVERSE` entry and restore stock; the original ledger row is never changed.

## QR security

QR payloads contain version, tenant, customer, purpose, nonce, expiry and signed context. HMAC-SHA256 protects integrity. Only a SHA-256 token hash and nonce are persisted. Scanning rejects invalid signatures, expiry, tenant mismatch and purpose mismatch before the business operation. An atomic `ACTIVE → CONSUMED` update prevents replay, and operation-level idempotency prevents duplicate earn/redemption side effects.

## Tenant isolation

All Phase 5 tables carry `tenant_id`. PostgreSQL RLS is enabled and forced on every table using the transaction-local `app.current_tenant_id`. Composite foreign keys enforce organization alignment for programs, customers, merchants, branches, rewards and ledger entries.
