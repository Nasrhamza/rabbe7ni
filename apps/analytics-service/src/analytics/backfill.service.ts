import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@rabbehni/database";
import { TenantTransactionService } from "@rabbehni/database/nest";
import { createHash } from "node:crypto";

import type { CanonicalEventInput } from "./analytics.schemas.js";
import { AnalyticsRepository } from "./analytics.repository.js";

@Injectable()
export class BackfillService {
  constructor(
    @Inject(TenantTransactionService) private readonly transactions: TenantTransactionService,
    @Inject(AnalyticsRepository) private readonly analytics: AnalyticsRepository,
  ) {}

  async replay(
    tenantId: string,
    input: { from: Date; to: Date; pageSize: number; timezone: string },
  ) {
    let cursor: string | undefined;
    let accepted = 0;
    let duplicates = 0;
    do {
      const events = await this.transactions.run(tenantId, (transaction) =>
        transaction.outboxEvent.findMany({
          where: { occurredAt: { gte: input.from, lt: input.to } },
          orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
          take: input.pageSize,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        }),
      );
      for (const event of events) {
        const canonical = await this.canonicalize(tenantId, event);
        const result = await this.analytics.ingest(canonical);
        if (result.duplicate) duplicates += 1;
        else accepted += 1;
      }
      cursor = events.at(-1)?.id;
      if (events.length < input.pageSize) cursor = undefined;
    } while (cursor);
    const snapshots = await this.snapshotFacts(tenantId, input.from, input.to);
    for (const snapshot of snapshots) {
      const source = `snapshot:${snapshot.metric}:${input.from.toISOString()}:${input.to.toISOString()}`;
      const eventId = this.deterministicUuid(source);
      const lineageDigest = createHash("sha256")
        .update(`${tenantId}:${source}:${snapshot.value}`)
        .digest("hex");
      const result = await this.analytics.ingest({
        eventId,
        eventType: `metric.${snapshot.metric}`,
        eventVersion: 1,
        tenantId,
        occurredAt: new Date(input.to.getTime() - 1).toISOString(),
        processedAt: new Date().toISOString(),
        source: "postgres-snapshot",
        sourceRecordId: source,
        correlationId: eventId,
        idempotencyKey: source,
        value: Number(snapshot.value),
        metadata: {
          queryVersion: "phase8-v1",
          rangeFrom: input.from.toISOString(),
          rangeTo: input.to.toISOString(),
        },
        lineageDigest,
      });
      if (result.duplicate) duplicates += 1;
      else accepted += 1;
    }
    await this.analytics.aggregate(tenantId, input);
    return { accepted, duplicates, replaySafe: true };
  }

