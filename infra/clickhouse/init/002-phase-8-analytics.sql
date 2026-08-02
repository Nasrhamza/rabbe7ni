CREATE DATABASE IF NOT EXISTS rabbehni_analytics;

CREATE TABLE IF NOT EXISTS rabbehni_analytics.raw_analytics_events
(
  event_id UUID,
  event_type LowCardinality(String),
  event_version UInt16,
  tenant_id UUID,
  organization_id Nullable(UUID),
  franchise_id Nullable(UUID),
  merchant_id Nullable(UUID),
  branch_id Nullable(UUID),
  customer_id Nullable(UUID),
  occurred_at DateTime64(3, 'UTC'),
  processed_at DateTime64(3, 'UTC'),
  source LowCardinality(String),
  source_record_id String,
  correlation_id String,
  idempotency_key String,
  value Float64,
  metadata_json String,
  lineage_digest FixedString(64),
  ingestion_status LowCardinality(String)
)
ENGINE = ReplacingMergeTree(processed_at)
PARTITION BY toYYYYMM(occurred_at)
ORDER BY (tenant_id, idempotency_key);

CREATE TABLE IF NOT EXISTS rabbehni_analytics.cleaned_analytics_events
(
  event_id UUID,
  metric_key LowCardinality(String),
  event_type LowCardinality(String),
  tenant_id UUID,
  organization_id Nullable(UUID),
  franchise_id Nullable(UUID),
  merchant_id Nullable(UUID),
  branch_id Nullable(UUID),
  customer_id Nullable(UUID),
  occurred_at DateTime64(3, 'UTC'),
  processed_at DateTime64(3, 'UTC'),
  source LowCardinality(String),
  source_record_id String,
  correlation_id String,
  idempotency_key String,
  value Float64,
  metadata_json String,
  lineage_digest FixedString(64)
)
ENGINE = ReplacingMergeTree(processed_at)
PARTITION BY toYYYYMM(occurred_at)
ORDER BY (tenant_id, idempotency_key, metric_key);

CREATE TABLE IF NOT EXISTS rabbehni_analytics.daily_metric_facts
(
  tenant_id UUID,
  metric_date Date,
  timezone String,
  metric_key LowCardinality(String),
  organization_id Nullable(UUID),
  franchise_id Nullable(UUID),
  merchant_id Nullable(UUID),
  branch_id Nullable(UUID),
  value Float64,
  generated_at DateTime64(3, 'UTC'),
  source_watermark DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree(generated_at)
PARTITION BY toYYYYMM(metric_date)
ORDER BY
(
  tenant_id,
  metric_date,
  timezone,
  metric_key,
  ifNull(organization_id, toUUID('00000000-0000-0000-0000-000000000000')),
  ifNull(franchise_id, toUUID('00000000-0000-0000-0000-000000000000')),
  ifNull(merchant_id, toUUID('00000000-0000-0000-0000-000000000000')),
  ifNull(branch_id, toUUID('00000000-0000-0000-0000-000000000000'))
);

CREATE TABLE IF NOT EXISTS rabbehni_analytics.analytics_ingestion_receipts
(
  tenant_id UUID,
  idempotency_key String,
  event_id UUID,
  status LowCardinality(String),
  attempts UInt16,
  received_at DateTime64(3, 'UTC'),
  processed_at Nullable(DateTime64(3, 'UTC')),
  failure_reason String,
  lineage_digest FixedString(64)
)
ENGINE = ReplacingMergeTree(received_at)
ORDER BY (tenant_id, idempotency_key);

CREATE TABLE IF NOT EXISTS rabbehni_analytics.analytics_dead_letters
(
  tenant_id UUID,
  idempotency_key String,
  event_json String,
  error_code LowCardinality(String),
  error_message String,
  attempts UInt16,
  created_at DateTime64(3, 'UTC')
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(created_at)
ORDER BY (tenant_id, created_at, idempotency_key);
