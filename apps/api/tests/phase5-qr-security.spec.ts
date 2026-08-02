import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { QrPurpose } from "@rabbehni/database";
import { describe, expect, it, vi } from "vitest";

import type { PointsService } from "../src/points/points.service.js";
import type { QrRepository } from "../src/qr/qr.repository.js";
import { QrService } from "../src/qr/qr.service.js";
import { QrTokenService } from "../src/qr/qr-token.service.js";
import type { RewardsService } from "../src/rewards/rewards.service.js";
import type { TenantContextStore } from "../src/tenancy/tenant-context.store.js";

const tenantId = "10000000-0000-4000-8000-000000000001";
const customerId = "10000000-0000-4000-8000-000000000013";

describe("Phase 5 signed QR tokens", () => {
  const tokens = new QrTokenService(
    new ConfigService({
      SESSION_SIGNING_SECRET: "phase-5-test-signing-secret-at-least-32-characters",
    }),
  );

  it("round-trips a signed tenant-bound payload", () => {
    const issued = tokens.issue({
      tenantId,
      customerId,
      purpose: QrPurpose.IDENTITY,
      exp: Math.floor(Date.now() / 1_000) + 60,
      context: { source: "mobile" },
    });
    expect(tokens.verify(issued.token)).toMatchObject({
      tenantId,
      customerId,
      purpose: QrPurpose.IDENTITY,
    });
    expect(issued.hash).toHaveLength(64);
  });

  it("rejects a modified signature", () => {
    const issued = tokens.issue({
      tenantId,
      customerId,
      purpose: QrPurpose.EARN,
      exp: Math.floor(Date.now() / 1_000) + 60,
      context: {},
    });
    const [header, payload, signature] = issued.token.split(".");
    const replacement = signature?.startsWith("A") ? "B" : "A";
    const tampered = `${header}.${payload}.${replacement}${signature?.slice(1)}`;
    expect(() => tokens.verify(tampered)).toThrow(UnauthorizedException);
  });

  it("rejects an expired token", () => {
    const issued = tokens.issue({
      tenantId,
      customerId,
      purpose: QrPurpose.REDEEM,
      exp: Math.floor(Date.now() / 1_000) - 1,
      context: {},
    });
    expect(() => tokens.verify(issued.token)).toThrow("expired");
  });
});

describe("Phase 5 QR tenant boundary", () => {
  it("rejects a validly signed token carrying another tenant before any operation", async () => {
    const repository = {
      findReplay: vi.fn().mockResolvedValue(null),
      record: vi.fn().mockResolvedValue({ status: "REJECTED" }),
    } as unknown as QrRepository;
    const tokenService = {
      verify: vi.fn().mockReturnValue({
        v: 1,
        tenantId: "20000000-0000-4000-8000-000000000001",
        customerId,
        purpose: QrPurpose.IDENTITY,
        nonce: "nonce-with-at-least-16-characters",
        exp: Math.floor(Date.now() / 1_000) + 60,
        context: {},
      }),
    } as unknown as QrTokenService;
    const service = new QrService(
      repository,
      tokenService,
      {} as PointsService,
      {} as RewardsService,
      { tenantId: () => tenantId } as TenantContextStore,
    );

    await expect(
      service.scan({
        token: "x".repeat(80),
        action: "EARN",
        idempotencyKey: "cross-tenant:qr",
        programId: "10000000-0000-4000-8000-000000000014",
        points: 10,
      } as never),
    ).rejects.toThrow("Cross-tenant");
    expect(repository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "REJECTED",
        failureReason: "Cross-tenant QR token rejected",
      }),
    );
  });
});
