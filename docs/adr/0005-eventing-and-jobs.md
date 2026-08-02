# ADR-0005: NATS JetStream for events and Redis-backed queues for jobs

- Status: Accepted
- Date: 2026-07-26

## Context

Domain events need durable replay and independent consumers. Scheduled automation, retries and
rate-controlled provider calls need job semantics.

## Decision

Use NATS JetStream for durable events and BullMQ/Redis for scheduled or retryable jobs. Use the
transactional outbox for event publication.

## Consequences

- Event replay and scalable consumers.
- Jobs have explicit retry and scheduling semantics.
- Two asynchronous tools must be operated and observed.
- Consumers and jobs must be idempotent.
