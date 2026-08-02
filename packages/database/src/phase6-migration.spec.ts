import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../prisma/migrations/20260727112720_phase_6_gamification/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Phase 6 gamification migration", () => {
  it("creates every gamification aggregate", () => {
    for (const table of [
      "gamification_configs",
      "xp_rules",
      "level_definitions",
      "customer_gamification_profiles",
      "xp_ledger_entries",
      "challenges",
      "challenge_progress_events",
      "challenge_reward_grants",
      "habits",
      "habit_completions",
      "streak_history",
      "badges",
      "achievement_progress",
      "leaderboard_snapshots",
      "gamification_event_receipts",
    ]) {
      expect(migration).toContain(`CREATE TABLE "${table}"`);
    }
  });

  it("forces tenant RLS across Phase 6", () => {
    expect(migration).toContain("FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("app.current_tenant_id");
    expect(migration).toContain("'leaderboard_entries'");
    expect(migration).toContain("'achievement_progress'");
  });

  it("makes business history append-only", () => {
    for (const trigger of [
      "xp_ledger_entries_append_only",
      "customer_level_history_append_only",
      "challenge_progress_events_append_only",
      "challenge_reward_grants_append_only",
      "habit_completions_append_only",
      "streak_history_append_only",
      "leaderboard_snapshots_append_only",
    ]) {
      expect(migration).toContain(trigger);
    }
  });

  it("enforces idempotency and duplicate-award constraints", () => {
    expect(migration).toContain("xp_ledger_entries_tenant_id_idempotency_key_key");
    expect(migration).toContain("challenge_reward_grants_tenant_id_challenge_reward_id_enrol_key");
    expect(migration).toContain("customer_badges_tenant_id_customer_id_badge_id_key");
    expect(migration).toContain("gamification_event_receipts_tenant_id_event_id_key");
  });
});
