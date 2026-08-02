import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../prisma/migrations/20260727102711_phase_5_loyalty_qr/migration.sql", import.meta.url),
  "utf8",
);

describe("Phase 5 loyalty and QR migration", () => {
  it("creates every core customer, loyalty, reward and QR table", () => {
    for (const table of [
      "customers",
      "customer_activities",
      "loyalty_programs",
      "earning_rules",
      "redemption_rules",
      "points_ledger_entries",
      "rewards",
      "reward_redemptions",
      "customer_qr_tokens",
      "qr_transactions",
    ]) {
      expect(migration).toContain(`CREATE TABLE "${table}"`);
    }
  });

  it("forces tenant RLS and append-only evidence", () => {
    expect(migration).toContain("FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("app.current_tenant_id");
    expect(migration).toContain("points_ledger_entries_append_only");
    expect(migration).toContain("qr_transactions_append_only");
  });

  it("enforces idempotency and reversal uniqueness", () => {
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "points_ledger_entries_tenant_id_idempotency_key_key"',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "reward_redemptions_tenant_id_idempotency_key_key"',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "qr_transactions_tenant_id_idempotency_key_key"',
    );
  });
});
