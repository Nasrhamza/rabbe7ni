import { describe, expect, it } from "vitest";

import { createLoyaltyProgramSchema } from "../src/loyalty/dto.js";
import { adjustPointsSchema } from "../src/points/dto.js";
import { qrScanSchema } from "../src/qr/dto.js";
import { createRewardSchema } from "../src/rewards/dto.js";

const organizationId = "10000000-0000-4000-8000-000000000002";
const programId = "10000000-0000-4000-8000-000000000014";

describe("Phase 5 request validation", () => {
  it("rejects invalid loyalty thresholds", () => {
    expect(
      createLoyaltyProgramSchema.safeParse({
        organizationId,
        code: "TEST",
        name: "Test",
        minimumEarnPoints: 100,
        maximumEarnPoints: 10,
      }).success,
    ).toBe(false);
  });

  it("requires a non-zero audited adjustment", () => {
    expect(
      adjustPointsSchema.safeParse({
        customerId: organizationId,
        programId,
        points: 0,
        reason: "Correction",
        idempotencyKey: "adjust:test",
      }).success,
    ).toBe(false);
  });

  it("requires QR action-specific fields", () => {
    expect(
      qrScanSchema.safeParse({
        token: "x".repeat(80),
        action: "REDEEM",
        idempotencyKey: "qr:test:1",
      }).success,
    ).toBe(false);
  });

  it("requires a positive reward cost", () => {
    expect(
      createRewardSchema.safeParse({
        organizationId,
        programId,
        code: "REWARD",
        name: "Reward",
        pointsCost: 0,
      }).success,
    ).toBe(false);
  });
});