  private snapshotFacts(tenantId: string, from: Date, to: Date) {
    return this.transactions.run(tenantId, (transaction) =>
      transaction.$queryRaw<{ metric: string; value: number }[]>(Prisma.sql`
        SELECT 'customers.total' metric, count(*)::float8 value FROM customers WHERE created_at < ${to}
        UNION ALL SELECT 'customers.new', count(*)::float8 FROM customers WHERE created_at >= ${from} AND created_at < ${to}
        UNION ALL SELECT 'customers.active', count(DISTINCT customer_id)::float8 FROM customer_activities WHERE occurred_at >= ${from} AND occurred_at < ${to}
        UNION ALL SELECT 'customers.retained', count(*)::float8 FROM (
          SELECT customer_id FROM customer_activities
          GROUP BY customer_id
          HAVING bool_or(occurred_at >= ${from} AND occurred_at < ${to})
             AND bool_or(occurred_at < ${from})
        ) retained
        UNION ALL SELECT 'customers.returning', count(DISTINCT current_activity.customer_id)::float8
          FROM customer_activities current_activity
          WHERE current_activity.occurred_at >= ${from} AND current_activity.occurred_at < ${to}
            AND EXISTS (SELECT 1 FROM customer_activities previous_activity
              WHERE previous_activity.customer_id = current_activity.customer_id
                AND previous_activity.occurred_at < ${from})
        UNION ALL SELECT 'customers.inactive', count(*)::float8 FROM customers customer
          WHERE customer.created_at < ${to} AND NOT EXISTS (
            SELECT 1 FROM customer_activities activity WHERE activity.customer_id = customer.id
              AND activity.occurred_at >= ${from} AND activity.occurred_at < ${to})
        UNION ALL SELECT 'customers.lifetime_activity', count(*)::float8 FROM customer_activities WHERE occurred_at < ${to}
        UNION ALL SELECT 'customers.period_activity', count(*)::float8 FROM customer_activities
          WHERE occurred_at >= ${from} AND occurred_at < ${to}
        UNION ALL SELECT 'customers.consent_rate',
          COALESCE(count(*) FILTER (WHERE opted_in)::float8 / NULLIF(count(*), 0), 0)
          FROM customer_communication_preferences
        UNION ALL SELECT 'customers.opt_out_rate',
          COALESCE(count(*) FILTER (WHERE NOT opted_in)::float8 / NULLIF(count(*), 0), 0)
          FROM customer_communication_preferences
        UNION ALL SELECT 'loyalty.points_earned', COALESCE(sum(abs(points)) FILTER (WHERE type::text = 'EARN'), 0)::float8
          FROM points_ledger_entries WHERE created_at >= ${from} AND created_at < ${to}
        UNION ALL SELECT 'loyalty.points_redeemed', COALESCE(sum(abs(points)) FILTER (WHERE type::text = 'REDEEM'), 0)::float8
          FROM points_ledger_entries WHERE created_at >= ${from} AND created_at < ${to}
        UNION ALL SELECT 'loyalty.points_expired', COALESCE(sum(abs(points)) FILTER (WHERE type::text = 'EXPIRE'), 0)::float8
          FROM points_ledger_entries WHERE created_at >= ${from} AND created_at < ${to}
        UNION ALL SELECT 'loyalty.points_adjusted', COALESCE(sum(points) FILTER (WHERE type::text = 'ADJUST'), 0)::float8
          FROM points_ledger_entries WHERE created_at >= ${from} AND created_at < ${to}
        UNION ALL SELECT 'loyalty.points_reversed', COALESCE(sum(points) FILTER (WHERE type::text = 'REVERSE'), 0)::float8
          FROM points_ledger_entries WHERE created_at >= ${from} AND created_at < ${to}
        UNION ALL SELECT 'loyalty.outstanding_liability', COALESCE(sum(balance), 0)::float8 FROM (
          SELECT greatest(sum(points), 0) balance FROM points_ledger_entries WHERE created_at < ${to}
          GROUP BY customer_id, program_id
        ) liability
        UNION ALL SELECT 'loyalty.active_customers', count(DISTINCT customer_id)::float8
          FROM points_ledger_entries WHERE created_at >= ${from} AND created_at < ${to}
        UNION ALL SELECT 'rewards.redemptions', count(*)::float8 FROM reward_redemptions
          WHERE status::text = 'COMPLETED' AND created_at >= ${from} AND created_at < ${to}
        UNION ALL SELECT 'rewards.stock_consumption', COALESCE(sum(quantity), 0)::float8 FROM reward_redemptions
          WHERE status::text = 'COMPLETED' AND created_at >= ${from} AND created_at < ${to}
        UNION ALL SELECT 'qr.scans', count(*)::float8 FROM qr_transactions WHERE occurred_at >= ${from} AND occurred_at < ${to}
        UNION ALL SELECT 'qr.successful', count(*)::float8 FROM qr_transactions
          WHERE status::text = 'SUCCEEDED' AND occurred_at >= ${from} AND occurred_at < ${to}
        UNION ALL SELECT 'qr.rejected', count(*)::float8 FROM qr_transactions
          WHERE status::text = 'REJECTED' AND occurred_at >= ${from} AND occurred_at < ${to}
        UNION ALL SELECT 'qr.expired', count(*)::float8 FROM qr_transactions
          WHERE lower(COALESCE(failure_reason, '')) LIKE '%expir%' AND occurred_at >= ${from} AND occurred_at < ${to}
        UNION ALL SELECT 'qr.replay_attempts', count(*)::float8 FROM qr_transactions
          WHERE lower(COALESCE(failure_reason, '')) LIKE '%replay%' AND occurred_at >= ${from} AND occurred_at < ${to}
        UNION ALL SELECT 'qr.earn_usage', count(*)::float8 FROM qr_transactions
          WHERE purpose::text = 'EARN' AND occurred_at >= ${from} AND occurred_at < ${to}
        UNION ALL SELECT 'qr.redemption_usage', count(*)::float8 FROM qr_transactions
          WHERE purpose::text = 'REDEEM' AND occurred_at >= ${from} AND occurred_at < ${to}
        UNION ALL SELECT 'gamification.xp_earned', COALESCE(sum(abs(xp)) FILTER (WHERE type::text = 'AWARD'), 0)::float8
          FROM xp_ledger_entries WHERE created_at >= ${from} AND created_at < ${to}
        UNION ALL SELECT 'gamification.active_participants', count(DISTINCT customer_id)::float8 FROM xp_ledger_entries
          WHERE created_at >= ${from} AND created_at < ${to}
        UNION ALL SELECT 'gamification.challenge_enrollment', count(*)::float8 FROM challenge_enrollments
          WHERE enrolled_at >= ${from} AND enrolled_at < ${to}
        UNION ALL SELECT 'gamification.challenge_completion', count(*)::float8 FROM challenge_enrollments
          WHERE status::text = 'COMPLETED' AND completed_at >= ${from} AND completed_at < ${to}
        UNION ALL SELECT 'gamification.habit_completion', count(*)::float8 FROM habit_completions
          WHERE occurred_at >= ${from} AND occurred_at < ${to}
        UNION ALL SELECT 'gamification.badges_earned', count(*)::float8 FROM customer_badges
          WHERE earned_at >= ${from} AND earned_at < ${to} AND revoked_at IS NULL
        UNION ALL SELECT 'gamification.leaderboard_participation', count(DISTINCT entry.customer_id)::float8
          FROM leaderboard_entries entry
          JOIN leaderboard_snapshots snapshot ON snapshot.id = entry.snapshot_id
          WHERE snapshot.generated_at >= ${from} AND snapshot.generated_at < ${to}
        UNION ALL SELECT 'gamification.level_distribution', count(*)::float8 FROM customer_gamification_profiles
        UNION ALL SELECT 'gamification.streak.0', count(*) FILTER (WHERE current_streak = 0)::float8 FROM customer_streaks
        UNION ALL SELECT 'gamification.streak.1_2', count(*) FILTER (WHERE current_streak BETWEEN 1 AND 2)::float8 FROM customer_streaks
        UNION ALL SELECT 'gamification.streak.3_6', count(*) FILTER (WHERE current_streak BETWEEN 3 AND 6)::float8 FROM customer_streaks
        UNION ALL SELECT 'gamification.streak.7_29', count(*) FILTER (WHERE current_streak BETWEEN 7 AND 29)::float8 FROM customer_streaks
        UNION ALL SELECT 'gamification.streak.30_plus', count(*) FILTER (WHERE current_streak >= 30)::float8 FROM customer_streaks
        UNION ALL SELECT 'campaign.targeted', COALESCE(sum(value) FILTER (WHERE type::text = 'TARGETED'), 0)::float8
          FROM campaign_metrics WHERE occurred_at >= ${from} AND occurred_at < ${to}
        UNION ALL SELECT 'campaign.queued', COALESCE(sum(value) FILTER (WHERE type::text = 'QUEUED'), 0)::float8
          FROM campaign_metrics WHERE occurred_at >= ${from} AND occurred_at < ${to}
        UNION ALL SELECT 'campaign.sent', COALESCE(sum(value) FILTER (WHERE type::text = 'SENT'), 0)::float8
          FROM campaign_metrics WHERE occurred_at >= ${from} AND occurred_at < ${to}
        UNION ALL SELECT 'campaign.delivered', COALESCE(sum(value) FILTER (WHERE type::text = 'DELIVERED'), 0)::float8
          FROM campaign_metrics WHERE occurred_at >= ${from} AND occurred_at < ${to}
        UNION ALL SELECT 'campaign.failed', COALESCE(sum(value) FILTER (WHERE type::text = 'FAILED'), 0)::float8
          FROM campaign_metrics WHERE occurred_at >= ${from} AND occurred_at < ${to}
        UNION ALL SELECT 'campaign.opened', COALESCE(sum(value) FILTER (WHERE type::text = 'OPENED'), 0)::float8
          FROM campaign_metrics WHERE occurred_at >= ${from} AND occurred_at < ${to}
        UNION ALL SELECT 'campaign.clicked', COALESCE(sum(value) FILTER (WHERE type::text = 'CLICKED'), 0)::float8
          FROM campaign_metrics WHERE occurred_at >= ${from} AND occurred_at < ${to}
        UNION ALL SELECT 'campaign.converted', COALESCE(sum(value) FILTER (WHERE type::text = 'CONVERTED'), 0)::float8
          FROM campaign_metrics WHERE occurred_at >= ${from} AND occurred_at < ${to}
        UNION ALL SELECT 'campaign.unsubscribed', COALESCE(sum(value) FILTER (WHERE type::text = 'UNSUBSCRIBED'), 0)::float8
          FROM campaign_metrics WHERE occurred_at >= ${from} AND occurred_at < ${to}
        UNION ALL SELECT 'automation.started', count(*)::float8 FROM automation_executions
          WHERE created_at >= ${from} AND created_at < ${to}
        UNION ALL SELECT 'automation.completed', count(*)::float8 FROM automation_executions
          WHERE status::text = 'COMPLETED' AND created_at >= ${from} AND created_at < ${to}
        UNION ALL SELECT 'automation.failed', count(*)::float8 FROM automation_executions
          WHERE status::text IN ('FAILED', 'DEAD_LETTER') AND created_at >= ${from} AND created_at < ${to}
      `),
    );
  }

