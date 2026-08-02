# ADR-0001: Nx and pnpm monorepo

- Status: Accepted
- Date: 2026-07-26

## Context

Rabbehni includes web, mobile, API, worker, AI and shared technical packages. The repository needs
consistent commands, dependency visibility and cached quality gates.

## Decision

Use a pnpm workspace orchestrated by Nx. Projects expose explicit `project.json` targets so the
workspace is not coupled to framework-specific Nx generators.

## Consequences

- Shared tooling and atomic cross-application changes.
- Nx can cache and order tasks.
- Package boundaries must remain explicit.
- Mobile and Python tooling still retain their native commands.

## Alternatives considered

Turborepo was simpler but provides less architectural boundary metadata. Independent repositories
would increase contract and version coordination cost during the PFE.
