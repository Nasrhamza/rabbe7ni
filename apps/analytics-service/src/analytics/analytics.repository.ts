import type { ClickHouseClient } from "@clickhouse/client";
import { Inject, Injectable } from "@nestjs/common";
import type { AnalyticsMetricPoint } from "@rabbehni/contracts";

import { CLICKHOUSE_CLIENT } from "../clickhouse.constants.js";
import type { AnalyticsRange, CanonicalEventInput } from "./analytics.schemas.js";
import { metricKeys } from "./metric-map.js";

type CountRow = { count: string };
type MetricRow = { metric: string; value: number };

@Injectable()
export class AnalyticsRepository {
  constructor(@Inject(CLICKHOUSE_CLIENT) private readonly clickhouse: ClickHouseClient) {}

  async ingest(event: CanonicalEventInput): Promise<{ duplicate: boolean; metrics: number }> {
    const existing = await this.clickhouse.query({
      query: `
        SELECT count() AS count
        FROM analytics_ingestion_receipts FINAL
        WHERE tenant_id = {tenantId:UUID}
          AND idempotency_key = {idempotencyKey:String}
          AND status = 'PROCESSED'
      `,
      query_params: { tenantId: event.tenantId, idempotencyKey: event.idempotencyKey },
      format: "JSONEachRow",
    });
    const count = (await existing.json<CountRow>())[0]?.count ?? "0";
    if (Number(count) > 0) return { duplicate: true, metrics: 0 };

    const base = this.row(event);
    await this.clickhouse.insert({
      table: "raw_analytics_events",
      values: [{ ...base, event_version: event.eventVersion, ingestion_status: "ACCEPTED" }],
      format: "JSONEachRow",
    });
    const keys = metricKeys(event);
    await this.clickhouse.insert({
      table: "cleaned_analytics_events",
      values: keys.map((metricKey) => ({ ...base, metric_key: metricKey })),
      format: "JSONEachRow",
    });
    await this.clickhouse.insert({
      table: "analytics_ingestion_receipts",
      values: [
        {
          tenant_id: event.tenantId,
          idempotency_key: event.idempotencyKey,
          event_id: event.eventId,
          status: "PROCESSED",
          attempts: 1,
          received_at: event.processedAt,
          processed_at: event.processedAt,
          failure_reason: "",
          lineage_digest: event.lineageDigest,
        },
      ],
      format: "JSONEachRow",
    });
    return { duplicate: false, metrics: keys.length };
  }

  async aggregate(tenantId: string, range: AnalyticsRange): Promise<void> {
    await this.clickhouse.command({
      query: `
        INSERT INTO daily_metric_facts
        SELECT
          tenant_id,
          toDate(toTimeZone(occurred_at, {timezone:String})) AS metric_date,
          {timezone:String} AS timezone,
          metric_key,
          organization_id,
          franchise_id,
          merchant_id,
          branch_id,
          sum(value) AS value,
          now64(3) AS generated_at,
          max(processed_at) AS source_watermark
        FROM cleaned_analytics_events FINAL
        WHERE tenant_id = {tenantId:UUID}
          AND occurred_at >= {from:DateTime64(3)}
          AND occurred_at < {to:DateTime64(3)}
        GROUP BY tenant_id, metric_date, metric_key, organization_id, franchise_id,
          merchant_id, branch_id
      `,
      query_params: {
        tenantId,
        from: this.dateTime(range.from),
        to: this.dateTime(range.to),
        timezone: range.timezone,
      },
    });
  }

  async metrics(
    tenantId: string,
    range: AnalyticsRange,
  ): Promise<{
    items: readonly AnalyticsMetricPoint[];
    freshnessSeconds: number | null;
  }> {
    const duration = range.to.getTime() - range.from.getTime();
    const previousFrom = new Date(range.from.getTime() - duration);
    const scope = this.scopeSql(range);
    const result = await this.clickhouse.query({
      query: `
        SELECT metric, if(snapshot_count > 0, snapshot_value, event_value) AS value, previous
        FROM (
          SELECT
            metric_key AS metric,
            countIf(source = 'postgres-snapshot'
              AND JSONExtractString(metadata_json, 'rangeFrom') = {fromString:String}
              AND JSONExtractString(metadata_json, 'rangeTo') = {toString:String}) AS snapshot_count,
            sumIf(value, source = 'postgres-snapshot'
              AND JSONExtractString(metadata_json, 'rangeFrom') = {fromString:String}
              AND JSONExtractString(metadata_json, 'rangeTo') = {toString:String}) AS snapshot_value,
            sumIf(value, source != 'postgres-snapshot'
              AND occurred_at >= {from:DateTime64(3)} AND occurred_at < {to:DateTime64(3)}) AS event_value,
            sumIf(value, source != 'postgres-snapshot'
              AND occurred_at >= {previousFrom:DateTime64(3)}
              AND occurred_at < {from:DateTime64(3)}) AS previous
          FROM cleaned_analytics_events FINAL
          WHERE tenant_id = {tenantId:UUID}
            AND occurred_at >= {previousFrom:DateTime64(3)}
            AND occurred_at < {to:DateTime64(3)}
            ${scope.sql}
          GROUP BY metric_key
        )
        ORDER BY metric
      `,
      query_params: {
        tenantId,
        from: this.dateTime(range.from),
        to: this.dateTime(range.to),
        previousFrom: this.dateTime(previousFrom),
        fromString: range.from.toISOString(),
        toString: range.to.toISOString(),
        ...scope.parameters,
      },
      format: "JSONEachRow",
    });
    const rows = await result.json<MetricRow & { previous: number }>();
    const items = rows.map((row) => ({
      metric: row.metric,
      value: Number(row.value),
      previousValue: Number(row.previous),
      changeRate:
        Number(row.previous) === 0
          ? null
          : (Number(row.value) - Number(row.previous)) / Math.abs(Number(row.previous)),
    }));
    const freshness = await this.clickhouse.query({
      query: `
        SELECT dateDiff('second', max(processed_at), now()) AS value
        FROM cleaned_analytics_events FINAL
        WHERE tenant_id = {tenantId:UUID}
      `,
      query_params: { tenantId },
      format: "JSONEachRow",
    });
    const freshnessValue = Number((await freshness.json<{ value: number }>())[0]?.value);
    return {
      items: this.withDerivedMetrics(items),
      freshnessSeconds: Number.isFinite(freshnessValue) ? freshnessValue : null,
    };
  }

