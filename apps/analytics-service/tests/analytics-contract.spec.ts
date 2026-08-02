import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { canonicalEventSchema } from "../src/analytics/analytics.schemas.js";
import { metricKeys } from "../src/analytics/metric-map.js";

function event(overrides: Record<string, unknown> = {}) {
  const lineage = createHash("sha256").update("source").digest("hex");
  return canonicalEventSchema.parse({
    eventId: randomUUID(),
    eventType: "loyalty.points.posted.v1",
    tenantId: randomUUID(),
    occurredAt: new Date().toISOString(),
    source: "postgres-outbox",
    sourceRecordId: randomUUID(),
    correlationId: randomUUID(),
    idempotencyKey: randomUUID(),
    value: 25,
    metadata: { pointsType: "EARN" },
    lineageDigest: lineage,
    ...overrides,
  });
}

describe("canonical analytics contract", () => {
  it("maps an immutable points event without inventing a metric", () => {
    expect(metricKeys(event())).toEqual(["loyalty.points_earned"]);
  });

  it("classifies rejected QR replay and redemption usage", () => {
    expect(
      metricKeys(
        event({
          eventType: "qr.transaction.rejected.v1",
          metadata: { failureReason: "REPLAY_DETECTED", purpose: "REDEEM_REWARD" },
        }),
      ),
    ).toEqual(["qr.scans", "qr.rejected", "qr.replay_attempts", "qr.redemption_usage"]);
  });

  it("rejects malformed lineage and non-UUID tenant identifiers", () => {
    expect(() => event({ tenantId: "other-tenant", lineageDigest: "unsafe" })).toThrow();
  });
});
