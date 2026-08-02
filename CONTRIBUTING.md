# Contributing

## Branches and changes

- Keep changes scoped to one architectural or product objective.
- Add an ADR before changing a decision marked as accepted.
- Never mix generated credentials or `.env` files into commits.
- Business code must be assigned to an approved bounded context.

## Required checks

Before requesting review:

```powershell
pnpm validate
```

For AI service changes, use the workspace virtual environment:

```powershell
.\.venv\Scripts\python.exe -m ruff check apps/ai
.\.venv\Scripts\python.exe -m mypy apps/ai/src apps/ai/tests
.\.venv\Scripts\python.exe -m pytest apps/ai/tests
```

## Dependency policy

- Pin direct dependencies.
- Keep the Node, pnpm and Python versions aligned with repository version files.
- Use Prisma migrations for operational schema changes.
- Do not use `prisma db push` for shared or production environments.
- Review release notes before any major framework update.

## Architectural boundaries

- PostgreSQL is the operational source of truth.
- Analytics and AI cannot mutate operational tables directly.
- Every tenant-scoped command, event, job and storage path must carry a tenant identifier.
- Cross-module writes happen through the owning module.
- Sensitive values must be redacted from logs and traces.
