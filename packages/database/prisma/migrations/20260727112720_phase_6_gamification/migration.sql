-- CreateEnum
CREATE TYPE "gamification_status" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "xp_entry_type" AS ENUM ('AWARD', 'ADJUST', 'REVERSE');

-- CreateEnum
CREATE TYPE "challenge_type" AS ENUM ('INDIVIDUAL', 'COMMUNITY');

-- CreateEnum
CREATE TYPE "challenge_cadence" AS ENUM ('ONE_TIME', 'DAILY', 'WEEKLY', 'RECURRING');

-- CreateEnum
CREATE TYPE "challenge_status" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'COMPLETED', 'CANCELED', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "challenge_validation" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateEnum
CREATE TYPE "challenge_enrollment_status" AS ENUM ('ENROLLED', 'PENDING_VALIDATION', 'COMPLETED', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "challenge_reward_type" AS ENUM ('POINTS', 'XP', 'BADGE');

-- CreateEnum
CREATE TYPE "gamification_progress_source" AS ENUM ('EVENT', 'CHECK_IN', 'MANUAL');

-- CreateEnum
CREATE TYPE "habit_cadence" AS ENUM ('DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "badge_rarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "badge_visibility" AS ENUM ('VISIBLE', 'HIDDEN');

-- CreateEnum
CREATE TYPE "leaderboard_scope" AS ENUM ('TENANT', 'ORGANIZATION', 'FRANCHISE', 'MERCHANT', 'BRANCH');

-- CreateEnum
CREATE TYPE "leaderboard_period" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'ALL_TIME');

-- CreateEnum
CREATE TYPE "leaderboard_metric" AS ENUM ('XP', 'POINTS', 'CHALLENGES', 'STREAK');

-- CreateEnum
CREATE TYPE "gamification_event_status" AS ENUM ('PROCESSING', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "gamification_configs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "default_timezone" TEXT NOT NULL DEFAULT 'UTC',
    "allow_manual_correction" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "gamification_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xp_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "event_type" TEXT NOT NULL,
    "xp" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "status" "gamification_status" NOT NULL DEFAULT 'DRAFT',
    "starts_at" TIMESTAMPTZ(3),
    "ends_at" TIMESTAMPTZ(3),
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "xp_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "level_definitions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "xp_threshold" INTEGER NOT NULL,
    "status" "gamification_status" NOT NULL DEFAULT 'ACTIVE',
    "benefits" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "level_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_gamification_profiles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "total_xp" INTEGER NOT NULL DEFAULT 0,
    "current_level_id" UUID,
    "leaderboard_opt_out" BOOLEAN NOT NULL DEFAULT false,
    "anonymize_on_leaderboard" BOOLEAN NOT NULL DEFAULT false,
    "leaderboard_alias" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_gamification_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xp_ledger_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "rule_id" UUID,
    "type" "xp_entry_type" NOT NULL,
    "xp" INTEGER NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "source_entry_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_level_history" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "from_level" INTEGER,
    "to_level" INTEGER NOT NULL,
    "xp_at_change" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "authorized_correction" BOOLEAN NOT NULL DEFAULT false,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_level_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenges" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "challenge_type" NOT NULL DEFAULT 'INDIVIDUAL',
    "cadence" "challenge_cadence" NOT NULL DEFAULT 'ONE_TIME',
    "status" "challenge_status" NOT NULL DEFAULT 'DRAFT',
    "validation_mode" "challenge_validation" NOT NULL DEFAULT 'AUTOMATIC',
    "objective_type" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "eligibility" JSONB NOT NULL DEFAULT '{}',
    "recurrence" JSONB NOT NULL DEFAULT '{}',
    "start_at" TIMESTAMPTZ(3) NOT NULL,
    "end_at" TIMESTAMPTZ(3) NOT NULL,
    "community_progress" INTEGER NOT NULL DEFAULT 0,
    "auto_enroll" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_applicability" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "challenge_id" UUID NOT NULL,
    "scope" "leaderboard_scope" NOT NULL,
    "target_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "challenge_applicability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_enrollments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "challenge_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "status" "challenge_enrollment_status" NOT NULL DEFAULT 'ENROLLED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "enrolled_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),
    "validated_at" TIMESTAMPTZ(3),
    "validated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "challenge_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_progress_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "challenge_id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "source" "gamification_progress_source" NOT NULL,
    "delta" INTEGER NOT NULL,
    "resulting_progress" INTEGER NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "challenge_progress_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_rewards" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "challenge_id" UUID NOT NULL,
    "type" "challenge_reward_type" NOT NULL,
    "amount" INTEGER,
    "badge_id" UUID,
    "loyalty_program_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "challenge_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_reward_grants" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "challenge_id" UUID NOT NULL,
    "challenge_reward_id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "points_entry_id" UUID,
    "xp_entry_id" UUID,
    "customer_badge_id" UUID,
    "granted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "challenge_reward_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habits" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cadence" "habit_cadence" NOT NULL DEFAULT 'DAILY',
    "status" "gamification_status" NOT NULL DEFAULT 'DRAFT',
    "objective_type" TEXT NOT NULL,
    "target" INTEGER NOT NULL DEFAULT 1,
    "timezone" TEXT,
    "grace_days" INTEGER NOT NULL DEFAULT 0,
    "freeze_allowance" INTEGER NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMPTZ(3),
    "ends_at" TIMESTAMPTZ(3),
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "habits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_habits" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "habit_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "current_period_progress" INTEGER NOT NULL DEFAULT 0,
    "current_period_key" TEXT,
    "current_streak" INTEGER NOT NULL DEFAULT 0,
    "longest_streak" INTEGER NOT NULL DEFAULT 0,
    "freezes_remaining" INTEGER NOT NULL DEFAULT 0,
    "last_qualified_local_date" DATE,
    "enrolled_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_habits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habit_completions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "habit_id" UUID NOT NULL,
    "customer_habit_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "source" "gamification_progress_source" NOT NULL,
    "local_date" DATE NOT NULL,
    "period_key" TEXT NOT NULL,
    "progress" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "habit_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habit_milestones" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "habit_id" UUID NOT NULL,
    "streak_threshold" INTEGER NOT NULL,
    "reward_type" "challenge_reward_type" NOT NULL,
    "reward_amount" INTEGER,
    "badge_id" UUID,
    "loyalty_program_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "habit_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "streak_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qualifying_event" TEXT NOT NULL,
    "status" "gamification_status" NOT NULL DEFAULT 'DRAFT',
    "timezone" TEXT,
    "grace_days" INTEGER NOT NULL DEFAULT 0,
    "freeze_allowance" INTEGER NOT NULL DEFAULT 0,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "streak_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_streaks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "streak_rule_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "current_streak" INTEGER NOT NULL DEFAULT 0,
    "longest_streak" INTEGER NOT NULL DEFAULT 0,
    "freezes_remaining" INTEGER NOT NULL DEFAULT 0,
    "last_qualified_local_date" DATE,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_streaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "streak_history" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_streak_id" UUID NOT NULL,
    "streak_rule_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "local_date" DATE NOT NULL,
    "previous_streak" INTEGER NOT NULL,
    "current_streak" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "streak_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badge_categories" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "badge_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "category_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rarity" "badge_rarity" NOT NULL DEFAULT 'COMMON',
    "visibility" "badge_visibility" NOT NULL DEFAULT 'VISIBLE',
    "status" "gamification_status" NOT NULL DEFAULT 'DRAFT',
    "icon_url" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievement_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "badge_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "target" INTEGER NOT NULL DEFAULT 1,
    "status" "gamification_status" NOT NULL DEFAULT 'DRAFT',
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "achievement_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_badges" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "badge_id" UUID NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 100,
    "earned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),
    "revoked_by_user_id" UUID,
    "revocation_reason" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "customer_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_configs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "leaderboard_scope" NOT NULL,
    "scope_id" UUID,
    "period" "leaderboard_period" NOT NULL,
    "metric" "leaderboard_metric" NOT NULL,
    "status" "gamification_status" NOT NULL DEFAULT 'DRAFT',
    "max_entries" INTEGER NOT NULL DEFAULT 100,
    "anonymize_opted_out" BOOLEAN NOT NULL DEFAULT true,
    "schedule" TEXT NOT NULL DEFAULT '0 * * * *',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "leaderboard_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_snapshots" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "config_id" UUID NOT NULL,
    "period_start" TIMESTAMPTZ(3) NOT NULL,
    "period_end" TIMESTAMPTZ(3) NOT NULL,
    "generated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotency_key" TEXT NOT NULL,

    CONSTRAINT "leaderboard_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "snapshot_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "display_name" TEXT NOT NULL,
    "anonymized" BOOLEAN NOT NULL DEFAULT false,
    "tie_breaker" TEXT NOT NULL,

    CONSTRAINT "leaderboard_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gamification_event_receipts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "status" "gamification_event_status" NOT NULL DEFAULT 'PROCESSING',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "failure_reason" TEXT,
    "processed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "gamification_event_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gamification_configs_tenant_id_key" ON "gamification_configs"("tenant_id");

-- CreateIndex
CREATE INDEX "xp_rules_tenant_id_organization_id_status_idx" ON "xp_rules"("tenant_id", "organization_id", "status");

-- CreateIndex
CREATE INDEX "xp_rules_tenant_id_event_type_status_idx" ON "xp_rules"("tenant_id", "event_type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "xp_rules_id_tenant_id_key" ON "xp_rules"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "xp_rules_tenant_id_code_key" ON "xp_rules"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "level_definitions_tenant_id_status_xp_threshold_idx" ON "level_definitions"("tenant_id", "status", "xp_threshold");

-- CreateIndex
CREATE UNIQUE INDEX "level_definitions_id_tenant_id_key" ON "level_definitions"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "level_definitions_tenant_id_code_key" ON "level_definitions"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "level_definitions_tenant_id_level_key" ON "level_definitions"("tenant_id", "level");

-- CreateIndex
CREATE UNIQUE INDEX "level_definitions_tenant_id_xp_threshold_key" ON "level_definitions"("tenant_id", "xp_threshold");

-- CreateIndex
CREATE INDEX "customer_gamification_profiles_tenant_id_organization_id_to_idx" ON "customer_gamification_profiles"("tenant_id", "organization_id", "total_xp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "customer_gamification_profiles_id_tenant_id_key" ON "customer_gamification_profiles"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_gamification_profiles_tenant_id_customer_id_key" ON "customer_gamification_profiles"("tenant_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_gamification_profiles_customer_id_tenant_id_key" ON "customer_gamification_profiles"("customer_id", "tenant_id");

-- CreateIndex
CREATE INDEX "xp_ledger_entries_tenant_id_customer_id_created_at_idx" ON "xp_ledger_entries"("tenant_id", "customer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "xp_ledger_entries_tenant_id_reference_type_reference_id_idx" ON "xp_ledger_entries"("tenant_id", "reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "xp_ledger_entries_id_tenant_id_key" ON "xp_ledger_entries"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "xp_ledger_entries_tenant_id_idempotency_key_key" ON "xp_ledger_entries"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "xp_ledger_entries_source_entry_id_tenant_id_key" ON "xp_ledger_entries"("source_entry_id", "tenant_id");

-- CreateIndex
CREATE INDEX "customer_level_history_tenant_id_customer_id_created_at_idx" ON "customer_level_history"("tenant_id", "customer_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "customer_level_history_id_tenant_id_key" ON "customer_level_history"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_level_history_tenant_id_idempotency_key_key" ON "customer_level_history"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "challenges_tenant_id_organization_id_status_start_at_end_at_idx" ON "challenges"("tenant_id", "organization_id", "status", "start_at", "end_at");

-- CreateIndex
CREATE INDEX "challenges_tenant_id_objective_type_status_idx" ON "challenges"("tenant_id", "objective_type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "challenges_id_tenant_id_key" ON "challenges"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "challenges_id_organization_id_tenant_id_key" ON "challenges"("id", "organization_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "challenges_tenant_id_code_key" ON "challenges"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "challenge_applicability_tenant_id_scope_target_id_idx" ON "challenge_applicability"("tenant_id", "scope", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_applicability_id_tenant_id_key" ON "challenge_applicability"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_applicability_tenant_id_challenge_id_scope_target_key" ON "challenge_applicability"("tenant_id", "challenge_id", "scope", "target_id");

-- CreateIndex
CREATE INDEX "challenge_enrollments_tenant_id_customer_id_status_idx" ON "challenge_enrollments"("tenant_id", "customer_id", "status");

-- CreateIndex
CREATE INDEX "challenge_enrollments_tenant_id_challenge_id_status_idx" ON "challenge_enrollments"("tenant_id", "challenge_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_enrollments_id_tenant_id_key" ON "challenge_enrollments"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_enrollments_tenant_id_challenge_id_customer_id_key" ON "challenge_enrollments"("tenant_id", "challenge_id", "customer_id");

-- CreateIndex
CREATE INDEX "challenge_progress_events_tenant_id_enrollment_id_occurred__idx" ON "challenge_progress_events"("tenant_id", "enrollment_id", "occurred_at");

-- CreateIndex
CREATE INDEX "challenge_progress_events_tenant_id_reference_type_referenc_idx" ON "challenge_progress_events"("tenant_id", "reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_progress_events_id_tenant_id_key" ON "challenge_progress_events"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_progress_events_tenant_id_idempotency_key_key" ON "challenge_progress_events"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "challenge_rewards_tenant_id_challenge_id_type_idx" ON "challenge_rewards"("tenant_id", "challenge_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_rewards_id_tenant_id_key" ON "challenge_rewards"("id", "tenant_id");

-- CreateIndex
CREATE INDEX "challenge_reward_grants_tenant_id_customer_id_granted_at_idx" ON "challenge_reward_grants"("tenant_id", "customer_id", "granted_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "challenge_reward_grants_id_tenant_id_key" ON "challenge_reward_grants"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_reward_grants_tenant_id_idempotency_key_key" ON "challenge_reward_grants"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_reward_grants_tenant_id_challenge_reward_id_enrol_key" ON "challenge_reward_grants"("tenant_id", "challenge_reward_id", "enrollment_id");

-- CreateIndex
CREATE INDEX "habits_tenant_id_organization_id_status_idx" ON "habits"("tenant_id", "organization_id", "status");

-- CreateIndex
CREATE INDEX "habits_tenant_id_objective_type_status_idx" ON "habits"("tenant_id", "objective_type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "habits_id_tenant_id_key" ON "habits"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "habits_tenant_id_code_key" ON "habits"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "customer_habits_tenant_id_customer_id_active_idx" ON "customer_habits"("tenant_id", "customer_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "customer_habits_id_tenant_id_key" ON "customer_habits"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_habits_tenant_id_habit_id_customer_id_key" ON "customer_habits"("tenant_id", "habit_id", "customer_id");

-- CreateIndex
CREATE INDEX "habit_completions_tenant_id_customer_habit_id_local_date_idx" ON "habit_completions"("tenant_id", "customer_habit_id", "local_date");

-- CreateIndex
CREATE UNIQUE INDEX "habit_completions_id_tenant_id_key" ON "habit_completions"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "habit_completions_tenant_id_idempotency_key_key" ON "habit_completions"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "habit_milestones_id_tenant_id_key" ON "habit_milestones"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "habit_milestones_tenant_id_habit_id_streak_threshold_key" ON "habit_milestones"("tenant_id", "habit_id", "streak_threshold");

-- CreateIndex
CREATE INDEX "streak_rules_tenant_id_organization_id_status_idx" ON "streak_rules"("tenant_id", "organization_id", "status");

-- CreateIndex
CREATE INDEX "streak_rules_tenant_id_qualifying_event_status_idx" ON "streak_rules"("tenant_id", "qualifying_event", "status");

-- CreateIndex
CREATE UNIQUE INDEX "streak_rules_id_tenant_id_key" ON "streak_rules"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "streak_rules_tenant_id_code_key" ON "streak_rules"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "customer_streaks_tenant_id_customer_id_current_streak_idx" ON "customer_streaks"("tenant_id", "customer_id", "current_streak" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "customer_streaks_id_tenant_id_key" ON "customer_streaks"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_streaks_tenant_id_streak_rule_id_customer_id_key" ON "customer_streaks"("tenant_id", "streak_rule_id", "customer_id");

-- CreateIndex
CREATE INDEX "streak_history_tenant_id_customer_streak_id_occurred_at_idx" ON "streak_history"("tenant_id", "customer_streak_id", "occurred_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "streak_history_id_tenant_id_key" ON "streak_history"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "streak_history_tenant_id_idempotency_key_key" ON "streak_history"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "badge_categories_id_tenant_id_key" ON "badge_categories"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "badge_categories_id_organization_id_tenant_id_key" ON "badge_categories"("id", "organization_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "badge_categories_tenant_id_code_key" ON "badge_categories"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "badges_tenant_id_organization_id_status_rarity_idx" ON "badges"("tenant_id", "organization_id", "status", "rarity");

-- CreateIndex
CREATE UNIQUE INDEX "badges_id_tenant_id_key" ON "badges"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "badges_id_organization_id_tenant_id_key" ON "badges"("id", "organization_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "badges_tenant_id_code_key" ON "badges"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "achievement_rules_tenant_id_event_type_status_idx" ON "achievement_rules"("tenant_id", "event_type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "achievement_rules_id_tenant_id_key" ON "achievement_rules"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "achievement_rules_tenant_id_code_key" ON "achievement_rules"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "customer_badges_tenant_id_customer_id_earned_at_idx" ON "customer_badges"("tenant_id", "customer_id", "earned_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "customer_badges_id_tenant_id_key" ON "customer_badges"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_badges_tenant_id_customer_id_badge_id_key" ON "customer_badges"("tenant_id", "customer_id", "badge_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_badges_tenant_id_idempotency_key_key" ON "customer_badges"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "leaderboard_configs_tenant_id_scope_scope_id_status_idx" ON "leaderboard_configs"("tenant_id", "scope", "scope_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_configs_id_tenant_id_key" ON "leaderboard_configs"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_configs_tenant_id_code_key" ON "leaderboard_configs"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "leaderboard_snapshots_tenant_id_config_id_generated_at_idx" ON "leaderboard_snapshots"("tenant_id", "config_id", "generated_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_snapshots_id_tenant_id_key" ON "leaderboard_snapshots"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_snapshots_tenant_id_idempotency_key_key" ON "leaderboard_snapshots"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_snapshots_tenant_id_config_id_period_start_peri_key" ON "leaderboard_snapshots"("tenant_id", "config_id", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "leaderboard_entries_tenant_id_snapshot_id_score_tie_breaker_idx" ON "leaderboard_entries"("tenant_id", "snapshot_id", "score" DESC, "tie_breaker");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_entries_id_tenant_id_key" ON "leaderboard_entries"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_entries_tenant_id_snapshot_id_customer_id_key" ON "leaderboard_entries"("tenant_id", "snapshot_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_entries_tenant_id_snapshot_id_rank_key" ON "leaderboard_entries"("tenant_id", "snapshot_id", "rank");

-- CreateIndex
CREATE INDEX "gamification_event_receipts_tenant_id_status_created_at_idx" ON "gamification_event_receipts"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "gamification_event_receipts_id_tenant_id_key" ON "gamification_event_receipts"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "gamification_event_receipts_tenant_id_event_id_key" ON "gamification_event_receipts"("tenant_id", "event_id");

-- AddForeignKey
ALTER TABLE "gamification_configs" ADD CONSTRAINT "gamification_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_rules" ADD CONSTRAINT "xp_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_rules" ADD CONSTRAINT "xp_rules_organization_id_tenant_id_fkey" FOREIGN KEY ("organization_id", "tenant_id") REFERENCES "organizations"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "level_definitions" ADD CONSTRAINT "level_definitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_gamification_profiles" ADD CONSTRAINT "customer_gamification_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_gamification_profiles" ADD CONSTRAINT "customer_gamification_profiles_organization_id_tenant_id_fkey" FOREIGN KEY ("organization_id", "tenant_id") REFERENCES "organizations"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_gamification_profiles" ADD CONSTRAINT "customer_gamification_profiles_customer_id_tenant_id_fkey" FOREIGN KEY ("customer_id", "tenant_id") REFERENCES "customers"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_gamification_profiles" ADD CONSTRAINT "customer_gamification_profiles_current_level_id_tenant_id_fkey" FOREIGN KEY ("current_level_id", "tenant_id") REFERENCES "level_definitions"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_ledger_entries" ADD CONSTRAINT "xp_ledger_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_ledger_entries" ADD CONSTRAINT "xp_ledger_entries_organization_id_tenant_id_fkey" FOREIGN KEY ("organization_id", "tenant_id") REFERENCES "organizations"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_ledger_entries" ADD CONSTRAINT "xp_ledger_entries_customer_id_organization_id_tenant_id_fkey" FOREIGN KEY ("customer_id", "organization_id", "tenant_id") REFERENCES "customers"("id", "organization_id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_ledger_entries" ADD CONSTRAINT "xp_ledger_entries_rule_id_tenant_id_fkey" FOREIGN KEY ("rule_id", "tenant_id") REFERENCES "xp_rules"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_ledger_entries" ADD CONSTRAINT "xp_ledger_entries_source_entry_id_tenant_id_fkey" FOREIGN KEY ("source_entry_id", "tenant_id") REFERENCES "xp_ledger_entries"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_ledger_entries" ADD CONSTRAINT "xp_ledger_entries_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_level_history" ADD CONSTRAINT "customer_level_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_level_history" ADD CONSTRAINT "customer_level_history_customer_id_tenant_id_fkey" FOREIGN KEY ("customer_id", "tenant_id") REFERENCES "customers"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_organization_id_tenant_id_fkey" FOREIGN KEY ("organization_id", "tenant_id") REFERENCES "organizations"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_applicability" ADD CONSTRAINT "challenge_applicability_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_applicability" ADD CONSTRAINT "challenge_applicability_challenge_id_tenant_id_fkey" FOREIGN KEY ("challenge_id", "tenant_id") REFERENCES "challenges"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_enrollments" ADD CONSTRAINT "challenge_enrollments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_enrollments" ADD CONSTRAINT "challenge_enrollments_challenge_id_tenant_id_fkey" FOREIGN KEY ("challenge_id", "tenant_id") REFERENCES "challenges"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_enrollments" ADD CONSTRAINT "challenge_enrollments_customer_id_tenant_id_fkey" FOREIGN KEY ("customer_id", "tenant_id") REFERENCES "customers"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_progress_events" ADD CONSTRAINT "challenge_progress_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_progress_events" ADD CONSTRAINT "challenge_progress_events_challenge_id_tenant_id_fkey" FOREIGN KEY ("challenge_id", "tenant_id") REFERENCES "challenges"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_progress_events" ADD CONSTRAINT "challenge_progress_events_enrollment_id_tenant_id_fkey" FOREIGN KEY ("enrollment_id", "tenant_id") REFERENCES "challenge_enrollments"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_progress_events" ADD CONSTRAINT "challenge_progress_events_customer_id_tenant_id_fkey" FOREIGN KEY ("customer_id", "tenant_id") REFERENCES "customers"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_rewards" ADD CONSTRAINT "challenge_rewards_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_rewards" ADD CONSTRAINT "challenge_rewards_challenge_id_tenant_id_fkey" FOREIGN KEY ("challenge_id", "tenant_id") REFERENCES "challenges"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_rewards" ADD CONSTRAINT "challenge_rewards_badge_id_tenant_id_fkey" FOREIGN KEY ("badge_id", "tenant_id") REFERENCES "badges"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_rewards" ADD CONSTRAINT "challenge_rewards_loyalty_program_id_tenant_id_fkey" FOREIGN KEY ("loyalty_program_id", "tenant_id") REFERENCES "loyalty_programs"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_reward_grants" ADD CONSTRAINT "challenge_reward_grants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_reward_grants" ADD CONSTRAINT "challenge_reward_grants_challenge_id_tenant_id_fkey" FOREIGN KEY ("challenge_id", "tenant_id") REFERENCES "challenges"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_reward_grants" ADD CONSTRAINT "challenge_reward_grants_challenge_reward_id_tenant_id_fkey" FOREIGN KEY ("challenge_reward_id", "tenant_id") REFERENCES "challenge_rewards"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_reward_grants" ADD CONSTRAINT "challenge_reward_grants_enrollment_id_tenant_id_fkey" FOREIGN KEY ("enrollment_id", "tenant_id") REFERENCES "challenge_enrollments"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_reward_grants" ADD CONSTRAINT "challenge_reward_grants_customer_id_tenant_id_fkey" FOREIGN KEY ("customer_id", "tenant_id") REFERENCES "customers"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habits" ADD CONSTRAINT "habits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habits" ADD CONSTRAINT "habits_organization_id_tenant_id_fkey" FOREIGN KEY ("organization_id", "tenant_id") REFERENCES "organizations"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_habits" ADD CONSTRAINT "customer_habits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_habits" ADD CONSTRAINT "customer_habits_habit_id_tenant_id_fkey" FOREIGN KEY ("habit_id", "tenant_id") REFERENCES "habits"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_habits" ADD CONSTRAINT "customer_habits_customer_id_tenant_id_fkey" FOREIGN KEY ("customer_id", "tenant_id") REFERENCES "customers"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_completions" ADD CONSTRAINT "habit_completions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_completions" ADD CONSTRAINT "habit_completions_habit_id_tenant_id_fkey" FOREIGN KEY ("habit_id", "tenant_id") REFERENCES "habits"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_completions" ADD CONSTRAINT "habit_completions_customer_habit_id_tenant_id_fkey" FOREIGN KEY ("customer_habit_id", "tenant_id") REFERENCES "customer_habits"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_completions" ADD CONSTRAINT "habit_completions_customer_id_tenant_id_fkey" FOREIGN KEY ("customer_id", "tenant_id") REFERENCES "customers"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_milestones" ADD CONSTRAINT "habit_milestones_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_milestones" ADD CONSTRAINT "habit_milestones_habit_id_tenant_id_fkey" FOREIGN KEY ("habit_id", "tenant_id") REFERENCES "habits"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_milestones" ADD CONSTRAINT "habit_milestones_badge_id_tenant_id_fkey" FOREIGN KEY ("badge_id", "tenant_id") REFERENCES "badges"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_milestones" ADD CONSTRAINT "habit_milestones_loyalty_program_id_tenant_id_fkey" FOREIGN KEY ("loyalty_program_id", "tenant_id") REFERENCES "loyalty_programs"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streak_rules" ADD CONSTRAINT "streak_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streak_rules" ADD CONSTRAINT "streak_rules_organization_id_tenant_id_fkey" FOREIGN KEY ("organization_id", "tenant_id") REFERENCES "organizations"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_streaks" ADD CONSTRAINT "customer_streaks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_streaks" ADD CONSTRAINT "customer_streaks_streak_rule_id_tenant_id_fkey" FOREIGN KEY ("streak_rule_id", "tenant_id") REFERENCES "streak_rules"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_streaks" ADD CONSTRAINT "customer_streaks_customer_id_tenant_id_fkey" FOREIGN KEY ("customer_id", "tenant_id") REFERENCES "customers"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streak_history" ADD CONSTRAINT "streak_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streak_history" ADD CONSTRAINT "streak_history_customer_streak_id_tenant_id_fkey" FOREIGN KEY ("customer_streak_id", "tenant_id") REFERENCES "customer_streaks"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streak_history" ADD CONSTRAINT "streak_history_streak_rule_id_tenant_id_fkey" FOREIGN KEY ("streak_rule_id", "tenant_id") REFERENCES "streak_rules"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streak_history" ADD CONSTRAINT "streak_history_customer_id_tenant_id_fkey" FOREIGN KEY ("customer_id", "tenant_id") REFERENCES "customers"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badge_categories" ADD CONSTRAINT "badge_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badge_categories" ADD CONSTRAINT "badge_categories_organization_id_tenant_id_fkey" FOREIGN KEY ("organization_id", "tenant_id") REFERENCES "organizations"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badges" ADD CONSTRAINT "badges_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badges" ADD CONSTRAINT "badges_organization_id_tenant_id_fkey" FOREIGN KEY ("organization_id", "tenant_id") REFERENCES "organizations"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badges" ADD CONSTRAINT "badges_category_id_organization_id_tenant_id_fkey" FOREIGN KEY ("category_id", "organization_id", "tenant_id") REFERENCES "badge_categories"("id", "organization_id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_rules" ADD CONSTRAINT "achievement_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_rules" ADD CONSTRAINT "achievement_rules_badge_id_tenant_id_fkey" FOREIGN KEY ("badge_id", "tenant_id") REFERENCES "badges"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_badges" ADD CONSTRAINT "customer_badges_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_badges" ADD CONSTRAINT "customer_badges_customer_id_tenant_id_fkey" FOREIGN KEY ("customer_id", "tenant_id") REFERENCES "customers"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_badges" ADD CONSTRAINT "customer_badges_badge_id_tenant_id_fkey" FOREIGN KEY ("badge_id", "tenant_id") REFERENCES "badges"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_badges" ADD CONSTRAINT "customer_badges_revoked_by_user_id_fkey" FOREIGN KEY ("revoked_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_configs" ADD CONSTRAINT "leaderboard_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_snapshots" ADD CONSTRAINT "leaderboard_snapshots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_snapshots" ADD CONSTRAINT "leaderboard_snapshots_config_id_tenant_id_fkey" FOREIGN KEY ("config_id", "tenant_id") REFERENCES "leaderboard_configs"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_snapshot_id_tenant_id_fkey" FOREIGN KEY ("snapshot_id", "tenant_id") REFERENCES "leaderboard_snapshots"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_customer_id_tenant_id_fkey" FOREIGN KEY ("customer_id", "tenant_id") REFERENCES "customers"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gamification_event_receipts" ADD CONSTRAINT "gamification_event_receipts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Achievement progress is mutable current state; awards remain immutable.
CREATE TABLE "achievement_progress" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "rule_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "completed_at" TIMESTAMPTZ(3),
  "last_event_id" TEXT,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "achievement_progress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "achievement_progress_id_tenant_id_key"
  ON "achievement_progress"("id", "tenant_id");
CREATE UNIQUE INDEX "achievement_progress_tenant_id_rule_id_customer_id_key"
  ON "achievement_progress"("tenant_id", "rule_id", "customer_id");
CREATE INDEX "achievement_progress_tenant_id_customer_id_updated_at_idx"
  ON "achievement_progress"("tenant_id", "customer_id", "updated_at" DESC);

ALTER TABLE "achievement_progress"
  ADD CONSTRAINT "achievement_progress_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "achievement_progress"
  ADD CONSTRAINT "achievement_progress_rule_id_tenant_id_fkey"
  FOREIGN KEY ("rule_id", "tenant_id") REFERENCES "achievement_rules"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "achievement_progress"
  ADD CONSTRAINT "achievement_progress_customer_id_tenant_id_fkey"
  FOREIGN KEY ("customer_id", "tenant_id") REFERENCES "customers"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Phase 6 tenant isolation is enforced in PostgreSQL, including for table owners.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'gamification_configs',
    'xp_rules',
    'level_definitions',
    'customer_gamification_profiles',
    'xp_ledger_entries',
    'customer_level_history',
    'challenges',
    'challenge_applicability',
    'challenge_enrollments',
    'challenge_progress_events',
    'challenge_rewards',
    'challenge_reward_grants',
    'habits',
    'customer_habits',
    'habit_completions',
    'habit_milestones',
    'streak_rules',
    'customer_streaks',
    'streak_history',
    'badge_categories',
    'badges',
    'achievement_rules',
    'achievement_progress',
    'customer_badges',
    'leaderboard_configs',
    'leaderboard_snapshots',
    'leaderboard_entries',
    'gamification_event_receipts'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (
        tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid
      ) WITH CHECK (
        tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid
      )',
      table_name || '_tenant_isolation',
      table_name
    );
  END LOOP;
END
$$;

-- Business history and event ledgers are append-only. Corrections must be
-- represented by compensating records, never by rewriting history.
CREATE OR REPLACE FUNCTION phase_6_prevent_immutable_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; use a compensating record', TG_TABLE_NAME
    USING ERRCODE = '55000';
END
$$;

CREATE TRIGGER xp_ledger_entries_append_only
  BEFORE UPDATE OR DELETE ON "xp_ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION phase_6_prevent_immutable_mutation();

CREATE TRIGGER customer_level_history_append_only
  BEFORE UPDATE OR DELETE ON "customer_level_history"
  FOR EACH ROW EXECUTE FUNCTION phase_6_prevent_immutable_mutation();

CREATE TRIGGER challenge_progress_events_append_only
  BEFORE UPDATE OR DELETE ON "challenge_progress_events"
  FOR EACH ROW EXECUTE FUNCTION phase_6_prevent_immutable_mutation();

CREATE TRIGGER challenge_reward_grants_append_only
  BEFORE UPDATE OR DELETE ON "challenge_reward_grants"
  FOR EACH ROW EXECUTE FUNCTION phase_6_prevent_immutable_mutation();

CREATE TRIGGER habit_completions_append_only
  BEFORE UPDATE OR DELETE ON "habit_completions"
  FOR EACH ROW EXECUTE FUNCTION phase_6_prevent_immutable_mutation();

CREATE TRIGGER streak_history_append_only
  BEFORE UPDATE OR DELETE ON "streak_history"
  FOR EACH ROW EXECUTE FUNCTION phase_6_prevent_immutable_mutation();

CREATE TRIGGER leaderboard_snapshots_append_only
  BEFORE UPDATE OR DELETE ON "leaderboard_snapshots"
  FOR EACH ROW EXECUTE FUNCTION phase_6_prevent_immutable_mutation();

CREATE TRIGGER leaderboard_entries_append_only
  BEFORE UPDATE OR DELETE ON "leaderboard_entries"
  FOR EACH ROW EXECUTE FUNCTION phase_6_prevent_immutable_mutation();
