# Architecture documentation

## Status

The architecture is implemented through Phase 7. Authentication, strict multi-tenancy, management,
loyalty/QR, gamification and marketing automation retain separate module, ledger and worker
boundaries.

## Views

- [Phase 0 scope](phase-0-scope.md)
- [Phase 1 technical foundation](phase-1-foundation.md)
- [Phase 2 core domain](phase-2-core-domain.md)
- [Phase 3 authentication and design system](phase-3-auth-design-system.md)
- [Phase 5 loyalty, rewards and QR](phase-5-loyalty-qr.md)
- [Phase 6 gamification](phase-6-gamification.md)
- [Phase 7 marketing automation](phase-7-marketing-automation.md)
- [System context and containers](system.md)
- [Module boundaries](modules.md)
- [Multi-tenancy](multi-tenancy.md)
- [Data architecture](data.md)
- [Security architecture](security.md)
- [Observability](observability.md)
- [Deployment](deployment.md)
- [Testing strategy](testing.md)

## Decision records

Accepted architecture decisions are stored in [`docs/adr`](../adr). A material change requires a
new ADR that supersedes, rather than silently edits, the previous decision.

## Architecture qualities

The foundation prioritizes:

1. tenant isolation;
2. transactional correctness;
3. auditability;
4. cultural and localization extensibility;
5. horizontal scalability;
6. operability;
7. testability;
8. explicit module ownership.
