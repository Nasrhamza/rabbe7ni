# Phase 6 — Gamification architecture

## Domain boundary

Phase 6 adds six tenant-scoped modules without changing the Phase 5 loyalty ledger:

- `gamification`: tenant configuration, XP rules, append-only XP ledger, levels and customer
  progression;
- `challenges`: challenge lifecycle, applicability, enrollment, immutable progress events,
  validation and reward grants;
- `habits`: daily/weekly missions, timezone-aware periods, completion history and milestone
  rewards;
- `badges`: catalog, achievement rules, progress, award collection and audited revocation;
- `leaderboards`: scoped configuration, deterministic snapshots, privacy and scheduled generation;
- `gamification-events`: reliable BullMQ ingestion and idempotent processing of existing domain
  events.

No Phase 5 points or reward operation is duplicated. Challenge and habit point rewards call the
existing points repository with deterministic idempotency keys.

## Transaction and history invariants

- XP, level history, challenge progress, challenge reward grants, habit completions, streak history
  and leaderboard snapshots are append-only at PostgreSQL trigger level.
- XP and progress writers use PostgreSQL transaction advisory locks per tenant/customer/aggregate.
- Every automatic operation uses a tenant-unique idempotency key.
- XP balances are derived from the immutable ledger; the customer profile is a locked projection.
- Levels use monotonically increasing thresholds. A downward correction requires the explicit
  `gamification.adjust` permission and creates history.
- Challenge reward delivery calls idempotent Phase 5/6 award services before recording one unique
  grant per enrollment and reward.

## Event processing

The gamification event queue accepts the existing Phase 5 events (points, reward redemption, QR and
customer activity). A `GamificationEventReceipt` owns processing state and prevents duplicate
consumption. Each downstream effect also has a deterministic key:

`event:{eventId}:{effect}:{ruleOrAggregateId}`

Retries are exponential and safe after partial completion. Processing emits outbox events for XP,
challenge progress/completion, badges, levels and streaks.

## Timezones and streaks

Daily keys are calculated using `Intl.DateTimeFormat` and the configured IANA timezone, so DST does
not alter calendar-day identity. Weekly missions use ISO week keys. Streak transitions explicitly
cover same-day duplicates, consecutive days, grace days, freezes and reset behavior.

## Leaderboards and privacy

Configs support tenant, organization, franchise, merchant and branch scopes; daily, weekly, monthly
and all-time periods; and XP, points, challenges and streak metrics. Scope IDs are validated within
the tenant and organization boundary.

Snapshots are immutable. Scores sort descending and customer UUID is the stable tie breaker.
Customers may opt out. Depending on configuration, opted-out customers are excluded or included
under an anonymized alias. Snapshot generation is scheduled through BullMQ job schedulers.

## Isolation and authorization

All 28 Phase 6 tables carry `tenant_id`, enable and force PostgreSQL RLS, and use
`app.current_tenant_id`. API requests also enforce organization access boundaries. Separate RBAC
permissions protect reading, configuration, automatic processing, manual validation, XP correction,
badge revocation and snapshot generation.
