-- Phase 4 management lifecycle enums.
DO $$ BEGIN
  CREATE TYPE "organization_status" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "franchise_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "merchant_status" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "branch_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE "staff_status" ADD VALUE IF NOT EXISTS 'INVITED';
ALTER TYPE "staff_status" ADD VALUE IF NOT EXISTS 'REMOVED';
ALTER TYPE "role_scope" ADD VALUE IF NOT EXISTS 'FRANCHISE';

-- An isolated tenant may own multiple organizations.
DROP INDEX IF EXISTS "organizations_tenant_id_key";

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "status" "organization_status" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "settings" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "activated_at" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "suspended_at" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ(3);

UPDATE "organizations"
SET "status" = 'ACTIVE', "activated_at" = COALESCE("activated_at", CURRENT_TIMESTAMP);

CREATE INDEX IF NOT EXISTS "organizations_tenant_id_status_idx"
  ON "organizations"("tenant_id", "status");

-- Replace boolean franchise lifecycle with an explicit audited status.
DROP INDEX IF EXISTS "franchises_tenant_id_active_idx";
ALTER TABLE "franchises"
  ADD COLUMN IF NOT EXISTS "status" "franchise_status" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "settings" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ(3);
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'franchises' AND column_name = 'active'
  ) THEN
    EXECUTE 'UPDATE "franchises" SET "status" = CASE WHEN "active" THEN ''ACTIVE''::"franchise_status" ELSE ''SUSPENDED''::"franchise_status" END';
  END IF;
END $$;
ALTER TABLE "franchises" DROP COLUMN IF EXISTS "active";
CREATE INDEX IF NOT EXISTS "franchises_tenant_id_status_idx"
  ON "franchises"("tenant_id", "status");

-- Merchant profile, contact, operational settings and lifecycle.
DROP INDEX IF EXISTS "merchants_tenant_id_active_idx";
ALTER TABLE "merchants"
  ADD COLUMN IF NOT EXISTS "status" "merchant_status" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "contact_email" TEXT,
  ADD COLUMN IF NOT EXISTS "contact_phone" TEXT,
  ADD COLUMN IF NOT EXISTS "website" TEXT,
  ADD COLUMN IF NOT EXISTS "address_line" TEXT,
  ADD COLUMN IF NOT EXISTS "city" TEXT,
  ADD COLUMN IF NOT EXISTS "country_code" CHAR(2),
  ADD COLUMN IF NOT EXISTS "timezone" TEXT,
  ADD COLUMN IF NOT EXISTS "locale" TEXT,
  ADD COLUMN IF NOT EXISTS "settings" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "activated_at" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "suspended_at" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ(3);
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'merchants' AND column_name = 'active'
  ) THEN
    EXECUTE 'UPDATE "merchants" SET "status" = CASE WHEN "active" THEN ''ACTIVE''::"merchant_status" ELSE ''SUSPENDED''::"merchant_status" END, "activated_at" = CASE WHEN "active" THEN CURRENT_TIMESTAMP ELSE NULL END';
  END IF;
END $$;
ALTER TABLE "merchants" DROP COLUMN IF EXISTS "active";
CREATE UNIQUE INDEX IF NOT EXISTS "merchants_id_organization_id_tenant_id_key"
  ON "merchants"("id", "organization_id", "tenant_id");
CREATE INDEX IF NOT EXISTS "merchants_tenant_id_status_idx"
  ON "merchants"("tenant_id", "status");
ALTER TABLE "merchants"
  DROP CONSTRAINT IF EXISTS "merchants_country_code_check",
  ADD CONSTRAINT "merchants_country_code_check"
  CHECK ("country_code" IS NULL OR "country_code" ~ '^[A-Z]{2}$');

-- Branches carry their complete organization/franchise boundary and operating profile.
ALTER TABLE "branches"
  DROP CONSTRAINT IF EXISTS "branches_merchant_id_tenant_id_fkey";
DROP INDEX IF EXISTS "branches_tenant_id_active_idx";
ALTER TABLE "branches"
  ADD COLUMN IF NOT EXISTS "organization_id" UUID,
  ADD COLUMN IF NOT EXISTS "franchise_id" UUID,
  ADD COLUMN IF NOT EXISTS "address_line_2" TEXT,
  ADD COLUMN IF NOT EXISTS "region" TEXT,
  ADD COLUMN IF NOT EXISTS "postal_code" TEXT,
  ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "email" TEXT,
  ADD COLUMN IF NOT EXISTS "status" "branch_status" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "settings" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "opening_hours" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ(3);

UPDATE "branches" AS b
SET "organization_id" = m."organization_id",
    "franchise_id" = m."franchise_id"
FROM "merchants" AS m
WHERE m."id" = b."merchant_id" AND m."tenant_id" = b."tenant_id";

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'active'
  ) THEN
    EXECUTE 'UPDATE "branches" SET "status" = CASE WHEN "active" THEN ''ACTIVE''::"branch_status" ELSE ''SUSPENDED''::"branch_status" END';
  END IF;
END $$;

