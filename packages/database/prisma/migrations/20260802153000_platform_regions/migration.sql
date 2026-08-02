CREATE TYPE "region_status" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

CREATE TABLE "platform_countries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "code" CHAR(2) NOT NULL,
  "name" TEXT NOT NULL,
  "default_locale" TEXT NOT NULL DEFAULT 'en',
  "default_currency" CHAR(3) NOT NULL DEFAULT 'USD',
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "archived_at" TIMESTAMPTZ(3),
  CONSTRAINT "platform_countries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_regions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "country_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "status" "region_status" NOT NULL DEFAULT 'ACTIVE',
  "cultural_profile" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "archived_at" TIMESTAMPTZ(3),
  CONSTRAINT "platform_regions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "region_administrators" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "region_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "region_administrators_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_countries_id_tenant_id_key" ON "platform_countries"("id", "tenant_id");
CREATE UNIQUE INDEX "platform_countries_tenant_id_code_key" ON "platform_countries"("tenant_id", "code");
CREATE INDEX "platform_countries_tenant_id_active_idx" ON "platform_countries"("tenant_id", "active");
CREATE UNIQUE INDEX "platform_regions_id_tenant_id_key" ON "platform_regions"("id", "tenant_id");
CREATE UNIQUE INDEX "platform_regions_tenant_id_code_key" ON "platform_regions"("tenant_id", "code");
CREATE INDEX "platform_regions_tenant_id_country_id_status_idx" ON "platform_regions"("tenant_id", "country_id", "status");
CREATE UNIQUE INDEX "region_administrators_id_tenant_id_key" ON "region_administrators"("id", "tenant_id");
CREATE UNIQUE INDEX "region_administrators_tenant_id_region_id_user_id_key" ON "region_administrators"("tenant_id", "region_id", "user_id");
CREATE INDEX "region_administrators_tenant_id_user_id_idx" ON "region_administrators"("tenant_id", "user_id");

ALTER TABLE "platform_countries" ADD CONSTRAINT "platform_countries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform_regions" ADD CONSTRAINT "platform_regions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform_regions" ADD CONSTRAINT "platform_regions_country_id_tenant_id_fkey" FOREIGN KEY ("country_id", "tenant_id") REFERENCES "platform_countries"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "region_administrators" ADD CONSTRAINT "region_administrators_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "region_administrators" ADD CONSTRAINT "region_administrators_region_id_tenant_id_fkey" FOREIGN KEY ("region_id", "tenant_id") REFERENCES "platform_regions"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "region_administrators" ADD CONSTRAINT "region_administrators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['platform_countries', 'platform_regions', 'region_administrators']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid)',
      table_name || '_tenant_isolation', table_name
    );
  END LOOP;
END $$;
