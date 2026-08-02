-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "tenant_status" AS ENUM ('PROVISIONING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "membership_status" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "staff_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'PAUSED', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "plan_status" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "role_scope" AS ENUM ('ORGANIZATION', 'MERCHANT', 'BRANCH');

-- CreateEnum
CREATE TYPE "outbox_status" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "external_subject" TEXT,
    "email" TEXT NOT NULL,
    "normalized_email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "status" "user_status" NOT NULL DEFAULT 'INVITED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deactivated_at" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "tenant_status" NOT NULL DEFAULT 'PROVISIONING',
    "region" TEXT NOT NULL,
    "default_locale" TEXT NOT NULL DEFAULT 'en',
    "default_currency" CHAR(3) NOT NULL DEFAULT 'TND',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "registration_number" TEXT,
    "tax_identifier" TEXT,
    "country_code" CHAR(2) NOT NULL,
    "timezone" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "franchises" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "franchises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchants" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "franchise_id" UUID,
    "code" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address_line" TEXT,
    "city" TEXT,
    "country_code" CHAR(2) NOT NULL,
    "timezone" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "membership_status" NOT NULL DEFAULT 'INVITED',
    "invited_at" TIMESTAMPTZ(3),
    "joined_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "merchant_id" UUID,
    "branch_id" UUID,
    "employee_code" TEXT,
    "job_title" TEXT,
    "status" "staff_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" "role_scope" NOT NULL DEFAULT 'ORGANIZATION',
    "system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "tenant_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("tenant_id","role_id","permission_id")
);

