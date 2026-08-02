-- CreateEnum
CREATE TYPE "customer_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "loyalty_program_status" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "points_entry_type" AS ENUM ('EARN', 'REDEEM', 'EXPIRE', 'ADJUST', 'REVERSE');

-- CreateEnum
CREATE TYPE "reward_status" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "reward_redemption_status" AS ENUM ('PENDING', 'COMPLETED', 'CANCELED', 'REVERSED');

-- CreateEnum
CREATE TYPE "qr_purpose" AS ENUM ('IDENTITY', 'EARN', 'REDEEM');

-- CreateEnum
CREATE TYPE "qr_token_status" AS ENUM ('ACTIVE', 'CONSUMED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "qr_transaction_status" AS ENUM ('SUCCEEDED', 'REJECTED');

-- AlterTable
ALTER TABLE "staff" ALTER COLUMN "status" SET DEFAULT 'INVITED';

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "external_reference" TEXT,
    "email" TEXT,
    "normalized_email" TEXT,
    "phone" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "display_name" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "birth_date" DATE,
    "status" "customer_status" NOT NULL DEFAULT 'ACTIVE',
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "communication_preferences" JSONB NOT NULL DEFAULT '{}',
    "consents" JSONB NOT NULL DEFAULT '{}',
    "activated_at" TIMESTAMPTZ(3),
    "suspended_at" TIMESTAMPTZ(3),
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_activities" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "reference_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_programs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "points_label" TEXT NOT NULL DEFAULT 'points',
    "status" "loyalty_program_status" NOT NULL DEFAULT 'DRAFT',
    "expiration_days" INTEGER,
    "minimum_earn_points" INTEGER NOT NULL DEFAULT 1,
    "maximum_earn_points" INTEGER,
    "minimum_redeem_points" INTEGER NOT NULL DEFAULT 1,
    "maximum_redeem_points" INTEGER,
    "applies_to_all_merchants" BOOLEAN NOT NULL DEFAULT true,
    "applies_to_all_branches" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "activated_at" TIMESTAMPTZ(3),
    "suspended_at" TIMESTAMPTZ(3),
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "loyalty_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "earning_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "multiplier" DECIMAL(12,4) NOT NULL DEFAULT 1,
    "minimum_amount" DECIMAL(18,3),
    "maximum_points" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMPTZ(3),
    "ends_at" TIMESTAMPTZ(3),
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "earning_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redemption_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minimum_points" INTEGER NOT NULL DEFAULT 1,
    "maximum_points" INTEGER,
    "increment_points" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMPTZ(3),
    "ends_at" TIMESTAMPTZ(3),
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "redemption_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_merchants" (
    "tenant_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,

    CONSTRAINT "program_merchants_pkey" PRIMARY KEY ("tenant_id","program_id","merchant_id")
);

-- CreateTable
CREATE TABLE "program_branches" (
    "tenant_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,

    CONSTRAINT "program_branches_pkey" PRIMARY KEY ("tenant_id","program_id","branch_id")
);

-- CreateTable
CREATE TABLE "points_ledger_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "merchant_id" UUID,
    "branch_id" UUID,
    "type" "points_entry_type" NOT NULL,
    "points" INTEGER NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "source_entry_id" UUID,
    "expires_at" TIMESTAMPTZ(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_categories" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reward_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rewards" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "category_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "reward_status" NOT NULL DEFAULT 'DRAFT',
    "points_cost" INTEGER NOT NULL,
    "stock_quantity" INTEGER,
    "unlimited_stock" BOOLEAN NOT NULL DEFAULT false,
    "eligibility_rules" JSONB NOT NULL DEFAULT '{}',
    "applies_to_all_merchants" BOOLEAN NOT NULL DEFAULT true,
    "applies_to_all_branches" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMPTZ(3),
    "ends_at" TIMESTAMPTZ(3),
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_merchants" (
    "tenant_id" UUID NOT NULL,
    "reward_id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,

    CONSTRAINT "reward_merchants_pkey" PRIMARY KEY ("tenant_id","reward_id","merchant_id")
);

-- CreateTable
CREATE TABLE "reward_branches" (
    "tenant_id" UUID NOT NULL,
    "reward_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,

    CONSTRAINT "reward_branches_pkey" PRIMARY KEY ("tenant_id","reward_id","branch_id")
);

-- CreateTable
CREATE TABLE "reward_redemptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "reward_id" UUID NOT NULL,
    "merchant_id" UUID,
    "branch_id" UUID,
    "points_entry_id" UUID NOT NULL,
    "reversal_entry_id" UUID,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "points_spent" INTEGER NOT NULL,
    "status" "reward_redemption_status" NOT NULL DEFAULT 'PENDING',
    "idempotency_key" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "redeemed_at" TIMESTAMPTZ(3),
    "canceled_at" TIMESTAMPTZ(3),
    "reversed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reward_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_qr_tokens" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "purpose" "qr_purpose" NOT NULL,
    "nonce" TEXT NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "status" "qr_token_status" NOT NULL DEFAULT 'ACTIVE',
    "context" JSONB NOT NULL DEFAULT '{}',
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_qr_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_transactions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "qr_token_id" UUID,
    "customer_id" UUID,
    "merchant_id" UUID,
    "branch_id" UUID,
    "purpose" "qr_purpose" NOT NULL,
    "status" "qr_transaction_status" NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "result_reference" TEXT,
    "failure_reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qr_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customers_organization_id_tenant_id_idx" ON "customers"("organization_id", "tenant_id");

-- CreateIndex
CREATE INDEX "customers_tenant_id_status_idx" ON "customers"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "customers_tenant_id_phone_idx" ON "customers"("tenant_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "customers_id_tenant_id_key" ON "customers"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_id_organization_id_tenant_id_key" ON "customers"("id", "organization_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tenant_id_user_id_key" ON "customers"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tenant_id_normalized_email_key" ON "customers"("tenant_id", "normalized_email");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tenant_id_external_reference_key" ON "customers"("tenant_id", "external_reference");

-- CreateIndex
CREATE INDEX "customer_activities_tenant_id_customer_id_occurred_at_idx" ON "customer_activities"("tenant_id", "customer_id", "occurred_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "customer_activities_id_tenant_id_key" ON "customer_activities"("id", "tenant_id");

-- CreateIndex
CREATE INDEX "loyalty_programs_organization_id_tenant_id_idx" ON "loyalty_programs"("organization_id", "tenant_id");

-- CreateIndex
CREATE INDEX "loyalty_programs_tenant_id_status_idx" ON "loyalty_programs"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_programs_id_tenant_id_key" ON "loyalty_programs"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_programs_id_organization_id_tenant_id_key" ON "loyalty_programs"("id", "organization_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_programs_tenant_id_code_key" ON "loyalty_programs"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "earning_rules_tenant_id_program_id_active_idx" ON "earning_rules"("tenant_id", "program_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "earning_rules_id_tenant_id_key" ON "earning_rules"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "earning_rules_tenant_id_program_id_code_key" ON "earning_rules"("tenant_id", "program_id", "code");

-- CreateIndex
CREATE INDEX "redemption_rules_tenant_id_program_id_active_idx" ON "redemption_rules"("tenant_id", "program_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "redemption_rules_id_tenant_id_key" ON "redemption_rules"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "redemption_rules_tenant_id_program_id_code_key" ON "redemption_rules"("tenant_id", "program_id", "code");

-- CreateIndex
CREATE INDEX "program_merchants_tenant_id_merchant_id_idx" ON "program_merchants"("tenant_id", "merchant_id");

-- CreateIndex
CREATE INDEX "program_branches_tenant_id_branch_id_idx" ON "program_branches"("tenant_id", "branch_id");

-- CreateIndex
CREATE INDEX "points_ledger_entries_tenant_id_customer_id_program_id_crea_idx" ON "points_ledger_entries"("tenant_id", "customer_id", "program_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "points_ledger_entries_tenant_id_reference_type_reference_id_idx" ON "points_ledger_entries"("tenant_id", "reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "points_ledger_entries_tenant_id_expires_at_idx" ON "points_ledger_entries"("tenant_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "points_ledger_entries_id_tenant_id_key" ON "points_ledger_entries"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "points_ledger_entries_tenant_id_idempotency_key_key" ON "points_ledger_entries"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "points_ledger_entries_source_entry_id_tenant_id_key" ON "points_ledger_entries"("source_entry_id", "tenant_id");

-- CreateIndex
CREATE INDEX "reward_categories_organization_id_tenant_id_idx" ON "reward_categories"("organization_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_categories_id_tenant_id_key" ON "reward_categories"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_categories_id_organization_id_tenant_id_key" ON "reward_categories"("id", "organization_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_categories_tenant_id_code_key" ON "reward_categories"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "rewards_tenant_id_program_id_status_idx" ON "rewards"("tenant_id", "program_id", "status");

-- CreateIndex
CREATE INDEX "rewards_tenant_id_category_id_idx" ON "rewards"("tenant_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "rewards_id_tenant_id_key" ON "rewards"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "rewards_id_organization_id_tenant_id_key" ON "rewards"("id", "organization_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "rewards_tenant_id_code_key" ON "rewards"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "reward_merchants_tenant_id_merchant_id_idx" ON "reward_merchants"("tenant_id", "merchant_id");

-- CreateIndex
CREATE INDEX "reward_branches_tenant_id_branch_id_idx" ON "reward_branches"("tenant_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_redemptions_points_entry_id_key" ON "reward_redemptions"("points_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_redemptions_reversal_entry_id_key" ON "reward_redemptions"("reversal_entry_id");

-- CreateIndex
CREATE INDEX "reward_redemptions_tenant_id_customer_id_created_at_idx" ON "reward_redemptions"("tenant_id", "customer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "reward_redemptions_tenant_id_reward_id_status_idx" ON "reward_redemptions"("tenant_id", "reward_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "reward_redemptions_id_tenant_id_key" ON "reward_redemptions"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_redemptions_tenant_id_idempotency_key_key" ON "reward_redemptions"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "reward_redemptions_points_entry_id_tenant_id_key" ON "reward_redemptions"("points_entry_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_redemptions_reversal_entry_id_tenant_id_key" ON "reward_redemptions"("reversal_entry_id", "tenant_id");

-- CreateIndex
CREATE INDEX "customer_qr_tokens_tenant_id_customer_id_status_idx" ON "customer_qr_tokens"("tenant_id", "customer_id", "status");

-- CreateIndex
CREATE INDEX "customer_qr_tokens_tenant_id_expires_at_idx" ON "customer_qr_tokens"("tenant_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "customer_qr_tokens_id_tenant_id_key" ON "customer_qr_tokens"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_qr_tokens_tenant_id_nonce_key" ON "customer_qr_tokens"("tenant_id", "nonce");

-- CreateIndex
CREATE UNIQUE INDEX "customer_qr_tokens_tenant_id_token_hash_key" ON "customer_qr_tokens"("tenant_id", "token_hash");

-- CreateIndex
CREATE INDEX "qr_transactions_tenant_id_customer_id_occurred_at_idx" ON "qr_transactions"("tenant_id", "customer_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "qr_transactions_tenant_id_status_occurred_at_idx" ON "qr_transactions"("tenant_id", "status", "occurred_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "qr_transactions_id_tenant_id_key" ON "qr_transactions"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "qr_transactions_tenant_id_idempotency_key_key" ON "qr_transactions"("tenant_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_tenant_id_fkey" FOREIGN KEY ("organization_id", "tenant_id") REFERENCES "organizations"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_activities" ADD CONSTRAINT "customer_activities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_activities" ADD CONSTRAINT "customer_activities_customer_id_tenant_id_fkey" FOREIGN KEY ("customer_id", "tenant_id") REFERENCES "customers"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_programs" ADD CONSTRAINT "loyalty_programs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_programs" ADD CONSTRAINT "loyalty_programs_organization_id_tenant_id_fkey" FOREIGN KEY ("organization_id", "tenant_id") REFERENCES "organizations"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "earning_rules" ADD CONSTRAINT "earning_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "earning_rules" ADD CONSTRAINT "earning_rules_program_id_tenant_id_fkey" FOREIGN KEY ("program_id", "tenant_id") REFERENCES "loyalty_programs"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemption_rules" ADD CONSTRAINT "redemption_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemption_rules" ADD CONSTRAINT "redemption_rules_program_id_tenant_id_fkey" FOREIGN KEY ("program_id", "tenant_id") REFERENCES "loyalty_programs"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_merchants" ADD CONSTRAINT "program_merchants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_merchants" ADD CONSTRAINT "program_merchants_program_id_organization_id_tenant_id_fkey" FOREIGN KEY ("program_id", "organization_id", "tenant_id") REFERENCES "loyalty_programs"("id", "organization_id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_merchants" ADD CONSTRAINT "program_merchants_merchant_id_organization_id_tenant_id_fkey" FOREIGN KEY ("merchant_id", "organization_id", "tenant_id") REFERENCES "merchants"("id", "organization_id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_branches" ADD CONSTRAINT "program_branches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_branches" ADD CONSTRAINT "program_branches_program_id_organization_id_tenant_id_fkey" FOREIGN KEY ("program_id", "organization_id", "tenant_id") REFERENCES "loyalty_programs"("id", "organization_id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_branches" ADD CONSTRAINT "program_branches_branch_id_merchant_id_tenant_id_fkey" FOREIGN KEY ("branch_id", "merchant_id", "tenant_id") REFERENCES "branches"("id", "merchant_id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_ledger_entries" ADD CONSTRAINT "points_ledger_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_ledger_entries" ADD CONSTRAINT "points_ledger_entries_organization_id_tenant_id_fkey" FOREIGN KEY ("organization_id", "tenant_id") REFERENCES "organizations"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_ledger_entries" ADD CONSTRAINT "points_ledger_entries_program_id_organization_id_tenant_id_fkey" FOREIGN KEY ("program_id", "organization_id", "tenant_id") REFERENCES "loyalty_programs"("id", "organization_id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_ledger_entries" ADD CONSTRAINT "points_ledger_entries_customer_id_organization_id_tenant_i_fkey" FOREIGN KEY ("customer_id", "organization_id", "tenant_id") REFERENCES "customers"("id", "organization_id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_ledger_entries" ADD CONSTRAINT "points_ledger_entries_merchant_id_organization_id_tenant_i_fkey" FOREIGN KEY ("merchant_id", "organization_id", "tenant_id") REFERENCES "merchants"("id", "organization_id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_ledger_entries" ADD CONSTRAINT "points_ledger_entries_branch_id_merchant_id_tenant_id_fkey" FOREIGN KEY ("branch_id", "merchant_id", "tenant_id") REFERENCES "branches"("id", "merchant_id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_ledger_entries" ADD CONSTRAINT "points_ledger_entries_source_entry_id_tenant_id_fkey" FOREIGN KEY ("source_entry_id", "tenant_id") REFERENCES "points_ledger_entries"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_ledger_entries" ADD CONSTRAINT "points_ledger_entries_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_categories" ADD CONSTRAINT "reward_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_categories" ADD CONSTRAINT "reward_categories_organization_id_tenant_id_fkey" FOREIGN KEY ("organization_id", "tenant_id") REFERENCES "organizations"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_organization_id_tenant_id_fkey" FOREIGN KEY ("organization_id", "tenant_id") REFERENCES "organizations"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_program_id_organization_id_tenant_id_fkey" FOREIGN KEY ("program_id", "organization_id", "tenant_id") REFERENCES "loyalty_programs"("id", "organization_id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_category_id_organization_id_tenant_id_fkey" FOREIGN KEY ("category_id", "organization_id", "tenant_id") REFERENCES "reward_categories"("id", "organization_id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_merchants" ADD CONSTRAINT "reward_merchants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_merchants" ADD CONSTRAINT "reward_merchants_reward_id_organization_id_tenant_id_fkey" FOREIGN KEY ("reward_id", "organization_id", "tenant_id") REFERENCES "rewards"("id", "organization_id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_merchants" ADD CONSTRAINT "reward_merchants_merchant_id_organization_id_tenant_id_fkey" FOREIGN KEY ("merchant_id", "organization_id", "tenant_id") REFERENCES "merchants"("id", "organization_id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_branches" ADD CONSTRAINT "reward_branches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_branches" ADD CONSTRAINT "reward_branches_reward_id_organization_id_tenant_id_fkey" FOREIGN KEY ("reward_id", "organization_id", "tenant_id") REFERENCES "rewards"("id", "organization_id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_branches" ADD CONSTRAINT "reward_branches_branch_id_merchant_id_tenant_id_fkey" FOREIGN KEY ("branch_id", "merchant_id", "tenant_id") REFERENCES "branches"("id", "merchant_id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_organization_id_tenant_id_fkey" FOREIGN KEY ("organization_id", "tenant_id") REFERENCES "organizations"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_program_id_organization_id_tenant_id_fkey" FOREIGN KEY ("program_id", "organization_id", "tenant_id") REFERENCES "loyalty_programs"("id", "organization_id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_customer_id_organization_id_tenant_id_fkey" FOREIGN KEY ("customer_id", "organization_id", "tenant_id") REFERENCES "customers"("id", "organization_id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_reward_id_organization_id_tenant_id_fkey" FOREIGN KEY ("reward_id", "organization_id", "tenant_id") REFERENCES "rewards"("id", "organization_id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_merchant_id_organization_id_tenant_id_fkey" FOREIGN KEY ("merchant_id", "organization_id", "tenant_id") REFERENCES "merchants"("id", "organization_id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_branch_id_merchant_id_tenant_id_fkey" FOREIGN KEY ("branch_id", "merchant_id", "tenant_id") REFERENCES "branches"("id", "merchant_id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_points_entry_id_tenant_id_fkey" FOREIGN KEY ("points_entry_id", "tenant_id") REFERENCES "points_ledger_entries"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_reversal_entry_id_tenant_id_fkey" FOREIGN KEY ("reversal_entry_id", "tenant_id") REFERENCES "points_ledger_entries"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_qr_tokens" ADD CONSTRAINT "customer_qr_tokens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_qr_tokens" ADD CONSTRAINT "customer_qr_tokens_customer_id_tenant_id_fkey" FOREIGN KEY ("customer_id", "tenant_id") REFERENCES "customers"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_transactions" ADD CONSTRAINT "qr_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_transactions" ADD CONSTRAINT "qr_transactions_qr_token_id_tenant_id_fkey" FOREIGN KEY ("qr_token_id", "tenant_id") REFERENCES "customer_qr_tokens"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_transactions" ADD CONSTRAINT "qr_transactions_customer_id_tenant_id_fkey" FOREIGN KEY ("customer_id", "tenant_id") REFERENCES "customers"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_transactions" ADD CONSTRAINT "qr_transactions_merchant_id_tenant_id_fkey" FOREIGN KEY ("merchant_id", "tenant_id") REFERENCES "merchants"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_transactions" ADD CONSTRAINT "qr_transactions_branch_id_tenant_id_fkey" FOREIGN KEY ("branch_id", "tenant_id") REFERENCES "branches"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tenant isolation for every Phase 5 tenant-owned table.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'customers',
    'customer_activities',
    'loyalty_programs',
    'earning_rules',
    'redemption_rules',
    'program_merchants',
    'program_branches',
    'points_ledger_entries',
    'reward_categories',
    'rewards',
    'reward_merchants',
    'reward_branches',
    'reward_redemptions',
    'customer_qr_tokens',
    'qr_transactions'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (
        tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid
      ) WITH CHECK (
        tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid
      )',
      table_name
    );
  END LOOP;
END
$$;

-- Ledgers, timelines and QR history are append-only evidence.
CREATE FUNCTION prevent_phase_5_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER points_ledger_entries_append_only
BEFORE UPDATE OR DELETE ON "points_ledger_entries"
FOR EACH ROW EXECUTE FUNCTION prevent_phase_5_evidence_mutation();

CREATE TRIGGER customer_activities_append_only
BEFORE UPDATE OR DELETE ON "customer_activities"
FOR EACH ROW EXECUTE FUNCTION prevent_phase_5_evidence_mutation();

CREATE TRIGGER qr_transactions_append_only
BEFORE UPDATE OR DELETE ON "qr_transactions"
FOR EACH ROW EXECUTE FUNCTION prevent_phase_5_evidence_mutation();
