# ADR-0002: Modular transactional core with event-driven services

- Status: Accepted
- Date: 2026-07-26

## Context

The platform has many bounded contexts but also strong transactional invariants around visits,
loyalty, rewards, games and billing. Starting with many independently deployed microservices would
create avoidable distributed consistency risk.

## Decision

Use a modular NestJS transactional core, separately deployable workers, a Python AI service and a
derived analytics service. Publish domain events through an outbox and NATS JetStream.

## Consequences

- Local transactions preserve core invariants.
- Modules can be extracted when scale or ownership justifies it.
- Event schemas and module boundaries must be enforced early.
- Derived systems are eventually consistent and require reconciliation.