-- CreateTable
CREATE TABLE "membership_roles" (
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_roles_pkey" PRIMARY KEY ("tenant_id","membership_id","role_id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "plan_status" NOT NULL DEFAULT 'DRAFT',
    "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
    "monthly_price_minor" INTEGER NOT NULL DEFAULT 0,
    "annual_price_minor" INTEGER NOT NULL DEFAULT 0,
    "entitlements" JSONB NOT NULL,
    "limits" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "subscription_status" NOT NULL DEFAULT 'TRIALING',
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "trial_ends_at" TIMESTAMPTZ(3),
    "current_period_ends_at" TIMESTAMPTZ(3),
    "canceled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "namespace" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "correlation_id" UUID NOT NULL,
    "request_id" TEXT,
    "ip_address" INET,
    "user_agent" TEXT,
    "metadata" JSONB,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "correlation_id" UUID NOT NULL,
    "status" "outbox_status" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(3),
    "last_error" TEXT,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_external_subject_key" ON "users"("external_subject");

-- CreateIndex
CREATE UNIQUE INDEX "users_normalized_email_key" ON "users"("normalized_email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "tenants_status_idx" ON "tenants"("status");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_tenant_id_key" ON "organizations"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_id_tenant_id_key" ON "organizations"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_tenant_id_code_key" ON "organizations"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "franchises_organization_id_tenant_id_idx" ON "franchises"("organization_id", "tenant_id");

-- CreateIndex
CREATE INDEX "franchises_tenant_id_active_idx" ON "franchises"("tenant_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "franchises_id_tenant_id_key" ON "franchises"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "franchises_id_organization_id_tenant_id_key" ON "franchises"("id", "organization_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "franchises_tenant_id_code_key" ON "franchises"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "merchants_organization_id_tenant_id_idx" ON "merchants"("organization_id", "tenant_id");

-- CreateIndex
CREATE INDEX "merchants_franchise_id_tenant_id_idx" ON "merchants"("franchise_id", "tenant_id");

-- CreateIndex
CREATE INDEX "merchants_tenant_id_active_idx" ON "merchants"("tenant_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_id_tenant_id_key" ON "merchants"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_tenant_id_code_key" ON "merchants"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "branches_merchant_id_tenant_id_idx" ON "branches"("merchant_id", "tenant_id");

-- CreateIndex
CREATE INDEX "branches_tenant_id_active_idx" ON "branches"("tenant_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "branches_id_tenant_id_key" ON "branches"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "branches_id_merchant_id_tenant_id_key" ON "branches"("id", "merchant_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "branches_tenant_id_code_key" ON "branches"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "memberships_organization_id_tenant_id_idx" ON "memberships"("organization_id", "tenant_id");

-- CreateIndex
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");

-- CreateIndex
CREATE INDEX "memberships_tenant_id_status_idx" ON "memberships"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_id_tenant_id_key" ON "memberships"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_id_user_id_tenant_id_key" ON "memberships"("id", "user_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_tenant_id_user_id_key" ON "memberships"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "staff_membership_id_tenant_id_idx" ON "staff"("membership_id", "tenant_id");

-- CreateIndex
CREATE INDEX "staff_user_id_idx" ON "staff"("user_id");

-- CreateIndex
CREATE INDEX "staff_merchant_id_tenant_id_idx" ON "staff"("merchant_id", "tenant_id");

-- CreateIndex
CREATE INDEX "staff_branch_id_tenant_id_idx" ON "staff"("branch_id", "tenant_id");

-- CreateIndex
CREATE INDEX "staff_tenant_id_status_idx" ON "staff"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "staff_id_tenant_id_key" ON "staff"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_tenant_id_employee_code_key" ON "staff"("tenant_id", "employee_code");

-- CreateIndex
CREATE INDEX "roles_tenant_id_scope_idx" ON "roles"("tenant_id", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "roles_id_tenant_id_key" ON "roles"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenant_id_code_key" ON "roles"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "role_permissions_role_id_tenant_id_idx" ON "role_permissions"("role_id", "tenant_id");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "membership_roles_membership_id_tenant_id_idx" ON "membership_roles"("membership_id", "tenant_id");

-- CreateIndex
CREATE INDEX "membership_roles_role_id_tenant_id_idx" ON "membership_roles"("role_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE INDEX "plans_status_idx" ON "plans"("status");

-- CreateIndex
CREATE INDEX "subscriptions_tenant_id_status_idx" ON "subscriptions"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "subscriptions_plan_id_idx" ON "subscriptions"("plan_id");

-- CreateIndex
CREATE INDEX "subscriptions_tenant_id_starts_at_idx" ON "subscriptions"("tenant_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_id_tenant_id_key" ON "subscriptions"("id", "tenant_id");

-- CreateIndex
CREATE INDEX "tenant_settings_updated_by_id_idx" ON "tenant_settings"("updated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_settings_id_tenant_id_key" ON "tenant_settings"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_settings_tenant_id_namespace_key_key" ON "tenant_settings"("tenant_id", "namespace", "key");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_occurred_at_idx" ON "audit_logs"("tenant_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_entity_type_entity_id_idx" ON "audit_logs"("tenant_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs"("actor_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_correlation_id_idx" ON "audit_logs"("correlation_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_id_tenant_id_key" ON "audit_logs"("id", "tenant_id");

-- CreateIndex
CREATE INDEX "outbox_events_tenant_id_status_occurred_at_idx" ON "outbox_events"("tenant_id", "status", "occurred_at");

-- CreateIndex
CREATE INDEX "outbox_events_status_occurred_at_idx" ON "outbox_events"("status", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_id_tenant_id_key" ON "outbox_events"("id", "tenant_id");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "franchises" ADD CONSTRAINT "franchises_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "franchises" ADD CONSTRAINT "franchises_organization_id_tenant_id_fkey" FOREIGN KEY ("organization_id", "tenant_id") REFERENCES "organizations"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_organization_id_tenant_id_fkey" FOREIGN KEY ("organization_id", "tenant_id") REFERENCES "organizations"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_franchise_id_organization_id_tenant_id_fkey" FOREIGN KEY ("franchise_id", "organization_id", "tenant_id") REFERENCES "franchises"("id", "organization_id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_merchant_id_tenant_id_fkey" FOREIGN KEY ("merchant_id", "tenant_id") REFERENCES "merchants"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_tenant_id_fkey" FOREIGN KEY ("organization_id", "tenant_id") REFERENCES "organizations"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_membership_id_user_id_tenant_id_fkey" FOREIGN KEY ("membership_id", "user_id", "tenant_id") REFERENCES "memberships"("id", "user_id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_merchant_id_tenant_id_fkey" FOREIGN KEY ("merchant_id", "tenant_id") REFERENCES "merchants"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_branch_id_merchant_id_tenant_id_fkey" FOREIGN KEY ("branch_id", "merchant_id", "tenant_id") REFERENCES "branches"("id", "merchant_id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_tenant_id_fkey" FOREIGN KEY ("role_id", "tenant_id") REFERENCES "roles"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_membership_id_tenant_id_fkey" FOREIGN KEY ("membership_id", "tenant_id") REFERENCES "memberships"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_role_id_tenant_id_fkey" FOREIGN KEY ("role_id", "tenant_id") REFERENCES "roles"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Domain integrity checks not expressible in the Prisma data model.
ALTER TABLE "tenants"
  ADD CONSTRAINT "tenants_default_currency_check"
  CHECK ("default_currency" ~ '^[A-Z]{3}$');

ALTER TABLE "organizations"
  ADD CONSTRAINT "organizations_country_code_check"
  CHECK ("country_code" ~ '^[A-Z]{2}$');

ALTER TABLE "branches"
  ADD CONSTRAINT "branches_country_code_check"
  CHECK ("country_code" ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT "branches_currency_check"
  CHECK ("currency" ~ '^[A-Z]{3}$');

ALTER TABLE "plans"
  ADD CONSTRAINT "plans_currency_check"
  CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "plans_monthly_price_minor_check"
  CHECK ("monthly_price_minor" >= 0),
  ADD CONSTRAINT "plans_annual_price_minor_check"
  CHECK ("annual_price_minor" >= 0);

ALTER TABLE "tenant_settings"
  ADD CONSTRAINT "tenant_settings_version_check"
  CHECK ("version" > 0);

ALTER TABLE "outbox_events"
  ADD CONSTRAINT "outbox_events_attempts_check"
  CHECK ("attempts" >= 0);

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_period_check"
  CHECK (
    ("trial_ends_at" IS NULL OR "trial_ends_at" >= "starts_at")
    AND ("current_period_ends_at" IS NULL OR "current_period_ends_at" >= "starts_at")
    AND ("canceled_at" IS NULL OR "canceled_at" >= "starts_at")
  );

-- Tenant isolation is enforced for every tenant-owned table.
-- The transaction layer sets app.current_tenant_id with set_config(..., true),
-- making the value local to the current database transaction.
DO $$
DECLARE
  tenant_table text;
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY[
    'organizations',
    'franchises',
    'merchants',
    'branches',
    'memberships',
    'staff',
    'roles',
    'role_permissions',
    'membership_roles',
    'subscriptions',
    'tenant_settings',
    'audit_logs',
    'outbox_events'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I FOR ALL USING (
        tenant_id = (SELECT NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid)
      ) WITH CHECK (
        tenant_id = (SELECT NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid)
      )',
      tenant_table
    );
  END LOOP;
END
$$;

-- The tenant row is the isolation root and therefore uses its id directly.
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenants" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tenants"
  FOR ALL
  USING (
    "id" = (SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  )
  WITH CHECK (
    "id" = (SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  );

-- Keep accidental PUBLIC grants from weakening the application role.
REVOKE ALL ON TABLE
  "tenants",
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
  "outbox_events"
FROM PUBLIC;
