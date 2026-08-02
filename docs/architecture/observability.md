# Observability

## Signals

- Structured JSON logs through Pino for Node services and a JSON formatter for FastAPI.
- OpenTelemetry traces from applications to the Collector.
- The Collector exposes an OTLP-to-Prometheus metrics pipeline for future application metrics.
- The Collector exposes an OTLP-to-Loki log pipeline; Phase 1 application logs remain structured
  standard output until a deployment-level log shipper is selected.
- Traces stored in Tempo.
- Grafana provisions Prometheus, Loki and Tempo data sources.

## Required context

Every future request, event and job should expose:

- service name and version;
- environment;
- request and correlation identifiers;
- tenant identifier where authorized;
- event or job identifier;
- outcome and duration.

Personal data, tokens and message bodies are excluded.

## Health endpoints

- Liveness answers whether the process is healthy.
- Readiness answers whether the process can serve traffic.
- A dependency outage should affect readiness only when that dependency is required for the
  requested service mode.

Phase 1 readiness checks the runtime dependencies already wired into each shell: Prisma/PostgreSQL,
Redis/BullMQ and ClickHouse. Identity is not a runtime dependency because authentication is excluded.

## Service objectives

Exact SLOs require approved traffic and latency targets. No arbitrary production guarantee is
encoded in Phase 1.
