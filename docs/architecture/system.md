# System context and containers

## Context

```mermaid
flowchart LR
  People["Platform administrators, regional administrators,<br/>merchant teams and customers"]
  Rabbehni["Rabbehni platform"]
  Identity["OIDC identity provider"]
  Payment["Payment providers"]
  Messaging["Email, SMS and push providers"]
  Cloud["Cloud infrastructure"]

  People --> Rabbehni
  Rabbehni --> Identity
  Rabbehni --> Payment
  Rabbehni --> Messaging
  Rabbehni --> Cloud
```

External payment and messaging adapters remain architecture placeholders in Phase 1.

## Containers

```mermaid
flowchart TB
  Admin["Next.js admin-web"]
  Merchant["Next.js merchant-web"]
  Mobile["Expo customer-mobile"]
  API["NestJS/Fastify API"]
  Worker["NestJS notification-worker"]
  AI["FastAPI AI service"]
  Analytics["NestJS analytics service"]
  Keycloak["Keycloak"]
  PG["PostgreSQL"]
  Redis["Redis"]
  NATS["NATS JetStream"]
  CH["ClickHouse"]
  S3["S3-compatible storage"]
  OTel["OpenTelemetry Collector"]

  Admin --> API
  Merchant --> API
  Mobile --> API
  API --> Keycloak
  API --> PG
  API --> Redis
  API --> NATS
  NATS --> Worker
  NATS --> AI
  Analytics --> CH
  Worker --> S3
  API --> OTel
  Worker --> OTel
  AI --> OTel
  Analytics --> OTel
```

Solid nodes describe deployable technical boundaries. Phase 1 wires only health dependencies:
API-to-PostgreSQL/Redis/BullMQ, analytics-to-ClickHouse and notification-worker-to-BullMQ.
Event arrows describe the approved later integration style, not an implemented business flow.

## Communication rules

- Client-to-platform traffic uses versioned HTTPS REST APIs.
- Server-to-client live dashboard updates prefer SSE.
- Domain events use NATS JetStream with versioned envelopes.
- Scheduled or retryable tasks use Redis-backed BullMQ queues.
- Object payloads larger than broker limits are stored in S3 and referenced by URI.
- No frontend connects directly to PostgreSQL, Redis, NATS or ClickHouse.
