import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../prisma/migrations/20260727124615_phase_7_marketing/migration.sql", import.meta.url),
  "utf8",
);

describe("Phase 7 marketing migration", () => {
  const tables = [
    "customer_segments",
    "segment_memberships",
    "segment_membership_history",
    "campaigns",
    "campaign_segments",
    "campaign_applicability",
    "automation_workflows",
    "automation_steps",
    "automation_executions",
    "automation_step_executions",
    "notification_templates",
    "notification_template_versions",
    "notification_deliveries",
    "notification_attempts",
    "in_app_notifications",
    "customer_communication_preferences",
    "campaign_metrics",
    "marketing_event_receipts",
  ] as const;

  it("creates every Phase 7 aggregate", () => {
    for (const table of tables) expect(migration).toContain(`CREATE TABLE "${table}"`);
  });

  it("enables and forces tenant RLS for every table", () => {
    for (const table of tables) expect(migration).toContain(`'${table}'`);
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("app.current_tenant_id");
  });

  it("keeps marketing history immutable", () => {
    for (const trigger of [
      "segment_membership_history_append_only",
      "notification_template_versions_append_only",
      "notification_attempts_append_only",
      "campaign_metrics_append_only",
    ]) {
      expect(migration).toContain(trigger);
    }
  });

  it("enforces delivery, workflow and event idempotency", () => {
    expect(migration).toContain("notification_deliveries_tenant_id_idempotency_key_key");
    expect(migration).toContain("automation_executions_tenant_id_idempotency_key_key");
    expect(migration).toContain("marketing_event_receipts_tenant_id_event_id_key");
  });
});
