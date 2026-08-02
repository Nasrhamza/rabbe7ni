# Phase 7 — Segmentation, campaigns and marketing automation

Phase 7 adds tenant-isolated operational marketing capabilities without changing the
approved modular architecture. The API owns orchestration and policy decisions; the
notification worker owns provider delivery. PostgreSQL remains the source of truth and
BullMQ carries resumable asynchronous work.

## Module boundaries

- `segments` owns static and dynamic segment definitions, nested AND/OR evaluation,
  previews, refresh schedules, membership snapshots and immutable membership history.
- `campaigns` owns campaign lifecycle, target segments, organization/franchise/merchant/
  branch applicability, timezone-aware scheduling, frequency caps, approval and
  operational counters.
- `automations` owns event and scheduled workflows, ordered conditions, waits, notification
  and reward actions, exit paths, execution idempotency, retry, pause, resume and cancel.
- `notifications` owns localized/versioned templates, safe scalar rendering, normalized
  consent preferences, quiet hours, quotas, delivery records, retries and the mobile inbox.
- `marketing-events` consumes Phase 5 and Phase 6 event contracts exactly once and starts
  matching automation workflows.
- `notification-worker` performs provider delivery, records immutable attempts and moves
  exhausted deliveries to the dead-letter state.

No module reads another tenant directly. Every tenant-owned Phase 7 table has `tenant_id`,
forced PostgreSQL Row-Level Security and an `app.current_tenant_id` policy. Organization
access boundaries are applied in addition to tenant RLS where a resource is organization
owned.

## Reliability

Business idempotency keys are stored under unique tenant constraints for segment
memberships, automation executions and steps, notification deliveries, campaign metrics
and incoming events. Advisory transaction locks serialize refresh, workflow and delivery
operations. Provider failures are committed before BullMQ retries the job; exhausted
attempts are retained in the dead-letter state. Notification consent is checked both when
queueing and immediately before delivery.

Wait steps persist `nextRunAt`, resume the existing execution and advance exactly once.
Reward and send step keys derive from the execution and step identifiers, preventing
duplicate grants or sends after retries.

## Privacy and delivery policy

Dynamic segment refresh excludes customers who explicitly reject marketing. Notification
channel/category preferences override legacy preferences. Quiet hours are evaluated in
the customer preference IANA timezone, including cross-midnight ranges. Tenant daily
quotas and campaign per-customer frequency windows are enforced before a delivery is
created.

Templates support email, push, SMS, in-app and a WhatsApp provider abstraction. Rendering
accepts scalar variables only, HTML-escapes values and fails closed on missing variables.
Template versions and delivery attempts are append-only and audited.

## User surfaces

Admin and Merchant workspaces expose functional segment builders, campaign management,
workflow management, templates, delivery history/retry, preferences and operational
metrics. Customer Mobile exposes an inbox with unread state, detail/deep-link metadata,
read/read-all actions and per-channel communication preferences. These surfaces retain
the existing functional design shell; final premium visual redesign remains outside this
phase.
