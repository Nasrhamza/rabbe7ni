-- CreateEnum
CREATE TYPE "billing_interval" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "subscription_change_type" AS ENUM ('TRIAL_STARTED', 'ACTIVATED', 'RENEWED', 'UPGRADED', 'DOWNGRADED', 'CANCELLATION_SCHEDULED', 'CANCELED', 'SUSPENDED', 'REACTIVATED');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');

-- CreateEnum
CREATE TYPE "billing_webhook_status" AS ENUM ('RECEIVED', 'PROCESSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "custom_domain_status" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'DISABLED');

-- DropIndex
DROP INDEX "plans_status_idx";

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "transaction_fee_basis_points" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trial_days" INTEGER NOT NULL DEFAULT 14;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "billing_interval" "billing_interval" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "current_period_starts_at" TIMESTAMPTZ(3),
ADD COLUMN     "ended_at" TIMESTAMPTZ(3),
ADD COLUMN     "next_billing_at" TIMESTAMPTZ(3),
ADD COLUMN     "suspended_at" TIMESTAMPTZ(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "plan_feature_entitlements" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "feature_key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "configuration" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plan_feature_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_quota_limits" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "metric_key" TEXT NOT NULL,
    "limit_value" INTEGER NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'MONTH',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plan_quota_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_changes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "type" "subscription_change_type" NOT NULL,
    "from_plan_id" UUID,
    "to_plan_id" UUID,
    "reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "effective_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_intents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "checkout_token_hash" CHAR(64) NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'PFE_SANDBOX',
    "failure_code" TEXT,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "confirmed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "status" "invoice_status" NOT NULL DEFAULT 'OPEN',
    "currency" CHAR(3) NOT NULL,
    "subtotal_minor" INTEGER NOT NULL,
    "fee_minor" INTEGER NOT NULL DEFAULT 0,
    "tax_minor" INTEGER NOT NULL DEFAULT 0,
    "total_minor" INTEGER NOT NULL,
    "line_items" JSONB NOT NULL DEFAULT '[]',
    "period_start" TIMESTAMPTZ(3) NOT NULL,
    "period_end" TIMESTAMPTZ(3) NOT NULL,
    "due_at" TIMESTAMPTZ(3) NOT NULL,
    "paid_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "payment_intent_id" UUID NOT NULL,
    "invoice_id" UUID,
    "idempotency_key" TEXT NOT NULL,
    "status" "payment_status" NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "fee_minor" INTEGER NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL,
    "provider_ref" TEXT NOT NULL,
    "failure_code" TEXT,
    "failure_message" TEXT,
    "processed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_webhooks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "signature_hash" CHAR(64) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "billing_webhook_status" NOT NULL DEFAULT 'RECEIVED',
    "error" TEXT,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),

    CONSTRAINT "billing_webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_records" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "subscription_id" UUID,
    "metric_key" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_quota_overrides" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "metric_key" TEXT NOT NULL,
    "limit_value" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tenant_quota_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "white_label_profiles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_name" TEXT NOT NULL DEFAULT 'Rabbehni',
    "logo_url" TEXT,
    "favicon_url" TEXT,
    "primary_color" TEXT NOT NULL DEFAULT '#0F766E',
    "secondary_color" TEXT NOT NULL DEFAULT '#2563EB',
    "font_family" TEXT NOT NULL DEFAULT 'Inter',
    "email_sender_name" TEXT NOT NULL DEFAULT 'Rabbehni',
    "email_reply_to" TEXT,
    "email_footer" TEXT,
    "theme_mode" TEXT NOT NULL DEFAULT 'SYSTEM',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "white_label_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_localizations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "default_language" TEXT NOT NULL DEFAULT 'fr',
    "enabled_languages" JSONB NOT NULL DEFAULT '["fr","en","ar"]',
    "countries" JSONB NOT NULL DEFAULT '["TN"]',
    "currencies" JSONB NOT NULL DEFAULT '["TND"]',
    "timezones" JSONB NOT NULL DEFAULT '["Africa/Tunis"]',
    "date_format" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    "time_format" TEXT NOT NULL DEFAULT '24h',
    "number_locale" TEXT NOT NULL DEFAULT 'fr-TN',
    "direction" TEXT NOT NULL DEFAULT 'LTR',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tenant_localizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_domains" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "hostname" TEXT NOT NULL,
    "status" "custom_domain_status" NOT NULL DEFAULT 'PENDING',
    "verification_token" TEXT NOT NULL,
    "verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "custom_domains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plan_feature_entitlements_feature_key_enabled_idx" ON "plan_feature_entitlements"("feature_key", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "plan_feature_entitlements_plan_id_feature_key_key" ON "plan_feature_entitlements"("plan_id", "feature_key");

-- CreateIndex
CREATE UNIQUE INDEX "plan_quota_limits_plan_id_metric_key_key" ON "plan_quota_limits"("plan_id", "metric_key");

-- CreateIndex
CREATE INDEX "subscription_changes_tenant_id_subscription_id_effective_at_idx" ON "subscription_changes"("tenant_id", "subscription_id", "effective_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_changes_id_tenant_id_key" ON "subscription_changes"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_intents_checkout_token_hash_key" ON "payment_intents"("checkout_token_hash");

-- CreateIndex
CREATE INDEX "payment_intents_tenant_id_status_created_at_idx" ON "payment_intents"("tenant_id", "status", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "payment_intents_id_tenant_id_key" ON "payment_intents"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_intents_tenant_id_idempotency_key_key" ON "payment_intents"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "invoices_tenant_id_status_created_at_idx" ON "invoices"("tenant_id", "status", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_id_tenant_id_key" ON "invoices"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_tenant_id_number_key" ON "invoices"("tenant_id", "number");

-- CreateIndex
CREATE INDEX "payment_transactions_tenant_id_status_processed_at_idx" ON "payment_transactions"("tenant_id", "status", "processed_at" DESC);

-- CreateIndex
CREATE INDEX "payment_transactions_payment_intent_id_tenant_id_idx" ON "payment_transactions"("payment_intent_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_id_tenant_id_key" ON "payment_transactions"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_tenant_id_idempotency_key_key" ON "payment_transactions"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "billing_webhooks_tenant_id_status_received_at_idx" ON "billing_webhooks"("tenant_id", "status", "received_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "billing_webhooks_id_tenant_id_key" ON "billing_webhooks"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_webhooks_tenant_id_event_id_key" ON "billing_webhooks"("tenant_id", "event_id");

-- CreateIndex
CREATE INDEX "usage_records_tenant_id_metric_key_occurred_at_idx" ON "usage_records"("tenant_id", "metric_key", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "usage_records_id_tenant_id_key" ON "usage_records"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "usage_records_tenant_id_idempotency_key_key" ON "usage_records"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_quota_overrides_id_tenant_id_key" ON "tenant_quota_overrides"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_quota_overrides_tenant_id_metric_key_key" ON "tenant_quota_overrides"("tenant_id", "metric_key");

-- CreateIndex
CREATE UNIQUE INDEX "white_label_profiles_tenant_id_key" ON "white_label_profiles"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "white_label_profiles_id_tenant_id_key" ON "white_label_profiles"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_localizations_tenant_id_key" ON "tenant_localizations"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_localizations_id_tenant_id_key" ON "tenant_localizations"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "custom_domains_hostname_key" ON "custom_domains"("hostname");

-- CreateIndex
CREATE INDEX "custom_domains_tenant_id_status_idx" ON "custom_domains"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "custom_domains_id_tenant_id_key" ON "custom_domains"("id", "tenant_id");

-- CreateIndex
CREATE INDEX "plans_status_sort_order_idx" ON "plans"("status", "sort_order");

-- AddForeignKey
ALTER TABLE "plan_feature_entitlements" ADD CONSTRAINT "plan_feature_entitlements_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_quota_limits" ADD CONSTRAINT "plan_quota_limits_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_changes" ADD CONSTRAINT "subscription_changes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_changes" ADD CONSTRAINT "subscription_changes_subscription_id_tenant_id_fkey" FOREIGN KEY ("subscription_id", "tenant_id") REFERENCES "subscriptions"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_subscription_id_tenant_id_fkey" FOREIGN KEY ("subscription_id", "tenant_id") REFERENCES "subscriptions"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_tenant_id_fkey" FOREIGN KEY ("subscription_id", "tenant_id") REFERENCES "subscriptions"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_subscription_id_tenant_id_fkey" FOREIGN KEY ("subscription_id", "tenant_id") REFERENCES "subscriptions"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_payment_intent_id_tenant_id_fkey" FOREIGN KEY ("payment_intent_id", "tenant_id") REFERENCES "payment_intents"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_invoice_id_tenant_id_fkey" FOREIGN KEY ("invoice_id", "tenant_id") REFERENCES "invoices"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_webhooks" ADD CONSTRAINT "billing_webhooks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_subscription_id_tenant_id_fkey" FOREIGN KEY ("subscription_id", "tenant_id") REFERENCES "subscriptions"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_quota_overrides" ADD CONSTRAINT "tenant_quota_overrides_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "white_label_profiles" ADD CONSTRAINT "white_label_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_localizations" ADD CONSTRAINT "tenant_localizations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_domains" ADD CONSTRAINT "custom_domains_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
