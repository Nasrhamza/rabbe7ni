-- CreateEnum
CREATE TYPE "report_frequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "report_execution_status" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD_LETTER', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ai_capability" AS ENUM ('SEGMENT_ASSISTANCE', 'CAMPAIGN_AUDIENCE', 'REWARD_RECOMMENDATION', 'CHURN_RISK', 'ENGAGEMENT_RISK', 'CAMPAIGN_TIMING', 'ANOMALY_DETECTION', 'ANALYTICS_EXPLANATION', 'OPERATIONAL_SUMMARY');

-- CreateEnum
CREATE TYPE "ai_request_status" AS ENUM ('PROCESSING', 'COMPLETED', 'FALLBACK', 'FAILED');

-- CreateTable
CREATE TABLE "report_definitions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "recipient_customer_id" UUID,
    "notification_template_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" "report_frequency" NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "filters" JSONB NOT NULL DEFAULT '{}',
    "metrics" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "next_run_at" TIMESTAMPTZ(3),
    "retention_days" INTEGER NOT NULL DEFAULT 30,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "report_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_executions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "definition_id" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "status" "report_execution_status" NOT NULL DEFAULT 'QUEUED',
    "period_start" TIMESTAMPTZ(3) NOT NULL,
    "period_end" TIMESTAMPTZ(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "result_summary" JSONB NOT NULL DEFAULT '{}',
    "failure_reason" TEXT,
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "report_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_artifacts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "execution_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "checksum" CHAR(64) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_insight_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "organization_id" UUID,
    "capability" "ai_capability" NOT NULL,
    "status" "ai_request_status" NOT NULL DEFAULT 'PROCESSING',
    "idempotency_key" TEXT NOT NULL,
    "input_digest" CHAR(64) NOT NULL,
    "model_version" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "fallback" BOOLEAN NOT NULL DEFAULT false,
    "redacted_input" JSONB NOT NULL DEFAULT '{}',
    "output" JSONB NOT NULL DEFAULT '{}',
    "failure_reason" TEXT,
    "requested_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "ai_insight_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_definitions_tenant_id_active_next_run_at_idx" ON "report_definitions"("tenant_id", "active", "next_run_at");

-- CreateIndex
CREATE INDEX "report_definitions_tenant_id_organization_id_idx" ON "report_definitions"("tenant_id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "report_definitions_id_tenant_id_key" ON "report_definitions"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "report_definitions_tenant_id_code_key" ON "report_definitions"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "report_executions_tenant_id_definition_id_created_at_idx" ON "report_executions"("tenant_id", "definition_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "report_executions_tenant_id_status_created_at_idx" ON "report_executions"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "report_executions_id_tenant_id_key" ON "report_executions"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "report_executions_tenant_id_idempotency_key_key" ON "report_executions"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "report_artifacts_execution_id_key" ON "report_artifacts"("execution_id");

-- CreateIndex
CREATE INDEX "report_artifacts_tenant_id_expires_at_idx" ON "report_artifacts"("tenant_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "report_artifacts_id_tenant_id_key" ON "report_artifacts"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "report_artifacts_execution_id_tenant_id_key" ON "report_artifacts"("execution_id", "tenant_id");

-- CreateIndex
CREATE INDEX "ai_insight_requests_tenant_id_capability_created_at_idx" ON "ai_insight_requests"("tenant_id", "capability", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_insight_requests_tenant_id_status_created_at_idx" ON "ai_insight_requests"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_insight_requests_id_tenant_id_key" ON "ai_insight_requests"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_insight_requests_tenant_id_idempotency_key_key" ON "ai_insight_requests"("tenant_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "report_definitions" ADD CONSTRAINT "report_definitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_definitions" ADD CONSTRAINT "report_definitions_organization_id_tenant_id_fkey" FOREIGN KEY ("organization_id", "tenant_id") REFERENCES "organizations"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_definitions" ADD CONSTRAINT "report_definitions_recipient_customer_id_tenant_id_fkey" FOREIGN KEY ("recipient_customer_id", "tenant_id") REFERENCES "customers"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_definitions" ADD CONSTRAINT "report_definitions_notification_template_id_tenant_id_fkey" FOREIGN KEY ("notification_template_id", "tenant_id") REFERENCES "notification_templates"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_executions" ADD CONSTRAINT "report_executions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_executions" ADD CONSTRAINT "report_executions_definition_id_tenant_id_fkey" FOREIGN KEY ("definition_id", "tenant_id") REFERENCES "report_definitions"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_artifacts" ADD CONSTRAINT "report_artifacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_artifacts" ADD CONSTRAINT "report_artifacts_execution_id_tenant_id_fkey" FOREIGN KEY ("execution_id", "tenant_id") REFERENCES "report_executions"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_insight_requests" ADD CONSTRAINT "ai_insight_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_insight_requests" ADD CONSTRAINT "ai_insight_requests_organization_id_tenant_id_fkey" FOREIGN KEY ("organization_id", "tenant_id") REFERENCES "organizations"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Phase 8 report and AI records remain tenant-isolated even for the table owner.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'report_definitions',
    'report_executions',
    'report_artifacts',
    'ai_insight_requests'
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
