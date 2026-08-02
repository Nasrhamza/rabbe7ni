-- CreateEnum
CREATE TYPE "segment_type" AS ENUM ('STATIC', 'DYNAMIC');

-- CreateEnum
CREATE TYPE "marketing_status" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "segment_membership_action" AS ENUM ('JOINED', 'LEFT');

-- CreateEnum
CREATE TYPE "campaign_type" AS ENUM ('INFORMATIONAL', 'PROMOTIONAL', 'LOYALTY', 'REWARD', 'RE_ENGAGEMENT', 'CHALLENGE', 'BIRTHDAY', 'ANNIVERSARY');

-- CreateEnum
CREATE TYPE "campaign_status" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "automation_type" AS ENUM ('EVENT_TRIGGERED', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "automation_status" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "automation_step_type" AS ENUM ('CONDITION', 'WAIT', 'NOTIFICATION', 'REWARD', 'EXIT');

-- CreateEnum
CREATE TYPE "automation_execution_status" AS ENUM ('RUNNING', 'WAITING', 'COMPLETED', 'FAILED', 'CANCELLED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('EMAIL', 'PUSH', 'SMS', 'IN_APP', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "notification_category" AS ENUM ('TRANSACTIONAL', 'MARKETING', 'LOYALTY', 'REWARD', 'GAMIFICATION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "notification_template_status" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "notification_delivery_status" AS ENUM ('QUEUED', 'PROCESSING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED', 'CANCELLED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "campaign_metric_type" AS ENUM ('TARGETED', 'QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'OPENED', 'CLICKED', 'CONVERTED', 'UNSUBSCRIBED');

-- CreateEnum
CREATE TYPE "marketing_event_status" AS ENUM ('PROCESSING', 'PROCESSED', 'FAILED', 'DEAD_LETTER');

-- CreateTable
CREATE TABLE "customer_segments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "segment_type" NOT NULL,
    "status" "marketing_status" NOT NULL DEFAULT 'DRAFT',
    "rules" JSONB NOT NULL DEFAULT '{}',
    "schedule" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "estimated_size" INTEGER NOT NULL DEFAULT 0,
    "last_refreshed_at" TIMESTAMPTZ(3),
    "next_refresh_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "segment_memberships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "segment_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'RULE',
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "segment_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "segment_membership_history" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "segment_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "action" "segment_membership_action" NOT NULL,
    "reason" TEXT,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "segment_membership_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "campaign_type" NOT NULL,
    "status" "campaign_status" NOT NULL DEFAULT 'DRAFT',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "starts_at" TIMESTAMPTZ(3),
    "ends_at" TIMESTAMPTZ(3),
    "frequency_cap" INTEGER NOT NULL DEFAULT 1,
    "frequency_window_hours" INTEGER NOT NULL DEFAULT 24,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(3),
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "archived_at" TIMESTAMPTZ(3),

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_segments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "segment_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_applicability" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "organization_id" UUID,
    "franchise_id" UUID,
    "merchant_id" UUID,
    "branch_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_applicability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_workflows" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "automation_type" NOT NULL,
    "status" "automation_status" NOT NULL DEFAULT 'DRAFT',
    "trigger_type" TEXT NOT NULL,
    "trigger_config" JSONB NOT NULL DEFAULT '{}',
    "schedule" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "exit_conditions" JSONB NOT NULL DEFAULT '{}',
    "max_executions_per_customer" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "automation_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_steps" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "type" "automation_step_type" NOT NULL,
    "configuration" JSONB NOT NULL DEFAULT '{}',
    "delay_seconds" INTEGER NOT NULL DEFAULT 0,
    "next_on_true" UUID,
    "next_on_false" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "automation_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_executions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "event_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "status" "automation_execution_status" NOT NULL DEFAULT 'RUNNING',
    "current_step_id" UUID,
    "context" JSONB NOT NULL DEFAULT '{}',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_run_at" TIMESTAMPTZ(3),
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "automation_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_step_executions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "execution_id" UUID NOT NULL,
    "step_id" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "status" "automation_execution_status" NOT NULL DEFAULT 'RUNNING',
    "output" JSONB NOT NULL DEFAULT '{}',
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),
    "failure_reason" TEXT,

    CONSTRAINT "automation_step_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "category" "notification_category" NOT NULL,
    "status" "notification_template_status" NOT NULL DEFAULT 'DRAFT',
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "branding" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_template_versions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "locale" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "campaign_id" UUID,
    "automation_execution_id" UUID,
    "template_id" UUID,
    "template_version_id" UUID,
    "channel" "notification_channel" NOT NULL,
    "category" "notification_category" NOT NULL,
    "status" "notification_delivery_status" NOT NULL DEFAULT 'QUEUED',
    "idempotency_key" TEXT NOT NULL,
    "recipient" TEXT,
    "locale" TEXT NOT NULL,
    "rendered_subject" TEXT,
    "rendered_body" TEXT NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '{}',
    "deep_link" JSONB,
    "provider" TEXT,
    "provider_message_id" TEXT,
    "provider_response" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "scheduled_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processing_at" TIMESTAMPTZ(3),
    "sent_at" TIMESTAMPTZ(3),
    "delivered_at" TIMESTAMPTZ(3),
    "failed_at" TIMESTAMPTZ(3),
    "dead_lettered_at" TIMESTAMPTZ(3),
    "failure_code" TEXT,
    "failure_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_attempts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "delivery_id" UUID NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" "notification_delivery_status" NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_response" JSONB,
    "error_code" TEXT,
    "error_message" TEXT,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "in_app_notifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "delivery_id" UUID,
    "category" "notification_category" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deep_link" JSONB,
    "read_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "in_app_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_communication_preferences" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "category" "notification_category" NOT NULL,
    "opted_in" BOOLEAN NOT NULL DEFAULT true,
    "quiet_hours_start" TEXT,
    "quiet_hours_end" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "consent_source" TEXT,
    "consent_updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_communication_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_metrics" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "type" "campaign_metric_type" NOT NULL,
    "customer_id" UUID,
    "event_id" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 1,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "campaign_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_event_receipts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "status" "marketing_event_status" NOT NULL DEFAULT 'PROCESSING',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "failure_reason" TEXT,
    "processed_at" TIMESTAMPTZ(3),
    "next_retry_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "marketing_event_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_segments_tenant_id_organization_id_status_idx" ON "customer_segments"("tenant_id", "organization_id", "status");

-- CreateIndex
CREATE INDEX "customer_segments_tenant_id_next_refresh_at_idx" ON "customer_segments"("tenant_id", "next_refresh_at");

-- CreateIndex
CREATE UNIQUE INDEX "customer_segments_id_tenant_id_key" ON "customer_segments"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_segments_tenant_id_code_key" ON "customer_segments"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "segment_memberships_tenant_id_customer_id_segment_id_idx" ON "segment_memberships"("tenant_id", "customer_id", "segment_id");

-- CreateIndex
CREATE UNIQUE INDEX "segment_memberships_id_tenant_id_key" ON "segment_memberships"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "segment_memberships_tenant_id_segment_id_customer_id_key" ON "segment_memberships"("tenant_id", "segment_id", "customer_id");

-- CreateIndex
CREATE INDEX "segment_membership_history_tenant_id_segment_id_occurred_at_idx" ON "segment_membership_history"("tenant_id", "segment_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "segment_membership_history_tenant_id_customer_id_occurred_a_idx" ON "segment_membership_history"("tenant_id", "customer_id", "occurred_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "segment_membership_history_id_tenant_id_key" ON "segment_membership_history"("id", "tenant_id");

-- CreateIndex
CREATE INDEX "campaigns_tenant_id_organization_id_status_idx" ON "campaigns"("tenant_id", "organization_id", "status");

-- CreateIndex
CREATE INDEX "campaigns_tenant_id_status_starts_at_idx" ON "campaigns"("tenant_id", "status", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_id_tenant_id_key" ON "campaigns"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_tenant_id_code_key" ON "campaigns"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "campaign_segments_tenant_id_segment_id_idx" ON "campaign_segments"("tenant_id", "segment_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_segments_id_tenant_id_key" ON "campaign_segments"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_segments_tenant_id_campaign_id_segment_id_key" ON "campaign_segments"("tenant_id", "campaign_id", "segment_id");

-- CreateIndex
CREATE INDEX "campaign_applicability_tenant_id_campaign_id_idx" ON "campaign_applicability"("tenant_id", "campaign_id");

-- CreateIndex
CREATE INDEX "campaign_applicability_tenant_id_organization_id_franchise__idx" ON "campaign_applicability"("tenant_id", "organization_id", "franchise_id", "merchant_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_applicability_id_tenant_id_key" ON "campaign_applicability"("id", "tenant_id");

-- CreateIndex
CREATE INDEX "automation_workflows_tenant_id_organization_id_status_trigg_idx" ON "automation_workflows"("tenant_id", "organization_id", "status", "trigger_type");

-- CreateIndex
CREATE UNIQUE INDEX "automation_workflows_id_tenant_id_key" ON "automation_workflows"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_workflows_tenant_id_code_key" ON "automation_workflows"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "automation_steps_tenant_id_workflow_id_position_idx" ON "automation_steps"("tenant_id", "workflow_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "automation_steps_id_tenant_id_key" ON "automation_steps"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_steps_tenant_id_workflow_id_code_key" ON "automation_steps"("tenant_id", "workflow_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "automation_steps_tenant_id_workflow_id_position_key" ON "automation_steps"("tenant_id", "workflow_id", "position");

-- CreateIndex
CREATE INDEX "automation_executions_tenant_id_workflow_id_status_next_run_idx" ON "automation_executions"("tenant_id", "workflow_id", "status", "next_run_at");

-- CreateIndex
CREATE INDEX "automation_executions_tenant_id_customer_id_started_at_idx" ON "automation_executions"("tenant_id", "customer_id", "started_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "automation_executions_id_tenant_id_key" ON "automation_executions"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_executions_tenant_id_idempotency_key_key" ON "automation_executions"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "automation_step_executions_tenant_id_execution_id_started_a_idx" ON "automation_step_executions"("tenant_id", "execution_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "automation_step_executions_id_tenant_id_key" ON "automation_step_executions"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_step_executions_tenant_id_idempotency_key_key" ON "automation_step_executions"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "notification_templates_tenant_id_organization_id_status_cha_idx" ON "notification_templates"("tenant_id", "organization_id", "status", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_id_tenant_id_key" ON "notification_templates"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_tenant_id_code_channel_key" ON "notification_templates"("tenant_id", "code", "channel");

-- CreateIndex
CREATE INDEX "notification_template_versions_tenant_id_template_id_versio_idx" ON "notification_template_versions"("tenant_id", "template_id", "version" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "notification_template_versions_id_tenant_id_key" ON "notification_template_versions"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_template_versions_tenant_id_template_id_versio_key" ON "notification_template_versions"("tenant_id", "template_id", "version", "locale");

-- CreateIndex
CREATE INDEX "notification_deliveries_tenant_id_status_scheduled_at_idx" ON "notification_deliveries"("tenant_id", "status", "scheduled_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_tenant_id_customer_id_created_at_idx" ON "notification_deliveries"("tenant_id", "customer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notification_deliveries_tenant_id_campaign_id_status_idx" ON "notification_deliveries"("tenant_id", "campaign_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_id_tenant_id_key" ON "notification_deliveries"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_tenant_id_idempotency_key_key" ON "notification_deliveries"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "notification_attempts_tenant_id_status_occurred_at_idx" ON "notification_attempts"("tenant_id", "status", "occurred_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "notification_attempts_id_tenant_id_key" ON "notification_attempts"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_attempts_tenant_id_delivery_id_attempt_key" ON "notification_attempts"("tenant_id", "delivery_id", "attempt");

-- CreateIndex
CREATE UNIQUE INDEX "in_app_notifications_delivery_id_key" ON "in_app_notifications"("delivery_id");

-- CreateIndex
CREATE INDEX "in_app_notifications_tenant_id_customer_id_read_at_created__idx" ON "in_app_notifications"("tenant_id", "customer_id", "read_at", "created_at" DESC);

-- CreateIndex
CREATE INDEX "in_app_notifications_tenant_id_expires_at_idx" ON "in_app_notifications"("tenant_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "in_app_notifications_id_tenant_id_key" ON "in_app_notifications"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "in_app_notifications_delivery_id_tenant_id_key" ON "in_app_notifications"("delivery_id", "tenant_id");

-- CreateIndex
CREATE INDEX "customer_communication_preferences_tenant_id_customer_id_op_idx" ON "customer_communication_preferences"("tenant_id", "customer_id", "opted_in");

-- CreateIndex
CREATE UNIQUE INDEX "customer_communication_preferences_id_tenant_id_key" ON "customer_communication_preferences"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_communication_preferences_tenant_id_customer_id_ch_key" ON "customer_communication_preferences"("tenant_id", "customer_id", "channel", "category");

-- CreateIndex
CREATE INDEX "campaign_metrics_tenant_id_campaign_id_type_occurred_at_idx" ON "campaign_metrics"("tenant_id", "campaign_id", "type", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_metrics_id_tenant_id_key" ON "campaign_metrics"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_metrics_tenant_id_campaign_id_type_event_id_key" ON "campaign_metrics"("tenant_id", "campaign_id", "type", "event_id");

-- CreateIndex
CREATE INDEX "marketing_event_receipts_tenant_id_status_next_retry_at_cre_idx" ON "marketing_event_receipts"("tenant_id", "status", "next_retry_at", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_event_receipts_id_tenant_id_key" ON "marketing_event_receipts"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_event_receipts_tenant_id_event_id_key" ON "marketing_event_receipts"("tenant_id", "event_id");

-- AddForeignKey
ALTER TABLE "customer_segments" ADD CONSTRAINT "customer_segments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_segments" ADD CONSTRAINT "customer_segments_organization_id_tenant_id_fkey" FOREIGN KEY ("organization_id", "tenant_id") REFERENCES "organizations"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segment_memberships" ADD CONSTRAINT "segment_memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segment_memberships" ADD CONSTRAINT "segment_memberships_segment_id_tenant_id_fkey" FOREIGN KEY ("segment_id", "tenant_id") REFERENCES "customer_segments"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segment_memberships" ADD CONSTRAINT "segment_memberships_customer_id_tenant_id_fkey" FOREIGN KEY ("customer_id", "tenant_id") REFERENCES "customers"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segment_membership_history" ADD CONSTRAINT "segment_membership_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segment_membership_history" ADD CONSTRAINT "segment_membership_history_segment_id_tenant_id_fkey" FOREIGN KEY ("segment_id", "tenant_id") REFERENCES "customer_segments"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segment_membership_history" ADD CONSTRAINT "segment_membership_history_customer_id_tenant_id_fkey" FOREIGN KEY ("customer_id", "tenant_id") REFERENCES "customers"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_organization_id_tenant_id_fkey" FOREIGN KEY ("organization_id", "tenant_id") REFERENCES "organizations"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_segments" ADD CONSTRAINT "campaign_segments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_segments" ADD CONSTRAINT "campaign_segments_campaign_id_tenant_id_fkey" FOREIGN KEY ("campaign_id", "tenant_id") REFERENCES "campaigns"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_segments" ADD CONSTRAINT "campaign_segments_segment_id_tenant_id_fkey" FOREIGN KEY ("segment_id", "tenant_id") REFERENCES "customer_segments"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_applicability" ADD CONSTRAINT "campaign_applicability_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_applicability" ADD CONSTRAINT "campaign_applicability_campaign_id_tenant_id_fkey" FOREIGN KEY ("campaign_id", "tenant_id") REFERENCES "campaigns"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_workflows" ADD CONSTRAINT "automation_workflows_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_workflows" ADD CONSTRAINT "automation_workflows_organization_id_tenant_id_fkey" FOREIGN KEY ("organization_id", "tenant_id") REFERENCES "organizations"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_steps" ADD CONSTRAINT "automation_steps_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_steps" ADD CONSTRAINT "automation_steps_workflow_id_tenant_id_fkey" FOREIGN KEY ("workflow_id", "tenant_id") REFERENCES "automation_workflows"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_workflow_id_tenant_id_fkey" FOREIGN KEY ("workflow_id", "tenant_id") REFERENCES "automation_workflows"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_customer_id_tenant_id_fkey" FOREIGN KEY ("customer_id", "tenant_id") REFERENCES "customers"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_step_executions" ADD CONSTRAINT "automation_step_executions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_step_executions" ADD CONSTRAINT "automation_step_executions_execution_id_tenant_id_fkey" FOREIGN KEY ("execution_id", "tenant_id") REFERENCES "automation_executions"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_step_executions" ADD CONSTRAINT "automation_step_executions_step_id_tenant_id_fkey" FOREIGN KEY ("step_id", "tenant_id") REFERENCES "automation_steps"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_organization_id_tenant_id_fkey" FOREIGN KEY ("organization_id", "tenant_id") REFERENCES "organizations"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_template_versions" ADD CONSTRAINT "notification_template_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_template_versions" ADD CONSTRAINT "notification_template_versions_template_id_tenant_id_fkey" FOREIGN KEY ("template_id", "tenant_id") REFERENCES "notification_templates"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_customer_id_tenant_id_fkey" FOREIGN KEY ("customer_id", "tenant_id") REFERENCES "customers"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_campaign_id_tenant_id_fkey" FOREIGN KEY ("campaign_id", "tenant_id") REFERENCES "campaigns"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_automation_execution_id_tenant_id_fkey" FOREIGN KEY ("automation_execution_id", "tenant_id") REFERENCES "automation_executions"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_template_id_tenant_id_fkey" FOREIGN KEY ("template_id", "tenant_id") REFERENCES "notification_templates"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_template_version_id_tenant_id_fkey" FOREIGN KEY ("template_version_id", "tenant_id") REFERENCES "notification_template_versions"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_attempts" ADD CONSTRAINT "notification_attempts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_attempts" ADD CONSTRAINT "notification_attempts_delivery_id_tenant_id_fkey" FOREIGN KEY ("delivery_id", "tenant_id") REFERENCES "notification_deliveries"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_customer_id_tenant_id_fkey" FOREIGN KEY ("customer_id", "tenant_id") REFERENCES "customers"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_delivery_id_tenant_id_fkey" FOREIGN KEY ("delivery_id", "tenant_id") REFERENCES "notification_deliveries"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_communication_preferences" ADD CONSTRAINT "customer_communication_preferences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_communication_preferences" ADD CONSTRAINT "customer_communication_preferences_customer_id_tenant_id_fkey" FOREIGN KEY ("customer_id", "tenant_id") REFERENCES "customers"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_metrics" ADD CONSTRAINT "campaign_metrics_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_metrics" ADD CONSTRAINT "campaign_metrics_campaign_id_tenant_id_fkey" FOREIGN KEY ("campaign_id", "tenant_id") REFERENCES "campaigns"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_event_receipts" ADD CONSTRAINT "marketing_event_receipts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Phase 7 tenant isolation is enforced by PostgreSQL even for the table owner.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'customer_segments',
    'segment_memberships',
    'segment_membership_history',
    'campaigns',
    'campaign_segments',
    'campaign_applicability',
    'automation_workflows',
    'automation_steps',
    'automation_executions',
    'automation_step_executions',
    'notification_templates',
    'notification_template_versions',
    'notification_deliveries',
    'notification_attempts',
    'in_app_notifications',
    'customer_communication_preferences',
    'campaign_metrics',
    'marketing_event_receipts'
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

-- Audit/history records are append-only. Corrections use compensating events.
CREATE OR REPLACE FUNCTION phase_7_prevent_immutable_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; use a compensating record', TG_TABLE_NAME
    USING ERRCODE = '55000';
END
$$;

CREATE TRIGGER segment_membership_history_append_only
  BEFORE UPDATE OR DELETE ON "segment_membership_history"
  FOR EACH ROW EXECUTE FUNCTION phase_7_prevent_immutable_mutation();

CREATE TRIGGER notification_template_versions_append_only
  BEFORE UPDATE OR DELETE ON "notification_template_versions"
  FOR EACH ROW EXECUTE FUNCTION phase_7_prevent_immutable_mutation();

CREATE TRIGGER notification_attempts_append_only
  BEFORE UPDATE OR DELETE ON "notification_attempts"
  FOR EACH ROW EXECUTE FUNCTION phase_7_prevent_immutable_mutation();

CREATE TRIGGER campaign_metrics_append_only
  BEFORE UPDATE OR DELETE ON "campaign_metrics"
  FOR EACH ROW EXECUTE FUNCTION phase_7_prevent_immutable_mutation();