  private deterministicUuid(value: string): string {
    const hash = createHash("sha256").update(value).digest("hex").slice(0, 32);
    const variant = ((Number.parseInt(hash[16] ?? "0", 16) & 0x3) | 0x8).toString(16);
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-${variant}${hash.slice(17, 20)}-${hash.slice(20)}`;
  }

  private async canonicalize(
    tenantId: string,
    event: {
      id: string;
      eventType: string;
      aggregateType: string;
      aggregateId: string;
      payload: Prisma.JsonValue;
      correlationId: string;
      occurredAt: Date;
    },
  ): Promise<CanonicalEventInput> {
    const payload = this.scalarRecord(event.payload);
    const enriched = await this.enrich(tenantId, event.aggregateType, event.aggregateId, payload);
    const digestInput = JSON.stringify({
      tenantId,
      eventId: event.id,
      sourceRecordId: event.aggregateId,
      payload: enriched.metadata,
    });
    return {
      eventId: event.id,
      eventType: event.eventType,
      eventVersion: 1,
      tenantId,
      ...(enriched.organizationId ? { organizationId: enriched.organizationId } : {}),
      ...(enriched.franchiseId ? { franchiseId: enriched.franchiseId } : {}),
      ...(enriched.merchantId ? { merchantId: enriched.merchantId } : {}),
      ...(enriched.branchId ? { branchId: enriched.branchId } : {}),
      ...(enriched.customerId ? { customerId: enriched.customerId } : {}),
      occurredAt: event.occurredAt.toISOString(),
      processedAt: new Date().toISOString(),
      source: "postgres-outbox",
      sourceRecordId: event.aggregateId,
      correlationId: event.correlationId,
      idempotencyKey: `outbox:${event.id}`,
      value: enriched.value,
      metadata: enriched.metadata,
      lineageDigest: createHash("sha256").update(digestInput).digest("hex"),
    };
  }

  private async enrich(
    tenantId: string,
    aggregateType: string,
    aggregateId: string,
    metadata: Readonly<Record<string, string | number | boolean | null>>,
  ) {
    return this.transactions.run(tenantId, async (transaction) => {
      let organizationId = this.string(metadata.organizationId);
      let franchiseId = this.string(metadata.franchiseId);
      let merchantId = this.string(metadata.merchantId);
      let branchId = this.string(metadata.branchId);
      let customerId = this.string(metadata.customerId);
      let value = this.number(metadata.value) ?? this.number(metadata.points) ?? 1;
      let output = { ...metadata };
      if (aggregateType === "points_ledger_entry") {
        const row = await transaction.pointsLedgerEntry.findUnique({ where: { id: aggregateId } });
        if (row) {
          organizationId = row.organizationId;
          merchantId = row.merchantId ?? undefined;
          branchId = row.branchId ?? undefined;
          customerId = row.customerId;
          value = Math.abs(row.points);
          output = { ...output, pointsType: row.type, signedPoints: row.points };
        }
      } else if (aggregateType === "qr_transaction") {
        const row = await transaction.qrTransaction.findUnique({ where: { id: aggregateId } });
        if (row) {
          merchantId = row.merchantId ?? undefined;
          branchId = row.branchId ?? undefined;
          customerId = row.customerId ?? undefined;
          output = {
            ...output,
            purpose: row.purpose,
            status: row.status,
            failureReason: row.failureReason,
          };
        }
      } else if (aggregateType === "xp_ledger_entry") {
        const row = await transaction.xpLedgerEntry.findUnique({ where: { id: aggregateId } });
        if (row) {
          customerId = row.customerId;
          value = Math.abs(row.xp);
          output = { ...output, xpType: row.type, signedXp: row.xp };
        }
      }
      if (customerId && !organizationId) {
        const customer = await transaction.customer.findUnique({
          where: { id: customerId },
          select: { organizationId: true },
        });
        organizationId = customer?.organizationId;
      }
      if (branchId && (!franchiseId || !merchantId || !organizationId)) {
        const branch = await transaction.branch.findUnique({
          where: { id: branchId },
          select: { franchiseId: true, merchantId: true, organizationId: true },
        });
        franchiseId ??= branch?.franchiseId ?? undefined;
        merchantId ??= branch?.merchantId ?? undefined;
        organizationId ??= branch?.organizationId;
      }
      return {
        organizationId,
        franchiseId,
        merchantId,
        branchId,
        customerId,
        value,
        metadata: output,
      };
    });
  }

  private scalarRecord(
    value: Prisma.JsonValue,
  ): Readonly<Record<string, string | number | boolean | null>> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, string | number | boolean | null] =>
          entry[1] === null || ["string", "number", "boolean"].includes(typeof entry[1]),
      ),
    );
  }

  private string(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
  }

  private number(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  }
}
