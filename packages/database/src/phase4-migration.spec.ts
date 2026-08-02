import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../prisma/migrations/20260727090000_phase_4_management_domain/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Phase 4 management migration", () => {
  it("replaces boolean lifecycles with explicit statuses", () => {
    expect(migration).toContain('CREATE TYPE "organization_status"');
    expect(migration).toContain('CREATE TYPE "merchant_status"');
    expect(migration).toContain('CREATE TYPE "branch_status"');
    expect(migration).toContain('DROP COLUMN IF EXISTS "active"');
  });

  it("creates composite organization-safe foreign keys", () => {
    expect(migration).toContain('FOREIGN KEY ("merchant_id", "organization_id", "tenant_id")');
    expect(migration).toContain('FOREIGN KEY ("franchise_id", "organization_id", "tenant_id")');
    expect(migration).toContain(
      'FOREIGN KEY ("membership_id", "user_id", "organization_id", "tenant_id")',
    );
  });
});