  async quality(tenantId: string) {
    const result = await this.clickhouse.query({
      query: `
        SELECT
          (SELECT count() FROM raw_analytics_events FINAL WHERE tenant_id = {tenantId:UUID}) AS raw,
          (SELECT count() FROM cleaned_analytics_events FINAL WHERE tenant_id = {tenantId:UUID}) AS cleaned,
          (SELECT count() FROM analytics_ingestion_receipts FINAL
            WHERE tenant_id = {tenantId:UUID} AND status = 'PROCESSED') AS processed,
          (SELECT count() FROM analytics_dead_letters WHERE tenant_id = {tenantId:UUID}) AS dead_letters
      `,
      query_params: { tenantId },
      format: "JSONEachRow",
    });
    return (await result.json<Record<string, string>>())[0] ?? {};
  }

  private row(event: CanonicalEventInput) {
    return {
      event_id: event.eventId,
      event_type: event.eventType,
      tenant_id: event.tenantId,
      organization_id: event.organizationId ?? null,
      franchise_id: event.franchiseId ?? null,
      merchant_id: event.merchantId ?? null,
      branch_id: event.branchId ?? null,
      customer_id: event.customerId ?? null,
      occurred_at: event.occurredAt,
      processed_at: event.processedAt,
      source: event.source,
      source_record_id: event.sourceRecordId,
      correlation_id: event.correlationId,
      idempotency_key: event.idempotencyKey,
      value: event.value,
      metadata_json: JSON.stringify(event.metadata),
      lineage_digest: event.lineageDigest,
    };
  }

  private scopeSql(range: AnalyticsRange) {
    const clauses: string[] = [];
    const parameters: Record<string, string> = {};
    for (const [key, column] of [
      ["organizationId", "organization_id"],
      ["franchiseId", "franchise_id"],
      ["merchantId", "merchant_id"],
      ["branchId", "branch_id"],
      ["customerId", "customer_id"],
    ] as const) {
      const value = range[key];
      if (value) {
        clauses.push(`${column} = {${key}:UUID}`);
        parameters[key] = value;
      }
    }
    return {
      sql: clauses.length > 0 ? `AND ${clauses.join(" AND ")}` : "",
      parameters,
    };
  }

  private withDerivedMetrics(
    items: readonly AnalyticsMetricPoint[],
  ): readonly AnalyticsMetricPoint[] {
    const values = new Map(items.map((item) => [item.metric, item.value]));
    const derived: AnalyticsMetricPoint[] = [];
    const rate = (metric: string, numerator: string, denominator: string) => {
      const bottom = values.get(denominator) ?? 0;
      if (bottom === 0) return;
      derived.push({
        metric,
        value: (values.get(numerator) ?? 0) / bottom,
        previousValue: null,
        changeRate: null,
      });
    };
    rate("loyalty.redemption_rate", "loyalty.points_redeemed", "loyalty.points_earned");
    rate("loyalty.engagement_rate", "loyalty.active_customers", "customers.active");
    rate("customers.churn_indicator", "customers.inactive", "customers.total");
    rate("customers.visit_frequency", "customers.period_activity", "customers.active");
    rate("qr.success_rate", "qr.successful", "qr.scans");
    rate("campaign.conversion_rate", "campaign.converted", "campaign.delivered");
    rate("automation.failure_rate", "automation.failed", "automation.started");
    rate("automation.execution_rate", "automation.completed", "automation.started");
    return [...items, ...derived].sort((left, right) => left.metric.localeCompare(right.metric));
  }

  private dateTime(value: Date): string {
    return value.toISOString().replace("T", " ").replace("Z", "");
  }
}
