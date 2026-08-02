# ADR-0007: ClickHouse as the analytical read store

- Status: Accepted
- Date: 2026-07-26

## Context

The project requires global, regional and merchant real-time analytics without placing analytical
load on the operational database.

## Decision

Use ClickHouse as a derived event and aggregate store. PostgreSQL remains the source of truth.

## Consequences

- Fast analytical queries and scalable aggregation.
- Data is eventually consistent.
- Event replay and reconciliation are mandatory.
- No operational authorization decision may depend solely on ClickHouse.
