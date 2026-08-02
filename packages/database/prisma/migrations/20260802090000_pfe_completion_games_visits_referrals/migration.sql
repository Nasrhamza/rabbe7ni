CREATE TYPE "game_type" AS ENUM ('SPIN_WHEEL', 'SCRATCH_CARD', 'MYSTERY_BOX');
CREATE TYPE "game_status" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE "game_prize_type" AS ENUM ('POINTS', 'REWARD', 'DISCOUNT', 'TRY_AGAIN');
CREATE TYPE "referral_status" AS ENUM ('PENDING', 'QUALIFIED', 'REWARDED', 'CANCELED');
CREATE TYPE "visit_status" AS ENUM ('VALIDATED', 'REVERSED');

CREATE TABLE "game_configurations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "program_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "type" "game_type" NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "game_status" NOT NULL DEFAULT 'DRAFT',
  "cooldown_minutes" INTEGER NOT NULL DEFAULT 1440,
  "daily_limit" INTEGER NOT NULL DEFAULT 1,
  "settings" JSONB NOT NULL DEFAULT '{}',
  "starts_at" TIMESTAMPTZ(3),
  "ends_at" TIMESTAMPTZ(3),
  "archived_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "game_configurations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "game_configurations_limits_check" CHECK ("cooldown_minutes" >= 0 AND "daily_limit" > 0)
);

CREATE TABLE "game_prizes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "game_id" UUID NOT NULL,
  "reward_id" UUID,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "type" "game_prize_type" NOT NULL,
  "points" INTEGER NOT NULL DEFAULT 0,
  "discount_percent" INTEGER,
  "probability_weight" INTEGER NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#2563eb',
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "stock_quantity" INTEGER,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "game_prizes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "game_prizes_values_check" CHECK (
    "points" >= 0 AND "probability_weight" > 0 AND
    ("discount_percent" IS NULL OR "discount_percent" BETWEEN 1 AND 100) AND
    ("stock_quantity" IS NULL OR "stock_quantity" >= 0)
  )
);

CREATE TABLE "game_plays" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "game_id" UUID NOT NULL,
  "prize_id" UUID NOT NULL,
  "program_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "points_awarded" INTEGER NOT NULL DEFAULT 0,
  "result_reference" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "played_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "game_plays_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "game_plays_points_check" CHECK ("points_awarded" >= 0)
);

CREATE TABLE "customer_visits" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "merchant_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "qr_transaction_id" UUID,
  "status" "visit_status" NOT NULL DEFAULT 'VALIDATED',
  "source" TEXT NOT NULL DEFAULT 'QR',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "visited_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reversed_at" TIMESTAMPTZ(3),
  CONSTRAINT "customer_visits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_referrals" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "referrer_customer_id" UUID NOT NULL,
  "referred_customer_id" UUID,
  "code" TEXT NOT NULL,
  "status" "referral_status" NOT NULL DEFAULT 'PENDING',
  "reward_points" INTEGER NOT NULL DEFAULT 0,
  "qualified_at" TIMESTAMPTZ(3),
  "rewarded_at" TIMESTAMPTZ(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "customer_referrals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_referrals_reward_check" CHECK ("reward_points" >= 0)
);

CREATE UNIQUE INDEX "game_configurations_id_tenant_id_key" ON "game_configurations"("id", "tenant_id");
CREATE UNIQUE INDEX "game_configurations_id_organization_id_tenant_id_key" ON "game_configurations"("id", "organization_id", "tenant_id");
CREATE UNIQUE INDEX "game_configurations_tenant_id_code_key" ON "game_configurations"("tenant_id", "code");
CREATE INDEX "game_configurations_tenant_id_organization_id_status_idx" ON "game_configurations"("tenant_id", "organization_id", "status");
CREATE INDEX "game_configurations_tenant_id_type_status_idx" ON "game_configurations"("tenant_id", "type", "status");

CREATE UNIQUE INDEX "game_prizes_id_tenant_id_key" ON "game_prizes"("id", "tenant_id");
CREATE UNIQUE INDEX "game_prizes_tenant_id_game_id_code_key" ON "game_prizes"("tenant_id", "game_id", "code");
CREATE INDEX "game_prizes_tenant_id_game_id_active_idx" ON "game_prizes"("tenant_id", "game_id", "active");
CREATE INDEX "game_prizes_tenant_id_reward_id_idx" ON "game_prizes"("tenant_id", "reward_id");

CREATE UNIQUE INDEX "game_plays_id_tenant_id_key" ON "game_plays"("id", "tenant_id");
CREATE UNIQUE INDEX "game_plays_tenant_id_idempotency_key_key" ON "game_plays"("tenant_id", "idempotency_key");
CREATE INDEX "game_plays_tenant_id_customer_id_played_at_idx" ON "game_plays"("tenant_id", "customer_id", "played_at" DESC);
CREATE INDEX "game_plays_tenant_id_game_id_played_at_idx" ON "game_plays"("tenant_id", "game_id", "played_at" DESC);