ALTER TABLE "branches"
  ALTER COLUMN "organization_id" SET NOT NULL,
  DROP COLUMN IF EXISTS "active";

CREATE INDEX IF NOT EXISTS "branches_organization_id_tenant_id_idx"
  ON "branches"("organization_id", "tenant_id");
CREATE INDEX IF NOT EXISTS "branches_franchise_id_tenant_id_idx"
  ON "branches"("franchise_id", "tenant_id");
CREATE INDEX IF NOT EXISTS "branches_tenant_id_status_idx"
  ON "branches"("tenant_id", "status");

ALTER TABLE "branches"
  DROP CONSTRAINT IF EXISTS "branches_organization_id_tenant_id_fkey",
  DROP CONSTRAINT IF EXISTS "branches_merchant_id_organization_id_tenant_id_fkey",
  DROP CONSTRAINT IF EXISTS "branches_franchise_id_organization_id_tenant_id_fkey",
  ADD CONSTRAINT "branches_organization_id_tenant_id_fkey"
    FOREIGN KEY ("organization_id", "tenant_id")
    REFERENCES "organizations"("id", "tenant_id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "branches_merchant_id_organization_id_tenant_id_fkey"
    FOREIGN KEY ("merchant_id", "organization_id", "tenant_id")
    REFERENCES "merchants"("id", "organization_id", "tenant_id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "branches_franchise_id_organization_id_tenant_id_fkey"
    FOREIGN KEY ("franchise_id", "organization_id", "tenant_id")
    REFERENCES "franchises"("id", "organization_id", "tenant_id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Staff is explicitly scoped and all scope links are tenant/organization safe.
ALTER TABLE "staff"
  DROP CONSTRAINT IF EXISTS "staff_membership_id_user_id_tenant_id_fkey",
  DROP CONSTRAINT IF EXISTS "staff_merchant_id_tenant_id_fkey",
  DROP CONSTRAINT IF EXISTS "staff_branch_id_merchant_id_tenant_id_fkey";

ALTER TABLE "staff"
  ADD COLUMN IF NOT EXISTS "organization_id" UUID,
  ADD COLUMN IF NOT EXISTS "franchise_id" UUID,
  ADD COLUMN IF NOT EXISTS "invited_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "activated_at" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "suspended_at" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "removed_at" TIMESTAMPTZ(3);

UPDATE "staff" AS s
SET "organization_id" = ms."organization_id"
FROM "memberships" AS ms
WHERE ms."id" = s."membership_id"
  AND ms."user_id" = s."user_id"
  AND ms."tenant_id" = s."tenant_id";

UPDATE "staff" AS s
SET "franchise_id" = m."franchise_id"
FROM "merchants" AS m
WHERE m."id" = s."merchant_id" AND m."tenant_id" = s."tenant_id";

UPDATE "staff"
SET "activated_at" = CURRENT_TIMESTAMP
WHERE "status" = 'ACTIVE';

ALTER TABLE "staff" ALTER COLUMN "organization_id" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "memberships_id_user_id_organization_id_tenant_id_key"
  ON "memberships"("id", "user_id", "organization_id", "tenant_id");
CREATE INDEX IF NOT EXISTS "staff_organization_id_tenant_id_idx"
  ON "staff"("organization_id", "tenant_id");
CREATE INDEX IF NOT EXISTS "staff_franchise_id_tenant_id_idx"
  ON "staff"("franchise_id", "tenant_id");

ALTER TABLE "staff"
  DROP CONSTRAINT IF EXISTS "staff_membership_id_user_id_organization_id_tenant_id_fkey",
  DROP CONSTRAINT IF EXISTS "staff_organization_id_tenant_id_fkey",
  DROP CONSTRAINT IF EXISTS "staff_franchise_id_organization_id_tenant_id_fkey",
  DROP CONSTRAINT IF EXISTS "staff_merchant_id_organization_id_tenant_id_fkey",
  DROP CONSTRAINT IF EXISTS "staff_branch_id_merchant_id_tenant_id_fkey",
  ADD CONSTRAINT "staff_membership_id_user_id_organization_id_tenant_id_fkey"
    FOREIGN KEY ("membership_id", "user_id", "organization_id", "tenant_id")
    REFERENCES "memberships"("id", "user_id", "organization_id", "tenant_id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "staff_organization_id_tenant_id_fkey"
    FOREIGN KEY ("organization_id", "tenant_id")
    REFERENCES "organizations"("id", "tenant_id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "staff_franchise_id_organization_id_tenant_id_fkey"
    FOREIGN KEY ("franchise_id", "organization_id", "tenant_id")
    REFERENCES "franchises"("id", "organization_id", "tenant_id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "staff_merchant_id_organization_id_tenant_id_fkey"
    FOREIGN KEY ("merchant_id", "organization_id", "tenant_id")
    REFERENCES "merchants"("id", "organization_id", "tenant_id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "staff_branch_id_merchant_id_tenant_id_fkey"
    FOREIGN KEY ("branch_id", "merchant_id", "tenant_id")
    REFERENCES "branches"("id", "merchant_id", "tenant_id")
    ON DELETE CASCADE ON UPDATE CASCADE;
