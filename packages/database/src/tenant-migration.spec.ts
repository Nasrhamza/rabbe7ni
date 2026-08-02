import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../prisma/migrations/20260726120000_phase_2_core_domain/migration.sql", import.meta.url),
  "utf8",
);

const TENANT_TABLES = [
  "organizations",
  "franchises",
  "merchants",
  "branches",
  "memberships",
  "staff",
  "roles",
  "role_permissions",
  "membership_roles",
  "subscriptions",
  "tenant_settings",
  "audit_logs",
  "outbox_events",
] as const;

describe("Phase 2 tenant migration", () => {
  it.each(TENANT_TABLES)("creates tenant_id on %s", (table) => {
    const tableDefinition = migration.match(
      new RegExp(`CREATE TABLE "${table}" \\(([\\s\\S]*?)\\n\\);`, "u"),
    )?.[1];

    expect(tableDefinition).toContain('"tenant_id" UUID NOT NULL');
  });

  it("enables and forces RLS for the isolation root and tenant table loop", () => {
    expect(migration).toContain('ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('ALTER TABLE "tenants" FORCE ROW LEVEL SECURITY');
    expect(migration).toContain("FOREACH tenant_table IN ARRAY");
    expect(migration).toContain("ALTER TABLE %I ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("ALTER TABLE %I FORCE ROW LEVEL SECURITY");
    for (const table of TENANT_TABLES) {
      expect(migration).toContain(`'${table}'`);
    }
  });
});