CREATE UNIQUE INDEX "customer_visits_id_tenant_id_key" ON "customer_visits"("id", "tenant_id");
CREATE UNIQUE INDEX "customer_visits_qr_transaction_id_key" ON "customer_visits"("qr_transaction_id");
CREATE UNIQUE INDEX "customer_visits_qr_transaction_id_tenant_id_key" ON "customer_visits"("qr_transaction_id", "tenant_id");
CREATE INDEX "customer_visits_tenant_id_customer_id_visited_at_idx" ON "customer_visits"("tenant_id", "customer_id", "visited_at" DESC);
CREATE INDEX "customer_visits_tenant_id_branch_id_visited_at_idx" ON "customer_visits"("tenant_id", "branch_id", "visited_at" DESC);

CREATE UNIQUE INDEX "customer_referrals_id_tenant_id_key" ON "customer_referrals"("id", "tenant_id");
CREATE UNIQUE INDEX "customer_referrals_tenant_id_code_key" ON "customer_referrals"("tenant_id", "code");
CREATE UNIQUE INDEX "customer_referrals_referred_customer_id_organization_id_tenant_id_key" ON "customer_referrals"("referred_customer_id", "organization_id", "tenant_id");
CREATE INDEX "customer_referrals_tenant_id_referrer_customer_id_created_at_idx" ON "customer_referrals"("tenant_id", "referrer_customer_id", "created_at" DESC);
CREATE INDEX "customer_referrals_tenant_id_status_idx" ON "customer_referrals"("tenant_id", "status");

ALTER TABLE "game_configurations" ADD CONSTRAINT "game_configurations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_configurations" ADD CONSTRAINT "game_configurations_organization_id_tenant_id_fkey" FOREIGN KEY ("organization_id", "tenant_id") REFERENCES "organizations"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_configurations" ADD CONSTRAINT "game_configurations_program_id_organization_id_tenant_id_fkey" FOREIGN KEY ("program_id", "organization_id", "tenant_id") REFERENCES "loyalty_programs"("id", "organization_id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_prizes" ADD CONSTRAINT "game_prizes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_prizes" ADD CONSTRAINT "game_prizes_game_id_tenant_id_fkey" FOREIGN KEY ("game_id", "tenant_id") REFERENCES "game_configurations"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_prizes" ADD CONSTRAINT "game_prizes_reward_id_tenant_id_fkey" FOREIGN KEY ("reward_id", "tenant_id") REFERENCES "rewards"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "game_plays" ADD CONSTRAINT "game_plays_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "game_plays" ADD CONSTRAINT "game_plays_game_id_tenant_id_fkey" FOREIGN KEY ("game_id", "tenant_id") REFERENCES "game_configurations"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "game_plays" ADD CONSTRAINT "game_plays_prize_id_tenant_id_fkey" FOREIGN KEY ("prize_id", "tenant_id") REFERENCES "game_prizes"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "game_plays" ADD CONSTRAINT "game_plays_program_id_tenant_id_fkey" FOREIGN KEY ("program_id", "tenant_id") REFERENCES "loyalty_programs"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "game_plays" ADD CONSTRAINT "game_plays_customer_id_tenant_id_fkey" FOREIGN KEY ("customer_id", "tenant_id") REFERENCES "customers"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_visits" ADD CONSTRAINT "customer_visits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_visits" ADD CONSTRAINT "customer_visits_organization_id_tenant_id_fkey" FOREIGN KEY ("organization_id", "tenant_id") REFERENCES "organizations"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_visits" ADD CONSTRAINT "customer_visits_customer_id_organization_id_tenant_id_fkey" FOREIGN KEY ("customer_id", "organization_id", "tenant_id") REFERENCES "customers"("id", "organization_id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_visits" ADD CONSTRAINT "customer_visits_merchant_id_organization_id_tenant_id_fkey" FOREIGN KEY ("merchant_id", "organization_id", "tenant_id") REFERENCES "merchants"("id", "organization_id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_visits" ADD CONSTRAINT "customer_visits_branch_id_merchant_id_tenant_id_fkey" FOREIGN KEY ("branch_id", "merchant_id", "tenant_id") REFERENCES "branches"("id", "merchant_id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_visits" ADD CONSTRAINT "customer_visits_qr_transaction_id_tenant_id_fkey" FOREIGN KEY ("qr_transaction_id", "tenant_id") REFERENCES "qr_transactions"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_referrals" ADD CONSTRAINT "customer_referrals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_referrals" ADD CONSTRAINT "customer_referrals_organization_id_tenant_id_fkey" FOREIGN KEY ("organization_id", "tenant_id") REFERENCES "organizations"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_referrals" ADD CONSTRAINT "customer_referrals_referrer_customer_id_organization_id_tenant_id_fkey" FOREIGN KEY ("referrer_customer_id", "organization_id", "tenant_id") REFERENCES "customers"("id", "organization_id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_referrals" ADD CONSTRAINT "customer_referrals_referred_customer_id_organization_id_tenant_id_fkey" FOREIGN KEY ("referred_customer_id", "organization_id", "tenant_id") REFERENCES "customers"("id", "organization_id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['game_configurations', 'game_prizes', 'game_plays', 'customer_visits', 'customer_referrals']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid)',
      table_name || '_tenant_isolation', table_name
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION rabbehni_prevent_game_play_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'game plays are immutable';
END;
$$;

CREATE TRIGGER game_plays_immutable
BEFORE UPDATE OR DELETE ON "game_plays"
FOR EACH ROW EXECUTE FUNCTION rabbehni_prevent_game_play_mutation();
