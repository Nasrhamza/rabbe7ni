# Phase 8 — Analytics, reporting and explainable AI

The analytics service owns canonical ingestion, ClickHouse raw/clean/fact datasets, reconciliation
and metric queries. PostgreSQL remains authoritative for business records, report schedules,
artifacts and audited AI requests. The API enforces OIDC, RBAC, tenant context and RLS before it
calls internal analytics or AI contracts.

Expensive snapshots, backfills, reports and AI analyses run through BullMQ. Idempotency keys are
tenant-scoped. ClickHouse tables include `tenant_id` in every ordering key and every query requires
an explicit tenant predicate. Internal calls require a configurable token; no provider secret is
committed.

The AI service accepts only redacted aggregate metrics and constrained capability enums. Its local
provider is deterministic, explainable and suitable for seeded development/evaluation data. A
configurable remote provider is wrapped by timeout and circuit-breaker behavior. Invalid,
unavailable or unsafe provider output falls back to deterministic analysis. Every response includes
model/prompt versions, confidence, uncertainty, contributing metrics and a statement that human
review is required. AI never calls a Rabbehni mutation endpoint.

CSV reports contain query criteria, freshness and actual metric values. Artifacts are tenant-owned,
checksummed, expire automatically and are downloaded only through an authenticated API route.
Scheduled delivery reuses the notification domain. PDF remains disabled until a renderer can be
validated reliably; CSV is the supported production artifact in this phase.
