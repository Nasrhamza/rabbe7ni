import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    import.meta.dirname,
    "../prisma/migrations/20260802153000_platform_regions/migration.sql",
  ),
  "utf8",
);

describe("platform country and region migration", () => {
  it("creates the complete regional governance model", () => {
    expect(migration).toContain('CREATE TABLE "platform_countries"');
    expect(migration).toContain('CREATE TABLE "platform_regions"');
    expect(migration).toContain('CREATE TABLE "region_administrators"');
    expect(migration).toContain('CREATE TYPE "region_status"');
  });

  it("prevents cross-tenant country, region and assignment access", () => {
    for (const table of ["platform_countries", "platform_regions", "region_administrators"]) {
      expect(migration).toContain(table);
    }
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("app.current_tenant_id");
  });

  it("uses composite tenant foreign keys for regional relations", () => {
    expect(migration).toContain(
      'FOREIGN KEY ("country_id", "tenant_id") REFERENCES "platform_countries"("id", "tenant_id")',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("region_id", "tenant_id") REFERENCES "platform_regions"("id", "tenant_id")',
    );
  });
});
