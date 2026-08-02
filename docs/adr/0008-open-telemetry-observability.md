# ADR-0008: OpenTelemetry observability

- Status: Accepted
- Date: 2026-07-26

## Context

Requests and asynchronous flows cross several runtimes and stores. Vendor-specific instrumentation
would hinder correlation and portability.

## Decision

Use OpenTelemetry for traces and metrics, structured logs, an OpenTelemetry Collector, Prometheus,
Loki, Tempo and Grafana.

## Consequences

- Consistent cross-service correlation.
- Telemetry can be routed to another provider later.
- Cardinality and personal-data controls must be reviewed.
- Dashboards and alerts must evolve with production SLOs.
